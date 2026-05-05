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

import { facebookFlowApi } from './facebook-flow';
import { metaFlowsApi } from './meta-flows';
import { metaSuiteApi } from './meta-suite';
import { metaTokenApi } from './meta-token';
import { qrCodesApi } from './qr-codes';
import { templatesApi } from './templates';
import { usersApi } from './users';
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

export const rustClient = {
    users: usersApi,
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
};

export type RustClient = typeof rustClient;

// Re-exports for convenient imports from one path.
export { rustFetch, RustApiError } from './fetcher';
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
