//! # wachat-webhook-template-events
//!
//! Process Meta webhook **template events** (`change.field`) into MongoDB
//! updates on the `templates` collection.
//!
//! Handles:
//! - `message_template_status_update` — APPROVED / REJECTED / PENDING /
//!   DISABLED / PAUSED / FLAGGED. Updates `status`, `rejectedReason`,
//!   `disableInfo`, `flagged`, `statusUpdatedAt`.
//! - `message_template_quality_update` — updates `qualityScore`.
//! - `message_template_components_update` — replaces `components`.
//!
//! **Source of truth**: `src/lib/webhook-processor.ts` — the
//! `message_template_status_update` and `message_template_quality_update`
//! cases (line ~1622). Components-update is not yet handled in TS; we
//! implement it here ahead of the legacy code per the phase-2 contract
//! (Meta sends it for templates that change after approval).
//!
//! Differences from TS — intentional:
//! - **Filter on `metaId`** (not `name`). Names can collide across languages
//!   inside a project; Meta's `message_template_id` is globally unique and
//!   what subsequent updates reference. The TS path is buggy here — see the
//!   comment in [`processor`].
//! - **Stub-on-miss**: if no template document matches, we insert a stub row
//!   marked `source: "webhook_only"` so the next /sync run picks it up
//!   instead of silently dropping the event.
//! - **Audit collection**: every event (known or not) is appended to
//!   `template_events` for replay / debugging. This matches the spirit of
//!   `notifications` in the TS path but is structured for analytics.
//!
//! Public API (consumed by the `wachat-webhook` dispatcher crate):
//! ```ignore
//! use wachat_webhook_template_events::{TemplateEventsProcessor, TemplateOutcome};
//!
//! let proc = TemplateEventsProcessor::new(mongo);
//! let outcome: TemplateOutcome = proc.process(&project, &change_value, "message_template_status_update").await?;
//! ```

pub mod error;
pub mod mapping;
pub mod processor;

pub use error::Result;
pub use mapping::meta_event_to_status;
pub use processor::{TemplateEventsProcessor, TemplateOutcome};
