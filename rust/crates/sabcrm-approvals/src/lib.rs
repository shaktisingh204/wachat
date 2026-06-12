//! # sabcrm-approvals
//!
//! Axum router for **SabCRM**'s stage-approvals surface over the MongoDB
//! `sabcrm_approvals` collection. Mounted under `/v1/sabcrm/approvals`
//! from the orchestrating `api` crate:
//!
//! ```ignore
//! .nest("/v1/sabcrm/approvals", sabcrm_approvals::router::<AppState>())
//! ```
//!
//! ## Scope
//!
//! | TS action                    | HTTP route               |
//! |------------------------------|--------------------------|
//! | `listSabcrmApprovals`        | `GET  /`                 |
//! | `requestSabcrmStageApproval` | `POST /`                 |
//! | `decideSabcrmApproval`       | `POST /{id}/approve`     |
//! | `decideSabcrmApproval`       | `POST /{id}/reject`      |
//!
//! An approval request is raised when a record tries to enter a pipeline
//! stage declared with `requiresApproval: true` (a stage **entry gate** —
//! see the `sabcrm-pipelines` crate's `StageGovernance`). The document:
//!
//! ```text
//! { _id, projectId, objectSlug, recordId, pipelineId,
//!   fromStageId?, toStageId, requestedBy, reason?,
//!   status: "pending" | "approved" | "rejected",
//!   decidedBy?, decidedAt?, note?, createdAt, updatedAt }
//! ```
//!
//! Creating a request while an identical one (same record → same target
//! stage) is still `pending` returns the existing request instead of
//! duplicating it. Deciding is one-shot: approve / reject only transition
//! documents whose `status` is still `pending` (`404` otherwise).
//!
//! ## Tenancy
//!
//! Every Mongo filter leads with `{ projectId: <string> }`. The
//! [`AuthUser`](sabnode_auth::AuthUser) extractor is required on every
//! endpoint so the surface is never anonymously open; the caller's
//! `user_id` is captured as `requestedBy` / `decidedBy`.

pub mod dto;
pub mod handlers;
pub mod router;

pub use router::router;
