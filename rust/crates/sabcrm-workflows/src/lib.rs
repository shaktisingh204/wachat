//! # sabcrm-workflows
//!
//! Axum router for **SabCRM**'s automation-workflows surface over the
//! MongoDB `sabcrm_workflows` collection. Mounted under
//! `/v1/sabcrm/workflows` from the orchestrating `api` crate:
//!
//! ```ignore
//! .nest("/v1/sabcrm/workflows", sabcrm_workflows::router::<AppState>())
//! ```
//!
//! ## Scope
//!
//! | TS action          | HTTP route       |
//! |--------------------|------------------|
//! | `listWorkflows`    | `GET    /`       |
//! | `getWorkflow`      | `GET    /{id}`   |
//! | `createWorkflow`   | `POST   /`       |
//! | `updateWorkflow`   | `PATCH  /{id}`   |
//! | `deleteWorkflow`   | `DELETE /{id}`   |
//!
//! A workflow couples a record-lifecycle `trigger`
//! (`record.created` / `record.updated` / `record.deleted`, on one `object`)
//! with an ordered list of `steps` (`create_task` / `send_notification` /
//! `update_field` / `webhook`). `enabled` toggles whether it fires; the
//! `PATCH` route covers both enable/disable and step edits.
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
