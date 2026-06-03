use axum::{
    routing::{delete, get, post, put},
    Router,
};

use crate::{handlers::*, mock_db::AppState};

pub fn create_router(state: AppState) -> Router {
    Router::new()
        // Brands
        .route(
            "/api/v1/settings/brands",
            post(create_brand).get(get_brands),
        )
        .route(
            "/api/v1/settings/brands/:id",
            get(get_brand).put(update_brand).delete(delete_brand),
        )
        .route(
            "/api/v1/settings/brands/:id/override-css",
            put(override_css_brand),
        )
        // Templates
        .route(
            "/api/v1/settings/templates",
            post(create_template).get(get_templates),
        )
        .route(
            "/api/v1/settings/templates/:id",
            get(get_template)
                .put(update_template)
                .delete(delete_template),
        )
        .route(
            "/api/v1/settings/templates/bulk-delete",
            post(bulk_delete_templates),
        )
        // Legal Disclosures
        .route(
            "/api/v1/settings/disclosures",
            post(create_disclosure).get(get_disclosures),
        )
        .route(
            "/api/v1/settings/disclosures/:id",
            delete(delete_disclosure),
        )
        .route(
            "/api/v1/settings/disclosures/:id/require-esign",
            put(require_esign_consent),
        )
        // Security Configs
        .route(
            "/api/v1/settings/security",
            post(create_security_config).get(get_security_configs),
        )
        .route("/api/v1/settings/security/:id", put(update_security_config))
        // Compliance Settings
        .route(
            "/api/v1/settings/compliance",
            post(create_compliance_setting).get(get_compliance_settings),
        )
        .route(
            "/api/v1/settings/compliance/:id",
            put(update_compliance_setting),
        )
        // Analytics
        .route("/api/v1/settings/analytics", get(get_settings_analytics))
        .with_state(state)
}
