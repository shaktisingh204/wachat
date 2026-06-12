//! # crm-rfqs
//!
//! HTTP surface for the §12.3 RFQ entity. Sibling business-logic crate
//! to `crm-leads` / `crm-deals` / `crm-quotations` — same five-endpoint
//! shape, same tenancy story, same lineage-on-create plumbing.
//!
//! - DTOs live in [`dto`] (request shapes only — the response shape is
//!   the canonical [`crm_extras_types::Rfq`] from the §12 extras types
//!   crate; we never redeclare it here).
//! - Handlers live in [`handlers`] and read [`sabnode_auth::AuthUser`] as
//!   their authenticated principal. Every query is scoped by
//!   `userId == AuthUser.user_id` (the CRM "tenant root" — see
//!   `crm-core::Identity`).
//! - The [`router`] module exposes a state-generic [`router::router`]
//!   that the host `api` crate mounts under `/v1/crm/rfqs`.
//!
//! ## Mongo
//!
//! Backing collection: `crm_rfqs`. The Rfq DTO flattens
//! `Identity`/`Audit` from `crm-core` so the document root carries
//! `_id`, `userId`, `projectId`, `createdAt`, … directly — no migrations
//! needed when this crate ships alongside the existing TS code.
//!
//! ## Soft delete
//!
//! `DELETE` does NOT remove the row — it sets `archived = true` and
//! stamps `deletedAt`. RFQ provenance is load-bearing for the
//! RFQ → Vendor Bid → Purchase Order chain, so we never lose a row.
//! The list endpoint excludes `archived = true` rows by default.
//!
//! ## Lineage
//!
//! On create the body may carry `fromKind: "lead"` or `fromKind: "deal"`
//! plus `fromId` — when both are present the handler fetches the parent
//! (`crm_leads` or `crm_deals`) under the same `userId` scope and seeds
//! the new RFQ's `lineage[]` via
//! [`crm_core::build_lineage_from_parent`]. A best-effort back-link is
//! also pushed onto the parent's lineage. Failures are non-fatal — the
//! RFQ still saves. Mirrors the pattern in `crm-quotations` exactly so
//! the "convert from X" UX behaves identically across entities.

pub mod dto;
pub mod handlers;
pub mod router;

pub use router::{project_router, router};
