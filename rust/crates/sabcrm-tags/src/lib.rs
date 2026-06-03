//! # sabcrm-tags
//!
//! Axum router for **SabCRM**'s tags surface over the MongoDB
//! `sabcrm_tags` collection. Mounted under `/v1/sabcrm/tags` from the
//! orchestrating `api` crate:
//!
//! ```ignore
//! .nest("/v1/sabcrm/tags", sabcrm_tags::router::<AppState>())
//! ```
//!
//! ## Scope
//!
//! | Action        | HTTP route        |
//! |---------------|-------------------|
//! | list          | `GET    /`        |
//! | create        | `POST   /`        |
//! | update        | `PATCH  /{id}`    |
//! | delete        | `DELETE /{id}`    |
//!
//! A tag is a workspace-level label definition (`name`, `color`) within a
//! project. The persisted document is
//! `{ _id, projectId, name, color, createdAt }`. A per-project unique
//! `name` is enforced: a `create` (or rename) onto an existing name fails
//! with `409 Conflict`.
//!
//! ## Tenancy
//!
//! Every Mongo filter leads with `{ projectId }`. The
//! [`AuthUser`](sabnode_auth::AuthUser) extractor is required on every
//! endpoint so the surface is never anonymously open.

pub mod dto;
pub mod handlers;
pub mod router;

pub use router::router;
