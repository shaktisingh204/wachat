//! HTTP handlers for the SabChat WhatsApp channel adapter.
//!
//! | Endpoint                                              | Purpose                          |
//! |-------------------------------------------------------|----------------------------------|
//! | `POST /v1/sabchat/channels/whatsapp/ingest`           | inbound message → SabChat graph  |
//! | `POST /v1/sabchat/channels/whatsapp/status`           | outbound delivery receipt        |
//!
//! ## Server-to-server
//!
//! These routes are called by the existing `wachat-webhook-inbound`
//! crate inside the same deployment — no `AuthUser` extractor, no JWT
//! check. Tenant scope is derived from the resolved inbox's
//! `tenant_id`, which is the authoritative tenancy boundary for every
//! row this handler touches.
//!
//! ## Flow (ingest)
//!
//! 1. **Resolve inbox** — find the `sabchat_inboxes` row with
//!    `channelType == "whatsapp_cloud"` AND
//!    `channelConfig.settings.phoneNumberId == event.phoneNumberId`.
//!    404 if missing — the webhook crate uses this to skip inbound
//!    events for numbers we don't own.
//! 2. **Idempotency check** — if a `sabchat_messages` row already
//!    exists with `providerMetadata.wamid == providerMessageId`,
//!    return its ids and `deduped: true`. Meta retries webhooks; this
//!    keeps the conversation log clean.
//! 3. **Resolve / create contact** — match on
//!    `socialIds.{provider: "whatsapp", externalId: waId}` scoped to
//!    the inbox's tenant; create a fresh `sabchat_contacts` row if
//!    missing, carrying the WhatsApp id as both a phone (digits-only)
//!    and a social identity.
//! 4. **Find / create conversation** — latest `Open` conversation on
//!    `(tenant, inbox, contact)`; otherwise create a fresh one.
//! 5. **Append message** — `senderType=Visitor`, `direction=Inbound`,
//!    `content` translated from the `IngestMessage`, attachments
//!    lifted out for fast indexing.
//! 6. **Update conversation** — bump `lastMessageAt`,
//!    `lastMessagePreview`, increment `unreadCount`, `$set updatedAt`.
//! 7. **Audit** — append a `message_sent` event to `sabchat_audit_log`
//!    via the in-process helper.
//!
//! ## Flow (status)
//!
//! Locate the `sabchat_messages` row by `providerMetadata.wamid` and
//! `$set providerMetadata.status` plus a per-status timestamp
//! (`statusAt`). Returns `updated: false` if no matching message is
//! found.

use axum::{Json, extract::State};
use bson::{Bson, Document, doc, oid::ObjectId, to_bson};
use chrono::{DateTime, Utc};
use mongodb::options::FindOneOptions;
use sabchat_types::{
    Attachment, ContentBlock, MessageDirection, SabChatAuditEvent, SabChatContact,
    SabChatConversation, SabChatMessage, SenderType, SocialIdentity,
};
use sabnode_common::{ApiError, Result};
use sabnode_db::mongo::MongoHandle;
use serde_json::Value;
use tracing::instrument;

use crate::dto::{IngestMessage, IngestReq, IngestResp, StatusReq, StatusResp};
use crate::state::SabChatChannelWhatsappState;
use crate::{
    AUDIT_COLL, CONTACTS_COLL, CONVERSATIONS_COLL, INBOXES_COLL, MESSAGES_COLL,
    WHATSAPP_CHANNEL_TYPE, WHATSAPP_PROVIDER,
};

// ===========================================================================
// Lookups
// ===========================================================================

/// Find the SabChat inbox that owns `phone_number_id` on the WhatsApp
/// Cloud channel. Returns `(inbox_oid, tenant_oid)` — both are
/// [`ObjectId`]s pulled directly off the stored document so the caller
/// never has to re-parse hex strings.
async fn resolve_inbox(mongo: &MongoHandle, phone_number_id: &str) -> Result<(ObjectId, ObjectId)> {
    let coll = mongo.collection::<Document>(INBOXES_COLL);
    // `channelConfig.settings.phoneNumberId` is the dotted path used
    // when SabChat stores a `whatsapp_cloud` inbox config — see
    // `sabchat_types::inbox::ChannelConfig`.
    let filter = doc! {
        "channelType": WHATSAPP_CHANNEL_TYPE,
        "channelConfig.settings.phoneNumberId": phone_number_id,
        "enabled": true,
    };
    let doc = coll
        .find_one(filter)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabchat_inboxes.find_one")))?
        .ok_or_else(|| {
            ApiError::NotFound(format!(
                "No SabChat inbox bound to phoneNumberId `{phone_number_id}`."
            ))
        })?;

    let inbox_oid = doc
        .get_object_id("_id")
        .map_err(|_| ApiError::Internal(anyhow::anyhow!("sabchat_inboxes row missing _id")))?;
    let tenant_oid = doc
        .get_object_id("tenantId")
        .map_err(|_| ApiError::Internal(anyhow::anyhow!("sabchat_inboxes row missing tenantId")))?;
    Ok((inbox_oid, tenant_oid))
}

/// Resolve a contact by its WhatsApp id, scoped to the inbox's tenant.
/// Creates a fresh `sabchat_contacts` row if none exists.
///
/// Identity match: `socialIds.{provider: "whatsapp", externalId: waId}`
/// (the canonical cross-channel key per [`SocialIdentity`]). We do not
/// match on `phones` alone because phone-only collision across tenants
/// is too noisy — the tenant filter + the social id triple is the
/// stable identity.
///
/// Returns `(contact_id, created)` so the caller can audit fresh
/// contact creates.
pub(crate) async fn resolve_contact_by_wa_id(
    mongo: &MongoHandle,
    tenant_id: ObjectId,
    wa_id: &str,
    display_name: Option<&str>,
) -> Result<(ObjectId, bool)> {
    let coll = mongo.collection::<Document>(CONTACTS_COLL);

    let filter = doc! {
        "tenantId": tenant_id,
        "socialIds": {
            "$elemMatch": {
                "provider": WHATSAPP_PROVIDER,
                "externalId": wa_id,
            }
        },
    };

    if let Some(existing) = coll.find_one(filter).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabchat_contacts.find_one"))
    })? {
        let oid = existing
            .get_object_id("_id")
            .map_err(|_| ApiError::Internal(anyhow::anyhow!("sabchat_contacts row missing _id")))?;
        // Opportunistic name update — only when we have a name and the
        // stored record is anonymous. Avoids stomping a name the agent
        // manually corrected.
        if let Some(name) = display_name.filter(|s| !s.is_empty()) {
            let stored_name = existing
                .get_str("name")
                .ok()
                .filter(|s| !s.is_empty())
                .is_some();
            if !stored_name {
                let now = bson::DateTime::from_chrono(Utc::now());
                coll.update_one(
                    doc! { "_id": oid },
                    doc! { "$set": { "name": name, "updatedAt": now } },
                )
                .await
                .map_err(|e| {
                    ApiError::Internal(
                        anyhow::Error::new(e).context("sabchat_contacts.update_one(name)"),
                    )
                })?;
            }
        }
        return Ok((oid, false));
    }

    // ---- Fresh insert ---------------------------------------------------
    let now = Utc::now();
    let new_oid = ObjectId::new();
    let new_contact = SabChatContact {
        id: new_oid,
        tenant_id,
        name: display_name.map(str::to_owned),
        avatar_url: None,
        emails: Vec::new(),
        phones: vec![wa_id.to_owned()],
        social_ids: vec![SocialIdentity {
            provider: WHATSAPP_PROVIDER.to_owned(),
            external_id: wa_id.to_owned(),
            handle: None,
        }],
        attrs: Value::Null,
        tags: Vec::new(),
        last_seen_at: Some(now),
        crm_contact_id: None,
        created_at: now,
        updated_at: now,
    };
    let doc = to_document(&new_contact, "SabChatContact")?;
    coll.insert_one(doc).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabchat_contacts.insert_one"))
    })?;

    Ok((new_oid, true))
}

/// Find the latest `Open` conversation for `(tenant, inbox, contact)`,
/// or create a fresh one. Returns the conversation id.
///
/// "Latest" is `updatedAt DESC` — Chatwoot does the same so a quick
/// reply within minutes of a resolution still lands on the existing
/// thread. Once a conversation flips to `Resolved` / `Snoozed`, fresh
/// inbound traffic starts a new conversation.
pub(crate) async fn find_or_create_open_conversation(
    mongo: &MongoHandle,
    tenant_id: ObjectId,
    inbox_id: ObjectId,
    contact_id: ObjectId,
) -> Result<(ObjectId, bool)> {
    let coll = mongo.collection::<Document>(CONVERSATIONS_COLL);

    let filter = doc! {
        "tenantId": tenant_id,
        "inboxId": inbox_id,
        "contactId": contact_id,
        "status": "open",
    };
    let opts = FindOneOptions::builder()
        .sort(doc! { "updatedAt": -1 })
        .build();

    if let Some(existing) = coll
        .find_one(filter)
        .with_options(opts)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabchat_conversations.find_one"))
        })?
    {
        let oid = existing.get_object_id("_id").map_err(|_| {
            ApiError::Internal(anyhow::anyhow!("sabchat_conversations row missing _id"))
        })?;
        return Ok((oid, false));
    }

    // ---- Fresh insert ---------------------------------------------------
    let now = Utc::now();
    let new_oid = ObjectId::new();
    let new_convo = SabChatConversation {
        id: new_oid,
        tenant_id,
        inbox_id,
        contact_id,
        status: sabchat_types::ConversationStatus::Open,
        priority: sabchat_types::ConversationPriority::Medium,
        assignee_id: None,
        team_id: None,
        labels: Vec::new(),
        snooze_until: None,
        sla: sabchat_types::SlaPolicy::default(),
        last_message_at: None,
        last_message_preview: None,
        unread_count: 0,
        custom_attrs: Value::Null,
        first_response_at: None,
        resolved_at: None,
        created_at: now,
        updated_at: now,
    };
    let doc = to_document(&new_convo, "SabChatConversation")?;
    coll.insert_one(doc).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabchat_conversations.insert_one"))
    })?;

    Ok((new_oid, true))
}

// ===========================================================================
// POST /ingest
// ===========================================================================

/// `POST /v1/sabchat/channels/whatsapp/ingest` — translate one inbound
/// WhatsApp Cloud message into a SabChat conversation + message row.
#[instrument(
    skip_all,
    fields(
        phone_number_id = %body.phone_number_id,
        wa_id = %body.wa_id,
        wamid = %body.provider_message_id,
        kind = %body.message.kind,
    ),
)]
pub async fn ingest(
    State(state): State<SabChatChannelWhatsappState>,
    Json(body): Json<IngestReq>,
) -> Result<Json<IngestResp>> {
    // ---- Input validation ----------------------------------------------
    if body.phone_number_id.trim().is_empty() {
        return Err(ApiError::Validation(
            "phoneNumberId is required.".to_owned(),
        ));
    }
    if body.wa_id.trim().is_empty() {
        return Err(ApiError::Validation("waId is required.".to_owned()));
    }
    if body.provider_message_id.trim().is_empty() {
        return Err(ApiError::Validation(
            "providerMessageId is required.".to_owned(),
        ));
    }

    let mongo = &state.mongo;

    // ---- 1. Resolve inbox + tenant -------------------------------------
    let (inbox_id, tenant_id) = resolve_inbox(mongo, &body.phone_number_id).await?;

    // ---- 2. Idempotency check ------------------------------------------
    //
    // Meta retries webhooks aggressively; the canonical dedupe key is
    // the `wamid` stashed in `providerMetadata`. If the message is
    // already on file we return its ids and skip every downstream
    // write.
    let messages = mongo.collection::<Document>(MESSAGES_COLL);
    if let Some(existing) = messages
        .find_one(doc! {
            "tenantId": tenant_id,
            "providerMetadata.wamid": &body.provider_message_id,
        })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabchat_messages.find_one(wamid)"))
        })?
    {
        let msg_oid = existing
            .get_object_id("_id")
            .map_err(|_| ApiError::Internal(anyhow::anyhow!("sabchat_messages row missing _id")))?;
        let convo_oid = existing.get_object_id("conversationId").map_err(|_| {
            ApiError::Internal(anyhow::anyhow!(
                "sabchat_messages row missing conversationId"
            ))
        })?;
        return Ok(Json(IngestResp {
            conversation_id: convo_oid.to_hex(),
            message_id: msg_oid.to_hex(),
            deduped: true,
        }));
    }

    // ---- 3. Resolve / create contact -----------------------------------
    let (contact_id, contact_created) =
        resolve_contact_by_wa_id(mongo, tenant_id, &body.wa_id, body.name.as_deref()).await?;

    // ---- 4. Find / create conversation ---------------------------------
    let (conversation_id, conversation_created) =
        find_or_create_open_conversation(mongo, tenant_id, inbox_id, contact_id).await?;

    // ---- 5. Build + insert the message ---------------------------------
    let timestamp = parse_optional_rfc3339(&body.timestamp).unwrap_or_else(Utc::now);
    let (content, attachments) = translate_content(&body.message);
    let preview = preview_for(&content);

    let message_oid = ObjectId::new();
    let provider_metadata = serde_json::json!({
        "wamid": body.provider_message_id,
        "phoneNumberId": body.phone_number_id,
        "waId": body.wa_id,
    });

    let message = SabChatMessage {
        id: message_oid,
        tenant_id,
        conversation_id,
        inbox_id,
        contact_id,
        sender_type: SenderType::Visitor,
        // For visitor-sent messages the contact id IS the sender id —
        // the agent inbox uses this to attribute messages back to the
        // contact card without an extra join.
        sender_id: Some(contact_id),
        direction: MessageDirection::Inbound,
        content,
        attachments,
        provider_metadata,
        private: false,
        created_at: timestamp,
    };
    let msg_doc = to_document(&message, "SabChatMessage")?;
    messages.insert_one(msg_doc).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabchat_messages.insert_one"))
    })?;

    // ---- 6. Bump conversation rollups ----------------------------------
    let conversations = mongo.collection::<Document>(CONVERSATIONS_COLL);
    let now_bson = bson::DateTime::from_chrono(Utc::now());
    let last_at_bson = bson::DateTime::from_chrono(timestamp);
    let convo_update = doc! {
        "$set": {
            "lastMessageAt": last_at_bson,
            "lastMessagePreview": &preview,
            "updatedAt": now_bson,
        },
        "$inc": {
            "unreadCount": 1_i32,
        },
    };
    conversations
        .update_one(doc! { "_id": conversation_id }, convo_update)
        .await
        .map_err(|e| {
            ApiError::Internal(
                anyhow::Error::new(e).context("sabchat_conversations.update_one(rollup)"),
            )
        })?;

    // ---- 7. Audit -------------------------------------------------------
    //
    // Three audit events at most: contact_created (if fresh),
    // conversation_created (if fresh), message_sent (always). We write
    // each as a best-effort append — errors propagate so the webhook
    // crate can retry the whole call, which is safe because step 2 will
    // dedupe on the second try.
    if contact_created {
        record_event(
            mongo,
            SabChatAuditEvent {
                id: ObjectId::new(),
                tenant_id,
                conversation_id: Some(conversation_id),
                contact_id: Some(contact_id),
                inbox_id: Some(inbox_id),
                action: sabchat_types::AuditAction::ContactCreated,
                actor_type: "visitor".to_owned(),
                actor_id: None,
                before: Value::Null,
                after: serde_json::json!({
                    "waId": body.wa_id,
                    "name": body.name,
                }),
                created_at: timestamp,
            },
        )
        .await?;
    }
    if conversation_created {
        record_event(
            mongo,
            SabChatAuditEvent {
                id: ObjectId::new(),
                tenant_id,
                conversation_id: Some(conversation_id),
                contact_id: Some(contact_id),
                inbox_id: Some(inbox_id),
                action: sabchat_types::AuditAction::ConversationCreated,
                actor_type: "visitor".to_owned(),
                actor_id: None,
                before: Value::Null,
                after: serde_json::json!({ "status": "open" }),
                created_at: timestamp,
            },
        )
        .await?;
    }
    record_event(
        mongo,
        SabChatAuditEvent {
            id: ObjectId::new(),
            tenant_id,
            conversation_id: Some(conversation_id),
            contact_id: Some(contact_id),
            inbox_id: Some(inbox_id),
            action: sabchat_types::AuditAction::MessageSent,
            actor_type: "visitor".to_owned(),
            actor_id: Some(contact_id),
            before: Value::Null,
            after: serde_json::json!({
                "messageId": message_oid.to_hex(),
                "wamid": body.provider_message_id,
                "kind": body.message.kind,
            }),
            created_at: timestamp,
        },
    )
    .await?;

    Ok(Json(IngestResp {
        conversation_id: conversation_id.to_hex(),
        message_id: message_oid.to_hex(),
        deduped: false,
    }))
}

// ===========================================================================
// POST /status
// ===========================================================================

/// `POST /v1/sabchat/channels/whatsapp/status` — apply a delivery
/// receipt to a previously ingested outbound message.
///
/// Looks up by `providerMetadata.wamid` and `$set`s
/// `providerMetadata.status` plus `providerMetadata.statusAt`. If
/// nothing matches we return `updated: false` rather than 404 — Meta
/// occasionally emits receipts for messages sent before SabChat owned
/// the number, and surfacing those as errors would be noisy.
#[instrument(
    skip_all,
    fields(wamid = %body.provider_message_id, status = %body.status),
)]
pub async fn status(
    State(state): State<SabChatChannelWhatsappState>,
    Json(body): Json<StatusReq>,
) -> Result<Json<StatusResp>> {
    if body.provider_message_id.trim().is_empty() {
        return Err(ApiError::Validation(
            "providerMessageId is required.".to_owned(),
        ));
    }
    let status = body.status.trim();
    if !matches!(status, "sent" | "delivered" | "read" | "failed") {
        return Err(ApiError::Validation(format!(
            "Unknown status `{status}` (expected sent|delivered|read|failed)."
        )));
    }

    let timestamp = parse_optional_rfc3339(&body.timestamp).unwrap_or_else(Utc::now);
    let status_at_bson = bson::DateTime::from_chrono(timestamp);

    let messages = state.mongo.collection::<Document>(MESSAGES_COLL);
    let res = messages
        .update_one(
            doc! { "providerMetadata.wamid": &body.provider_message_id },
            doc! {
                "$set": {
                    "providerMetadata.status": status,
                    "providerMetadata.statusAt": status_at_bson,
                },
            },
        )
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabchat_messages.update_one(status)"))
        })?;

    Ok(Json(StatusResp {
        updated: res.matched_count > 0,
    }))
}

// ===========================================================================
// Helpers
// ===========================================================================

/// Translate the flat `IngestMessage` shape the webhook crate forwards
/// into a typed [`ContentBlock`] plus a flat attachment list. The
/// content block goes into `SabChatMessage.content`; the attachment
/// list lives alongside for cheap indexing on media queries.
fn translate_content(msg: &IngestMessage) -> (ContentBlock, Vec<Attachment>) {
    let kind = msg.kind.as_str();

    // Media block builder shared by image / video / audio / voice /
    // document / sticker. Lifts the attachment out for the message-
    // level array regardless of which ContentBlock we settle on.
    let attachment = if let Some(url) = msg.media_url.as_deref().filter(|s| !s.is_empty()) {
        Some(Attachment {
            sabfile_id: msg.sabfile_id.clone().unwrap_or_default(),
            url: url.to_owned(),
            name: msg
                .media_name
                .clone()
                .unwrap_or_else(|| default_name_for_kind(kind)),
            mime: msg.media_mime.clone(),
            size: msg.media_size,
        })
    } else {
        None
    };

    match kind {
        "text" => (
            ContentBlock::Text {
                text: msg.text.clone().unwrap_or_default(),
            },
            Vec::new(),
        ),
        "image" => {
            let block = ContentBlock::Image {
                url: msg.media_url.clone().unwrap_or_default(),
                alt: msg.text.clone(),
            };
            (block, attachment.into_iter().collect())
        }
        "voice" | "audio" => {
            let url = msg.media_url.clone().unwrap_or_default();
            let block = ContentBlock::Voice {
                url,
                duration_s: msg.duration_s.unwrap_or(0),
                transcript: msg.text.clone(),
            };
            (block, attachment.into_iter().collect())
        }
        "location" => {
            let block = ContentBlock::Location {
                lat: msg.lat.unwrap_or(0.0),
                lng: msg.lng.unwrap_or(0.0),
                label: msg.label.clone().or_else(|| msg.text.clone()),
            };
            (block, Vec::new())
        }
        "system" => (
            ContentBlock::System {
                text: msg.text.clone().unwrap_or_default(),
            },
            Vec::new(),
        ),
        // `video` / `document` / `sticker` / anything else with a media
        // url lands on `ContentBlock::File` so the inbox UI gets a
        // download tile. Unknown kinds without a media URL degrade to
        // a text representation so the agent still sees something.
        _ => match attachment {
            Some(att) => (
                ContentBlock::File {
                    attachment: att.clone(),
                },
                vec![att],
            ),
            None => (
                ContentBlock::Text {
                    text: msg
                        .text
                        .clone()
                        .unwrap_or_else(|| format!("[unsupported {kind} message]")),
                },
                Vec::new(),
            ),
        },
    }
}

/// Best-effort inbox-row preview string for a content block. Keeps
/// long bodies bounded so the inbox list query stays light.
fn preview_for(block: &ContentBlock) -> String {
    const MAX: usize = 140;
    let raw = match block {
        ContentBlock::Text { text } | ContentBlock::System { text } => text.clone(),
        ContentBlock::Image { alt, .. } => alt.clone().unwrap_or_else(|| "[image]".to_owned()),
        ContentBlock::Voice { transcript, .. } => transcript
            .clone()
            .unwrap_or_else(|| "[voice note]".to_owned()),
        ContentBlock::File { attachment } => format!("[file: {}]", attachment.name),
        ContentBlock::Location { label, .. } => {
            label.clone().unwrap_or_else(|| "[location]".to_owned())
        }
        ContentBlock::Card { title, .. } => title.clone(),
        ContentBlock::Carousel { .. } => "[carousel]".to_owned(),
        ContentBlock::Form { .. } => "[form]".to_owned(),
        ContentBlock::Payment { .. } => "[payment]".to_owned(),
    };
    if raw.chars().count() <= MAX {
        raw
    } else {
        raw.chars().take(MAX).collect::<String>() + "…"
    }
}

/// Default `Attachment.name` when Meta did not supply a filename.
fn default_name_for_kind(kind: &str) -> String {
    match kind {
        "image" => "image".to_owned(),
        "video" => "video".to_owned(),
        "audio" | "voice" => "audio".to_owned(),
        "document" => "document".to_owned(),
        "sticker" => "sticker".to_owned(),
        other => other.to_owned(),
    }
}

/// Parse an optional RFC 3339 timestamp string. Returns `None` for
/// missing / empty input AND for malformed input — the caller falls
/// back to wall-clock in that case. We swallow parse errors here
/// because the timestamp is metadata; a bad value should not abort an
/// otherwise healthy webhook delivery.
fn parse_optional_rfc3339(raw: &Option<String>) -> Option<DateTime<Utc>> {
    let s = raw.as_deref().filter(|s| !s.is_empty())?;
    DateTime::parse_from_rfc3339(s)
        .map(|dt| dt.with_timezone(&Utc))
        .ok()
}

/// Serialize any `Serialize` value to a BSON `Document`, mapping the
/// serde error into `ApiError::Internal`. Used for every fresh insert
/// so the `#[serde(rename_all = "camelCase")]` + datetime codecs on
/// the sabchat-types DTOs are honoured (matching what
/// `sabchat-audit::record` does).
fn to_document<T: serde::Serialize>(value: &T, name: &'static str) -> Result<Document> {
    let bson = to_bson(value).map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context(format!("serialize {name} to BSON")))
    })?;
    match bson {
        Bson::Document(d) => Ok(d),
        other => Err(ApiError::Internal(anyhow::anyhow!(
            "{name} serialized to non-document BSON: {other:?}"
        ))),
    }
}

/// Append one audit event to `sabchat_audit_log`. Mirrors what the
/// `sabchat-audit::record` helper does — we duplicate the body here
/// rather than take a path dep so this crate stays a true leaf (the
/// audit crate already takes deps on sibling adapters at higher layers
/// in the dep graph).
async fn record_event(mongo: &MongoHandle, event: SabChatAuditEvent) -> Result<()> {
    let doc = to_document(&event, "SabChatAuditEvent")?;
    mongo
        .collection::<Document>(AUDIT_COLL)
        .insert_one(doc)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabchat_audit_log.insert_one"))
        })?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn preview_caps_long_text() {
        let long = "x".repeat(500);
        let preview = preview_for(&ContentBlock::Text { text: long });
        assert!(preview.chars().count() <= 141);
        assert!(preview.ends_with('…'));
    }

    #[test]
    fn translate_text() {
        let msg = IngestMessage {
            kind: "text".to_owned(),
            text: Some("hello".to_owned()),
            media_url: None,
            media_mime: None,
            media_name: None,
            media_size: None,
            sabfile_id: None,
            lat: None,
            lng: None,
            label: None,
            duration_s: None,
        };
        let (block, atts) = translate_content(&msg);
        assert!(matches!(block, ContentBlock::Text { ref text } if text == "hello"));
        assert!(atts.is_empty());
    }

    #[test]
    fn translate_image_lifts_attachment() {
        let msg = IngestMessage {
            kind: "image".to_owned(),
            text: Some("a caption".to_owned()),
            media_url: Some("https://example.test/a.png".to_owned()),
            media_mime: Some("image/png".to_owned()),
            media_name: None,
            media_size: Some(123),
            sabfile_id: Some("sf_1".to_owned()),
            lat: None,
            lng: None,
            label: None,
            duration_s: None,
        };
        let (block, atts) = translate_content(&msg);
        assert!(matches!(block, ContentBlock::Image { .. }));
        assert_eq!(atts.len(), 1);
        assert_eq!(atts[0].sabfile_id, "sf_1");
        assert_eq!(atts[0].size, Some(123));
    }

    #[test]
    fn translate_document_uses_file_block() {
        let msg = IngestMessage {
            kind: "document".to_owned(),
            text: None,
            media_url: Some("https://example.test/x.pdf".to_owned()),
            media_mime: Some("application/pdf".to_owned()),
            media_name: Some("invoice.pdf".to_owned()),
            media_size: Some(4096),
            sabfile_id: Some("sf_2".to_owned()),
            lat: None,
            lng: None,
            label: None,
            duration_s: None,
        };
        let (block, atts) = translate_content(&msg);
        match block {
            ContentBlock::File { attachment } => {
                assert_eq!(attachment.name, "invoice.pdf");
            }
            other => panic!("expected File block, got {other:?}"),
        }
        assert_eq!(atts.len(), 1);
    }

    #[test]
    fn unknown_kind_without_media_falls_back_to_text() {
        let msg = IngestMessage {
            kind: "totally-new-kind".to_owned(),
            text: None,
            media_url: None,
            media_mime: None,
            media_name: None,
            media_size: None,
            sabfile_id: None,
            lat: None,
            lng: None,
            label: None,
            duration_s: None,
        };
        let (block, atts) = translate_content(&msg);
        assert!(matches!(block, ContentBlock::Text { .. }));
        assert!(atts.is_empty());
    }
}
