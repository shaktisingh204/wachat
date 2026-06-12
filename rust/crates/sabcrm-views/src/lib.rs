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
//! | (work queues)   | `GET    /{id}/queue`   |
//! | (work queues)   | `POST   /{id}/queue`   |
//!
//! A saved view is a filtered / sorted presentation (`table` or `board`)
//! of one object. `setDefaultView` flips `isDefault` exclusively among the
//! sibling views of the same object.
//!
//! ## Work queues
//!
//! A saved view doubles as a prioritized work queue (`vt=queue`
//! presentation): the view's filters scope the queue and its multi-sort is
//! the priority order. The queue CONFIG (`queue` key: `enabled` /
//! `doneWhen` / `slaField` / `snoozeMinutes`) is one more additive key on
//! the view document (round-trips via the `#[serde(flatten)]` create/update
//! path, like `columnWidths`). Per-user work STATE (Done / Snooze) lives in
//! the separate `sabcrm_view_queue_state` collection, one row per
//! `(projectId, viewId, recordId, userId)`, served by the `/{id}/queue`
//! pair.
//!
//! ## Tenancy
//!
//! Every Mongo filter leads with `{ projectId: <string> }`. The
//! [`AuthUser`](sabnode_auth::AuthUser) extractor is required on every
//! endpoint so the surface is never anonymously open, but the caller's
//! user id is not part of the filter (queue-state rows additionally scope by
//! the explicit `userId` body/query param).

pub mod dto;
pub mod handlers;
pub mod router;

pub use router::router;
