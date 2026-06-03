use axum::{
    routing::{get, post, delete},
    Router,
};
use crate::handlers::*;
use crate::mock_db::AppState;

pub fn create_router(state: AppState) -> Router {
    Router::new()
        // Workspaces
        .route("/workspaces", get(list_workspaces).post(create_workspace))
        .route("/workspaces/:id", get(get_workspace).put(update_workspace).delete(delete_workspace))
        
        // Custom Forms
        .route("/custom-forms", get(list_custom_forms).post(create_custom_form))
        .route("/custom-forms/:id", get(get_custom_form).put(update_custom_form).delete(delete_custom_form))
        
        // Channels
        .route("/channels", get(list_channels).post(create_channel))
        .route("/channels/:id", get(get_channel).put(update_channel).delete(delete_channel))
        
        // Teams
        .route("/teams", get(list_teams).post(create_team))
        .route("/teams/:id", get(get_team).put(update_team).delete(delete_team))
        .route("/teams/:id/members", post(add_team_member))
        .route("/teams/:id/members/:user_id", delete(remove_team_member))
        
        // Roles
        .route("/roles", get(list_roles).post(create_role))
        .route("/roles/:id", get(get_role).put(update_role).delete(delete_role))
        .route("/roles/:id/permissions", post(assign_permissions_to_role))
        
        .with_state(state)
}
