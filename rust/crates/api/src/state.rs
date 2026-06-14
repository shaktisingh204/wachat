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

use ad_manager::AdManagerState;
use axum::extract::FromRef;
use chrono::{DateTime, Utc};
use email_api::EmailApiState;
use email_audience::EmailAudienceState;
use email_campaigns::EmailCampaignsState;
use email_deliverability::EmailDeliverabilityState;
use email_events::EmailEventsState;
use email_inbound::EmailInboundState;
use email_inbox::EmailInboxState;
use email_journeys::EmailJourneysState;
use email_reports::EmailReportsState;
use email_templates::EmailTemplatesState;
use email_webhooks::EmailWebhooksState;
use facebook_flow::FacebookFlowState;
use meta_flows::MetaFlowsState;
use meta_suite::MetaSuiteState;
use meta_token::MetaTokenState;
use qr_codes::QrCodesState;
use sabfiles::SabfilesState;
use sabflow_engine::SabflowEngineState;
use sabflow_engine_runtime::SabflowRuntimeState;
use sabnode_auth::AuthConfig;
use sabnode_db::{mongo::MongoHandle, redis::RedisHandle};
use telegram_ads::TelegramAdsState;
use telegram_analytics::TelegramAnalyticsState;
use telegram_api_credentials::TelegramApiCredentialsState;
use telegram_auto_reply::TelegramAutoReplyState;
use telegram_bot_profile::TelegramBotProfileState;
use telegram_bots::TelegramBotsState;
use telegram_broadcasts::TelegramBroadcastsState;
use telegram_business_inbox::TelegramBusinessInboxState;
use telegram_channels::TelegramChannelsState;
use telegram_chats::TelegramChatsState;
use telegram_commands::TelegramCommandsState;
use telegram_contacts::TelegramContactsState;
use telegram_flows::TelegramFlowsState;
use telegram_mini_apps::TelegramMiniAppsState;
use telegram_payments::TelegramPaymentsState;
use telegram_settings::TelegramSettingsState;
use telegram_stickers::TelegramStickersState;
use telegram_stories::TelegramStoriesState;
use telegram_webhooks::TelegramWebhooksState;
use url_shortener::UrlShortenerState;
use wachat_analytics::WachatAnalyticsState;
use wachat_api_keys_admin::WachatApiKeysAdminState;
use wachat_broadcast::WachatBroadcastState;
use wachat_calling::WachatCallingState;
use wachat_config::WachatConfigState;
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
use wachat_features::WachatFeaturesState;
use wachat_flows::WachatFlowsState;
use wachat_instagram::WachatInstagramState;
use wachat_pay::WachatPayState;
use wachat_projects::WachatProjectsState;
use wachat_public_api::{ApiKeyVerifier, PublicApiState};
use wachat_send_router::WachatSendState;
use wachat_templates_actions::WachatTemplatesActionsState;
use wachat_templates_router::TemplatesState;
use wachat_webhook::WebhookState;
use wachat_webhook_actions::WachatWebhookActionsState;
use wachat_webhook_status::WachatWebhookStatusState;
use wachat_webhook_verify::WebhookVerifier;

use sabchat_audit::SabChatAuditState;
use sabchat_contacts::SabChatContactsState;
use sabchat_conversations::SabChatConversationsState;
use sabchat_inboxes::SabChatInboxesState;
use sabchat_messages::SabChatMessagesState;
use sabchat_routing::SabChatRoutingState;
use sabchat_widget::SabChatWidgetState;
use sabchat_ws::{SabChatWsState, WsHub};

use sabchat_ad_attribution::SabChatAdAttributionState;
use sabchat_ai_copilot::SabChatAiCopilotState;
use sabchat_ai_qa::SabChatAiQaState;
use sabchat_ai_resolve_bot::SabChatAiResolveBotState;
use sabchat_ai_sentiment::SabChatAiSentimentState;
use sabchat_ai_translate::SabChatAiTranslateState;
use sabchat_ai_voc::SabChatAiVocState;
use sabchat_business_hours::SabChatBusinessHoursState;
use sabchat_cart_recovery::SabChatCartRecoveryState;
use sabchat_channel_apple::SabChatChannelAppleState;
use sabchat_channel_email::SabChatChannelEmailState;
use sabchat_channel_facebook::SabChatChannelFacebookState;
use sabchat_channel_gbm::SabChatChannelGbmState;
use sabchat_channel_instagram::SabChatChannelInstagramState;
use sabchat_channel_line::SabChatChannelLineState;
use sabchat_channel_sms::SabChatChannelSmsState;
use sabchat_channel_telegram::SabChatChannelTelegramState;
use sabchat_channel_viber::SabChatChannelViberState;
use sabchat_channel_whatsapp::SabChatChannelWhatsappState;
use sabchat_channel_x::SabChatChannelXState;
use sabchat_cobrowse::SabChatCobrowseState;
use sabchat_commerce::SabChatCommerceState;
use sabchat_compliance::SabChatComplianceState;
use sabchat_crm_bridge::SabChatCrmBridgeState;
use sabchat_csat::SabChatCsatState;
use sabchat_dispositions::SabChatDispositionsState;
use sabchat_events::SabChatEventsState;
use sabchat_gamification::SabChatGamificationState;
use sabchat_knowledge::SabChatKnowledgeState;
use sabchat_macros::SabChatMacrosState;
use sabchat_marketplace::SabChatMarketplaceState;
use sabchat_public_api::SabChatPublicApiState;
use sabchat_ai_actions::SabChatAiActionsState;
use sabchat_collab::SabChatCollabState;
use sabchat_community::SabChatCommunityState;
use sabchat_journeys::SabChatJourneysState;
use sabchat_reports::SabChatReportsState;
use sabchat_sabflow_nodes::SabChatSabflowNodesState;
use sabchat_shifts::SabChatShiftsState;
use sabchat_sla::SabChatSlaState;
use sabchat_sso::SabChatSsoState;
use sabchat_teams::SabChatTeamsState;
use sabchat_voice::SabChatVoiceState;
use sabchat_webhooks::SabChatWebhooksState;

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
    pub email_events: EmailEventsState,
    pub email_reports: EmailReportsState,
    pub email_journeys: EmailJourneysState,

    // SabChat — Pillar 1 + 2 foundation.
    pub sabchat_inboxes: SabChatInboxesState,
    pub sabchat_contacts: SabChatContactsState,
    pub sabchat_conversations: SabChatConversationsState,
    pub sabchat_messages: SabChatMessagesState,
    pub sabchat_audit: SabChatAuditState,
    pub sabchat_routing: SabChatRoutingState,
    pub sabchat_widget: SabChatWidgetState,
    pub sabchat_ws: SabChatWsState,
    pub sabchat_ws_hub: WsHub,

    pub sabchat_channel_whatsapp: SabChatChannelWhatsappState,
    pub sabchat_channel_instagram: SabChatChannelInstagramState,
    pub sabchat_channel_facebook: SabChatChannelFacebookState,
    pub sabchat_channel_telegram: SabChatChannelTelegramState,
    pub sabchat_channel_email: SabChatChannelEmailState,
    pub sabchat_channel_sms: SabChatChannelSmsState,
    pub sabchat_ai_copilot: SabChatAiCopilotState,
    pub sabchat_ai_translate: SabChatAiTranslateState,
    pub sabchat_ai_sentiment: SabChatAiSentimentState,
    pub sabchat_ai_resolve_bot: SabChatAiResolveBotState,
    pub sabchat_macros: SabChatMacrosState,
    pub sabchat_sla: SabChatSlaState,
    pub sabchat_business_hours: SabChatBusinessHoursState,
    pub sabchat_crm_bridge: SabChatCrmBridgeState,
    pub sabchat_knowledge: SabChatKnowledgeState,
    pub sabchat_commerce: SabChatCommerceState,
    pub sabchat_reports: SabChatReportsState,
    pub sabchat_teams: SabChatTeamsState,
    pub sabchat_webhooks: SabChatWebhooksState,
    pub sabchat_public_api: SabChatPublicApiState,
    pub sabchat_events: SabChatEventsState,
    pub sabchat_voice: SabChatVoiceState,
    pub sabchat_cobrowse: SabChatCobrowseState,
    pub sabchat_shifts: SabChatShiftsState,
    pub sabchat_community: SabChatCommunityState,
    pub sabchat_journeys: SabChatJourneysState,
    pub sabchat_ai_actions: SabChatAiActionsState,
    pub sabchat_collab: SabChatCollabState,
    pub sabchat_csat: SabChatCsatState,
    pub sabchat_dispositions: SabChatDispositionsState,
    pub sabchat_gamification: SabChatGamificationState,
    pub sabchat_compliance: SabChatComplianceState,
    pub sabchat_sso: SabChatSsoState,
    pub sabchat_ai_qa: SabChatAiQaState,
    pub sabchat_ai_voc: SabChatAiVocState,
    pub sabchat_sabflow_nodes: SabChatSabflowNodesState,
    pub sabchat_cart_recovery: SabChatCartRecoveryState,
    pub sabchat_ad_attribution: SabChatAdAttributionState,
    pub sabchat_channel_line: SabChatChannelLineState,
    pub sabchat_channel_viber: SabChatChannelViberState,
    pub sabchat_channel_apple: SabChatChannelAppleState,
    pub sabchat_channel_gbm: SabChatChannelGbmState,
    pub sabchat_channel_x: SabChatChannelXState,
    pub sabchat_marketplace: SabChatMarketplaceState,

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
        email_events: EmailEventsState,
        email_reports: EmailReportsState,
        email_journeys: EmailJourneysState,
        sabchat_inboxes: SabChatInboxesState,
        sabchat_contacts: SabChatContactsState,
        sabchat_conversations: SabChatConversationsState,
        sabchat_messages: SabChatMessagesState,
        sabchat_audit: SabChatAuditState,
        sabchat_routing: SabChatRoutingState,
        sabchat_widget: SabChatWidgetState,
        sabchat_channel_whatsapp: SabChatChannelWhatsappState,
        sabchat_channel_instagram: SabChatChannelInstagramState,
        sabchat_channel_facebook: SabChatChannelFacebookState,
        sabchat_channel_telegram: SabChatChannelTelegramState,
        sabchat_channel_email: SabChatChannelEmailState,
        sabchat_channel_sms: SabChatChannelSmsState,
        sabchat_ai_copilot: SabChatAiCopilotState,
        sabchat_ai_translate: SabChatAiTranslateState,
        sabchat_ai_sentiment: SabChatAiSentimentState,
        sabchat_ai_resolve_bot: SabChatAiResolveBotState,
        sabchat_macros: SabChatMacrosState,
        sabchat_sla: SabChatSlaState,
        sabchat_business_hours: SabChatBusinessHoursState,
        sabchat_crm_bridge: SabChatCrmBridgeState,
        sabchat_knowledge: SabChatKnowledgeState,
        sabchat_commerce: SabChatCommerceState,
        sabchat_reports: SabChatReportsState,
        sabchat_teams: SabChatTeamsState,
        sabchat_webhooks: SabChatWebhooksState,
        sabchat_public_api: SabChatPublicApiState,
        sabchat_events: SabChatEventsState,
        sabchat_voice: SabChatVoiceState,
        sabchat_cobrowse: SabChatCobrowseState,
        sabchat_shifts: SabChatShiftsState,
        sabchat_community: SabChatCommunityState,
        sabchat_journeys: SabChatJourneysState,
        sabchat_ai_actions: SabChatAiActionsState,
        sabchat_collab: SabChatCollabState,
        sabchat_csat: SabChatCsatState,
        sabchat_dispositions: SabChatDispositionsState,
        sabchat_gamification: SabChatGamificationState,
        sabchat_compliance: SabChatComplianceState,
        sabchat_sso: SabChatSsoState,
        sabchat_ai_qa: SabChatAiQaState,
        sabchat_ai_voc: SabChatAiVocState,
        sabchat_sabflow_nodes: SabChatSabflowNodesState,
        sabchat_cart_recovery: SabChatCartRecoveryState,
        sabchat_ad_attribution: SabChatAdAttributionState,
        sabchat_channel_line: SabChatChannelLineState,
        sabchat_channel_viber: SabChatChannelViberState,
        sabchat_channel_apple: SabChatChannelAppleState,
        sabchat_channel_gbm: SabChatChannelGbmState,
        sabchat_channel_x: SabChatChannelXState,
        sabchat_marketplace: SabChatMarketplaceState,
    ) -> Self {
        let sabchat_ws_hub = WsHub::new(redis.clone());
        let sabchat_ws = SabChatWsState {
            hub: sabchat_ws_hub.clone(),
        };
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
            email_events,
            email_reports,
            email_journeys,
            sabchat_inboxes,
            sabchat_contacts,
            sabchat_conversations,
            sabchat_messages,
            sabchat_audit,
            sabchat_routing,
            sabchat_widget,
            sabchat_ws,
            sabchat_ws_hub,
            sabchat_channel_whatsapp,
            sabchat_channel_instagram,
            sabchat_channel_facebook,
            sabchat_channel_telegram,
            sabchat_channel_email,
            sabchat_channel_sms,
            sabchat_ai_copilot,
            sabchat_ai_translate,
            sabchat_ai_sentiment,
            sabchat_ai_resolve_bot,
            sabchat_macros,
            sabchat_sla,
            sabchat_business_hours,
            sabchat_crm_bridge,
            sabchat_knowledge,
            sabchat_commerce,
            sabchat_reports,
            sabchat_teams,
            sabchat_webhooks,
            sabchat_public_api,
            sabchat_events,
            sabchat_voice,
            sabchat_cobrowse,
            sabchat_shifts,
            sabchat_community,
            sabchat_journeys,
            sabchat_ai_actions,
            sabchat_collab,
            sabchat_csat,
            sabchat_dispositions,
            sabchat_gamification,
            sabchat_compliance,
            sabchat_sso,
            sabchat_ai_qa,
            sabchat_ai_voc,
            sabchat_sabflow_nodes,
            sabchat_cart_recovery,
            sabchat_ad_attribution,
            sabchat_channel_line,
            sabchat_channel_viber,
            sabchat_channel_apple,
            sabchat_channel_gbm,
            sabchat_channel_x,
            sabchat_marketplace,
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

impl FromRef<AppState> for SabChatTeamsState {
    fn from_ref(s: &AppState) -> Self {
        s.sabchat_teams.clone()
    }
}

impl FromRef<AppState> for SabChatWebhooksState {
    fn from_ref(s: &AppState) -> Self {
        s.sabchat_webhooks.clone()
    }
}
impl FromRef<AppState> for SabChatPublicApiState {
    fn from_ref(s: &AppState) -> Self {
        s.sabchat_public_api.clone()
    }
}
impl FromRef<AppState> for SabChatEventsState {
    fn from_ref(s: &AppState) -> Self {
        s.sabchat_events.clone()
    }
}
impl FromRef<AppState> for SabChatVoiceState {
    fn from_ref(s: &AppState) -> Self {
        s.sabchat_voice.clone()
    }
}
impl FromRef<AppState> for SabChatCobrowseState {
    fn from_ref(s: &AppState) -> Self {
        s.sabchat_cobrowse.clone()
    }
}
impl FromRef<AppState> for SabChatShiftsState {
    fn from_ref(s: &AppState) -> Self {
        s.sabchat_shifts.clone()
    }
}
impl FromRef<AppState> for SabChatCommunityState {
    fn from_ref(s: &AppState) -> Self {
        s.sabchat_community.clone()
    }
}
impl FromRef<AppState> for SabChatJourneysState {
    fn from_ref(s: &AppState) -> Self {
        s.sabchat_journeys.clone()
    }
}
impl FromRef<AppState> for SabChatAiActionsState {
    fn from_ref(s: &AppState) -> Self {
        s.sabchat_ai_actions.clone()
    }
}
impl FromRef<AppState> for SabChatCollabState {
    fn from_ref(s: &AppState) -> Self {
        s.sabchat_collab.clone()
    }
}
impl FromRef<AppState> for SabChatCsatState {
    fn from_ref(s: &AppState) -> Self {
        s.sabchat_csat.clone()
    }
}
impl FromRef<AppState> for SabChatDispositionsState {
    fn from_ref(s: &AppState) -> Self {
        s.sabchat_dispositions.clone()
    }
}
impl FromRef<AppState> for SabChatGamificationState {
    fn from_ref(s: &AppState) -> Self {
        s.sabchat_gamification.clone()
    }
}
impl FromRef<AppState> for SabChatComplianceState {
    fn from_ref(s: &AppState) -> Self {
        s.sabchat_compliance.clone()
    }
}
impl FromRef<AppState> for SabChatSsoState {
    fn from_ref(s: &AppState) -> Self {
        s.sabchat_sso.clone()
    }
}
impl FromRef<AppState> for SabChatAiQaState {
    fn from_ref(s: &AppState) -> Self {
        s.sabchat_ai_qa.clone()
    }
}
impl FromRef<AppState> for SabChatAiVocState {
    fn from_ref(s: &AppState) -> Self {
        s.sabchat_ai_voc.clone()
    }
}
impl FromRef<AppState> for SabChatSabflowNodesState {
    fn from_ref(s: &AppState) -> Self {
        s.sabchat_sabflow_nodes.clone()
    }
}
impl FromRef<AppState> for SabChatCartRecoveryState {
    fn from_ref(s: &AppState) -> Self {
        s.sabchat_cart_recovery.clone()
    }
}
impl FromRef<AppState> for SabChatAdAttributionState {
    fn from_ref(s: &AppState) -> Self {
        s.sabchat_ad_attribution.clone()
    }
}
impl FromRef<AppState> for SabChatChannelLineState {
    fn from_ref(s: &AppState) -> Self {
        s.sabchat_channel_line.clone()
    }
}
impl FromRef<AppState> for SabChatChannelViberState {
    fn from_ref(s: &AppState) -> Self {
        s.sabchat_channel_viber.clone()
    }
}
impl FromRef<AppState> for SabChatChannelAppleState {
    fn from_ref(s: &AppState) -> Self {
        s.sabchat_channel_apple.clone()
    }
}
impl FromRef<AppState> for SabChatChannelGbmState {
    fn from_ref(s: &AppState) -> Self {
        s.sabchat_channel_gbm.clone()
    }
}
impl FromRef<AppState> for SabChatChannelXState {
    fn from_ref(s: &AppState) -> Self {
        s.sabchat_channel_x.clone()
    }
}
impl FromRef<AppState> for SabChatMarketplaceState {
    fn from_ref(s: &AppState) -> Self {
        s.sabchat_marketplace.clone()
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

impl FromRef<AppState> for EmailEventsState {
    fn from_ref(s: &AppState) -> Self {
        s.email_events.clone()
    }
}

impl FromRef<AppState> for EmailReportsState {
    fn from_ref(s: &AppState) -> Self {
        s.email_reports.clone()
    }
}

impl FromRef<AppState> for EmailJourneysState {
    fn from_ref(s: &AppState) -> Self {
        s.email_journeys.clone()
    }
}

impl FromRef<AppState> for SabChatInboxesState {
    fn from_ref(s: &AppState) -> Self {
        s.sabchat_inboxes.clone()
    }
}

impl FromRef<AppState> for SabChatContactsState {
    fn from_ref(s: &AppState) -> Self {
        s.sabchat_contacts.clone()
    }
}

impl FromRef<AppState> for SabChatConversationsState {
    fn from_ref(s: &AppState) -> Self {
        s.sabchat_conversations.clone()
    }
}

impl FromRef<AppState> for SabChatMessagesState {
    fn from_ref(s: &AppState) -> Self {
        s.sabchat_messages.clone()
    }
}

impl FromRef<AppState> for SabChatAuditState {
    fn from_ref(s: &AppState) -> Self {
        s.sabchat_audit.clone()
    }
}

impl FromRef<AppState> for SabChatRoutingState {
    fn from_ref(s: &AppState) -> Self {
        s.sabchat_routing.clone()
    }
}

impl FromRef<AppState> for SabChatWidgetState {
    fn from_ref(s: &AppState) -> Self {
        s.sabchat_widget.clone()
    }
}

impl FromRef<AppState> for SabChatWsState {
    fn from_ref(s: &AppState) -> Self {
        s.sabchat_ws.clone()
    }
}

impl FromRef<AppState> for WsHub {
    fn from_ref(s: &AppState) -> Self {
        s.sabchat_ws_hub.clone()
    }
}

impl FromRef<AppState> for SabChatChannelWhatsappState {
    fn from_ref(s: &AppState) -> Self {
        s.sabchat_channel_whatsapp.clone()
    }
}
impl FromRef<AppState> for SabChatChannelInstagramState {
    fn from_ref(s: &AppState) -> Self {
        s.sabchat_channel_instagram.clone()
    }
}
impl FromRef<AppState> for SabChatChannelFacebookState {
    fn from_ref(s: &AppState) -> Self {
        s.sabchat_channel_facebook.clone()
    }
}
impl FromRef<AppState> for SabChatChannelTelegramState {
    fn from_ref(s: &AppState) -> Self {
        s.sabchat_channel_telegram.clone()
    }
}
impl FromRef<AppState> for SabChatChannelEmailState {
    fn from_ref(s: &AppState) -> Self {
        s.sabchat_channel_email.clone()
    }
}
impl FromRef<AppState> for SabChatChannelSmsState {
    fn from_ref(s: &AppState) -> Self {
        s.sabchat_channel_sms.clone()
    }
}
impl FromRef<AppState> for SabChatAiCopilotState {
    fn from_ref(s: &AppState) -> Self {
        s.sabchat_ai_copilot.clone()
    }
}
impl FromRef<AppState> for SabChatAiTranslateState {
    fn from_ref(s: &AppState) -> Self {
        s.sabchat_ai_translate.clone()
    }
}
impl FromRef<AppState> for SabChatAiSentimentState {
    fn from_ref(s: &AppState) -> Self {
        s.sabchat_ai_sentiment.clone()
    }
}
impl FromRef<AppState> for SabChatAiResolveBotState {
    fn from_ref(s: &AppState) -> Self {
        s.sabchat_ai_resolve_bot.clone()
    }
}
impl FromRef<AppState> for SabChatMacrosState {
    fn from_ref(s: &AppState) -> Self {
        s.sabchat_macros.clone()
    }
}
impl FromRef<AppState> for SabChatSlaState {
    fn from_ref(s: &AppState) -> Self {
        s.sabchat_sla.clone()
    }
}
impl FromRef<AppState> for SabChatBusinessHoursState {
    fn from_ref(s: &AppState) -> Self {
        s.sabchat_business_hours.clone()
    }
}
impl FromRef<AppState> for SabChatCrmBridgeState {
    fn from_ref(s: &AppState) -> Self {
        s.sabchat_crm_bridge.clone()
    }
}
impl FromRef<AppState> for SabChatKnowledgeState {
    fn from_ref(s: &AppState) -> Self {
        s.sabchat_knowledge.clone()
    }
}
impl FromRef<AppState> for SabChatCommerceState {
    fn from_ref(s: &AppState) -> Self {
        s.sabchat_commerce.clone()
    }
}
impl FromRef<AppState> for SabChatReportsState {
    fn from_ref(s: &AppState) -> Self {
        s.sabchat_reports.clone()
    }
}
// (SabChatTeamsState FromRef impl already defined at line ~792 — second
// declaration removed to avoid E0119 conflicting-impl.)

// ─── §17: derive-from-mongo FromRef impls for sabcatalyst-* states ─────
// These crates' State structs are thin wrappers around MongoHandle, so we
// can construct them on demand without adding fields to AppState.
impl FromRef<AppState> for sabcatalyst_records::state::SabcatalystRecordsState {
    fn from_ref(s: &AppState) -> Self {
        sabcatalyst_records::state::SabcatalystRecordsState::new(s.mongo.clone())
    }
}

// ─── WaChat completion crates: thin Mongo-only states constructed on demand ──
// These crates wrap only a MongoHandle, so they need no AppState field — we
// build them from `s.mongo` in `FromRef`, mirroring the sabcatalyst pattern.
impl FromRef<AppState> for wachat_number_routing::WachatNumberRoutingState {
    fn from_ref(s: &AppState) -> Self {
        wachat_number_routing::WachatNumberRoutingState::new(s.mongo.clone())
    }
}
impl FromRef<AppState> for wachat_razorpay::WachatRazorpayState {
    fn from_ref(s: &AppState) -> Self {
        wachat_razorpay::WachatRazorpayState::new(s.mongo.clone())
    }
}
impl FromRef<AppState> for wachat_post_generator::WachatPostGeneratorState {
    fn from_ref(s: &AppState) -> Self {
        wachat_post_generator::WachatPostGeneratorState::new(s.mongo.clone())
    }
}
impl FromRef<AppState> for wachat_contacts_export_sync::WachatContactsExportSyncState {
    fn from_ref(s: &AppState) -> Self {
        wachat_contacts_export_sync::WachatContactsExportSyncState::new(s.mongo.clone())
    }
}
impl FromRef<AppState> for wachat_ab_testing::WachatAbTestingState {
    fn from_ref(s: &AppState) -> Self {
        wachat_ab_testing::WachatAbTestingState::new(s.mongo.clone())
    }
}
impl FromRef<AppState> for wachat_contact_merge::WachatContactMergeState {
    fn from_ref(s: &AppState) -> Self {
        wachat_contact_merge::WachatContactMergeState::new(s.mongo.clone())
    }
}
impl FromRef<AppState> for wachat_auto_reply_settings::WachatAutoReplySettingsState {
    fn from_ref(s: &AppState) -> Self {
        wachat_auto_reply_settings::WachatAutoReplySettingsState::new(s.mongo.clone())
    }
}
impl FromRef<AppState> for wachat_project_agents::WachatProjectAgentsState {
    fn from_ref(s: &AppState) -> Self {
        wachat_project_agents::WachatProjectAgentsState::new(s.mongo.clone())
    }
}
impl FromRef<AppState> for wachat_project_attributes::WachatProjectAttributesState {
    fn from_ref(s: &AppState) -> Self {
        wachat_project_attributes::WachatProjectAttributesState::new(s.mongo.clone())
    }
}
impl FromRef<AppState> for wachat_link_generator::WachatLinkGeneratorState {
    fn from_ref(s: &AppState) -> Self {
        wachat_link_generator::WachatLinkGeneratorState::new(s.mongo.clone())
    }
}
impl FromRef<AppState> for wachat_widget_tracking::WachatWidgetTrackingState {
    fn from_ref(s: &AppState) -> Self {
        wachat_widget_tracking::WachatWidgetTrackingState::new(s.mongo.clone())
    }
}
impl FromRef<AppState> for wachat_integrations_hub::WachatIntegrationsHubState {
    fn from_ref(s: &AppState) -> Self {
        wachat_integrations_hub::WachatIntegrationsHubState::new(s.mongo.clone())
    }
}
impl FromRef<AppState> for wachat_canned_messages::WachatCannedMessagesState {
    fn from_ref(s: &AppState) -> Self {
        wachat_canned_messages::WachatCannedMessagesState::new(s.mongo.clone())
    }
}
impl FromRef<AppState> for wachat_ai_training::WachatAiTrainingState {
    fn from_ref(s: &AppState) -> Self {
        wachat_ai_training::WachatAiTrainingState::new(s.mongo.clone())
    }
}
impl FromRef<AppState> for wachat_interactive_builder::WachatInteractiveBuilderState {
    fn from_ref(s: &AppState) -> Self {
        wachat_interactive_builder::WachatInteractiveBuilderState::new(s.mongo.clone())
    }
}
impl FromRef<AppState> for wachat_setup_kb::WachatSetupKbState {
    fn from_ref(s: &AppState) -> Self {
        wachat_setup_kb::WachatSetupKbState::new(s.mongo.clone())
    }
}
impl FromRef<AppState> for wachat_ads_roadmap::WachatAdsRoadmapState {
    fn from_ref(s: &AppState) -> Self {
        wachat_ads_roadmap::WachatAdsRoadmapState::new(s.mongo.clone())
    }
}
impl FromRef<AppState> for wachat_quality_history::WachatQualityHistoryState {
    fn from_ref(s: &AppState) -> Self {
        wachat_quality_history::WachatQualityHistoryState::new(s.mongo.clone())
    }
}
impl FromRef<AppState> for wachat_flow_events::WachatFlowEventsState {
    fn from_ref(s: &AppState) -> Self {
        wachat_flow_events::WachatFlowEventsState::new(s.mongo.clone())
    }
}
impl FromRef<AppState> for wachat_opt_out_settings::WachatOptOutSettingsState {
    fn from_ref(s: &AppState) -> Self {
        wachat_opt_out_settings::WachatOptOutSettingsState::new(s.mongo.clone())
    }
}
impl FromRef<AppState> for sabcatalyst_usage::state::SabcatalystUsageState {
    fn from_ref(s: &AppState) -> Self {
        sabcatalyst_usage::state::SabcatalystUsageState::new(s.mongo.clone())
    }
}
impl FromRef<AppState> for sabcatalyst_api_keys::state::SabcatalystApiKeysState {
    fn from_ref(s: &AppState) -> Self {
        sabcatalyst_api_keys::state::SabcatalystApiKeysState::new(s.mongo.clone())
    }
}
impl FromRef<AppState> for sabcatalyst_auth_sessions::state::SabcatalystAuthSessionsState {
    fn from_ref(s: &AppState) -> Self {
        sabcatalyst_auth_sessions::state::SabcatalystAuthSessionsState::new(s.mongo.clone())
    }
}
impl FromRef<AppState> for sabcatalyst_file_store::state::SabcatalystFileStoreState {
    fn from_ref(s: &AppState) -> Self {
        sabcatalyst_file_store::state::SabcatalystFileStoreState::new(s.mongo.clone())
    }
}
