//! Process-wide application state shared with every handler.
//!
//! Cloneable because Axum requires `State` to be `Clone`. The handles inside
//! are themselves cheap to clone (each is `Arc`-backed).
//!
//! `FromRef` impls below let domain crates ask for the specific handle they
//! need (e.g. `State<MongoHandle>`) without depending on this concrete type.

use std::sync::{
    Arc,
    atomic::{AtomicBool, Ordering},
};

use axum::extract::FromRef;
use chrono::{DateTime, Utc};
use facebook_flow::FacebookFlowState;
use meta_flows::MetaFlowsState;
use meta_suite::MetaSuiteState;
use meta_token::MetaTokenState;
use qr_codes::QrCodesState;
use sabnode_auth::AuthConfig;
use sabnode_db::{mongo::MongoHandle, redis::RedisHandle};
use wachat_analytics::WachatAnalyticsState;
use wachat_broadcast::WachatBroadcastState;
use wachat_calling::WachatCallingState;
use wachat_config::WachatConfigState;
use wachat_features::WachatFeaturesState;
use wachat_pay::WachatPayState;
use wachat_public_api::{ApiKeyVerifier, PublicApiState};
use wachat_send_router::WachatSendState;
use wachat_templates_actions::WachatTemplatesActionsState;
use wachat_templates_router::TemplatesState;
use wachat_webhook::WebhookState;
use wachat_webhook_actions::WachatWebhookActionsState;
use wachat_webhook_verify::WebhookVerifier;

#[derive(Clone)]
pub struct AppState {
    pub started_at: DateTime<Utc>,
    pub mongo: MongoHandle,
    pub redis: RedisHandle,
    pub auth: Arc<AuthConfig>,
    pub webhook: WebhookState,
    pub webhook_verifier: Arc<WebhookVerifier>,
    pub templates: TemplatesState,
    pub templates_actions: WachatTemplatesActionsState,
    pub send: WachatSendState,
    pub config: WachatConfigState,
    pub pay: WachatPayState,
    pub broadcast: WachatBroadcastState,
    pub calling: WachatCallingState,
    pub features: WachatFeaturesState,
    pub analytics: WachatAnalyticsState,
    pub webhook_actions: WachatWebhookActionsState,
    pub meta_suite: MetaSuiteState,
    pub meta_token: MetaTokenState,
    pub meta_flows: MetaFlowsState,
    pub qr_codes: QrCodesState,
    pub facebook_flow: FacebookFlowState,
    pub public_api: PublicApiState,
    pub api_key_verifier: Arc<ApiKeyVerifier>,
    pub ready: Arc<AtomicBool>,
}

impl AppState {
    #[allow(clippy::too_many_arguments)]
    pub fn new(
        mongo: MongoHandle,
        redis: RedisHandle,
        auth: Arc<AuthConfig>,
        webhook: WebhookState,
        webhook_verifier: Arc<WebhookVerifier>,
        templates: TemplatesState,
        templates_actions: WachatTemplatesActionsState,
        send: WachatSendState,
        config: WachatConfigState,
        pay: WachatPayState,
        broadcast: WachatBroadcastState,
        calling: WachatCallingState,
        features: WachatFeaturesState,
        analytics: WachatAnalyticsState,
        webhook_actions: WachatWebhookActionsState,
        meta_suite: MetaSuiteState,
        meta_token: MetaTokenState,
        meta_flows: MetaFlowsState,
        qr_codes: QrCodesState,
        facebook_flow: FacebookFlowState,
        public_api: PublicApiState,
        api_key_verifier: Arc<ApiKeyVerifier>,
    ) -> Self {
        Self {
            started_at: Utc::now(),
            mongo,
            redis,
            auth,
            webhook,
            webhook_verifier,
            templates,
            templates_actions,
            send,
            config,
            pay,
            broadcast,
            calling,
            features,
            analytics,
            webhook_actions,
            meta_suite,
            meta_token,
            meta_flows,
            qr_codes,
            facebook_flow,
            public_api,
            api_key_verifier,
            ready: Arc::new(AtomicBool::new(false)),
        }
    }

    pub fn mark_ready(&self) {
        self.ready.store(true, Ordering::SeqCst);
    }

    pub fn is_ready(&self) -> bool {
        self.ready.load(Ordering::SeqCst)
    }
}

impl FromRef<AppState> for MongoHandle {
    fn from_ref(s: &AppState) -> Self {
        s.mongo.clone()
    }
}

impl FromRef<AppState> for RedisHandle {
    fn from_ref(s: &AppState) -> Self {
        s.redis.clone()
    }
}

impl FromRef<AppState> for Arc<AuthConfig> {
    fn from_ref(s: &AppState) -> Self {
        s.auth.clone()
    }
}

impl FromRef<AppState> for WebhookState {
    fn from_ref(s: &AppState) -> Self {
        s.webhook.clone()
    }
}

impl FromRef<AppState> for Arc<WebhookVerifier> {
    fn from_ref(s: &AppState) -> Self {
        s.webhook_verifier.clone()
    }
}

impl FromRef<AppState> for TemplatesState {
    fn from_ref(s: &AppState) -> Self {
        s.templates.clone()
    }
}

impl FromRef<AppState> for WachatTemplatesActionsState {
    fn from_ref(s: &AppState) -> Self {
        s.templates_actions.clone()
    }
}

impl FromRef<AppState> for WachatSendState {
    fn from_ref(s: &AppState) -> Self {
        s.send.clone()
    }
}

impl FromRef<AppState> for WachatConfigState {
    fn from_ref(s: &AppState) -> Self {
        s.config.clone()
    }
}

impl FromRef<AppState> for WachatPayState {
    fn from_ref(s: &AppState) -> Self {
        s.pay.clone()
    }
}

impl FromRef<AppState> for WachatAnalyticsState {
    fn from_ref(s: &AppState) -> Self {
        s.analytics.clone()
    }
}

impl FromRef<AppState> for WachatWebhookActionsState {
    fn from_ref(s: &AppState) -> Self {
        s.webhook_actions.clone()
    }
}

impl FromRef<AppState> for MetaSuiteState {
    fn from_ref(s: &AppState) -> Self {
        s.meta_suite.clone()
    }
}

impl FromRef<AppState> for MetaTokenState {
    fn from_ref(s: &AppState) -> Self {
        s.meta_token.clone()
    }
}

impl FromRef<AppState> for MetaFlowsState {
    fn from_ref(s: &AppState) -> Self {
        s.meta_flows.clone()
    }
}

impl FromRef<AppState> for WachatBroadcastState {
    fn from_ref(s: &AppState) -> Self {
        s.broadcast.clone()
    }
}

impl FromRef<AppState> for WachatCallingState {
    fn from_ref(s: &AppState) -> Self {
        s.calling.clone()
    }
}

impl FromRef<AppState> for WachatFeaturesState {
    fn from_ref(s: &AppState) -> Self {
        s.features.clone()
    }
}

impl FromRef<AppState> for QrCodesState {
    fn from_ref(s: &AppState) -> Self {
        s.qr_codes.clone()
    }
}

impl FromRef<AppState> for FacebookFlowState {
    fn from_ref(s: &AppState) -> Self {
        s.facebook_flow.clone()
    }
}

impl FromRef<AppState> for PublicApiState {
    fn from_ref(s: &AppState) -> Self {
        s.public_api.clone()
    }
}

impl FromRef<AppState> for Arc<ApiKeyVerifier> {
    fn from_ref(s: &AppState) -> Self {
        s.api_key_verifier.clone()
    }
}
