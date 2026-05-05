//! `ChatMarker` — read/unread mutator for a single conversation.
//!
//! See the crate-level docs in `lib.rs` for the TS-vs-Phase-2 reconciliation
//! rationale. This module only restates the wire shapes and the exact
//! Mongo updates issued.
//!
//! ## Mongo writes (read path)
//!
//! - `incoming_messages`:
//!   ```text
//!   updateMany(
//!     { contactId, isRead: false },
//!     { $set: { isRead: true } },
//!   )
//!   ```
//!   Returned `modified_count` is reported back via `MarkOutcome::messages_updated`.
//!
//! - `contacts`:
//!   ```text
//!   updateOne(
//!     { _id: contactId },
//!     { $set: { unreadCount: 0 } },
//!   )
//!   ```
//!   Mirrors the TS Server Action exactly (matches by `_id` only because the
//!   TS additionally filters by `projectId`, which the caller has already
//!   resolved — see crate docs).
//!
//! - `conversations`:
//!   ```text
//!   updateOne(
//!     { contactId },
//!     { $set: { unreadCount: 0, updatedAt: <now-utc> } },
//!   )
//!   ```
//!   Touches the Phase 2 materialized view so the inbox-list query
//!   (`find().sort({lastMessageAt:-1})`) reads a coherent unread badge.
//!   `matched_count == 0` is normal for contacts whose first inbound
//!   message has not yet been processed.
//!
//! ## Mongo writes (unread path)
//!
//! - `contacts`: `$set: { unreadCount: 1 }` (TS parity, by `_id`).
//! - `conversations`: `$set: { unreadCount: 1, updatedAt: <now-utc> }` by `contactId`.
//! - `incoming_messages`: untouched (TS parity).

use bson::{Document, doc, oid::ObjectId};
use chrono::Utc;
use mongodb::Collection;
use sabnode_common::ApiError;
use sabnode_db::mongo::MongoHandle;
use serde::{Deserialize, Serialize};
use tracing::debug;

/// Mongo collection of inbound messages — the per-message read flag lives
/// here. Same name the TS `getConversation` and `markConversationAsRead`
/// use (see `whatsapp.actions.ts` line ~642 / 685).
const INCOMING_MESSAGES: &str = "incoming_messages";

/// Mongo collection of contacts. Carries the legacy `unreadCount` field
/// the TS inbox renders today.
const CONTACTS: &str = "contacts";

/// Mongo collection of the Phase 2 materialized view (see
/// `wachat-webhook-conversations`). Carries the new `unreadCount` field
/// that the Rust inbox API will read from.
const CONVERSATIONS: &str = "conversations";

/// Aggregated outcome of a `mark_read` / `mark_unread` call. Returned to
/// the caller so the API layer can emit a useful response payload (e.g.
/// "marked N messages read") without re-querying.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct MarkOutcome {
    /// Number of `incoming_messages` rows whose `isRead` flag flipped on
    /// this call. Always `0` for `mark_unread` (we do not mutate the
    /// per-message flag on the unread path — see crate docs).
    pub messages_updated: u64,
}

/// Reads/unreads a single conversation. Holds a Mongo handle reused
/// across calls. Cheap to clone (`MongoHandle` is `Clone`).
#[derive(Debug, Clone)]
pub struct ChatMarker {
    mongo: MongoHandle,
}

impl ChatMarker {
    /// Construct a new marker bound to the supplied Mongo handle.
    pub fn new(mongo: MongoHandle) -> Self {
        Self { mongo }
    }

    /// Mark the conversation for `contact_id` as read.
    ///
    /// Writes (in order):
    /// 1. `incoming_messages.update_many({contactId, isRead:false}, {$set:{isRead:true}})`
    /// 2. `contacts.update_one({_id: contact_id}, {$set:{unreadCount:0}})`
    /// 3. `conversations.update_one({contactId: contact_id}, {$set:{unreadCount:0, updatedAt:now}})`
    ///
    /// The three writes are issued sequentially (not transactionally —
    /// the TS isn't transactional either, and a Mongo session here would
    /// require a replica-set assumption we don't want to bake into a
    /// leaf crate). A failure in step 1 short-circuits — we don't want
    /// to zero the badge while individual messages still read as unread.
    /// A failure in step 2 or 3 propagates after step 1 has already
    /// landed; this matches the TS behaviour (where the analogous order
    /// is contacts → incoming_messages, and a failed second update would
    /// likewise leave the contact desynced).
    pub async fn mark_read(&self, contact_id: &ObjectId) -> Result<MarkOutcome, ApiError> {
        let incoming: Collection<Document> = self.mongo.collection(INCOMING_MESSAGES);
        let contacts: Collection<Document> = self.mongo.collection(CONTACTS);
        let conversations: Collection<Document> = self.mongo.collection(CONVERSATIONS);

        // 1) Flip per-message isRead flags. Filter by `isRead: false` so
        //    the modified_count is meaningful (otherwise we'd report the
        //    full conversation length on every call).
        let messages_res = incoming
            .update_many(
                doc! { "contactId": contact_id, "isRead": false },
                doc! { "$set": { "isRead": true } },
            )
            .await
            .map_err(|e| ApiError::from(anyhow::Error::from(e)))?;

        // 2) Reset legacy contact-level unread count (TS source of truth).
        let _contact_res = contacts
            .update_one(
                doc! { "_id": contact_id },
                doc! { "$set": { "unreadCount": 0i32 } },
            )
            .await
            .map_err(|e| ApiError::from(anyhow::Error::from(e)))?;

        // 3) Reset materialized-view unread count (Phase 2 source of truth).
        //    matched_count == 0 is fine — a contact who has never received
        //    an inbound message has no conversation row yet.
        let now_bson = bson::DateTime::from_chrono(Utc::now());
        let conv_res = conversations
            .update_one(
                doc! { "contactId": contact_id },
                doc! { "$set": { "unreadCount": 0i32, "updatedAt": now_bson } },
            )
            .await
            .map_err(|e| ApiError::from(anyhow::Error::from(e)))?;

        debug!(
            contact_id = %contact_id,
            messages_updated = messages_res.modified_count,
            conversation_matched = conv_res.matched_count,
            "marked conversation read",
        );

        Ok(MarkOutcome {
            messages_updated: messages_res.modified_count,
        })
    }

    /// Mark the conversation for `contact_id` as unread.
    ///
    /// Writes (in order):
    /// 1. `contacts.update_one({_id: contact_id}, {$set:{unreadCount:1}})`
    /// 2. `conversations.update_one({contactId: contact_id}, {$set:{unreadCount:1, updatedAt:now}})`
    ///
    /// `incoming_messages.isRead` is **not** touched — the TS doesn't
    /// (see `markConversationAsUnread` in `whatsapp.actions.ts` line ~697,
    /// which only writes `contacts.unreadCount = 1`). The unread badge is
    /// driven entirely by the contact-/conversation-level counter; the
    /// per-message flag stays as it was so reopening the chat doesn't
    /// re-mark anything.
    ///
    /// Returns `MarkOutcome { messages_updated: 0 }` always; the field is
    /// preserved for API symmetry with `mark_read`.
    pub async fn mark_unread(&self, contact_id: &ObjectId) -> Result<MarkOutcome, ApiError> {
        let contacts: Collection<Document> = self.mongo.collection(CONTACTS);
        let conversations: Collection<Document> = self.mongo.collection(CONVERSATIONS);

        // 1) Flip the legacy contact-level counter to 1 (TS parity).
        let _contact_res = contacts
            .update_one(
                doc! { "_id": contact_id },
                doc! { "$set": { "unreadCount": 1i32 } },
            )
            .await
            .map_err(|e| ApiError::from(anyhow::Error::from(e)))?;

        // 2) Mirror to the Phase 2 view. matched_count == 0 is normal
        //    for contacts who have never sent an inbound (no row yet);
        //    we don't upsert because we don't have a meaningful
        //    `lastMessageAt` / `lastMessageText` to seed it with — the
        //    next inbound from that contact will create the row organically.
        let now_bson = bson::DateTime::from_chrono(Utc::now());
        let conv_res = conversations
            .update_one(
                doc! { "contactId": contact_id },
                doc! { "$set": { "unreadCount": 1i32, "updatedAt": now_bson } },
            )
            .await
            .map_err(|e| ApiError::from(anyhow::Error::from(e)))?;

        debug!(
            contact_id = %contact_id,
            conversation_matched = conv_res.matched_count,
            "marked conversation unread",
        );

        Ok(MarkOutcome {
            messages_updated: 0,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Sanity-check that `MarkOutcome` is the trivial value type the
    /// public API promises. Catches accidental field-rename / type-bump
    /// during refactors that would silently break the API crate.
    #[test]
    fn outcome_default_is_zero() {
        let o = MarkOutcome::default();
        assert_eq!(o.messages_updated, 0);
    }

    #[test]
    fn outcome_is_copy() {
        // If this stops compiling, MarkOutcome gained a non-Copy field
        // and every caller's `let x = out;` site needs auditing.
        fn assert_copy<T: Copy>() {}
        assert_copy::<MarkOutcome>();
    }

    #[test]
    fn outcome_serializes_camel_case_field_unchanged() {
        // serde derive without rename_all => snake_case. The API crate
        // owns the JSON envelope and re-shapes if needed; this test just
        // pins the current wire shape so a casual `#[serde(rename_all)]`
        // addition would break it loudly.
        let o = MarkOutcome {
            messages_updated: 7,
        };
        let s = serde_json::to_string(&o).unwrap();
        assert_eq!(s, r#"{"messages_updated":7}"#);
    }
}
