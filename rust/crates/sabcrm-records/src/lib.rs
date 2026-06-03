//! # sabcrm-records
//!
//! Axum router for **SabCRM**'s generic, metadata-driven record CRUD
//! surface over the existing MongoDB `sabcrm_records` collection. Mounted
//! under `/v1/sabcrm/records` from the orchestrating `api` crate:
//!
//! ```ignore
//! .nest("/v1/sabcrm/records", sabcrm_records::router::<AppState>())
//! ```
//!
//! ## Scope
//!
//! Six endpoints — list / create / get / update / delete / group — all
//! routing through the same handlers. The `{object}` path segment is the
//! object slug (companies, people, opportunities, notes, tasks,
//! activities, …; metadata lives in [`sabcrm_core`]).
//!
//! | TS action       | HTTP route                          |
//! |-----------------|-------------------------------------|
//! | `listRecords`   | `GET    /{object}`                  |
//! | `createRecord`  | `POST   /{object}`                  |
//! | `groupRecords`  | `POST   /{object}/group`            |
//! | `getRecord`     | `GET    /{object}/{id}`             |
//! | `updateRecord`  | `PATCH  /{object}/{id}`             |
//! | `deleteRecord`  | `DELETE /{object}/{id}`             |
//!
//! ## Tenancy
//!
//! Every Mongo filter is `{ projectId: <string>, object: <slug> }` — scoped
//! by tenant `projectId` (a query/body string) and the path `object` slug,
//! **not** by `userId`. The [`AuthUser`](sabnode_auth::AuthUser) extractor
//! is still required on every endpoint so the surface is never open.
//!
//! ## State contract
//!
//! [`router::router`] is generic over the caller's outer state `S`, pulling
//! a [`MongoHandle`](sabnode_db::mongo::MongoHandle) and an
//! `Arc<sabnode_auth::AuthConfig>` out via
//! [`FromRef`](axum::extract::FromRef) so this crate stays decoupled from
//! the orchestrator's `AppState`.

pub mod dto;
pub mod handlers;
pub mod router;

pub use router::router;
