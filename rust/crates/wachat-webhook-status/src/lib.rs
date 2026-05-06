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
//!
//! ## Phase 9 — broadcast counter migration
//!
//! Originally this crate explicitly *avoided* the broadcast-counter side
//! effects (the `broadcast_contacts` row updates and the `broadcasts.$inc`
//! deliveredCount/readCount roll). Phase 9 of the broadcast-worker port
//! moves those writes off the Node webhook receiver and onto a Rust HTTP
//! endpoint that the Node receiver calls during webhook processing. The
//! migration lives in:
//!
//! - [`broadcast`] — `BroadcastCounterProcessor` (the Mongo writer).
//! - [`handlers`] — `broadcast_statuses` (the axum handler).
//! - [`router`] — `router()` (mounts at `/v1/wachat/webhook-status`).
//! - [`state`] — `WachatWebhookStatusState` (the per-app state slice).
//!
//! The legacy [`StatusProcessor`] library entry point is unchanged and
//! still drives the `outgoing_messages` write that the Node receiver does
//! today.
//!
//! Public API (consumed by the receiver crate):
//! ```ignore
//! use wachat_webhook_status::{StatusProcessor, StatusOutcome};
//!
//! let proc = StatusProcessor::new(mongo);
//! let outcome: StatusOutcome = proc.process(&project, &change_value).await?;
//! ```

pub mod broadcast;
pub mod error;
pub mod handlers;
pub mod mapping;
pub mod processor;
pub mod router;
pub mod state;

pub use broadcast::{BroadcastCounterProcessor, BroadcastStatusOutcome, StatusInput};
pub use handlers::{BroadcastStatusesBody, BroadcastStatusesResponse};
pub use mapping::{VALID_STATUS_TRANSITIONS, meta_status_to_domain};
pub use processor::{StatusOutcome, StatusProcessor};
pub use router::router;
pub use state::WachatWebhookStatusState;
