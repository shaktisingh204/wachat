//! # sabcrm-workflow-runs
//!
//! Axum router for **SabCRM**'s workflow-run surface over the MongoDB
//! `sabcrm_workflow_runs` collection. Mounted under
//! `/v1/sabcrm/workflow-runs` from the orchestrating `api` crate:
//!
//! ```ignore
//! .nest("/v1/sabcrm/workflow-runs", sabcrm_workflow_runs::router::<AppState>())
//! ```
//!
//! ## Scope
//!
//! A workflow run is a durable record of ONE execution of a workflow:
//! its `status` (`running` | `success` | `failed`), the `trigger` that
//! started it, `startedAt` / `finishedAt` timing, and an ordered `steps`
//! array (`{ id, type, status, output?, error? }`) capturing per-step
//! progress.
//!
//! | Action       | HTTP route        |
//! |--------------|-------------------|
//! | list (newest)| `GET    /`        |
//! | get one      | `GET    /{id}`    |
//! | create       | `POST   /`        |
//! | update       | `PATCH  /{id}`    |
//!
//! ## Tenancy
//!
//! Every Mongo filter leads with `{ projectId: <string> }`. The
//! [`AuthUser`](sabnode_auth::AuthUser) extractor is required on every
//! endpoint so the surface is never anonymously open, but the caller's
//! user id is not part of the filter.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod status;

pub use router::router;
