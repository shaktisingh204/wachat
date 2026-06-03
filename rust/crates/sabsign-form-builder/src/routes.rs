use axum::{
    routing::{delete, get, post},
    Router,
};

use crate::handlers::*;
use crate::mock_db::AppState;

pub fn create_router() -> Router {
    let state = AppState::new();

    Router::new()
        // Form Routes
        .route("/api/v1/forms", get(list_forms).post(create_form))
        .route(
            "/api/v1/forms/:id",
            get(get_form).put(update_form).delete(delete_form),
        )
        .route("/api/v1/forms/:id/duplicate", post(duplicate_form))
        .route("/api/v1/forms/:id/publish", post(publish_form))
        .route("/api/v1/forms/:id/analytics", get(get_form_analytics))
        // Field Routes
        .route("/api/v1/fields", post(create_field))
        .route(
            "/api/v1/fields/:id",
            get(get_field).put(update_field).delete(delete_field),
        )
        .route("/api/v1/fields/:id/copy", post(copy_field))
        // Form Fields (Nested)
        .route("/api/v1/forms/:id/fields", get(list_form_fields))
        .route("/api/v1/forms/:id/fields", delete(clear_form_fields))
        .route("/api/v1/forms/:id/draft-tags", post(save_draft_tags))
        // Bulk Actions
        .route("/api/v1/fields/bulk/delete", post(bulk_delete_fields))
        .route("/api/v1/fields/bulk/update", post(bulk_update_fields))
        // Utilities
        .route(
            "/api/v1/utils/calculate-relative-xy",
            post(calculate_relative_xy),
        )
        .route(
            "/api/v1/utils/align-horizontal",
            post(align_fields_horizontally),
        )
        .route(
            "/api/v1/utils/align-vertical",
            post(align_fields_vertically),
        )
        .with_state(state)
}
