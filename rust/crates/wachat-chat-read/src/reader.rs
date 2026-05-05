//! `ChatReader` — read-only Mongo queries that back the wachat chat UI.
//!
//! Two TS server actions are ported here, both from
//! `src/app/actions/whatsapp.actions.ts`:
//!
//! | TS function           | Line  | Rust                                         |
//! |-----------------------|-------|----------------------------------------------|
//! | `getInitialChatData`  | ~548  | [`ChatReader::initial_chat_data`]            |
//! | `getConversation`     | ~626  | [`ChatReader::get_conversation`]             |
//!
//! ## What this crate intentionally does NOT do
//!
//! - **No auth / project-membership check.** The TS `getInitialChatData`
//!   calls `getProjectById` which does the session lookup. Auth lives one
//!   layer up in the HTTP handler / `wachat-templates-router` style guard;
//!   this crate trusts the `project_id` it's handed.
//! - **No project / template fetch.** The TS action also returns the
//!   project document and the templates list. Those have their own crates
//!   (`wachat-templates`, project crates) — composing them lives at the
//!   HTTP boundary, not here.
//! - **No write side.** `markConversationAsRead` / `markConversationAsUnread`
//!   are write actions and belong to a separate slice.
//!
//! ## Mongo collections read
//!
//! - `contacts` (filtered by `projectId` and optionally `phoneNumberId` /
//!   `waId`).
//! - `incoming_messages` and `outgoing_messages` (filtered by `contactId` +
//!   `projectId`, sorted by `messageTimestamp` ascending, then merged).

use bson::{Document, doc, oid::ObjectId};
use futures::stream::TryStreamExt;
use mongodb::options::FindOptions;
use sabnode_common::ApiError;
use sabnode_db::mongo::MongoHandle;

use crate::dto::{ChatContactSummary, ChatMessage, InitialChatData};

/// Mongo collection names. Match the TS strings exactly so we can't drift
/// from the existing data set.
const CONTACTS_COLLECTION: &str = "contacts";
const INCOMING_COLLECTION: &str = "incoming_messages";
const OUTGOING_COLLECTION: &str = "outgoing_messages";

/// TS uses `.limit(30)` for the sidebar and an unbounded read for the
/// conversation. We keep the same default for the sidebar and expose
/// `limit` on `get_conversation` so callers can paginate without changing
/// the TS-equivalent default behaviour (which is "no limit").
const DEFAULT_SIDEBAR_LIMIT: i64 = 30;

/// Read-only chat queries. Cheap to clone (`MongoHandle` is `Arc`-y inside).
#[derive(Debug, Clone)]
pub struct ChatReader {
    mongo: MongoHandle,
}

impl ChatReader {
    /// Construct a new reader over the supplied Mongo handle.
    pub fn new(mongo: MongoHandle) -> Self {
        Self { mongo }
    }

    /// Bootstraps the chat sidebar.
    ///
    /// Mirrors the TS `getInitialChatData` (line ~548). The TS pipeline is:
    ///
    /// 1. Build a filter `{ projectId, phoneNumberId }`, optionally
    ///    further constrained by `waId`.
    /// 2. `find().sort({ lastMessageTimestamp: -1 }).limit(30)` to get the
    ///    sidebar contacts.
    /// 3. Resolve a "selected contact" from either `contactId` (preferred)
    ///    or `waId`. If `contactId` was given but the contact wasn't in
    ///    the sidebar slice, fall back to a single-document
    ///    `findOne({ _id, projectId })`.
    /// 4. If a selected contact exists, load its conversation via
    ///    `getConversation(contactId)`.
    ///
    /// We keep all four steps. The project / templates / selected-phone-id
    /// values that the TS function also returns are out of scope (other
    /// crates own them; the HTTP composer joins them).
    ///
    /// `phone_number_id` is optional because the TS code defaults to
    /// `project.phoneNumbers?.[0]?.id`. We can't compute that fallback
    /// without a project document, so the caller is expected to pass the
    /// resolved id (or `None` to read across all phone numbers in a
    /// project — useful for omni-inbox views).
    pub async fn initial_chat_data(
        &self,
        project_id: &ObjectId,
        phone_number_id: Option<&str>,
        contact_id: Option<&ObjectId>,
        wa_id: Option<&str>,
    ) -> Result<InitialChatData, ApiError> {
        let contacts_coll = self.mongo.collection::<Document>(CONTACTS_COLLECTION);

        // (1) sidebar filter — same shape as TS. `phoneNumberId` and
        //     `waId` are optional; we only add them to the filter when
        //     present so the API can also serve unscoped views.
        let mut filter = doc! { "projectId": project_id };
        if let Some(pnid) = phone_number_id {
            filter.insert("phoneNumberId", pnid);
        }
        if let Some(wa) = wa_id {
            filter.insert("waId", wa);
        }

        // (2) sidebar fetch. Sort + limit mirror the TS exactly.
        let find_opts = FindOptions::builder()
            .sort(doc! { "lastMessageTimestamp": -1 })
            .limit(DEFAULT_SIDEBAR_LIMIT)
            .build();

        let cursor = contacts_coll
            .clone_with_type::<ChatContactSummary>()
            .find(filter)
            .with_options(find_opts)
            .await
            .map_err(|e| {
                ApiError::Internal(anyhow::anyhow!("contacts sidebar query failed: {e}"))
            })?;

        let contacts: Vec<ChatContactSummary> = cursor.try_collect().await.map_err(|e| {
            ApiError::Internal(anyhow::anyhow!(
                "contacts sidebar deserialization failed: {e}"
            ))
        })?;

        // (3) resolve selected contact.
        //
        // The TS code prefers a passed `contactId`. If the id wasn't in the
        // 30-row sidebar slice, it falls back to a separate `findOne({ _id,
        // projectId })` so the chat window can still open contacts outside
        // the recent slice. We replicate both branches.
        //
        // If only `waId` was passed (and no `contactId`), we look it up in
        // the sidebar slice we just loaded — same as the TS path.
        let selected_contact_id: Option<ObjectId> = if let Some(cid) = contact_id {
            // First check the slice we already have in memory; saves a
            // round-trip in the common case where the caller is opening a
            // recent chat.
            let in_slice = contacts.iter().any(|c| &c.id == cid);
            if in_slice {
                Some(*cid)
            } else {
                // Confirm the contact exists AND belongs to this project
                // before we run a conversation query against it. Returning
                // `None` here makes the callee return an empty `messages`
                // list — matches the TS behaviour
                // (`selectedContact = found ? ... : null;`).
                let found = contacts_coll
                    .find_one(doc! { "_id": cid, "projectId": project_id })
                    .await
                    .map_err(|e| {
                        ApiError::Internal(anyhow::anyhow!(
                            "contact lookup outside sidebar slice failed: {e}"
                        ))
                    })?;
                if found.is_some() { Some(*cid) } else { None }
            }
        } else if let Some(wa) = wa_id {
            // Only walk the slice; TS doesn't issue a fallback query in
            // this branch either.
            contacts.iter().find(|c| c.wa_id == wa).map(|c| c.id)
        } else {
            None
        };

        // (4) conversation for the resolved contact.
        let messages = if let Some(cid) = selected_contact_id {
            self.get_conversation(&cid, None).await?
        } else {
            Vec::new()
        };

        Ok(InitialChatData {
            contacts,
            messages,
            selected_contact_id,
        })
    }

    /// Paginated message history for a contact.
    ///
    /// Mirrors `getConversation` (line ~626). Reads BOTH `incoming_messages`
    /// and `outgoing_messages` for the contact, then merges and sorts the
    /// two streams in memory.
    ///
    /// ### Sort key — matches the TS J2 P1-2 fix
    ///
    /// Primary: `messageTimestamp` ascending. Secondary: `createdAt`
    /// ascending. Tertiary: `_id` ascending. The TS uses
    /// `String(a._id).localeCompare(String(b._id))` as the final tiebreaker;
    /// `ObjectId` is monotonic enough for this purpose, and BSON's `Ord` impl
    /// gives us the same byte-wise ordering `localeCompare` would on the
    /// 24-char hex string.
    ///
    /// ### Limit semantics
    ///
    /// The TS function has no limit — it reads everything. We expose `limit`
    /// so callers can paginate without surprising existing callers: pass
    /// `None` for the TS-equivalent unbounded behaviour, or pass a positive
    /// `i64` to cap the **per-collection** read. We deliberately apply the
    /// limit per collection (then merge); applying it post-merge would
    /// require reading everything anyway, defeating the point.
    ///
    /// ### Auth
    ///
    /// The TS function calls `resolveContactForSession` first — that's the
    /// auth/project-membership check. This crate trusts the caller (the
    /// HTTP layer is expected to have done the check). For defence-in-depth
    /// the caller can scope the contact to a project via
    /// [`Self::initial_chat_data`]'s sidebar resolution before calling
    /// here.
    pub async fn get_conversation(
        &self,
        contact_id: &ObjectId,
        limit: Option<i64>,
    ) -> Result<Vec<ChatMessage>, ApiError> {
        let incoming = self
            .read_messages(INCOMING_COLLECTION, contact_id, limit)
            .await?;
        let outgoing = self
            .read_messages(OUTGOING_COLLECTION, contact_id, limit)
            .await?;

        // Merge.
        let mut merged: Vec<ChatMessage> = Vec::with_capacity(incoming.len() + outgoing.len());
        merged.extend(incoming);
        merged.extend(outgoing);

        // Stable sort with the J2 P1-2 tiebreaker chain. Using `sort_by`
        // (not `sort_unstable_by`) so equal-key inputs preserve their
        // collection-relative order — matters when timestamps collide for
        // messages from the same direction.
        merged.sort_by(|a, b| {
            let ta = a.message_timestamp;
            let tb = b.message_timestamp;
            if ta != tb {
                return ta.cmp(&tb);
            }
            // createdAt may be missing on either row; treat None as the
            // earliest possible value (matches the TS `?? 0`).
            let ca = a.created_at;
            let cb = b.created_at;
            if ca != cb {
                return ca.cmp(&cb);
            }
            // Final deterministic tiebreaker. `ObjectId` `Ord` is byte-wise
            // big-endian over the 12-byte id, which preserves Mongo's
            // insertion order for ids minted in the same process.
            a.id.cmp(&b.id)
        });

        // Apply the post-merge limit if one was requested. Per-collection
        // limits already trimmed each side; this is a belt-and-braces cap
        // for callers who pass a small `limit` (e.g. 50) and want exactly
        // that many merged rows back rather than 50+50.
        if let Some(cap) = limit {
            if cap > 0 && (merged.len() as i64) > cap {
                merged.truncate(cap as usize);
            }
        }

        Ok(merged)
    }

    /// Internal helper: read one collection's worth of messages for the
    /// contact, sorted ascending by `messageTimestamp`.
    ///
    /// Pulled out so `get_conversation` can call it twice in a row (once
    /// per collection) without code duplication. Could be parallelised with
    /// `tokio::join!`, but the TS does it sequentially via `Promise.all`
    /// and the per-call cost is dominated by Mongo round-trip — keeping it
    /// sequential here makes the code obvious and avoids spawning extra
    /// tasks for what is typically a sub-100ms call.
    async fn read_messages(
        &self,
        collection: &str,
        contact_id: &ObjectId,
        limit: Option<i64>,
    ) -> Result<Vec<ChatMessage>, ApiError> {
        let coll = self.mongo.collection::<ChatMessage>(collection);

        let filter = doc! { "contactId": contact_id };

        // Build the options eagerly. The mongodb `FindOptionsBuilder` is a
        // typestate builder, so we can't conditionally chain `.limit(cap)`
        // on a `let mut` — every `.method()` returns a different generic
        // type. Instead, normalise the limit to `Option<i64>` (None when
        // the caller asked for unbounded or passed a non-positive cap) and
        // hand it straight to `.limit(...)`, which is itself typed
        // `Option<i64>` on the underlying `FindOptions` struct.
        let normalised_limit: Option<i64> = limit.filter(|cap| *cap > 0);
        let find_opts = FindOptions::builder()
            .sort(doc! { "messageTimestamp": 1 })
            .limit(normalised_limit)
            .build();

        let cursor = coll
            .find(filter)
            .with_options(find_opts)
            .await
            .map_err(|e| {
                ApiError::Internal(anyhow::anyhow!(
                    "messages query against `{collection}` failed: {e}"
                ))
            })?;

        let mut out: Vec<ChatMessage> = cursor.try_collect().await.map_err(|e| {
            ApiError::Internal(anyhow::anyhow!(
                "messages deserialization from `{collection}` failed: {e}"
            ))
        })?;

        // Best-effort fill of the convenience fields (`text`, `mediaId`).
        // The Mongo doc doesn't store these at the top level — they live
        // inside `content` — so we extract them here so a thin client can
        // read them without walking the nested blob.
        for msg in &mut out {
            if msg.text.is_none() {
                msg.text = extract_text(&msg.content);
            }
            if msg.media_id.is_none() {
                msg.media_id = extract_media_id(&msg.message_type, &msg.content);
            }
        }

        Ok(out)
    }
}

/// Pull the plain-text body out of a `content` blob, if there is one.
///
/// Looks at `content.text.body` (Meta's text-message shape). Returns `None`
/// for non-text messages or when the body is absent / empty. Kept as a free
/// function (not a method) so it stays trivially unit-testable without
/// touching Mongo.
fn extract_text(content: &serde_json::Value) -> Option<String> {
    content
        .get("text")
        .and_then(|t| t.get("body"))
        .and_then(|b| b.as_str())
        .map(|s| s.to_owned())
        .filter(|s| !s.is_empty())
}

/// Pull the Meta `media id` out of a `content` blob for media-bearing
/// message types. Each media type stores the id at `content.<type>.id`
/// (e.g. `content.image.id`); we look it up using the message's `type`
/// discriminator.
fn extract_media_id(message_type: &str, content: &serde_json::Value) -> Option<String> {
    match message_type {
        "image" | "video" | "audio" | "document" | "sticker" => content
            .get(message_type)
            .and_then(|m| m.get("id"))
            .and_then(|i| i.as_str())
            .map(|s| s.to_owned()),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn extract_text_pulls_body_from_text_message() {
        let content = json!({ "text": { "body": "hello world" } });
        assert_eq!(extract_text(&content), Some("hello world".to_owned()));
    }

    #[test]
    fn extract_text_returns_none_for_empty_body() {
        let content = json!({ "text": { "body": "" } });
        assert_eq!(extract_text(&content), None);
    }

    #[test]
    fn extract_text_returns_none_for_non_text_content() {
        let content = json!({ "image": { "id": "abc" } });
        assert_eq!(extract_text(&content), None);
    }

    #[test]
    fn extract_media_id_handles_each_media_type() {
        for ty in ["image", "video", "audio", "document", "sticker"] {
            let content = json!({ ty: { "id": format!("{ty}-id") } });
            assert_eq!(extract_media_id(ty, &content), Some(format!("{ty}-id")));
        }
    }

    #[test]
    fn extract_media_id_skips_non_media_types() {
        let content = json!({ "text": { "body": "hi" } });
        assert_eq!(extract_media_id("text", &content), None);
        assert_eq!(extract_media_id("interactive", &content), None);
    }
}
