//! # crm-deals
//!
//! Axum router that ports the CRM deal CRUD work currently done in
//! `src/app/actions/crm-deals.actions.ts`. Mounted under
//! `/v1/crm/deals` from the orchestrating `api` crate:
//!
//! ```ignore
//! .nest("/v1/crm/deals", crm_deals::router::<AppState>())
//! ```
//!
//! ## Scope
//!
//! Five endpoints — list / get / create / update / delete on the
//! `crm_deals` Mongo collection. Every read and write is scoped by
//! `userId = AuthUser::user_id`; there is no admin "see all tenants"
//! path here.
//!
//! | TS action               | HTTP route                    |
//! |-------------------------|-------------------------------|
//! | `getCrmDeals`           | `GET    /`                    |
//! | `getCrmDealById`        | `GET    /{id}`                |
//! | `createCrmDeal`         | `POST   /`                    |
//! | `updateCrmDealStage`    | `PATCH  /{id}` (generalised)  |
//! | (parity with crm-leads) | `DELETE /{id}`                |
//!
//! ## Lineage
//!
//! On create the body may carry `fromKind: "lead"` + `fromId`. When both
//! are present the handler fetches the parent lead (under the same
//! `userId` scope) and seeds the new deal's `lineage[]` via
//! [`crm_core::build_lineage_from_parent`]. A best-effort back-link is
//! also pushed onto the parent lead. Failures are non-fatal — the deal
//! still saves.
//!
//! ## Auth + tenancy
//!
//! Every endpoint requires the [`AuthUser`](sabnode_auth::AuthUser)
//! extractor. All Mongo filters compose `{ userId: <caller's ObjectId> }`
//! so cross-tenant reads are impossible. Not-found and forbidden are
//! collapsed into `404` to avoid leaking existence.
//!
//! ## State contract
//!
//! [`router::router`] is generic over the caller's outer state `S`. The
//! handlers need:
//!
//! - a [`MongoHandle`](sabnode_db::mongo::MongoHandle), and
//! - an `Arc<sabnode_auth::AuthConfig>` (the JWT verifier the
//!   [`AuthUser`] extractor reads).
//!
//! Both are pulled out via [`FromRef`](axum::extract::FromRef) so this
//! crate stays decoupled from the orchestrator's `AppState` struct.

pub mod dto;
pub mod handlers;
pub mod router;

pub use router::router;
