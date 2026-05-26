//! # sabrequests-instances
//!
//! Open / closed Request Instance documents — the *live* approval
//! workflows spawned from a [Blueprint](../sabrequests_blueprints/index.html).
//!
//! Each instance carries:
//! - `blueprintId` — the template it was spawned from.
//! - `requesterId` — who submitted it (the calling user, almost always).
//! - `formData` — the submitted field values (opaque JSON, validated
//!   against the blueprint's `formSchema` at the UI layer).
//! - `currentStageIdx` — pointer into the blueprint's `stages[]`.
//! - `status` — `pending | approved | rejected | cancelled`.
//! - `slaDeadlineAt` — wall-clock deadline for the current stage (set
//!   from `stages[currentStageIdx].slaMins`). `breachedAt` is stamped
//!   by the sweep job when the deadline passes.
//!
//! Backing collection: `requests_instances`. Flattens `Identity` /
//! `Audit` / `Assignment` from `crm-core`.
//!
//! Stage actions (approve / reject / reassign / comment) are recorded
//! in the sibling crate [`sabrequests-stage-actions`] (append-only log) and
//! the handler here updates `currentStageIdx` + `status` accordingly.

pub mod dto;
pub mod handlers;
pub mod router;

pub use router::router;
