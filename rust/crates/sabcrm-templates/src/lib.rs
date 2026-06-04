//! # sabcrm-templates
//!
//! Axum router for **SabCRM**'s templates surface over the MongoDB
//! `sabcrm_templates` collection. Mounted under `/v1/sabcrm/templates`
//! from the orchestrating `api` crate:
//!
//! ```ignore
//! .nest("/v1/sabcrm/templates", sabcrm_templates::router::<AppState>())
//! ```
//!
//! ## Scope
//!
//! | TS action           | HTTP route             |
//! |---------------------|------------------------|
//! | `listTemplates`     | `GET    /?projectId=&kind=&objectType=` |
//! | `getTemplate`       | `GET    /{id}?projectId=`   |
//! | `createTemplate`    | `POST   /`             |
//! | `updateTemplate`    | `PATCH  /{id}`         |
//! | `deleteTemplate`    | `DELETE /{id}?projectId=`   |
//! | `renderTemplate`    | `POST   /{id}/render`  |
//! | `previewTemplate`   | `POST   /preview`      |
//!
//! A template may be associated with a CRM object (`objectType`) and may
//! embed `{{variable}}` placeholders in its `subject` / `body`. The render
//! endpoints substitute those placeholders with a record's field values
//! (see [`interpolate`]).
//!
//! A template is a reusable note / email / task body (`name`, `kind`,
//! optional `subject`, `body`). The persisted document shape is
//! `{ _id, projectId, name, kind, subject?, body, createdAt, updatedAt }`.
//!
//! ## Tenancy
//!
//! Every Mongo filter leads with `{ projectId: <string> }`. The
//! [`AuthUser`](sabnode_auth::AuthUser) extractor is required on every
//! endpoint so the surface is never anonymously open, but the caller's
//! user id is not part of the filter.

pub mod dto;
pub mod handlers;
pub mod interpolate;
pub mod router;

pub use router::router;
