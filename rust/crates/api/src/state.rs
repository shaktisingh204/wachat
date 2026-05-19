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
use url_shortener::UrlShortenerState;
use ad_manager::AdManagerState;
use sabfiles::SabfilesState;
use sabnode_auth::AuthConfig;
use sabnode_db::{mongo::MongoHandle, redis::RedisHandle};
use wachat_analytics::WachatAnalyticsState;
use wachat_broadcast::WachatBroadcastState;
use wachat_calling::WachatCallingState;
use wachat_config::WachatConfigState;
use wachat_features::WachatFeaturesState;
use wachat_pay::WachatPayState;
use wachat_api_keys_admin::WachatApiKeysAdminState;
use wachat_contacts::WachatContactsState;
use wachat_facebook_agents::WachatFacebookAgentsState;
use wachat_facebook_automation::WachatFacebookAutomationState;
use wachat_facebook_business::WachatFacebookBusinessState;
use wachat_facebook_comments::WachatFacebookCommentsState;
use wachat_facebook_content::WachatFacebookContentState;
use wachat_facebook_crm::WachatFacebookCrmState;
use wachat_facebook_events::WachatFacebookEventsState;
use wachat_facebook_lead_gen::WachatFacebookLeadGenState;
use wachat_facebook_messaging::WachatFacebookMessagingState;
use wachat_facebook_messenger_profile::WachatFacebookMessengerProfileState;
use wachat_facebook_misc::WachatFacebookMiscState;
use wachat_facebook_pages::WachatFacebookPagesState;
use wachat_flows::WachatFlowsState;
use wachat_instagram::WachatInstagramState;
use telegram_bots::TelegramBotsState;
use telegram_chats::TelegramChatsState;
use telegram_broadcasts::TelegramBroadcastsState;
use telegram_auto_reply::TelegramAutoReplyState;
use telegram_commands::TelegramCommandsState;
use telegram_bot_profile::TelegramBotProfileState;
use telegram_channels::TelegramChannelsState;
use telegram_analytics::TelegramAnalyticsState;
use telegram_payments::TelegramPaymentsState;
use telegram_stickers::TelegramStickersState;
use telegram_stories::TelegramStoriesState;
use telegram_flows::TelegramFlowsState;
use telegram_mini_apps::TelegramMiniAppsState;
use telegram_ads::TelegramAdsState;
use telegram_api_credentials::TelegramApiCredentialsState;
use telegram_business_inbox::TelegramBusinessInboxState;
use telegram_contacts::TelegramContactsState;
use telegram_settings::TelegramSettingsState;
use telegram_webhooks::{BotApiClient as TelegramWebhooksBotApi, TelegramWebhooksState};
use sabflow_engine::SabflowEngineState;
use sabflow_engine_runtime::SabflowRuntimeState;
use email_audience::EmailAudienceState;
use email_templates::EmailTemplatesState;
use email_inbox::EmailInboxState;
use email_inbound::EmailInboundState;
use email_deliverability::EmailDeliverabilityState;
use email_api::EmailApiState;
use email_webhooks::EmailWebhooksState;
use email_campaigns::EmailCampaignsState;
use wachat_projects::WachatProjectsState;
use wachat_public_api::{ApiKeyVerifier, PublicApiState};
use wachat_send_router::WachatSendState;
use wachat_templates_actions::WachatTemplatesActionsState;
use wachat_templates_router::TemplatesState;
use wachat_webhook::WebhookState;
use wachat_webhook_actions::WachatWebhookActionsState;
use wachat_webhook_status::WachatWebhookStatusState;
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
    pub webhook_status: WachatWebhookStatusState,
    pub meta_suite: MetaSuiteState,
    pub meta_token: MetaTokenState,
    pub meta_flows: MetaFlowsState,
    pub qr_codes: QrCodesState,
    pub url_shortener: UrlShortenerState,
    pub ad_manager: AdManagerState,
    pub facebook_flow: FacebookFlowState,
    pub public_api: PublicApiState,
    pub api_key_verifier: Arc<ApiKeyVerifier>,
    pub projects: WachatProjectsState,
    pub contacts: WachatContactsState,
    pub flows: WachatFlowsState,
    pub api_keys_admin: WachatApiKeysAdminState,
    pub fb_pages: WachatFacebookPagesState,
    pub fb_content: WachatFacebookContentState,
    pub fb_messaging: WachatFacebookMessagingState,
    pub fb_automation: WachatFacebookAutomationState,
    pub fb_crm: WachatFacebookCrmState,
    pub fb_agents: WachatFacebookAgentsState,
    pub fb_business: WachatFacebookBusinessState,
    pub fb_misc: WachatFacebookMiscState,
    pub fb_comments: WachatFacebookCommentsState,
    pub fb_events: WachatFacebookEventsState,
    pub fb_lead_gen: WachatFacebookLeadGenState,
    pub fb_messenger_profile: WachatFacebookMessengerProfileState,
    pub instagram: WachatInstagramState,
    pub sabfiles: SabfilesState,
    pub telegram_bots: TelegramBotsState,
    pub telegram_chats: TelegramChatsState,
    pub telegram_broadcasts: TelegramBroadcastsState,
    pub telegram_auto_reply: TelegramAutoReplyState,
    pub telegram_commands: TelegramCommandsState,
    pub telegram_bot_profile: TelegramBotProfileState,
    pub telegram_channels: TelegramChannelsState,
    pub telegram_analytics: TelegramAnalyticsState,
    pub telegram_payments: TelegramPaymentsState,
    pub telegram_stickers: TelegramStickersState,
    pub telegram_stories: TelegramStoriesState,
    pub telegram_flows: TelegramFlowsState,
    pub telegram_mini_apps: TelegramMiniAppsState,
    pub telegram_ads: TelegramAdsState,
    pub telegram_api_credentials: TelegramApiCredentialsState,
    pub telegram_business_inbox: TelegramBusinessInboxState,
    pub telegram_contacts: TelegramContactsState,
    pub telegram_settings: TelegramSettingsState,
    pub telegram_webhooks: TelegramWebhooksState,
    pub sabflow: SabflowEngineState,
    pub sabflow_runtime: SabflowRuntimeState,
    pub email_audience: EmailAudienceState,
    pub email_templates: EmailTemplatesState,
    pub email_inbox: EmailInboxState,
    pub email_inbound: EmailInboundState,
    pub email_deliverability: EmailDeliverabilityState,
    pub email_api: EmailApiState,
    pub email_webhooks: EmailWebhooksState,
    pub email_campaigns: EmailCampaignsState,
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
        webhook_status: WachatWebhookStatusState,
        meta_suite: MetaSuiteState,
        meta_token: MetaTokenState,
        meta_flows: MetaFlowsState,
        qr_codes: QrCodesState,
        url_shortener: UrlShortenerState,
        ad_manager: AdManagerState,
        facebook_flow: FacebookFlowState,
        public_api: PublicApiState,
        api_key_verifier: Arc<ApiKeyVerifier>,
        projects: WachatProjectsState,
        contacts: WachatContactsState,
        flows: WachatFlowsState,
        api_keys_admin: WachatApiKeysAdminState,
        fb_pages: WachatFacebookPagesState,
        fb_content: WachatFacebookContentState,
        fb_messaging: WachatFacebookMessagingState,
        fb_automation: WachatFacebookAutomationState,
        fb_crm: WachatFacebookCrmState,
        fb_agents: WachatFacebookAgentsState,
        fb_business: WachatFacebookBusinessState,
        fb_misc: WachatFacebookMiscState,
        fb_comments: WachatFacebookCommentsState,
        fb_events: WachatFacebookEventsState,
        fb_lead_gen: WachatFacebookLeadGenState,
        fb_messenger_profile: WachatFacebookMessengerProfileState,
        instagram: WachatInstagramState,
        sabfiles: SabfilesState,
        telegram_bots: TelegramBotsState,
        telegram_chats: TelegramChatsState,
        telegram_broadcasts: TelegramBroadcastsState,
        telegram_auto_reply: TelegramAutoReplyState,
        telegram_commands: TelegramCommandsState,
        telegram_bot_profile: TelegramBotProfileState,
        telegram_channels: TelegramChannelsState,
        telegram_analytics: TelegramAnalyticsState,
        telegram_payments: TelegramPaymentsState,
        telegram_stickers: TelegramStickersState,
        telegram_stories: TelegramStoriesState,
        telegram_flows: TelegramFlowsState,
        telegram_mini_apps: TelegramMiniAppsState,
        telegram_ads: TelegramAdsState,
        telegram_api_credentials: TelegramApiCredentialsState,
        telegram_business_inbox: TelegramBusinessInboxState,
        telegram_contacts: TelegramContactsState,
        telegram_settings: TelegramSettingsState,
        telegram_webhooks: TelegramWebhooksState,
        sabflow: SabflowEngineState,
        email_audience: EmailAudienceState,
        email_templates: EmailTemplatesState,
        email_inbox: EmailInboxState,
        email_inbound: EmailInboundState,
        email_deliverability: EmailDeliverabilityState,
        email_api: EmailApiState,
        email_webhooks: EmailWebhooksState,
        email_campaigns: EmailCampaignsState,
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
            webhook_status,
            meta_suite,
            meta_token,
            meta_flows,
            qr_codes,
            url_shortener,
            ad_manager,
            facebook_flow,
            public_api,
            api_key_verifier,
            projects,
            contacts,
            flows,
            api_keys_admin,
            fb_pages,
            fb_content,
            fb_messaging,
            fb_automation,
            fb_crm,
            fb_agents,
            fb_business,
            fb_misc,
            fb_comments,
            fb_events,
            fb_lead_gen,
            fb_messenger_profile,
            instagram,
            sabfiles,
            telegram_bots,
            telegram_chats,
            telegram_broadcasts,
            telegram_auto_reply,
            telegram_commands,
            telegram_bot_profile,
            telegram_channels,
            telegram_analytics,
            telegram_payments,
            telegram_stickers,
            telegram_stories,
            telegram_flows,
            telegram_mini_apps,
            telegram_ads,
            telegram_api_credentials,
            telegram_business_inbox,
            telegram_contacts,
            telegram_settings,
            telegram_webhooks,
            sabflow,
            sabflow_runtime: SabflowRuntimeState::new(),
            email_audience,
            email_templates,
            email_inbox,
            email_inbound,
            email_deliverability,
            email_api,
            email_webhooks,
            email_campaigns,
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

impl FromRef<AppState> for WachatWebhookStatusState {
    fn from_ref(s: &AppState) -> Self {
        s.webhook_status.clone()
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

impl FromRef<AppState> for UrlShortenerState {
    fn from_ref(s: &AppState) -> Self {
        s.url_shortener.clone()
    }
}

impl FromRef<AppState> for AdManagerState {
    fn from_ref(s: &AppState) -> Self {
        s.ad_manager.clone()
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

impl FromRef<AppState> for WachatProjectsState {
    fn from_ref(s: &AppState) -> Self {
        s.projects.clone()
    }
}

impl FromRef<AppState> for WachatContactsState {
    fn from_ref(s: &AppState) -> Self {
        s.contacts.clone()
    }
}

impl FromRef<AppState> for WachatFlowsState {
    fn from_ref(s: &AppState) -> Self {
        s.flows.clone()
    }
}

impl FromRef<AppState> for WachatApiKeysAdminState {
    fn from_ref(s: &AppState) -> Self {
        s.api_keys_admin.clone()
    }
}

impl FromRef<AppState> for WachatFacebookPagesState {
    fn from_ref(s: &AppState) -> Self {
        s.fb_pages.clone()
    }
}

impl FromRef<AppState> for WachatFacebookContentState {
    fn from_ref(s: &AppState) -> Self {
        s.fb_content.clone()
    }
}

impl FromRef<AppState> for WachatFacebookMessagingState {
    fn from_ref(s: &AppState) -> Self {
        s.fb_messaging.clone()
    }
}

impl FromRef<AppState> for WachatFacebookAutomationState {
    fn from_ref(s: &AppState) -> Self {
        s.fb_automation.clone()
    }
}

impl FromRef<AppState> for WachatFacebookCrmState {
    fn from_ref(s: &AppState) -> Self {
        s.fb_crm.clone()
    }
}

impl FromRef<AppState> for WachatFacebookAgentsState {
    fn from_ref(s: &AppState) -> Self {
        s.fb_agents.clone()
    }
}

impl FromRef<AppState> for WachatFacebookBusinessState {
    fn from_ref(s: &AppState) -> Self {
        s.fb_business.clone()
    }
}

impl FromRef<AppState> for WachatFacebookMiscState {
    fn from_ref(s: &AppState) -> Self {
        s.fb_misc.clone()
    }
}

impl FromRef<AppState> for WachatFacebookCommentsState {
    fn from_ref(s: &AppState) -> Self {
        s.fb_comments.clone()
    }
}

impl FromRef<AppState> for WachatFacebookEventsState {
    fn from_ref(s: &AppState) -> Self {
        s.fb_events.clone()
    }
}

impl FromRef<AppState> for WachatFacebookLeadGenState {
    fn from_ref(s: &AppState) -> Self {
        s.fb_lead_gen.clone()
    }
}

impl FromRef<AppState> for WachatFacebookMessengerProfileState {
    fn from_ref(s: &AppState) -> Self {
        s.fb_messenger_profile.clone()
    }
}

impl FromRef<AppState> for WachatInstagramState {
    fn from_ref(s: &AppState) -> Self {
        s.instagram.clone()
    }
}

impl FromRef<AppState> for SabfilesState {
    fn from_ref(s: &AppState) -> Self {
        s.sabfiles.clone()
    }
}

impl FromRef<AppState> for TelegramBotsState {
    fn from_ref(s: &AppState) -> Self {
        s.telegram_bots.clone()
    }
}

impl FromRef<AppState> for TelegramChatsState {
    fn from_ref(s: &AppState) -> Self {
        s.telegram_chats.clone()
    }
}

impl FromRef<AppState> for TelegramBroadcastsState {
    fn from_ref(s: &AppState) -> Self {
        s.telegram_broadcasts.clone()
    }
}

impl FromRef<AppState> for TelegramAutoReplyState {
    fn from_ref(s: &AppState) -> Self {
        s.telegram_auto_reply.clone()
    }
}

impl FromRef<AppState> for TelegramCommandsState {
    fn from_ref(s: &AppState) -> Self {
        s.telegram_commands.clone()
    }
}

impl FromRef<AppState> for TelegramBotProfileState {
    fn from_ref(s: &AppState) -> Self {
        s.telegram_bot_profile.clone()
    }
}

impl FromRef<AppState> for TelegramChannelsState {
    fn from_ref(s: &AppState) -> Self {
        s.telegram_channels.clone()
    }
}

impl FromRef<AppState> for TelegramAnalyticsState {
    fn from_ref(s: &AppState) -> Self {
        s.telegram_analytics.clone()
    }
}

impl FromRef<AppState> for TelegramPaymentsState {
    fn from_ref(s: &AppState) -> Self {
        s.telegram_payments.clone()
    }
}

impl FromRef<AppState> for TelegramStickersState {
    fn from_ref(s: &AppState) -> Self {
        s.telegram_stickers.clone()
    }
}

impl FromRef<AppState> for TelegramStoriesState {
    fn from_ref(s: &AppState) -> Self {
        s.telegram_stories.clone()
    }
}

impl FromRef<AppState> for TelegramFlowsState {
    fn from_ref(s: &AppState) -> Self {
        s.telegram_flows.clone()
    }
}

impl FromRef<AppState> for TelegramMiniAppsState {
    fn from_ref(s: &AppState) -> Self {
        s.telegram_mini_apps.clone()
    }
}

impl FromRef<AppState> for TelegramAdsState {
    fn from_ref(s: &AppState) -> Self {
        s.telegram_ads.clone()
    }
}

impl FromRef<AppState> for TelegramApiCredentialsState {
    fn from_ref(s: &AppState) -> Self {
        s.telegram_api_credentials.clone()
    }
}

impl FromRef<AppState> for TelegramBusinessInboxState {
    fn from_ref(s: &AppState) -> Self {
        s.telegram_business_inbox.clone()
    }
}

impl FromRef<AppState> for TelegramContactsState {
    fn from_ref(s: &AppState) -> Self {
        s.telegram_contacts.clone()
    }
}

impl FromRef<AppState> for TelegramSettingsState {
    fn from_ref(s: &AppState) -> Self {
        s.telegram_settings.clone()
    }
}

impl FromRef<AppState> for TelegramWebhooksState {
    fn from_ref(s: &AppState) -> Self {
        s.telegram_webhooks.clone()
    }
}

impl FromRef<AppState> for SabflowEngineState {
    fn from_ref(s: &AppState) -> Self {
        s.sabflow.clone()
    }
}

impl FromRef<AppState> for SabflowRuntimeState {
    fn from_ref(s: &AppState) -> Self {
        s.sabflow_runtime.clone()
    }
}

impl FromRef<AppState> for EmailAudienceState {
    fn from_ref(s: &AppState) -> Self {
        s.email_audience.clone()
    }
}

impl FromRef<AppState> for EmailTemplatesState {
    fn from_ref(s: &AppState) -> Self {
        s.email_templates.clone()
    }
}

impl FromRef<AppState> for EmailInboxState {
    fn from_ref(s: &AppState) -> Self {
        s.email_inbox.clone()
    }
}

impl FromRef<AppState> for EmailInboundState {
    fn from_ref(s: &AppState) -> Self {
        s.email_inbound.clone()
    }
}

impl FromRef<AppState> for EmailDeliverabilityState {
    fn from_ref(s: &AppState) -> Self {
        s.email_deliverability.clone()
    }
}

impl FromRef<AppState> for EmailApiState {
    fn from_ref(s: &AppState) -> Self {
        s.email_api.clone()
    }
}

impl FromRef<AppState> for EmailWebhooksState {
    fn from_ref(s: &AppState) -> Self {
        s.email_webhooks.clone()
    }
}

impl FromRef<AppState> for EmailCampaignsState {
    fn from_ref(s: &AppState) -> Self {
        s.email_campaigns.clone()
    }
}
