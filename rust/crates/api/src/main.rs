//! `sabnode-api` binary entrypoint.
//!
//! Boots the tokio runtime, loads configuration, initializes tracing and DB
//! handles, builds the router, serves HTTP with graceful shutdown on
//! SIGINT/SIGTERM.

mod router;
mod routes;
mod state;

use std::{net::SocketAddr, sync::Arc};

use ad_manager::AdManagerState;
use anyhow::Context;
use common::Settings;
use crm_lookup::indexes as crm_lookup_indexes;
use facebook_flow::FacebookFlowState;
use meta_flows::MetaFlowsState;
use meta_suite::MetaSuiteState;
use meta_token::MetaTokenState;
use qr_codes::QrCodesState;
use sabfiles::{
    SabfilesState,
    r2::{R2Client, R2Config},
};
use sabnode_auth::AuthConfig;
use sabnode_db::{mongo::MongoHandle, redis::RedisHandle};
use tokio::{net::TcpListener, signal};
use tracing::{error, info};
use url_shortener::UrlShortenerState;
use wachat_analytics::WachatAnalyticsState;
use wachat_api_keys_admin::WachatApiKeysAdminState;
use wachat_broadcast::WachatBroadcastState;
use wachat_calling::WachatCallingState;
use wachat_chat_mark::ChatMarker;
use wachat_config::WachatConfigState;
use wachat_contacts::WachatContactsState;
use wachat_features::WachatFeaturesState;

use sabchat_audit::SabChatAuditState;
use sabchat_contacts::SabChatContactsState;
use sabchat_conversations::SabChatConversationsState;
use sabchat_inboxes::SabChatInboxesState;
use sabchat_messages::SabChatMessagesState;
use sabchat_routing::SabChatRoutingState;
use sabchat_widget::SabChatWidgetState;

use sabchat_ad_attribution::SabChatAdAttributionState;
use sabchat_ai_copilot::SabChatAiCopilotState;
use sabchat_ai_qa::SabChatAiQaState;
use sabchat_ai_resolve_bot::{SabChatAiResolveBotState, llm::make_bot_from_env};
use sabchat_ai_sentiment::{SabChatAiSentimentState, make_classifier_from_env};
use sabchat_ai_translate::{SabChatAiTranslateState, make_translator_from_env};
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
use sabchat_reports::SabChatReportsState;
use sabchat_sabflow_nodes::SabChatSabflowNodesState;
use sabchat_shifts::SabChatShiftsState;
use sabchat_sla::SabChatSlaState;
use sabchat_sso::SabChatSsoState;
use sabchat_teams::SabChatTeamsState;
use sabchat_voice::SabChatVoiceState;
use sabchat_webhooks::SabChatWebhooksState;
use sabflow_engine::SabflowEngineState;
use telegram_ads::TelegramAdsState;
use telegram_analytics::TelegramAnalyticsState;
use telegram_api_credentials::TelegramApiCredentialsState;
use telegram_auto_reply::TelegramAutoReplyState;
use telegram_bot_profile::TelegramBotProfileState;
use telegram_bots::{TelegramBotsState, bot_api::BotApiClient as TelegramBotApiClient};
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
use telegram_webhooks::{BotApiClient as TelegramWebhooksBotApi, TelegramWebhooksState};
use wachat_chat_read::ChatReader;
use wachat_contacts_resolve::ContactResolver;
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
use wachat_facebook_pages::{FacebookAppConfig, WachatFacebookPagesState};
use wachat_flows::WachatFlowsState;
use wachat_instagram::WachatInstagramState;
use wachat_media::MediaUploader;
use wachat_meta_client::MetaClient;
use wachat_pay::WachatPayState;
use wachat_payment_request::PaymentRequestSender;
use wachat_projects::WachatProjectsState;
use wachat_public_api::{ApiKeyVerifier, PublicApiState};
use wachat_queue::BullProducer;
use wachat_rate_limit::TokenBucket;
use wachat_send::MessageSender;
use wachat_send_cta::CtaSender;
use wachat_send_flows::FlowSender;
use wachat_send_orders::OrdersSender;
use wachat_send_router::WachatSendState;
use wachat_templates::TemplatesReader;
use wachat_templates_actions::WachatTemplatesActionsState;
use wachat_templates_categories::TemplatesLibrary;
use wachat_templates_mutate::TemplatesMutator;
use wachat_templates_router::TemplatesState;
use wachat_templates_send::TemplateSender;
use wachat_templates_sync::TemplatesSyncer;
use wachat_webhook::WebhookState;
use wachat_webhook_account::AccountProcessor;
use wachat_webhook_actions::WachatWebhookActionsState;
use wachat_webhook_contacts::ContactsUpserter;
use wachat_webhook_conversations::ConversationTracker;
use wachat_webhook_dlq::DlqWriter;
use wachat_webhook_inbound::InboundProcessor;
use wachat_webhook_status::{StatusProcessor, WachatWebhookStatusState};
use wachat_webhook_template_events::TemplateEventsProcessor;
use wachat_webhook_verify::WebhookVerifier;

use crate::state::AppState;

#[tokio::main]
async fn main() {
    let _ = dotenvy::dotenv();

    if let Err(e) = run().await {
        // Tracing may or may not be initialized at the failure point, so log
        // to stderr too for unattended boots.
        eprintln!("FATAL: {e:#}");
        error!(error = ?e, "fatal startup error");
        std::process::exit(1);
    }
}

async fn run() -> anyhow::Result<()> {
    let settings: Settings = common::load_settings().context("loading Settings")?;
    common::tracing_init::init(&settings.env);

    info!(env = %settings.env, port = settings.port, "starting sabnode-api");

    let mongo_uri = std::env::var("MONGODB_URI").context("MONGODB_URI is required")?;
    let mongo_db = std::env::var("MONGODB_DB").context("MONGODB_DB is required")?;
    let redis_url = std::env::var("REDIS_URL").context("REDIS_URL is required")?;
    let jwt_secret = std::env::var("RUST_JWT_SECRET").context("RUST_JWT_SECRET is required")?;

    let mongo = MongoHandle::connect(&mongo_uri, &mongo_db)
        .await
        .context("connecting to MongoDB")?;
    mongo.ping().await.context("MongoDB initial ping")?;
    info!(db = %mongo_db, "mongodb connected");

    // Ensure CRM lookup indexes exist before serving traffic so $regex
    // queries hit indexes from the first request. Idempotent — re-runs
    // are no-ops.
    info!("ensuring CRM lookup indexes");
    crm_lookup_indexes::ensure_indexes(&mongo)
        .await
        .context("ensuring CRM lookup indexes")?;
    info!("lookup indexes ensured");

    let redis = RedisHandle::connect(&redis_url)
        .await
        .context("connecting to Redis")?;
    redis.ping().await.context("Redis initial ping")?;
    info!("redis connected");

    let auth = Arc::new(AuthConfig {
        secret: jwt_secret.into_bytes(),
    });

    // Wachat webhook stack: build each processor over the shared Mongo
    // handle, plus a BullMQ producer for the DLQ. Verifier reads
    // FACEBOOK_APP_SECRET (matches the existing Next.js env var).
    let app_secret = std::env::var("FACEBOOK_APP_SECRET")
        .context("FACEBOOK_APP_SECRET is required for webhook signature verification")?;
    let webhook_verifier = Arc::new(WebhookVerifier::new(app_secret.into_bytes()));

    let bull = BullProducer::new(redis.clone());
    let broadcast = WachatBroadcastState {
        mongo: mongo.clone(),
        bull: bull.clone(),
        media: MediaUploader::new("v23.0"),
    };
    let webhook = WebhookState {
        mongo: mongo.clone(),
        redis: redis.clone(),
        status: Arc::new(StatusProcessor::new(mongo.clone())),
        inbound: Arc::new(InboundProcessor::new(mongo.clone())),
        account: Arc::new(AccountProcessor::new(mongo.clone())),
        template_events: Arc::new(TemplateEventsProcessor::new(mongo.clone())),
        dlq: Arc::new(DlqWriter::new(mongo.clone(), bull)),
        contacts: Arc::new(ContactsUpserter::new(mongo.clone())),
        conversations: Arc::new(ConversationTracker::new(mongo.clone())),
    };

    // Templates stack: shared MetaClient (the Cloud API HTTP wrapper) +
    // MediaUploader (resumable uploads for template header images), plus
    // one engine per concern. Pin Meta to v23.0 (matches Node code today).
    let meta = MetaClient::new("v23.0");
    let media = MediaUploader::new("v23.0");
    let templates_reader = Arc::new(TemplatesReader::new(mongo.clone()));
    let templates_mutator = Arc::new(TemplatesMutator::new(mongo.clone(), meta.clone(), media));
    let templates_syncer = Arc::new(TemplatesSyncer::new(mongo.clone(), meta.clone()));
    let templates_library = Arc::new(TemplatesLibrary::new(mongo.clone()));
    let templates = TemplatesState {
        reader: templates_reader.clone(),
        mutator: templates_mutator.clone(),
        syncer: templates_syncer.clone(),
        library: templates_library.clone(),
        sender: Arc::new(TemplateSender::new(mongo.clone(), meta.clone())),
        mongo: mongo.clone(),
    };

    // Action-state-shaped facade over the same engines, mounted at
    // `/v1/wachat/templates-actions` for the Next.js Server Actions shim.
    let templates_actions = WachatTemplatesActionsState::new(
        templates_reader,
        templates_mutator,
        templates_syncer,
        templates_library,
        mongo.clone(),
    );

    // Send/chat/payment stack — Phase 4. Each engine takes the shared
    // Mongo handle (and MetaClient where it talks to Meta). The
    // `MessageSender` is shared with the public-API router below.
    let message_sender = Arc::new(MessageSender::new(
        mongo.clone(),
        meta.clone(),
        MediaUploader::new("v23.0"),
    ));
    let send = WachatSendState {
        message: message_sender.clone(),
        cta: Arc::new(CtaSender::new(mongo.clone(), meta.clone())),
        flows: Arc::new(FlowSender::new(mongo.clone(), meta.clone())),
        orders: Arc::new(OrdersSender::new(mongo.clone(), meta.clone())),
        contacts: Arc::new(ContactResolver::new(mongo.clone())),
        chat_read: Arc::new(ChatReader::new(mongo.clone())),
        chat_mark: Arc::new(ChatMarker::new(mongo.clone())),
        payment: Arc::new(PaymentRequestSender::new(mongo.clone(), meta.clone())),
        mongo: mongo.clone(),
    };

    let config = WachatConfigState::new(mongo.clone(), meta.clone());

    let pay = WachatPayState::new(mongo.clone(), meta.clone());

    let calling = WachatCallingState::new(mongo.clone(), meta.clone());

    let analytics = WachatAnalyticsState::new(mongo.clone(), meta.clone());

    let webhook_actions = WachatWebhookActionsState::new(mongo.clone());

    let webhook_status = WachatWebhookStatusState::new(mongo.clone());

    let meta_suite = MetaSuiteState::new(mongo.clone(), meta.clone());

    // Meta-token endpoints — read Facebook app credentials via the same env
    // vars the legacy Next.js code uses (`NEXT_PUBLIC_FACEBOOK_APP_ID` and
    // `FACEBOOK_APP_SECRET`). Missing values aren't fatal at boot: handlers
    // that need app-level tokens return `BadRequest("Server credentials not
    // configured.")`, mirroring legacy TS behavior.
    let fb_app_id = std::env::var("NEXT_PUBLIC_FACEBOOK_APP_ID")
        .or_else(|_| std::env::var("FACEBOOK_APP_ID"))
        .unwrap_or_default();
    let fb_app_secret_token = std::env::var("FACEBOOK_APP_SECRET").unwrap_or_default();
    let meta_token = MetaTokenState::new(mongo.clone(), fb_app_id, fb_app_secret_token);

    let meta_flows = MetaFlowsState::new(mongo.clone(), meta.clone());

    let qr_codes = QrCodesState::new(mongo.clone());

    let url_shortener = UrlShortenerState::new(mongo.clone());

    let ad_manager = AdManagerState::new(mongo.clone());

    let facebook_flow = FacebookFlowState::new(mongo.clone());

    let features = WachatFeaturesState {
        mongo: mongo.clone(),
        meta: meta.clone(),
    };

    // Public-API stack — API-key authenticated `/v1/wachat/public/*` routes.
    // Reuses the shared `MessageSender` so deliveries go through the same
    // engine as the dashboard. Rate limiting is per-API-key via Redis.
    let api_key_verifier = Arc::new(ApiKeyVerifier::new(mongo.clone()));
    let public_api = PublicApiState {
        message: message_sender,
        rate_limit: Arc::new(TokenBucket::new(redis.clone())),
        mongo: mongo.clone(),
    };

    // Project list/detail handlers — replaces `getProjects()` /
    // `getProjectById()` server actions in the Next.js layouts.
    let projects = WachatProjectsState::new(mongo.clone());

    // Contact CRUD — replaces the Mongo work in `contact.actions.ts`.
    let contacts = WachatContactsState::new(mongo.clone());

    // SabChat — Pillar 1 + 2. All sub-states share the same Mongo handle.
    let sabchat_inboxes_state = SabChatInboxesState::new(mongo.clone());
    let sabchat_contacts_state = SabChatContactsState::new(mongo.clone());
    let sabchat_conversations_state = SabChatConversationsState::new(mongo.clone());
    let sabchat_messages_state = SabChatMessagesState::new(mongo.clone());
    let sabchat_audit_state = SabChatAuditState::new(mongo.clone());
    let sabchat_routing_state = SabChatRoutingState::new(mongo.clone());
    let sabchat_widget_state = SabChatWidgetState::new(mongo.clone());

    let sabchat_channel_whatsapp_state = SabChatChannelWhatsappState::new(mongo.clone());
    let sabchat_channel_instagram_state = SabChatChannelInstagramState::new(mongo.clone());
    let sabchat_channel_facebook_state = SabChatChannelFacebookState::new(mongo.clone());
    let sabchat_channel_telegram_state = SabChatChannelTelegramState::new(mongo.clone());
    let sabchat_channel_email_state = SabChatChannelEmailState::new(mongo.clone());
    let sabchat_channel_sms_state = SabChatChannelSmsState::new(mongo.clone());
    let sabchat_ai_copilot_state = SabChatAiCopilotState::new(mongo.clone());
    let sabchat_ai_translate_state =
        SabChatAiTranslateState::new(mongo.clone(), make_translator_from_env());
    let sabchat_ai_sentiment_state =
        SabChatAiSentimentState::new(mongo.clone(), make_classifier_from_env());
    let sabchat_ai_resolve_bot_state =
        SabChatAiResolveBotState::new(mongo.clone(), make_bot_from_env());
    let sabchat_macros_state = SabChatMacrosState::new(mongo.clone());
    let sabchat_sla_state = SabChatSlaState::new(mongo.clone());
    let sabchat_business_hours_state = SabChatBusinessHoursState::new(mongo.clone());
    let sabchat_crm_bridge_state = SabChatCrmBridgeState::new(mongo.clone());
    let sabchat_knowledge_state = SabChatKnowledgeState::new(mongo.clone());
    let sabchat_commerce_state = SabChatCommerceState::new(mongo.clone());
    let sabchat_reports_state = SabChatReportsState::new(mongo.clone());
    let sabchat_teams_state = SabChatTeamsState::new(mongo.clone());
    let sabchat_webhooks_state = SabChatWebhooksState::new(mongo.clone());
    let sabchat_public_api_state = SabChatPublicApiState::new(mongo.clone());
    let sabchat_events_state = SabChatEventsState::new(mongo.clone());
    let sabchat_voice_state = SabChatVoiceState::new(mongo.clone());
    let sabchat_cobrowse_state = SabChatCobrowseState::new(mongo.clone());
    let sabchat_shifts_state = SabChatShiftsState::new(mongo.clone());
    let sabchat_csat_state = SabChatCsatState::new(mongo.clone());
    let sabchat_dispositions_state = SabChatDispositionsState::new(mongo.clone());
    let sabchat_gamification_state = SabChatGamificationState::new(mongo.clone());
    let sabchat_compliance_state = SabChatComplianceState::new(mongo.clone());
    let sabchat_sso_state = SabChatSsoState::new(mongo.clone());
    let sabchat_ai_qa_state = SabChatAiQaState::new(mongo.clone());
    let sabchat_ai_voc_state = SabChatAiVocState::new(mongo.clone());
    let sabchat_sabflow_nodes_state = SabChatSabflowNodesState::new(mongo.clone());
    let sabchat_cart_recovery_state = SabChatCartRecoveryState::new(mongo.clone());
    let sabchat_ad_attribution_state = SabChatAdAttributionState::new(mongo.clone());
    let sabchat_channel_line_state = SabChatChannelLineState::new(mongo.clone());
    let sabchat_channel_viber_state = SabChatChannelViberState::new(mongo.clone());
    let sabchat_channel_apple_state = SabChatChannelAppleState::new(mongo.clone());
    let sabchat_channel_gbm_state = SabChatChannelGbmState::new(mongo.clone());
    let sabchat_channel_x_state = SabChatChannelXState::new(mongo.clone());
    let sabchat_marketplace_state = SabChatMarketplaceState::new(mongo.clone());

    // SabNode wachat-specific flows — replaces `flow.actions.ts`.
    let flows = WachatFlowsState::new(mongo.clone());

    // Admin-side public-API key management (generate / list / revoke).
    // Writes the same `api_keys` collection that `wachat-public-api`'s
    // verifier reads on the request path, so admin issues are visible
    // to the verifier without an extra sync step.
    let api_keys_admin = WachatApiKeysAdminState::new(mongo.clone());

    // Facebook + Instagram domain crates — port the heavy
    // `facebook.actions.ts` / `instagram.actions.ts` work to Rust.
    let fb_app_config = FacebookAppConfig {
        facebook_app_id: std::env::var("NEXT_PUBLIC_FACEBOOK_APP_ID")
            .or_else(|_| std::env::var("FACEBOOK_APP_ID"))
            .unwrap_or_default(),
        facebook_app_secret: std::env::var("FACEBOOK_APP_SECRET").unwrap_or_default(),
        onboarding_app_id: std::env::var("NEXT_PUBLIC_META_ONBOARDING_APP_ID").unwrap_or_default(),
        onboarding_app_secret: std::env::var("META_ONBOARDING_APP_SECRET").unwrap_or_default(),
        app_url: std::env::var("NEXT_PUBLIC_APP_URL").unwrap_or_default(),
    };
    let fb_pages = WachatFacebookPagesState::new(mongo.clone(), meta.clone(), fb_app_config);
    let fb_content = WachatFacebookContentState::new(mongo.clone(), meta.clone());
    let fb_messaging = WachatFacebookMessagingState::new(mongo.clone(), meta.clone());
    let fb_automation = WachatFacebookAutomationState::new(mongo.clone(), meta.clone());
    let fb_crm = WachatFacebookCrmState::new(mongo.clone(), meta.clone());
    let fb_agents = WachatFacebookAgentsState::new(mongo.clone());
    let fb_business = WachatFacebookBusinessState::new(mongo.clone(), meta.clone());
    let fb_misc = WachatFacebookMiscState::new(mongo.clone(), meta.clone());
    let fb_comments = WachatFacebookCommentsState::new(mongo.clone(), meta.clone());
    let fb_events = WachatFacebookEventsState::new(mongo.clone(), meta.clone());
    let fb_lead_gen = WachatFacebookLeadGenState::new(mongo.clone(), meta.clone());
    let fb_messenger_profile =
        WachatFacebookMessengerProfileState::new(mongo.clone(), meta.clone());
    let instagram = WachatInstagramState::new(mongo.clone(), meta.clone());

    // Telegram BFF — talks directly to api.telegram.org/bot{token}.
    // The webhook target is built from NEXT_PUBLIC_APP_URL (or empty if
    // the var is missing; in that case connect_bot saves the bot but
    // skips setWebhook and surfaces a hint to the caller).
    let telegram_app_url = std::env::var("NEXT_PUBLIC_APP_URL")
        .or_else(|_| std::env::var("VERCEL_URL"))
        .unwrap_or_default();
    let telegram_bot_api = TelegramBotApiClient::new();
    let telegram_bots_state = TelegramBotsState::new(
        mongo.clone(),
        telegram_bot_api.clone(),
        telegram_app_url.clone(),
    );
    let telegram_chats_state = TelegramChatsState::new(mongo.clone(), telegram_bot_api.clone());
    let telegram_broadcasts_state =
        TelegramBroadcastsState::new(mongo.clone(), telegram_bot_api.clone());
    let telegram_auto_reply_state = TelegramAutoReplyState::new(mongo.clone());
    let telegram_commands_state =
        TelegramCommandsState::new(mongo.clone(), telegram_bot_api.clone());
    let telegram_bot_profile_state = TelegramBotProfileState::new(mongo.clone(), telegram_bot_api);
    let telegram_channels_state = TelegramChannelsState::new(mongo.clone());
    let telegram_analytics_state = TelegramAnalyticsState::new(mongo.clone());
    let telegram_payments_state = TelegramPaymentsState::new(mongo.clone());
    let telegram_stickers_state = TelegramStickersState::new(mongo.clone());
    let telegram_stories_state = TelegramStoriesState::new(mongo.clone());
    let telegram_flows_state = TelegramFlowsState::new(mongo.clone());
    let telegram_mini_apps_state = TelegramMiniAppsState::new(mongo.clone());
    let telegram_ads_state = TelegramAdsState::new(mongo.clone());
    let telegram_api_credentials_state = TelegramApiCredentialsState::new(mongo.clone());
    let telegram_business_inbox_state = TelegramBusinessInboxState::new(mongo.clone());
    let telegram_contacts_state = TelegramContactsState::new(mongo.clone());
    let telegram_settings_state = TelegramSettingsState::new(mongo.clone());
    let telegram_webhooks_state = TelegramWebhooksState::new(
        mongo.clone(),
        TelegramWebhooksBotApi::new(),
        telegram_app_url,
    );

    // SabFiles — file manager backed by Cloudflare R2. R2 credentials are
    // optional at boot: if any are missing we boot anyway with a stubbed
    // client that returns errors on use, so the rest of the API stays up.
    let sabfiles_state = match R2Config::from_env() {
        Some(cfg) => {
            let r2 = R2Client::new(cfg).await.context("initializing R2 client")?;
            let quota = std::env::var("SABFILES_USER_QUOTA_BYTES")
                .ok()
                .and_then(|v| v.parse::<u64>().ok());
            info!(quota = ?quota, "sabfiles R2 client ready");
            SabfilesState::new(mongo.clone(), Arc::new(r2), quota)
        }
        None => {
            tracing::warn!(
                "SabFiles: R2 not configured — uploads will fail. \
                 Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET."
            );
            // Build a minimally-valid client pointed at a sentinel endpoint;
            // it will return runtime errors on first use but lets the
            // service boot and serve other endpoints.
            let cfg = R2Config {
                account_id: "missing".to_owned(),
                access_key_id: "missing".to_owned(),
                secret_access_key: "missing".to_owned(),
                bucket: "missing".to_owned(),
                public_url: None,
            };
            let r2 = R2Client::new(cfg)
                .await
                .context("initializing R2 stub client")?;
            SabfilesState::new(mongo.clone(), Arc::new(r2), None)
        }
    };

    // SabFlow execution engine — shares the same Mongo/Redis/Bull stack.
    let sabflow_state = SabflowEngineState::new(
        mongo.clone(),
        redis.clone(),
        wachat_queue::BullProducer::new(redis.clone()),
        auth.clone(),
    );

    // Email suite — Mongo-only for all crates except webhooks (also needs a
    // shared reqwest client so connection pooling holds across deliveries)
    // and campaigns (also needs a BullMQ producer to enqueue onto the
    // `"email-send"` queue drained by `email-sender`).
    let email_audience_state = email_audience::EmailAudienceState {
        mongo: mongo.clone(),
    };
    let email_templates_state = email_templates::EmailTemplatesState {
        mongo: mongo.clone(),
    };
    let email_inbox_state = email_inbox::EmailInboxState {
        mongo: mongo.clone(),
    };
    let email_inbound_state = email_inbound::EmailInboundState {
        mongo: mongo.clone(),
    };
    let email_deliverability_state =
        email_deliverability::EmailDeliverabilityState::new(mongo.clone());
    let email_api_state = email_api::EmailApiState::new(mongo.clone());
    let email_webhooks_state =
        email_webhooks::EmailWebhooksState::new(mongo.clone(), reqwest::Client::new());
    let email_campaigns_state = email_campaigns::EmailCampaignsState {
        mongo: mongo.clone(),
        bull: wachat_queue::BullProducer::new(redis.clone()),
    };
    let email_events_state = email_events::EmailEventsState {
        mongo: mongo.clone(),
        http: reqwest::Client::new(),
    };
    let email_reports_state = email_reports::EmailReportsState {
        mongo: mongo.clone(),
    };
    let email_journeys_state = email_journeys::EmailJourneysState {
        mongo: mongo.clone(),
        bull: wachat_queue::BullProducer::new(redis.clone()),
    };

    let state = AppState::new(
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
        sabfiles_state,
        telegram_bots_state,
        telegram_chats_state,
        telegram_broadcasts_state,
        telegram_auto_reply_state,
        telegram_commands_state,
        telegram_bot_profile_state,
        telegram_channels_state,
        telegram_analytics_state,
        telegram_payments_state,
        telegram_stickers_state,
        telegram_stories_state,
        telegram_flows_state,
        telegram_mini_apps_state,
        telegram_ads_state,
        telegram_api_credentials_state,
        telegram_business_inbox_state,
        telegram_contacts_state,
        telegram_settings_state,
        telegram_webhooks_state,
        sabflow_state,
        email_audience_state,
        email_templates_state,
        email_inbox_state,
        email_inbound_state,
        email_deliverability_state,
        email_api_state,
        email_webhooks_state,
        email_campaigns_state,
        email_events_state,
        email_reports_state,
        email_journeys_state,
        sabchat_inboxes_state,
        sabchat_contacts_state,
        sabchat_conversations_state,
        sabchat_messages_state,
        sabchat_audit_state,
        sabchat_routing_state,
        sabchat_widget_state,
        sabchat_channel_whatsapp_state,
        sabchat_channel_instagram_state,
        sabchat_channel_facebook_state,
        sabchat_channel_telegram_state,
        sabchat_channel_email_state,
        sabchat_channel_sms_state,
        sabchat_ai_copilot_state,
        sabchat_ai_translate_state,
        sabchat_ai_sentiment_state,
        sabchat_ai_resolve_bot_state,
        sabchat_macros_state,
        sabchat_sla_state,
        sabchat_business_hours_state,
        sabchat_crm_bridge_state,
        sabchat_knowledge_state,
        sabchat_commerce_state,
        sabchat_reports_state,
        sabchat_teams_state,
        sabchat_webhooks_state,
        sabchat_public_api_state,
        sabchat_events_state,
        sabchat_voice_state,
        sabchat_cobrowse_state,
        sabchat_shifts_state,
        sabchat_csat_state,
        sabchat_dispositions_state,
        sabchat_gamification_state,
        sabchat_compliance_state,
        sabchat_sso_state,
        sabchat_ai_qa_state,
        sabchat_ai_voc_state,
        sabchat_sabflow_nodes_state,
        sabchat_cart_recovery_state,
        sabchat_ad_attribution_state,
        sabchat_channel_line_state,
        sabchat_channel_viber_state,
        sabchat_channel_apple_state,
        sabchat_channel_gbm_state,
        sabchat_channel_x_state,
        sabchat_marketplace_state,
    );
    let app = router::build(state.clone());

    let addr = SocketAddr::from(([0, 0, 0, 0], settings.port));
    let listener = TcpListener::bind(addr)
        .await
        .with_context(|| format!("binding {addr}"))?;
    info!(%addr, "listening");

    state.mark_ready();

    axum::serve(listener, app)
        .with_graceful_shutdown(shutdown_signal())
        .await
        .context("axum::serve")?;

    info!("shutdown complete");
    Ok(())
}

async fn shutdown_signal() {
    let ctrl_c = async {
        if let Err(e) = signal::ctrl_c().await {
            error!(error = %e, "failed to install Ctrl+C handler");
        }
    };

    #[cfg(unix)]
    let terminate = async {
        match signal::unix::signal(signal::unix::SignalKind::terminate()) {
            Ok(mut sig) => {
                sig.recv().await;
            }
            Err(e) => error!(error = %e, "failed to install SIGTERM handler"),
        }
    };

    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();

    tokio::select! {
        _ = ctrl_c => info!("received SIGINT, shutting down"),
        _ = terminate => info!("received SIGTERM, shutting down"),
    }
}
