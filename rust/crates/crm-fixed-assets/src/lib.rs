//! # crm-fixed-assets
//!
//! HTTP surface for the §12.13 Fixed Asset entity. Follows the same
//! conventions established by [`crm_leads`] and [`crm_tickets`]:
//!
//! - DTOs live in [`dto`] (request shapes only — the response is the
//!   canonical [`crm_extras_types::FixedAsset`]; we never redeclare it).
//! - Handlers live in [`handlers`] and authenticate via
//!   [`sabnode_auth::AuthUser`]. Every Mongo query is scoped by
//!   `userId == AuthUser.user_id` (the CRM tenant root — see
//!   `crm-core::Identity`).
//! - The [`router`] module exposes a state-generic [`router::router`]
//!   that the host `api` crate mounts under `/v1/crm/fixed-assets`.
//!
//! ## Mongo
//!
//! Backing collection: `crm_fixed_assets`. The FixedAsset DTO flattens
//! `Identity` / `Audit` from `crm-core` so the document root carries
//! `_id`, `userId`, `projectId`, `createdAt`, …  directly.
//!
//! ## Soft delete
//!
//! `DELETE` does NOT remove the row — it sets `archived = true` and
//! stamps `deletedAt`. Asset history is load-bearing for depreciation
//! audit trails and disposition reporting; we never lose the document.
//!
//! ## Depreciation
//!
//! `POST /:assetId/depreciate` recomputes `accumulatedDepreciation` and
//! `netBookValue` based on the asset's `depreciationMethod` and the
//! number of months elapsed since `purchaseDate`. The two computed
//! fields are server-managed and clients should treat them as
//! read-only outside of this endpoint. Three methods are supported:
//!
//! - **SLM** (Straight-Line): equal monthly charge across the full
//!   `usefulLifeMonths`, capped so accumulated never exceeds
//!   `cost - residualValue`.
//! - **WDV** (Written-Down Value): declining-balance using a derived
//!   per-month rate from `usefulLifeMonths`; converges to but never
//!   crosses the residual floor.
//! - **Units**: not yet implemented at this endpoint (it requires a
//!   meter reading the spec hasn't pinned down). The handler responds
//!   with a `Validation` error pointing the caller at the units-of-
//!   production posting endpoint once it lands.
//!
//! ## Lineage
//!
//! Fixed assets are NOT in the §13.5 lineage chain (the chain is
//! Lead → Deal → Quotation → SO → Invoice). No `fromKind` / `fromId`
//! handling here — the asset's `supplierId` and `amcContractId` cover
//! the cross-references the spec calls for.

pub mod dto;
pub mod handlers;
pub mod router;

pub use router::router;
