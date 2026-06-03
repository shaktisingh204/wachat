//! `wachat-facebook-crm` — Facebook subscribers, kanban, custom labels and
//! profile-block endpoints.
//!
//! Ports the **Subscribers, CRM & Labels** slice of
//! `src/app/actions/facebook.actions.ts` (the legacy Next.js server-action
//! module) onto the Rust BFF.
//!
//! ```text
//! GET    /v1/facebook/crm/projects/{projectId}/subscribers           list subscribers
//! POST   /v1/facebook/crm/subscribers/{subscriberId}/status          update subscriber status
//! GET    /v1/facebook/crm/projects/{projectId}/kanban                full kanban view
//! POST   /v1/facebook/crm/projects/{projectId}/kanban/statuses       save custom kanban statuses
//!
//! GET    /v1/facebook/crm/projects/{projectId}/labels                Meta custom labels (page-scoped)
//! POST   /v1/facebook/crm/projects/{projectId}/labels                createCustomLabel
//! DELETE /v1/facebook/crm/projects/{projectId}/labels/{labelId}      deleteCustomLabel
//!
//! GET    /v1/facebook/crm/projects/{projectId}/labels/users/{psid}   labels assigned to a user
//! POST   /v1/facebook/crm/projects/{projectId}/labels/{labelId}/users  assignLabelToUser
//! DELETE /v1/facebook/crm/projects/{projectId}/labels/{labelId}/users  removeLabelFromUser
//!
//! POST   /v1/facebook/crm/projects/{projectId}/blocked               blockProfile
//! DELETE /v1/facebook/crm/projects/{projectId}/blocked               unblockProfile
//! ```
//!
//! Auth is project-scoped via the inlined `load_project_for` helper.
//! Meta-side label/block endpoints route through `wachat_meta_client::MetaClient`.

pub mod dto;
pub mod handlers;
pub mod state;
pub mod store;

use std::sync::Arc;

use axum::{
    Router,
    extract::FromRef,
    routing::{get, post},
};
use sabnode_auth::AuthConfig;

pub use state::WachatFacebookCrmState;

/// Build the router. The caller nests the prefix (typically
/// `/v1/facebook/crm`) when it adds this onto its top-level router.
pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    WachatFacebookCrmState: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    Router::new()
        // Subscribers + kanban
        .route(
            "/projects/{project_id}/subscribers",
            get(handlers::list_subscribers),
        )
        .route(
            "/subscribers/{subscriber_id}/status",
            post(handlers::update_subscriber_status),
        )
        .route("/projects/{project_id}/kanban", get(handlers::get_kanban))
        .route(
            "/projects/{project_id}/kanban/statuses",
            post(handlers::save_kanban_statuses),
        )
        // Custom labels — Meta page-level CRUD
        .route(
            "/projects/{project_id}/labels",
            get(handlers::list_custom_labels).post(handlers::create_custom_label),
        )
        .route(
            "/projects/{project_id}/labels/{label_id}",
            axum::routing::delete(handlers::delete_custom_label),
        )
        // Per-user label assignment
        .route(
            "/projects/{project_id}/labels/users/{psid}",
            get(handlers::get_labels_for_user),
        )
        .route(
            "/projects/{project_id}/labels/{label_id}/users",
            post(handlers::assign_label_to_user).delete(handlers::remove_label_from_user),
        )
        // Profile block / unblock
        .route(
            "/projects/{project_id}/blocked",
            post(handlers::block_profile).delete(handlers::unblock_profile),
        )
}
