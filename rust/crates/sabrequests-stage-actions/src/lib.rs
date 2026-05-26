//! # sabrequests-stage-actions
//!
//! Append-only audit log of every stage decision taken on a Request
//! Instance. Each row records:
//!
//! - `requestId` — the [`requests_instances`] document the action
//!   applies to.
//! - `stageIdx` — which stage in the blueprint was active at the time.
//! - `actorId` — who took the action.
//! - `action` — `approve | reject | reassign | comment`.
//! - `ts` — when. (Distinct from `createdAt` so we can backfill from
//!   external systems if needed.)
//! - `note` — optional free text.
//!
//! The instance handler (`sabrequests-instances::decide_request`) writes
//! these rows; this crate exposes a **read-only** list endpoint
//! (`GET /v1/sabrequests/stage-actions?requestId=…`) for the timeline UI.
//! There is no POST surface — actions are always created via the
//! decision endpoint so the instance + log stay in sync.

pub mod dto;
pub mod handlers;
pub mod router;

pub use router::router;
