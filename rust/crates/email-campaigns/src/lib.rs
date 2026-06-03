//! # email-campaigns
//!
//! Phase 3 of the SabNode Email Suite Rust port. HTTP surface for the
//! **campaigns** domain: CRUD over `email_campaigns`, lifecycle
//! transitions (draft → scheduled → sending → sent / paused / cancelled),
//! preview/recipients-count read-throughs, and report rollups read from
//! `email_reports_cache`.
//!
//! ## What this crate is
//!
//! The API layer. It owns the **wire shapes**, the **request
//! orchestration** (auth + tenancy guard, Mongo I/O, pre-flight,
//! BullMQ enqueue), and the **lifecycle state machine** — but no SMTP /
//! provider I/O. That belongs to the `email-sender` worker, which drains
//! the BullMQ `"email-send"` queue this crate writes into.
//!
//! ## Mount path
//!
//! Routes are written **relative**. The caller (the `api` crate) nests
//! the result under `/v1/email/campaigns`, giving final URLs like
//! `/v1/email/campaigns/{id}/send`.
//!
//! ## State contract
//!
//! [`router`] is generic over the caller's outer state `S`. The handlers
//! need only:
//!
//! - a [`EmailCampaignsState`] bundle (Mongo handle + BullMQ producer),
//!   and
//! - an `Arc<sabnode_auth::AuthConfig>` for the JWT extractor.
//!
//! Both are pulled via [`FromRef`](axum::extract::FromRef) so this crate
//! stays decoupled from the orchestrator's monolithic `AppState`.
//!
//! ## Auth + tenancy
//!
//! Every endpoint requires the [`AuthUser`](sabnode_auth::AuthUser)
//! extractor. Every Mongo query filters by
//! `userId = ObjectId(AuthUser.tenant_id)` so a tenant can never read or
//! mutate another tenant's campaigns.

use std::sync::Arc;

use axum::{
    Router,
    extract::FromRef,
    routing::{get, post},
};
use sabnode_auth::AuthConfig;

pub mod dto;
pub mod handlers;
pub mod state;

pub use state::EmailCampaignsState;

/// Build the campaigns router.
///
/// Routes (mounted relative — caller nests under `/v1/email/campaigns`):
///
/// ```text
/// GET    /                            — list (filter: status, type, listId; pagination)
/// POST   /                            — create draft campaign
/// GET    /{id}                        — get one
/// PATCH  /{id}                        — update draft fields
/// DELETE /{id}                        — soft-delete (cancel scheduled / hard-delete draft)
/// POST   /{id}/test-send              — enqueue test send (BullMQ `email-send`, kind=test)
/// POST   /{id}/send                   — pre-flight + draft → sending + enqueue start-campaign
/// POST   /{id}/schedule               — draft → scheduled
/// POST   /{id}/pause                  — sending / scheduled → paused
/// POST   /{id}/resume                 — paused → previous active state
/// POST   /{id}/cancel                 — any non-terminal → cancelled
/// GET    /{id}/preview                — rendered HTML + subject
/// GET    /{id}/recipients-count       — total – suppressed
/// GET    /{id}/report                 — aggregated KPIs (from email_reports_cache)
/// ```
pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    EmailCampaignsState: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    Router::new()
        // Collection root
        .route(
            "/",
            get(handlers::list_campaigns).post(handlers::create_campaign),
        )
        // Per-id literal sub-paths must precede the bare `/{id}` if axum's
        // matcher would otherwise treat the literal as a parameter; here
        // axum 0.8 disambiguates literal vs param automatically, but we
        // declare them explicitly for clarity anyway.
        .route("/{id}/test-send", post(handlers::test_send))
        .route("/{id}/send", post(handlers::send))
        .route("/{id}/schedule", post(handlers::schedule))
        .route("/{id}/pause", post(handlers::pause))
        .route("/{id}/resume", post(handlers::resume))
        .route("/{id}/cancel", post(handlers::cancel))
        .route("/{id}/preview", get(handlers::preview))
        .route("/{id}/recipients-count", get(handlers::recipients_count))
        .route("/{id}/report", get(handlers::report))
        // Per-id CRUD (PATCH, DELETE, GET).
        .route(
            "/{id}",
            get(handlers::get_campaign)
                .patch(handlers::update_campaign)
                .delete(handlers::delete_campaign),
        )
}
