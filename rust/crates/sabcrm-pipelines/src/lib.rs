//! # sabcrm-pipelines
//!
//! Axum router for **SabCRM**'s sales-pipelines surface over the MongoDB
//! `sabcrm_pipelines` collection. Mounted under `/v1/sabcrm/pipelines`
//! from the orchestrating `api` crate:
//!
//! ```ignore
//! .nest("/v1/sabcrm/pipelines", sabcrm_pipelines::router::<AppState>())
//! ```
//!
//! ## Scope
//!
//! | TS action          | HTTP route       |
//! |--------------------|------------------|
//! | `listPipelines`    | `GET    /`       |
//! | `getPipeline`      | `GET    /{id}`   |
//! | `createPipeline`   | `POST   /`       |
//! | `updatePipeline`   | `PATCH  /{id}`   |
//! | `deletePipeline`   | `DELETE /{id}`   |
//!
//! A pipeline is a named, per-project sales funnel targeting one `object`
//! (default `"opportunities"`) with an ordered list of stages, each
//! `{ id, label, color }`.
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

pub use router::router;
