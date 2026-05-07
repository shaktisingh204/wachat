//! # crm-subscriptions
//!
//! HTTP surface for the §12.1 Subscription entity — recurring billing
//! agreements that emit invoices on a fixed cadence until paused,
//! cancelled, or expired. Sibling business-logic crate to `crm-leads`,
//! `crm-deals`, …; follows the same conventions:
//!
//! - DTOs live in [`dto`] (request shapes only — the response shape is
//!   the canonical [`crm_extras_types::Subscription`] from the §12.1
//!   types crate; we never redeclare it here).
//! - Handlers live in [`handlers`] and read [`sabnode_auth::AuthUser`]
//!   as their authenticated principal. Every query is scoped by
//!   `userId == AuthUser.user_id` (the CRM "tenant root" — see
//!   `crm-core::Identity`).
//! - The [`router`] module exposes a state-generic [`router::router`]
//!   that the host `api` crate mounts under `/v1/crm/subscriptions`.
//!
//! ## Mongo
//!
//! Backing collection: `crm_subscriptions`. The Subscription DTO
//! flattens `Identity`/`Audit` from `crm-core` so the document root
//! carries `_id`, `userId`, `projectId`, `createdAt`, … directly.
//!
//! ## Soft delete
//!
//! `DELETE` does NOT remove the row — it sets `archived = true` and
//! stamps `deletedAt`. Subscription history is load-bearing for
//! revenue-recognition and dunning audits, so we never lose it. The
//! list endpoint excludes `archived = true` rows by default.
//!
//! ## Lineage
//!
//! Unlike `Lead → Deal → Quotation → SO`, a subscription does not
//! originate from a chain doc — it always begins from a customer
//! record. The create endpoint therefore exposes **no** `fromKind` /
//! `fromId` hooks; if a subscription is later derived from a quote /
//! invoice the linkage will be added then.
//!
//! ## Pause endpoint
//!
//! In addition to the five standard CRUD endpoints, this crate exposes
//! `POST /{id}/pause` which flips status to `paused` and stamps an
//! optional `pausedUntil` timestamp. See [`handlers::pause_subscription`].

pub mod dto;
pub mod handlers;
pub mod router;

pub use router::router;
