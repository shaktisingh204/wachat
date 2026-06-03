//! # sabcrm-roles
//!
//! Axum router for **SabCRM**'s roles & permissions surface over the
//! MongoDB `sabcrm_roles` collection. Mounted under `/v1/sabcrm/roles`
//! from the orchestrating `api` crate:
//!
//! ```ignore
//! .nest("/v1/sabcrm/roles", sabcrm_roles::router::<AppState>())
//! ```
//!
//! ## Scope
//!
//! | TS action      | HTTP route             |
//! |----------------|------------------------|
//! | `listRoles`    | `GET    /`             |
//! | `getRole`      | `GET    /{id}`         |
//! | `createRole`   | `POST   /`             |
//! | `updateRole`   | `PATCH  /{id}`         |
//! | `deleteRole`   | `DELETE /{id}`         |
//! | `setRoleMember`| `POST   /{id}/members` |
//!
//! A role is a named permission set: free-form `permissions` string keys
//! (e.g. `records:read`, `settings:manage`) plus a list of assigned
//! `memberIds`. `setRoleMember` adds/removes a single member id via
//! `$addToSet` / `$pull`. See [`CANONICAL_PERMISSIONS`](crate::dto::CANONICAL_PERMISSIONS)
//! for the reference key list.
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
