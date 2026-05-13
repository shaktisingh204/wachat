//! # crm-pipelines
//!
//! HTTP surface for the embedded **Pipeline + Stage** entity. Unlike most
//! CRM crates (which target their own Mongo collection), pipelines live as a
//! sub-array on the tenant root user document:
//!
//! ```text
//! users.{ _id }
//!   ├─ crmPipelines: [
//!   │    { _id, name, color?, isDefault?, stages: [
//!   │        { _id, name, color?, order?, chance? }
//!   │    ] }
//!   │ ]
//! ```
//!
//! All mutations therefore go through Mongo array-update operators
//! (`$push`, `$pull`, positional filters via `arrayFilters`) against the
//! `users` collection — never an `update_one` on a pipeline document.
//!
//! ## Schema parity with TS
//!
//! Mirrors `CrmPipeline` / `CrmPipelineStage` in `src/lib/definitions.ts`,
//! plus the optional `color` / `isDefault` / `order` extensions referenced
//! by newer CRM UIs. The legacy `id: string` (uuid) field on stage docs is
//! preserved via a `legacy_id` round-trip so existing tenants whose data
//! pre-dates the ObjectId-addressable rewrite keep functioning.
//!
//! ## Audit
//!
//! Every mutation writes `entityKind: "pipeline"`. Stage-level edits also
//! key on the parent pipeline's `_id` — stages are not independently
//! audited per the spec.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
