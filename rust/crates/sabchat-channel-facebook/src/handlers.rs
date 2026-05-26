//! HTTP handlers for the SabChat Facebook channel adapter.
//!
//! Two handlers, both server-to-server (no `AuthUser`):
//!
//! | Endpoint                                          | Handler                |
//! |---------------------------------------------------|------------------------|
//! | `POST /v1/sabchat/channels/facebook/ingest`       | [`ingest_messenger`]   |
//! | `POST /v1/sabchat/channels/facebook/comment`      | [`ingest_comment`]     |
//!
//! ## Pipeline
//!
//! Both handlers walk the same shape:
//!
//! 1. **Resolve inbox** by `channel_type == "facebook"` AND
//!    `channel_config.settings.page_id == event.page_id`. Tenancy
//!    flows out of the resolved document.
//! 2. **Idempotency check** against
//!    `sabchat_messages.providerMetadata.dedupeKey`. If the key is
//!    already there, return the existing ids with `created: false`.
//! 3. **Upsert contact** on `socialIds` matching
//!    `{ provider: "facebook", externalId: sender_id }`. Brand-new
//!    contacts are inserted with the optional display name.
//! 4. **Upsert open conversation** for `(tenant, inbox, contact)`. If
//!    an `Open` / `Pending` row already exists, reuse it; otherwise
//!    insert a fresh `Open` conversation.
//! 5. **Insert visitor message** with the channel-specific content
//!    block (text / image / file / card-citation).
//! 6. **Patch conversation** `lastMessageAt` / `lastMessagePreview` /
//!    `unreadCount` (visitor messages always increment unread).
//!
//! ## Why no audit writes
//!
//! Ingest is a hot path and audit visibility for inbound traffic is
//! already provided by the upstream webhook log on the shim side.
//! Sibling channel adapters (Instagram) follow the same convention.

use axum::{Json, extract::State};
use bson::{Bson, Document, doc, oid::ObjectId};
use chrono::Utc;
use sabnode_common::{ApiError, Result};
use sabnode_db::mongo::MongoHandle;
use serde_json::{Value, json};
use tracing::instrument;

use crate::dto::{CommentIngestBody, IngestResponse, MessengerIngestBody};
use crate::state::SabChatChannelFacebookState;

// ===========================================================================
// Collection names — kept inline; matches the SabChat handler crates 1:1.
// ===========================================================================

const INBOXES_COLL: &str = "sabchat_inboxes";
const CONTACTS_COLL: &str = "sabchat_contacts";
const CONVERSATIONS_COLL: &str = "sabchat_conversations";
const MESSAGES_COLL: &str = "sabchat_messages";

/// Stable provider discriminant used on
/// `SabChatContact.socialIds[].provider` and on the inbox lookup. Matches
/// the `ChannelType::Facebook` snake-case serialisation.
const PROVIDER: &str = "facebook";

// ===========================================================================
// Resolved-ids tuple used by both ingest paths.
// ===========================================================================

/// Locator triple emitted by the upsert pipeline. Used to build the
/// final ingest response and to short-circuit duplicate webhook
/// deliveries.
struct ResolvedIds {
    inbox_oid: ObjectId,
    tenant_oid: ObjectId,
    contact_oid: ObjectId,
    conversation_oid: ObjectId,
}

// ===========================================================================
// POST /ingest — Messenger DM
// ===========================================================================

/// `POST /v1/sabchat/channels/facebook/ingest` — translate a Messenger
/// DM webhook into a SabChat visitor message.
#[instrument(skip_all, fields(page_id = %body.page_id, sender_id = %body.sender_id, mid = %body.provider_message_id))]
pub async fn ingest_messenger(
    State(state): State<SabChatChannelFacebookState>,
    Json(body): Json<MessengerIngestBody>,
) -> Result<Json<IngestResponse>> {
    // ---- Input validation ----------------------------------------------
    if body.page_id.trim().is_empty()
        || body.sender_id.trim().is_empty()
        || body.provider_message_id.trim().is_empty()
    {
        return Err(ApiError::Validation(
            "pageId, senderId, and providerMessageId are required.".to_owned(),
        ));
    }
    let has_text = body.text.as_deref().is_some_and(|s| !s.trim().is_empty());
    let has_attachment = body
        .attachment_url
        .as_deref()
        .is_some_and(|s| !s.trim().is_empty());
    if !has_text && !has_attachment {
        return Err(ApiError::Validation(
            "Either text or attachmentUrl must be provided.".to_owned(),
        ));
    }

    // ---- Inbox + tenant resolution -------------------------------------
    let inbox = load_inbox_for_page(&state.mongo, &body.page_id).await?;
    let inbox_oid = inbox
        .get_object_id("_id")
        .map_err(|_| ApiError::Internal(anyhow::anyhow!("inbox missing _id")))?;
    let tenant_oid = inbox
        .get_object_id("tenantId")
        .map_err(|_| ApiError::Internal(anyhow::anyhow!("inbox missing tenantId")))?;

    // ---- Idempotency check ---------------------------------------------
    let dedupe_key = format!("fb-msg:{}", body.provider_message_id);
    if let Some(existing) = find_existing_by_dedupe(&state.mongo, &dedupe_key).await? {
        return Ok(Json(existing));
    }

    // ---- Contact upsert -------------------------------------------------
    let contact_oid = upsert_contact(
        &state.mongo,
        tenant_oid,
        &body.sender_id,
        body.sender_name.as_deref(),
    )
    .await?;

    // ---- Conversation upsert -------------------------------------------
    let conversation_oid =
        upsert_open_conversation(&state.mongo, tenant_oid, inbox_oid, contact_oid).await?;

    // ---- Build the content block --------------------------------------
    //
    // Decision tree:
    // - text only           → ContentBlock::Text
    // - attachment image/*  → ContentBlock::Image
    // - attachment other    → ContentBlock::File
    // - text + attachment   → attachment wins; the text is appended as
    //                         the image `alt` / file `name` hint so we
    //                         don't drop it.
    let (content, preview) = build_message_content(&body);

    // ---- Insert the message --------------------------------------------
    let event_ts = body.timestamp.unwrap_or_else(Utc::now);
    let provider_metadata = json!({
        "channel": PROVIDER,
        "pageId": body.page_id,
        "senderId": body.sender_id,
        "providerMessageId": body.provider_message_id,
        "dedupeKey": dedupe_key,
    });

    let message_oid = insert_visitor_message(
        &state.mongo,
        ResolvedIds {
            inbox_oid,
            tenant_oid,
            contact_oid,
            conversation_oid,
        },
        content,
        provider_metadata,
        event_ts,
    )
    .await?;

    // ---- Patch the parent conversation ---------------------------------
    bump_conversation_after_inbound(
        &state.mongo,
        tenant_oid,
        conversation_oid,
        preview,
        event_ts,
    )
    .await?;

    Ok(Json(IngestResponse {
        ok: true,
        created: true,
        message_id: message_oid.to_hex(),
        conversation_id: conversation_oid.to_hex(),
        contact_id: contact_oid.to_hex(),
        inbox_id: inbox_oid.to_hex(),
    }))
}

// ===========================================================================
// POST /comment — Page comment
// ===========================================================================

/// `POST /v1/sabchat/channels/facebook/comment` — translate a Page
/// comment webhook into a SabChat visitor message carrying a
/// `ContentBlock::Card` that cites the post.
#[instrument(skip_all, fields(page_id = %body.page_id, post_id = %body.post_id, comment_id = %body.comment_id))]
pub async fn ingest_comment(
    State(state): State<SabChatChannelFacebookState>,
    Json(body): Json<CommentIngestBody>,
) -> Result<Json<IngestResponse>> {
    // ---- Input validation ----------------------------------------------
    if body.page_id.trim().is_empty()
        || body.sender_id.trim().is_empty()
        || body.post_id.trim().is_empty()
        || body.comment_id.trim().is_empty()
        || body.text.trim().is_empty()
    {
        return Err(ApiError::Validation(
            "pageId, senderId, postId, commentId, and text are required.".to_owned(),
        ));
    }

    // ---- Inbox + tenant resolution -------------------------------------
    let inbox = load_inbox_for_page(&state.mongo, &body.page_id).await?;
    let inbox_oid = inbox
        .get_object_id("_id")
        .map_err(|_| ApiError::Internal(anyhow::anyhow!("inbox missing _id")))?;
    let tenant_oid = inbox
        .get_object_id("tenantId")
        .map_err(|_| ApiError::Internal(anyhow::anyhow!("inbox missing tenantId")))?;

    // ---- Idempotency check ---------------------------------------------
    let dedupe_key = format!("fb-comment:{}", body.comment_id);
    if let Some(existing) = find_existing_by_dedupe(&state.mongo, &dedupe_key).await? {
        return Ok(Json(existing));
    }

    // ---- Contact upsert (no display name on the wire for comments) ----
    let contact_oid = upsert_contact(&state.mongo, tenant_oid, &body.sender_id, None).await?;

    // ---- Conversation upsert -------------------------------------------
    let conversation_oid =
        upsert_open_conversation(&state.mongo, tenant_oid, inbox_oid, contact_oid).await?;

    // ---- Build the card block ------------------------------------------
    //
    // Card semantics: comments are rendered as a citation row that
    // visually anchors the agent to the post the comment was left on.
    // We synthesize a permalink-shaped string so the link button is
    // always populated; the shim may overwrite `provider_metadata.url`
    // with the real Graph-resolved permalink before relay.
    let post_url = format!("https://www.facebook.com/{}", body.post_id);
    let content = json!({
        "kind": "card",
        "title": body.text,
        "subtitle": format!("Comment on post {}", body.post_id),
        "buttons": [
            {
                "label": "View post",
                "kind": "link",
                "value": post_url,
            }
        ],
    });
    let preview = truncate_preview(&body.text);

    let event_ts = body.timestamp.unwrap_or_else(Utc::now);
    let provider_metadata = json!({
        "channel": PROVIDER,
        "kind": "comment",
        "pageId": body.page_id,
        "senderId": body.sender_id,
        "postId": body.post_id,
        "commentId": body.comment_id,
        "dedupeKey": dedupe_key,
    });

    let message_oid = insert_visitor_message(
        &state.mongo,
        ResolvedIds {
            inbox_oid,
            tenant_oid,
            contact_oid,
            conversation_oid,
        },
        content,
        provider_metadata,
        event_ts,
    )
    .await?;

    bump_conversation_after_inbound(
        &state.mongo,
        tenant_oid,
        conversation_oid,
        preview,
        event_ts,
    )
    .await?;

    Ok(Json(IngestResponse {
        ok: true,
        created: true,
        message_id: message_oid.to_hex(),
        conversation_id: conversation_oid.to_hex(),
        contact_id: contact_oid.to_hex(),
        inbox_id: inbox_oid.to_hex(),
    }))
}

// ===========================================================================
// Inbox / dedupe helpers
// ===========================================================================

/// Look up the SabChat inbox that owns events for `page_id`.
///
/// Mirrors the task spec:
///
/// ```text
/// channel_type == "facebook"
///  AND channel_config.settings.page_id == event.page_id
/// ```
///
/// We additionally require `enabled != false` so a disabled inbox no
/// longer accepts traffic — the shim already drops these, but a second
/// guard here keeps the contract honest if anyone POSTs raw.
async fn load_inbox_for_page(mongo: &MongoHandle, page_id: &str) -> Result<Document> {
    let coll = mongo.collection::<Document>(INBOXES_COLL);
    let filter = doc! {
        "channelType": PROVIDER,
        "channelConfig.settings.pageId": page_id,
        // Treat missing as enabled to match the `default_true` in
        // `SabChatInbox::enabled`.
        "enabled": { "$ne": false },
    };
    coll.find_one(filter)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabchat_inboxes.find_one(facebook)"))
        })?
        .ok_or_else(|| {
            ApiError::NotFound(format!(
                "No Facebook inbox is configured for page id `{page_id}`.",
            ))
        })
}

/// Idempotency lookup. If a message with this `dedupeKey` already
/// exists, materialise the full [`IngestResponse`] from the persisted
/// doc so the caller sees stable ids on retry.
async fn find_existing_by_dedupe(
    mongo: &MongoHandle,
    dedupe_key: &str,
) -> Result<Option<IngestResponse>> {
    let coll = mongo.collection::<Document>(MESSAGES_COLL);
    let existing = coll
        .find_one(doc! { "providerMetadata.dedupeKey": dedupe_key })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabchat_messages.find_one(dedupe)"))
        })?;

    let Some(doc) = existing else {
        return Ok(None);
    };

    let message_oid = doc
        .get_object_id("_id")
        .map_err(|_| ApiError::Internal(anyhow::anyhow!("dedup message missing _id")))?;
    let conversation_oid = doc
        .get_object_id("conversationId")
        .map_err(|_| ApiError::Internal(anyhow::anyhow!("dedup message missing conversationId")))?;
    let contact_oid = doc
        .get_object_id("contactId")
        .map_err(|_| ApiError::Internal(anyhow::anyhow!("dedup message missing contactId")))?;
    let inbox_oid = doc
        .get_object_id("inboxId")
        .map_err(|_| ApiError::Internal(anyhow::anyhow!("dedup message missing inboxId")))?;

    Ok(Some(IngestResponse {
        ok: true,
        created: false,
        message_id: message_oid.to_hex(),
        conversation_id: conversation_oid.to_hex(),
        contact_id: contact_oid.to_hex(),
        inbox_id: inbox_oid.to_hex(),
    }))
}

// ===========================================================================
// Contact / conversation upserts
// ===========================================================================

/// Upsert a `SabChatContact` keyed on
/// `{ tenantId, socialIds.provider="facebook", socialIds.externalId=sender_id }`.
///
/// On insert we seed the social identity, the optional display name,
/// and a `lastSeenAt` of "now". On match we refresh `lastSeenAt` and
/// only patch the `name` if the existing row was nameless — we never
/// stomp an agent-curated name with whatever Meta currently reports.
async fn upsert_contact(
    mongo: &MongoHandle,
    tenant_oid: ObjectId,
    sender_id: &str,
    sender_name: Option<&str>,
) -> Result<ObjectId> {
    let coll = mongo.collection::<Document>(CONTACTS_COLL);
    let now_bson = bson::DateTime::from_chrono(Utc::now());

    let filter = doc! {
        "tenantId": tenant_oid,
        "socialIds": {
            "$elemMatch": {
                "provider": PROVIDER,
                "externalId": sender_id,
            },
        },
    };

    if let Some(existing) = coll
        .find_one(filter.clone())
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabchat_contacts.find_one"))
        })?
    {
        let existing_oid = existing
            .get_object_id("_id")
            .map_err(|_| ApiError::Internal(anyhow::anyhow!("contact missing _id")))?;

        // Refresh `lastSeenAt`; opportunistically fill `name` if empty.
        let needs_name_patch = existing
            .get_str("name")
            .map(str::is_empty)
            .unwrap_or(true);

        let mut set_doc = doc! {
            "lastSeenAt": now_bson,
            "updatedAt": now_bson,
        };
        if needs_name_patch {
            if let Some(name) = sender_name.filter(|s| !s.trim().is_empty()) {
                set_doc.insert("name", name);
            }
        }

        coll.update_one(doc! { "_id": existing_oid }, doc! { "$set": set_doc })
            .await
            .map_err(|e| {
                ApiError::Internal(
                    anyhow::Error::new(e).context("sabchat_contacts.update_one(touch)"),
                )
            })?;

        return Ok(existing_oid);
    }

    // ---- Brand-new contact --------------------------------------------
    let new_oid = ObjectId::new();
    let mut new_doc = doc! {
        "_id": new_oid,
        "tenantId": tenant_oid,
        "emails": Bson::Array(Vec::new()),
        "phones": Bson::Array(Vec::new()),
        "socialIds": Bson::Array(vec![Bson::Document(doc! {
            "provider": PROVIDER,
            "externalId": sender_id,
        })]),
        "attrs": Bson::Document(Document::new()),
        "tags": Bson::Array(Vec::new()),
        "lastSeenAt": now_bson,
        "createdAt": now_bson,
        "updatedAt": now_bson,
    };
    if let Some(name) = sender_name.filter(|s| !s.trim().is_empty()) {
        new_doc.insert("name", name);
    }

    coll.insert_one(new_doc).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabchat_contacts.insert_one"))
    })?;

    Ok(new_oid)
}

/// Find the active conversation for `(tenant, inbox, contact)`, or
/// create a fresh `Open` one.
///
/// "Active" means `status in {open, pending, snoozed}`. We treat
/// `resolved` as terminal so a new message after resolution opens a
/// new conversation row — matches Chatwoot semantics and what
/// `sabchat-conversations` does on its create endpoint.
async fn upsert_open_conversation(
    mongo: &MongoHandle,
    tenant_oid: ObjectId,
    inbox_oid: ObjectId,
    contact_oid: ObjectId,
) -> Result<ObjectId> {
    let coll = mongo.collection::<Document>(CONVERSATIONS_COLL);
    let filter = doc! {
        "tenantId": tenant_oid,
        "inboxId": inbox_oid,
        "contactId": contact_oid,
        "status": { "$in": ["open", "pending", "snoozed"] },
    };

    if let Some(existing) = coll.find_one(filter).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabchat_conversations.find_one(active)"))
    })? {
        return existing
            .get_object_id("_id")
            .map_err(|_| ApiError::Internal(anyhow::anyhow!("conversation missing _id")));
    }

    let now_bson = bson::DateTime::from_chrono(Utc::now());
    let new_oid = ObjectId::new();
    let new_doc = doc! {
        "_id": new_oid,
        "tenantId": tenant_oid,
        "inboxId": inbox_oid,
        "contactId": contact_oid,
        "status": "open",
        "priority": "medium",
        "assigneeId": Bson::Null,
        "teamId": Bson::Null,
        "labels": Bson::Array(Vec::new()),
        "snoozeUntil": Bson::Null,
        "sla": doc! {
            "firstResponseDueAt": Bson::Null,
            "nextResponseDueAt": Bson::Null,
            "resolutionDueAt": Bson::Null,
            "breached": false,
        },
        "lastMessageAt": Bson::Null,
        "lastMessagePreview": Bson::Null,
        "unreadCount": 0_i32,
        "customAttrs": Bson::Document(Document::new()),
        "firstResponseAt": Bson::Null,
        "resolvedAt": Bson::Null,
        "createdAt": now_bson,
        "updatedAt": now_bson,
    };

    coll.insert_one(new_doc).await.map_err(|e| {
        ApiError::Internal(
            anyhow::Error::new(e).context("sabchat_conversations.insert_one(facebook)"),
        )
    })?;

    Ok(new_oid)
}

// ===========================================================================
// Message insert + conversation patch
// ===========================================================================

/// Insert one visitor message and return its `_id`.
async fn insert_visitor_message(
    mongo: &MongoHandle,
    ids: ResolvedIds,
    content: Value,
    provider_metadata: Value,
    event_ts: chrono::DateTime<Utc>,
) -> Result<ObjectId> {
    let content_bson = Bson::try_from(content).unwrap_or(Bson::Null);
    let provider_metadata_bson = Bson::try_from(provider_metadata).unwrap_or(Bson::Null);

    let new_oid = ObjectId::new();
    let new_doc = doc! {
        "_id": new_oid,
        "tenantId": ids.tenant_oid,
        "conversationId": ids.conversation_oid,
        "inboxId": ids.inbox_oid,
        "contactId": ids.contact_oid,
        "senderType": "visitor",
        // sender_id intentionally omitted for visitor messages — matches
        // the convention in `sabchat-messages::handlers::append`.
        "direction": "inbound",
        "content": content_bson,
        "attachments": Bson::Array(Vec::new()),
        "providerMetadata": provider_metadata_bson,
        "private": false,
        "createdAt": bson::DateTime::from_chrono(event_ts),
    };

    mongo
        .collection::<Document>(MESSAGES_COLL)
        .insert_one(new_doc)
        .await
        .map_err(|e| {
            ApiError::Internal(
                anyhow::Error::new(e).context("sabchat_messages.insert_one(facebook)"),
            )
        })?;

    Ok(new_oid)
}

/// Patch the parent conversation after an inbound visitor message:
/// bump `lastMessageAt`, refresh the preview, and increment the
/// agent-side `unreadCount`.
async fn bump_conversation_after_inbound(
    mongo: &MongoHandle,
    tenant_oid: ObjectId,
    conversation_oid: ObjectId,
    preview: String,
    event_ts: chrono::DateTime<Utc>,
) -> Result<()> {
    let ts_bson = bson::DateTime::from_chrono(event_ts);
    let update = doc! {
        "$set": {
            "lastMessageAt": ts_bson,
            "lastMessagePreview": preview,
            "updatedAt": ts_bson,
        },
        "$inc": { "unreadCount": 1_i64 },
    };
    mongo
        .collection::<Document>(CONVERSATIONS_COLL)
        .update_one(doc! { "_id": conversation_oid, "tenantId": tenant_oid }, update)
        .await
        .map_err(|e| {
            ApiError::Internal(
                anyhow::Error::new(e).context("sabchat_conversations.update_one(facebook-sync)"),
            )
        })?;
    Ok(())
}

// ===========================================================================
// Content + preview helpers
// ===========================================================================

/// Maximum length of `lastMessagePreview`. Matches the inbox-row
/// truncation budget used elsewhere in SabChat (60 chars + ellipsis).
const PREVIEW_LIMIT: usize = 60;

/// Build the `ContentBlock` JSON + preview string for a Messenger
/// ingest. Text-only is the common path; attachment messages fall
/// into image vs file based on MIME prefix.
fn build_message_content(body: &MessengerIngestBody) -> (Value, String) {
    let text = body.text.as_deref().unwrap_or("").trim();
    let url = body.attachment_url.as_deref().unwrap_or("").trim();
    let mime = body.attachment_mime.as_deref().unwrap_or("");

    if !url.is_empty() {
        let is_image = mime.starts_with("image/");
        if is_image {
            // Use the optional text as `alt`; falls back to filename
            // when missing. Preview shows the alt or "[image]".
            let alt = if text.is_empty() { None } else { Some(text) };
            let preview = if text.is_empty() {
                "[image]".to_owned()
            } else {
                truncate_preview(text)
            };
            let mut card = json!({
                "kind": "image",
                "url": url,
            });
            if let Some(a) = alt {
                card["alt"] = Value::String(a.to_owned());
            }
            return (card, preview);
        }

        // Non-image attachment → File. Synthesize a name from the URL
        // tail so the agent UI has something to render.
        let name = guess_file_name(url);
        let attachment = json!({
            "sabfileId": "",
            "url": url,
            "name": name,
            "mime": if mime.is_empty() { Value::Null } else { Value::String(mime.to_owned()) },
        });
        let preview = if text.is_empty() {
            "[attachment]".to_owned()
        } else {
            truncate_preview(text)
        };
        return (
            json!({
                "kind": "file",
                "attachment": attachment,
            }),
            preview,
        );
    }

    // ---- Pure text ----------------------------------------------------
    (
        json!({ "kind": "text", "text": text }),
        truncate_preview(text),
    )
}

/// Truncate `s` to [`PREVIEW_LIMIT`] chars, appending `…` on
/// truncation. Operates on character boundaries — Unicode-safe.
fn truncate_preview(s: &str) -> String {
    let trimmed = s.trim();
    if trimmed.chars().count() <= PREVIEW_LIMIT {
        return trimmed.to_owned();
    }
    let mut out: String = trimmed.chars().take(PREVIEW_LIMIT).collect();
    out.push('…');
    out
}

/// Best-effort filename extraction from a URL. Strips the query string
/// and returns the last path segment, falling back to `"attachment"`
/// when the URL is opaque.
fn guess_file_name(url: &str) -> String {
    let no_query = url.split('?').next().unwrap_or(url);
    let tail = no_query.rsplit('/').next().unwrap_or("");
    if tail.is_empty() {
        "attachment".to_owned()
    } else {
        tail.to_owned()
    }
}

// ===========================================================================
// Tests
// ===========================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn truncate_preview_passthrough_short() {
        assert_eq!(truncate_preview("hi"), "hi");
        assert_eq!(truncate_preview("   trimmed   "), "trimmed");
    }

    #[test]
    fn truncate_preview_caps_long() {
        let long: String = "a".repeat(PREVIEW_LIMIT + 10);
        let out = truncate_preview(&long);
        assert_eq!(out.chars().count(), PREVIEW_LIMIT + 1);
        assert!(out.ends_with('…'));
    }

    #[test]
    fn guess_file_name_basic() {
        assert_eq!(guess_file_name("https://cdn.example/x/y/file.pdf"), "file.pdf");
        assert_eq!(
            guess_file_name("https://cdn.example/x/y/file.pdf?sig=abc"),
            "file.pdf",
        );
        assert_eq!(guess_file_name("https://cdn.example/"), "attachment");
    }

    #[test]
    fn build_message_content_text_only() {
        let body = MessengerIngestBody {
            page_id: "p".into(),
            sender_id: "s".into(),
            sender_name: None,
            text: Some("hello".into()),
            attachment_url: None,
            attachment_mime: None,
            provider_message_id: "mid".into(),
            timestamp: None,
        };
        let (content, preview) = build_message_content(&body);
        assert_eq!(content["kind"], "text");
        assert_eq!(content["text"], "hello");
        assert_eq!(preview, "hello");
    }

    #[test]
    fn build_message_content_image_attachment() {
        let body = MessengerIngestBody {
            page_id: "p".into(),
            sender_id: "s".into(),
            sender_name: None,
            text: Some("look".into()),
            attachment_url: Some("https://cdn/img.png".into()),
            attachment_mime: Some("image/png".into()),
            provider_message_id: "mid".into(),
            timestamp: None,
        };
        let (content, preview) = build_message_content(&body);
        assert_eq!(content["kind"], "image");
        assert_eq!(content["url"], "https://cdn/img.png");
        assert_eq!(content["alt"], "look");
        assert_eq!(preview, "look");
    }

    #[test]
    fn build_message_content_file_attachment_no_text() {
        let body = MessengerIngestBody {
            page_id: "p".into(),
            sender_id: "s".into(),
            sender_name: None,
            text: None,
            attachment_url: Some("https://cdn/y/doc.pdf".into()),
            attachment_mime: Some("application/pdf".into()),
            provider_message_id: "mid".into(),
            timestamp: None,
        };
        let (content, preview) = build_message_content(&body);
        assert_eq!(content["kind"], "file");
        assert_eq!(content["attachment"]["name"], "doc.pdf");
        assert_eq!(content["attachment"]["mime"], "application/pdf");
        assert_eq!(preview, "[attachment]");
    }
}
