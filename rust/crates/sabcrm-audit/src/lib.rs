//! # sabcrm-audit
//!
//! Axum router for **SabCRM**'s audit / change-log surface over the MongoDB
//! `sabcrm_audit` collection. Mounted under `/v1/sabcrm/audit` from the
//! orchestrating `api` crate:
//!
//! ```ignore
//! .nest("/v1/sabcrm/audit", sabcrm_audit::router::<AppState>())
//! ```
//!
//! ## Scope
//!
//! | Operation     | HTTP route   |
//! |---------------|--------------|
//! | list entries  | `GET    /`   |
//! | append entry  | `POST   /`   |
//!
//! An audit entry records an `action` (`create` / `update` / `delete` / …)
//! performed against an optional `object` + `recordId` within a project,
//! with an optional human `summary` and structured `meta`. The acting
//! `actorId` is the caller and the `createdAt` is server-set.
//!
//! ## Tenancy
//!
//! Every Mongo filter leads with `{ projectId }`. The `actorId` comes from
//! the [`AuthUser`](sabnode_auth::AuthUser) extractor (the caller), **not** a
//! request body. The extractor is required on every endpoint so the surface
//! is never anonymously open.

pub mod dto;
pub mod handlers;
pub mod router;

pub use router::router;
