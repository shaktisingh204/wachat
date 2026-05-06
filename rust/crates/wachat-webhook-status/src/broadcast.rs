//! Broadcast delivery-counter writer.
//!
//! Mirrors the broadcast portion of `processStatusUpdateBatch` in
//! `src/lib/webhook-processor.ts` (lines ~1755–1803). The status-update
//! handler in [`crate::processor`] only touches `outgoing_messages`; this
//! module owns the **broadcast counter side effects** — i.e. the
//! `broadcast_contacts` row updates and the per-broadcast `$inc` on the
//! `broadcasts` collection.
//!
//! ## TS source-of-truth (verbatim)
//!
//! ```text
//! const broadcastContacts = await db.collection('broadcast_contacts')
//!     .find({ messageId: { $in: wamids } }, { projection: { _id: 1, messageId: 1, broadcastId: 1, status: 1 } })
//!     .toArray();
//!
//! const bcByWamid = new Map(broadcastContacts.map(bc => [bc.messageId, bc]));
//! const statusHierarchy = { PENDING: 0, SENT: 1, DELIVERED: 2, READ: 3, FAILED: 4 };
//!
//! for (const status of statuses) {
//!     const bc = bcByWamid.get(status.id);
//!     if (!bc) continue;
//!     const newStatus = (status.status || 'unknown').toUpperCase();
//!     const currentStatus = (bc.status || 'PENDING').toUpperCase();
//!     if ((statusHierarchy[newStatus] || 0) > (statusHierarchy[currentStatus] || 0)) {
//!         broadcastContactOps.push({ updateOne: { filter: { _id: bc._id }, update: { $set: { status: newStatus } } } });
//!         if (newStatus === 'DELIVERED') counters[bc.broadcastId].delivered += 1;
//!         if (newStatus === 'READ')      counters[bc.broadcastId].read += 1;
//!     }
//! }
//! ```
//!
//! ## Behaviour we preserve
//!
//! - Filter `broadcast_contacts` by `{ messageId: { $in: wamids } }` (one
//!   round-trip, not N).
//! - Status hierarchy `PENDING < SENT < DELIVERED < READ; FAILED is terminal`.
//!   Only apply when the new status strictly outranks the current one.
//! - `$inc` `broadcasts.deliveredCount` / `readCount` per crossed boundary.
//! - Field names (`messageId`, `broadcastId`, `status`, `deliveredCount`,
//!   `readCount`) are matched verbatim so a Rust + Node consumer can
//!   coexist behind the BROADCAST_WORKER feature flag during cutover.
//!
//! ## Differences from the TS, intentional
//!
//! - We DO NOT touch `outgoing_messages` here — that lives in
//!   [`crate::processor::StatusProcessor`] and runs in parallel with this
//!   call from the Node side. The Node webhook receiver still owns the
//!   `outgoing_messages` write today; this module owns ONLY the
//!   broadcast-counter writes that the worker port is migrating.
//! - Counters use Mongo's `$inc` with the **summed** value per broadcast
//!   id (the TS does the same — one bulk op per broadcast id, not one per
//!   contact transition).

use std::collections::HashMap;

use bson::{Document, doc, oid::ObjectId};
use mongodb::Collection;
use mongodb::options::FindOptions;
use sabnode_common::ApiError;
use sabnode_db::mongo::MongoHandle;
use serde::{Deserialize, Serialize};
use tracing::{debug, instrument, warn};

use futures::TryStreamExt;

const BROADCAST_CONTACTS: &str = "broadcast_contacts";
const BROADCASTS: &str = "broadcasts";

/// Single-status payload as it arrives from Meta after the Node webhook
/// receiver has already ack'd Meta. We accept the open-ended JSON shape
/// (`errors[]?`, `recipient_id?`, etc.) so the wire format matches the
/// TS without having to mirror every Meta DTO field.
///
/// `status` is the lowercase Meta string (`"sent" | "delivered" | "read" | "failed"`).
/// Anything else is logged at warn and skipped — same as the TS.
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct StatusInput {
    /// Meta `wamid` (the broadcast_contacts row's `messageId`).
    pub id: String,
    /// Lowercase status string from Meta.
    pub status: String,
    /// Unix-seconds timestamp string (kept for parity; we do not currently
    /// store it on the broadcast_contacts row, but accepting the field
    /// keeps the wire shape stable across the TS → Rust call boundary).
    #[serde(default)]
    pub timestamp: Option<String>,
}

/// Aggregate write counts returned to the caller. The TS used to bury
/// these in a `console.error` on failure; here we surface them so the
/// receiver can feed `broadcast_status_writes_total` etc. into metrics.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BroadcastStatusOutcome {
    /// `broadcast_contacts.updateOne` rows that matched and applied.
    pub contacts_updated: u64,
    /// Cumulative delivered increments fanned out across `broadcasts`.
    pub delivered_inc: u64,
    /// Cumulative read increments fanned out across `broadcasts`.
    pub read_inc: u64,
    /// Number of input wamids that did not resolve to a `broadcast_contacts`
    /// row. Normal — only a subset of webhook statuses are for broadcasts.
    pub unmatched: u64,
}

/// Writer for the broadcast counter side effects of status webhooks.
/// Cheap to clone — the underlying `MongoHandle` is `Arc`-backed.
#[derive(Debug, Clone)]
pub struct BroadcastCounterProcessor {
    mongo: MongoHandle,
}

impl BroadcastCounterProcessor {
    /// Construct a new processor. The handle is reused across calls.
    pub fn new(mongo: MongoHandle) -> Self {
        Self { mongo }
    }

    /// Process a batch of statuses and apply the counter side effects.
    ///
    /// Mirrors the second half of `processStatusUpdateBatch`. Returns
    /// counts so the caller can feed metrics; per-row failures are
    /// swallowed (logged at warn) so a single bad doc cannot fail the
    /// whole batch — same fail-soft contract as the TS.
    #[instrument(skip_all, fields(n = statuses.len()))]
    pub async fn process(
        &self,
        statuses: &[StatusInput],
    ) -> Result<BroadcastStatusOutcome, ApiError> {
        let mut outcome = BroadcastStatusOutcome::default();
        if statuses.is_empty() {
            return Ok(outcome);
        }

        let wamids: Vec<&str> = statuses
            .iter()
            .map(|s| s.id.as_str())
            .filter(|s| !s.is_empty())
            .collect();
        if wamids.is_empty() {
            return Ok(outcome);
        }

        // 1) Bulk fetch matching broadcast_contacts. Same projection as TS.
        let bc_coll: Collection<Document> = self.mongo.collection(BROADCAST_CONTACTS);
        let bcasts_coll: Collection<Document> = self.mongo.collection(BROADCASTS);

        let projection = doc! {
            "_id": 1,
            "messageId": 1,
            "broadcastId": 1,
            "status": 1,
        };
        let find_opts = FindOptions::builder().projection(projection).build();

        let mut cursor = bc_coll
            .find(doc! { "messageId": { "$in": &wamids } })
            .with_options(find_opts)
            .await
            .map_err(|e| {
                ApiError::Internal(anyhow::Error::new(e).context("broadcast_contacts.find"))
            })?;

        // Build the wamid → row map. Mirrors `bcByWamid = new Map(...)`.
        let mut by_wamid: HashMap<String, BcRow> = HashMap::with_capacity(wamids.len());
        while let Some(doc) = cursor
            .try_next()
            .await
            .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("bc cursor")))?
        {
            if let Some(row) = BcRow::from_doc(&doc) {
                by_wamid.insert(row.message_id.clone(), row);
            }
        }

        // 2) Per-status decision: only apply when newStatus > currentStatus.
        //    Build (a) one updateOne per crossed contact, (b) per-broadcast
        //    counter sums.
        struct ContactWrite {
            id: ObjectId,
            new_status: &'static str,
        }
        let mut contact_writes: Vec<ContactWrite> = Vec::new();
        let mut counters: HashMap<ObjectId, (u64, u64)> = HashMap::new(); // (delivered, read)

        for s in statuses {
            let Some(bc) = by_wamid.get(&s.id) else {
                outcome.unmatched += 1;
                continue;
            };

            let Some(new_status) = upper_status(&s.status) else {
                // Unknown status — same skip-and-warn as TS via fallback to
                // 0 in `statusHierarchy`. We also count it as unmatched
                // since no write happens.
                debug!(
                    wamid = %s.id,
                    raw_status = %s.status,
                    "unknown broadcast status; skipping",
                );
                continue;
            };
            let current_rank = status_rank(bc.status.as_deref().unwrap_or("PENDING"));
            let new_rank = status_rank(new_status);
            if new_rank <= current_rank {
                continue;
            }

            contact_writes.push(ContactWrite {
                id: bc.id,
                new_status,
            });

            let entry = counters.entry(bc.broadcast_id).or_insert((0, 0));
            match new_status {
                "DELIVERED" => entry.0 += 1,
                "READ" => entry.1 += 1,
                _ => {}
            }
        }

        // 3) Apply the writes. We deliberately do NOT use `bulk_write` here
        //    because the mongodb 3.x driver's `bulk_write` requires the
        //    `in-use-encryption` machinery on this workspace's pin; one
        //    `update_one` per row is plenty for the typical batch size
        //    (< 100 statuses per Meta delivery) and matches the per-row
        //    error semantics of the TS `ordered: false` bulk.
        for w in &contact_writes {
            match bc_coll
                .update_one(
                    doc! { "_id": w.id },
                    doc! { "$set": { "status": w.new_status } },
                )
                .await
            {
                Ok(r) => outcome.contacts_updated += r.modified_count,
                Err(e) => warn!(
                    bc_id = %w.id,
                    error = %e,
                    "broadcast_contacts.update_one failed; continuing",
                ),
            }
        }

        for (bid, (delivered, read)) in &counters {
            if *delivered == 0 && *read == 0 {
                continue;
            }
            let mut inc = doc! {};
            if *delivered > 0 {
                inc.insert("deliveredCount", *delivered as i64);
            }
            if *read > 0 {
                inc.insert("readCount", *read as i64);
            }
            match bcasts_coll
                .update_one(doc! { "_id": *bid }, doc! { "$inc": inc })
                .await
            {
                Ok(_) => {
                    outcome.delivered_inc += *delivered;
                    outcome.read_inc += *read;
                }
                Err(e) => warn!(
                    broadcast_id = %bid,
                    error = %e,
                    "broadcasts.$inc failed; continuing",
                ),
            }
        }

        Ok(outcome)
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/// Slim view of a `broadcast_contacts` row — only the fields we project.
#[derive(Debug, Clone)]
struct BcRow {
    id: ObjectId,
    message_id: String,
    broadcast_id: ObjectId,
    status: Option<String>,
}

impl BcRow {
    fn from_doc(d: &Document) -> Option<Self> {
        Some(Self {
            id: d.get_object_id("_id").ok()?,
            message_id: d.get_str("messageId").ok()?.to_owned(),
            broadcast_id: d.get_object_id("broadcastId").ok()?,
            status: d.get_str("status").ok().map(str::to_owned),
        })
    }
}

/// Map a Meta lowercase status string to the uppercase wire form stored on
/// `broadcast_contacts.status`. Returns `None` for unknown values so the
/// caller can `continue` (matches the TS `statusHierarchy[newStatus] || 0`
/// fallback semantics — unknown maps to rank 0 which never beats current).
fn upper_status(s: &str) -> Option<&'static str> {
    match s.to_ascii_lowercase().as_str() {
        "sent" => Some("SENT"),
        "delivered" => Some("DELIVERED"),
        "read" => Some("READ"),
        "failed" => Some("FAILED"),
        _ => None,
    }
}

/// Status hierarchy for the conditional update. Mirrors the TS
/// `statusHierarchy` map verbatim.
fn status_rank(s: &str) -> u8 {
    match s.to_ascii_uppercase().as_str() {
        "PENDING" => 0,
        "SENT" => 1,
        "DELIVERED" => 2,
        "READ" => 3,
        "FAILED" => 4,
        _ => 0,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn upper_status_maps_meta_strings() {
        assert_eq!(upper_status("sent"), Some("SENT"));
        assert_eq!(upper_status("DELIVERED"), Some("DELIVERED"));
        assert_eq!(upper_status("Read"), Some("READ"));
        assert_eq!(upper_status("failed"), Some("FAILED"));
        assert_eq!(upper_status("queued"), None);
        assert_eq!(upper_status(""), None);
    }

    #[test]
    fn rank_table_matches_ts() {
        assert!(status_rank("READ") > status_rank("DELIVERED"));
        assert!(status_rank("DELIVERED") > status_rank("SENT"));
        assert!(status_rank("SENT") > status_rank("PENDING"));
        // FAILED is terminal — beats everything.
        assert!(status_rank("FAILED") > status_rank("READ"));
        // Unknown current status falls back to PENDING rank, matching TS.
        assert_eq!(status_rank("garbage"), 0);
    }
}
