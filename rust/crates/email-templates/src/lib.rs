//! # email-templates
//!
//! Phase 2 of the SabNode email-suite rebuild. Replaces the legacy
//! `src/app/actions/email-templates.actions.ts` server actions plus the
//! `src/app/api/v1/email/templates/**` route handlers with an HTTP
//! surface mounted under `/v1/email/templates`.
//!
//! ## Scope
//!
//! Three collections, three resources, plus a server-side render path:
//!
//!   * `email_templates`         — full templates with optional
//!                                 `builderJson` (block-tree document)
//!                                 and / or `mjml`+`html` caches.
//!   * `email_template_blocks`   — saved reusable content blocks.
//!   * `email_brand_kits`        — per-tenant brand (logo, palette,
//!                                 fonts, footer) injected into MJML at
//!                                 render time.
//!
//! ## Render pipeline
//!
//! The drag-and-drop builder produces an [`EmailBuilderDocument`] —
//! a JSON document containing a tree of [`EmailBuilderBlock`] nodes.
//! [`render::render_builder_to_html`] walks the tree, emits an MJML
//! string, and runs `mrml::parse` + `Mjml::render` to produce the final
//! HTML the send engine eventually drops into the SMTP body. Brand-kit
//! fonts and colours are injected as MJML attributes when a brand kit
//! is supplied.
//!
//! ## Mount path
//!
//! Routes are written **relative**. The caller (the `api` crate) nests
//! the result under `/v1/email/templates`, giving final URLs like
//! `/v1/email/templates/{id}/render`.
//!
//! [`EmailBuilderDocument`]: dto::EmailBuilderDocument
//! [`EmailBuilderBlock`]:    dto::EmailBuilderBlock

use std::sync::Arc;

use axum::{
    Router,
    extract::FromRef,
    routing::{get, post},
};
use sabnode_auth::AuthConfig;

pub mod dto;
pub mod handlers;
pub mod render;
pub mod state;

pub use render::{RenderResult, render_builder_to_html};
pub use state::EmailTemplatesState;

/// Build the email-templates router.
///
/// Routes (mounted relative — caller nests under
/// `/v1/email/templates`):
///
/// ```text
/// GET    /                       — list templates (paginated)
/// POST   /                       — create template
/// GET    /library                — curated library (isLibrary=true)
///
/// GET    /blocks                 — list reusable blocks
/// POST   /blocks                 — create reusable block
/// DELETE /blocks/{block_id}      — delete reusable block
///
/// GET    /brand-kits             — list brand kits
/// POST   /brand-kits             — create brand kit
/// GET    /brand-kits/{kit_id}    — get brand kit
/// PATCH  /brand-kits/{kit_id}    — update brand kit
///
/// GET    /{template_id}          — get one template
/// PATCH  /{template_id}          — update template
/// DELETE /{template_id}          — soft-delete (archive)
/// POST   /{template_id}/render   — render builderJson → HTML
/// POST   /{template_id}/preview  — render with sample merge-tag data
/// ```
///
/// `S` is the caller's outer application state. The handlers need a
/// [`EmailTemplatesState`] (Mongo handle bundle) and the JWT verifier
/// config; both are pulled via [`FromRef`] so this crate stays
/// decoupled from the orchestrator's `AppState` struct.
///
/// **Route ordering note:** literal segments (`/library`, `/blocks`,
/// `/brand-kits`) are registered *before* `/{template_id}` so axum's
/// matcher prefers them over the path-parameter pattern.
pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    EmailTemplatesState: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    Router::new()
        // ---- literal segments (must precede /{template_id}) ----------
        .route("/library", get(handlers::list_library))
        .route(
            "/blocks",
            get(handlers::list_blocks).post(handlers::create_block),
        )
        .route("/blocks/{block_id}", axum::routing::delete(handlers::delete_block))
        .route(
            "/brand-kits",
            get(handlers::list_brand_kits).post(handlers::create_brand_kit),
        )
        .route(
            "/brand-kits/{kit_id}",
            get(handlers::get_brand_kit).patch(handlers::update_brand_kit),
        )
        // ---- collection root ----------------------------------------
        .route(
            "/",
            get(handlers::list_templates).post(handlers::create_template),
        )
        // ---- per-template -------------------------------------------
        .route(
            "/{template_id}",
            get(handlers::get_template)
                .patch(handlers::update_template)
                .delete(handlers::delete_template),
        )
        .route("/{template_id}/render", post(handlers::render_template))
        .route("/{template_id}/preview", post(handlers::preview_template))
}
