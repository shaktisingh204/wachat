//! # crm-leads
//!
//! HTTP surface for the §5.1 Lead entity. First **business-logic** crate
//! atop the §1-§10 CRM DTO crates — establishes the conventions every
//! future entity crate (`crm-deals`, `crm-tasks`, `crm-invoices`, …)
//! will follow:
//!
//! - DTOs live in [`dto`] (request shapes only — the response shape is
//!   the canonical [`crm_sales_crm_types::Lead`] from the §5.1 types
//!   crate; we never redeclare it here).
//! - Handlers live in [`handlers`] and read [`sabnode_auth::AuthUser`] as
//!   their authenticated principal. Every query is scoped by
//!   `userId == AuthUser.user_id` (the CRM "tenant root" — see
//!   `crm-core::Identity`).
//! - The [`router`] module exposes a state-generic [`router::router`]
//!   that the host `api` crate mounts under `/v1/crm/leads`.
//!
//! ## Mongo
//!
//! Backing collection: `crm_leads` (matches the existing TS server action
//! `src/app/actions/crm-leads.actions.ts`). The Lead DTO flattens
//! `Identity`/`Audit`/`Attribution`/`Assignment` from `crm-core` so the
//! document root carries `_id`, `userId`, `projectId`, `createdAt`, …
//! directly — no migrations needed when this crate ships alongside the
//! existing TS code.
//!
//! ## Soft delete
//!
//! `DELETE` does NOT remove the row — it sets `archived = true` and
//! stamps `deletedAt`. Lead provenance is load-bearing for attribution
//! reports, so we never lose it. The list endpoint excludes
//! `archived = true` rows by default.
//!
//! ## Lineage
//!
//! `Lead` itself has no `lineage[]` field on the DTO today (it's a root
//! provenance node — Deal/Quotation/SO chains start FROM a lead, not
//! into it). The create endpoint accepts an optional `fromKind` +
//! `fromId` pair on the request body for forward-compatibility, but the
//! lineage is intentionally **not** persisted on the lead document yet
//! — it'll be wired in once the Deal-from-Lead converter lands and we
//! decide whether the lineage chain lives on the lead, the deal, or
//! both. See the inline comment in [`handlers::create_lead`].

pub mod dto;
pub mod handlers;
pub mod router;

pub use router::router;
