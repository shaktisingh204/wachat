//! HTTP handler for the SabChat email channel.
//!
//! One route — `POST /v1/sabchat/channels/email/ingest`. Steps:
//!
//! 1. **Resolve inbox**: find the `sabchat_inboxes` row whose
//!    `channelType == "email"` and whose
//!    `channelConfig.settings.address` (case-insensitive) equals the
//!    inbound `to` address. Pulls out `tenantId` for downstream tenancy.
//! 2. **Idempotency check**: look up `sabchat_messages` for a row
//!    whose `(tenantId, providerMetadata.messageId)` already matches
//!    the inbound `messageId`. If found, return its identifiers — no
//!    new writes.
//! 3. **Resolve contact**: find a `sabchat_contacts` row in the same
//!    tenant whose `emails` array contains the lowercased `from`
//!    address. Create a fresh row if none exists.
//! 4. **Find or create conversation**: walk the `In-Reply-To` /
//!    `References` chain via [`crate::threading::find_thread_conv_id`].
//!    On miss, open a new conversation rooted at this inbox + contact
//!    with the subject as its title.
//! 5. **Append message**: insert a single inbound visitor row with
//!    `ContentBlock::Text` carrying `subject + body`. Attachments (if
//!    any) are appended as separate `ContentBlock::File` rows so the
//!    agent inbox can render them inline. Updates the parent
//!    conversation's `lastMessageAt` + `lastMessagePreview` and bumps
//!    the agent-side `unreadCount`.
//!
//! No JWT — this is a server-to-server endpoint, tenant resolved via
//! the inbox lookup. See the module doc on [`crate::lib`] for the
//! trust model.

use axum::{Json, extract::State};
use bson::{Bson, Document, doc, oid::ObjectId};
use chrono::{DateTime, Utc};
use sabchat_types::content::Attachment;
use sabnode_common::{ApiError, Result};
use sabnode_db::mongo::MongoHandle;
use tracing::instrument;

use crate::dto::{IngestAttachment, IngestEmailBody, IngestEmailResponse};
use crate::state::SabChatChannelEmailState;
use crate::threading::find_thread_conv_id;

/// Mongo collections. Kept inline (not in a separate `consts` module)
/// so the join shape is easy to eyeball against the sibling crates.
const INBOXES_COLL: &str = "sabchat_inboxes";
const CONTACTS_COLL: &str = "sabchat_contacts";
const CONVERSATIONS_COLL: &str = "sabchat_conversations";
const MESSAGES_COLL: &str = "sabchat_messages";

/// Max preview length in `char`s — matches sabchat-messages' own
/// `PREVIEW_MAX_CHARS` so the inbox row truncation stays consistent
/// across channels.
const PREVIEW_MAX_CHARS: usize = 120;

// ===========================================================================
// POST /ingest
// ===========================================================================

/// `POST /v1/sabchat/channels/email/ingest` — one inbound email event.
///
/// See the module doc for the full step list. Errors:
///
/// | Condition                                       | Status |
/// |-------------------------------------------------|--------|
/// | `to` / `from` / `messageId` empty               | 422    |
/// | no inbox configured for the recipient address   | 404    |
/// | Mongo I/O failure                               | 500    |
#[instrument(skip_all, fields(to = %body.to, from = %body.from, message_id = %body.message_id))]
pub async fn ingest(
    State(state): State<SabChatChannelEmailState>,
    Json(body): Json<IngestEmailBody>,
) -> Result<Json<IngestEmailResponse>> {
    // ---- Input validation ----------------------------------------------
    if body.to.trim().is_empty()
        || body.from.trim().is_empty()
        || body.message_id.trim().is_empty()
    {
        return Err(ApiError::Validation(
            "to, from, and messageId are required".to_owned(),
        ));
    }

    let message_id = strip_angle_brackets(&body.message_id);
    if message_id.is_empty() {
        return Err(ApiError::Validation(
            "messageId is required and must be non-empty".to_owned(),
        ));
    }

    let to_addr = body.to.trim().to_ascii_lowercase();
    let from_addr = body.from.trim().to_ascii_lowercase();

    // ---- Step 1 — Resolve inbox ---------------------------------------
    let (inbox_oid, tenant_oid) = resolve_inbox(&state.mongo, &to_addr).await?;

    // ---- Step 2 — Idempotency check -----------------------------------
    //
    // A retried delivery (poller restart, webhook redelivery) carries
    // the same `Message-ID`. We treat any prior row inside this tenant
    // as the authoritative duplicate and short-circuit without writing.
    let messages = state.mongo.collection::<Document>(MESSAGES_COLL);
    if let Some(existing) = messages
        .find_one(doc! {
            "tenantId": tenant_oid,
            "providerMetadata.messageId": &message_id,
        })
        .await
        .map_err(|e| {
            ApiError::Internal(
                anyhow::Error::new(e).context("sabchat_messages.find_one(idempotency)"),
            )
        })?
    {
        let conv = existing
            .get_object_id("conversationId")
            .map_err(|_| ApiError::Internal(anyhow::anyhow!("message missing conversationId")))?;
        let contact = existing
            .get_object_id("contactId")
            .map_err(|_| ApiError::Internal(anyhow::anyhow!("message missing contactId")))?;
        let mid = existing
            .get_object_id("_id")
            .map_err(|_| ApiError::Internal(anyhow::anyhow!("message missing _id")))?;
        return Ok(Json(IngestEmailResponse {
            ok: true,
            idempotent: true,
            new_conversation: false,
            inbox_id: inbox_oid.to_hex(),
            contact_id: contact.to_hex(),
            conversation_id: conv.to_hex(),
            message_id: mid.to_hex(),
        }));
    }

    // ---- Step 3 — Resolve-or-create contact ---------------------------
    let contact_oid = resolve_or_create_contact(
        &state.mongo,
        tenant_oid,
        &from_addr,
        body.from_name.as_deref(),
    )
    .await?;

    // ---- Step 4 — Find or create conversation -------------------------
    let parent_conv = find_thread_conv_id(
        &state.mongo,
        tenant_oid,
        body.in_reply_to.as_deref(),
        &body.references,
    )
    .await?;

    let provider_timestamp = parse_timestamp(body.timestamp.as_deref());

    let (conversation_oid, new_conversation) = if let Some(cid) = parent_conv {
        (cid, false)
    } else {
        let new_cid = open_conversation(
            &state.mongo,
            tenant_oid,
            inbox_oid,
            contact_oid,
            body.subject.as_deref(),
            provider_timestamp,
        )
        .await?;
        (new_cid, true)
    };

    // ---- Step 5 — Append message(s) -----------------------------------
    //
    // The "primary" message carries the textual body (subject prefixed
    // for context). Attachments — if any — are appended as additional
    // `File` blocks so the agent inbox can render them inline. We
    // return the primary message id in the response.
    let primary_oid = append_text_message(
        &state.mongo,
        tenant_oid,
        inbox_oid,
        contact_oid,
        conversation_oid,
        &body,
        &message_id,
        provider_timestamp,
    )
    .await?;

    for (idx, att) in body.attachments.iter().enumerate() {
        append_attachment_message(
            &state.mongo,
            tenant_oid,
            inbox_oid,
            contact_oid,
            conversation_oid,
            att,
            // Synthesise a sibling messageId so each file row is still
            // idempotent on retry. Real RFC-2822 messages don't have
            // per-attachment ids, but the synthetic suffix keeps the
            // idempotency lookup well-formed.
            &format!("{message_id}#att{idx}"),
            &body.references,
            body.in_reply_to.as_deref(),
            provider_timestamp,
        )
        .await?;
    }

    // ---- Patch the parent conversation --------------------------------
    bump_conversation(
        &state.mongo,
        tenant_oid,
        conversation_oid,
        preview_text(&body),
        provider_timestamp,
    )
    .await?;

    Ok(Json(IngestEmailResponse {
        ok: true,
        idempotent: false,
        new_conversation,
        inbox_id: inbox_oid.to_hex(),
        contact_id: contact_oid.to_hex(),
        conversation_id: conversation_oid.to_hex(),
        message_id: primary_oid.to_hex(),
    }))
}

// ===========================================================================
// Step 1 — Resolve inbox by recipient address
// ===========================================================================

/// Resolve the `sabchat_inboxes` row that owns the inbound `to`
/// address. Returns `(inbox_id, tenant_id)`.
///
/// We do a case-insensitive equality match on
/// `channelConfig.settings.address` via Mongo's `$regex` operator
/// anchored at both ends. A more efficient lookup would normalise the
/// stored address to lowercase on write and use a plain equality
/// filter; we tolerate the regex here so existing inbox rows (which
/// may be stored in mixed case) continue to resolve.
async fn resolve_inbox(mongo: &MongoHandle, to_addr: &str) -> Result<(ObjectId, ObjectId)> {
    // Escape regex metacharacters so an address like `a.b+tag@x` doesn't
    // accidentally turn into a wildcard.
    let escaped = regex_escape(to_addr);
    let filter = doc! {
        "channelType": "email",
        "channelConfig.settings.address": {
            "$regex": format!("^{escaped}$"),
            "$options": "i",
        },
    };

    let coll = mongo.collection::<Document>(INBOXES_COLL);
    let inbox = coll
        .find_one(filter)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabchat_inboxes.find_one"))
        })?
        .ok_or_else(|| {
            ApiError::NotFound(format!(
                "No email inbox is configured for recipient `{to_addr}`."
            ))
        })?;

    let inbox_id = inbox
        .get_object_id("_id")
        .map_err(|_| ApiError::Internal(anyhow::anyhow!("inbox missing _id")))?;
    let tenant_id = inbox
        .get_object_id("tenantId")
        .map_err(|_| ApiError::Internal(anyhow::anyhow!("inbox missing tenantId")))?;
    Ok((inbox_id, tenant_id))
}

// ===========================================================================
// Step 3 — Resolve-or-create contact by email
// ===========================================================================

/// Find a `sabchat_contacts` row in `tenant` whose `emails` array
/// already contains `email`; create a fresh row otherwise. Returns the
/// resolved contact's `_id`.
///
/// The shape of the inserted document mirrors what the
/// `sabchat-contacts` crate writes via its `resolve_contact` handler so
/// the two paths produce uniform rows.
async fn resolve_or_create_contact(
    mongo: &MongoHandle,
    tenant: ObjectId,
    email: &str,
    name: Option<&str>,
) -> Result<ObjectId> {
    let coll = mongo.collection::<Document>(CONTACTS_COLL);

    if let Some(hit) = coll
        .find_one(doc! { "tenantId": tenant, "emails": email })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabchat_contacts.find_one"))
        })?
    {
        let id = hit
            .get_object_id("_id")
            .map_err(|_| ApiError::Internal(anyhow::anyhow!("contact missing _id")))?;
        return Ok(id);
    }

    let new_oid = ObjectId::new();
    let now = bson::DateTime::from_chrono(Utc::now());
    let mut new_doc = doc! {
        "_id": new_oid,
        "tenantId": tenant,
        "emails": vec![email.to_owned()],
        "phones": Vec::<String>::new(),
        "socialIds": Bson::Array(Vec::new()),
        "tags": Vec::<String>::new(),
        "attrs": Bson::Document(Document::new()),
        "createdAt": now,
        "updatedAt": now,
    };
    if let Some(n) = name.map(str::trim).filter(|s| !s.is_empty()) {
        new_doc.insert("name", n);
    }
    coll.insert_one(new_doc).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabchat_contacts.insert_one"))
    })?;
    Ok(new_oid)
}

// ===========================================================================
// Step 4 — Open a new conversation
// ===========================================================================

/// Insert a brand new `sabchat_conversations` row scoped to
/// `(tenant, inbox, contact)`. Returns the new conversation's `_id`.
///
/// The conversation title is taken from the inbound subject; we keep
/// a separate `subject` field so the inbox row can display the email
/// thread title without having to crack the first message open.
async fn open_conversation(
    mongo: &MongoHandle,
    tenant: ObjectId,
    inbox: ObjectId,
    contact: ObjectId,
    subject: Option<&str>,
    timestamp: DateTime<Utc>,
) -> Result<ObjectId> {
    let new_oid = ObjectId::new();
    let now_bson = bson::DateTime::from_chrono(timestamp);
    let subject_str = subject
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .unwrap_or("(no subject)")
        .to_owned();

    let new_doc = doc! {
        "_id": new_oid,
        "tenantId": tenant,
        "inboxId": inbox,
        "contactId": contact,
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
        "lastMessageAt": now_bson,
        "lastMessagePreview": Bson::Null,
        "unreadCount": 0_i32,
        "customAttrs": doc! { "subject": &subject_str },
        "subject": &subject_str,
        "firstResponseAt": Bson::Null,
        "resolvedAt": Bson::Null,
        "createdAt": now_bson,
        "updatedAt": now_bson,
    };

    let coll = mongo.collection::<Document>(CONVERSATIONS_COLL);
    coll.insert_one(new_doc).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabchat_conversations.insert_one"))
    })?;
    Ok(new_oid)
}

// ===========================================================================
// Step 5a — Append the textual body message
// ===========================================================================

/// Insert the inbound textual `ContentBlock::Text` row. Subject is
/// prepended (when present) so the agent inbox renders the email
/// header context inline. Returns the new message's `_id`.
async fn append_text_message(
    mongo: &MongoHandle,
    tenant: ObjectId,
    inbox: ObjectId,
    contact: ObjectId,
    conversation: ObjectId,
    body: &IngestEmailBody,
    message_id: &str,
    timestamp: DateTime<Utc>,
) -> Result<ObjectId> {
    let new_oid = ObjectId::new();
    let now_bson = bson::DateTime::from_chrono(timestamp);

    let text_body = body
        .text_body
        .as_deref()
        .filter(|s| !s.trim().is_empty())
        .map(str::to_owned)
        .unwrap_or_else(|| strip_html(body.html_body.as_deref().unwrap_or("")));

    let combined = match body.subject.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        Some(subject) if !text_body.trim().is_empty() => {
            format!("Subject: {subject}\n\n{text_body}")
        }
        Some(subject) => format!("Subject: {subject}"),
        None => text_body,
    };

    let provider_metadata = doc! {
        "messageId": message_id,
        "references": Bson::Array(
            body.references
                .iter()
                .map(|s| Bson::String(strip_angle_brackets(s)))
                .collect(),
        ),
        "inReplyTo": match body.in_reply_to.as_deref() {
            Some(s) => Bson::String(strip_angle_brackets(s)),
            None => Bson::Null,
        },
        "from": &body.from,
        "to": &body.to,
        "subject": body.subject.as_deref().unwrap_or(""),
    };

    let new_doc = doc! {
        "_id": new_oid,
        "tenantId": tenant,
        "conversationId": conversation,
        "inboxId": inbox,
        "contactId": contact,
        "senderType": "visitor",
        "senderId": contact,
        "direction": "inbound",
        "content": doc! {
            "kind": "text",
            "text": &combined,
        },
        "attachments": Bson::Array(Vec::new()),
        "providerMetadata": provider_metadata,
        "private": false,
        "createdAt": now_bson,
    };

    let coll = mongo.collection::<Document>(MESSAGES_COLL);
    coll.insert_one(new_doc).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabchat_messages.insert_one(text)"))
    })?;
    Ok(new_oid)
}

// ===========================================================================
// Step 5b — Append one attachment message
// ===========================================================================

/// Insert one `ContentBlock::File` row carrying a single attachment.
/// Each attachment becomes its own message so the agent inbox can flip
/// through them with the standard file viewer.
#[allow(clippy::too_many_arguments)]
async fn append_attachment_message(
    mongo: &MongoHandle,
    tenant: ObjectId,
    inbox: ObjectId,
    contact: ObjectId,
    conversation: ObjectId,
    att: &IngestAttachment,
    synthetic_message_id: &str,
    references: &[String],
    in_reply_to: Option<&str>,
    timestamp: DateTime<Utc>,
) -> Result<ObjectId> {
    let new_oid = ObjectId::new();
    let now_bson = bson::DateTime::from_chrono(timestamp);

    // Build the `Attachment` payload. The `sabfile_id` is either
    // supplied by the upstream shim (preferred) or synthesised from the
    // URL so the field is never empty.
    let attachment = Attachment {
        sabfile_id: att
            .sabfile_id
            .as_deref()
            .map(str::to_owned)
            .unwrap_or_else(|| synthesised_sabfile_id(&att.url)),
        url: att.url.clone(),
        name: att.name.clone(),
        mime: att.mime.clone(),
        size: att.size,
    };

    // `ContentBlock::File { attachment }` — serde-tagged with
    // `kind = "file"`. We round-trip via serde_json so the snake_case
    // discriminant matches the shape `SabChatMessage` expects on read-
    // back.
    let block = sabchat_types::ContentBlock::File {
        attachment: attachment.clone(),
    };
    let content_value =
        serde_json::to_value(&block).unwrap_or(serde_json::Value::Null);
    let content_bson = Bson::try_from(content_value).unwrap_or(Bson::Null);

    // Same shape as the text message's `providerMetadata` so the
    // threading lookup keeps working off attachment rows too.
    let provider_metadata = doc! {
        "messageId": synthetic_message_id,
        "references": Bson::Array(
            references.iter().map(|s| Bson::String(strip_angle_brackets(s))).collect(),
        ),
        "inReplyTo": match in_reply_to {
            Some(s) => Bson::String(strip_angle_brackets(s)),
            None => Bson::Null,
        },
        "attachmentName": &att.name,
        "attachmentUrl": &att.url,
    };

    // `attachments` mirror lifted out of the block for fast indexing —
    // same convention `SabChatMessage` uses.
    let attachment_bson = doc! {
        "sabfileId": &attachment.sabfile_id,
        "url": &attachment.url,
        "name": &attachment.name,
        "mime": attachment.mime.clone().unwrap_or_default(),
        "size": attachment.size.map(|n| n as i64).unwrap_or(0_i64),
    };

    let new_doc = doc! {
        "_id": new_oid,
        "tenantId": tenant,
        "conversationId": conversation,
        "inboxId": inbox,
        "contactId": contact,
        "senderType": "visitor",
        "senderId": contact,
        "direction": "inbound",
        "content": content_bson,
        "attachments": Bson::Array(vec![Bson::Document(attachment_bson)]),
        "providerMetadata": provider_metadata,
        "private": false,
        "createdAt": now_bson,
    };

    let coll = mongo.collection::<Document>(MESSAGES_COLL);
    coll.insert_one(new_doc).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabchat_messages.insert_one(file)"))
    })?;
    Ok(new_oid)
}

// ===========================================================================
// Step 5c — Patch parent conversation metadata
// ===========================================================================

/// Bump `lastMessageAt` + `lastMessagePreview` + `unreadCount` on the
/// parent conversation. Mirrors the patch the `sabchat-messages` crate
/// applies on inbound visitor writes.
async fn bump_conversation(
    mongo: &MongoHandle,
    tenant: ObjectId,
    conversation: ObjectId,
    preview: String,
    timestamp: DateTime<Utc>,
) -> Result<()> {
    let now_bson = bson::DateTime::from_chrono(timestamp);
    let coll = mongo.collection::<Document>(CONVERSATIONS_COLL);
    coll.update_one(
        doc! { "_id": conversation, "tenantId": tenant },
        doc! {
            "$set": {
                "lastMessageAt": now_bson,
                "lastMessagePreview": &preview,
                "updatedAt": now_bson,
            },
            "$inc": { "unreadCount": 1_i64 },
        },
    )
    .await
    .map_err(|e| {
        ApiError::Internal(
            anyhow::Error::new(e).context("sabchat_conversations.update_one(bump)"),
        )
    })?;
    Ok(())
}

// ===========================================================================
// Helpers
// ===========================================================================

/// Build the inbox-row preview text. Prefers the plain-text body;
/// falls back to a tag-stripped HTML body; falls back finally to the
/// subject. Truncated to [`PREVIEW_MAX_CHARS`].
fn preview_text(body: &IngestEmailBody) -> String {
    let raw = body
        .text_body
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(str::to_owned)
        .or_else(|| {
            body.html_body
                .as_deref()
                .map(strip_html)
                .map(|s| s.trim().to_owned())
                .filter(|s| !s.is_empty())
        })
        .or_else(|| {
            body.subject
                .as_deref()
                .map(str::trim)
                .filter(|s| !s.is_empty())
                .map(str::to_owned)
        })
        .unwrap_or_default();
    truncate_chars(&collapse_whitespace(&raw), PREVIEW_MAX_CHARS)
}

/// Strip surrounding angle brackets from a bare `Message-ID` token.
/// Mirrors the helper in [`crate::threading`]; duplicated here to keep
/// the module boundary clean — these helpers are leaf utilities, not
/// shared API.
fn strip_angle_brackets(s: &str) -> String {
    let trimmed = s.trim();
    trimmed
        .strip_prefix('<')
        .and_then(|t| t.strip_suffix('>'))
        .map(|t| t.to_owned())
        .unwrap_or_else(|| trimmed.to_owned())
}

/// Best-effort tag stripping for HTML bodies. We don't need a full
/// parser here — the preview field is short and the body is rendered
/// in a sandbox elsewhere; this is only for the inbox-row text and the
/// `ContentBlock::Text` fallback.
fn strip_html(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    let mut in_tag = false;
    for ch in s.chars() {
        match ch {
            '<' => in_tag = true,
            '>' => in_tag = false,
            c if !in_tag => out.push(c),
            _ => {}
        }
    }
    out
}

/// Collapse runs of whitespace into single spaces. Used for the preview
/// so multi-line bodies don't waste column width on `\n\n` gaps.
fn collapse_whitespace(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    let mut last_space = false;
    for ch in s.chars() {
        if ch.is_whitespace() {
            if !last_space {
                out.push(' ');
                last_space = true;
            }
        } else {
            out.push(ch);
            last_space = false;
        }
    }
    out.trim().to_owned()
}

/// Truncate `s` to at most `max` Unicode scalar values. Adequate for
/// preview text — see the matching helper in `sabchat-messages`.
fn truncate_chars(s: &str, max: usize) -> String {
    if s.chars().count() <= max {
        return s.to_owned();
    }
    s.chars().take(max).collect()
}

/// Synthesise a SabFiles asset id for an attachment that the upstream
/// shim didn't pre-upload. We hash the URL with a stable FNV-1a digest
/// rendered as 24 hex chars (matching the ObjectId string length so
/// downstream consumers don't get confused by a longer token).
fn synthesised_sabfile_id(url: &str) -> String {
    // FNV-1a 64-bit; doubled into 128 bits via mixing so the
    // 24-hex-char output has enough entropy to avoid collisions across
    // a single tenant's mailbox.
    const FNV_OFFSET: u64 = 0xcbf29ce484222325;
    const FNV_PRIME: u64 = 0x100000001b3;
    let mut h1 = FNV_OFFSET;
    let mut h2 = FNV_OFFSET ^ 0x9e3779b97f4a7c15;
    for b in url.as_bytes() {
        h1 ^= *b as u64;
        h1 = h1.wrapping_mul(FNV_PRIME);
        h2 ^= (*b as u64).rotate_left(5);
        h2 = h2.wrapping_mul(FNV_PRIME);
    }
    let suffix = (h2 as u32) ^ ((h2 >> 32) as u32);
    format!("{h1:016x}{suffix:08x}")
}

/// Parse an RFC-3339 timestamp into UTC, falling back to `now()` on any
/// parse error. The upstream provider is best-effort here; we don't
/// fail ingestion over a timestamp formatting hiccup.
fn parse_timestamp(s: Option<&str>) -> DateTime<Utc> {
    s.and_then(|raw| DateTime::parse_from_rfc3339(raw.trim()).ok())
        .map(|dt| dt.with_timezone(&Utc))
        .unwrap_or_else(Utc::now)
}

/// Escape Mongo `$regex` metacharacters so we can do a literal anchored
/// match without accidentally treating user-controlled input as a
/// pattern. Covers the standard PCRE special set.
fn regex_escape(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    for ch in s.chars() {
        match ch {
            '.' | '+' | '*' | '?' | '(' | ')' | '|' | '[' | ']' | '{' | '}' | '\\' | '^'
            | '$' | '/' => {
                out.push('\\');
                out.push(ch);
            }
            _ => out.push(ch),
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn strip_html_drops_tags() {
        assert_eq!(strip_html("<p>hi <b>there</b></p>"), "hi there");
        assert_eq!(strip_html("plain"), "plain");
    }

    #[test]
    fn collapse_whitespace_squashes_runs() {
        assert_eq!(collapse_whitespace("a   b\n\nc"), "a b c");
        assert_eq!(collapse_whitespace("   "), "");
    }

    #[test]
    fn truncate_chars_keeps_unicode_intact() {
        let s = "héllo world".to_owned();
        assert_eq!(truncate_chars(&s, 5), "héllo");
        assert_eq!(truncate_chars(&s, 100), s);
    }

    #[test]
    fn regex_escape_handles_metas() {
        assert_eq!(regex_escape("a.b+c@x"), "a\\.b\\+c@x");
        assert_eq!(regex_escape("plain"), "plain");
    }

    #[test]
    fn synthesised_id_is_stable() {
        let a = synthesised_sabfile_id("https://x/y");
        let b = synthesised_sabfile_id("https://x/y");
        assert_eq!(a, b);
        assert_eq!(a.len(), 24);
        assert!(a.chars().all(|c| c.is_ascii_hexdigit()));
    }

    #[test]
    fn preview_text_prefers_text_body() {
        let body = IngestEmailBody {
            to: "x@y".into(),
            from: "a@b".into(),
            from_name: None,
            subject: Some("subj".into()),
            text_body: Some("hello world".into()),
            html_body: Some("<p>HTML</p>".into()),
            message_id: "abc@x".into(),
            in_reply_to: None,
            references: vec![],
            attachments: vec![],
            timestamp: None,
        };
        assert_eq!(preview_text(&body), "hello world");
    }

    #[test]
    fn preview_text_falls_back_to_html() {
        let body = IngestEmailBody {
            to: "x@y".into(),
            from: "a@b".into(),
            from_name: None,
            subject: Some("subj".into()),
            text_body: None,
            html_body: Some("<p>plain</p>".into()),
            message_id: "abc@x".into(),
            in_reply_to: None,
            references: vec![],
            attachments: vec![],
            timestamp: None,
        };
        assert_eq!(preview_text(&body), "plain");
    }
}
