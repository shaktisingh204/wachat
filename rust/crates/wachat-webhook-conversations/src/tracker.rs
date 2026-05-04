//! Conversation materialized-view tracker — the main entry point of this crate.
//!
//! ## Mongo schema (conversations collection)
//!
//! New collection introduced by the Rust port (the TS does **not** have one
//! today — see crate-level docs). Field names are camelCase to match the
//! workspace serde convention (`#[serde(rename_all = "camelCase")]` on
//! [`wachat_types::Conversation`]).
//!
//! ```text
//! {
//!   _id:                  ObjectId,        // the conversation's own id
//!   projectId:            ObjectId,        // FK -> projects
//!   contactId:            ObjectId,        // FK -> contacts
//!   lastMessageAt:        BSON Date,       // bumped on every inbound (UTC)
//!   lastMessageText:      String (<=200),  // truncated for inbox preview
//!   lastMessageDirection: "in" | "out",
//!   lastMessageKind:      "text" | "image" | "video" | "audio" |
//!                         "document" | "sticker" | "location" |
//!                         "contact" | "interactive" | "unknown",
//!   unreadCount:          u32,             // $inc on inbound, reset by mark_read
//!   lastDeliveredAt:      BSON Date,       // outbound delivered status
//!   lastReadAt:           BSON Date,       // outbound read status
//!   createdAt:            BSON Date,       // $setOnInsert
//!   updatedAt:            BSON Date,       // bumped on every write
//! }
//! ```
//!
//! ### Index hints (created elsewhere — db-bootstrap crate / migration)
//!
//! - `{ projectId: 1, contactId: 1 }` UNIQUE — the upsert filter.
//! - `{ projectId: 1, lastMessageAt: -1 }` — the inbox-list sort key.
//!
//! ## Behaviour
//!
//! - **`on_inbound`**: per inbound message in `value.messages`, look up the
//!   `WaContact` by `{projectId, waId: msg.from}`. If found, upsert the
//!   conversation: bump `lastMessageAt`, set `lastMessageText` (truncated to
//!   200 chars) + `lastMessageKind` + `lastMessageDirection: "in"`, and
//!   `$inc: { unreadCount: 1 }`.
//! - **`on_status`**: per outbound status update, look up the originating
//!   `outgoing_messages` row by `wamid`, then update the matching
//!   conversation's `lastDeliveredAt` / `lastReadAt`. **Never** changes
//!   unread count (that's inbound-only) and **never** changes `lastMessageAt`
//!   (status events are lifecycle of an already-counted message, not a new
//!   activity event).
//! - **`mark_read`**: external hook — sets `unreadCount: 0` when a human
//!   agent opens the conversation in the frontend.

use std::convert::TryInto;

use bson::{Document, doc, oid::ObjectId};
use chrono::Utc;
use mongodb::Collection;
use mongodb::options::{FindOneOptions, UpdateOptions};
use sabnode_common::ApiError;
use sabnode_db::mongo::MongoHandle;
use serde::{Deserialize, Serialize};
use tracing::{debug, warn};
use wachat_meta_dto::webhook::{ChangeValue, InboundMessage, StatusUpdate};
use wachat_types::project::Project;

/// Mongo collection that stores the conversation materialized view. New
/// collection introduced by the Rust port — there is no TS equivalent (see
/// `lib.rs`).
const CONVERSATIONS: &str = "conversations";

/// Mongo collection of contacts. Mirrors
/// `db.collection<Contact>('contacts')` in `whatsapp.actions.ts`.
const CONTACTS: &str = "contacts";

/// Mongo collection of outbound message rows. Same name as
/// `wachat-webhook-status` uses (see its `OUTGOING_MESSAGES` const) so the
/// status lookup here resolves the same documents the status processor wrote.
const OUTGOING_MESSAGES: &str = "outgoing_messages";

/// Cap on `lastMessageText` length. Long media captions / replies shouldn't
/// bloat the materialized view; the inbox preview only needs the first
/// couple of lines anyway.
const LAST_MESSAGE_TEXT_MAX: usize = 200;

/// Aggregated outcome of a `on_inbound` / `on_status` / `mark_read` call.
/// The receiver crate uses `conversations_touched` to feed metrics
/// (`webhook_conversations_touched_total`) and to drive cache-invalidation
/// signalling for any open WebSocket inbox subscribers.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct TrackerOutcome {
    /// Number of distinct conversation documents that were created or
    /// updated by this call. For `on_inbound`, equal to the number of
    /// inbound messages whose contact lookup succeeded. For `on_status`,
    /// equal to the number of status events whose wamid resolved to a
    /// conversation. For `mark_read`, 0 or 1.
    pub conversations_touched: usize,
}

/// Conversation materialized-view tracker. Holds a Mongo handle reused
/// across calls — we don't open a new client per webhook. Cheap to clone
/// (the underlying `MongoHandle` is `Clone`).
#[derive(Debug, Clone)]
pub struct ConversationTracker {
    mongo: MongoHandle,
}

impl ConversationTracker {
    /// Construct a new tracker bound to the supplied Mongo handle.
    pub fn new(mongo: MongoHandle) -> Self {
        Self { mongo }
    }

    /// Process the inbound `value.messages` slice from a webhook event.
    ///
    /// Per the dispatcher contract the caller must have invoked the
    /// contacts agent (`wachat-webhook-contacts`) before us so that every
    /// `msg.from` already has a `WaContact` row — but we don't trust that
    /// blindly: a missing contact is logged + skipped (never errored), so
    /// a single race or a misordered dispatcher cannot fail an entire
    /// batch. Per-message Mongo errors are likewise logged + counted, never
    /// propagated; only a fully-broken Mongo handle bubbles out.
    pub async fn on_inbound(
        &self,
        project: &Project,
        value: &ChangeValue,
    ) -> Result<TrackerOutcome, ApiError> {
        let messages = value.messages.as_deref().unwrap_or(&[]);
        if messages.is_empty() {
            return Ok(TrackerOutcome::default());
        }

        let conversations: Collection<Document> = self.mongo.collection(CONVERSATIONS);
        let contacts: Collection<Document> = self.mongo.collection(CONTACTS);

        let mut outcome = TrackerOutcome::default();

        for msg in messages {
            match self.upsert_inbound(&conversations, &contacts, project, msg).await {
                Ok(true) => outcome.conversations_touched += 1,
                Ok(false) => { /* contact missing — already logged */ }
                Err(err) => {
                    // Single-message failure: log + continue. A broken Mongo
                    // handle will surface as N consecutive failures and be
                    // visible in metrics; one bad message must not fail the
                    // whole batch.
                    warn!(
                        project_id = %project.id,
                        wa_id = %msg.from,
                        wamid = %msg.id,
                        error = %err,
                        "conversation upsert failed; continuing batch",
                    );
                }
            }
        }

        Ok(outcome)
    }

    /// Process the outbound `value.statuses` slice.
    ///
    /// Status events represent the lifecycle of an **outbound** message
    /// (sent → delivered → read → failed). They do **not** count as new
    /// conversation activity — `lastMessageAt` is the timestamp of the
    /// most-recent message itself, not of the most-recent status hop on it.
    /// We update only `lastDeliveredAt` / `lastReadAt` on the conversation
    /// so the inbox can render delivery-state badges without re-querying
    /// the message log.
    pub async fn on_status(
        &self,
        project: &Project,
        value: &ChangeValue,
    ) -> Result<TrackerOutcome, ApiError> {
        let statuses = value.statuses.as_deref().unwrap_or(&[]);
        if statuses.is_empty() {
            return Ok(TrackerOutcome::default());
        }

        // Only `delivered` and `read` are interesting for the inbox view.
        // `sent` is implied by the message existing, and `failed` is shown
        // off the message row itself, not the conversation summary.
        let interesting: Vec<&StatusUpdate> = statuses
            .iter()
            .filter(|s| {
                let lower = s.status.to_ascii_lowercase();
                lower == "delivered" || lower == "read"
            })
            .collect();
        if interesting.is_empty() {
            return Ok(TrackerOutcome::default());
        }

        let conversations: Collection<Document> = self.mongo.collection(CONVERSATIONS);
        let outgoing: Collection<Document> = self.mongo.collection(OUTGOING_MESSAGES);

        let mut outcome = TrackerOutcome::default();

        for status in interesting {
            match self.apply_status(&conversations, &outgoing, project, status).await {
                Ok(true) => outcome.conversations_touched += 1,
                Ok(false) => { /* unknown wamid — already logged */ }
                Err(err) => {
                    warn!(
                        project_id = %project.id,
                        wamid = %status.id,
                        status = %status.status,
                        error = %err,
                        "conversation status update failed; continuing batch",
                    );
                }
            }
        }

        Ok(outcome)
    }

    /// Frontend hook: reset `unreadCount` to 0 for the conversation
    /// `(project, contact_id)` when an agent opens the chat. Mirrors the
    /// effect of TS-side `markConversationAsRead` in `whatsapp.actions.ts`
    /// (line ~672), which today writes to `contacts.unreadCount`. Once the
    /// TS migrates onto this view it should call this method directly.
    pub async fn mark_read(
        &self,
        project: &Project,
        contact_id: &ObjectId,
    ) -> Result<TrackerOutcome, ApiError> {
        let conversations: Collection<Document> = self.mongo.collection(CONVERSATIONS);

        let now = Utc::now();
        let res = conversations
            .update_one(
                doc! { "projectId": project.id, "contactId": contact_id },
                doc! { "$set": { "unreadCount": 0i32, "updatedAt": bson::DateTime::from_chrono(now) } },
            )
            .await
            .map_err(|e| ApiError::from(anyhow::Error::from(e)))?;

        // 0 matched is a normal case when the agent opens a contact who has
        // never sent a message (no conversation row yet). Don't error.
        Ok(TrackerOutcome {
            conversations_touched: res.matched_count.try_into().unwrap_or(usize::MAX),
        })
    }

    /// Apply a single inbound message. Returns `Ok(true)` if a conversation
    /// row was upserted, `Ok(false)` if the contact lookup missed (logged
    /// at `warn` so the dispatcher mis-order is visible), and `Err` only on
    /// Mongo-driver-level failures (the caller swallows those).
    async fn upsert_inbound(
        &self,
        conversations: &Collection<Document>,
        contacts: &Collection<Document>,
        project: &Project,
        msg: &InboundMessage,
    ) -> Result<bool, anyhow::Error> {
        // 1) Resolve the WaContact._id by (projectId, waId).
        //
        // The TS contact identity field is `waId` (see `whatsapp.actions.ts`
        // line 578: `selectedContact = contacts.find(c => c.waId === waId)`)
        // and the Rust `WaContact` exposes the same wire field via
        // `pub phone: String` (the rename to `phone` is Rust-side only —
        // serde keeps the on-disk name `phone`, BUT the contacts agent
        // upserts using `waId` to match the TS schema). To stay
        // forward-compatible with both naming conventions until the
        // contacts agent settles, we match on `waId` (the canonical TS
        // field name and what every existing document uses).
        let opts = FindOneOptions::builder()
            .projection(doc! { "_id": 1i32 })
            .build();

        let contact_doc = contacts
            .find_one(doc! { "projectId": project.id, "waId": &msg.from })
            .with_options(opts)
            .await?;

        let Some(doc) = contact_doc else {
            // Contacts agent should have run before us. If not, log loudly
            // so the dispatcher mis-ordering is fixable, but do NOT create
            // an orphan contact here — that's the contacts agent's job and
            // duplicating it would risk diverging schemas.
            warn!(
                project_id = %project.id,
                wa_id = %msg.from,
                wamid = %msg.id,
                "no contact found for inbound message; skipping conversation upsert (run wachat-webhook-contacts before wachat-webhook-conversations)",
            );
            return Ok(false);
        };

        let contact_id = doc
            .get_object_id("_id")
            .map_err(|e| anyhow::anyhow!("contact _id missing/not ObjectId: {e}"))?;

        // 2) Build the upsert payload.
        let now = Utc::now();
        let now_bson = bson::DateTime::from_chrono(now);
        let (text, kind) = extract_message_preview(msg);

        let filter = doc! {
            "projectId": project.id,
            "contactId": contact_id,
        };

        // $setOnInsert for fields that must only be written on creation;
        // $set for fields that get overwritten on every inbound; $inc for
        // the unread counter. The new ObjectId for `_id` is generated
        // here rather than relying on Mongo's default so the upsert filter
        // can stay on the unique (projectId, contactId) compound index.
        let update = doc! {
            "$setOnInsert": {
                "_id": ObjectId::new(),
                "projectId": project.id,
                "contactId": contact_id,
                "createdAt": now_bson,
                "unreadCount": 0i32, // overridden by the $inc below on first insert
            },
            "$set": {
                "lastMessageAt": now_bson,
                "lastMessageText": text,
                "lastMessageKind": kind,
                "lastMessageDirection": "in",
                "updatedAt": now_bson,
            },
            "$inc": { "unreadCount": 1i32 },
        };

        let opts = UpdateOptions::builder().upsert(true).build();
        let res = conversations
            .update_one(filter, update)
            .with_options(opts)
            .await?;

        debug!(
            project_id = %project.id,
            contact_id = %contact_id,
            wamid = %msg.id,
            matched = res.matched_count,
            upserted = res.upserted_id.is_some(),
            "conversation upserted from inbound message",
        );

        Ok(true)
    }

    /// Apply a single outbound status update. Returns `Ok(true)` if the
    /// conversation row's delivery/read timestamp was updated, `Ok(false)`
    /// if the wamid did not resolve (Meta retry for a wamid we never
    /// stored — normal on cold caches), and `Err` only on Mongo failures.
    async fn apply_status(
        &self,
        conversations: &Collection<Document>,
        outgoing: &Collection<Document>,
        project: &Project,
        status: &StatusUpdate,
    ) -> Result<bool, anyhow::Error> {
        // 1) Resolve the outbound message row by wamid → contactId. We
        //    only need `contactId` so project that field to keep the
        //    response small (the message bodies can be large).
        let opts = FindOneOptions::builder()
            .projection(doc! { "_id": 1i32, "contactId": 1i32, "projectId": 1i32 })
            .build();

        let msg_doc = outgoing
            .find_one(doc! { "wamid": &status.id })
            .with_options(opts)
            .await?;

        let Some(doc) = msg_doc else {
            // wamid unknown — Meta retried for a message we never persisted
            // (or persisted under a different shape). Normal during the
            // cutover from TS to Rust workers; logged at debug.
            debug!(
                project_id = %project.id,
                wamid = %status.id,
                "no outgoing_messages row for status update; skipping conversation timestamp update",
            );
            return Ok(false);
        };

        let contact_id = doc
            .get_object_id("contactId")
            .map_err(|e| anyhow::anyhow!("outgoing message has no contactId: {e}"))?;

        // 2) Compose the conversation update. Only `delivered` and `read`
        //    reach this branch (filtered upstream in `on_status`).
        let now_bson = bson::DateTime::from_chrono(Utc::now());
        let field = match status.status.to_ascii_lowercase().as_str() {
            "delivered" => "lastDeliveredAt",
            "read" => "lastReadAt",
            // Defensive: unreachable thanks to the upstream filter, but
            // keep it explicit so a future caller adding a new status to
            // the filter doesn't silently corrupt the doc.
            other => {
                debug!(
                    project_id = %project.id,
                    wamid = %status.id,
                    status = %other,
                    "non-conversation-relevant status reached apply_status; skipping",
                );
                return Ok(false);
            }
        };

        let filter = doc! { "projectId": project.id, "contactId": contact_id };
        let update = doc! { "$set": { field: now_bson, "updatedAt": now_bson } };

        let res = conversations.update_one(filter, update).await?;

        // matched_count == 0 here means the conversation row doesn't exist
        // yet (e.g. status arrived before the first inbound — unusual but
        // possible for outbound-initiated chats like broadcasts). We do NOT
        // create one because we don't have a meaningful `lastMessageText`
        // / `lastMessageAt` to seed it with; the next inbound will
        // backfill the row organically.
        Ok(res.matched_count > 0)
    }
}

/// Extract the inbox-preview text + kind tag for an inbound message.
///
/// Mirrors the TS switch in `webhook-processor.ts` (line ~1370 onward) but
/// also captures the typed kind so the inbox can render an icon without
/// re-parsing. Truncates to [`LAST_MESSAGE_TEXT_MAX`] chars on a UTF-8
/// boundary so we never split a code point.
///
/// Returns `("", kind)` when the message has no human-readable text — the
/// inbox UI then renders just the kind badge (e.g. "[Image]").
fn extract_message_preview(msg: &InboundMessage) -> (String, &'static str) {
    let kind = classify_kind(msg);

    // Prefer text body, then media caption, else empty string.
    let raw = match msg.r#type.as_str() {
        "text" => msg.text.as_ref().map(|t| t.body.clone()).unwrap_or_default(),
        "image" => msg
            .image
            .as_ref()
            .and_then(|m| m.caption.clone())
            .unwrap_or_default(),
        "video" => msg
            .video
            .as_ref()
            .and_then(|m| m.caption.clone())
            .unwrap_or_default(),
        "document" => msg
            .document
            .as_ref()
            .and_then(|m| m.filename.clone().or_else(|| m.caption.clone()))
            .unwrap_or_default(),
        // audio / sticker / location / contacts / interactive: no meaningful
        // textual preview without re-typing the open-ended Value. The kind
        // tag carries the inbox signal.
        _ => String::new(),
    };

    (truncate_on_char_boundary(raw, LAST_MESSAGE_TEXT_MAX), kind)
}

/// Map the wire `type` discriminator onto the closed kind set documented in
/// the module-level schema block. Unknown / unmapped types collapse to
/// `"unknown"` so the inbox renderer always has a safe icon to fall back to.
fn classify_kind(msg: &InboundMessage) -> &'static str {
    match msg.r#type.as_str() {
        "text" => "text",
        "image" => "image",
        "video" => "video",
        "audio" => "audio",
        "document" => "document",
        "sticker" => "sticker",
        "location" => "location",
        "contacts" | "contact" => "contact",
        // The TS distinguishes button replies vs interactive replies vs
        // flow replies vs list replies; the inbox preview just wants
        // "interactive" as a single bucket.
        "interactive" | "button" | "list" => "interactive",
        _ => "unknown",
    }
}

/// Truncate `s` to at most `max` bytes, snapping back to a UTF-8 char
/// boundary. `String::truncate` would panic on a non-boundary split for
/// multibyte text (emoji, scripts).
fn truncate_on_char_boundary(mut s: String, max: usize) -> String {
    if s.len() <= max {
        return s;
    }
    let mut cut = max;
    while cut > 0 && !s.is_char_boundary(cut) {
        cut -= 1;
    }
    s.truncate(cut);
    s
}

#[cfg(test)]
mod tests {
    use super::*;
    use wachat_meta_dto::messages::{MediaBody, TextBody};

    fn mk_msg(kind: &str, text: Option<&str>, caption: Option<&str>) -> InboundMessage {
        InboundMessage {
            from: "919876543210".into(),
            id: "wamid.TEST".into(),
            timestamp: "1717000000".into(),
            r#type: kind.into(),
            text: text.map(|t| TextBody {
                body: t.into(),
                preview_url: false,
            }),
            image: if kind == "image" {
                Some(MediaBody {
                    id: None,
                    link: None,
                    caption: caption.map(str::to_owned),
                    filename: None,
                })
            } else {
                None
            },
            video: if kind == "video" {
                Some(MediaBody {
                    id: None,
                    link: None,
                    caption: caption.map(str::to_owned),
                    filename: None,
                })
            } else {
                None
            },
            audio: None,
            document: if kind == "document" {
                Some(MediaBody {
                    id: None,
                    link: None,
                    caption: caption.map(str::to_owned),
                    filename: Some("invoice.pdf".into()),
                })
            } else {
                None
            },
            button: None,
            interactive: None,
            context: None,
        }
    }

    #[test]
    fn preview_extracts_text_body() {
        let m = mk_msg("text", Some("hello world"), None);
        let (t, k) = extract_message_preview(&m);
        assert_eq!(t, "hello world");
        assert_eq!(k, "text");
    }

    #[test]
    fn preview_falls_back_to_image_caption() {
        let m = mk_msg("image", None, Some("a caption"));
        let (t, k) = extract_message_preview(&m);
        assert_eq!(t, "a caption");
        assert_eq!(k, "image");
    }

    #[test]
    fn preview_uses_document_filename_when_no_caption() {
        let m = mk_msg("document", None, None);
        let (t, k) = extract_message_preview(&m);
        assert_eq!(t, "invoice.pdf");
        assert_eq!(k, "document");
    }

    #[test]
    fn preview_is_empty_for_audio() {
        let m = mk_msg("audio", None, None);
        let (t, k) = extract_message_preview(&m);
        assert_eq!(t, "");
        assert_eq!(k, "audio");
    }

    #[test]
    fn preview_truncates_to_200_chars() {
        let long = "a".repeat(500);
        let m = mk_msg("text", Some(&long), None);
        let (t, _) = extract_message_preview(&m);
        assert_eq!(t.len(), 200);
    }

    #[test]
    fn preview_truncate_respects_utf8_boundary() {
        // 100 four-byte emoji = 400 bytes. Truncated to 200 must land on a
        // boundary (i.e. length is a multiple of 4 and not in the middle).
        let s: String = "🎉".repeat(100);
        let m = mk_msg("text", Some(&s), None);
        let (t, _) = extract_message_preview(&m);
        assert!(t.len() <= 200);
        // String::truncate would have panicked if we'd cut mid-codepoint;
        // surviving here proves the boundary snap worked.
        assert!(t.is_char_boundary(t.len()));
    }

    #[test]
    fn classify_kind_collapses_interactive_variants() {
        let mut m = mk_msg("interactive", None, None);
        assert_eq!(classify_kind(&m), "interactive");
        m.r#type = "button".into();
        assert_eq!(classify_kind(&m), "interactive");
        m.r#type = "list".into();
        assert_eq!(classify_kind(&m), "interactive");
    }

    #[test]
    fn classify_kind_unknown_type_is_unknown() {
        let m = mk_msg("system", None, None);
        assert_eq!(classify_kind(&m), "unknown");
    }
}
