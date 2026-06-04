//! # sabcrm-dashboards
//!
//! Axum router for **SabCRM**'s saved-dashboards surface over the existing
//! MongoDB `sabcrm_dashboards` collection. Mounted under
//! `/v1/sabcrm/dashboards` from the orchestrating `api` crate:
//!
//! ```ignore
//! .nest("/v1/sabcrm/dashboards", sabcrm_dashboards::router::<AppState>())
//! ```
//!
//! ## Scope
//!
//! | Action            | HTTP route       |
//! |-------------------|------------------|
//! | list dashboards   | `GET    /`       |
//! | get dashboard     | `GET    /{id}`   |
//! | create dashboard  | `POST   /`       |
//! | update dashboard  | `PATCH  /{id}`   |
//! | delete dashboard  | `DELETE /{id}`   |
//!
//! A dashboard is a saved layout: a `name` plus an ordered list of `widgets`,
//! each `{ id, type, title, config }`.
//!
//! ## Tenancy
//!
//! Every Mongo filter leads with `{ projectId: <string> }`. The
//! [`AuthUser`](sabnode_auth::AuthUser) extractor is required on every
//! endpoint so the surface is never anonymously open, but the caller's user id
//! is not part of the filter.

pub mod dto;
pub mod handlers;
pub mod router;

pub use dto::{DashboardWidget, WidgetConfig, WidgetMetric, WidgetType};
pub use router::router;
