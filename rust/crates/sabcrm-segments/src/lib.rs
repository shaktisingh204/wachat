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
//! | `applySegment`    | `POST   /{id}/apply` |
//!
//! ## Records-filter AST (Twenty parity)
//!
//! A segment stores a **records-filter AST** under its `filters` key — a tree
//! of typed leaf conditions (`{ field, op, value? }`) combined by `AND` / `OR`
//! groups (`{ op, conditions }`). The AST is the Rust mirror of the frontend
//! shape in `src/lib/sabcrm/records-filter.ts` (identical operator vocabulary)
//! so it round-trips losslessly; see [`filter`]. `applySegment` translates that
//! AST to a Mongo predicate and pages the matching `sabcrm_records`.
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
pub mod filter;
pub mod handlers;
pub mod router;

pub use router::router;
