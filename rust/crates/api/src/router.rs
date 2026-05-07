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
    let wachat_webhook_status = wachat_webhook_status::router::<AppState>();
    let meta_suite = meta_suite::router::<AppState>();
    let meta_token = meta_token::router::<AppState>();
    let meta_flows = meta_flows::router::<AppState>();
    let qr_codes = qr_codes::router::<AppState>();
    let url_shortener = url_shortener::router::<AppState>();
    let ad_manager = ad_manager::router::<AppState>();
    let facebook_flow = facebook_flow::router::<AppState>();
    let wachat_public = wachat_public_api::router::<AppState>();
    let wachat_projects = wachat_projects::router::<AppState>();
    let wachat_contacts = wachat_contacts::router::<AppState>();
    let crm_lookup = crm_lookup::router::<AppState>();
    let wachat_flows = wachat_flows::router::<AppState>();
    let wachat_api_keys_admin = wachat_api_keys_admin::router::<AppState>();
    let fb_pages = wachat_facebook_pages::router::<AppState>();
    let fb_content = wachat_facebook_content::router::<AppState>();
    let fb_messaging = wachat_facebook_messaging::router::<AppState>();
    let fb_automation = wachat_facebook_automation::router::<AppState>();
    let fb_crm = wachat_facebook_crm::router::<AppState>();
    let fb_agents = wachat_facebook_agents::router::<AppState>();
    let fb_business = wachat_facebook_business::router::<AppState>();
    let fb_misc = wachat_facebook_misc::router::<AppState>();
    let fb_comments = wachat_facebook_comments::router::<AppState>();
    let fb_events = wachat_facebook_events::router::<AppState>();
    let fb_lead_gen = wachat_facebook_lead_gen::router::<AppState>();
    let fb_messenger_profile = wachat_facebook_messenger_profile::router::<AppState>();
    let instagram = wachat_instagram::router::<AppState>();
    let sabfiles_router = sabfiles::router::<AppState>();
    let telegram_bots_router = telegram_bots::router::<AppState>();
    let telegram_chats_router = telegram_chats::router::<AppState>();
    let telegram_broadcasts_router = telegram_broadcasts::router::<AppState>();
    let telegram_auto_reply_router = telegram_auto_reply::router::<AppState>();
    let telegram_commands_router = telegram_commands::router::<AppState>();
    let telegram_bot_profile_router = telegram_bot_profile::router::<AppState>();
    let telegram_channels_router = telegram_channels::router::<AppState>();
    let telegram_analytics_router = telegram_analytics::router::<AppState>();
    let telegram_payments_router = telegram_payments::router::<AppState>();
    let telegram_stickers_router = telegram_stickers::router::<AppState>();
    let telegram_stories_router = telegram_stories::router::<AppState>();
    let telegram_flows_router = telegram_flows::router::<AppState>();
    let telegram_mini_apps_router = telegram_mini_apps::router::<AppState>();
    let telegram_ads_router = telegram_ads::router::<AppState>();

    Router::new()
        .merge(routes::health::router())
        .merge(wachat_webhook)
        .merge(wachat_webhook_cron)
        .nest("/v1/wachat/webhook", wachat_webhook_admin)
        .nest("/v1/wachat/webhook-actions", wachat_webhook_actions)
        .nest("/v1/wachat/webhook-status", wachat_webhook_status)
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
        .nest("/v1/url-shortener", url_shortener)
        .nest("/v1/ad-manager", ad_manager)
        .nest("/v1/facebook/flow", facebook_flow)
        .nest("/v1/projects", wachat_projects)
        .nest("/v1/contacts", wachat_contacts)
        .nest("/v1/crm/lookup", crm_lookup)
        .nest("/v1/flows", wachat_flows)
        .nest("/v1/api-keys", wachat_api_keys_admin)
        .nest("/v1/facebook/pages", fb_pages)
        .nest("/v1/facebook/content", fb_content)
        .nest("/v1/facebook/messaging", fb_messaging)
        .nest("/v1/facebook/automation", fb_automation)
        .nest("/v1/facebook/crm", fb_crm)
        .nest("/v1/facebook/agents", fb_agents)
        .nest("/v1/facebook/business", fb_business)
        .nest("/v1/facebook/misc", fb_misc)
        .nest("/v1/facebook/comments", fb_comments)
        .nest("/v1/facebook/events", fb_events)
        .nest("/v1/facebook/lead-gen", fb_lead_gen)
        .nest("/v1/facebook/messenger-profile", fb_messenger_profile)
        .nest("/v1/instagram", instagram)
        .nest("/v1/sabfiles", sabfiles_router)
        .nest("/v1/telegram/bots", telegram_bots_router)
        .nest("/v1/telegram/chats", telegram_chats_router)
        .nest("/v1/telegram/broadcasts", telegram_broadcasts_router)
        .nest("/v1/telegram/auto-reply", telegram_auto_reply_router)
        .nest("/v1/telegram/commands", telegram_commands_router)
        .nest("/v1/telegram/bot-profile", telegram_bot_profile_router)
        .nest("/v1/telegram/channels", telegram_channels_router)
        .nest("/v1/telegram/analytics", telegram_analytics_router)
        .nest("/v1/telegram/payments", telegram_payments_router)
        .nest("/v1/telegram/stickers", telegram_stickers_router)
        .nest("/v1/telegram/stories", telegram_stories_router)
        .nest("/v1/telegram/flows", telegram_flows_router)
        .nest("/v1/telegram/mini-apps", telegram_mini_apps_router)
        .nest("/v1/telegram/ads", telegram_ads_router)
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
