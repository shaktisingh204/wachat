//! # crm-quotations
//!
//! HTTP surface for the §1.2 Quotation entity. Sibling business-logic
//! crate to `crm-leads` / `crm-deals` — same five-endpoint shape, same
//! tenancy story, same lineage-on-create plumbing.
//!
//! - DTOs live in [`dto`] (request shapes only — the response shape is
//!   the canonical [`crm_sales_types::Quotation`] from the §1 sales
//!   types crate; we never redeclare it here).
//! - Handlers live in [`handlers`] and read [`sabnode_auth::AuthUser`] as
//!   their authenticated principal.
//! - The [`router`] module exposes two state-generic constructors:
//!   [`router::router`] (legacy `userId` scope, mounted under
//!   `/v1/crm/quotations`) and [`router::project_router`] (SabCRM
//!   Finance `projectId` scope, mounted under
//!   `/v1/sabcrm/finance/quotations`). Both share the same handlers;
//!   the per-request tenant filter key is resolved from the mount's
//!   `crm_core::ScopeMode` extension.
//!
//! ## Mongo
//!
//! Backing collection: `crm_quotations` (matches the existing TS
//! `CrmQuotation` shape in `src/lib/definitions.ts`). The Quotation DTO
//! flattens `Identity`/`Audit`/`Attribution`/`Assignment` from `crm-core`
//! so the document root carries `_id`, `userId`, `projectId`,
//! `createdAt`, … directly — no migrations needed when this crate ships
//! alongside the existing TS code.
//!
//! ## Soft delete
//!
//! `DELETE` does NOT remove the row — it sets `archived = true` and
//! stamps `deletedAt`. Quotation provenance is load-bearing for the
//! Lead → Deal → Quotation → SO → Invoice chain, so we never lose a
//! row. The list endpoint excludes `archived = true` rows by default.
//!
//! ## Lineage
//!
//! On create the body (or query string) may carry `fromKind: "lead"` or
//! `fromKind: "deal"` plus `fromId` — when both are present the handler
//! fetches the parent (`crm_leads` or `crm_deals`) under the same
//! `userId` scope and seeds the new quotation's `lineage[]` via
//! [`crm_core::build_lineage_from_parent`]. A best-effort back-link is
//! also pushed onto the parent's lineage. Failures are non-fatal — the
//! quotation still saves. Mirrors the pattern in `crm-deals` exactly so
//! the "convert from X" UX behaves identically across entities.

pub mod dto;
pub mod handlers;
pub mod router;

pub use router::{project_router, router};
