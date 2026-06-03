//! # sabcrm-objects
//!
//! Axum router for **SabCRM**'s object-metadata surface over the existing
//! MongoDB `sabcrm_objects` collection, merged on top of the six built-in
//! standard objects from [`sabcrm_core`]. Mounted under
//! `/v1/sabcrm/objects` from the orchestrating `api` crate:
//!
//! ```ignore
//! .nest("/v1/sabcrm/objects", sabcrm_objects::router::<AppState>())
//! ```
//!
//! ## Scope
//!
//! | TS action       | HTTP route          |
//! |-----------------|---------------------|
//! | `listObjects`   | `GET    /`          |
//! | `getObject`     | `GET    /{slug}`    |
//! | `createObject`  | `POST   /`          |
//! | `updateObject`  | `PATCH  /{slug}`    |
//! | `deleteObject`  | `DELETE /{slug}`    |
//!
//! The list / get endpoints merge [`sabcrm_core::standard_objects`] with
//! the per-project persisted custom/override docs in `sabcrm_objects`.
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
