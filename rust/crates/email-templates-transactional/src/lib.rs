//! # email-templates-transactional
//!
//! Phase 7 of the SabNode Email Suite Rust port. Owns the
//! **transactional** template surface — distinct from `email-templates`
//! which owns the marketing block/MJML library.
//!
//! ## What's in here
//!
//! A transactional template is **key-addressable** (callers reference
//! it by a stable `key` like `order_confirmation`), declares an explicit
//! `vars` schema, and is rendered + dispatched on-demand without a
//! campaign envelope. Things like:
//!
//! - "order_confirmation"
//! - "password_reset"
//! - "otp"
//! - "invoice_sent"
//!
//! ## Mount path
//!
//! Routes are written relative. The orchestrating `api` crate nests
//! the result under `/v1/email/templates/transactional`, giving final
//! URLs like `/v1/email/templates/transactional/{id}/preview`.
//!
//! ## State contract
//!
//! [`router`] is generic over the caller's outer state `S`. The handlers
//! need:
//!
//! - a [`EmailTemplatesTransactionalState`] (Mongo handle), and
//! - an `Arc<sabnode_auth::AuthConfig>` for the JWT extractor.
//!
//! Both are pulled via [`FromRef`](axum::extract::FromRef).
//!
//! ## Auth + tenancy
//!
//! Every endpoint requires [`AuthUser`](sabnode_auth::AuthUser). Every
//! Mongo query is pinned to `userId = ObjectId(AuthUser.tenant_id)`.
//!
//! ## TODOs
//!
//! - Wire the BullMQ `email-send` producer into the `test-send` handler
//!   (currently returns `202 Accepted` with `queued: 0`). Mirror the
//!   pattern in `email-campaigns::handlers::test_send`.
//! - Move `render_merge` to a shared crate once the marketing-side
//!   renderer converges on a real template engine (likely `handlebars`).
//! - Add this crate to `rust/Cargo.toml`'s `[workspace.members]` and to
//!   the `api` crate's router composition.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod state;

pub use router::router;
pub use state::EmailTemplatesTransactionalState;
