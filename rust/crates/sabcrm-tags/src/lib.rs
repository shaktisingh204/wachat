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
//! | Action                  | HTTP route                |
//! |-------------------------|---------------------------|
//! | list (with counts)      | `GET    /`                |
//! | create                  | `POST   /`                |
//! | usage counts            | `GET    /counts`          |
//! | tags for a record       | `GET    /for-record`      |
//! | get one (with count)    | `GET    /{id}`            |
//! | update                  | `PATCH  /{id}`            |
//! | delete (+ cascade)      | `DELETE /{id}`            |
//! | apply tag to a record   | `POST   /{id}/apply`      |
//! | remove tag from record  | `DELETE /{id}/apply`      |
//! | records for a tag       | `GET    /{id}/records`    |
//!
//! A tag is a workspace-level label definition (`name`, `color`) within a
//! project. The persisted document is
//! `{ _id, projectId, name, color, createdAt }`. A per-project unique
//! `name` is enforced: a `create` (or rename) onto an existing name fails
//! with `409 Conflict`.
//!
//! Tags are applied to records through a join collection,
//! `sabcrm_tag_assignments`, whose documents are
//! `{ _id, projectId, tagId, object, recordId, createdAt }` (unique on
//! `(projectId, tagId, object, recordId)`, applied idempotently). Each tag
//! reports a derived `usageCount` (the number of records it is applied to);
//! deleting a tag cascades its assignments.
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
