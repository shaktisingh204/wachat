//! # sabbigin-config
//!
//! HTTP surface for per-tenant **SabBigin** (lite CRM SKU) configuration.
//!
//! SabBigin is a focused, micro-business CRM SKU that reuses the existing
//! CRM entity collections (`crm_contacts`, `crm_deals`, `crm_pipelines`,
//! `crm_products`, `crm_tasks`, `crm_activities`) under a simplified UI
//! mounted at `/dashboard/sabbigin/`. This crate stores the tenant-scoped
//! settings that gate the SabBigin UX:
//!
//!   * `enabled`           — is the SabBigin SKU turned on for this tenant?
//!   * `pipelineId`        — the single pipeline SabBigin is allowed to surface.
//!   * `pipelineLimit`     — hard cap on pipeline count (SabBigin tier = 1).
//!   * `allowedFeatures`   — opt-in feature flags
//!                            (`contacts` | `products` | `calls` | `emails`
//!                            | `dashboard`).
//!
//! The CRM entity crates are reused as-is — SabBigin owns **only** this
//! settings document. The TS side (`src/lib/rust-client/sabbigin-config.ts`)
//! exposes the standard `list / getById / create / update / delete` shape.
//!
//! Routes (mount under `/v1/sabbigin/config`):
//!
//! ```text
//! GET    /        — list_configs  (tenant-scoped, usually 0 or 1 row)
//! POST   /        — create_config
//! GET    /current — get_current_config  (convenience: first active doc)
//! GET    /{id}    — get_config
//! PATCH  /{id}    — update_config
//! DELETE /{id}    — delete_config  (soft → status: archived)
//! ```
//!
//! TODO (integrator): mount in `rust/crates/api/src/router.rs`:
//!
//! ```ignore
//! let sabbigin_config_router = sabbigin_config::router::<AppState>();
//! .nest("/v1/sabbigin/config", sabbigin_config_router)
//! ```
//!
//! TODO (workspace): add `"crates/sabbigin-config"` to the `members` list in
//! `rust/Cargo.toml`.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
