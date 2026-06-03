//! # sabcrm-invites
//!
//! Axum router for **SabCRM**'s workspace-member invitations surface over
//! the MongoDB `sabcrm_invites` collection. Mounted under
//! `/v1/sabcrm/invites` from the orchestrating `api` crate:
//!
//! ```ignore
//! .nest("/v1/sabcrm/invites", sabcrm_invites::router::<AppState>())
//! ```
//!
//! ## Scope
//!
//! | TS action       | HTTP route          |
//! |-----------------|---------------------|
//! | `listInvites`   | `GET    /`          |
//! | `createInvite`  | `POST   /`          |
//! | `revokeInvite`  | `POST   /{id}/revoke` |
//! | `deleteInvite`  | `DELETE /{id}`      |
//!
//! An invite is a pending membership offer for an `email` within a
//! project, carrying a `token` and a `status` (`pending` | `accepted` |
//! `revoked`). A fresh `POST` is rejected (`409`) when a *pending* invite
//! for the same `(projectId, email)` already exists. No email is sent
//! here — that is a runtime concern; this crate only persists the invite.
//!
//! ## Tenancy
//!
//! Every Mongo filter leads with `{ projectId }`. The `invitedBy` field is
//! the caller from the [`AuthUser`](sabnode_auth::AuthUser) extractor — not
//! a request body. The extractor is required on every endpoint so the
//! surface is never anonymously open.

pub mod dto;
pub mod handlers;
pub mod router;

pub use router::router;
