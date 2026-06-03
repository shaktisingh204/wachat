//! # sabcrm-settings
//!
//! Axum router for **SabCRM**'s free-form per-project workspace settings over
//! the MongoDB `sabcrm_settings` collection. Mounted under
//! `/v1/sabcrm/settings` from the orchestrating `api` crate:
//!
//! ```ignore
//! .nest("/v1/sabcrm/settings", sabcrm_settings::router::<AppState>())
//! ```
//!
//! ## Scope
//!
//! | HTTP route   | Purpose                                       |
//! |--------------|-----------------------------------------------|
//! | `GET    /`   | read the project's settings `data` (or `{}`)  |
//! | `PUT    /`   | merge-upsert keys into the project's `data`    |
//!
//! There is exactly **one** document per project, keyed by a unique
//! `projectId`:
//!
//! ```text
//! { _id, projectId (unique), data: { ...free-form }, updatedAt }
//! ```
//!
//! ## Tenancy
//!
//! Every read and write is scoped by `{ projectId }`. The
//! [`AuthUser`](sabnode_auth::AuthUser) extractor is required on every
//! endpoint so the surface is never anonymously open.

pub mod dto;
pub mod handlers;
pub mod router;

pub use router::router;
