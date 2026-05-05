//! Top-level router assembly.
//!
//! Mounts liveness/readiness probes at the root and a versioned `/v1`
//! sub-router that domain crates plug into.

use std::time::Duration;

use axum::{
    Router,
    http::{HeaderName, StatusCode},
};
use tower_http::{
    cors::{Any, CorsLayer},
    request_id::{MakeRequestUuid, PropagateRequestIdLayer, SetRequestIdLayer},
    timeout::TimeoutLayer,
    trace::TraceLayer,
};

use crate::{routes, state::AppState};

const REQUEST_ID_HEADER: &str = "x-request-id";

pub fn build(state: AppState) -> Router {
    let request_id_header = HeaderName::from_static(REQUEST_ID_HEADER);

    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let v1 = sabnode_users::router::<AppState>();

    // Wachat webhook routes are absolute (`/v1/wachat/webhook/meta`) so they
    // merge at the root rather than nest under /v1.
    let wachat_webhook = wachat_webhook::router::<AppState>();
    // Cron drain endpoint is also absolute (`/v1/wachat/webhook/cron/drain-dlq`)
    // and gated by a shared `CRON_SECRET` rather than the JWT/tenant pipeline,
    // so it merges at the root too.
    let wachat_webhook_cron = wachat_webhook_dlq::cron_router::<AppState>();
    let wachat_webhook_admin: Router<AppState> =
        Router::new().nest("/admin", wachat_webhook_config::router::<AppState>());
    let wachat_templates = wachat_templates_router::router::<AppState>();
    let wachat_templates_actions = wachat_templates_actions::router::<AppState>();
    let wachat_send = wachat_send_router::router::<AppState>();
    let wachat_config = wachat_config::router::<AppState>();
    let wachat_pay = wachat_pay::router::<AppState>();
    let wachat_calling = wachat_calling::router::<AppState>();
    let wachat_broadcast = wachat_broadcast::router::<AppState>();
    let wachat_features = wachat_features::router::<AppState>();
    let wachat_analytics = wachat_analytics::router::<AppState>();
    let wachat_webhook_actions = wachat_webhook_actions::router::<AppState>();
    let meta_suite = meta_suite::router::<AppState>();
    let meta_token = meta_token::router::<AppState>();
    let meta_flows = meta_flows::router::<AppState>();
    let qr_codes = qr_codes::router::<AppState>();
    let facebook_flow = facebook_flow::router::<AppState>();
    let wachat_public = wachat_public_api::router::<AppState>();
    let wachat_projects = wachat_projects::router::<AppState>();
    let wachat_contacts = wachat_contacts::router::<AppState>();
    let wachat_flows = wachat_flows::router::<AppState>();
    let wachat_api_keys_admin = wachat_api_keys_admin::router::<AppState>();

    Router::new()
        .merge(routes::health::router())
        .merge(wachat_webhook)
        .merge(wachat_webhook_cron)
        .nest("/v1/wachat/webhook", wachat_webhook_admin)
        .nest("/v1/wachat/webhook-actions", wachat_webhook_actions)
        .nest("/v1/wachat/templates", wachat_templates)
        .nest("/v1/wachat/templates-actions", wachat_templates_actions)
        .nest("/v1/wachat/config", wachat_config)
        .nest("/v1/wachat/pay", wachat_pay)
        .nest("/v1/wachat/calling", wachat_calling)
        .nest("/v1/wachat/broadcast", wachat_broadcast)
        .nest("/v1/wachat/features", wachat_features)
        .nest("/v1/wachat/analytics", wachat_analytics)
        .nest("/v1/wachat/public", wachat_public)
        .nest("/v1/wachat", wachat_send)
        .nest("/v1/meta/suite", meta_suite)
        .nest("/v1/meta/token", meta_token)
        .nest("/v1/meta/flows", meta_flows)
        .nest("/v1/qr-codes", qr_codes)
        .nest("/v1/facebook/flow", facebook_flow)
        .nest("/v1/projects", wachat_projects)
        .nest("/v1/contacts", wachat_contacts)
        .nest("/v1/flows", wachat_flows)
        .nest("/v1/api-keys", wachat_api_keys_admin)
        .nest("/v1", v1)
        .with_state(state)
        .layer(SetRequestIdLayer::new(
            request_id_header.clone(),
            MakeRequestUuid,
        ))
        .layer(PropagateRequestIdLayer::new(request_id_header))
        .layer(TraceLayer::new_for_http())
        .layer(TimeoutLayer::with_status_code(
            StatusCode::REQUEST_TIMEOUT,
            Duration::from_secs(30),
        ))
        .layer(cors)
}
