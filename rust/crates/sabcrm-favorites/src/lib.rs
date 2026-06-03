//! # sabcrm-favorites
//!
//! Axum router for **SabCRM**'s favorites surface over the existing
//! MongoDB `sabcrm_favorites` collection. Mounted under
//! `/v1/sabcrm/favorites` from the orchestrating `api` crate:
//!
//! ```ignore
//! .nest("/v1/sabcrm/favorites", sabcrm_favorites::router::<AppState>())
//! ```
//!
//! ## Scope
//!
//! | TS action          | HTTP route   |
//! |--------------------|--------------|
//! | `listFavorites`    | `GET    /`   |
//! | `addFavorite`      | `POST   /`   |
//! | `removeFavorite`   | `DELETE /`   |
//!
//! A favorite is a pinned record (`object` + `recordId`) for the calling
//! user within a project. The unique key is
//! `(projectId, userId, object, recordId)`.
//!
//! ## Tenancy
//!
//! Every Mongo filter leads with `{ projectId, userId }` — the `userId`
//! comes from the [`AuthUser`](sabnode_auth::AuthUser) extractor (the
//! caller), **not** a request body. The extractor is required on every
//! endpoint so the surface is never anonymously open.

pub mod dto;
pub mod handlers;
pub mod router;

pub use router::router;
