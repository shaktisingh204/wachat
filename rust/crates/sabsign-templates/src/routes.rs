use crate::{handlers::*, mock_db::MockDb};
use axum::{
    routing::{delete, get, patch, post},
    Router,
};

pub fn template_routes() -> Router<MockDb> {
    Router::new()
        // Core CRUD
        .route("/templates", post(create_template).get(list_templates))
        .route(
            "/templates/:id",
            get(get_template)
                .put(update_template)
                .delete(delete_template),
        )
        // Operations
        .route("/templates/:id/clone", post(clone_template))
        .route("/templates/:id/archive", patch(archive_template))
        .route("/templates/:id/unarchive", patch(unarchive_template))
        // Roles & Merge Fields
        .route("/templates/:id/roles", post(add_role))
        .route("/templates/:id/roles/:role_id", delete(remove_role))
        .route("/templates/:id/merge-fields", post(add_merge_field))
        .route(
            "/templates/:id/merge-fields/:field_id",
            delete(remove_merge_field),
        )
        // Versioning
        .route("/templates/:id/versions", get(list_versions))
        .route("/templates/:id/versions/:version", get(get_version))
        .route(
            "/templates/:id/versions/:version/rollback",
            post(rollback_version),
        )
        // Applications
        .route("/templates/:id/apply", post(apply_to_envelope))
        // Bulk Actions
        .route("/templates/bulk", post(bulk_create).delete(bulk_delete))
        // Search & Analytics
        .route("/templates/search", get(search_templates))
        .route("/templates/analytics", get(get_analytics))
}
