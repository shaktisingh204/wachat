//! # sabcrm-segments
//!
//! Axum router for **SabCRM**'s saved-segments (smart lists) surface over
//! the MongoDB `sabcrm_segments` collection. Mounted under
//! `/v1/sabcrm/segments` from the orchestrating `api` crate:
//!
//! ```ignore
//! .nest("/v1/sabcrm/segments", sabcrm_segments::router::<AppState>())
//! ```
//!
//! ## Scope
//!
//! | Action            | HTTP route       |
//! |-------------------|------------------|
//! | `listSegments`    | `GET    /`       |
//! | `getSegment`      | `GET    /{id}`   |
//! | `createSegment`   | `POST   /`       |
//! | `updateSegment`   | `PATCH  /{id}`   |
//! | `deleteSegment`   | `DELETE /{id}`   |
//!
//! A saved segment is a named object + filter definition (optionally with
//! a `sortBy` / `sortDir` and a `color`). Persisted doc shape:
//!
//! ```text
//! { _id, projectId, name, object, filters: object,
//!   sortBy?, sortDir?, color?, createdAt, updatedAt }
//! ```
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
