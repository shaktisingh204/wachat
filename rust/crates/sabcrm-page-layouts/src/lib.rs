//! # sabcrm-page-layouts
//!
//! Axum router for **SabCRM**'s configurable record-page layouts over the
//! MongoDB `sabcrm_page_layouts` collection. Mounted under
//! `/v1/sabcrm/page-layouts` from the orchestrating `api` crate:
//!
//! ```ignore
//! .nest("/v1/sabcrm/page-layouts", sabcrm_page_layouts::router::<AppState>())
//! ```
//!
//! ## Model
//!
//! A page layout describes how one object's record-show page is composed:
//! an ordered list of **tabs**, each holding an ordered list of **widgets**.
//! A widget has a [`type`](dto::WidgetType) (`FIELDS`, `NOTES`, `TASKS`,
//! `TIMELINE`, `FILES`, `RECORD_TABLE`, `RICH_TEXT`, `GRAPH`, `IFRAME`, …), a
//! title and an opaque `config` blob. This mirrors Twenty's page-layout
//! grid; re-implemented natively, not ported.
//!
//! There is exactly **ONE** layout per `(projectId, object)` — the
//! collection is keyed on that pair and writes are upserts.
//!
//! ## Scope
//!
//! | Route                                        | Effect                              |
//! |----------------------------------------------|-------------------------------------|
//! | `GET    /?projectId=&object=`                | the object's layout (404 if none)   |
//! | `PUT    /?projectId=&object=`                | upsert the object's layout          |
//! | `DELETE /?projectId=&object=`                | reset to default (delete the row)   |
//!
//! ## Tenancy
//!
//! Every Mongo filter leads with `{ projectId, object }`. The
//! [`AuthUser`](sabnode_auth::AuthUser) extractor is required on every
//! endpoint so the surface is never anonymously open, but the caller's
//! user id is not part of the filter.

pub mod dto;
pub mod handlers;
pub mod router;

pub use router::router;
