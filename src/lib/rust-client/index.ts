/**
 * Public entry point for the Rust BFF client.
 *
 * Use a single `rustClient` namespace so call sites read like
 * `rustClient.users.me()` regardless of which domain crate they hit.
 * As more Rust crates come online (projects, contacts, broadcasts, …)
 * register them here.
 *
 * This module is `server-only` — the underlying fetcher mints JWTs using a
 * shared secret that must never reach the browser bundle.
 */
import 'server-only';

import { adminApi } from './admin';
import { facebookFlowApi } from './facebook-flow';
import { metaFlowsApi } from './meta-flows';
import { metaSuiteApi } from './meta-suite';
import { metaTokenApi } from './meta-token';
import { projectsApi } from './projects';
import { qrCodesApi } from './qr-codes';
import { urlShortenerApi } from './url-shortener';
import { adManagerApi } from './ad-manager';
import { sabfilesApi } from './sabfiles';
import { sessionApi } from './session';
import { templatesApi } from './templates';
import { usersApi } from './users';
import { wachatContactsApi } from './wachat-contacts';
import { wachatCannedMessagesApi } from './wachat-canned-messages';
import { wachatAiTrainingApi } from './wachat-ai-training';
import { wachatInteractiveBuilderApi } from './wachat-interactive-builder';
import { wachatSetupKbApi } from './wachat-setup-kb';
import { wachatAdsRoadmapApi } from './wachat-ads-roadmap';
import { wachatQualityHistoryApi } from './wachat-quality-history';
import { wachatFlowEventsApi } from './wachat-flow-events';
import { wachatOptOutSettingsApi } from './wachat-opt-out-settings';
import { wachatAbTestingApi } from './wachat-ab-testing';
import { wachatContactMergeApi } from './wachat-contact-merge';
import { wachatAutoReplySettingsApi } from './wachat-auto-reply-settings';
import { wachatProjectAgentsApi } from './wachat-project-agents';
import { wachatProjectAttributesApi } from './wachat-project-attributes';
import { wachatLinkGeneratorApi } from './wachat-link-generator';
import { wachatWidgetTrackingApi } from './wachat-widget-tracking';
import { wachatIntegrationsHubApi } from './wachat-integrations-hub';
import { wachatRazorpayApi } from './wachat-razorpay';
import { wachatPostGeneratorApi } from './wachat-post-generator';
import { wachatContactsExportSyncApi } from './wachat-contacts-export-sync';
import { wachatNumberRoutingApi } from './wachat-number-routing';
import { sabpayApi } from './sabpay';
import { sabchatApi } from './sabchat';
import { sabchatKbApi } from './sabchat-knowledge';
import { sabchatReportsApi } from './sabchat-reports';
import { sabchatWebhooksApi } from './sabchat-webhooks';
import { sabchatPublicApi } from './sabchat-public-api';
import { sabchatEventsApi } from './sabchat-events';
import { sabchatVoiceApi } from './sabchat-voice';
import { sabchatCobrowseApi } from './sabchat-cobrowse';
import { sabchatShiftsApi } from './sabchat-shifts';
import { sabchatCsatApi } from './sabchat-csat';
import { sabchatDispositionsApi } from './sabchat-dispositions';
import { sabchatGamificationApi } from './sabchat-gamification';
import { sabchatComplianceApi } from './sabchat-compliance';
import { sabchatSsoApi } from './sabchat-sso';
import { sabchatAiQaApi } from './sabchat-ai-qa';
import { sabchatAiVocApi } from './sabchat-ai-voc';
import { sabchatSabflowNodesApi } from './sabchat-sabflow-nodes';
import { sabchatCartRecoveryApi } from './sabchat-cart-recovery';
import { sabchatAdAttributionApi } from './sabchat-ad-attribution';
import { wachatFlowsApi } from './wachat-flows';
import { wachatApiKeysAdminApi } from './wachat-api-keys-admin';
import { wachatFacebookPagesApi } from './wachat-facebook-pages';
import { wachatFacebookContentApi } from './wachat-facebook-content';
import { wachatFacebookMessagingApi } from './wachat-facebook-messaging';
import { wachatFacebookAutomationApi } from './wachat-facebook-automation';
import { wachatFacebookCrmApi } from './wachat-facebook-crm';
import { wachatFacebookAgentsApi } from './wachat-facebook-agents';
import { wachatFacebookBusinessApi } from './wachat-facebook-business';
import { wachatFacebookMiscApi } from './wachat-facebook-misc';
import { wachatFacebookCommentsApi } from './wachat-facebook-comments';
import { wachatFacebookEventsApi } from './wachat-facebook-events';
import { wachatFacebookLeadGenApi } from './wachat-facebook-lead-gen';
import { wachatFacebookMessengerProfileApi } from './wachat-facebook-messenger-profile';
import { wachatInstagramApi } from './wachat-instagram';
import { wachatTemplatesActionsApi } from './wachat-templates-actions';
import { wachatAnalyticsApi } from './wachat-analytics';
import { wachatBroadcastApi } from './wachat-broadcast';
import { wachatCallingApi } from './wachat-calling';
import { wachatConfigApi } from './wachat-config';
import { wachatFeaturesApi } from './wachat-features';
import { wachatPayApi } from './wachat-pay';
import { wachatWebhookApi } from './wachat-webhook';
import { wachatWebhookActionsApi } from './wachat-webhook-actions';
import { whatsappSendApi } from './whatsapp-send';
import { telegramBotsApi } from './telegram-bots';
import { telegramChatsApi } from './telegram-chats';
import { telegramBroadcastsApi } from './telegram-broadcasts';
import { telegramAutoReplyApi } from './telegram-auto-reply';
import { telegramCommandsApi } from './telegram-commands';
import { telegramBotProfileApi } from './telegram-bot-profile';
import { telegramChannelsApi } from './telegram-channels';
import { telegramAnalyticsApi } from './telegram-analytics';
import { telegramPaymentsApi } from './telegram-payments';
import { telegramStickersApi } from './telegram-stickers';
import { telegramStoriesApi } from './telegram-stories';
import { telegramFlowsApi } from './telegram-flows';
import { telegramMiniAppsApi } from './telegram-mini-apps';
import { telegramAdsApi } from './telegram-ads';
import { telegramApiCredentialsApi } from './telegram-api-credentials';
import { telegramBusinessInboxApi } from './telegram-business-inbox';
import { telegramContactsApi } from './telegram-contacts';
import { telegramSettingsApi } from './telegram-settings';
import { telegramWebhooksApi } from './telegram-webhooks';
import { sabchatTeamsApi } from './sabchat-teams';
import { sabchatMacrosApi } from './sabchat-macros';
import { sabchatSlaApi } from './sabchat-sla';
import { sabchatBusinessHoursApi } from './sabchat-business-hours';
import { sabchatMarketplaceApi } from './sabchat-marketplace';

export const rustClient = {
    admin: adminApi,
    users: usersApi,
    session: sessionApi,
    projects: projectsApi,
    wachatContacts: wachatContactsApi,
    wachatCannedMessages: wachatCannedMessagesApi,
    wachatAiTraining: wachatAiTrainingApi,
    wachatInteractiveBuilder: wachatInteractiveBuilderApi,
    wachatSetupKb: wachatSetupKbApi,
    wachatAdsRoadmap: wachatAdsRoadmapApi,
    wachatQualityHistory: wachatQualityHistoryApi,
    wachatFlowEvents: wachatFlowEventsApi,
    wachatOptOutSettings: wachatOptOutSettingsApi,
    wachatAbTesting: wachatAbTestingApi,
    wachatContactMerge: wachatContactMergeApi,
    wachatAutoReplySettings: wachatAutoReplySettingsApi,
    wachatProjectAgents: wachatProjectAgentsApi,
    wachatProjectAttributes: wachatProjectAttributesApi,
    wachatLinkGenerator: wachatLinkGeneratorApi,
    wachatWidgetTracking: wachatWidgetTrackingApi,
    wachatIntegrationsHub: wachatIntegrationsHubApi,
    wachatRazorpay: wachatRazorpayApi,
    sabpay: sabpayApi,
    wachatPostGenerator: wachatPostGeneratorApi,
    wachatContactsExportSync: wachatContactsExportSyncApi,
    wachatNumberRouting: wachatNumberRoutingApi,
    sabchat: sabchatApi,
    sabchatKb: sabchatKbApi,
    sabchatReports: sabchatReportsApi,
    sabchatWebhooks: sabchatWebhooksApi,
    sabchatPublic: sabchatPublicApi,
    sabchatEvents: sabchatEventsApi,
    sabchatVoice: sabchatVoiceApi,
    sabchatCobrowse: sabchatCobrowseApi,
    sabchatShifts: sabchatShiftsApi,
    sabchatCsat: sabchatCsatApi,
    sabchatDispositions: sabchatDispositionsApi,
    sabchatGamification: sabchatGamificationApi,
    sabchatCompliance: sabchatComplianceApi,
    sabchatTeams: sabchatTeamsApi,
    sabchatMacros: sabchatMacrosApi,
    sabchatSla: sabchatSlaApi,
    sabchatBusinessHours: sabchatBusinessHoursApi,
    sabchatMarketplace: sabchatMarketplaceApi,
    sabchatSso: sabchatSsoApi,
    sabchatAiQa: sabchatAiQaApi,
    sabchatAiVoc: sabchatAiVocApi,
    sabchatSabflowNodes: sabchatSabflowNodesApi,
    sabchatCartRecovery: sabchatCartRecoveryApi,
    sabchatAdAttribution: sabchatAdAttributionApi,
    wachatFlows: wachatFlowsApi,
    wachatApiKeysAdmin: wachatApiKeysAdminApi,
    wachatFacebookPages: wachatFacebookPagesApi,
    wachatFacebookContent: wachatFacebookContentApi,
    wachatFacebookMessaging: wachatFacebookMessagingApi,
    wachatFacebookAutomation: wachatFacebookAutomationApi,
    wachatFacebookCrm: wachatFacebookCrmApi,
    wachatFacebookAgents: wachatFacebookAgentsApi,
    wachatFacebookBusiness: wachatFacebookBusinessApi,
    wachatFacebookMisc: wachatFacebookMiscApi,
    wachatFacebookComments: wachatFacebookCommentsApi,
    wachatFacebookEvents: wachatFacebookEventsApi,
    wachatFacebookLeadGen: wachatFacebookLeadGenApi,
    wachatFacebookMessengerProfile: wachatFacebookMessengerProfileApi,
    wachatInstagram: wachatInstagramApi,
    wachatWebhook: wachatWebhookApi,
    wachatWebhookActions: wachatWebhookActionsApi,
    wachatConfig: wachatConfigApi,
    wachatPay: wachatPayApi,
    wachatBroadcast: wachatBroadcastApi,
    wachatCalling: wachatCallingApi,
    wachatFeatures: wachatFeaturesApi,
    wachatAnalytics: wachatAnalyticsApi,
    templates: templatesApi,
    wachatTemplatesActions: wachatTemplatesActionsApi,
    whatsappSend: whatsappSendApi,
    metaSuite: metaSuiteApi,
    metaToken: metaTokenApi,
    metaFlows: metaFlowsApi,
    facebookFlow: facebookFlowApi,
    qrCodes: qrCodesApi,
    urlShortener: urlShortenerApi,
    adManager: adManagerApi,
    sabfiles: sabfilesApi,
    telegramBots: telegramBotsApi,
    telegramChats: telegramChatsApi,
    telegramBroadcasts: telegramBroadcastsApi,
    telegramAutoReply: telegramAutoReplyApi,
    telegramCommands: telegramCommandsApi,
    telegramBotProfile: telegramBotProfileApi,
    telegramChannels: telegramChannelsApi,
    telegramAnalytics: telegramAnalyticsApi,
    telegramPayments: telegramPaymentsApi,
    telegramStickers: telegramStickersApi,
    telegramStories: telegramStoriesApi,
    telegramFlows: telegramFlowsApi,
    telegramMiniApps: telegramMiniAppsApi,
    telegramAds: telegramAdsApi,
    telegramApiCredentials: telegramApiCredentialsApi,
    telegramBusinessInbox: telegramBusinessInboxApi,
    telegramContacts: telegramContactsApi,
    telegramSettings: telegramSettingsApi,
    telegramWebhooks: telegramWebhooksApi,
};

export type RustClient = typeof rustClient;

// Re-exports for convenient imports from one path.
export { rustFetch, rustAdminFetch, rustPublicFetch, RustApiError } from './fetcher';
export type { MeResponse, RustErrorEnvelope } from './types';
export type {
    WebhookLogSummary,
    ListLogsResp,
    ListLogsQuery,
} from './wachat-webhook';
export type {
    WebhookActionsLogSummary,
    WebhookActionsListLogsResp,
    WebhookActionsListLogsQuery,
    WebhookActionsReprocessResp,
    WebhookActionsClearResp,
    WachatWebhookActionsApi,
} from './wachat-webhook-actions';
export type {
    RustTemplate,
    RustLibraryTemplate,
    CreateTemplateBody,
    BulkCreateBody,
    CreateFlowTemplateBody,
    EditTemplateBody,
    SyncBody,
    SendTemplateBody,
    SyncOutcome,
    BulkCreateOutcome,
    SendOutcome,
    ApplyLibraryOutcome,
    TemplatesApi,
} from './templates';
export type {
    ActionState as TemplateActionState,
    SyncActionResult as TemplateSyncActionResult,
    BulkCreateActionResult as TemplateBulkCreateActionResult,
    CreateFlowActionResult as TemplateCreateFlowActionResult,
    ApplyActionResult as TemplateApplyActionResult,
    SyncBody as TemplateActionSyncBody,
    CreateActionBody,
    BulkCreateActionBody,
    CreateFlowActionBody,
    EditActionBody,
    LibrarySaveBody as TemplateLibrarySaveBody,
    DeleteByNameBody as TemplateDeleteByNameBody,
    DeleteByIdBody as TemplateDeleteByIdBody,
    ApplyBody as TemplateApplyBody,
    WachatTemplatesActionsApi,
} from './wachat-templates-actions';
export type {
    ConversationAnalyticsGranularity,
    ConversationAnalyticsBody,
    ConversationAnalyticsResult,
    TemplateAnalyticsBody,
    TemplateAnalyticsResult,
    MessagingLimitTierResult,
    LocalMessageAnalyticsBody,
    LocalMessageAnalyticsResult,
    LocalMessageDailyStat,
    BroadcastAnalyticsBody,
    BroadcastAnalyticsResult,
    BroadcastSummary,
    WachatAnalyticsApi,
} from './wachat-analytics';
export type {
    MetaSuiteCatalog,
    MetaSuiteProduct,
    MetaSuiteCatalogList,
    MetaSuiteProductList,
    AddMetaSuiteProductBody,
    UpdateMetaSuiteProductBody,
    MetaSuiteProductSet,
    MetaSuiteProductSetList,
    CreateMetaSuiteProductSetBody,
    MetaSuiteTaggedMediaList,
    MetaSuiteAddAck,
    MetaSuiteDeleteAck,
    MetaSuiteApi,
} from './meta-suite';
export type {
    TokenInfo,
    PermissionEntry,
    UsageStatus,
    BatchRequest,
    MetaTokenApi,
} from './meta-token';
export type {
    MetaFlowRecord,
    MetaFlowValidationError as RustMetaFlowValidationError,
    ActionEnvelope as MetaFlowActionEnvelope,
    CreateFlowBody as MetaFlowCreateBody,
    CreateFlowResult as MetaFlowCreateResult,
    SaveDraftBody as MetaFlowSaveDraftBody,
    UpdateMetadataBody as MetaFlowUpdateMetadataBody,
    PreviewBody as MetaFlowPreviewBody,
    PreviewResult as MetaFlowPreviewResult,
    SyncResult as MetaFlowSyncResult,
    MetaFlowsApi,
} from './meta-flows';
export type {
    PaymentConfiguration as RustPaymentConfiguration,
    CreateConfigBody as PayCreateConfigBody,
    UpdateDataEndpointBody as PayUpdateDataEndpointBody,
    RegenerateOauthBody as PayRegenerateOauthBody,
    SyncLocalBody as PaySyncLocalBody,
    ListConfigurationsResponse as PayListConfigurationsResponse,
    ConfigurationResponse as PayConfigurationResponse,
    CreateConfigurationResponse as PayCreateConfigurationResponse,
    OauthResponse as PayOauthResponse,
    WachatPayApi,
} from './wachat-pay';
export type {
    FacebookFlowSummary,
    FacebookFlowRecord,
    FacebookFlowNodeWire,
    FacebookFlowEdgeWire,
    SaveFacebookFlowBody,
    SaveFacebookFlowResult,
    FacebookFlowAck,
    FacebookFlowApi,
} from './facebook-flow';
export type {
    QrCodeCreateBody,
    QrCodeDeleteManyBody,
    QrCodeCreateResult,
    QrCodeDeleteManyResult,
    QrCodeDeleteOneResult,
    QrCodesApi,
} from './qr-codes';
export type {
    GraphProxyBody as AdManagerGraphProxyBody,
    GraphProxyResult as AdManagerGraphProxyResult,
    AdManagerTokenKind,
    AdAccountsResult as AdManagerAdAccountsResult,
    SuccessResult as AdManagerSuccessResult,
    LocalCampaignsResult as AdManagerLocalCampaignsResult,
    UploadImageResult as AdManagerUploadImageResult,
    UploadVideoResult as AdManagerUploadVideoResult,
    AdManagerApi,
} from './ad-manager';
export type {
    CreateShortUrlBody,
    BulkCreateShortUrlsBody,
    DeleteManyBody as UrlShortenerDeleteManyBody,
    AddDomainBody as UrlShortenerAddDomainBody,
    TrackClickBody as UrlShortenerTrackClickBody,
    CreateShortUrlResult,
    BulkCreateResult as UrlShortenerBulkCreateResult,
    ListResult as UrlShortenerListResult,
    DeleteOneResult as UrlShortenerDeleteOneResult,
    DeleteManyResult as UrlShortenerDeleteManyResult,
    AddDomainResult as UrlShortenerAddDomainResult,
    VerifyDomainResult as UrlShortenerVerifyDomainResult,
    DeleteDomainResult as UrlShortenerDeleteDomainResult,
    TrackClickResult as UrlShortenerTrackClickResult,
    UrlShortenerApi,
} from './url-shortener';
export type {
    CallingWeeklyOperatingHours as RustCallingWeeklyOperatingHours,
    CallingHolidaySchedule as RustCallingHolidaySchedule,
    CallingCallHours as RustCallingCallHours,
    CallingSipServer as RustCallingSipServer,
    CallingSipSettings as RustCallingSipSettings,
    SaveCallingSettingsBody,
    GetCallingSettingsResponse,
    CallLogsResponse,
    WachatCallingApi,
} from './wachat-calling';
export type {
    MediaFilePayload,
    SendMessageBody,
    SendMessageResult,
    SendCatalogBody,
    SendCtaUrlBody,
    SendLocationRequestBody,
    SendAddressBody,
    SendOrderDetailsBody,
    SendOrderStatusBody,
    OrderItem,
    OrderShape,
    OrderStatus,
    MoneyAmount,
    SendAck,
    ResolveContactBody,
    ResolveContactResult,
    InitialChatDataQuery,
    InitialChatDataResult,
    SendPaymentRequestBody,
    PaymentRequestStatusQuery,
    PaymentRequestRecord,
    WhatsappSendApi,
} from './whatsapp-send';
