//! `facebook-flow` — Facebook Messenger flow-builder CRUD.
//!
//! Mirrors `src/app/actions/facebook-flow.actions.ts` 1:1. The TS module
//! reads/writes the project-scoped `facebook_flows` Mongo collection. There
//! is no Meta / Facebook Graph traffic on this surface — purely local
//! storage backing the Messenger flow-builder UI.
//!
//! ```text
//! GET    /v1/facebook/flow/projects/{projectId}/flows   list (summaries)
//! POST   /v1/facebook/flow/projects/{projectId}/flows   create / save (upsert)
//! GET    /v1/facebook/flow/{flowId}                     full flow
//! DELETE /v1/facebook/flow/{flowId}                     delete
//! ```
//!
//! Auth is project-scoped via `load_project_for` (mirrors
//! `wachat-config::router::load_project_for`).

pub mod dto;
pub mod router;
pub mod state;
pub mod store;

pub use router::router;
pub use state::FacebookFlowState;
