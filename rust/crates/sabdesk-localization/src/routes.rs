use axum::{
    routing::{get, post, put, delete},
    Router,
};
use crate::handlers::*;
use crate::mock_db::MockDb;

pub fn create_router(db: MockDb) -> Router {
    Router::new()
        .route("/api/v1/locales", get(list_locales).post(create_locale))
        .route("/api/v1/locales/:id", get(get_locale).put(update_locale).delete(delete_locale))
        .route("/api/v1/locales/:id/compile", get(compile_language_pack))

        .route("/api/v1/translations", get(list_translations).post(create_translation))
        .route("/api/v1/translations/:id", get(get_translation).put(update_translation).delete(delete_translation))
        .route("/api/v1/translations/keys", post(get_translation_keys))

        .route("/api/v1/regions", get(list_regions).post(create_region))
        .route("/api/v1/regions/:id", get(get_region).delete(delete_region))
        .route("/api/v1/regions/:id/override", put(set_regional_override))

        .route("/api/v1/layouts", get(list_layouts).post(create_layout))
        .route("/api/v1/layouts/:id", get(get_layout).delete(delete_layout))

        .route("/api/v1/currencies", get(list_currencies).post(create_currency))
        .route("/api/v1/currencies/:id", get(get_currency).delete(delete_currency))
        .route("/api/v1/currencies/:id/rate", put(update_currency_rate))
        
        .with_state(db)
}
