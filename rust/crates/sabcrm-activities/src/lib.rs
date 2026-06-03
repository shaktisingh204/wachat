//! # sabcrm-activities
//!
//! Axum router for **SabCRM**'s activities-timeline surface over the
//! existing MongoDB `sabcrm_activities` collection. Mounted under
//! `/v1/sabcrm/activities` from the orchestrating `api` crate:
//!
//! ```ignore
//! .nest("/v1/sabcrm/activities", sabcrm_activities::router::<AppState>())
//! ```
//!
//! ## Scope
//!
//! | TS action          | HTTP route         |
//! |--------------------|--------------------|
//! | `listActivities`   | `GET    /`         |
//! | `createActivity`   | `POST   /`         |
//! | `updateActivity`   | `PATCH  /{id}`     |
//! | `deleteActivity`   | `DELETE /{id}`     |
//!
//! A timeline entry is a NOTE / TASK / CALL / MEETING / EMAIL / COMMENT
//! attached to a record (`targetObject` + `targetRecordId`). The list
//! endpoint returns newest-first; omitting the target yields a
//! whole-project feed.
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
