//! # sabcrm-notifications
//!
//! Axum router for **SabCRM**'s notifications surface over the MongoDB
//! `sabcrm_notifications` collection. Mounted under
//! `/v1/sabcrm/notifications` from the orchestrating `api` crate:
//!
//! ```ignore
//! .nest("/v1/sabcrm/notifications", sabcrm_notifications::router::<AppState>())
//! ```
//!
//! ## Scope
//!
//! | TS action               | HTTP route          |
//! |-------------------------|---------------------|
//! | `listNotifications`     | `GET    /`          |
//! | `notificationsCount`    | `GET    /count`     |
//! | `createNotification`    | `POST   /`          |
//! | `markNotificationRead`  | `POST   /{id}/read` |
//! | `markAllNotificationsRead` | `POST /read-all` |
//! | `deleteNotification`    | `DELETE /{id}`      |
//!
//! A notification is a per-user message (`title`, optional `body`, a typed
//! `kind` — `mention` | `assignment` | `comment` | `system` | `info`, an
//! `actorId` of who triggered it, optional `targetObject` + `targetRecordId`)
//! within a project. Lists are paginated (`limit` + `cursor`) and enriched
//! with a resolved `actor` ref; `GET /count` returns the unread count.
//!
//! ## Tenancy
//!
//! Every read and write is scoped by `{ projectId, userId }` where `userId`
//! comes from the [`AuthUser`](sabnode_auth::AuthUser) extractor (the
//! caller). The sole exception is `POST /`, which may set a different
//! `userId` in the body to fan a notification out to another user; reads,
//! mark-read, mark-all-read and delete are always scoped to the caller.
//! The extractor is required on every endpoint so the surface is never
//! anonymously open.

pub mod dto;
pub mod handlers;
pub mod router;

pub use router::router;
