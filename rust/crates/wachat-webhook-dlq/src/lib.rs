//! # wachat-webhook-dlq
//!
//! Dead-letter queue for failed Meta webhook events.
//!
//! ## What it does
//!
//! [`DlqWriter`] is the single entry point. Two methods, both invoked from the
//! Rust webhook receiver after it has already 200'd to Meta:
//!
//!   * [`DlqWriter::send_to_dlq`] — durable record + Redis enqueue for events
//!     that the inline processor failed to handle. The Mongo write captures
//!     the full payload + reason for an audit trail; the BullMQ enqueue is the
//!     safety-net signal a future Rust DLQ consumer (Phase 2 follow-up) will
//!     pick up to replay.
//!   * [`DlqWriter::record_processed`] — write-only audit log for events that
//!     succeeded. Mirrors what the legacy `src/app/api/webhooks/meta/route.ts`
//!     route does today (`db.collection('webhook_logs').insertOne({ payload,
//!     projectId, processed: true, createdAt })`) so the existing Next.js
//!     admin UI keeps working unchanged.
//!
//! ## Mongo collection
//!
//! Both methods write to **`webhook_logs`** — the same collection the TS
//! `getWebhookLogs` action reads from (see
//! `src/app/actions/webhook.actions.ts`). We mirror the TS field set
//! (`payload`, `projectId`, `processed`, `createdAt`, optional `error`) and
//! add `field`, `reason`, `status`, `receivedAt`, `attemptedAt` per the
//! Phase 2 slice contract — the TS reader only projects what it knows about,
//! so the additions are forward-compatible.
//!
//! ## BullMQ queue
//!
//! Failed entries are also enqueued to the **`wachat-webhook-dlq`** queue
//! (key prefix `bull:wachat-webhook-dlq:…`). The job payload carries
//! `{ logId, field, projectId }` — small enough to dedupe on `logId`, large
//! enough that a Rust consumer can refetch the full payload from Mongo by
//! `_id` when it replays.
//!
//! ## Failure model
//!
//! `send_to_dlq` is best-effort on the **Mongo write** but strict on the
//! **Redis enqueue**. Rationale: the Mongo doc is for humans (the admin UI's
//! "Webhook Logs" view); losing one is unfortunate but does not lose work.
//! Losing the Redis enqueue would mean the failed webhook is silently
//! forgotten — that's the bug we're paid to prevent. So a Mongo failure logs
//! a warning and falls through; a Redis failure bubbles up as `ApiError`.

pub mod error;
pub mod writer;

// Re-export the public surface so callers can `use wachat_webhook_dlq::{...}`
// without subpath imports.
pub use writer::{DlqId, DlqWriter, WEBHOOK_LOGS_COLLECTION, WEBHOOK_DLQ_QUEUE};
