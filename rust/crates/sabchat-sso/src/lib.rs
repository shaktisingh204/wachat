pub mod dto;
pub mod handlers;
pub mod scim;
pub mod state;

use std::sync::Arc;

use axum::Router;
use axum::extract::FromRef;
use axum::routing::{delete, get, post};
use sabnode_auth::AuthConfig;

pub use state::SabChatSsoState;

/// Admin router for configuring SSO and SCIM tokens.
/// Mounted at `/v1/sabchat/sso` by the orchestrator.
pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    SabChatSsoState: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    Router::new()
        // SSO config CRUD
        .route(
            "/configs",
            get(handlers::list_sso_configs).post(handlers::create_sso_config),
        )
        .route(
            "/configs/{id}",
            get(handlers::get_sso_config)
                .patch(handlers::update_sso_config)
                .delete(handlers::delete_sso_config),
        )
        // SCIM token CRUD
        .route(
            "/scim-tokens",
            get(handlers::list_scim_tokens).post(handlers::create_scim_token),
        )
        .route("/scim-tokens/{id}", delete(handlers::delete_scim_token))
        // Stub for testing SAML
        .route("/test-saml-response", post(handlers::test_saml_response))
}

/// SCIM 2.0 provisioning surface.
/// Mounted at `/v1/sabchat/scim/v2` by the orchestrator.
pub fn scim_router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    SabChatSsoState: FromRef<S>,
{
    Router::new()
        .route("/Users", get(scim::list_users).post(scim::create_user))
        .route(
            "/Users/{id}",
            get(scim::get_user)
                .put(scim::replace_user)
                .patch(scim::patch_user)
                .delete(scim::delete_user),
        )
        .route("/Groups", get(scim::list_groups).post(scim::create_group))
        .route(
            "/Groups/{id}",
            get(scim::get_group)
                .put(scim::replace_group)
                .patch(scim::patch_group)
                .delete(scim::delete_group),
        )
}
