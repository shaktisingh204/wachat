//! # sabcrm-targets
//!
//! Axum router for **SabCRM**'s polymorphic *targets* surface over the
//! MongoDB `sabcrm_targets` collection. Mounted under
//! `/v1/sabcrm/targets` from the orchestrating `api` crate:
//!
//! ```ignore
//! .nest("/v1/sabcrm/targets", sabcrm_targets::router::<AppState>())
//! ```
//!
//! ## Model
//!
//! A *target* links ONE source activity to MANY records of ANY object —
//! Twenty's `task-target` / `note-target` morph pattern. Each row is a
//! junction:
//!
//! ```text
//! (sourceObject, sourceId)  →  (targetObject, targetId)
//! ```
//!
//! where `sourceObject` is the activity kind (`notes` | `tasks` |
//! `activities`) and `targetObject` is the slug of the linked record's
//! object (e.g. `companies`, `people`, `opportunities`). One note can fan
//! out to a company **and** three people; one company can collect many
//! notes & tasks — the same flat collection answers both directions.
//!
//! ## Scope
//!
//! | Action               | HTTP route            |
//! |----------------------|-----------------------|
//! | targets of a source  | `GET    /`            |
//! | sources on a record  | `GET    /for-record`  |
//! | link (idempotent)    | `POST   /`            |
//! | unlink               | `DELETE /`            |
//!
//! Plus the ADDITIVE **sales quotas** sub-resource (per-project goals for
//! the `/sabcrm/forecast` weighted-forecast UI), stored in the separate
//! `sabcrm_sales_targets` collection:
//!
//! | Action               | HTTP route              |
//! |----------------------|-------------------------|
//! | list quotas          | `GET    /quotas`        |
//! | create quota         | `POST   /quotas`        |
//! | update quota         | `PATCH  /quotas/{id}`   |
//! | delete quota         | `DELETE /quotas/{id}`   |
//!
//! ## Tenancy & indexes
//!
//! Every Mongo filter leads with `projectId` (a query/body string; never
//! anonymous — the [`AuthUser`](sabnode_auth::AuthUser) extractor is
//! required on every endpoint). The two query directions rely on the
//! compound indexes
//!
//! ```text
//! (projectId, sourceObject, sourceId)   — targets-of-a-source
//! (projectId, targetObject, targetId)   — sources-on-a-record
//! ```
//!
//! which also back the idempotent link/unlink on the full
//! `(projectId, sourceObject, sourceId, targetObject, targetId)` key.

pub mod dto;
pub mod handlers;
pub mod router;

pub use router::router;
