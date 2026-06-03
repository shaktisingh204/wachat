//! HTTP handlers for the SabChat Instagram channel adapter.
//!
//! Both endpoints are server-to-server (the Next.js webhook shim calls
//! Rust after verifying Meta's signature). There is no [`AuthUser`]
//! extractor; tenancy is implicit in the matched inbox.
//!
//! ## Flow (shared between `/ingest` and `/comment`)
//!
//! 1. **Resolve inbox** — find the [`SabChatInbox`] where
//!    `channel_type == "instagram"` AND
//!    `channel_config.settings.ig_user_id == body.ig_user_id`.
//!    Missing → `404`. The inbox carries `tenant_id` for every downstream
//!    write.
//! 2. **Idempotency probe** — look up an existing message keyed by
//!    `tenantId + providerMetadata.idempotencyKey`. If present, return
//!    `{ conversationId, messageId }` from the stored row.
//! 3. **Resolve contact** — find an existing `sabchat_contacts` doc with
//!    a `socialIds` element matching `provider="instagram"` +
//!    `externalId=senderId` for this tenant. Otherwise insert a new
//!    contact carrying just that social id (and `name` if a username was
//!    supplied).
//! 4. **Resolve conversation** — find the newest open conversation for
//!    `(tenantId, inboxId, contactId)`. Otherwise create a fresh
//!    `open / medium` conversation.
//! 5. **Append message** — insert one `sabchat_messages` doc with
//!    `senderType = "visitor"`, `direction = "inbound"`, a `ContentBlock`
//!    derived from `text`/`attachment`, and `providerMetadata` carrying
//!    the idempotency key + raw IG metadata.
//! 6. **Roll up conversation** — set `lastMessageAt` /
//!    `lastMessagePreview`, `$inc unreadCount`.
//! 7. **Audit** — append a best-effort `message_sent` event to
//!    `sabchat_audit_log` (failure logged, never propagated).
//!
//! ## Idempotency
//!
//! `providerMessageId` (DM) and `commentId` (comment) ride into
//! `sabchat_messages.providerMetadata.idempotencyKey`. Step 2 above
//! short-circuits replays — Meta retries webhooks aggressively and we
//! must never double-write.

use axum::{Json, extract::State};
use bson::{Bson, Document, doc, oid::ObjectId};
use chrono::{DateTime, Utc};
use sabchat_types::ContentBlock;
use sabnode_common::{ApiError, Result};
use sabnode_db::mongo::MongoHandle;
use tracing::instrument;

use crate::dto::{IngestCommentBody, IngestDmBody, IngestResponse};
use crate::state::SabChatChannelInstagramState;

// ===========================================================================
// Collection names — kept inline (only referenced from this file).
// ===========================================================================

const INBOXES_COLL: &str = "sabchat_inboxes";
const CONTACTS_COLL: &str = "sabchat_contacts";
const CONVERSATIONS_COLL: &str = "sabchat_conversations";
const MESSAGES_COLL: &str = "sabchat_messages";
const AUDIT_COLL: &str = "sabchat_audit_log";

const PROVIDER: &str = "instagram";

// ===========================================================================
// POST /ingest — DM ingest
// ===========================================================================

/// `POST /v1/sabchat/channels/instagram/ingest` — translate one Instagram
/// DM webhook event into a SabChat message.
///
/// Idempotent on `providerMessageId`. See module docs for the full flow.
#[instrument(skip_all, fields(ig_user_id = %body.ig_user_id, provider_message_id = %body.provider_message_id))]
pub async fn ingest_dm(
    State(state): State<SabChatChannelInstagramState>,
    Json(body): Json<IngestDmBody>,
) -> Result<Json<IngestResponse>> {
    // ---- Input validation ----------------------------------------------
    if body.ig_user_id.trim().is_empty() {
        return Err(ApiError::Validation("igUserId is required.".to_owned()));
    }
    if body.sender_id.trim().is_empty() {
        return Err(ApiError::Validation("senderId is required.".to_owned()));
    }
    if body.provider_message_id.trim().is_empty() {
        return Err(ApiError::Validation(
            "providerMessageId is required.".to_owned(),
        ));
    }
    let has_text = body
        .text
        .as_deref()
        .map(|s| !s.trim().is_empty())
        .unwrap_or(false);
    let has_attachment = body
        .attachment_url
        .as_deref()
        .map(|s| !s.trim().is_empty())
        .unwrap_or(false);
    if !has_text && !has_attachment {
        return Err(ApiError::Validation(
            "DM must carry either text or an attachment.".to_owned(),
        ));
    }

    // ---- 1. Resolve inbox ----------------------------------------------
    let (inbox_oid, tenant_oid) = resolve_inbox(&state.mongo, &body.ig_user_id).await?;

    // ---- 2. Idempotency probe ------------------------------------------
    if let Some(hit) =
        find_existing_message(&state.mongo, tenant_oid, &body.provider_message_id).await?
    {
        return Ok(Json(hit));
    }

    // ---- 3. Resolve contact --------------------------------------------
    let contact_oid = resolve_contact(
        &state.mongo,
        tenant_oid,
        &body.sender_id,
        body.sender_username.as_deref(),
    )
    .await?;

    // ---- 4. Resolve conversation ---------------------------------------
    let now = body.timestamp.unwrap_or_else(Utc::now);
    let conversation_oid =
        resolve_conversation(&state.mongo, tenant_oid, inbox_oid, contact_oid, now).await?;

    // ---- 5. Build content + insert message -----------------------------
    let content = build_dm_content(&body);
    let preview = preview_for(&content);

    let message_oid = insert_message(
        &state.mongo,
        InsertMessage {
            tenant_oid,
            conversation_oid,
            inbox_oid,
            contact_oid,
            content: &content,
            attachments: build_attachments_from_dm(&body),
            idempotency_key: &body.provider_message_id,
            provider_meta_extra: build_dm_provider_meta(&body),
            at: now,
        },
    )
    .await?;

    // ---- 6. Roll up conversation ---------------------------------------
    rollup_conversation(&state.mongo, tenant_oid, conversation_oid, &preview, now).await?;

    // ---- 7. Audit ------------------------------------------------------
    write_audit(
        &state.mongo,
        tenant_oid,
        conversation_oid,
        contact_oid,
        inbox_oid,
        "message_sent",
    )
    .await;

    Ok(Json(IngestResponse {
        conversation_id: conversation_oid.to_hex(),
        message_id: message_oid.to_hex(),
    }))
}

// ===========================================================================
// POST /comment — comment ingest
// ===========================================================================

/// `POST /v1/sabchat/channels/instagram/comment` — translate one
/// Instagram post-comment webhook event into a SabChat message.
///
/// The persisted message is a `Card` content block whose title cites the
/// comment and subtitle references the parent post id, so agents can see
/// at a glance that this row originated from a comment rather than a DM.
///
/// Idempotent on `commentId`.
#[instrument(skip_all, fields(ig_user_id = %body.ig_user_id, comment_id = %body.comment_id))]
pub async fn ingest_comment(
    State(state): State<SabChatChannelInstagramState>,
    Json(body): Json<IngestCommentBody>,
) -> Result<Json<IngestResponse>> {
    // ---- Input validation ----------------------------------------------
    if body.ig_user_id.trim().is_empty() {
        return Err(ApiError::Validation("igUserId is required.".to_owned()));
    }
    if body.sender_id.trim().is_empty() {
        return Err(ApiError::Validation("senderId is required.".to_owned()));
    }
    if body.post_id.trim().is_empty() {
        return Err(ApiError::Validation("postId is required.".to_owned()));
    }
    if body.comment_id.trim().is_empty() {
        return Err(ApiError::Validation("commentId is required.".to_owned()));
    }
    if body.text.trim().is_empty() {
        return Err(ApiError::Validation("Comment text is required.".to_owned()));
    }

    // ---- 1. Resolve inbox ----------------------------------------------
    let (inbox_oid, tenant_oid) = resolve_inbox(&state.mongo, &body.ig_user_id).await?;

    // ---- 2. Idempotency probe — keyed on commentId ---------------------
    if let Some(hit) = find_existing_message(&state.mongo, tenant_oid, &body.comment_id).await? {
        return Ok(Json(hit));
    }

    // ---- 3. Resolve contact --------------------------------------------
    let contact_oid = resolve_contact(
        &state.mongo,
        tenant_oid,
        &body.sender_id,
        body.sender_username.as_deref(),
    )
    .await?;

    // ---- 4. Resolve conversation ---------------------------------------
    let now = body.timestamp.unwrap_or_else(Utc::now);
    let conversation_oid =
        resolve_conversation(&state.mongo, tenant_oid, inbox_oid, contact_oid, now).await?;

    // ---- 5. Build Card content + insert message ------------------------
    let content = ContentBlock::Card {
        title: body.text.clone(),
        subtitle: Some(format!("Instagram comment on post {}", body.post_id)),
        image_url: None,
        buttons: Vec::new(),
    };
    let preview = preview_for(&content);

    let mut provider_meta = serde_json::Map::new();
    provider_meta.insert(
        "channel".to_owned(),
        serde_json::Value::String(PROVIDER.to_owned()),
    );
    provider_meta.insert(
        "kind".to_owned(),
        serde_json::Value::String("comment".to_owned()),
    );
    provider_meta.insert(
        "postId".to_owned(),
        serde_json::Value::String(body.post_id.clone()),
    );
    provider_meta.insert(
        "commentId".to_owned(),
        serde_json::Value::String(body.comment_id.clone()),
    );
    if let Some(u) = body.sender_username.as_deref() {
        provider_meta.insert(
            "senderUsername".to_owned(),
            serde_json::Value::String(u.to_owned()),
        );
    }

    let message_oid = insert_message(
        &state.mongo,
        InsertMessage {
            tenant_oid,
            conversation_oid,
            inbox_oid,
            contact_oid,
            content: &content,
            attachments: Vec::new(),
            idempotency_key: &body.comment_id,
            provider_meta_extra: serde_json::Value::Object(provider_meta),
            at: now,
        },
    )
    .await?;

    // ---- 6. Roll up conversation ---------------------------------------
    rollup_conversation(&state.mongo, tenant_oid, conversation_oid, &preview, now).await?;

    // ---- 7. Audit ------------------------------------------------------
    write_audit(
        &state.mongo,
        tenant_oid,
        conversation_oid,
        contact_oid,
        inbox_oid,
        "message_sent",
    )
    .await;

    Ok(Json(IngestResponse {
        conversation_id: conversation_oid.to_hex(),
        message_id: message_oid.to_hex(),
    }))
}

// ===========================================================================
// Step helpers
// ===========================================================================

/// Look up the SabChat inbox that owns this Instagram business account.
/// The match is `channelType == "instagram"` AND
/// `channelConfig.settings.igUserId == ig_user_id`. We accept either the
/// camelCase `igUserId` or snake_case `ig_user_id` key in `settings` to
/// stay forgiving of how the inbox was provisioned. Returns
/// `(inboxId, tenantId)`.
async fn resolve_inbox(mongo: &MongoHandle, ig_user_id: &str) -> Result<(ObjectId, ObjectId)> {
    let coll = mongo.collection::<Document>(INBOXES_COLL);
    let filter = doc! {
        "channelType": PROVIDER,
        "$or": [
            { "channelConfig.settings.igUserId": ig_user_id },
            { "channelConfig.settings.ig_user_id": ig_user_id },
        ],
    };
    let inbox = coll
        .find_one(filter)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabchat_inboxes.find_one")))?
        .ok_or_else(|| {
            ApiError::NotFound(format!(
                "No SabChat inbox configured for Instagram user id {ig_user_id}."
            ))
        })?;

    let inbox_oid = inbox
        .get_object_id("_id")
        .map_err(|_| ApiError::Internal(anyhow::anyhow!("inbox missing _id")))?;
    let tenant_oid = inbox
        .get_object_id("tenantId")
        .map_err(|_| ApiError::Internal(anyhow::anyhow!("inbox missing tenantId")))?;

    Ok((inbox_oid, tenant_oid))
}

/// Idempotency probe — look up an existing message keyed by
/// `(tenantId, providerMetadata.idempotencyKey)`. The key is the IG-side
/// `providerMessageId` (DMs) or `commentId` (comments).
async fn find_existing_message(
    mongo: &MongoHandle,
    tenant_oid: ObjectId,
    key: &str,
) -> Result<Option<IngestResponse>> {
    let coll = mongo.collection::<Document>(MESSAGES_COLL);
    let hit = coll
        .find_one(doc! {
            "tenantId": tenant_oid,
            "providerMetadata.idempotencyKey": key,
        })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabchat_messages.find_one(idem)"))
        })?;
    let Some(d) = hit else {
        return Ok(None);
    };
    let message_oid = d
        .get_object_id("_id")
        .map_err(|_| ApiError::Internal(anyhow::anyhow!("message missing _id")))?;
    let conversation_oid = d
        .get_object_id("conversationId")
        .map_err(|_| ApiError::Internal(anyhow::anyhow!("message missing conversationId")))?;
    Ok(Some(IngestResponse {
        conversation_id: conversation_oid.to_hex(),
        message_id: message_oid.to_hex(),
    }))
}

/// Resolve (or create) the SabChat contact for this Instagram sender.
///
/// Match shape: `{ tenantId, socialIds: { $elemMatch: { provider:
/// "instagram", externalId: sender_id } } }`.
///
/// On insert we seed `name` from `sender_username` (if any) and stamp
/// the standard empty arrays / `attrs` map / timestamps so the doc
/// satisfies the `SabChatContact` deserializer if any downstream reads
/// happen.
async fn resolve_contact(
    mongo: &MongoHandle,
    tenant_oid: ObjectId,
    sender_id: &str,
    sender_username: Option<&str>,
) -> Result<ObjectId> {
    let coll = mongo.collection::<Document>(CONTACTS_COLL);
    let hit = coll
        .find_one(doc! {
            "tenantId": tenant_oid,
            "socialIds": {
                "$elemMatch": {
                    "provider": PROVIDER,
                    "externalId": sender_id,
                },
            },
        })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabchat_contacts.find_one"))
        })?;

    if let Some(d) = hit {
        return d
            .get_object_id("_id")
            .map_err(|_| ApiError::Internal(anyhow::anyhow!("contact missing _id")));
    }

    // ---- Insert ---------------------------------------------------------
    let new_oid = ObjectId::new();
    let now = bson::DateTime::from_chrono(Utc::now());

    let mut social = doc! {
        "provider": PROVIDER,
        "externalId": sender_id,
    };
    if let Some(handle) = sender_username.filter(|s| !s.is_empty()) {
        social.insert("handle", handle);
    }

    let mut new_doc = doc! {
        "_id": new_oid,
        "tenantId": tenant_oid,
        "emails": Vec::<String>::new(),
        "phones": Vec::<String>::new(),
        "socialIds": Bson::Array(vec![Bson::Document(social)]),
        "tags": Vec::<String>::new(),
        "attrs": Bson::Document(Document::new()),
        "createdAt": now,
        "updatedAt": now,
    };
    if let Some(name) = sender_username.filter(|s| !s.is_empty()) {
        new_doc.insert("name", name);
    }

    coll.insert_one(new_doc).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabchat_contacts.insert_one"))
    })?;

    // Best-effort audit: contact_created.
    write_contact_created_audit(mongo, tenant_oid, new_oid).await;

    Ok(new_oid)
}

/// Resolve (or create) the active conversation for this
/// `(tenant, inbox, contact)` triple. Reuses the newest `open` or
/// `pending` conversation; otherwise creates a fresh `open / medium`
/// row.
async fn resolve_conversation(
    mongo: &MongoHandle,
    tenant_oid: ObjectId,
    inbox_oid: ObjectId,
    contact_oid: ObjectId,
    now: DateTime<Utc>,
) -> Result<ObjectId> {
    use mongodb::options::FindOneOptions;

    let coll = mongo.collection::<Document>(CONVERSATIONS_COLL);

    // Prefer the newest non-resolved conversation; fall back to creating
    // a new one.
    let opts = FindOneOptions::builder().sort(doc! { "_id": -1 }).build();
    let existing = coll
        .find_one(doc! {
            "tenantId": tenant_oid,
            "inboxId": inbox_oid,
            "contactId": contact_oid,
            "status": { "$in": ["open", "pending", "snoozed"] },
        })
        .with_options(opts)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabchat_conversations.find_one"))
        })?;

    if let Some(d) = existing {
        return d
            .get_object_id("_id")
            .map_err(|_| ApiError::Internal(anyhow::anyhow!("conversation missing _id")));
    }

    // ---- Insert ---------------------------------------------------------
    let new_oid = ObjectId::new();
    let now_bson = bson::DateTime::from_chrono(now);

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

    coll.insert_one(&new_doc).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabchat_conversations.insert_one"))
    })?;

    // Best-effort audit: conversation_created.
    write_audit(
        mongo,
        tenant_oid,
        new_oid,
        contact_oid,
        inbox_oid,
        "conversation_created",
    )
    .await;

    Ok(new_oid)
}

/// All the inputs `insert_message` needs. A struct so the parameter list
/// at the call site stays readable.
struct InsertMessage<'a> {
    tenant_oid: ObjectId,
    conversation_oid: ObjectId,
    inbox_oid: ObjectId,
    contact_oid: ObjectId,
    content: &'a ContentBlock,
    attachments: Vec<sabchat_types::Attachment>,
    /// Wire idempotency key — stored at
    /// `providerMetadata.idempotencyKey`.
    idempotency_key: &'a str,
    /// Free-form extra JSON merged into `providerMetadata` (raw IG ids,
    /// channel discriminator, etc.). Must be an Object.
    provider_meta_extra: serde_json::Value,
    at: DateTime<Utc>,
}

/// Persist one `sabchat_messages` doc representing the inbound visitor
/// event. Returns the new message's `_id`.
async fn insert_message<'a>(mongo: &MongoHandle, args: InsertMessage<'a>) -> Result<ObjectId> {
    let new_oid = ObjectId::new();
    let at_bson = bson::DateTime::from_chrono(args.at);

    // Build providerMetadata = { idempotencyKey, ...extra }.
    let mut meta_map = match args.provider_meta_extra {
        serde_json::Value::Object(m) => m,
        _ => serde_json::Map::new(),
    };
    meta_map.insert(
        "idempotencyKey".to_owned(),
        serde_json::Value::String(args.idempotency_key.to_owned()),
    );
    let provider_meta_bson =
        Bson::try_from(serde_json::Value::Object(meta_map)).unwrap_or(Bson::Null);

    let attachments_bson = Bson::Array(
        args.attachments
            .iter()
            .map(|a| {
                Bson::try_from(serde_json::to_value(a).unwrap_or(serde_json::Value::Null))
                    .unwrap_or(Bson::Null)
            })
            .collect(),
    );

    let new_doc = doc! {
        "_id": new_oid,
        "tenantId": args.tenant_oid,
        "conversationId": args.conversation_oid,
        "inboxId": args.inbox_oid,
        "contactId": args.contact_oid,
        "senderType": "visitor",
        "senderId": args.contact_oid,
        "direction": "inbound",
        "content": content_to_bson(args.content),
        "attachments": attachments_bson,
        "providerMetadata": provider_meta_bson,
        "private": false,
        "createdAt": at_bson,
    };

    let coll = mongo.collection::<Document>(MESSAGES_COLL);
    coll.insert_one(new_doc).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabchat_messages.insert_one"))
    })?;

    Ok(new_oid)
}

/// `$set lastMessageAt / lastMessagePreview / updatedAt`,
/// `$inc unreadCount` on the parent conversation. Inbound messages
/// always bump `unreadCount` so the agent inbox surfaces them.
async fn rollup_conversation(
    mongo: &MongoHandle,
    tenant_oid: ObjectId,
    conversation_oid: ObjectId,
    preview: &str,
    now: DateTime<Utc>,
) -> Result<()> {
    let now_bson = bson::DateTime::from_chrono(now);
    let update = doc! {
        "$set": {
            "lastMessageAt": now_bson,
            "lastMessagePreview": preview,
            "updatedAt": now_bson,
        },
        "$inc": { "unreadCount": 1_i64 },
    };

    let coll = mongo.collection::<Document>(CONVERSATIONS_COLL);
    coll.update_one(
        doc! { "_id": conversation_oid, "tenantId": tenant_oid },
        update,
    )
    .await
    .map_err(|e| {
        ApiError::Internal(
            anyhow::Error::new(e).context("sabchat_conversations.update_one(rollup)"),
        )
    })?;
    Ok(())
}

/// Best-effort audit row. Failures are logged and dropped — the primary
/// write is already committed by the time we get here.
async fn write_audit(
    mongo: &MongoHandle,
    tenant_oid: ObjectId,
    conversation_oid: ObjectId,
    contact_oid: ObjectId,
    inbox_oid: ObjectId,
    action: &str,
) {
    let now = bson::DateTime::from_chrono(Utc::now());
    let d = doc! {
        "_id": ObjectId::new(),
        "tenantId": tenant_oid,
        "conversationId": conversation_oid,
        "contactId": contact_oid,
        "inboxId": inbox_oid,
        "action": action,
        "actorType": "visitor",
        "createdAt": now,
    };
    if let Err(err) = mongo.collection::<Document>(AUDIT_COLL).insert_one(d).await {
        tracing::warn!(
            audit.action = action,
            error.detail = %err,
            "failed to write sabchat audit event",
        );
    }
}

/// Variant of `write_audit` for the contact-level `contact_created`
/// event (no conversation/inbox in scope).
async fn write_contact_created_audit(
    mongo: &MongoHandle,
    tenant_oid: ObjectId,
    contact_oid: ObjectId,
) {
    let now = bson::DateTime::from_chrono(Utc::now());
    let d = doc! {
        "_id": ObjectId::new(),
        "tenantId": tenant_oid,
        "contactId": contact_oid,
        "action": "contact_created",
        "actorType": "visitor",
        "createdAt": now,
    };
    if let Err(err) = mongo.collection::<Document>(AUDIT_COLL).insert_one(d).await {
        tracing::warn!(
            audit.action = "contact_created",
            error.detail = %err,
            "failed to write sabchat audit event",
        );
    }
}

// ===========================================================================
// Content builders
// ===========================================================================

/// Build the `ContentBlock` for a DM. Prefers a text block when text is
/// present; otherwise falls back to `Image` / `File` based on MIME.
fn build_dm_content(body: &IngestDmBody) -> ContentBlock {
    let text = body
        .text
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(str::to_owned);
    let url = body
        .attachment_url
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(str::to_owned);

    match (text, url) {
        (Some(t), _) => ContentBlock::Text { text: t },
        (None, Some(u)) => {
            let mime = body.attachment_mime.as_deref().unwrap_or("");
            if mime.starts_with("image/") {
                ContentBlock::Image { url: u, alt: None }
            } else {
                ContentBlock::File {
                    attachment: sabchat_types::Attachment {
                        sabfile_id: String::new(),
                        url: u,
                        name: file_name_from_url(body.attachment_url.as_deref().unwrap_or("")),
                        mime: body.attachment_mime.clone(),
                        size: None,
                    },
                }
            }
        }
        // Validation above guarantees we never hit this branch.
        (None, None) => ContentBlock::System {
            text: "(empty Instagram DM)".to_owned(),
        },
    }
}

/// Lift the DM attachment out into the messages `attachments` array so
/// indexers can find it without parsing `content`. Empty when no
/// attachment was supplied.
fn build_attachments_from_dm(body: &IngestDmBody) -> Vec<sabchat_types::Attachment> {
    let Some(url) = body
        .attachment_url
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
    else {
        return Vec::new();
    };
    vec![sabchat_types::Attachment {
        sabfile_id: String::new(),
        url: url.to_owned(),
        name: file_name_from_url(url),
        mime: body.attachment_mime.clone(),
        size: None,
    }]
}

/// Build the `providerMetadata` payload for a DM (minus the idempotency
/// key, which is stamped by `insert_message`).
fn build_dm_provider_meta(body: &IngestDmBody) -> serde_json::Value {
    let mut m = serde_json::Map::new();
    m.insert(
        "channel".to_owned(),
        serde_json::Value::String(PROVIDER.to_owned()),
    );
    m.insert(
        "kind".to_owned(),
        serde_json::Value::String("dm".to_owned()),
    );
    m.insert(
        "providerMessageId".to_owned(),
        serde_json::Value::String(body.provider_message_id.clone()),
    );
    m.insert(
        "igUserId".to_owned(),
        serde_json::Value::String(body.ig_user_id.clone()),
    );
    m.insert(
        "senderId".to_owned(),
        serde_json::Value::String(body.sender_id.clone()),
    );
    if let Some(u) = body.sender_username.as_deref() {
        m.insert(
            "senderUsername".to_owned(),
            serde_json::Value::String(u.to_owned()),
        );
    }
    serde_json::Value::Object(m)
}

/// Short inbox-row preview for the rolled-up conversation.
fn preview_for(content: &ContentBlock) -> String {
    const MAX: usize = 140;
    let raw = match content {
        ContentBlock::Text { text } => text.clone(),
        ContentBlock::Image { .. } => "[image]".to_owned(),
        ContentBlock::File { attachment } => format!("[file] {}", attachment.name),
        ContentBlock::Voice { .. } => "[voice]".to_owned(),
        ContentBlock::Card { title, .. } => title.clone(),
        ContentBlock::Carousel { .. } => "[carousel]".to_owned(),
        ContentBlock::Form { .. } => "[form]".to_owned(),
        ContentBlock::Payment { .. } => "[payment]".to_owned(),
        ContentBlock::Location { .. } => "[location]".to_owned(),
        ContentBlock::System { text } => text.clone(),
    };
    if raw.chars().count() <= MAX {
        raw
    } else {
        let mut out: String = raw.chars().take(MAX.saturating_sub(1)).collect();
        out.push('…');
        out
    }
}

/// Best-effort filename from the last path segment of a URL. Falls back
/// to `"attachment"` when the URL has no usable segment.
fn file_name_from_url(url: &str) -> String {
    let trimmed = url.trim_end_matches('/');
    let after_query = trimmed.split('?').next().unwrap_or(trimmed);
    after_query
        .rsplit('/')
        .next()
        .filter(|s| !s.is_empty())
        .unwrap_or("attachment")
        .to_owned()
}

/// `ContentBlock` → `Bson` via the existing serde derive. The block enum
/// is fully serde-friendly so this always round-trips cleanly.
fn content_to_bson(content: &ContentBlock) -> Bson {
    let value = serde_json::to_value(content).unwrap_or(serde_json::Value::Null);
    Bson::try_from(value).unwrap_or(Bson::Null)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn preview_truncates_long_text() {
        let long: String = "x".repeat(500);
        let p = preview_for(&ContentBlock::Text { text: long });
        assert!(p.chars().count() <= 140);
        assert!(p.ends_with('…'));
    }

    #[test]
    fn preview_passes_through_short_text() {
        let p = preview_for(&ContentBlock::Text {
            text: "hello".to_owned(),
        });
        assert_eq!(p, "hello");
    }

    #[test]
    fn filename_from_url_strips_query() {
        assert_eq!(
            file_name_from_url("https://cdn.example.com/path/photo.jpg?sig=abc"),
            "photo.jpg"
        );
        assert_eq!(file_name_from_url(""), "attachment");
        assert_eq!(file_name_from_url("/"), "attachment");
    }

    #[test]
    fn dm_content_prefers_text_over_attachment() {
        let body = IngestDmBody {
            ig_user_id: "ig".into(),
            sender_id: "s".into(),
            sender_username: None,
            text: Some("hi".into()),
            attachment_url: Some("https://x/img.jpg".into()),
            attachment_mime: Some("image/jpeg".into()),
            provider_message_id: "mid".into(),
            timestamp: None,
        };
        match build_dm_content(&body) {
            ContentBlock::Text { text } => assert_eq!(text, "hi"),
            _ => panic!("expected Text block"),
        }
    }

    #[test]
    fn dm_content_falls_back_to_image_for_image_mime() {
        let body = IngestDmBody {
            ig_user_id: "ig".into(),
            sender_id: "s".into(),
            sender_username: None,
            text: None,
            attachment_url: Some("https://x/img.jpg".into()),
            attachment_mime: Some("image/jpeg".into()),
            provider_message_id: "mid".into(),
            timestamp: None,
        };
        match build_dm_content(&body) {
            ContentBlock::Image { url, .. } => assert_eq!(url, "https://x/img.jpg"),
            _ => panic!("expected Image block"),
        }
    }
}
