//! Mountable router for `/v1/sabshow/decks/*`.
//!
//! ```ignore
//! .nest("/v1/sabshow/decks", sabshow_decks::router::<AppState>())
//! ```

use std::sync::Arc;

use axum::{
    Router,
    extract::FromRef,
    routing::{get, post},
};
use sabnode_auth::AuthConfig;
use sabnode_db::mongo::MongoHandle;

use crate::handlers;

/// Routes (relative — caller nests under `/v1/sabshow/decks`):
///
/// ```text
/// GET    /              — list_decks
/// POST   /              — create_deck
/// GET    /{deckId}      — get_deck
/// PATCH  /{deckId}      — update_deck
/// DELETE /{deckId}      — delete_deck (soft → status: archived)
/// POST   /{deckId}/share — share_deck (add/remove sharedWithUserIds)
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
            get(handlers::list_decks).post(handlers::create_deck),
        )
        .route(
            "/{deckId}",
            get(handlers::get_deck)
                .patch(handlers::update_deck)
                .delete(handlers::delete_deck),
        )
        .route("/{deckId}/share", post(handlers::share_deck))
}
