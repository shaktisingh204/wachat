//! # sabchat-knowledge
//!
//! Phase — axum router for the SabChat **knowledge base** (a.k.a.
//! "SabKnow"). Owns the Help Center HTTP surface: portals, categories,
//! articles, and a separate public-read surface that powers the
//! customer-facing help-center renderer.
//!
//! Mounted under **two** prefixes from the orchestrating `api` crate:
//!
//! ```ignore
//! .nest("/v1/sabchat/kb",        sabchat_knowledge::router::<AppState>())
//! .nest("/v1/sabchat/kb-public", sabchat_knowledge::public_router::<AppState>())
//! ```
//!
//! ## Why two routers
//!
//! The agent-side surface (`/v1/sabchat/kb`) is fully authenticated and
//! scoped by `tenant_id`. The public surface (`/v1/sabchat/kb-public`)
//! is anonymous (no `AuthUser`) and only ever returns **published**
//! articles inside **active** portals. Keeping them in separate
//! routers means the JWT-extractor middleware doesn't have to know
//! which routes are exempt — the caller mounts each router under its
//! own tower middleware stack.
//!
//! ## Routes — agent side (`/v1/sabchat/kb`)
//!
//! | Method | Path                       | Handler                |
//! |--------|----------------------------|------------------------|
//! | POST   | `/portals`                 | `create_portal`        |
//! | GET    | `/portals`                 | `list_portals`         |
//! | GET    | `/portals/{id}`            | `get_portal`           |
//! | PATCH  | `/portals/{id}`            | `update_portal`        |
//! | DELETE | `/portals/{id}`            | `delete_portal`        |
//! | POST   | `/categories`              | `create_category`      |
//! | GET    | `/categories`              | `list_categories`      |
//! | GET    | `/categories/{id}`         | `get_category`         |
//! | PATCH  | `/categories/{id}`         | `update_category`      |
//! | DELETE | `/categories/{id}`         | `delete_category`      |
//! | POST   | `/articles`                | `create_article`       |
//! | GET    | `/articles`                | `list_articles`        |
//! | GET    | `/articles/{id}`           | `get_article`          |
//! | PATCH  | `/articles/{id}`           | `update_article`       |
//! | DELETE | `/articles/{id}`           | `delete_article`       |
//! | POST   | `/articles/{id}/publish`   | `publish_article`      |
//! | POST   | `/articles/{id}/archive`  | `archive_article`      |
//!
//! ## Routes — public read (`/v1/sabchat/kb-public`)
//!
//! | Method | Path                                              | Handler                        |
//! |--------|---------------------------------------------------|--------------------------------|
//! | GET    | `/portals/{slug}`                                 | `public_get_portal`            |
//! | GET    | `/portals/{slug}/articles?q=&category=&tag=`      | `public_list_articles`         |
//! | GET    | `/portals/{slug}/articles/{articleSlug}`          | `public_get_article` (+`$inc`) |
//! | POST   | `/portals/{slug}/articles/{articleSlug}/helpful`  | `public_helpful_vote`          |
//!
//! ## Tenancy
//!
//! Every agent-side read and write is scoped by `tenant_id ==
//! ObjectId(auth.tenant_id)`. A malformed JWT subject yields
//! [`ApiError::Unauthorized`](sabnode_common::ApiError::Unauthorized).
//! The public surface deliberately does **not** scope by tenant — the
//! portal slug is the lookup key, and active-flag + published-status
//! filter out anything that shouldn't be visible.
//!
//! ## Slug uniqueness
//!
//! Portal slugs are unique **per tenant**. Category slugs are unique
//! **per portal**. Article slugs are unique **per portal × language**.
//! Duplicate-create attempts surface `ApiError::Conflict`.
//!
//! ## State contract
//!
//! Both [`router`] and [`public_router`] are generic over the caller's
//! outer state `S`. The handlers need:
//!
//! - a [`SabChatKnowledgeState`] bundle (just a Mongo handle today), and
//! - an `Arc<sabnode_auth::AuthConfig>` (only the agent router pulls
//!   this — the public router does not consume `AuthUser`).
//!
//! Both are pulled out via [`FromRef`](axum::extract::FromRef) so this
//! crate stays decoupled from the orchestrator's `AppState` struct.

pub mod dto;
pub mod handlers;
pub mod public_handlers;
pub mod state;

use std::sync::Arc;

use axum::{
    Router,
    extract::FromRef,
    routing::{get, post},
};
use sabnode_auth::AuthConfig;

pub use state::SabChatKnowledgeState;

/// Build the agent-side SabChat knowledge router.
///
/// Routes (mounted relative — caller nests under `/v1/sabchat/kb`):
///
/// ```text
/// POST   /portals                       — create_portal
/// GET    /portals                       — list_portals
/// GET    /portals/{id}                  — get_portal
/// PATCH  /portals/{id}                  — update_portal
/// DELETE /portals/{id}                  — delete_portal
///
/// POST   /categories                    — create_category
/// GET    /categories                    — list_categories
/// GET    /categories/{id}               — get_category
/// PATCH  /categories/{id}               — update_category
/// DELETE /categories/{id}               — delete_category
///
/// POST   /articles                      — create_article
/// GET    /articles                      — list_articles
/// GET    /articles/{id}                 — get_article
/// PATCH  /articles/{id}                 — update_article
/// DELETE /articles/{id}                 — delete_article
/// POST   /articles/{id}/publish         — publish_article
/// POST   /articles/{id}/archive         — archive_article
/// ```
///
/// **Route ordering note:** the literal `/articles/{id}/publish` and
/// `/articles/{id}/archive` segments are registered alongside the
/// generic `/articles/{id}` — axum's matcher disambiguates by the
/// trailing literal segment with no priority workaround needed.
pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    SabChatKnowledgeState: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    Router::new()
        // ---- portals --------------------------------------------------
        .route(
            "/portals",
            post(handlers::create_portal).get(handlers::list_portals),
        )
        .route(
            "/portals/{id}",
            get(handlers::get_portal)
                .patch(handlers::update_portal)
                .delete(handlers::delete_portal),
        )
        // ---- categories -----------------------------------------------
        .route(
            "/categories",
            post(handlers::create_category).get(handlers::list_categories),
        )
        .route(
            "/categories/{id}",
            get(handlers::get_category)
                .patch(handlers::update_category)
                .delete(handlers::delete_category),
        )
        // ---- articles -------------------------------------------------
        .route(
            "/articles",
            post(handlers::create_article).get(handlers::list_articles),
        )
        .route(
            "/articles/{id}",
            get(handlers::get_article)
                .patch(handlers::update_article)
                .delete(handlers::delete_article),
        )
        .route("/articles/{id}/publish", post(handlers::publish_article))
        .route("/articles/{id}/archive", post(handlers::archive_article))
}

/// Build the **public-read** SabChat knowledge router.
///
/// Mounted at `/v1/sabchat/kb-public`. No `AuthUser` is consumed by any
/// handler in this router — every endpoint is intentionally anonymous
/// so the help-center renderer can serve articles to logged-out
/// visitors.
///
/// Routes (mounted relative):
///
/// ```text
/// GET    /portals/{slug}                                  — public_get_portal
/// GET    /portals/{slug}/articles                         — public_list_articles
/// GET    /portals/{slug}/articles/{article_slug}          — public_get_article
/// POST   /portals/{slug}/articles/{article_slug}/helpful  — public_helpful_vote
/// ```
///
/// **Visibility rules:**
/// - Portal lookup returns 404 unless `active = true`.
/// - Article reads return 404 unless `status = "published"`.
/// - `public_get_article` increments `view_count` on every hit (via
///   `$inc`); the helpful endpoint bumps `helpful_count` or
///   `not_helpful_count` depending on the request body.
pub fn public_router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    SabChatKnowledgeState: FromRef<S>,
{
    Router::new()
        .route(
            "/portals/{slug}",
            get(public_handlers::public_get_portal),
        )
        .route(
            "/portals/{slug}/articles",
            get(public_handlers::public_list_articles),
        )
        .route(
            "/portals/{slug}/articles/{article_slug}",
            get(public_handlers::public_get_article),
        )
        .route(
            "/portals/{slug}/articles/{article_slug}/helpful",
            post(public_handlers::public_helpful_vote),
        )
}
