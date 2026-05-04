//! `wachat-webhook-account` — Phase 2 slice 4 of the wachat → Rust port.
//!
//! Processes **account-level** Meta WhatsApp webhook `change.field` values:
//! `account_alerts`, `account_update`, `account_review_update`,
//! `business_capability_update`, `phone_number_quality_update`,
//! `phone_number_name_update`, `security`.
//!
//! ## What the TS does today
//!
//! `src/lib/webhook-processor.ts` (the `sendNotification` switch around
//! line 1572) handles each of these fields by:
//! - mutating one or two flat fields on the matching `projects` document
//!   (`reviewStatus`, `banState`, `violationType`, `phoneNumbers.$.quality_rating`,
//!   etc.), and
//! - inserting a row into `notifications` so the dashboard surfaces the event.
//!
//! There is **no audit collection** — quality-rating history, alerts, security
//! events are all overwritten on the project doc and only persisted as
//! human-readable strings in `notifications`. That works for the dashboard but
//! is hostile to debugging and replay.
//!
//! ## What this crate does
//!
//! Mirrors the TS project mutations **and** appends every event to a new
//! `account_events` collection so we have a real audit trail for the Rust
//! port. Schema: `{ projectId, field, value, receivedAt }`. The TS can adopt
//! this collection later — until then it's Rust-only and additive.
//!
//! ## Public API
//!
//! ```ignore
//! use wachat_webhook_account::AccountProcessor;
//!
//! let processor = AccountProcessor::new(mongo);
//! let outcome = processor.process(&project, &change.value, &change.field).await?;
//! ```
//!
//! Returns [`AccountOutcome`] describing whether the audit row was written
//! and whether the project document was mutated.

pub mod error;
pub mod processor;

pub use processor::{AccountOutcome, AccountProcessor, build_project_update};
