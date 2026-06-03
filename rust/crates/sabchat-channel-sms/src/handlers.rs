//! HTTP handlers for the SabChat SMS channel adapter.
//!
//! These endpoints are **unauthenticated** in the JWT sense — there is
//! no [`AuthUser`](sabnode_auth::AuthUser) extractor. Trust is derived
//! from the upstream shim crate (`sabsms-webhooks-inbound` and friends)
//! which verifies the provider's webhook signature *before* forwarding a
//! normalised JSON envelope to us. The adapter itself only knows how to
//! turn the normalised envelope into SabChat domain writes.
//!
//! ## Mongo collections touched
//!
//! | Collection                     | Read | Write |
//! |--------------------------------|:----:|:-----:|
//! | `sabchat_inboxes`              |  ✓   |       |
//! | `sabchat_contacts`             |  ✓   |   ✓   |
//! | `sabchat_conversations`        |  ✓   |   ✓   |
//! | `sabchat_messages`             |  ✓   |   ✓   |
//!
//! ## Idempotency
//!
//! Both endpoints use `providerMessageId` as the dedup key. `ingest`
//! short-circuits when a message with the same
//! `(providerMetadata.provider, providerMetadata.providerMessageId)`
//! pair already exists for the resolved inbox — replaying a webhook is
//! safe. `status` updates are also idempotent by definition since they
//! only `$set` a status string.

use axum::{Json, extract::State};
use bson::{Bson, Document, doc, oid::ObjectId};
use chrono::{DateTime, Utc};
use sabchat_types::ContentBlock;
use sabnode_common::{ApiError, Result};
use tracing::instrument;

use crate::dto::{IngestBody, IngestResponse, StatusBody, SuccessResponse};
use crate::state::SabChatChannelSmsState;

// ---------------------------------------------------------------------------
// Mongo collection names — kept inline so review against the schema doc
// is a single grep.
// ---------------------------------------------------------------------------
const INBOXES_COLL: &str = "sabchat_inboxes";
const CONTACTS_COLL: &str = "sabchat_contacts";
const CONVERSATIONS_COLL: &str = "sabchat_conversations";
const MESSAGES_COLL: &str = "sabchat_messages";

/// Stable channel discriminator we use to filter inboxes. Must match
/// [`sabchat_types::ChannelType::Sms`]'s `rename_all = "snake_case"` wire
/// value.
const CHANNEL_TYPE_SMS: &str = "sms";

// ===========================================================================
// POST /ingest — inbound SMS message
// ===========================================================================

/// `POST /ingest` — append an inbound visitor SMS to the right
/// SabChat conversation.
///
/// Flow:
/// 1. Resolve the inbox by `channelType == "sms"` AND
///    `channelConfig.settings.from_number == body.to`. The inbox row
///    carries the tenant scope. Disabled inboxes reject with 403.
/// 2. Dedup: if a message with the same `(provider, providerMessageId)`
///    already exists on this inbox, return the existing row and exit.
/// 3. Resolve or create the contact by normalised phone (digits only).
/// 4. Locate the most recent open/pending conversation on the (inbox,
///    contact) pair, or open a fresh `pending` one.
/// 5. Insert the message row (sender_type=Visitor, direction=Inbound).
/// 6. Update conversation roll-up: `last_message_at`, preview,
///    `unread_count += 1`, reopen if it was resolved.
#[instrument(skip_all, fields(to = %body.to, provider = %body.provider))]
pub async fn ingest(
    State(state): State<SabChatChannelSmsState>,
    Json(body): Json<IngestBody>,
) -> Result<Json<IngestResponse>> {
    // ---- Input validation ---------------------------------------------------
    if body.to.trim().is_empty() {
        return Err(ApiError::Validation("`to` is required.".to_owned()));
    }
    if body.from.trim().is_empty() {
        return Err(ApiError::Validation("`from` is required.".to_owned()));
    }
    if body.provider_message_id.trim().is_empty() {
        return Err(ApiError::Validation(
            "`providerMessageId` is required.".to_owned(),
        ));
    }
    if body.provider.trim().is_empty() {
        return Err(ApiError::Validation("`provider` is required.".to_owned()));
    }

    let mongo = &state.mongo;
    let now = parse_iso_or_now(body.timestamp.as_deref());
    let now_bson = bson::DateTime::from_chrono(now);

    // ---- 1. Resolve inbox ---------------------------------------------------
    //
    // The provider may send the business number in any of several
    // formats (`+15551234567`, `15551234567`, `whatsapp:+155…`, …). We
    // normalise both sides to digits-only so the match is robust to
    // formatting drift. The on-disk `from_number` is left in whatever
    // shape the inbox UI wrote it; we additionally try the raw match
    // first so an exact-string config wins fast.
    let inboxes = mongo.collection::<Document>(INBOXES_COLL);
    let to_digits = digits_only(&body.to);
    let inbox = inboxes
        .find_one(doc! {
            "channelType": CHANNEL_TYPE_SMS,
            "$or": [
                { "channelConfig.settings.from_number": &body.to },
                { "channelConfig.settings.from_number": &to_digits },
            ],
        })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabchat_inboxes.find_one")))?
        .ok_or_else(|| {
            ApiError::NotFound(format!("No SMS inbox is bound to the number {}.", body.to))
        })?;

    if !inbox.get_bool("enabled").unwrap_or(true) {
        return Err(ApiError::Forbidden("inbox is disabled".to_owned()));
    }

    let inbox_oid = inbox
        .get_object_id("_id")
        .map_err(|_| ApiError::Internal(anyhow::anyhow!("inbox missing _id")))?;
    let tenant_oid = inbox
        .get_object_id("tenantId")
        .map_err(|_| ApiError::Internal(anyhow::anyhow!("inbox missing tenantId")))?;

    // ---- 2. Idempotency check ----------------------------------------------
    //
    // Two providers could in theory hand us the same opaque string, so
    // we scope dedup by `(provider, providerMessageId)`. The lookup is
    // also constrained to this inbox so a provider replay against a
    // different number doesn't pollute the result.
    let messages = mongo.collection::<Document>(MESSAGES_COLL);
    if let Some(existing) = messages
        .find_one(doc! {
            "inboxId": inbox_oid,
            "providerMetadata.provider": &body.provider,
            "providerMetadata.providerMessageId": &body.provider_message_id,
        })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabchat_messages.find_one(dedup)"))
        })?
    {
        let message_id = existing
            .get_object_id("_id")
            .map_err(|_| ApiError::Internal(anyhow::anyhow!("message missing _id")))?;
        let conversation_id = existing
            .get_object_id("conversationId")
            .map_err(|_| ApiError::Internal(anyhow::anyhow!("message missing conversationId")))?;
        let contact_id = existing
            .get_object_id("contactId")
            .map_err(|_| ApiError::Internal(anyhow::anyhow!("message missing contactId")))?;
        return Ok(Json(IngestResponse {
            message_id: message_id.to_hex(),
            conversation_id: conversation_id.to_hex(),
            contact_id: contact_id.to_hex(),
            inbox_id: inbox_oid.to_hex(),
            deduplicated: true,
        }));
    }

    // ---- 3. Resolve-or-create contact --------------------------------------
    //
    // SMS only carries a phone identity. Normalise to digits-only
    // (E.164 without the leading `+`) so the same human merges across
    // providers / formatting.
    let from_digits = digits_only(&body.from);
    if from_digits.is_empty() {
        return Err(ApiError::Validation(
            "`from` did not contain any digits.".to_owned(),
        ));
    }

    let contacts = mongo.collection::<Document>(CONTACTS_COLL);
    let existing_contact = contacts
        .find_one(doc! {
            "tenantId": tenant_oid,
            "phones": &from_digits,
        })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabchat_contacts.find_one"))
        })?;

    let contact_oid = match existing_contact {
        Some(c) => c
            .get_object_id("_id")
            .map_err(|_| ApiError::Internal(anyhow::anyhow!("contact missing _id")))?,
        None => {
            let new_oid = ObjectId::new();
            let new_doc = doc! {
                "_id": new_oid,
                "tenantId": tenant_oid,
                "emails": Bson::Array(vec![]),
                "phones": Bson::Array(vec![Bson::String(from_digits.clone())]),
                "socialIds": Bson::Array(vec![]),
                "tags": Bson::Array(vec![]),
                "attrs": Bson::Document(Document::new()),
                "lastSeenAt": now_bson,
                "createdAt": now_bson,
                "updatedAt": now_bson,
            };
            contacts.insert_one(new_doc).await.map_err(|e| {
                ApiError::Internal(anyhow::Error::new(e).context("sabchat_contacts.insert_one"))
            })?;
            new_oid
        }
    };

    // ---- 4. Locate or open conversation ------------------------------------
    //
    // We prefer the most recent open/pending thread on this (inbox,
    // contact) pair so follow-up SMSes land in the same conversation.
    // If everything is resolved, we open a fresh `pending` one — the
    // visitor reopened the channel by texting again.
    let conversations = mongo.collection::<Document>(CONVERSATIONS_COLL);
    let existing_convo = conversations
        .find_one(doc! {
            "inboxId": inbox_oid,
            "contactId": contact_oid,
            "status": { "$in": ["open", "pending", "snoozed"] },
        })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabchat_conversations.find_one"))
        })?;

    let conversation_oid = match existing_convo {
        Some(c) => c
            .get_object_id("_id")
            .map_err(|_| ApiError::Internal(anyhow::anyhow!("conversation missing _id")))?,
        None => {
            let new_oid = ObjectId::new();
            let convo_doc = doc! {
                "_id": new_oid,
                "tenantId": tenant_oid,
                "inboxId": inbox_oid,
                "contactId": contact_oid,
                "status": "pending",
                "priority": "medium",
                "labels": Bson::Array(vec![]),
                "sla": Bson::Document(Document::new()),
                "unreadCount": 0i32,
                "customAttrs": Bson::Document(Document::new()),
                "createdAt": now_bson,
                "updatedAt": now_bson,
            };
            conversations.insert_one(convo_doc).await.map_err(|e| {
                ApiError::Internal(
                    anyhow::Error::new(e).context("sabchat_conversations.insert_one"),
                )
            })?;
            new_oid
        }
    };

    // ---- 5. Insert message row ---------------------------------------------
    //
    // SMS has no rich content — always a single text block. Provider
    // metadata carries the dedup keys + raw timestamp string for the
    // audit trail.
    let content = ContentBlock::Text {
        text: body.text.clone(),
    };
    let content_bson = bson::to_bson(&content)
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("serialize ContentBlock")))?;

    let mut provider_metadata = doc! {
        "provider": &body.provider,
        "providerMessageId": &body.provider_message_id,
    };
    if let Some(ts) = body.timestamp.as_deref() {
        provider_metadata.insert("providerTimestamp", ts);
    }

    let message_oid = ObjectId::new();
    let message_doc = doc! {
        "_id": message_oid,
        "tenantId": tenant_oid,
        "conversationId": conversation_oid,
        "inboxId": inbox_oid,
        "contactId": contact_oid,
        "senderType": "visitor",
        "senderId": contact_oid,
        "direction": "inbound",
        "content": content_bson,
        "attachments": Bson::Array(vec![]),
        "providerMetadata": Bson::Document(provider_metadata),
        "private": false,
        "createdAt": now_bson,
    };
    messages.insert_one(message_doc).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabchat_messages.insert_one"))
    })?;

    // ---- 6. Conversation roll-up -------------------------------------------
    //
    // A visitor SMS on a resolved thread should never be possible (we
    // selected only open/pending/snoozed above and otherwise opened a
    // fresh pending one), but we set `status: open` defensively so the
    // agent inbox surfaces the new activity.
    let preview = preview_for_text(&body.text);
    let convo_update = doc! {
        "$set": {
            "status": "open",
            "lastMessageAt": now_bson,
            "lastMessagePreview": &preview,
            "updatedAt": now_bson,
        },
        "$inc": { "unreadCount": 1i32 },
    };
    conversations
        .update_one(doc! { "_id": conversation_oid }, convo_update)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabchat_conversations.update_one"))
        })?;

    // Bump contact `lastSeenAt` so cross-channel presence stays fresh.
    contacts
        .update_one(
            doc! { "_id": contact_oid },
            doc! { "$set": { "lastSeenAt": now_bson, "updatedAt": now_bson } },
        )
        .await
        .map_err(|e| {
            ApiError::Internal(
                anyhow::Error::new(e).context("sabchat_contacts.update_one(lastSeen)"),
            )
        })?;

    Ok(Json(IngestResponse {
        message_id: message_oid.to_hex(),
        conversation_id: conversation_oid.to_hex(),
        contact_id: contact_oid.to_hex(),
        inbox_id: inbox_oid.to_hex(),
        deduplicated: false,
    }))
}

// ===========================================================================
// POST /status — provider delivery receipt
// ===========================================================================

/// `POST /status` — update `providerMetadata.status` on the matching
/// message.
///
/// The match is by `providerMetadata.providerMessageId`. We deliberately
/// do **not** scope by provider here — a status callback's id space is
/// the same as the ingest id space within the provider that sent it,
/// and the upstream shim has already verified the signature. Matching
/// on id alone keeps the path cheap; if a future provider collision
/// shows up the shim can pre-pend its discriminator to the id before
/// forwarding.
///
/// Returns `{ success: true }` even when zero messages matched — a late
/// status callback for a message we never ingested (e.g. the inbox row
/// was deleted between ingest and delivery) should not 5xx the
/// provider's retry loop.
#[instrument(skip_all, fields(provider_message_id = %body.provider_message_id, status = %body.status))]
pub async fn status(
    State(state): State<SabChatChannelSmsState>,
    Json(body): Json<StatusBody>,
) -> Result<Json<SuccessResponse>> {
    if body.provider_message_id.trim().is_empty() {
        return Err(ApiError::Validation(
            "`providerMessageId` is required.".to_owned(),
        ));
    }
    if body.status.trim().is_empty() {
        return Err(ApiError::Validation("`status` is required.".to_owned()));
    }

    let now = parse_iso_or_now(body.timestamp.as_deref());
    let now_bson = bson::DateTime::from_chrono(now);

    let mut set_doc = doc! {
        "providerMetadata.status": &body.status,
        "providerMetadata.statusAt": now_bson,
    };
    if let Some(ts) = body.timestamp.as_deref() {
        set_doc.insert("providerMetadata.statusTimestamp", ts);
    }

    let messages = state.mongo.collection::<Document>(MESSAGES_COLL);
    messages
        .update_many(
            doc! { "providerMetadata.providerMessageId": &body.provider_message_id },
            doc! { "$set": set_doc },
        )
        .await
        .map_err(|e| {
            ApiError::Internal(
                anyhow::Error::new(e).context("sabchat_messages.update_many(status)"),
            )
        })?;

    Ok(Json(SuccessResponse::ok()))
}

// ===========================================================================
// Helpers
// ===========================================================================

/// Strip every non-digit character from `s`. Mirrors the TS regex
/// `s.replace(/\D/g, '')`. Used to normalise both the inbox lookup key
/// (`channelConfig.settings.from_number`) and the visitor's phone for
/// the contact dedup index (`phones`).
fn digits_only(s: &str) -> String {
    s.chars().filter(|c| c.is_ascii_digit()).collect()
}

/// Compress + truncate an SMS body for the conversation inbox row
/// preview. Mirrors the widget crate's preview heuristics: collapse
/// runs of whitespace into a single space, then cap at 140 chars.
fn preview_for_text(text: &str) -> String {
    const MAX: usize = 140;
    let mut out = String::with_capacity(text.len().min(MAX));
    let mut prev_ws = false;
    for ch in text.chars() {
        if ch.is_whitespace() {
            if !prev_ws && !out.is_empty() {
                out.push(' ');
            }
            prev_ws = true;
        } else {
            out.push(ch);
            prev_ws = false;
        }
        if out.len() >= MAX {
            break;
        }
    }
    if out.len() > MAX {
        out.truncate(MAX);
    }
    out.trim_end().to_owned()
}

/// Parse an ISO-8601 timestamp string into UTC, falling back to wall-
/// clock `now` on absence or parse failure. SMS providers occasionally
/// emit slightly malformed timestamps — we never want to reject ingest
/// over a cosmetic header.
fn parse_iso_or_now(s: Option<&str>) -> DateTime<Utc> {
    s.and_then(|raw| DateTime::parse_from_rfc3339(raw).ok())
        .map(|dt| dt.with_timezone(&Utc))
        .unwrap_or_else(Utc::now)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn digits_only_strips_non_ascii_digits() {
        assert_eq!(digits_only("+1 (555) 123-4567"), "15551234567");
        assert_eq!(digits_only("whatsapp:+919876543210"), "919876543210");
        assert_eq!(digits_only(""), "");
        assert_eq!(digits_only("abc"), "");
    }

    #[test]
    fn preview_for_text_collapses_whitespace_and_truncates() {
        assert_eq!(preview_for_text("hello\n\nworld   !"), "hello world !");
        let long = "x".repeat(500);
        assert_eq!(preview_for_text(&long).len(), 140);
    }

    #[test]
    fn parse_iso_or_now_falls_back_on_bad_input() {
        // A well-formed timestamp round-trips.
        let parsed = parse_iso_or_now(Some("2024-01-02T03:04:05Z"));
        assert_eq!(parsed.to_rfc3339(), "2024-01-02T03:04:05+00:00");
        // Garbage falls back to "now" — we just assert it doesn't panic
        // and yields a recent value.
        let now = parse_iso_or_now(Some("not-a-date"));
        let delta = (Utc::now() - now).num_seconds().abs();
        assert!(delta < 5);
    }
}
