//! # wachat_setup_kb
//!
//! Axum router for the `/wachat/setup/docs` page's knowledge base: searchable
//! setup / troubleshooting / best-practice articles. Mounted under
//! `/v1/wachat/setup-kb`:
//!
//! ```ignore
//! .nest("/v1/wachat/setup-kb", wachat_setup_kb::router::<AppState>())
//! ```
//!
//! KB articles are **global** content over `wa_setup_kb_articles` (not
//! per-tenant): any authenticated caller reads every article; writes just
//! require auth. Generic over the caller's state `S`; needs a
//! [`WachatSetupKbState`] and the JWT verifier config, both pulled via
//! [`FromRef`](axum::extract::FromRef).

pub mod dto;
pub mod handlers;
pub mod state;

use std::sync::Arc;

use axum::{
    Router,
    extract::FromRef,
    routing::{get, put},
};
use sabnode_auth::AuthConfig;

pub use state::WachatSetupKbState;

/// Build the setup-kb router (caller nests under `/v1/wachat/setup-kb`).
///
/// ```text
/// GET    /articles               — list_articles (q / category / sort)
/// POST   /articles               — create_article
/// PUT    /articles/{article_id}  — update_article
/// DELETE /articles/{article_id}  — delete_article
/// ```
pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    WachatSetupKbState: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    Router::new()
        .route(
            "/articles",
            get(handlers::list_articles).post(handlers::create_article),
        )
        .route(
            "/articles/{article_id}",
            put(handlers::update_article).delete(handlers::delete_article),
        )
}
