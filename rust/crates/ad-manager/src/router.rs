//! Axum router for `/v1/ad-manager/*`.

use std::sync::Arc;

use axum::{Router, extract::FromRef, routing::post};
use sabnode_auth::AuthConfig;

use crate::{from_form, handlers, state::AdManagerState};

pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    AdManagerState: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    Router::new()
        // Generic Graph proxy. The TS shim sends `{ path, method, params,
        // body, tokenKind }` and gets back `{ data?, error? }`.
        .route("/graph", post(handlers::graph_proxy))
        // Ad accounts (Mongo-backed pieces).
        .route("/accounts", post(handlers::get_ad_accounts))
        .route("/accounts/delete", post(handlers::delete_ad_account))
        // Local "quick create" ad_campaigns CRUD.
        .route(
            "/local-campaigns/list",
            post(handlers::list_local_campaigns),
        )
        .route(
            "/local-campaigns/insert",
            post(handlers::insert_local_campaign),
        )
        .route(
            "/local-campaigns/delete-by-meta-id",
            post(handlers::delete_local_campaigns_by_meta_id),
        )
        .route(
            "/local-campaigns/update-status",
            post(handlers::update_local_campaign_status),
        )
        // Multipart asset uploads. `kind` is `image` or `video`.
        .route("/upload/{kind}", post(handlers::upload_asset))
        // Counts (user-scoped + admin global) for dashboard tiles.
        .route(
            "/local-campaigns/count",
            post(handlers::count_local_campaigns_user),
        )
        .route(
            "/admin/local-campaigns/count-global",
            post(handlers::count_local_campaigns_global),
        )
        // Onboarding OAuth callback writes the user's ad accounts here.
        .route("/accounts/set", post(handlers::set_meta_ad_accounts))
        // Aggregating endpoints (formerly per-page TS server actions).
        .route(
            "/aggregate/compare-campaigns",
            post(handlers::compare_campaigns),
        )
        .route(
            "/aggregate/budget-recommendations/{ad_account_id}",
            post(handlers::get_budget_recommendations),
        )
        .route(
            "/aggregate/conversion-funnel/{ad_account_id}",
            post(handlers::get_conversion_funnel),
        )
        .route(
            "/aggregate/decorated-local-campaigns",
            post(handlers::decorated_local_campaigns),
        )
        .route("/aggregate/reshaped-ads", post(handlers::reshaped_ads))
        .route(
            "/aggregate/quick-create-campaign",
            post(handlers::quick_create_campaign),
        )
        // Multipart Server Action entrypoints — TS shim forwards FormData here.
        .route(
            "/from-form/create-ad-campaign",
            post(from_form::create_ad_campaign),
        )
        .route(
            "/from-form/create-automated-rule",
            post(from_form::create_automated_rule),
        )
        .route(
            "/from-form/create-custom-conversion",
            post(from_form::create_custom_conversion),
        )
}
