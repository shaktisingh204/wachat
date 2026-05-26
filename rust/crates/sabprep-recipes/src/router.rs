//! Mountable router for the SabPrep recipe endpoints.
//!
//! Mount under `/v1/sabprep/recipes` from the host `api` crate:
//!
//! ```ignore
//! use sabprep_recipes;
//! .nest("/v1/sabprep/recipes", sabprep_recipes::router::<AppState>())
//! ```

use std::sync::Arc;

use axum::{Router, extract::FromRef, routing::{get, post}};
use sabnode_auth::AuthConfig;
use sabnode_db::mongo::MongoHandle;

use crate::handlers;

/// Routes (relative — caller nests under `/v1/sabprep/recipes`):
///
/// ```text
/// GET    /                — list_recipes
/// POST   /                — create_recipe
/// POST   /preview         — preview_recipe (ad-hoc rows + steps)
/// GET    /{recipeId}      — get_recipe
/// PATCH  /{recipeId}      — update_recipe
/// DELETE /{recipeId}      — delete_recipe (soft → status: archived)
/// POST   /{recipeId}/run  — run_recipe (executes + persists output + run)
/// ```
pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    MongoHandle: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    Router::new()
        .route(
            "/",
            get(handlers::list_recipes).post(handlers::create_recipe),
        )
        .route("/preview", post(handlers::preview_recipe))
        .route(
            "/{recipeId}",
            get(handlers::get_recipe)
                .patch(handlers::update_recipe)
                .delete(handlers::delete_recipe),
        )
        .route("/{recipeId}/run", post(handlers::run_recipe))
}
