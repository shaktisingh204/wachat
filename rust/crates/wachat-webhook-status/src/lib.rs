//! # wachat-webhook-status
//!
//! Process Meta webhook **status updates** (the `change.value.statuses[]`
//! payload) into MongoDB updates on the `outgoing_messages` collection.
//!
//! **Source of truth**: `src/lib/webhook-processor.ts`
//! (`processStatusUpdateBatch`, line ~1725) and the dispatch in
//! `src/app/api/webhooks/meta/route.ts` (line ~152). The TS uses
//! `bulkWrite` with one `updateOne` op per status, keyed on `{ wamid }`,
//! and `$set`s `status`, `statusTimestamps.<status>` and (on `failed`)
//! the error fields. We mirror those **exact field names** so a Rust
//! and a Node worker can update the same documents safely.
//!
//! Differences from TS — intentional:
//! - **No `bulk_write`** in this slice (the receiver crate may batch; this
//!   crate keeps `update_one` per status for clarity and idempotency).
//! - **Conditional filter** on the previous status to make `read → read`
//!   (and other backwards transitions) a no-op without an extra round-trip.
//! - **No broadcast / broadcast_contacts updates** — those live in a
//!   separate slice (`wachat-broadcast-status`).
//!
//! Public API (consumed by the receiver crate):
//! ```ignore
//! use wachat_webhook_status::{StatusProcessor, StatusOutcome};
//!
//! let proc = StatusProcessor::new(mongo);
//! let outcome: StatusOutcome = proc.process(&project, &change_value).await?;
//! ```

pub mod error;
pub mod mapping;
pub mod processor;

pub use mapping::{VALID_STATUS_TRANSITIONS, meta_status_to_domain};
pub use processor::{StatusOutcome, StatusProcessor};
