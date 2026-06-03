//! # sabcrm-views
//!
//! Axum router for **SabCRM**'s saved-views surface over the existing
//! MongoDB `sabcrm_views` collection. Mounted under `/v1/sabcrm/views`
//! from the orchestrating `api` crate:
//!
//! ```ignore
//! .nest("/v1/sabcrm/views", sabcrm_views::router::<AppState>())
//! ```
//!
//! ## Scope
//!
//! | TS action       | HTTP route             |
//! |-----------------|------------------------|
//! | `listViews`     | `GET    /`             |
//! | `createView`    | `POST   /`             |
//! | `updateView`    | `PATCH  /{id}`         |
//! | `deleteView`    | `DELETE /{id}`         |
//! | `setDefaultView`| `POST   /{id}/default` |
//!
//! A saved view is a filtered / sorted presentation (`table` or `board`)
//! of one object. `setDefaultView` flips `isDefault` exclusively among the
//! sibling views of the same object.
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
