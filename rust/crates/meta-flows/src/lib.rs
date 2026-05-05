//! `meta-flows` — Meta WhatsApp Flows CRUD.
//!
//! Mirrors `src/app/actions/meta-flow.actions.ts` 1:1. Operations are split
//! so the UI can offer explicit Save vs Publish vs Deprecate vs Preview,
//! each of which maps 1:1 to a Meta endpoint:
//!
//! ```text
//! POST   /v1/meta/flows/projects/:project/flows           createMetaFlow
//! POST   /v1/meta/flows/:flow/draft                       saveMetaFlowDraft   (multipart /assets)
//! POST   /v1/meta/flows/:flow/metadata                    updateMetaFlowMetadata
//! POST   /v1/meta/flows/:flow/publish                     publishMetaFlow
//! POST   /v1/meta/flows/:flow/deprecate                   deprecateMetaFlow
//! DELETE /v1/meta/flows/:flow                             deleteMetaFlow
//! POST   /v1/meta/flows/:flow/preview                     getMetaFlowPreview
//! GET    /v1/meta/flows/projects/:project/flows           getMetaFlows (local list)
//! GET    /v1/meta/flows/:flow                             getMetaFlowById (live sync)
//! POST   /v1/meta/flows/projects/:project/sync            handleSyncMetaFlows
//! ```
//!
//! All write paths perform a tenant check via the shared `load_owned_flow`
//! helper before talking to Meta. Validation errors from Meta are preserved
//! on both success and failure paths so the UI's "save draft" affordance
//! can render them inline.

pub mod dto;
pub mod meta_http;
pub mod router;
pub mod state;
pub mod store;

pub use router::router;
pub use state::MetaFlowsState;
