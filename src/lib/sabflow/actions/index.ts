
'use server';

import type { SabFlowNode, User } from '@/lib/definitions';
import type { WithId, ObjectId } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { getErrorMessage } from '@/lib/utils';

// Core App Processors
import { executeFilterAction, executeDelayAction, executeRouterAction } from './core/logic';
import { executeTextAction, executeNumberAction, executeDateAction, executeJsonAction, executeDataTransformerAction, executeDataForwarderAction } from './core/transform';
import { executeCodeAction } from './core/code';

// SabNode Internal Apps
import { executeWachatAction } from './wachat';
import { executeSabChatAction } from './sabchat';
import { executeCrmAction } from './crm';
import { executeApiAction } from './api';
import { executeSmsAction } from './sms';
import { executeEmailAction } from './email';
import { executeUrlShortenerAction } from './url-shortener';
import { executeQrCodeAction } from './qr-code';
import { executeMetaAction } from './meta';
import { executeGoogleSheetsAction } from './google-sheets';
import { executeArrayFunctionAction } from './array-function';
import { executeApiFileProcessorAction } from './api-file-processor';

// External App Processors
import { executeStripeAction } from './stripe';
import { executeShopifyAction } from './shopify';
import { executeSlackAction } from './slack';
import { executeHubSpotAction } from './hubspot';
import { executeDiscordAction } from './discord';
import { executeNotionAction } from './notion';

// Tier-1 Core/Internal Apps (previously empty stubs)
import { executeDynamicWebPageAction } from './dynamic-web-page';
import { executeFileUploaderAction } from './file-uploader';
import { executeLookupTableAction } from './lookup-table';
import { executeConnectManagerAction } from './connect-manager';
import { executeHookAction } from './hook';
import { executeSubscriptionBillingAction } from './subscription-billing';
import { executeSelectTransformJsonAction } from './select-transform-json';
import { executeSeoSuiteAction } from './seo-suite';

// Tier-2 (instagram/team/gmail/iterator)
import { executeInstagramAction } from './instagram';
import { executeTeamAction } from './team';
import { executeGmailAction } from './gmail';
import { executeIteratorAction } from './iterator';

// AI Providers
import { executeOpenAiAction } from './openai';
import { executeAnthropicAction } from './anthropic';
import { executeGeminiAction } from './gemini';

// Communication
import { executeTelegramAction } from './telegram';
import { executeTwilioAction } from './twilio';
import { executeSendgridAction } from './sendgrid';
import { executeBrevoAction } from './brevo';
import { executeMailchimpAction } from './mailchimp';
import { executeMailchimpEnhancedAction } from './mailchimp-enhanced';
import { executeCampaignMonitorAction as executeCampaignMonitorNewAction } from './campaign-monitor';
import { executeEmmaAction } from './emma';
import { executeMailjetEnhancedAction } from './mailjet-enhanced';
import { executeMailerliteAction } from './mailerlite';
import { executeConvertkitAction } from './convertkit';
import { executeGetresponseAction } from './getresponse';

// Data Enrichment
import { executeClearbitAction } from './clearbit';
import { executeHunterAction } from './hunter';

// Project Management
import { executeTrelloAction } from './trello';
import { executeJiraAction } from './jira';
import { executeAsanaAction } from './asana';
import { executeMondayAction } from './monday';
import { executeClickupAction } from './clickup';
import { executeGithubAction } from './github';

// CRM / Support
import { executeFreshdeskAction } from './freshdesk';
import { executeZendeskAction } from './zendesk';
import { executeIntercomAction } from './intercom';

// E-commerce / Payments
import { executeWoocommerceAction } from './woocommerce';
import { executeCashfreeAction } from './cashfree';
import { executeRazorpayEnhancedAction } from './razorpay-enhanced';

// Databases
import { executeMysqlAction } from './mysql';
import { executePostgresqlAction } from './postgresql';
import { executeSupabaseAction } from './supabase';
import { executeAirtableAction } from './airtable';

// Storage / Media
import { executeAwsS3Action } from './aws-s3';
import { executeCloudinaryAction } from './cloudinary';

// Scheduling
import { executeCalcomAction } from './calcom';

// Google Workspace
import { executeGoogleCalendarAction } from './google-calendar';
import { executeGoogleDriveAction } from './google-drive';
import { executeGoogleDocsAction } from './google-docs';

// Microsoft / Google extra
import { executeMicrosoftAction } from './microsoft';
import { executeXeroAction } from './xero';

// Analytics / Monitoring
import { executeSentryioAction } from './sentryio';
import { executePosthogAction } from './posthog';
import { executeSplunkAction } from './splunk';
import { executeDatadogAction } from './datadog';
import { executeNewrelicAction } from './newrelic';
import { executePrometheusAction } from './prometheus';
import { executeOpensearchAction } from './opensearch';

// CRM / Sales
import { executePipedriveAction } from './pipedrive';
import { executeZohoCrmAction } from './zoho-crm';
import { executeSalesforceAction } from './salesforce';

// Payments
import { executePaypalAction } from './paypal';
import { executeChargebeeAction } from './chargebee';
import { executeQuickbooksAction } from './quickbooks';

// Meetings / Comms
import { executeZoomAction } from './zoom';
import { executeLinkedinAction } from './linkedin';
import { executeMailgunAction } from './mailgun';
import { executeTypeformAction } from './typeform';
import { executeWebflowAction } from './webflow';
import { executeWordpressAction } from './wordpress';

// Productivity
import { executeTodoistAction } from './todoist';
import { executeTogglAction } from './toggl';
import { executeMongodbAction } from './mongodb';
import { executeRedisAction } from './redis';

// Social / Music / Communication
import { executeSpotifyAction } from './spotify';
import { executeActivecampaignAction } from './activecampaign';
import { executeCalendlyAction } from './calendly';
import { executeHelpscoutAction } from './helpscout';
import { executeGitlabAction } from './gitlab';

// Messaging / Queue
import { executeKafkaAction } from './kafka';
import { executeRabbitmqAction } from './rabbitmq';
import { executeN8nWebhookAction } from './n8n-webhook';

// IT Support / Community
import { executeFreshserviceAction } from './freshservice';
import { executeDiscourseAction } from './discourse';

// Dev Tools / Time Tracking / Alerting
import { executeBitbucketAction } from './bitbucket';
import { executeHarvestAction } from './harvest';
import { executePagerdutyAction } from './pagerduty';

// Messaging / Chat
import { executeMattermostAction } from './mattermost';
import { executeWebexAction } from './webex';

// Project Management (additional)
import { executeLinearAction } from './linear';

// Hosting / DevOps
import { executeNetlifyAction } from './netlify';

// Streaming / Social
import { executeTwitchAction } from './twitch';

// CRM (additional)
import { executeKeapAction } from './keap';
import { executeCopperAction } from './copper';

// Email / Marketing Automation
import { executeDripAction } from './drip';
import { executeCustomerioAction } from './customerio';
import { executesendinblueAction } from './sendinblue';

// Notifications / Messaging (new)
import { executePushbulletAction } from './pushbullet';
import { executeGotifyAction } from './gotify';
import { executeMatrixAction } from './matrix';
import { executeRocketchatAction } from './rocketchat';
import { executeLineAction } from './line';

// HRIS / Time Tracking / Fitness / Surveys / Events
import { executeBamboohrAction } from './bamboohr';
import { executeClockifyAction } from './clockify';
import { executeStravaAction } from './strava';
import { executeSurveymonkeyAction } from './surveymonkey';
import { executeEventbriteAction } from './eventbrite';

// Billing / Identity / ITSM
import { executePaddleAction } from './paddle';
import { executeWiseAction } from './wise';
import { executeOktaAction } from './okta';
import { executeAuth0Action } from './auth0';
import { executeServiceNowAction } from './serviceNow';
// Marketing Automation
import { executeMauticAction } from './mautic';
import { executeLemlistAction } from './lemlist';
import { executeOmnisendAction } from './omnisend';
import { executeKlaviyoAction } from './klaviyo';
import { executeIterableAction } from './iterable';

// Data / AI Platforms
import { executeDatabricksAction } from './databricks';
import { executeOracleAction } from './oracle';

// Spreadsheet / Database Platforms
import { executeCodaAction } from './coda';
import { executeSeaTableAction } from './seatable';
import { executeStackbyAction } from './stackby';

// AI / Media / Translation
import { executeDeepLAction } from './deepl';
import { executeAssemblyAIAction } from './assemblyai';
import { executeElevenLabsAction } from './elevenlabs';
import { executeStabilityAction } from './stability';
import { executeReplicateAction } from './replicate';

// CRM (additional batch)
import { executeAgileCrmAction } from './agilecrm';
import { executeSalesmateAction } from './salesmate';
import { executeMonicaCrmAction } from './monicacrm';
import { executeAffinityAction } from './affinity';
import { executeHighLevelAction } from './highLevel';

// Live Chat / Support Platforms
import { executeCrispAction } from './crisp';
import { executeTawkToAction } from './tawkto';
import { executeLiveChatAction } from './livechat';
import { executeOlarkAction } from './olark';

// Conversational Marketing / Webinars / BI / ERP
import { executeDriftAction } from './drift';
import { executeGotowebinarAction } from './gotowebinar';
import { executeMetabaseAction } from './metabase';
import { executeErpnextAction, executeErpNextAction } from './erpnext';
import { executeOdooAction } from './odoo';
import { executeAcumaticaAction } from './acumatica';
import { executeMicrosoftDynamicsAction } from './microsoft-dynamics';

// Open-source / Self-hosted Communication
import { executeZulipAction } from './zulip';
import { executeZammadAction } from './zammad';

// Telephony / SMS Providers
import { executeVonageAction } from './vonage';
import { executeMessagebirdAction } from './messagebird';
import { executePlivoAction } from './plivo';

// Monitoring / Notifications / Chart / Image / CMS
import { executeUptimerobotAction } from './uptimerobot';
import { executePushoverAction } from './pushover';
import { executeQuickchartAction } from './quickchart';
import { executeBannerbearAction } from './bannerbear';
import { executeStoryblokAction } from './storyblok';

// Time-series / Job Scheduling / SMS / PDF / Document
import { executeTimescaledbAction } from './timescaledb';
import { executeRundeckAction } from './rundeck';
import { executeMsg91Action } from './msg91';
import { executeApitemioAction } from './apitemio';
import { executePdfcoAction } from './pdfco';

// Science / Data / Finance / Productivity
import { executeNasaAction } from './nasa';
import { executeHackernewsAction } from './hackernews';
import { executeRaindropAction } from './raindrop';
import { executeBeeminderAction } from './beeminder';
import { executeAlphaVantageAction } from './alphaVantage';

// Project Management / Security / Delivery / HR / Forms
import { executeTaigaAction } from './taiga';
import { executeTheHiveAction } from './thehive';
import { executeOnfleetAction } from './onfleet';
import { executeWorkableAction } from './workable';
import { executeJotformAction } from './jotform';

// IT Service Management / Affiliate Marketing / Data Collection / Web Scraping
import { executeHaloPsaAction } from './halopsa';
import { executeTapfiliateAction } from './tapfiliate';
import { executeKoboAction } from './kobo';
import { executeApifyAction } from './apify';
import { executeFirecrawlAction } from './firecrawl';
import { executeHomeAssistantAction } from './homeassistant';
import { executeSignl4Action } from './signl4';
import { executePeekalinkAction } from './peekalink';
import { executeUrlScanIoAction } from './urlscanio';
import { executeWekanAction } from './wekan';

// Sales Intelligence / Document AI / Publishing / Automation / Email
import { executeGongAction } from './gong';
import { executeMindeeAction } from './mindee';
import { executeMediumAction } from './medium';
import { executePhantomBusterAction } from './phantombuster';
import { executeSendyAction } from './sendy';
import { executeSmartsheetAction } from './smartsheet';
import { executeCloseCrmAction } from './closecrm';
import { executeNutshellAction } from './nutshell';
import { executeSalesforceCrmAction } from './salesforce-crm';
import { executeHubSpotCrmAction } from './hubspot-crm';
import { executeCopperCrmAction } from './copper-crm';
import { executeCloseCrmAction as executeCloseCrmNewAction } from './close-crm';
import { executeMailjetAction } from './mailjet';
import { executePlaidAction } from './plaid';

// E-commerce / Invoicing / Storage / Email / Chat
import { executeMagentoAction } from './magento';
import { executeInvoiceNinjaAction } from './invoiceninja';
import { executeBoxAction } from './box';
import { executePostmarkAction } from './postmark';
import { executeFreshChatAction } from './freshchat';
import { executeCloudflareAction } from './cloudflare';
import { executeBuildkiteAction } from './buildkite';
import { executeSurveySparrowAction } from './surveysparrow';
import { executeOrbitAction } from './orbit';
import { executeZohoBooksAction } from './zohobooks';

// E-commerce / Creator Economy
import { executeGumroadAction } from './gumroad';

// Conversational Support
import { executeRespondIoAction } from './respondio';

// Online Forms
import { executeFormstackAction } from './formstack';
import { executeCognitoFormsAction } from './cognito-forms';
import { executePaperformAction } from './paperform';
import { executeWufooAction } from './wufoo';
import { executeFilloutAction } from './fillout';

// Email Marketing
import { executeVeroAction } from './vero';

// ERP / Finance
import { executeNetSuiteAction } from './netsuite';

// Logistics / File Transfer / Logging / PDF / Email Marketing
import { executeDhlAction } from './dhl';
import { executeSftpAction } from './sftp';
import { executeLogDnaAction } from './logdna';
import { executePdfMonkeyAction } from './pdfmonkey';
import { executeSendfoxAction } from './sendfox';

// Project Management / CRM / Support (additional)
import { executeWrikeAction } from './wrike';
import { executeBasecampAction } from './basecamp';
import { executeTeamworkAction } from './teamwork';
import { executeZohoDeskAction } from './zohodesk';
import { executeFreshworksAction } from './freshworks';
import { executeBasecampEnhancedAction } from './basecamp-enhanced';
import { executeProofHubAction } from './proofhub';
import { executeNiftyAction } from './nifty';
import { executeTeamGanttAction } from './teamgantt';

// Inventory / HRIS / Property Management / Product / CRM (new batch)
import { executeZohoInventoryAction } from './zohoinventory';
import { executeWorkdayAction } from './workday';
import { executeGreenhouseAction } from './greenhouse';
import { executeLeverAction } from './lever';
import { executeIcimsAction } from './icims';
import { executeLodgifyAction } from './lodgify';
import { executeProductboardAction } from './productboard';
import { executeFreshSalesAction } from './freshsales';

// CRM / Civic / Support / B2B / Sales Intelligence
import { executeSalesflareAction } from './salesflare';
import { executeActionNetworkAction } from './actionnetwork';
import { executeChatwootAction } from './chatwoot';
import { executeUpleadAction } from './uplead';
import { executeApolloAction } from './apollo';
import { executeMandrillAction } from './mandrill';
import { executeSendGridEnhancedAction } from './sendgrid-enhanced';
import { executePostmarkEnhancedAction } from './postmark-enhanced';
import { executeSparkPostAction } from './sparkpost';
import { executeResendAction } from './resend';
import { executeLoopsAction } from './loops';
import { executeGoToAction } from './goto';
import { executeFormIoAction } from './formio';
import { executeImgurAction } from './imgur';
import { executePushcutAction } from './pushcut';

// Self-hosted / Utility
import { executeNextCloudAction } from './nextcloud';
import { executeTotpAction } from './totp';
import { executeYourlsAction } from './yourls';
import { executeCountlyAction } from './countly';
import { executeMaxMindAction } from './maxmind';

// Headless CMS / Analytics / AI Content / Thesaurus / Email Marketing
import { executeDirectusAction } from './directus';
import { executePendoAction } from './pendo';
import { executeJasperAction } from './jasper';
import { executeOpenThesaurusAction } from './openthesaurus';
import { executeAutopilotAction } from './autopilot';

// Customer Messaging / Uptime Monitoring / Status / Security
import { executeTrengoAction } from './trengo';
import { executeFreshpingAction } from './freshping';
import { executeStatuspageAction } from './statuspage';
import { executeUptimeKumaAction } from './uptimekuma';
import { executeZscalerAction } from './zscaler';

// E-commerce Platforms
import { executeBigCommerceAction } from './bigcommerce';
import { executeSquarespaceAction } from './squarespace';
import { executeEcwidAction } from './ecwid';
import { executeShopifyStorefrontAction } from './shopify-storefront';
import { executeShoplazzaAction } from './shoplazza';
import { executeLightspeedAction } from './lightspeed';
import { executeShift4ShopAction } from './shift4shop';

// Marketing Automation / CRM
import { executeLeadSquaredAction } from './leadsquared';
import { executeInsightlyAction } from './insightly';
import { executeZenviaAction } from './zenvia';
import { executeInteraktAction } from './interakt';
import { executeClockworkAction } from './clockwork';
import { executeG2Action } from './g2';
import { executeQontoAction } from './qonto';

// Analytics / Search / URL / Email Marketing
import { executeGoogleAnalyticsAction } from './googleanalytics';
import { executeConfluenceAction } from './confluence';
import { executeAlgoliaAction } from './algolia';
import { executeBitlyAction } from './bitly';
import { executeMailupAction } from './mailup';

// Fitness / ATS / Accounting / Inventory / Shared Inbox
import { executeMindBodyAction } from './mindbody';
import { executeSmartRecruitersAction } from './smartrecruiters';
import { executeBexioAction } from './bexio';
import { executeUnleashedAction } from './unleashed';
import { executeHelpwiseAction } from './helpwise';

// Email Marketing / AI Providers (new batch)
import { executeCampaignMonitorAction } from './campaignmonitor';
import { executeHuggingFaceAction } from './huggingface';
import { executeOllamaAction } from './ollama';
import { executeTogetherAIAction } from './togetherai';
import { executeOpenRouterAction } from './openrouter';
import { executeOpenAiEnhancedAction } from './openai-enhanced';
import { executeXAiAction } from './xai';
import { executeDeepSeekAction } from './deepseek';

// Marketing / Freelancer CRM / Communications / Video / Serverless
import { executeEgoiAction } from './egoi';
import { executeMoxieAction } from './moxie';
import { executeSignalWireAction } from './signalwire';
import { executeVonageVideoAction } from './vonage-video';
import { executeAwsLambdaAction } from './awslambda';

// Zoho Suite / HR / Time Tracking (new batch)
import { executeZohoMailAction } from './zohomail';
import { executeZohoProjectsAction } from './zohoprojects';
import { executePersonioAction } from './personio';
import { executeFactorialAction } from './factorial';
import { executeClockodoAction } from './clockodo';
import { executeBubbleAction } from './bubble';
import { executeAdaloAction } from './adalo';
import { executeRetoolAction } from './retool';
import { executeGlideAction } from './glide';
import { executeSoftrAction } from './softr';

// AWS Services / Microsoft SharePoint
import { executeAwsSesAction } from './awsses';
import { executeAwsSnsAction } from './awssns';
import { executeAwsSqsAction } from './awssqs';
import { executeAwsDynamoDbAction } from './awsdynamodb';
import { executeSharepointAction } from './sharepoint';

// Vector Databases / BaaS
import { executePineconeAction } from './pinecone';
import { executeWeaviateAction } from './weaviate';
import { executeQdrantAction } from './qdrant';
import { executePocketBaseAction } from './pocketbase';
import { executeAppwriteAction } from './appwrite';

// Edge / Serverless Databases (new batch)
import { executeTursoAction } from './turso';
import { executeXataAction } from './xata';
import { executeConvexAction } from './convex';

// E-commerce / PIM / Ticketing (new batch)
import { executePrestaShopAction } from './prestashop';
import { executeShopwareAction } from './shopware';
import { executeAkeneoAction } from './akeneo';
import { executeZendeskTicketAction } from './zendeskticket';
import { executeTwilioEnhancedAction } from './twilioenhanced';
import { executeMiroAction } from './miro';
import { executeFigmaAction } from './figma';
import { executeCanvaAction } from './canva';
import { executeZapierAction } from './zapier';
import { executeMakeAction } from './make';

// Email Marketing / CRM / Marketing Automation (new batch)
import { executeMoosendAction } from './moosend';
import { executeSharpSpringAction } from './sharpspring';
import { executePardotAction } from './pardot';
import { executeMarketoAction } from './marketo';
import { executeBrazeAction } from './braze';
import { executeGoogleTasksAction } from './googletasks';
import { executeAcuityAction } from './acuity';
import { executeSimplyBookAction } from './simplybook';
import { executeSquareAction } from './square';
import { executeAwsCloudWatchAction } from './awscloudwatch';
import { executeMetaAdsAction } from './metaads';
import { executeTikTokAdsAction } from './tiktokads';
import { executePinterestAdsAction } from './pinterestads';
import { executeLinkedInAdsAction } from './linkedinads';
import { executeGoogleAdsAction } from './googleads';
import { executeAzureDevOpsAction } from './azuredevops';
import { executeSentryEnhancedAction } from './sentryenhanced';
import { executeGrafanaEnhancedAction } from './grafanaenhanced';
import { executeNewRelicEnhancedAction } from './newrelicenhanced';
import { executeDynatraceAction } from './dynatrace';
import { executeRollbarAction } from './rollbar';
import { executeBugsnagAction } from './bugsnag';
import { executeFullStoryAction } from './fullstory';
import { executeLogRocketAction } from './logrocket';
import { executeHotjarAction } from './hotjar';
import { executeRaygunAction } from './raygun';
import { executeTelnyxAction } from './telnyx';

// Mobile / Analytics / Push Notification Platforms
import { executeFirebaseAction } from './firebase';
import { executeOneSignalAction } from './onesignal';
import { executeAmplitudeAction } from './amplitude';
import { executeMixpanelAction } from './mixpanel';
import { executeAppsFlyerAction } from './appsflyer';
import { executeSendbirdAction } from './sendbird';
import { executeStreamAction } from './stream';
import { executeCleverTapAction } from './clevertap';
import { executeMoEngageAction } from './moengage';
import { executeDeepgramAction } from './deepgram';

// Headless CMS (new batch)
import { executeSanityAction } from './sanity';
import { executePrismicAction } from './prismic';
import { executeHygraphAction } from './hygraph';
import { executeContentstackAction } from './contentstack';
import { executePayloadCmsAction } from './payloadcms';
import { executeXoxodayAction } from './xoxoday';
import { executeBandwidthAction } from './bandwidth';
import { executeVapiAction } from './vapi';
import { executeLarkAction } from './lark';
import { executeBandsInTownAction } from './bandsintown';
import { executeGoogleContactsAction } from './googlecontacts';
import { executeGoogleFormsAction } from './googleforms';
import { executeMsTeamsAction } from './msteams';
import { executeDoodleAction } from './doodle';
import { executeYouCanBookAction } from './youcanbook';

// Accounting / Freelancer / Time Tracking
import { executeFreshBooksAction } from './freshbooks';
import { executeWaveAccountingAction } from './waveaccounting';
import { executeBonsaiAction } from './bonsai';
import { executeTimelyAction } from './timely';
import { executeEverhourAction } from './everhour';

// AI Workflow Orchestration / Self-hosted AI
import { executeOpenAiAssistantsAction } from './openai-assistants';
import { executeLangFlowAction } from './langflow';
import { executeFlowiseAction } from './flowise';
import { executeTemporalAction } from './temporal';
import { executeN8nAction } from './n8n';

// Enhanced / Advanced API Integrations
import { executeStripeBillingAction } from './stripe-billing';
import { executeShopifyAdminAction } from './shopify-admin';
import { executeMondayBoardAction } from './monday-board';
import { executeHubSpotCmsAction } from './hubspot-cms';
import { executePipedriveEnhancedAction } from './pipedrive-enhanced';
import { executeOktaEnhancedAction } from './okta-enhanced';
import { executeAuth0EnhancedAction } from './auth0-enhanced';
import { executeKeycloakAction } from './keycloak';
import { executeDescopeAction } from './descope';
import { executeSuperTokensAction } from './supertokens';
import { executeWoocommerceEnhancedAction } from './woocommerce-enhanced';
import { executeOpencartAction } from './opencart';
import { executeGoogleMeetAction } from './google-meet';
import { executeGoogleClassroomAction } from './google-classroom';
import { executeGoogleWorkspaceAdminAction } from './google-workspace-admin';
import { executeWebexEnhancedAction } from './webex-enhanced';
import { executeIntercomEnhancedAction } from './intercom-enhanced';
import { executeFreshdeskEnhancedAction } from './freshdesk-enhanced';
import { executeZendeskGuideAction } from './zendesk-guide';
import { executeSalesforceMcAction } from './salesforce-mc';
import { executeClicksendAction } from './clicksend';
import { executeSinchAction } from './sinch';
import { executeMessageMediaAction } from './messagemedia';
import { executeD7NetworksAction } from './d7networks';
import { executeVonageMessagesAction } from './vonage-messages';
import { executeTwitchEnhancedAction } from './twitch-enhanced';
import { executeYoutubeAnalyticsAction } from './youtube-analytics';
import { executeSpotifyEnhancedAction } from './spotify-enhanced';
import { executeDiscordEnhancedAction } from './discord-enhanced';
import { executeLinkedinEnhancedAction } from './linkedin-enhanced';
import { executeTwitterEnhancedAction } from './twitter-enhanced';
import { executeInstagramGraphAction } from './instagram-graph';
import { executeTiktokBusinessAction } from './tiktok-business';
import { executePinterestEnhancedAction } from './pinterest-enhanced';
import { executeAwsRekognitionAction } from './aws-rekognition';
import { executeAwsTextractAction } from './aws-textract';
import { executeAwsComprehendAction } from './aws-comprehend';
import { executeAwsTranscribeAction } from './aws-transcribe';
import { executeAwsPollyAction } from './aws-polly';
import { executeXeroEnhancedAction } from './xero-enhanced';
import { executeQuickbooksEnhancedAction } from './quickbooks-enhanced';
import { executeGustoAction } from './gusto';
import { executeBamboohrEnhancedAction } from './bamboohr-enhanced';
import { executeSageAction } from './sage';
import { executeLoomAction } from './loom';
import { executeVimeoAction } from './vimeo';
import { executeImagekitAction } from './imagekit';
import { executeCloudinaryEnhancedAction } from './cloudinary-enhanced';
import { executeSalesforceEnhancedAction } from './salesforce-enhanced';
import { executeServiceNowEnhancedAction } from './servicenow-enhanced';
import { executeZohoCrmEnhancedAction } from './zohocrm-enhanced';
import { executeDynamics365Action } from './dynamics365';
import { executeSapAction } from './sap';
import { executeBrevoEnhancedAction } from './brevo-enhanced';
import { executeActivecampaignEnhancedAction } from './activecampaign-enhanced';
import { executeKlaviyoEnhancedAction } from './klaviyo-enhanced';
import { executeDocusignAction } from './docusign';
import { executeDropboxSignAction } from './dropbox-sign';
import { executePandadocEnhancedAction } from './pandadoc-enhanced';
import { executeSignnowAction } from './signnow';
import { executeAdobeSignAction } from './adobe-sign';
import { executeGoogleBigqueryAction } from './google-bigquery';
import { executeGooglePubsubAction } from './google-pubsub';
import { executeGoogleCloudStorageAction } from './google-cloud-storage';
import { executeGoogleCloudFunctionsAction } from './google-cloud-functions';
import { executeGoogleSecretManagerAction } from './google-secret-manager';
import { executeElasticsearchAction } from './elasticsearch';
import { executeMongodbAtlasAction } from './mongodb-atlas';
import { executeSupabaseEnhancedAction } from './supabase-enhanced';
import { executePlanetscaleAction } from './planetscale';
import { executeNeonAction } from './neon';
import { executeMailerliteEnhancedAction } from './mailerlite-enhanced';
import { executeConvertkitEnhancedAction } from './convertkit-enhanced';
import { executeConstantContactAction } from './constant-contact';
import { executeBenchmarkEmailAction } from './benchmark-email';
import { executeClickupEnhancedAction } from './clickup-enhanced';
import { executeAsanaEnhancedAction } from './asana-enhanced';
import { executeTodoistEnhancedAction } from './todoist-enhanced';
import { executeTrelloEnhancedAction } from './trello-enhanced';
import { executeMeistertaskAction } from './meistertask';
import { executeCalendlyEnhancedAction } from './calendly-enhanced';
import { executeCalcomAction as executeCalcomEnhancedAction } from './calcom';
import { executeHubspotMeetingsAction } from './hubspot-meetings';
import { executeAcuityEnhancedAction } from './acuity-enhanced';
import { executeMicrosoftBookingsAction } from './microsoft-bookings';
import { executeAppointyAction } from './appointy';
import { executeVcitaAction } from './vcita';
import { executeSetmoreAction } from './setmore';
import { executeBookafyAction } from './bookafy';
import { executeWebflowEnhancedAction } from './webflow-enhanced';
import { executeGhostCmsAction } from './ghost-cms';
import { executeGhostEnhancedAction } from './ghost-enhanced';
import { executeStoryblokEnhancedAction } from './storyblok-enhanced';
import { executeSanityEnhancedAction } from './sanity-enhanced';
import { executePrismicEnhancedAction } from './prismic-enhanced';
import { executeWordpressEnhancedAction } from './wordpress-enhanced';
import { executeStrapienHancedAction } from './strapi-enhanced';
import { executeCircleciEnhancedAction } from './circleci-enhanced';
import { executeTravisCiAction } from './travis-ci';
import { executeGithubActionsAction } from './github-actions';
import { executeJenkinsAction } from './jenkins';
import { executeBuddyCiAction } from './buddy-ci';
import { executeAdyenAction } from './adyen';
import { executeBraintreeAction } from './braintree';
import { executeCoinbaseCommerceAction } from './coinbase-commerce';
import { executeLemonsqueezyAction } from './lemonsqueezy';
import { executeHunterioAction } from './hunterio';
import { executeClearbitEnhancedAction } from './clearbit-enhanced';
import { executeFullcontactAction } from './fullcontact';
import { executePhantombusterEnhancedAction } from './phantombuster-enhanced';
import { executeLushaAction } from './lusha';
import { executeZoomEnhancedAction } from './zoom-enhanced';
import { executeDailyCoAction } from './daily-co';
import { executeWherebyAction } from './whereby';
import { executeJitsiAction } from './jitsi';
import { executeGotoMeetingAction } from './goto-meeting';
import { executeConfluentKafkaAction } from './confluent-kafka';
import { executeNatsAction } from './nats';
import { executeApachePulsarAction } from './apache-pulsar';
import { executeRedpandaAction } from './redpanda';
import { executeGoogleGeminiAction } from './google-gemini';
import { executeAnthropicClaudeAction } from './anthropic-claude';
import { executeCohereAction } from './cohere';
import { executeMistralAiAction } from './mistral-ai';
import { executePerplexityAiAction } from './perplexity-ai';
import { executeAzureBlobAction } from './azure-blob';
import { executeAzureFunctionsAction } from './azure-functions';
import { executeAzureServiceBusAction } from './azure-service-bus';
import { executeAzureCognitiveAction } from './azure-cognitive';
import { executeAzureOpenaiAction } from './azure-openai';

// Customer Success / CS Platforms
import { executeGainsightAction } from './gainsight';
import { executeChurnZeroAction } from './churnzero';
import { executeTotangoAction } from './totango';
import { executeCustomerioEnhancedAction } from './customerio-enhanced';
import { executeBrazeEnhancedAction } from './braze-enhanced';

// AWS RDS / ELB / CloudWatch / KMS / SES Enhanced
import { executeAwsRdsAction } from './aws-rds';
import { executeAwsElbAction } from './aws-elb';
import { executeAwsCloudWatchNewAction } from './aws-cloudwatch';
import { executeAwsKmsAction } from './aws-kms';
import { executeAwsSesEnhancedAction } from './aws-ses-enhanced';

// AWS Infrastructure Services
import { executeAwsEcsAction } from './aws-ecs';
import { executeAwsEksAction } from './aws-eks';
import { executeAwsRoute53Action } from './aws-route53';
import { executeAwsIamAction } from './aws-iam';
import { executeAwsCodepipelineAction } from './aws-codepipeline';

// Telephony / Contact Center
import { executeAircallAction } from './aircall';
import { executeDialpadAction } from './dialpad';
import { executeGenesysCloudAction } from './genesys-cloud';
import { executeFive9Action } from './five9';

// E-commerce Platforms (new batch)
import { executeWixApiAction } from './wix-api';
import { executeVolusionAction } from './volusion';
import { executeCsCartAction } from './cs-cart';
import { executeOpencartEnhancedAction } from './opencart-enhanced';
import { executePrestaShopEnhancedAction } from './prestashop-enhanced';
import { executeAwsBedrockAction } from './aws-bedrock';
import { executeAwsSagemakerAction } from './aws-sagemaker';
import { executeAwsGlueAction } from './aws-glue';
import { executeAwsStepFunctionsAction } from './aws-step-functions';
import { executeAwsEventbridgeAction } from './aws-eventbridge';

// HR / Payroll Platforms
import { executeRipplingAction } from './rippling';
import { executeAdpAction } from './adp';
import { executePaychexAction } from './paychex';
import { executeTrinetAction } from './trinet';
import { executeNamelyAction } from './namely';
import { executeGoogleAnalytics4Action } from './google-analytics4';
import { executeGoogleSearchConsoleAction } from './google-search-console';
import { executeGoogleTagManagerAction } from './google-tag-manager';
import { executeLookerStudioAction } from './looker-studio';
import { executeGoogleMerchantAction } from './google-merchant';
import { executeSumoLogicAction } from './sumologic';
import { executeLogglyAction } from './loggly';
import { executePapertrailAction } from './papertrail';

// Search Engines (new batch)
import { executeTypesenseAction } from './typesense';
import { executeMeilisearchAction } from './meilisearch';
import { executeSolrAction } from './solr';
import { executeAlgoliaEnhancedAction } from './algolia-enhanced';

// Analytics / CDP (new batch)
import { executeSegmentEnhancedAction } from './segment-enhanced';
import { executePosthogEnhancedAction } from './posthog-enhanced';
import { executePostHogV2Action } from './posthog-v2';
import { executeRudderstackAction } from './rudderstack';
import { executeHeapAnalyticsAction } from './heap-analytics';
import { executeMixpanelEnhancedAction } from './mixpanel-enhanced';

// AI Media / Generative Video & Image
import { executeStabilityAiAction } from './stability-ai';
import { executeRunwayMlAction } from './runway-ml';
import { executeLeonardoAiAction } from './leonardo-ai';

// Contact Center Platforms
import { executeAmazonConnectAction } from './amazon-connect';
import { executeTalkdeskAction } from './talkdesk';
import { executeEightx8Action } from './eightx8';
import { executeRingcentralAction } from './ringcentral';
import { executeVonageContactCenterAction } from './vonage-contact-center';
import { executeFigmaEnhancedAction } from './figma-enhanced';
import { executeCanvaEnhancedAction } from './canva-enhanced';
import { executeMiroEnhancedAction } from './miro-enhanced';
import { executeAbstractAction } from './abstract';
import { executeZeplinAction } from './zeplin';

// Time-series / NoSQL / NewSQL Databases (new batch)
import { executeInfluxdbAction } from './influxdb';
import { executeApacheCassandraAction } from './apache-cassandra';
import { executeCockroachdbAction } from './cockroachdb';
import { executeTidbAction } from './tidb';
import { executeParticleIotAction } from './particle-iot';
import { executeThingspeakAction } from './thingspeak';
import { executeIftttAction } from './ifttt';
import { executeZapierWebhooksAction } from './zapier-webhooks';
import { executeMakeEnhancedAction } from './make-enhanced';
import { executeShopifyWebhooksAction } from './shopify-webhooks';
import { executeBigcommerceEnhancedAction } from './bigcommerce-enhanced';
import { executeSquareEnhancedAction } from './square-enhanced';
import { executePaypalEnhancedAction } from './paypal-enhanced';
import { executeKlarnaAction } from './klarna';
import { executeStripeConnectAction } from './stripe-connect';
import { executeAdyenEnhancedAction } from './adyen-enhanced';
import { executeMollieAction } from './mollie';
import { executePaystackAction } from './paystack';
import { executeFlutterwaveAction } from './flutterwave';

// Web Scraping / Browser Automation
import { executeScrapingBeeAction } from './scrapingbee';
import { executeBrowserlessAction } from './browserless';
import { executeBrightDataAction } from './brightdata';
import { executeZenrowsAction } from './zenrows';

// Survey / Form Platforms (enhanced batch)
import { executeSurveyMonkeyEnhancedAction } from './surveymonkey-enhanced';
import { executeQualtricsAction } from './qualtrics';
import { executeTypeformEnhancedAction } from './typeform-enhanced';
import { executeJotFormEnhancedAction } from './jotform-enhanced';
import { executeGoogleFormsEnhancedAction } from './googleforms-enhanced';

// Form & Survey Tools Enhanced
import { executeTallyFormsAction } from './tally-forms';

// Email Validation / Verification / Data Enrichment / Security
import { executeZeroBounceAction } from './zerobounce';
import { executeNeverBounceAction } from './neverbounce';
import { executeAbstractApiAction } from './abstract-api';
import { executeIpinfoAction } from './ipinfo';
import { executeShodanAction } from './shodan';

// Crypto / Currency / Finance (new batch)
import { executeCoinMarketCapAction } from './coinmarketcap';
import { executeCurrencylayerAction } from './currencylayer';
import { executeFixerioAction } from './fixerio';
import { executeOpenExchangeRatesAction } from './openexchangerates';
import { executePlivoEnhancedAction } from './plivo-enhanced';
import { executeExotelAction } from './exotel';
import { executeKaleyraAction } from './kaleyra';
import { executeMessageBirdEnhancedAction } from './messagebird-enhanced';
import { executeTextMagicAction } from './textmagic';

// Translation / Weather / Maps / Geo / Crypto
import { executeDeeplAction } from './deepl';
import { executeOpenWeatherMapAction } from './openweathermap';
import { executeGoogleMapsAction } from './google-maps';
import { executeMapboxAction } from './mapbox';
import { executeCoinGeckoAction } from './coingecko';
import { executeLinearEnhancedAction } from './linear-enhanced';
import { executeHeightAction } from './height';
import { executePlaneAction } from './plane';
import { executeShortcutAction } from './shortcut';
import { executeHarvestEnhancedAction } from './harvest-enhanced';
import { executeGitlabEnhancedAction } from './gitlab-enhanced';
import { executeBitbucketEnhancedAction } from './bitbucket-enhanced';
import { executeGiteaAction } from './gitea';
// Version Control Platforms Enhanced
import { executeGitHubEnhancedAction } from './github-enhanced';
import { executeAzureDevOpsEnhancedAction } from './azure-devops-enhanced';
import { executeCodecovAction } from './codecov';
import { executeSonarQubeAction } from './sonarqube';
import { executeAwsCognitoAction } from './aws-cognito';
import { executeAwsCloudFormationAction } from './aws-cloudformation';
import { executeAwsLightsailAction } from './aws-lightsail';
import { executeAwsAmplifyAction } from './aws-amplify';
import { executeAwsAppSyncAction } from './aws-appsync';
import { executeGoogleChatAction } from './google-chat';
import { executeWorkplaceMetaAction } from './workplace-meta';
import { executeTelegramBotAction } from './telegram-bot';
import { executeWhatsAppCloudAction } from './whatsapp-cloud';
import { executeTeamsWebhookAction } from './teams-webhook';

// Payments / Billing (new batch)
import { executeRevolutAction } from './revolut';
import { executeMangopayAction } from './mangopay';
import { executeGoCardlessAction } from './gocardless';
import { executeChargebeeEnhancedAction } from './chargebee-enhanced';
import { executeZuoraAction } from './zuora';

// E-commerce Marketplaces
import { executeEtsyAction } from './etsy';
import { executeEbayAction } from './ebay';
import { executeAmazonSpApiAction } from './amazon-sp-api';
import { executeWalmartAction } from './walmart';
import { executeShopifyPartnerAction } from './shopify-partner';

// HashiCorp / Infrastructure Orchestration
import { executeTerraformCloudAction } from './terraform-cloud';
import { executeVaultAction } from './vault';
import { executeConsulAction } from './consul';
import { executeNomadAction } from './nomad';
import { executeAnsibleAwxAction } from './ansible-awx';

// Music / Audio Platforms
import { executeMixcloudAction } from './mixcloud';
import { executeSoundCloudAction } from './soundcloud';
import { executeDeezerAction } from './deezer';
import { executeLastFmAction } from './lastfm';
import { executeMusixmatchAction } from './musixmatch';

// Finance / Banking (new batch)
import { executeBrexAction } from './brex';
import { executeMercuryAction } from './mercury';
import { executeRampAction } from './ramp';
import { executePlaidEnhancedAction } from './plaid-enhanced';
import { executeYodleeAction } from './yodlee';
import { executeDocusignEnhancedAction } from './docusign-enhanced';
import { executeAdobePdfAction } from './adobe-pdf';
import { executeHelloSignAction } from './hellosign';
import { executeSignRequestAction } from './signrequest';
import { executeSignNowEnhancedAction } from './signnow-enhanced';

// E-Signature Platforms Enhanced
import { executeAdobeSignEnhancedAction } from './adobe-sign-enhanced';
import { executeFormstackDocumentsAction } from './formstack-documents';

// Asian Messaging Platforms
import { executeFeishuAction } from './feishu';
import { executeDingTalkAction } from './dingtalk';
import { executeWechatWorkAction } from './wechat-work';
import { executeLineMessagingAction } from './line-messaging';
import { executeViberAction } from './viber';

// Google Enhanced Actions
import { executeGoogleDriveEnhancedAction } from './google-drive-enhanced';
import { executeGoogleSheetsEnhancedAction } from './google-sheets-enhanced';
import { executeGoogleCalendarEnhancedAction } from './google-calendar-enhanced';
import { executeGmailEnhancedAction } from './gmail-enhanced';
import { executeGoogleTasksAction as executeGoogleTasksEnhancedAction } from './google-tasks';

// Google Workspace Enhanced
import { executeGoogleGmailEnhancedAction } from './google-gmail-enhanced';

// Video Hosting Platforms
import { executeWistiaAction } from './wistia';
import { executeVidyardAction } from './vidyard';
import { executeBrightcoveAction } from './brightcove';
import { executeKalturaAction } from './kaltura';
import { executeMuxAction } from './mux';

// Media / Stock Content
import { executePexelsAction } from './pexels';
import { executePixabayAction } from './pixabay';
import { executeGiphyAction } from './giphy';
import { executeUnsplashEnhancedAction } from './unsplash-enhanced';
import { executeCloudinaryVideoAction } from './cloudinary-video';

// Customer Support Platforms (new batch)
import { executeHelpScoutEnhancedAction } from './helpscout-enhanced';
import { executeGrooveAction } from './groove';
import { executeGorgiasAction } from './gorgias';
import { executeGladlyAction } from './gladly';
import { executeKustomerAction } from './kustomer';

// CI/CD / GitOps Platforms (new batch)
import { executeDroneCiAction } from './drone-ci';
import { executeWoodpeckerCiAction } from './woodpecker-ci';
import { executeHarnessAction } from './harness';
import { executeArgoCdAction } from './argocd';
import { executeSpaceLiftAction } from './spacelift';

// New integrations
import { executeAppDynamicsAction } from './appdynamics';
import { executeGrafanaEnhancedAction as executeGrafanaEnhancedFileAction } from './grafana-enhanced';
import { executePagerdutyEnhancedAction } from './pagerduty-enhanced';
import { executeBaserowAction } from './baserow';

// DevOps / CI-CD / Atlassian (new batch)
import { executeJiraEnhancedAction } from './jira-enhanced';
import { executeConfluenceEnhancedAction } from './confluence-enhanced';
import { executeNotionEnhancedAction } from './notion-enhanced';
import { executeAzureDevOpsAction as executeAzureDevOpsNewAction } from './azure-devops';
import { executeBambooCiAction } from './bamboo-ci';
import { executeOctopusDeployAction } from './octopus-deploy';

// Headless E-commerce Platforms
import { executeVendureAction } from './vendure';
import { executeMedusaAction } from './medusa';
import { executeSaleorAction } from './saleor';
import { executeAppsmithAction } from './appsmith';
import { executeBudibaseAction } from './budibase';
import { executeTooljetAction } from './tooljet';

// Advertising Platforms (new)
import { executeFacebookAdsAction } from './facebook-ads';
import { executeTikTokAdsAction as executeTikTokAdsEnhancedAction } from './tiktok-ads';
import { executeLinkedInAdsAction as executeLinkedInAdsEnhancedAction } from './linkedin-ads';
import { executeSnapchatAdsAction } from './snapchat-ads';
import { executePinterestAdsAction as executePinterestAdsEnhancedAction } from './pinterest-ads';

// Video & Social Media Enhanced (new batch)
import { executeVimeoEnhancedAction } from './vimeo-enhanced';
import { executeDailymotionAction } from './dailymotion';
import { executeYouTubeEnhancedAction } from './youtube-enhanced';
import { executeFacebookPagesAction } from './facebook-pages';
import { executeInstagramEnhancedAction } from './instagram-enhanced';

// Payment Gateways (new batch)
import { executeSquarePosAction } from './square-pos';
import { executePayUAction } from './payu';
import { executePaytmAction } from './paytm';
import { executeMidtransAction } from './midtrans';
import { executeXenditAction } from './xendit';

// DevOps / Container Platforms
import { executeKubernetesAction } from './kubernetes';
import { executeDockerHubAction } from './docker-hub';
import { executeHarborAction } from './harbor';
import { executeFlyIoAction } from './fly-io';
import { executeDigitalOceanEnhancedAction } from './digitalocean-enhanced';

// Auth / Identity Providers (new batch)
import { executeTwilioVerifyAction } from './twilio-verify';
import { executeClerkAction } from './clerk';
import { executeStytchAction } from './stytch';
import { executeNangoAction } from './nango';
import { executeFronteggAction } from './frontegg';

// BI / Analytics / Data Engineering
import { executeRedashAction } from './redash';
import { executeApacheSupersetAction } from './apache-superset';
import { executeDbtCloudAction } from './dbt-cloud';
import { executeTableauAction } from './tableau';

// Video Conferencing (new batch)
import { executeZoomWebinarAction } from './zoom-webinar';
import { executeBlueJeansAction } from './bluejeans';
import { executeChimeAction } from './chime';
import { executeLiveKitAction } from './livekit';
import { executeMicrosoftMailAction } from './microsoft-mail';
import { executeMicrosoftCalendarAction } from './microsoft-calendar';
import { executeMicrosoftSharePointAction } from './microsoft-sharepoint';
import { executeOneDriveAction } from './onedrive';
import { executeTeamsEnhancedAction } from './teams-enhanced';

// Social Media / Messaging (new batch)
import { executeSlackEnhancedAction } from './slack-enhanced';
import { executeDiscordWebhookAction } from './discord-webhook';
import { executeRedditEnhancedAction } from './reddit-enhanced';
import { executeMastodonAction } from './mastodon';
import { executeBlueskyAction } from './bluesky';
// Realtime / Messaging Platforms
import { executeUpstashRedisAction } from './upstash-redis';
import { executeUpstashKafkaAction } from './upstash-kafka';
import { executeAblyAction } from './ably';
import { executePusherAction } from './pusher';
import { executeSoketiAction } from './soketi';

// HR / Recruiting & Email Marketing (new batch)
import { executeRecruiteeAction } from './recruitee';
import { executeJazzHRAction } from './jazzhr';
import { executeBreezyHRAction } from './breezy-hr';
import { executeAWeberAction } from './aweber';
import { executeGreenhouseEnhancedAction } from './greenhouse-enhanced';

// Vector Databases / AI Observability (new batch)
import { executePineconeEnhancedAction } from './pinecone-enhanced';
import { executeChromaAction } from './chroma';
import { executeMilvusAction } from './milvus';
import { executeLangChainApiAction } from './langchain-api';
import { executeAmplitudeEnhancedAction } from './amplitude-enhanced';
import { executeMondayEnhancedAction } from './monday-enhanced';
import { executeBoxEnhancedAction } from './box-enhanced';
import { executeDropboxEnhancedAction } from './dropbox-enhanced';
import { executeZendeskEnhancedAction } from './zendesk-enhanced';
import { executeAnthropicEnhancedAction } from './anthropic-enhanced';
import { executeStabilityAIEnhancedAction } from './stability-ai-enhanced';
import { executeRunwayMLAction } from './runwayml';
import { executeElevenLabsEnhancedAction } from './elevenlabs-enhanced';
import { executeAWSIoTAction } from './aws-iot';

// IoT / Video / Analytics Platforms (new batch)
import { executeAzureIoTAction } from './azure-iot';
import { executeTwilioVideoAction } from './twilio-video';
import { executeLinkedInAnalyticsAction } from './linkedin-analytics';
import { executeTikTokAnalyticsAction } from './tiktok-analytics';
import { executeSnapchatMarketingAction } from './snapchat-marketing';
import { executeDatadogEnhancedAction } from './datadog-enhanced';

// Media / Image / File Processing (new batch)
import { executeFilestackAction } from './filestack';
import { executeImgixAction } from './imgix';
import { executeTransloaditAction } from './transloadit';
import { executeMapboxEnhancedAction } from './mapbox-enhanced';
import { executeHereMapsAction } from './here-maps';

// Messaging Platforms (new batch)
import { executeTelegramEnhancedAction } from './telegram-enhanced';
import { executeWhatsAppBusinessAction } from './whatsapp-business';
import { executeWeChatAction } from './wechat';
import { executePinterestAnalyticsAction } from './pinterest-analytics';
import { executeFreshBooksEnhancedAction } from './freshbooks-enhanced';
import { executeFirebaseEnhancedAction } from './firebase-enhanced';
import { executeElasticsearchEnhancedAction } from './elasticsearch-enhanced';
import { executeMeiliSearchEnhancedAction } from './meilisearch-enhanced';
import { executeTogglEnhancedAction } from './toggl-enhanced';
import { executeClockifyEnhancedAction } from './clockify-enhanced';
import { executeVercelApiAction } from './vercel-api';
import { executeSentryEnhancedAction as executeSentryEnhancedNewAction } from './sentry-enhanced';
import { executePaddleEnhancedAction } from './paddle-enhanced';
import { executeRecurlyAction } from './recurly';
import { executeChargifyAction } from './chargify';
import { executeLagoAction } from './lago';

// Incident Management / APM / Uptime
import { executeSquadcastAction } from './squadcast';
import { executeElasticAPMAction } from './elastic-apm';
import { executeBetterStackAction } from './betterstack';
import { executeOneLoginAction } from './onelogin';
import { executePingIdentityAction } from './ping-identity';
import { executeAzureADAction } from './azure-ad';
import { executeAuth0ManagementAction } from './auth0-management';
import { executeFusionAuthAction } from './fusionauth';

// BI / Analytics Platforms (new batch)
import { executeModeAnalyticsAction } from './mode-analytics';
import { executeSisenseAction } from './sisense';
import { executeDomoAction } from './domo';
import { executeQlikSenseAction } from './qlik-sense';
import { executeLookerEnhancedAction } from './looker-enhanced';

// Data Warehouse / Analytics DB Platforms
import { executeBigQueryEnhancedAction } from './bigquery-enhanced';
import { executeSnowflakeEnhancedAction } from './snowflake-enhanced';
import { executeClickHouseAction } from './clickhouse';
import { executeSingleStoreAction } from './singlestore';

// Data Warehouses Enhanced
import { executeDatabricksEnhancedAction } from './databricks-enhanced';
import { executeRedshiftAPIAction } from './redshift-api';

// CMS Enhanced (new batch)
import { executeContentfulEnhancedAction } from './contentful-enhanced';
import { executeDatoCMSAction } from './datocms';
import { executePayloadCMSAction } from './payload-cms';
import { executeADPApiAction } from './adp-api';
import { executeGustoEnhancedAction } from './gusto-enhanced';

// Payment Gateways (enhanced batch)
import { executeBraintreeEnhancedAction } from './braintree-enhanced';
import { executeAuthorizeNetAction } from './authorize-net';
import { executeWorldpayAction } from './worldpay';
import { executeMagnoliaCMSAction } from './magnolia-cms';
import { executePimcoreAction } from './pimcore';
import { executeCraftCMSAction } from './craft-cms';
import { executeDirectusEnhancedAction } from './directus-enhanced';
import { executeUmbracoAction } from './umbraco';

// Email Marketing / CRM Automation (new batch)
import { executeSendPulseAction } from './sendpulse';
import { executeKlaviyoV2Action } from './klaviyo-v2';
import { executeDripEnhancedAction } from './drip-enhanced';

// CRM Integrations (new batch)
import { executeLessAnnoyingCRMAction } from './less-annoying-crm';
import { executeZendeskSellAction } from './zendesk-sell';
import { executeStreakCRMAction } from './streak-crm';

// AI Video Generation
import { executeHeyGenAction } from './heygen';
import { executeDIDAction } from './d-id';
import { executeSynthesiaAction } from './synthesia';
import { executeTavusAction } from './tavus';
import { executeDescriptAction } from './descript';

// Time-series / Serverless Databases (new batch)
import { executeQuestDBAction } from './questdb';
import { executeFaunaAction } from './fauna';
import { executeTiDBCloudAction } from './tidb-cloud';
import { executeNeonDBAction } from './neon-db';

// Automation Platforms
import { executeN8NApiAction } from './n8n-api';
import { executePipedreamAction } from './pipedream';
import { executeFlowdashAction } from './flowdash';
import { executeActivePiecesAction } from './activepieces';
import { executePabblyConnectAction } from './pabbly-connect';

// Finance / Procurement / Expense Platforms (new batch)
import { executeExpensifyEnhancedAction } from './expensify-enhanced';
import { executeCoupaAction } from './coupa';
import { executeSAPConcurAction } from './sap-concur';

// Design / Collaboration Platforms (new batch)
import { executeFramerAction } from './framer';
import { executeLoomEnhancedAction } from './loom-enhanced';
import { executeInVisionAction } from './invision';
import { executeMuralAction } from './mural';
import { executeWhimsicalAction } from './whimsical';

// Audio / Speech / Sales Engagement Providers
import { executePerplexityAction } from './perplexity';
import { executeCohereEnhancedAction } from './cohere-enhanced';
import { executeAssemblyAIEnhancedAction } from './assemblyai-enhanced';
import { executeSnovioAction } from './snovio';

// Cold Email Outreach Platforms
import { executeSmartleadAction } from './smartlead';
import { executeInstantlyAction } from './instantly';
import { executeWoodpeckerEmailAction } from './woodpecker-email';
import { executeReplyIOAction } from './reply-io';
import { executeLemlistEnhancedAction } from './lemlist-enhanced';

// AI / Data Enrichment / Sales Intelligence (new batch)
import { executeMistralEnhancedAction } from './mistral-enhanced';
import { executeReplicateEnhancedAction } from './replicate-enhanced';
import { executeZoomInfoAction } from './zoominfo';
import { executeApolloEnhancedAction } from './apollo-enhanced';
import { executeHunterEnhancedAction } from './hunter-enhanced';

// CDN / Edge / Hosting Platforms (new batch)
import { executeCloudflareApiAction } from './cloudflare-api';
import { executeBunnyCDNAction } from './bunnycdn';
import { executeAkamaiAction } from './akamai';
import { executeRenderEnhancedAction } from './render-enhanced';
import { executeRailwayEnhancedAction } from './railway-enhanced';

// Modern CRM Platforms (new batch)
import { executeAttioAction } from './attio';
import { executeFolkCRMAction } from './folk-crm';
import { executeTwentyCRMAction } from './twenty-crm';
import { executeAffinityCRMAction } from './affinity-crm';
import { executeClayAction } from './clay';

// Workflow Orchestration Platforms
import { executePrefectEnhancedAction } from './prefect-enhanced';
import { executeAirflowEnhancedAction } from './airflow-enhanced';
import { executeConductorAction } from './conductor';
import { executeDagsterAction } from './dagster';
import { executeMageAIAction } from './mage-ai';

// Notion AI / Coda Enhanced / Anytype / Capacitor Calendar / Obsidian Sync
import { executeNotionAIAction } from './notion-ai';
import { executeCodaEnhancedAction } from './coda-enhanced';
import { executeAnytypeAction } from './anytype';
import { executeCapacitorCalendarAction } from './capacitor-calendar';
import { executeObsidianSyncAction } from './obsidian-sync';

// Open Banking / Financial Data Providers (new)
import { executeFinicityAction } from './finicity';
import { executeMXTechnologiesAction } from './mx-technologies';
import { executeMonoAfricaAction } from './mono-africa';
import { executeStitchFinanceAction } from './stitch-finance';

// WhatsApp Gateway Providers
import { executeFonnteAction } from './fonnte';
import { executeWablasAction } from './wablas';
import { executeUltraMsgAction } from './ultramsg';
import { executeChatAPIAction } from './chat-api';
import { executeWAGatewayAction } from './wa-gateway';

// Document Signing / E-Signature Platforms (new batch)
import { executeDocusealAction } from './docuseal';
import { executeDocumensoAction } from './documenso';
import { executeGetAcceptAction } from './getaccept';
import { executeContractbookAction } from './contractbook';

// Ad Platforms (new batch)
import { executeGoogleAdsEnhancedAction } from './google-ads-enhanced';
import { executeMicrosoftAdsAction } from './microsoft-ads';
import { executeTwitterAdsEnhancedAction } from './twitter-ads-enhanced';
import { executeCriteoAction } from './criteo';
import { executeTradeDeskAction } from './trade-desk';

// Global HR / Identity / Freelance Platforms
import { executeDeelAction } from './deel';
import { executeRemoteComAction } from './remote-com';
import { executeOysterHRAction } from './oyster-hr';
import { executeJumpCloudAction } from './jumpcloud';
import { executeUpworkAction } from './upwork';

// E-commerce Platforms (extended batch)
import { executeWooCommerceApiAction } from './woocommerce-api';
import { executeOpenCartApiAction } from './opencart-api';
import { executeNopCommerceAction } from './nopcommerce';

// Tax & Compliance Platforms
import { executeTaxJarAction } from './taxjar';
import { executeAvalaraAction } from './avalara';
import { executeVertexTaxAction } from './vertex-tax';
import { executeTaxCloudAction } from './taxcloud';
import { executeQuadernoAction } from './quaderno';

// Community / Developer Relations Platforms
import { executeCommonRoomAction } from './common-room';
import { executeBevyAction } from './bevy';
import { executeCircleCommunityAction } from './circle-community';
import { executeHivebriteAction } from './hivebrite';

// E-commerce Platforms (enhanced batch)
import { executeMagentoEnhancedAction } from './magento-enhanced';
import { executeVendastaAction } from './vendasta';
import { executeMedusaEnhancedAction } from './medusa-enhanced';
import { executeSaleorEnhancedAction } from './saleor-enhanced';

// CRM Platforms Enhanced
import { executeHubSpotEnhancedAction } from './hubspot-enhanced';
import { executeZohoCRMEnhancedAction } from './zoho-crm-enhanced';

// Project Management Enhanced
import { executeWrikeEnhancedAction } from './wrike-enhanced';

// Customer Support Platforms
import { executeIntercomV3Action } from './intercom-v3';
import { executeFrontAction } from './front';
import { executeDixaAction } from './dixa';

// Data Integration Platforms
import { executeAzureDataFactoryAction } from './azure-data-factory';
import { executeGoogleCloudDataflowAction } from './google-cloud-dataflow';
import { executeFivetranEnhancedAction } from './fivetran-enhanced';
import { executeStitchDataAction } from './stitch-data';

// Payment Processing Enhanced
import { executeStripeEnhancedAction } from './stripe-enhanced';

// Communications Platforms Enhanced
import { executeTwilioEnhancedAction as executeTwilioEnhancedActionNew } from './twilio-enhanced';
import { executeVonageEnhancedAction } from './vonage-enhanced';

// Team Messaging Platforms
import { executeLarkFeishuAction } from './lark-feishu';
import { executeFlockAction } from './flock';
import { executePumbleAction } from './pumble';
import { executeChantyAction } from './chanty';
import { executeRocketChatAction } from './rocket-chat';

// E-Commerce Platforms Enhanced
import { executeShopifyEnhancedAction } from './shopify-enhanced';
import { executeWooCommerceV3Action } from './woocommerce-v3';
import { executeBigCommerceEnhancedAction } from './bigcommerce-enhanced';
import { executeSquarespaceCommerceAction } from './squarespace-commerce';
import { executeEcwidEnhancedAction } from './ecwid-enhanced';
// Cloud Hosting Platforms Enhanced
import { executeCloudflareEnhancedAction } from './cloudflare-enhanced';
import { executeNetlifyEnhancedAction } from './netlify-enhanced';

// AWS Services Enhanced
import { executeAWSLambdaEnhancedAction } from './aws-lambda-enhanced';
import { executeAWSS3EnhancedAction } from './aws-s3-enhanced';
import { executeAWSSNSEnhancedAction } from './aws-sns-enhanced';
import { executeAWSSQSEnhancedAction } from './aws-sqs-enhanced';

// Marketing Automation Platforms
import { executeSalesforceMarketingCloudAction } from './salesforce-marketing-cloud';
import { executeMarketoEnhancedAction } from './marketo-enhanced';
import { executeEloquaAction } from './eloqua';

// Microsoft 365 Enhanced
import { executeMicrosoftTeamsEnhancedAction } from './microsoft-teams-enhanced';
import { executeOutlookEnhancedAction } from './outlook-enhanced';
import { executeSharePointEnhancedAction } from './sharepoint-enhanced';
import { executeOneDriveEnhancedAction } from './onedrive-enhanced';
import { executeAzureActiveDirectoryAction } from './azure-active-directory';

// Database REST APIs
import { executePostgresAPIAction } from './postgres-api';
import { executeMySQLAPIAction } from './mysql-api';
import { executeRedisEnhancedAction } from './redis-enhanced';

// AI/LLM Providers Enhanced
import { executeOpenAiEnhancedAction as executeOpenAIEnhancedAction } from './openai-enhanced';
import { executeTogetherAiAction as executeTogetherAiActionNew } from './together-ai';
import { executeGroqAction } from './groq';

// Low-Code & Database Platforms
import { executeAirtableEnhancedAction } from './airtable-enhanced';
import { executeSmartsheetEnhancedAction } from './smartsheet-enhanced';
import { executeNocoDBAction } from './nocodb';
import { executeAppSheetAction } from './appsheet';

// Video & Webinar Platforms Enhanced
import { executeLivestormAction } from './livestorm';
import { executeDemioAction } from './demio';

// AWS Services Extended
import { executeAWSDynamoDBAction } from './aws-dynamodb';
import { executeAwsCognitoAction as executeAWSCognitoAction } from './aws-cognito';
import { executeAwsCloudWatchAction as executeAWSCloudWatchAction } from './aws-cloudwatch';
import { executeAWSEC2Action } from './aws-ec2';
import { executeAwsEcsAction as executeAWSECSAction } from './aws-ecs';

// Help Desk & Ticketing Systems
import { executeKayakoAction } from './kayako';

// Scheduling & Calendar Tools
import { executeAcuitySchedulingAction } from './acuity-scheduling';
import { executeCalComAction } from './cal-com';
import { executeYouCanBookMeAction } from './youcanbook-me';

// Incident Management & Monitoring
import { executeOpsgenieEnhancedAction } from './opsgenie-enhanced';
import { executeVictorOpsAction } from './victorops';
import { executeIncidentIOAction } from './incident-io';

// Accounting & Finance Platforms Enhanced
import { executeSageAccountingAction } from './sage-accounting';
import { executeWaveAccountingAction as executeWaveAccountingEnhancedAction } from './wave-accounting';

function getValueFromPath(obj: any, path: string): any {
    if (!path || typeof path !== 'string') return undefined;
    // Updated to handle array access like `items[0]` correctly.
    const keys = path.replace(/\[(\d+)\]/g, '.$1').split('.');
    return keys.reduce((o, key) => (o && typeof o === 'object' && o[key] !== undefined ? o[key] : undefined), obj);
}

function interpolate(text: string | undefined, context: any): any {
    if (typeof text !== 'string') {
        return text;
    }

    let interpolatedText = text;
    // Using a global regex to find ALL occurrences, not just the first one.
    const regex = /{{\s*([^}]+)\s*}}/g;

    let maxIterations = 10;
    let i = 0;

    while (i < maxIterations) {
        let matchFound = false;
        interpolatedText = interpolatedText.replace(regex, (fullMatch, varName) => {
            const trimmedVarName = varName.trim();
            const value = getValueFromPath(context, trimmedVarName);

            if (value !== undefined && value !== null) {
                matchFound = true;
                // If the entire string is just a single variable, return the raw value (e.g., for arrays/objects)
                if (interpolatedText.trim() === fullMatch) {
                    return value;
                }
                return typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value);
            }
            return fullMatch; // Return the original placeholder if value not found
        });

        // If a single pass results in an object or array, return it directly.
        if (typeof interpolatedText !== 'string') {
            return interpolatedText;
        }

        if (!matchFound) {
            break; // No more variables found, exit loop
        }
        i++;
    }

    return interpolatedText;
};


export async function executeSabFlowAction(executionId: ObjectId, node: SabFlowNode, user: WithId<User>, logger: any) {
    const { db } = await connectToDatabase();
    const execution = await db.collection('sabflow_executions').findOne({ _id: executionId });
    if (!execution) {
        logger.log(`Error: Could not find execution document with ID ${executionId}`);
        return { error: 'Execution context not found.' };
    }

    const context = execution.context || {};
    const rawInputs = node.data.inputs || {};

    logger.log(`Preparing to execute action: ${node.data.actionName} for app: ${node.data.appId}`, { inputs: rawInputs });

    const interpolatedInputs: Record<string, any> = {};
    for (const key in rawInputs) {
        if (Object.prototype.hasOwnProperty.call(rawInputs, key)) {
            interpolatedInputs[key] = interpolate(rawInputs[key], context);
        }
    }

    logger.log(`Interpolated inputs:`, { interpolatedInputs });

    const appId = node.data.appId;
    const actionName = node.data.actionName;

    switch (appId) {
        // Core Apps: Logic
        case 'filter':
            return await executeFilterAction(actionName, interpolatedInputs);
        case 'delay':
            // Backward compatibility for legacy Delay nodes storing data in node.data
            if ((!interpolatedInputs.value) && node.data.delaySeconds) {
                interpolatedInputs.value = node.data.delaySeconds;
                interpolatedInputs.unit = 'seconds';
                logger.log('Applied backward compatibility for Delay node', { delaySeconds: node.data.delaySeconds });
            }
            return await executeDelayAction(actionName, interpolatedInputs);
        case 'router':
            return await executeRouterAction(actionName, interpolatedInputs);

        // Core Apps: Transform
        case 'text_formatter':
            return await executeTextAction(actionName, interpolatedInputs);
        case 'number_formatter':
            return await executeNumberAction(actionName, interpolatedInputs);
        case 'datetime_formatter':
            return await executeDateAction(actionName, interpolatedInputs);
        case 'json_extractor':
            return await executeJsonAction(actionName, interpolatedInputs);
        case 'data_transformer':
            return await executeDataTransformerAction(actionName, interpolatedInputs);
        case 'data_forwarder':
            return await executeDataForwarderAction(actionName, interpolatedInputs);

        // Core Apps: Code
        case 'code':
            return await executeCodeAction(actionName, interpolatedInputs, context);

        // Tier-1 Core/Internal Apps
        case 'dynamic_web_page':
            return await executeDynamicWebPageAction(actionName, interpolatedInputs, user, logger);
        case 'file_uploader':
            return await executeFileUploaderAction(actionName, interpolatedInputs, user, logger);
        case 'lookup_table':
            return await executeLookupTableAction(actionName, interpolatedInputs, user, logger);
        case 'connect_manager':
            return await executeConnectManagerAction(actionName, interpolatedInputs, user, logger);
        case 'hook':
            return await executeHookAction(actionName, interpolatedInputs, user, logger);
        case 'subscription_billing':
            return await executeSubscriptionBillingAction(actionName, interpolatedInputs, user, logger);
        case 'select_transform_json':
            return await executeSelectTransformJsonAction(actionName, interpolatedInputs, user, logger);
        case 'seo-suite':
            return await executeSeoSuiteAction(actionName, interpolatedInputs, user, logger);

        // Tier-2 apps
        case 'instagram':
            return await executeInstagramAction(actionName, interpolatedInputs, user, logger);
        case 'team':
            return await executeTeamAction(actionName, interpolatedInputs, user, logger);
        case 'gmail':
            return await executeGmailAction(actionName, interpolatedInputs, user, logger);
        case 'iterator':
            return await executeIteratorAction(actionName, interpolatedInputs, user, logger);

        // External Apps
        case 'stripe':
            return await executeStripeAction(actionName, interpolatedInputs, user, logger);
        case 'shopify':
            return await executeShopifyAction(actionName, interpolatedInputs, user, logger);
        case 'slack':
            return await executeSlackAction(actionName, interpolatedInputs, user, logger);
        case 'hubspot':
            return await executeHubSpotAction(actionName, interpolatedInputs, user, logger);
        case 'discord':
            return await executeDiscordAction(actionName, interpolatedInputs, user, logger);
        case 'notion':
            return await executeNotionAction(actionName, interpolatedInputs, user, logger);

        // SabNode Internal Apps
        case 'wachat':
            return await executeWachatAction(actionName, interpolatedInputs, user, logger);
        case 'sabchat':
            return await executeSabChatAction(actionName, interpolatedInputs, user, logger);
        case 'crm':
            return await executeCrmAction(actionName, interpolatedInputs, user, logger);
        case 'meta':
            return await executeMetaAction(actionName, interpolatedInputs, user, logger);
        case 'api':
            // Pass the whole context for interpolation inside the API action
            return await executeApiAction(node, context, logger);
        case 'sms':
            return await executeSmsAction(actionName, interpolatedInputs, user, logger);
        case 'email':
            return await executeEmailAction(actionName, interpolatedInputs, user, logger);
        case 'url-shortener':
            return await executeUrlShortenerAction(actionName, interpolatedInputs, user, logger);
        case 'qr-code-maker':
            return await executeQrCodeAction(actionName, interpolatedInputs, user, logger);
        case 'google_sheets':
            return await executeGoogleSheetsAction(actionName, interpolatedInputs, user, logger);
        case 'array_function':
            return await executeArrayFunctionAction(actionName, interpolatedInputs, user, logger);
        case 'api_file_processor':
            return await executeApiFileProcessorAction(actionName, interpolatedInputs, context, logger);
        // AI Providers
        case 'openai':
            return await executeOpenAiAction(actionName, interpolatedInputs, user, logger);
        case 'anthropic':
            return await executeAnthropicAction(actionName, interpolatedInputs, user, logger);
        case 'gemini':
            return await executeGeminiAction(actionName, interpolatedInputs, user, logger);

        // Communication
        case 'telegram':
            return await executeTelegramAction(actionName, interpolatedInputs, user, logger);
        case 'twilio':
            return await executeTwilioAction(actionName, interpolatedInputs, user, logger);
        case 'sendgrid':
            return await executeSendgridAction(actionName, interpolatedInputs, user, logger);
        case 'brevo':
            return await executeBrevoAction(actionName, interpolatedInputs, user, logger);
        case 'mailchimp':
            return await executeMailchimpAction(actionName, interpolatedInputs, user, logger);
        case 'mailerlite':
        case 'mailer_lite':
            return await executeMailerliteAction(actionName, interpolatedInputs, user, logger);
        case 'convertkit':
        case 'convert_kit':
            return await executeConvertkitAction(actionName, interpolatedInputs, user, logger);
        case 'getresponse':
        case 'get_response':
            return await executeGetresponseAction(actionName, interpolatedInputs, user, logger);

        // Data Enrichment
        case 'clearbit':
            return await executeClearbitAction(actionName, interpolatedInputs, user, logger);
        case 'hunter':
            return await executeHunterAction(actionName, interpolatedInputs, user, logger);

        // Project Management
        case 'trello':
            return await executeTrelloAction(actionName, interpolatedInputs, user, logger);
        case 'jira':
            return await executeJiraAction(actionName, interpolatedInputs, user, logger);
        case 'asana':
            return await executeAsanaAction(actionName, interpolatedInputs, user, logger);
        case 'monday':
            return await executeMondayAction(actionName, interpolatedInputs, user, logger);
        case 'clickup':
            return await executeClickupAction(actionName, interpolatedInputs, user, logger);
        case 'github':
            return await executeGithubAction(actionName, interpolatedInputs, user, logger);

        // CRM / Support
        case 'freshdesk':
            return await executeFreshdeskAction(actionName, interpolatedInputs, user, logger);
        case 'zendesk':
            return await executeZendeskAction(actionName, interpolatedInputs, user, logger);
        case 'intercom':
            return await executeIntercomAction(actionName, interpolatedInputs, user, logger);

        // E-commerce / Payments
        case 'woocommerce':
            return await executeWoocommerceAction(actionName, interpolatedInputs, user, logger);
        case 'cashfree':
            return await executeCashfreeAction(actionName, interpolatedInputs, user, logger);
        case 'razorpay_enhanced':
        case 'razorpay':
            return await executeRazorpayEnhancedAction(actionName, interpolatedInputs, user, logger);

        // Databases
        case 'mysql':
            return await executeMysqlAction(actionName, interpolatedInputs, user, logger);
        case 'postgresql':
        case 'postgres':
            return await executePostgresqlAction(actionName, interpolatedInputs, user, logger);
        case 'supabase':
            return await executeSupabaseAction(actionName, interpolatedInputs, user, logger);
        case 'airtable':
            return await executeAirtableAction(actionName, interpolatedInputs, user, logger);

        // Storage / Media
        case 'aws_s3':
        case 'aws-s3':
            return await executeAwsS3Action(actionName, interpolatedInputs, user, logger);
        case 'cloudinary':
            return await executeCloudinaryAction(actionName, interpolatedInputs, user, logger);

        // Scheduling
        case 'calcom':
        case 'cal_com':
            return await executeCalcomAction(actionName, interpolatedInputs, user, logger);

        // Google Workspace
        case 'google_calendar':
            return await executeGoogleCalendarAction(actionName, interpolatedInputs, user, logger);
        case 'google_drive':
            return await executeGoogleDriveAction(actionName, interpolatedInputs, user, logger);
        case 'google_docs':
            return await executeGoogleDocsAction(actionName, interpolatedInputs, user, logger);

        // Storage / Cloud
        case 'dropbox':
            return await executeDropboxAction(actionName, interpolatedInputs, user, logger);

        // Microsoft
        case 'microsoft':
        case 'microsoft_graph':
        case 'microsoft_teams':
            return await executeMicrosoftAction(actionName, interpolatedInputs, user, logger);

        // Accounting
        case 'xero':
            return await executeXeroAction(actionName, interpolatedInputs, user, logger);
        case 'quickbooks':
        case 'quickbooks_online':
            return await executeQuickbooksAction(actionName, interpolatedInputs, user, logger);

        // Analytics / Monitoring
        case 'sentry':
        case 'sentryio':
            return await executeSentryioAction(actionName, interpolatedInputs, user, logger);
        case 'posthog':
            return await executePosthogAction(actionName, interpolatedInputs, user, logger);
        case 'splunk':
            return await executeSplunkAction(actionName, interpolatedInputs, user, logger);
        case 'datadog':
        case 'datadog_monitoring':
            return await executeDatadogAction(actionName, interpolatedInputs, user, logger);
        case 'newrelic':
        case 'new_relic':
            return await executeNewrelicAction(actionName, interpolatedInputs, user, logger);
        case 'prometheus':
            return await executePrometheusAction(actionName, interpolatedInputs, user, logger);
        case 'opensearch':
        case 'open_search':
            return await executeOpensearchAction(actionName, interpolatedInputs, user, logger);

        // CRM / Sales
        case 'pipedrive':
            return await executePipedriveAction(actionName, interpolatedInputs, user, logger);
        case 'zoho_crm':
        case 'zoho-crm':
            return await executeZohoCrmAction(actionName, interpolatedInputs, user, logger);
        case 'salesforce':
            return await executeSalesforceAction(actionName, interpolatedInputs, user, logger);

        // Payments
        case 'paypal':
            return await executePaypalAction(actionName, interpolatedInputs, user, logger);
        case 'chargebee':
            return await executeChargebeeAction(actionName, interpolatedInputs, user, logger);

        // Meetings / Social
        case 'zoom':
            return await executeZoomAction(actionName, interpolatedInputs, user, logger);
        case 'linkedin':
            return await executeLinkedinAction(actionName, interpolatedInputs, user, logger);

        // Email
        case 'mailgun':
            return await executeMailgunAction(actionName, interpolatedInputs, user, logger);

        // Forms / CMS / No-code
        case 'typeform':
            return await executeTypeformAction(actionName, interpolatedInputs, user, logger);
        case 'webflow':
            return await executeWebflowAction(actionName, interpolatedInputs, user, logger);
        case 'wordpress':
            return await executeWordpressAction(actionName, interpolatedInputs, user, logger);

        // Productivity
        case 'todoist':
            return await executeTodoistAction(actionName, interpolatedInputs, user, logger);
        case 'toggl':
        case 'toggl_track':
            return await executeTogglAction(actionName, interpolatedInputs, user, logger);

        // Databases (new)
        case 'mongodb':
        case 'mongo':
            return await executeMongodbAction(actionName, interpolatedInputs, user, logger);
        case 'redis':
            return await executeRedisAction(actionName, interpolatedInputs, user, logger);

        // Social / Music / Communication
        case 'spotify':
            return await executeSpotifyAction(actionName, interpolatedInputs, user, logger);
        case 'activecampaign':
        case 'active_campaign':
            return await executeActivecampaignAction(actionName, interpolatedInputs, user, logger);
        case 'calendly':
            return await executeCalendlyAction(actionName, interpolatedInputs, user, logger);
        case 'helpscout':
        case 'help_scout':
            return await executeHelpscoutAction(actionName, interpolatedInputs, user, logger);
        case 'gitlab':
            return await executeGitlabAction(actionName, interpolatedInputs, user, logger);

        // Messaging / Queue
        case 'kafka':
            return await executeKafkaAction(actionName, interpolatedInputs, user, logger);
        case 'rabbitmq':
        case 'rabbit_mq':
            return await executeRabbitmqAction(actionName, interpolatedInputs, user, logger);
        case 'n8n_webhook':
        case 'n8n-webhook':
            return await executeN8nWebhookAction(actionName, interpolatedInputs, user, logger);

        // IT Support / Community
        case 'freshservice':
            return await executeFreshserviceAction(actionName, interpolatedInputs, user, logger);
        case 'discourse':
            return await executeDiscourseAction(actionName, interpolatedInputs, user, logger);

        // Dev Tools / Time Tracking / Alerting
        case 'bitbucket':
            return await executeBitbucketAction(actionName, interpolatedInputs, user, logger);
        case 'harvest':
        case 'harvest_time':
            return await executeHarvestAction(actionName, interpolatedInputs, user, logger);
        case 'pagerduty':
        case 'pager_duty':
            return await executePagerdutyAction(actionName, interpolatedInputs, user, logger);

        // Messaging / Chat
        case 'mattermost':
            return await executeMattermostAction(actionName, interpolatedInputs, user, logger);
        case 'webex':
        case 'cisco_webex':
            return await executeWebexAction(actionName, interpolatedInputs, user, logger);

        // Project Management (additional)
        case 'linear':
            return await executeLinearAction(actionName, interpolatedInputs, user, logger);

        // Hosting / DevOps
        case 'netlify':
            return await executeNetlifyAction(actionName, interpolatedInputs, user, logger);

        // Streaming / Social
        case 'twitch':
            return await executeTwitchAction(actionName, interpolatedInputs, user, logger);

        // CRM (additional)
        case 'keap':
        case 'infusionsoft':
            return await executeKeapAction(actionName, interpolatedInputs, user, logger);
        case 'copper':
        case 'copper_crm':
            return await executeCopperAction(actionName, interpolatedInputs, user, logger);

        // Email / Marketing Automation
        case 'drip':
        case 'drip_email':
            return await executeDripAction(actionName, interpolatedInputs, user, logger);
        case 'customerio':
        case 'customer_io':
            return await executeCustomerioAction(actionName, interpolatedInputs, user, logger);
        case 'sendinblue':
        case 'sendinblue_v3':
            return await executesendinblueAction(actionName, interpolatedInputs, user, logger);

        // Notifications / Messaging (new)
        case 'pushbullet':
            return await executePushbulletAction(actionName, interpolatedInputs, user, logger);
        case 'gotify':
            return await executeGotifyAction(actionName, interpolatedInputs, user, logger);
        case 'matrix':
        case 'matrix_chat':
            return await executeMatrixAction(actionName, interpolatedInputs, user, logger);
        case 'rocketchat':
        case 'rocket_chat':
            return await executeRocketchatAction(actionName, interpolatedInputs, user, logger);
        case 'line':
        case 'line_messaging':
            return await executeLineAction(actionName, interpolatedInputs, user, logger);

        // Billing / Identity / ITSM
        case 'paddle':
            return await executePaddleAction(actionName, interpolatedInputs, user, logger);
        case 'wise':
        case 'transferwise':
            return await executeWiseAction(actionName, interpolatedInputs, user, logger);
        case 'okta':
            return await executeOktaAction(actionName, interpolatedInputs, user, logger);
        case 'auth0':
            return await executeAuth0Action(actionName, interpolatedInputs, user, logger);
        case 'servicenow':
        case 'service_now':
            return await executeServiceNowAction(actionName, interpolatedInputs, user, logger);

        // HRIS / Time Tracking / Fitness / Surveys / Events
        case 'bamboohr':
        case 'bamboo_hr':
            return await executeBamboohrAction(actionName, interpolatedInputs, user, logger);
        case 'clockify':
            return await executeClockifyAction(actionName, interpolatedInputs, user, logger);
        case 'strava':
            return await executeStravaAction(actionName, interpolatedInputs, user, logger);
        case 'surveymonkey':
        case 'survey_monkey':
            return await executeSurveymonkeyAction(actionName, interpolatedInputs, user, logger);
        case 'eventbrite':
            return await executeEventbriteAction(actionName, interpolatedInputs, user, logger);


        // Marketing Automation
        case 'mautic':
            return await executeMauticAction(actionName, interpolatedInputs, user, logger);
        case 'lemlist':
            return await executeLemlistAction(actionName, interpolatedInputs, user, logger);
        case 'omnisend':
            return await executeOmnisendAction(actionName, interpolatedInputs, user, logger);
        case 'klaviyo':
            return await executeKlaviyoAction(actionName, interpolatedInputs, user, logger);
        case 'iterable':
            return await executeIterableAction(actionName, interpolatedInputs, user, logger);

        // Data / AI Platforms
        case 'databricks':
            return await executeDatabricksAction(actionName, interpolatedInputs, user, logger);
        case 'oracle':
        case 'oracle_hcm':
        case 'oracle_ords':
            return await executeOracleAction(actionName, interpolatedInputs, user, logger);

        // Spreadsheet / Database Platforms
        case 'coda':
            return await executeCodaAction(actionName, interpolatedInputs, user, logger);
        case 'seatable':
        case 'sea_table':
            return await executeSeaTableAction(actionName, interpolatedInputs, user, logger);
        case 'stackby':
            return await executeStackbyAction(actionName, interpolatedInputs, user, logger);

        // AI / Media / Translation
        case 'deepl':
        case 'deep_l':
            return await executeDeepLAction(actionName, interpolatedInputs, user, logger);
        case 'assemblyai':
        case 'assembly_ai':
            return await executeAssemblyAIAction(actionName, interpolatedInputs, user, logger);
        case 'elevenlabs':
        case 'eleven_labs':
            return await executeElevenLabsAction(actionName, interpolatedInputs, user, logger);
        case 'stability':
            return await executeStabilityAction(actionName, interpolatedInputs, user, logger);
        case 'stability_ai':
        case 'stable_diffusion':
            return await executeStabilityAiAction(actionName, interpolatedInputs, user, logger);
        case 'replicate':
            return await executeReplicateAction(actionName, interpolatedInputs, user, logger);

        // Conversational Marketing
        case 'drift':
            return await executeDriftAction(actionName, interpolatedInputs, user, logger);

        // Webinars
        case 'gotowebinar':
        case 'goto_webinar':
            return await executeGotowebinarAction(actionName, interpolatedInputs, user, logger);

        // BI / Analytics
        case 'metabase':
            return await executeMetabaseAction(actionName, interpolatedInputs, user, logger);

        // ERP
        case 'erpnext':
        case 'erp_next':
            return await executeErpnextAction(actionName, interpolatedInputs, user, logger);
        case 'odoo':
            return await executeOdooAction(actionName, interpolatedInputs, user, logger);

        // Open-source / Self-hosted Communication
        case 'zulip':
            return await executeZulipAction(actionName, interpolatedInputs, user, logger);
        case 'zammad':
            return await executeZammadAction(actionName, interpolatedInputs, user, logger);

        // Telephony / SMS Providers
        case 'vonage':
        case 'nexmo':
            return await executeVonageAction(actionName, interpolatedInputs, user, logger);
        case 'messagebird':
        case 'message_bird':
            return await executeMessagebirdAction(actionName, interpolatedInputs, user, logger);
        case 'plivo':
            return await executePlivoAction(actionName, interpolatedInputs, user, logger);

        // Monitoring / Notifications / Chart / Image / CMS
        case 'uptimerobot':
        case 'uptime_robot':
            return await executeUptimerobotAction(actionName, interpolatedInputs, user, logger);
        case 'pushover':
            return await executePushoverAction(actionName, interpolatedInputs, user, logger);
        case 'quickchart':
        case 'quick_chart':
            return await executeQuickchartAction(actionName, interpolatedInputs, user, logger);
        case 'bannerbear':
        case 'banner_bear':
            return await executeBannerbearAction(actionName, interpolatedInputs, user, logger);
        case 'storyblok':
            return await executeStoryblokAction(actionName, interpolatedInputs, user, logger);

        // Project Management
        case 'taiga':
            return await executeTaigaAction(actionName, interpolatedInputs, user, logger);

        // Security Incident Response
        case 'thehive':
        case 'the_hive':
            return await executeTheHiveAction(actionName, interpolatedInputs, user, logger);

        // Last-mile Delivery
        case 'onfleet':
            return await executeOnfleetAction(actionName, interpolatedInputs, user, logger);

        // HR / Recruiting
        case 'workable':
            return await executeWorkableAction(actionName, interpolatedInputs, user, logger);

        // Online Forms
        case 'jotform':
        case 'jot_form':
            return await executeJotformAction(actionName, interpolatedInputs, user, logger);

        // CRM (additional batch)
        case 'agilecrm':
        case 'agile_crm':
            return await executeAgileCrmAction(actionName, interpolatedInputs, user, logger);
        case 'salesmate':
            return await executeSalesmateAction(actionName, interpolatedInputs, user, logger);
        case 'monicacrm':
        case 'monica_crm':
        case 'monica':
            return await executeMonicaCrmAction(actionName, interpolatedInputs, user, logger);
        case 'affinity':
        case 'affinity_crm':
            return await executeAffinityAction(actionName, interpolatedInputs, user, logger);
        case 'highlevel':
        case 'high_level':
        case 'gohighlevel':
        case 'go_high_level':
            return await executeHighLevelAction(actionName, interpolatedInputs, user, logger);

        // Science / Data / Finance / Productivity
        case 'nasa':
        case 'nasa_api':
            return await executeNasaAction(actionName, interpolatedInputs, user, logger);
        case 'hackernews':
        case 'hacker_news':
            return await executeHackernewsAction(actionName, interpolatedInputs, user, logger);
        case 'raindrop':
        case 'raindrop_io':
            return await executeRaindropAction(actionName, interpolatedInputs, user, logger);
        case 'beeminder':
            return await executeBeeminderAction(actionName, interpolatedInputs, user, logger);
        case 'alphavantage':
        case 'alpha_vantage':
            return await executeAlphaVantageAction(actionName, interpolatedInputs, user, logger);

        // Time-series DB
        case 'timescaledb':
        case 'timescale_db':
            return await executeTimescaledbAction(actionName, interpolatedInputs, user, logger);

        // Job Scheduling
        case 'rundeck':
            return await executeRundeckAction(actionName, interpolatedInputs, user, logger);

        // SMS / Communication (Indian)
        case 'msg91':
        case 'msg_91':
            return await executeMsg91Action(actionName, interpolatedInputs, user, logger);

        // PDF / Image Generation
        case 'apitemio':
        case 'apitemplate':
        case 'api_template_io':
            return await executeApitemioAction(actionName, interpolatedInputs, user, logger);

        // PDF Processing
        case 'pdfco':
        case 'pdf_co':
            return await executePdfcoAction(actionName, interpolatedInputs, user, logger);

        // IT Service Management
        case 'halopsa':
        case 'halo_psa':
            return await executeHaloPsaAction(actionName, interpolatedInputs, user, logger);

        // Affiliate Marketing
        case 'tapfiliate':
        case 'tap_filiate':
            return await executeTapfiliateAction(actionName, interpolatedInputs, user, logger);

        // Data Collection / ODK
        case 'kobo':
        case 'kobotoolbox':
        case 'kobo_toolbox':
            return await executeKoboAction(actionName, interpolatedInputs, user, logger);

        // Web Scraping / Automation
        case 'apify':
            return await executeApifyAction(actionName, interpolatedInputs, user, logger);

        // Web Scraping / Crawling
        case 'firecrawl':
        case 'fire_crawl':
            return await executeFirecrawlAction(actionName, interpolatedInputs, user, logger);

        // Home Automation
        case 'homeassistant':
        case 'home_assistant':
            return await executeHomeAssistantAction(actionName, interpolatedInputs, user, logger);

        // Mobile Alerting
        case 'signl4':
        case 'signal4':
            return await executeSignl4Action(actionName, interpolatedInputs, user, logger);

        // Link Preview
        case 'peekalink':
            return await executePeekalinkAction(actionName, interpolatedInputs, user, logger);

        // URL Scanning
        case 'urlscanio':
        case 'url_scan_io':
            return await executeUrlScanIoAction(actionName, interpolatedInputs, user, logger);

        // Kanban
        case 'wekan':
            return await executeWekanAction(actionName, interpolatedInputs, user, logger);

        // Sales Intelligence
        case 'gong':
        case 'gong_io':
            return await executeGongAction(actionName, interpolatedInputs, user, logger);

        // Document AI
        case 'mindee':
            return await executeMindeeAction(actionName, interpolatedInputs, user, logger);

        // Publishing
        case 'medium':
            return await executeMediumAction(actionName, interpolatedInputs, user, logger);

        // Automation / Scraping
        case 'phantombuster':
        case 'phantom_buster':
            return await executePhantomBusterAction(actionName, interpolatedInputs, user, logger);

        // Self-hosted Email
        case 'sendy':
            return await executeSendyAction(actionName, interpolatedInputs, user, logger);

        case 'smartsheet':
            return await executeSmartsheetAction(actionName, interpolatedInputs, user, logger);
        case 'closecrm':
        case 'close_crm':
        case 'close':
            return await executeCloseCrmAction(actionName, interpolatedInputs, user, logger);
        case 'nutshell':
        case 'nutshell_crm':
            return await executeNutshellAction(actionName, interpolatedInputs, user, logger);
        case 'mailjet':
            return await executeMailjetAction(actionName, interpolatedInputs, user, logger);
        case 'plaid':
            return await executePlaidAction(actionName, interpolatedInputs, user, logger);

        // E-commerce / Invoicing / Storage / Email / Chat
        case 'magento':
        case 'magento2':
            return await executeMagentoAction(actionName, interpolatedInputs, user, logger);
        case 'invoiceninja':
        case 'invoice_ninja':
            return await executeInvoiceNinjaAction(actionName, interpolatedInputs, user, logger);
        case 'box':
        case 'box_com':
            return await executeBoxAction(actionName, interpolatedInputs, user, logger);
        case 'postmark':
        case 'postmarkapp':
            return await executePostmarkAction(actionName, interpolatedInputs, user, logger);
        case 'freshchat':
        case 'fresh_chat':
            return await executeFreshChatAction(actionName, interpolatedInputs, user, logger);

        case 'cloudflare':
            return await executeCloudflareAction(actionName, interpolatedInputs, user, logger);
        case 'buildkite':
            return await executeBuildkiteAction(actionName, interpolatedInputs, user, logger);
        case 'surveysparrow':
        case 'survey_sparrow':
            return await executeSurveySparrowAction(actionName, interpolatedInputs, user, logger);
        case 'orbit':
        case 'orbit_love':
            return await executeOrbitAction(actionName, interpolatedInputs, user, logger);
        case 'zohobooks':
        case 'zoho_books':
            return await executeZohoBooksAction(actionName, interpolatedInputs, user, logger);

        case 'gumroad':
            return await executeGumroadAction(actionName, interpolatedInputs, user, logger);
        case 'respondio':
        case 'respond_io':
            return await executeRespondIoAction(actionName, interpolatedInputs, user, logger);
        case 'formstack':
            return await executeFormstackAction(actionName, interpolatedInputs, user, logger);
        case 'vero':
        case 'getvero':
            return await executeVeroAction(actionName, interpolatedInputs, user, logger);
        case 'netsuite':
        case 'net_suite':
            return await executeNetSuiteAction(actionName, interpolatedInputs, user, logger);

        // Logistics
        case 'dhl':
            return await executeDhlAction(actionName, interpolatedInputs, user, logger);

        // File Transfer
        case 'sftp':
        case 'ftp':
            return await executeSftpAction(actionName, interpolatedInputs, user, logger);

        // Logging / Observability
        case 'logdna':
        case 'mezmo':
        case 'log_dna':
            return await executeLogDnaAction(actionName, interpolatedInputs, user, logger);

        // PDF Generation
        case 'pdfmonkey':
        case 'pdf_monkey':
            return await executePdfMonkeyAction(actionName, interpolatedInputs, user, logger);

        // Email Marketing
        case 'sendfox':
        case 'send_fox':
            return await executeSendfoxAction(actionName, interpolatedInputs, user, logger);

        // Project Management / CRM / Support (additional)
        case 'wrike':
            return await executeWrikeAction(actionName, interpolatedInputs, user, logger);
        case 'basecamp':
        case 'basecamp3':
            return await executeBasecampAction(actionName, interpolatedInputs, user, logger);
        case 'teamwork':
        case 'teamworkpm':
            return await executeTeamworkAction(actionName, interpolatedInputs, user, logger);
        case 'zohodesk':
        case 'zoho_desk':
            return await executeZohoDeskAction(actionName, interpolatedInputs, user, logger);
        case 'freshworks':
        case 'freshworks_crm':
            return await executeFreshworksAction(actionName, interpolatedInputs, user, logger);

        case 'salesflare':
            return await executeSalesflareAction(actionName, interpolatedInputs, user, logger);
        case 'actionnetwork':
        case 'action_network':
            return await executeActionNetworkAction(actionName, interpolatedInputs, user, logger);
        case 'chatwoot':
            return await executeChatwootAction(actionName, interpolatedInputs, user, logger);
        case 'uplead':
        case 'up_lead':
            return await executeUpleadAction(actionName, interpolatedInputs, user, logger);
        case 'apollo':
        case 'apollo_io':
            return await executeApolloAction(actionName, interpolatedInputs, user, logger);

        // Self-hosted / Utility
        case 'nextcloud':
        case 'next_cloud':
            return await executeNextCloudAction(actionName, interpolatedInputs, user, logger);
        case 'totp':
        case 'otp':
        case 'twofa':
            return await executeTotpAction(actionName, interpolatedInputs, user, logger);
        case 'yourls':
            return await executeYourlsAction(actionName, interpolatedInputs, user, logger);
        case 'countly':
            return await executeCountlyAction(actionName, interpolatedInputs, user, logger);
        case 'maxmind':
        case 'max_mind':
            return await executeMaxMindAction(actionName, interpolatedInputs, user, logger);

        case 'mandrill':
        case 'mandrillapp':
            return await executeMandrillAction(actionName, interpolatedInputs, user, logger);
        case 'goto':
        case 'gotomeeting':
        case 'logmein':
            return await executeGoToAction(actionName, interpolatedInputs, user, logger);
        case 'formio':
        case 'form_io':
            return await executeFormIoAction(actionName, interpolatedInputs, user, logger);
        case 'imgur':
        case 'imgurcom':
            return await executeImgurAction(actionName, interpolatedInputs, user, logger);
        case 'pushcut':
            return await executePushcutAction(actionName, interpolatedInputs, user, logger);

        case 'zohoinventory':
        case 'zoho_inventory':
            return await executeZohoInventoryAction(actionName, interpolatedInputs, user, logger);
        case 'workday':
            return await executeWorkdayAction(actionName, interpolatedInputs, user, logger);
        case 'lodgify':
            return await executeLodgifyAction(actionName, interpolatedInputs, user, logger);
        case 'productboard':
        case 'product_board':
            return await executeProductboardAction(actionName, interpolatedInputs, user, logger);
        case 'freshsales':
        case 'fresh_sales':
            return await executeFreshSalesAction(actionName, interpolatedInputs, user, logger);

        // Headless CMS / Analytics / AI Content / Thesaurus / Email Marketing
        case 'directus':
            return await executeDirectusAction(actionName, interpolatedInputs, user, logger);
        case 'pendo':
            return await executePendoAction(actionName, interpolatedInputs, user, logger);
        case 'jasper':
        case 'jasperai':
            return await executeJasperAction(actionName, interpolatedInputs, user, logger);
        case 'openthesaurus':
        case 'open_thesaurus':
            return await executeOpenThesaurusAction(actionName, interpolatedInputs, user, logger);
        case 'autopilot':
        case 'autopilothq':
        case 'ortto':
            return await executeAutopilotAction(actionName, interpolatedInputs, user, logger);

        case 'trengo':
            return await executeTrengoAction(actionName, interpolatedInputs, user, logger);
        case 'freshping':
        case 'fresh_ping':
            return await executeFreshpingAction(actionName, interpolatedInputs, user, logger);
        case 'statuspage':
        case 'atlassian_statuspage':
            return await executeStatuspageAction(actionName, interpolatedInputs, user, logger);
        case 'uptimekuma':
        case 'uptime_kuma':
            return await executeUptimeKumaAction(actionName, interpolatedInputs, user, logger);
        case 'zscaler':
            return await executeZscalerAction(actionName, interpolatedInputs, user, logger);

        case 'zenvia':
            return await executeZenviaAction(actionName, interpolatedInputs, user, logger);
        case 'interakt':
            return await executeInteraktAction(actionName, interpolatedInputs, user, logger);
        case 'clockwork':
        case 'clockworksms':
            return await executeClockworkAction(actionName, interpolatedInputs, user, logger);
        case 'g2':
        case 'g2reviews':
            return await executeG2Action(actionName, interpolatedInputs, user, logger);
        case 'qonto':
            return await executeQontoAction(actionName, interpolatedInputs, user, logger);

        case 'googleanalytics':
        case 'google_analytics':
        case 'ga4':
            return await executeGoogleAnalyticsAction(actionName, interpolatedInputs, user, logger);
        case 'confluence':
        case 'atlassian_confluence':
            return await executeConfluenceAction(actionName, interpolatedInputs, user, logger);
        case 'algolia':
            return await executeAlgoliaAction(actionName, interpolatedInputs, user, logger);
        case 'bitly':
            return await executeBitlyAction(actionName, interpolatedInputs, user, logger);
        case 'mailup':
            return await executeMailupAction(actionName, interpolatedInputs, user, logger);

        case 'mindbody':
        case 'mind_body':
            return await executeMindBodyAction(actionName, interpolatedInputs, user, logger);
        case 'smartrecruiters':
        case 'smart_recruiters':
            return await executeSmartRecruitersAction(actionName, interpolatedInputs, user, logger);
        case 'bexio':
            return await executeBexioAction(actionName, interpolatedInputs, user, logger);
        case 'unleashed':
        case 'unleashedsoftware':
            return await executeUnleashedAction(actionName, interpolatedInputs, user, logger);
        case 'helpwise':
            return await executeHelpwiseAction(actionName, interpolatedInputs, user, logger);

        case 'bigcommerce':
        case 'big_commerce':
            return await executeBigCommerceAction(actionName, interpolatedInputs, user, logger);
        case 'squarespace':
            return await executeSquarespaceAction(actionName, interpolatedInputs, user, logger);
        case 'ecwid':
            return await executeEcwidAction(actionName, interpolatedInputs, user, logger);
        case 'leadsquared':
        case 'lead_squared':
            return await executeLeadSquaredAction(actionName, interpolatedInputs, user, logger);
        case 'insightly':
            return await executeInsightlyAction(actionName, interpolatedInputs, user, logger);

        case 'campaignmonitor':
        case 'campaign_monitor':
            return await executeCampaignMonitorAction(actionName, interpolatedInputs, user, logger);
        case 'huggingface':
        case 'hugging_face':
        case 'hf':
            return await executeHuggingFaceAction(actionName, interpolatedInputs, user, logger);
        case 'ollama':
            return await executeOllamaAction(actionName, interpolatedInputs, user, logger);
        case 'togetherai':
        case 'together_ai':
        case 'together':
            return await executeTogetherAIAction(actionName, interpolatedInputs, user, logger);
        case 'openrouter':
        case 'open_router':
            return await executeOpenRouterAction(actionName, interpolatedInputs, user, logger);

        case 'egoi':
        case 'egoiapp':
        case 'egoi_marketing':
            return await executeEgoiAction(actionName, interpolatedInputs, user, logger);
        case 'moxie':
        case 'moxieapp':
            return await executeMoxieAction(actionName, interpolatedInputs, user, logger);
        case 'signalwire':
        case 'signal_wire':
            return await executeSignalWireAction(actionName, interpolatedInputs, user, logger);
        case 'vonage_video':
        case 'opentok':
        case 'tokbox':
            return await executeVonageVideoAction(actionName, interpolatedInputs, user, logger);
        case 'awslambda':
        case 'aws_lambda':
        case 'lambda':
            return await executeAwsLambdaAction(actionName, interpolatedInputs, user, logger);

        // Vector Databases / BaaS
        case 'pinecone':
            return await executePineconeAction(actionName, interpolatedInputs, user, logger);
        case 'weaviate':
            return await executeWeaviateAction(actionName, interpolatedInputs, user, logger);
        case 'qdrant':
            return await executeQdrantAction(actionName, interpolatedInputs, user, logger);
        case 'pocketbase':
        case 'pocket_base':
            return await executePocketBaseAction(actionName, interpolatedInputs, user, logger);
        case 'appwrite':
            return await executeAppwriteAction(actionName, interpolatedInputs, user, logger);

        // E-commerce / PIM / Ticketing (new batch)
        case 'prestashop':
        case 'presta_shop':
            return await executePrestaShopAction(actionName, interpolatedInputs, user, logger);
        case 'shopware':
        case 'shopware6':
            return await executeShopwareAction(actionName, interpolatedInputs, user, logger);
        case 'akeneo':
            return await executeAkeneoAction(actionName, interpolatedInputs, user, logger);
        case 'zendeskticket':
        case 'zendesk_ticket':
        case 'zendesk_enhanced':
            return await executeZendeskTicketAction(actionName, interpolatedInputs, user, logger);
        case 'twilioenhanced':
        case 'twilio_enhanced':
        case 'twilio_whatsapp':
            return await executeTwilioEnhancedAction(actionName, interpolatedInputs, user, logger);

        case 'zohomail':
        case 'zoho_mail':
            return await executeZohoMailAction(actionName, interpolatedInputs, user, logger);
        case 'zohoprojects':
        case 'zoho_projects':
            return await executeZohoProjectsAction(actionName, interpolatedInputs, user, logger);
        case 'personio':
            return await executePersonioAction(actionName, interpolatedInputs, user, logger);
        case 'factorial':
        case 'factorialhr':
            return await executeFactorialAction(actionName, interpolatedInputs, user, logger);
        case 'clockodo':
            return await executeClockodoAction(actionName, interpolatedInputs, user, logger);

        case 'awsses':
        case 'aws_ses':
        case 'ses':
            return await executeAwsSesAction(actionName, interpolatedInputs, user, logger);
        case 'awssns':
        case 'aws_sns':
        case 'sns':
            return await executeAwsSnsAction(actionName, interpolatedInputs, user, logger);
        case 'awssqs':
        case 'aws_sqs':
        case 'sqs':
            return await executeAwsSqsAction(actionName, interpolatedInputs, user, logger);
        case 'awsdynamodb':
        case 'aws_dynamodb':
        case 'dynamodb':
            return await executeAwsDynamoDbAction(actionName, interpolatedInputs, user, logger);
        case 'sharepoint':
        case 'microsoft_sharepoint':
            return await executeSharepointAction(actionName, interpolatedInputs, user, logger);

        case 'miro':
            return await executeMiroAction(actionName, interpolatedInputs, user, logger);
        case 'figma':
        case 'figjam':
            return await executeFigmaAction(actionName, interpolatedInputs, user, logger);
        case 'canva':
            return await executeCanvaAction(actionName, interpolatedInputs, user, logger);
        case 'zapier':
        case 'zapier_nla':
            return await executeZapierAction(actionName, interpolatedInputs, user, logger);
        case 'make':
        case 'integromat':
        case 'make_com':
            return await executeMakeAction(actionName, interpolatedInputs, user, logger);


        case 'bubble':
        case 'bubbleio':
            return await executeBubbleAction(actionName, interpolatedInputs, user, logger);
        case 'adalo':
            return await executeAdaloAction(actionName, interpolatedInputs, user, logger);
        case 'retool':
            return await executeRetoolAction(actionName, interpolatedInputs, user, logger);
        case 'glide':
        case 'glideapps':
            return await executeGlideAction(actionName, interpolatedInputs, user, logger);
        case 'softr':
            return await executeSoftrAction(actionName, interpolatedInputs, user, logger);
        case 'appsmith':
            return executeAppsmithAction(actionName, interpolatedInputs, user, logger);
        case 'budibase':
            return executeBudibaseAction(actionName, interpolatedInputs, user, logger);
        case 'tooljet':
        case 'tool_jet':
            return executeTooljetAction(actionName, interpolatedInputs, user, logger);

        case 'moosend':
            return await executeMoosendAction(actionName, interpolatedInputs, user, logger);
        case 'sharpspring':
        case 'sharp_spring':
            return await executeSharpSpringAction(actionName, interpolatedInputs, user, logger);
        case 'pardot':
        case 'salesforce_pardot':
            return await executePardotAction(actionName, interpolatedInputs, user, logger);
        case 'marketo':
            return await executeMarketoAction(actionName, interpolatedInputs, user, logger);
        case 'braze':
            return await executeBrazeAction(actionName, interpolatedInputs, user, logger);

        case 'metaads':
        case 'meta_ads':
        case 'fbads':
            return await executeMetaAdsAction(actionName, interpolatedInputs, user, logger);
        case 'facebook_ads':
        case 'facebook-ads':
            return executeFacebookAdsAction(actionName, interpolatedInputs, user, logger);
        case 'tiktokads':
            return await executeTikTokAdsAction(actionName, interpolatedInputs, user, logger);
        case 'tiktok_ads':
        case 'tiktok-ads':
            return executeTikTokAdsEnhancedAction(actionName, interpolatedInputs, user, logger);
        case 'pinterestads':
            return await executePinterestAdsAction(actionName, interpolatedInputs, user, logger);
        case 'pinterest_ads':
        case 'pinterest-ads':
            return executePinterestAdsEnhancedAction(actionName, interpolatedInputs, user, logger);
        case 'linkedinads':
            return await executeLinkedInAdsAction(actionName, interpolatedInputs, user, logger);
        case 'linkedin_ads':
            return executeLinkedInAdsEnhancedAction(actionName, interpolatedInputs, user, logger);
        case 'snapchat_ads':
        case 'snapchat-ads':
            return executeSnapchatAdsAction(actionName, interpolatedInputs, user, logger);
        case 'googleads':
        case 'google_ads':
            return await executeGoogleAdsAction(actionName, interpolatedInputs, user, logger);

        case 'googletasks':
        case 'google_tasks':
            return await executeGoogleTasksAction(actionName, interpolatedInputs, user, logger);
        case 'acuity':
        case 'acuity_scheduling':
            return await executeAcuityAction(actionName, interpolatedInputs, user, logger);
        case 'simplybook':
        case 'simply_book':
            return await executeSimplyBookAction(actionName, interpolatedInputs, user, logger);
        case 'square':
        case 'squareup':
            return await executeSquareAction(actionName, interpolatedInputs, user, logger);
        case 'awscloudwatch':
        case 'cloudwatch':
        case 'aws_cloudwatch':
            return await executeAwsCloudWatchAction(actionName, interpolatedInputs, user, logger);

        case 'azuredevops':
        case 'azure_devops':
        case 'ado':
            return await executeAzureDevOpsAction(actionName, interpolatedInputs, user, logger);
        case 'sentryenhanced':
        case 'sentry_enhanced':
            return await executeSentryEnhancedAction(actionName, interpolatedInputs, user, logger);
        case 'grafanaenhanced':
        case 'grafana_enhanced':
            return await executeGrafanaEnhancedAction(actionName, interpolatedInputs, user, logger);
        case 'newrelicenhanced':
        case 'newrelic_enhanced':
            return await executeNewRelicEnhancedAction(actionName, interpolatedInputs, user, logger);
        case 'dynatrace':
            return await executeDynatraceAction(actionName, interpolatedInputs, user, logger);

        case 'rollbar':
            return await executeRollbarAction(actionName, interpolatedInputs, user, logger);
        case 'bugsnag':
            return await executeBugsnagAction(actionName, interpolatedInputs, user, logger);
        case 'fullstory':
        case 'full_story':
            return await executeFullStoryAction(actionName, interpolatedInputs, user, logger);
        case 'logrocket':
        case 'log_rocket':
            return await executeLogRocketAction(actionName, interpolatedInputs, user, logger);
        case 'telnyx':
            return await executeTelnyxAction(actionName, interpolatedInputs, user, logger);

        case 'firebase':
        case 'firebase_admin':
            return await executeFirebaseAction(actionName, interpolatedInputs, user, logger);
        case 'onesignal':
        case 'one_signal':
            return await executeOneSignalAction(actionName, interpolatedInputs, user, logger);
        case 'amplitude':
            return await executeAmplitudeAction(actionName, interpolatedInputs, user, logger);
        case 'mixpanel':
            return await executeMixpanelAction(actionName, interpolatedInputs, user, logger);
        case 'appsflyer':
        case 'apps_flyer':
            return await executeAppsFlyerAction(actionName, interpolatedInputs, user, logger);

        case 'sendbird':
        case 'send_bird':
            return await executeSendbirdAction(actionName, interpolatedInputs, user, logger);
        case 'stream':
        case 'streamchat':
        case 'stream_chat':
            return await executeStreamAction(actionName, interpolatedInputs, user, logger);
        case 'clevertap':
        case 'clever_tap':
            return await executeCleverTapAction(actionName, interpolatedInputs, user, logger);
        case 'moengage':
        case 'mo_engage':
            return await executeMoEngageAction(actionName, interpolatedInputs, user, logger);
        case 'deepgram':
            return await executeDeepgramAction(actionName, interpolatedInputs, user, logger);

        // Headless CMS
        case 'sanity':
        case 'sanitycms':
            return await executeSanityAction(actionName, interpolatedInputs, user, logger);
        case 'prismic':
            return await executePrismicAction(actionName, interpolatedInputs, user, logger);
        case 'hygraph':
        case 'graphcms':
            return await executeHygraphAction(actionName, interpolatedInputs, user, logger);
        case 'contentstack':
        case 'content_stack':
            return await executeContentstackAction(actionName, interpolatedInputs, user, logger);
        case 'payloadcms':
        case 'payload_cms':
        case 'payload':
            return await executePayloadCmsAction(actionName, interpolatedInputs, user, logger);

        case 'xoxoday':
            return await executeXoxodayAction(actionName, interpolatedInputs, user, logger);
        case 'bandwidth':
            return await executeBandwidthAction(actionName, interpolatedInputs, user, logger);
        case 'vapi':
        case 'vapi_ai':
            return await executeVapiAction(actionName, interpolatedInputs, user, logger);
        case 'lark':
        case 'feishu':
        case 'larksuite':
            return await executeLarkAction(actionName, interpolatedInputs, user, logger);
        case 'bandsintown':
        case 'bands_in_town':
            return await executeBandsInTownAction(actionName, interpolatedInputs, user, logger);

        case 'googlecontacts':
        case 'google_contacts':
        case 'google_people':
            return await executeGoogleContactsAction(actionName, interpolatedInputs, user, logger);
        case 'googleforms':
        case 'google_forms':
            return await executeGoogleFormsAction(actionName, interpolatedInputs, user, logger);
        case 'msteams':
        case 'microsoft_teams':
        case 'teams':
            return await executeMsTeamsAction(actionName, interpolatedInputs, user, logger);
        case 'doodle':
            return await executeDoodleAction(actionName, interpolatedInputs, user, logger);
        case 'youcanbook':
        case 'youcanbookme':
            return await executeYouCanBookAction(actionName, interpolatedInputs, user, logger);

        case 'freshbooks':
        case 'fresh_books':
            return await executeFreshBooksAction(actionName, interpolatedInputs, user, logger);
        case 'waveaccounting':
        case 'wave_accounting':
        case 'waveapps':
            return await executeWaveAccountingAction(actionName, interpolatedInputs, user, logger);
        case 'bonsai':
        case 'hellobonsai':
            return await executeBonsaiAction(actionName, interpolatedInputs, user, logger);
        case 'timely':
        case 'timelyapp':
            return await executeTimelyAction(actionName, interpolatedInputs, user, logger);
        case 'everhour':
            return await executeEverhourAction(actionName, interpolatedInputs, user, logger);

        case 'openai_assistants':
        case 'openaiassistants':
        case 'assistants_api':
            return await executeOpenAiAssistantsAction(actionName, interpolatedInputs, user, logger);
        case 'langflow':
        case 'lang_flow':
            return await executeLangFlowAction(actionName, interpolatedInputs, user, logger);
        case 'flowise':
        case 'flowiseai':
            return await executeFlowiseAction(actionName, interpolatedInputs, user, logger);
        case 'temporal':
        case 'temporal_io':
            return await executeTemporalAction(actionName, interpolatedInputs, user, logger);
        case 'n8n':
        case 'n8n_self_hosted':
            return await executeN8nAction(actionName, interpolatedInputs, user, logger);

        case 'stripe_billing':
        case 'stripebilling':
        case 'stripe_subscriptions':
            return await executeStripeBillingAction(actionName, interpolatedInputs, user, logger);
        case 'shopify_admin':
        case 'shopifyadmin':
        case 'shopify_graphql':
            return await executeShopifyAdminAction(actionName, interpolatedInputs, user, logger);
        case 'monday_board':
        case 'mondayboard':
            return await executeMondayBoardAction(actionName, interpolatedInputs, user, logger);
        case 'hubspot_cms':
        case 'hubspotcms':
        case 'hubspot_marketing':
            return await executeHubSpotCmsAction(actionName, interpolatedInputs, user, logger);
        case 'pipedrive_enhanced':
        case 'pipedriveenhanced':
            return await executePipedriveEnhancedAction(actionName, interpolatedInputs, user, logger);
        case 'okta_enhanced':
        case 'oktaenhanced':
            return await executeOktaEnhancedAction(actionName, interpolatedInputs, user, logger);
        case 'auth0_enhanced':
        case 'auth0enhanced':
            return await executeAuth0EnhancedAction(actionName, interpolatedInputs, user, logger);
        case 'keycloak':
            return await executeKeycloakAction(actionName, interpolatedInputs, user, logger);
        case 'descope':
            return await executeDescopeAction(actionName, interpolatedInputs, user, logger);
        case 'supertokens':
        case 'super_tokens':
            return await executeSuperTokensAction(actionName, interpolatedInputs, user, logger);
        case 'woocommerce_enhanced':
            return await executeWoocommerceEnhancedAction(actionName, interpolatedInputs, user, logger);
        case 'opencart':
        case 'open_cart':
            return await executeOpencartAction(actionName, interpolatedInputs, user, logger);
        case 'google_meet':
        case 'google_meet_api':
            return await executeGoogleMeetAction(actionName, interpolatedInputs, user, logger);
        case 'google_classroom':
            return await executeGoogleClassroomAction(actionName, interpolatedInputs, user, logger);
        case 'google_workspace_admin':
        case 'google_admin':
            return await executeGoogleWorkspaceAdminAction(actionName, interpolatedInputs, user, logger);

        case 'webex_enhanced':
        case 'cisco_webex_enhanced':
            return await executeWebexEnhancedAction(actionName, interpolatedInputs, user, logger);
        case 'intercom_enhanced':
            return await executeIntercomEnhancedAction(actionName, interpolatedInputs, user, logger);
        case 'freshdesk_enhanced':
            return await executeFreshdeskEnhancedAction(actionName, interpolatedInputs, user, logger);
        case 'zendesk_guide':
        case 'zendesk_help_center':
            return await executeZendeskGuideAction(actionName, interpolatedInputs, user, logger);
        case 'salesforce_mc':
        case 'salesforce_marketing_cloud':
        case 'exacttarget':
            return await executeSalesforceMcAction(actionName, interpolatedInputs, user, logger);

        case 'clicksend':
            return await executeClicksendAction(actionName, inputs, user, logger);
        case 'sinch':
            return await executeSinchAction(actionName, inputs, user, logger);
        case 'messagemedia':
        case 'message_media':
            return await executeMessageMediaAction(actionName, inputs, user, logger);
        case 'd7networks':
        case 'd7_networks':
            return await executeD7NetworksAction(actionName, inputs, user, logger);
        case 'vonage_messages':
        case 'vonage_enhanced':
            return await executeVonageMessagesAction(actionName, inputs, user, logger);

        case 'twitch_enhanced':
            return await executeTwitchEnhancedAction(actionName, inputs, user, logger);
        case 'youtube_analytics':
        case 'youtube_data':
            return await executeYoutubeAnalyticsAction(actionName, inputs, user, logger);
        case 'spotify_enhanced':
            return await executeSpotifyEnhancedAction(actionName, inputs, user, logger);
        case 'reddit':
            return await executeRedditAction(actionName, inputs, user, logger);
        case 'discord_enhanced':
            return await executeDiscordEnhancedAction(actionName, inputs, user, logger);

        case 'aws_rekognition':
        case 'rekognition':
            return await executeAwsRekognitionAction(actionName, inputs, user, logger);
        case 'aws_textract':
        case 'textract':
            return await executeAwsTextractAction(actionName, inputs, user, logger);
        case 'aws_comprehend':
        case 'comprehend':
            return await executeAwsComprehendAction(actionName, inputs, user, logger);
        case 'aws_transcribe':
        case 'transcribe':
            return await executeAwsTranscribeAction(actionName, inputs, user, logger);
        case 'aws_polly':
        case 'polly':
            return await executeAwsPollyAction(actionName, inputs, user, logger);

        case 'xero_enhanced':
            return await executeXeroEnhancedAction(actionName, inputs, user, logger);
        case 'quickbooks_enhanced':
        case 'quickbooks_online':
            return await executeQuickbooksEnhancedAction(actionName, inputs, user, logger);
        case 'gusto':
            return await executeGustoAction(actionName, inputs, user, logger);
        case 'bamboohr_enhanced':
            return await executeBamboohrEnhancedAction(actionName, inputs, user, logger);
        case 'sage':
        case 'sage_accounting':
            return await executeSageAction(actionName, inputs, user, logger);
        case 'loom':
            return await executeLoomAction(actionName, inputs, user, logger);
        case 'vimeo':
            return await executeVimeoAction(actionName, inputs, user, logger);
        case 'imagekit':
        case 'image_kit':
            return await executeImagekitAction(actionName, inputs, user, logger);
        case 'cloudinary_enhanced':
            return await executeCloudinaryEnhancedAction(actionName, inputs, user, logger);

        case 'linkedin_enhanced':
            return await executeLinkedinEnhancedAction(actionName, interpolatedInputs, user, logger);
        case 'twitter_enhanced':
        case 'x_api':
            return await executeTwitterEnhancedAction(actionName, interpolatedInputs, user, logger);
        case 'instagram_graph':
        case 'instagram_api':
            return await executeInstagramGraphAction(actionName, interpolatedInputs, user, logger);
        case 'tiktok_business':
        case 'tiktok_api':
            return await executeTiktokBusinessAction(actionName, interpolatedInputs, user, logger);
        case 'pinterest_enhanced':
            return await executePinterestEnhancedAction(actionName, interpolatedInputs, user, logger);
        case 'salesforce_enhanced':
        case 'salesforce_rest':
            return await executeSalesforceEnhancedAction(actionName, interpolatedInputs, user, logger);
        case 'servicenow_enhanced':
            return await executeServiceNowEnhancedAction(actionName, interpolatedInputs, user, logger);
        case 'zohocrm_enhanced':
        case 'zoho_crm_enhanced':
            return await executeZohoCrmEnhancedAction(actionName, interpolatedInputs, user, logger);
        case 'dynamics365':
        case 'microsoft_dynamics':
            return await executeDynamics365Action(actionName, interpolatedInputs, user, logger);
        case 'sap':
        case 'sap_odata':
            return await executeSapAction(actionName, interpolatedInputs, user, logger);

        case 'brevo_enhanced':
        case 'brevo-enhanced':
        case 'sendinblue_enhanced':
            return await executeBrevoEnhancedAction(actionName, interpolatedInputs, user, logger);
        case 'activecampaign_enhanced':
        case 'activecampaign-enhanced':
            return await executeActivecampaignEnhancedAction(actionName, interpolatedInputs, user, logger);
        case 'klaviyo_enhanced':
        case 'klaviyo-enhanced':
            return await executeKlaviyoEnhancedAction(actionName, interpolatedInputs, user, logger);

        case 'docusign':
            return await executeDocusignAction(actionName, interpolatedInputs, user, logger);
        case 'dropbox_sign':
        case 'hellosign':
            return await executeDropboxSignAction(actionName, interpolatedInputs, user, logger);
        case 'pandadoc_enhanced':
            return await executePandadocEnhancedAction(actionName, interpolatedInputs, user, logger);
        case 'signnow':
        case 'sign_now':
            return await executeSignnowAction(actionName, interpolatedInputs, user, logger);
        case 'adobe_sign':
        case 'acrobat_sign':
            return await executeAdobeSignAction(actionName, interpolatedInputs, user, logger);

        case 'google_bigquery':
        case 'bigquery':
            return await executeGoogleBigqueryAction(actionName, interpolatedInputs, user, logger);
        case 'google_pubsub':
        case 'pubsub':
            return await executeGooglePubsubAction(actionName, interpolatedInputs, user, logger);
        case 'google_cloud_storage':
        case 'gcs':
            return await executeGoogleCloudStorageAction(actionName, interpolatedInputs, user, logger);
        case 'google_cloud_functions':
        case 'gcf':
            return await executeGoogleCloudFunctionsAction(actionName, interpolatedInputs, user, logger);
        case 'google_secret_manager':
        case 'gcp_secrets':
            return await executeGoogleSecretManagerAction(actionName, interpolatedInputs, user, logger);

        case 'mailerlite_enhanced':
            return await executeMailerliteEnhancedAction(actionName, interpolatedInputs, user, logger);
        case 'convertkit_enhanced':
            return await executeConvertkitEnhancedAction(actionName, interpolatedInputs, user, logger);
        case 'constant_contact':
        case 'constant-contact':
            return await executeConstantContactAction(actionName, interpolatedInputs, user, logger);
        case 'benchmark_email':
            return await executeBenchmarkEmailAction(actionName, interpolatedInputs, user, logger);

        case 'elasticsearch':
        case 'elastic':
            return await executeElasticsearchAction(actionName, interpolatedInputs, user, logger);
        case 'mongodb_atlas':
        case 'atlas_data_api':
            return await executeMongodbAtlasAction(actionName, interpolatedInputs, user, logger);
        case 'supabase_enhanced':
            return await executeSupabaseEnhancedAction(actionName, interpolatedInputs, user, logger);
        case 'planetscale':
        case 'planet_scale':
            return await executePlanetscaleAction(actionName, interpolatedInputs, user, logger);
        case 'neon':
        case 'neon_db':
            return await executeNeonAction(actionName, interpolatedInputs, user, logger);

        case 'clickup_enhanced':
            return await executeClickupEnhancedAction(actionName, inputs, user, logger);
        case 'asana_enhanced':
            return await executeAsanaEnhancedAction(actionName, inputs, user, logger);
        case 'todoist_enhanced':
        case 'todoist-enhanced':
            return await executeTodoistEnhancedAction(actionName, inputs, user, logger);
        case 'trello_enhanced':
        case 'trello-enhanced':
            return await executeTrelloEnhancedAction(actionName, inputs, user, logger);
        case 'meistertask':
        case 'meister_task':
            return await executeMeistertaskAction(actionName, inputs, user, logger);

        case 'calendly_enhanced':
            return await executeCalendlyEnhancedAction(actionName, inputs, user, logger);
        case 'calcom':
        case 'cal_com':
            return await executeCalcomEnhancedAction(actionName, inputs, user, logger);
        case 'hubspot_meetings':
            return await executeHubspotMeetingsAction(actionName, inputs, user, logger);
        case 'acuity_enhanced':
        case 'acuity_scheduling':
            return await executeAcuityEnhancedAction(actionName, inputs, user, logger);
        case 'microsoft_bookings':
        case 'ms_bookings':
            return await executeMicrosoftBookingsAction(actionName, inputs, user, logger);

        case 'circleci_enhanced':
            return await executeCircleciEnhancedAction(actionName, interpolatedInputs, user, logger);
        case 'travis_ci':
            return await executeTravisCiAction(actionName, interpolatedInputs, user, logger);
        case 'github_actions':
            return await executeGithubActionsAction(actionName, interpolatedInputs, user, logger);
        case 'jenkins':
            return await executeJenkinsAction(actionName, interpolatedInputs, user, logger);
        case 'buddy_ci':
        case 'buddy':
            return await executeBuddyCiAction(actionName, interpolatedInputs, user, logger);

        case 'adyen':
            return await executeAdyenAction(actionName, interpolatedInputs, user, logger);
        case 'braintree':
            return await executeBraintreeAction(actionName, interpolatedInputs, user, logger);
        case 'coinbase_commerce':
        case 'coinbase':
            return await executeCoinbaseCommerceAction(actionName, interpolatedInputs, user, logger);
        case 'lemonsqueezy':
        case 'lemon_squeezy':
            return await executeLemonsqueezyAction(actionName, interpolatedInputs, user, logger);

        case 'webflow_enhanced':
            return await executeWebflowEnhancedAction(actionName, interpolatedInputs, user, logger);
        case 'ghost_cms':
        case 'ghost':
            return await executeGhostCmsAction(actionName, interpolatedInputs, user, logger);
        case 'ghost_enhanced':
        case 'ghost-enhanced':
            return executeGhostEnhancedAction(actionName, interpolatedInputs, user, logger);
        case 'storyblok_enhanced':
            return executeStoryblokEnhancedAction(actionName, interpolatedInputs, user, logger);
        case 'sanity_enhanced':
            return executeSanityEnhancedAction(actionName, interpolatedInputs, user, logger);
        case 'prismic_enhanced':
            return executePrismicEnhancedAction(actionName, interpolatedInputs, user, logger);
        case 'wordpress_enhanced':
            return await executeWordpressEnhancedAction(actionName, interpolatedInputs, user, logger);
        case 'strapi_enhanced':
            return await executeStrapienHancedAction(actionName, interpolatedInputs, user, logger);

        case 'confluent_kafka':
        case 'confluent':
            return await executeConfluentKafkaAction(actionName, inputs, user, logger);
        case 'nats':
        case 'nats_io':
            return await executeNatsAction(actionName, inputs, user, logger);
        case 'apache_pulsar':
        case 'pulsar':
            return await executeApachePulsarAction(actionName, inputs, user, logger);
        case 'redpanda':
            return await executeRedpandaAction(actionName, inputs, user, logger);

        case 'zoom_enhanced':
            return await executeZoomEnhancedAction(actionName, interpolatedInputs, user, logger);
        case 'daily_co':
        case 'daily':
            return await executeDailyCoAction(actionName, interpolatedInputs, user, logger);
        case 'whereby':
            return await executeWherebyAction(actionName, interpolatedInputs, user, logger);
        case 'jitsi':
        case 'jitsi_jaas':
            return await executeJitsiAction(actionName, interpolatedInputs, user, logger);
        case 'goto_meeting':
        case 'gotomeeting':
            return await executeGotoMeetingAction(actionName, interpolatedInputs, user, logger);

        case 'hunterio':
        case 'hunter_io':
            return await executeHunterioAction(actionName, inputs, user, logger);
        case 'clearbit_enhanced':
            return await executeClearbitEnhancedAction(actionName, inputs, user, logger);
        case 'fullcontact':
        case 'full_contact':
            return await executeFullcontactAction(actionName, inputs, user, logger);
        case 'phantombuster_enhanced':
            return await executePhantombusterEnhancedAction(actionName, inputs, user, logger);
        case 'lusha':
            return await executeLushaAction(actionName, inputs, user, logger);

        case 'azure_blob':
        case 'azure_storage':
            return await executeAzureBlobAction(actionName, interpolatedInputs, user, logger);
        case 'azure_functions':
            return await executeAzureFunctionsAction(actionName, interpolatedInputs, user, logger);
        case 'azure_service_bus':
            return await executeAzureServiceBusAction(actionName, interpolatedInputs, user, logger);
        case 'azure_cognitive':
        case 'azure_cognitive_services':
            return await executeAzureCognitiveAction(actionName, interpolatedInputs, user, logger);
        case 'azure_openai':
            return await executeAzureOpenaiAction(actionName, interpolatedInputs, user, logger);

        // AWS Infrastructure Services
        case 'aws_ecs':
        case 'ecs':
            return await executeAwsEcsAction(actionName, inputs, user, logger);
        case 'aws_eks':
        case 'eks':
            return await executeAwsEksAction(actionName, inputs, user, logger);
        case 'aws_route53':
        case 'route53':
            return await executeAwsRoute53Action(actionName, inputs, user, logger);
        case 'aws_iam':
        case 'iam':
            return await executeAwsIamAction(actionName, inputs, user, logger);
        case 'aws_codepipeline':
        case 'codepipeline':
            return await executeAwsCodepipelineAction(actionName, inputs, user, logger);

        // AI Providers (enhanced)
        case 'google_gemini':
        case 'gemini_enhanced':
            return await executeGoogleGeminiAction(actionName, interpolatedInputs, user, logger);
        case 'anthropic_claude':
        case 'anthropic_enhanced':
            return await executeAnthropicClaudeAction(actionName, interpolatedInputs, user, logger);
        case 'cohere':
            return await executeCohereAction(actionName, interpolatedInputs, user, logger);
        case 'mistral_ai':
        case 'mistral':
            return await executeMistralAiAction(actionName, interpolatedInputs, user, logger);
        case 'perplexity_ai':
        case 'perplexity':
            return await executePerplexityAiAction(actionName, interpolatedInputs, user, logger);

        // Telephony / Contact Center
        case 'aircall':
            return await executeAircallAction(actionName, interpolatedInputs, user, logger);
        case 'dialpad':
            return await executeDialpadAction(actionName, interpolatedInputs, user, logger);
        case 'genesys_cloud':
        case 'genesys':
            return await executeGenesysCloudAction(actionName, interpolatedInputs, user, logger);
        case 'five9':
            return await executeFive9Action(actionName, interpolatedInputs, user, logger);

        case 'rippling':
            return await executeRipplingAction(actionName, interpolatedInputs, user, logger);
        case 'adp':
        case 'adp_workforce':
            return await executeAdpAction(actionName, interpolatedInputs, user, logger);
        case 'paychex':
        case 'paychex_flex':
            return await executePaychexAction(actionName, interpolatedInputs, user, logger);
        case 'trinet':
            return await executeTrinetAction(actionName, interpolatedInputs, user, logger);
        case 'namely':
            return await executeNamelyAction(actionName, interpolatedInputs, user, logger);

        case 'google_analytics4':
        case 'ga4':
            return await executeGoogleAnalytics4Action(actionName, inputs, user, logger);
        case 'google_search_console':
        case 'search_console':
            return await executeGoogleSearchConsoleAction(actionName, inputs, user, logger);
        case 'google_tag_manager':
        case 'gtm':
            return await executeGoogleTagManagerAction(actionName, inputs, user, logger);
        case 'looker_studio':
        case 'looker':
            return await executeLookerStudioAction(actionName, inputs, user, logger);
        case 'google_merchant':
        case 'google_shopping':
            return await executeGoogleMerchantAction(actionName, inputs, user, logger);

        case 'wix_api':
        case 'wix':
            return await executeWixApiAction(actionName, interpolatedInputs, user, logger);
        case 'volusion':
            return await executeVolusionAction(actionName, interpolatedInputs, user, logger);
        case 'cs_cart':
            return await executeCsCartAction(actionName, interpolatedInputs, user, logger);
        case 'opencart_enhanced':
            return await executeOpencartEnhancedAction(actionName, interpolatedInputs, user, logger);
        case 'prestashop_enhanced':
            return await executePrestaShopEnhancedAction(actionName, interpolatedInputs, user, logger);

        case 'aws_bedrock':
        case 'bedrock':
            return await executeAwsBedrockAction(actionName, interpolatedInputs, user, logger);
        case 'aws_sagemaker':
        case 'sagemaker':
            return await executeAwsSagemakerAction(actionName, interpolatedInputs, user, logger);
        case 'aws_glue':
        case 'glue':
            return await executeAwsGlueAction(actionName, interpolatedInputs, user, logger);
        case 'aws_step_functions':
        case 'step_functions':
            return await executeAwsStepFunctionsAction(actionName, interpolatedInputs, user, logger);
        case 'aws_eventbridge':
        case 'eventbridge':
            return await executeAwsEventbridgeAction(actionName, interpolatedInputs, user, logger);
        case 'sumologic':
        case 'sumo_logic':
            return await executeSumoLogicAction(actionName, interpolatedInputs, user, logger);
        case 'loggly':
            return await executeLogglyAction(actionName, interpolatedInputs, user, logger);
        case 'papertrail':
            return await executePapertrailAction(actionName, interpolatedInputs, user, logger);

        case 'typesense':
            return await executeTypesenseAction(actionName, interpolatedInputs, user, logger);
        case 'meilisearch':
            return await executeMeilisearchAction(actionName, interpolatedInputs, user, logger);
        case 'solr':
        case 'apache_solr':
            return await executeSolrAction(actionName, interpolatedInputs, user, logger);
        case 'algolia_enhanced':
            return await executeAlgoliaEnhancedAction(actionName, interpolatedInputs, user, logger);
        case 'segment_enhanced':
            return await executeSegmentEnhancedAction(actionName, inputs, user, logger);
        case 'posthog_enhanced':
            return await executePosthogEnhancedAction(actionName, inputs, user, logger);
        case 'rudderstack':
        case 'rudder_stack':
            return await executeRudderstackAction(actionName, inputs, user, logger);
        case 'heap_analytics':
        case 'heap':
            return await executeHeapAnalyticsAction(actionName, inputs, user, logger);
        case 'mixpanel_enhanced':
            return await executeMixpanelEnhancedAction(actionName, inputs, user, logger);

        // Contact Center Platforms
        case 'amazon_connect':
        case 'aws_connect':
            return await executeAmazonConnectAction(actionName, inputs, user, logger);
        case 'talkdesk':
            return await executeTalkdeskAction(actionName, inputs, user, logger);
        case 'eightx8':
        case '8x8':
            return await executeEightx8Action(actionName, inputs, user, logger);
        case 'ringcentral':
        case 'ring_central':
            return await executeRingcentralAction(actionName, inputs, user, logger);
        case 'vonage_contact_center':
        case 'newvoicemedia':
            return await executeVonageContactCenterAction(actionName, inputs, user, logger);

        case 'runway_ml':
        case 'runwayml':
            return await executeRunwayMlAction(actionName, inputs, user, logger);
        case 'leonardo_ai':
        case 'leonardo':
            return await executeLeonardoAiAction(actionName, inputs, user, logger);

        case 'figma_enhanced':
            return await executeFigmaEnhancedAction(actionName, inputs, user, logger);
        case 'canva_enhanced':
            return await executeCanvaEnhancedAction(actionName, inputs, user, logger);
        case 'miro_enhanced':
            return await executeMiroEnhancedAction(actionName, inputs, user, logger);
        case 'abstract':
        case 'abstract_app':
            return await executeAbstractAction(actionName, inputs, user, logger);
        case 'zeplin':
            return await executeZeplinAction(actionName, inputs, user, logger);

        case 'particle_iot':
        case 'particle':
            return await executeParticleIotAction(actionName, inputs, user, logger);
        case 'thingspeak':
        case 'thing_speak':
            return await executeThingspeakAction(actionName, inputs, user, logger);
        case 'ifttt':
            return await executeIftttAction(actionName, inputs, user, logger);
        case 'zapier_webhooks':
            return await executeZapierWebhooksAction(actionName, inputs, user, logger);
        case 'make_enhanced':
        case 'integromat_enhanced':
            return await executeMakeEnhancedAction(actionName, inputs, user, logger);

        case 'shopify_webhooks':
            return await executeShopifyWebhooksAction(actionName, inputs, user, logger);
        case 'bigcommerce_enhanced':
            return await executeBigcommerceEnhancedAction(actionName, inputs, user, logger);
        case 'square_enhanced':
            return await executeSquareEnhancedAction(actionName, inputs, user, logger);
        case 'paypal_enhanced':
            return await executePaypalEnhancedAction(actionName, inputs, user, logger);
        case 'klarna':
            return await executeKlarnaAction(actionName, inputs, user, logger);

        case 'scrapingbee':
        case 'scraping_bee':
            return await executeScrapingBeeAction(actionName, inputs, user, logger);
        case 'browserless':
            return await executeBrowserlessAction(actionName, inputs, user, logger);
        case 'brightdata':
        case 'bright_data':
        case 'luminati':
            return await executeBrightDataAction(actionName, inputs, user, logger);
        case 'zenrows':
        case 'zen_rows':
            return await executeZenrowsAction(actionName, inputs, user, logger);

        case 'influxdb':
        case 'influx_db':
            return await executeInfluxdbAction(actionName, interpolatedInputs, user, logger);
        case 'apache_cassandra':
        case 'cassandra':
        case 'astra_db':
            return await executeApacheCassandraAction(actionName, interpolatedInputs, user, logger);
        case 'cockroachdb':
        case 'cockroach_db':
            return await executeCockroachdbAction(actionName, interpolatedInputs, user, logger);
        case 'tidb':
        case 'tidb_cloud':
            return await executeTidbAction(actionName, interpolatedInputs, user, logger);

        // Survey / Form Platforms (enhanced batch)
        case 'surveymonkey_enhanced':
        case 'surveymonkey-enhanced':
            return await executeSurveyMonkeyEnhancedAction(actionName, interpolatedInputs, user, logger);
        case 'qualtrics':
            return await executeQualtricsAction(actionName, interpolatedInputs, user, logger);
        case 'typeform_enhanced':
        case 'typeform-enhanced':
            return await executeTypeformEnhancedAction(actionName, interpolatedInputs, user, logger);
        case 'jotform_enhanced':
        case 'jotform-enhanced':
            return await executeJotFormEnhancedAction(actionName, interpolatedInputs, user, logger);
        case 'googleforms_enhanced':
        case 'google_forms_enhanced':
            return await executeGoogleFormsEnhancedAction(actionName, interpolatedInputs, user, logger);
        case 'tally_forms':
        case 'tally-forms':
            return await executeTallyFormsAction(actionName, interpolatedInputs, user, logger);

        // Customer Success / CS Platforms
        case 'gainsight':
            return await executeGainsightAction(actionName, interpolatedInputs, user, logger);
        case 'churnzero':
        case 'churn_zero':
            return await executeChurnZeroAction(actionName, interpolatedInputs, user, logger);
        case 'totango':
            return await executeTotangoAction(actionName, interpolatedInputs, user, logger);
        case 'customerio_enhanced':
            return await executeCustomerioEnhancedAction(actionName, interpolatedInputs, user, logger);
        case 'braze_enhanced':
            return await executeBrazeEnhancedAction(actionName, interpolatedInputs, user, logger);

        // Crypto / Currency / Finance (new batch)
        case 'coinmarketcap':
        case 'coin_market_cap':
            return await executeCoinMarketCapAction(actionName, interpolatedInputs, user, logger);
        case 'currencylayer':
        case 'currency_layer':
            return await executeCurrencylayerAction(actionName, interpolatedInputs, user, logger);
        case 'fixerio':
        case 'fixer_io':
            return await executeFixerioAction(actionName, interpolatedInputs, user, logger);
        case 'openexchangerates':
        case 'open_exchange_rates':
            return await executeOpenExchangeRatesAction(actionName, interpolatedInputs, user, logger);

        case 'zerobounce':
        case 'zero_bounce':
            return await executeZeroBounceAction(actionName, interpolatedInputs, user, logger);
        case 'neverbounce':
        case 'never_bounce':
            return await executeNeverBounceAction(actionName, interpolatedInputs, user, logger);
        case 'abstract_api':
            return await executeAbstractApiAction(actionName, interpolatedInputs, user, logger);
        case 'ipinfo':
        case 'ip_info':
            return await executeIpinfoAction(actionName, interpolatedInputs, user, logger);
        case 'shodan':
            return await executeShodanAction(actionName, interpolatedInputs, user, logger);
        case 'plivo_enhanced':
            return await executePlivoEnhancedAction(actionName, interpolatedInputs, user, logger);
        case 'exotel':
            return await executeExotelAction(actionName, interpolatedInputs, user, logger);
        case 'kaleyra':
            return await executeKaleyraAction(actionName, interpolatedInputs, user, logger);
        case 'messagebird_enhanced':
            return await executeMessageBirdEnhancedAction(actionName, interpolatedInputs, user, logger);
        case 'textmagic':
        case 'text_magic':
            return await executeTextMagicAction(actionName, interpolatedInputs, user, logger);

        case 'deepl':
        case 'deepl_translate':
            return await executeDeeplAction(actionName, interpolatedInputs, user, logger);
        case 'openweathermap':
        case 'open_weather':
            return await executeOpenWeatherMapAction(actionName, interpolatedInputs, user, logger);
        case 'google_maps':
        case 'google_maps_api':
            return await executeGoogleMapsAction(actionName, interpolatedInputs, user, logger);
        case 'mapbox':
            return await executeMapboxAction(actionName, interpolatedInputs, user, logger);
        case 'coingecko':
        case 'coin_gecko':
            return await executeCoinGeckoAction(actionName, interpolatedInputs, user, logger);

        case 'linear_enhanced':
            return await executeLinearEnhancedAction(actionName, interpolatedInputs, user, logger);
        case 'height':
        case 'height_app':
            return await executeHeightAction(actionName, interpolatedInputs, user, logger);
        case 'plane':
        case 'plane_so':
            return await executePlaneAction(actionName, interpolatedInputs, user, logger);
        case 'shortcut':
        case 'clubhouse':
            return await executeShortcutAction(actionName, interpolatedInputs, user, logger);
        case 'harvest_enhanced':
            return await executeHarvestEnhancedAction(actionName, interpolatedInputs, user, logger);
        case 'aws_cognito':
        case 'cognito':
            return await executeAwsCognitoAction(actionName, interpolatedInputs, user, logger);
        case 'aws_cloudformation':
        case 'cloudformation':
            return await executeAwsCloudFormationAction(actionName, interpolatedInputs, user, logger);
        case 'aws_lightsail':
        case 'lightsail':
            return await executeAwsLightsailAction(actionName, interpolatedInputs, user, logger);
        case 'aws_amplify':
        case 'amplify':
            return await executeAwsAmplifyAction(actionName, interpolatedInputs, user, logger);
        case 'aws_appsync':
        case 'appsync':
            return await executeAwsAppSyncAction(actionName, interpolatedInputs, user, logger);

        case 'github_enhanced':
        case 'github-enhanced':
            return executeGitHubEnhancedAction(actionName, inputs, user, logger);
        case 'gitlab_enhanced':
        case 'gitlab-enhanced':
            return await executeGitlabEnhancedAction(actionName, inputs, user, logger);
        case 'bitbucket_enhanced':
        case 'bitbucket-enhanced':
            return await executeBitbucketEnhancedAction(actionName, inputs, user, logger);
        case 'azure_devops_enhanced':
        case 'azure-devops-enhanced':
            return executeAzureDevOpsEnhancedAction(actionName, inputs, user, logger);
        case 'gitea':
            return await executeGiteaAction(actionName, inputs, user, logger);
        case 'codecov':
            return await executeCodecovAction(actionName, inputs, user, logger);
        case 'sonarqube':
        case 'sonar_qube':
            return await executeSonarQubeAction(actionName, inputs, user, logger);

        case 'google_chat':
        case 'google_spaces':
            return await executeGoogleChatAction(actionName, interpolatedInputs, user, logger);
        case 'workplace_meta':
        case 'workplace_by_facebook':
            return await executeWorkplaceMetaAction(actionName, interpolatedInputs, user, logger);
        case 'telegram_bot':
        case 'telegram':
            return await executeTelegramBotAction(actionName, interpolatedInputs, user, logger);
        case 'whatsapp_cloud':
        case 'whatsapp_cloud_api':
            return await executeWhatsAppCloudAction(actionName, interpolatedInputs, user, logger);
        case 'teams_webhook':
        case 'ms_teams_webhook':
            return await executeTeamsWebhookAction(actionName, interpolatedInputs, user, logger);

        // Payments / Billing (new batch)
        case 'revolut': return executeRevolutAction(actionName, inputs, user, logger);
        case 'mangopay': return executeMangopayAction(actionName, inputs, user, logger);
        case 'gocardless': return executeGoCardlessAction(actionName, inputs, user, logger);
        case 'go_cardless': return executeGoCardlessAction(actionName, inputs, user, logger);
        case 'chargebee_enhanced': return executeChargebeeEnhancedAction(actionName, inputs, user, logger);
        case 'chargebee-enhanced': return executeChargebeeEnhancedAction(actionName, inputs, user, logger);
        case 'zuora': return executeZuoraAction(actionName, inputs, user, logger);

        // HashiCorp / Infrastructure Orchestration
        case 'terraform_cloud': return executeTerraformCloudAction(actionName, inputs, user, logger);
        case 'terraform-cloud': return executeTerraformCloudAction(actionName, inputs, user, logger);
        case 'vault': return executeVaultAction(actionName, inputs, user, logger);
        case 'hashicorp_vault': return executeVaultAction(actionName, inputs, user, logger);
        case 'consul': return executeConsulAction(actionName, inputs, user, logger);
        case 'nomad': return executeNomadAction(actionName, inputs, user, logger);
        case 'ansible_awx': return executeAnsibleAwxAction(actionName, inputs, user, logger);
        case 'ansible-awx': return executeAnsibleAwxAction(actionName, inputs, user, logger);

        // E-commerce Marketplaces
        case 'etsy': return executeEtsyAction(actionName, inputs, user, logger);
        case 'ebay': return executeEbayAction(actionName, inputs, user, logger);
        case 'amazon_sp_api': return executeAmazonSpApiAction(actionName, inputs, user, logger);
        case 'amazon-sp-api': return executeAmazonSpApiAction(actionName, inputs, user, logger);
        case 'walmart': return executeWalmartAction(actionName, inputs, user, logger);
        case 'shopify_partner': return executeShopifyPartnerAction(actionName, inputs, user, logger);
        case 'shopify-partner': return executeShopifyPartnerAction(actionName, inputs, user, logger);

        // Asian Messaging Platforms
        case 'feishu': return executeFeishuAction(actionName, inputs, user, logger);
        case 'lark_feishu': return executeFeishuAction(actionName, inputs, user, logger);
        case 'dingtalk': return executeDingTalkAction(actionName, inputs, user, logger);
        case 'ding_talk': return executeDingTalkAction(actionName, inputs, user, logger);
        case 'wechat_work': return executeWechatWorkAction(actionName, inputs, user, logger);
        case 'wecom': return executeWechatWorkAction(actionName, inputs, user, logger);
        case 'line_messaging': return executeLineMessagingAction(actionName, inputs, user, logger);
        case 'line_messaging_api': return executeLineMessagingAction(actionName, inputs, user, logger);
        case 'viber': return executeViberAction(actionName, inputs, user, logger);

        case 'hotjar': return executeHotjarAction(actionName, inputs, user, logger);
        case 'raygun': return executeRaygunAction(actionName, inputs, user, logger);

        // Enhanced AI Providers
        case 'openai_enhanced': return executeOpenAiEnhancedAction(actionName, inputs, user, logger);
        case 'openai-enhanced': return executeOpenAiEnhancedAction(actionName, inputs, user, logger);
        case 'xai': return executeXAiAction(actionName, inputs, user, logger);
        case 'x_ai': return executeXAiAction(actionName, inputs, user, logger);
        case 'grok': return executeXAiAction(actionName, inputs, user, logger);
        case 'deepseek': return executeDeepSeekAction(actionName, inputs, user, logger);
        case 'deep_seek': return executeDeepSeekAction(actionName, inputs, user, logger);

        // Customer Support Platforms (new batch)
        case 'helpscout_enhanced': return executeHelpScoutEnhancedAction(actionName, inputs, user, logger);
        case 'groove': return executeGrooveAction(actionName, inputs, user, logger);
        case 'gorgias': return executeGorgiasAction(actionName, inputs, user, logger);
        case 'gladly': return executeGladlyAction(actionName, inputs, user, logger);
        case 'kustomer': return executeKustomerAction(actionName, inputs, user, logger);

        case 'appdynamics': return executeAppDynamicsAction(actionName, inputs, user, logger);
        case 'app_dynamics': return executeAppDynamicsAction(actionName, inputs, user, logger);
        case 'grafana_enhanced_v2': return executeGrafanaEnhancedFileAction(actionName, inputs, user, logger);
        case 'pagerduty_enhanced': return executePagerdutyEnhancedAction(actionName, inputs, user, logger);
        case 'baserow': return executeBaserowAction(actionName, inputs, user, logger);

        case 'jira_enhanced': return executeJiraEnhancedAction(actionName, inputs, user, logger);
        case 'jira-enhanced': return executeJiraEnhancedAction(actionName, inputs, user, logger);
        case 'confluence_enhanced': return executeConfluenceEnhancedAction(actionName, inputs, user, logger);
        case 'confluence-enhanced': return executeConfluenceEnhancedAction(actionName, inputs, user, logger);
        case 'notion_enhanced': return executeNotionEnhancedAction(actionName, inputs, user, logger);
        case 'notion-enhanced': return executeNotionEnhancedAction(actionName, inputs, user, logger);
        case 'azure_devops': return executeAzureDevOpsNewAction(actionName, inputs, user, logger);
        case 'azure-devops': return executeAzureDevOpsNewAction(actionName, inputs, user, logger);
        case 'bamboo_ci': return executeBambooCiAction(actionName, inputs, user, logger);
        case 'bamboo-ci': return executeBambooCiAction(actionName, inputs, user, logger);
        case 'octopus_deploy': return executeOctopusDeployAction(actionName, inputs, user, logger);
        case 'octopus-deploy': return executeOctopusDeployAction(actionName, inputs, user, logger);

        case 'turso': return executeTursoAction(actionName, inputs, user, logger);
        case 'xata': return executeXataAction(actionName, inputs, user, logger);
        case 'convex': return executeConvexAction(actionName, inputs, user, logger);

        // Document Signing / PDF (new batch)
        case 'docusign_enhanced': return executeDocusignEnhancedAction(actionName, inputs, user, logger);
        case 'adobe_pdf': return executeAdobePdfAction(actionName, inputs, user, logger);
        case 'adobe-pdf': return executeAdobePdfAction(actionName, inputs, user, logger);
        case 'hellosign': return executeHelloSignAction(actionName, inputs, user, logger);
        case 'hello_sign': return executeHelloSignAction(actionName, inputs, user, logger);
        case 'signrequest': return executeSignRequestAction(actionName, inputs, user, logger);
        case 'sign_request': return executeSignRequestAction(actionName, inputs, user, logger);
        case 'signnow_enhanced': return executeSignNowEnhancedAction(actionName, inputs, user, logger);
        case 'signnow-enhanced': return executeSignNowEnhancedAction(actionName, inputs, user, logger);

        case 'brex': return executeBrexAction(actionName, inputs, user, logger);
        case 'mercury': return executeMercuryAction(actionName, inputs, user, logger);
        case 'ramp': return executeRampAction(actionName, inputs, user, logger);
        case 'plaid_enhanced': return executePlaidEnhancedAction(actionName, inputs, user, logger);
        case 'yodlee': return executeYodleeAction(actionName, inputs, user, logger);

        // Video Hosting Platforms
        case 'wistia': return executeWistiaAction(actionName, inputs, user, logger);
        case 'vidyard': return executeVidyardAction(actionName, inputs, user, logger);
        case 'brightcove': return executeBrightcoveAction(actionName, inputs, user, logger);
        case 'kaltura': return executeKalturaAction(actionName, inputs, user, logger);
        case 'mux': return executeMuxAction(actionName, inputs, user, logger);

        case 'basecamp_enhanced': return executeBasecampEnhancedAction(actionName, inputs, user, logger);
        case 'proofhub': return executeProofHubAction(actionName, inputs, user, logger);
        case 'proof_hub': return executeProofHubAction(actionName, inputs, user, logger);
        case 'nifty': return executeNiftyAction(actionName, inputs, user, logger);
        case 'teamgantt': return executeTeamGanttAction(actionName, inputs, user, logger);
        case 'team_gantt': return executeTeamGanttAction(actionName, inputs, user, logger);

        // Headless E-commerce Platforms
        case 'vendure': return executeVendureAction(actionName, inputs, user, logger);
        case 'medusa': return executeMedusaAction(actionName, inputs, user, logger);
        case 'saleor': return executeSaleorAction(actionName, inputs, user, logger);

        // Video & Social Media Enhanced (new batch)
        case 'vimeo_enhanced': return executeVimeoEnhancedAction(actionName, inputs, user, logger);
        case 'dailymotion': return executeDailymotionAction(actionName, inputs, user, logger);
        case 'youtube_enhanced': return executeYouTubeEnhancedAction(actionName, inputs, user, logger);
        case 'facebook_pages': return executeFacebookPagesAction(actionName, inputs, user, logger);
        case 'facebook-pages': return executeFacebookPagesAction(actionName, inputs, user, logger);
        case 'instagram_enhanced': return executeInstagramEnhancedAction(actionName, inputs, user, logger);

        case 'mailchimp_enhanced':
        case 'mailchimp-enhanced': return executeMailchimpEnhancedAction(actionName, inputs, user, logger);
        case 'campaign-monitor': return executeCampaignMonitorNewAction(actionName, inputs, user, logger);
        case 'emma': return executeEmmaAction(actionName, inputs, user, logger);
        case 'mailjet_enhanced': return executeMailjetEnhancedAction(actionName, inputs, user, logger);

        // Media / Stock Content
        case 'pexels': return executePexelsAction(actionName, inputs, user, logger);
        case 'pixabay': return executePixabayAction(actionName, inputs, user, logger);
        case 'giphy': return executeGiphyAction(actionName, inputs, user, logger);
        case 'unsplash_enhanced': return executeUnsplashEnhancedAction(actionName, inputs, user, logger);
        case 'cloudinary_video': return executeCloudinaryVideoAction(actionName, inputs, user, logger);
        case 'cloudinary-video': return executeCloudinaryVideoAction(actionName, inputs, user, logger);

        case 'appointy': return executeAppointyAction(actionName, inputs, user, logger);
        case 'vcita': return executeVcitaAction(actionName, inputs, user, logger);
        case 'setmore': return executeSetmoreAction(actionName, inputs, user, logger);
        case 'bookafy': return executeBookafyAction(actionName, inputs, user, logger);

        // DevOps / Container Platforms
        case 'kubernetes': return executeKubernetesAction(actionName, inputs, user, logger);
        case 'k8s': return executeKubernetesAction(actionName, inputs, user, logger);
        case 'docker_hub': return executeDockerHubAction(actionName, inputs, user, logger);
        case 'docker-hub': return executeDockerHubAction(actionName, inputs, user, logger);
        case 'harbor': return executeHarborAction(actionName, inputs, user, logger);
        case 'fly_io': return executeFlyIoAction(actionName, inputs, user, logger);
        case 'fly-io': return executeFlyIoAction(actionName, inputs, user, logger);
        case 'digitalocean_enhanced': return executeDigitalOceanEnhancedAction(actionName, inputs, user, logger);

        case 'stripe_connect': return executeStripeConnectAction(actionName, inputs, user, logger);
        case 'stripe-connect': return executeStripeConnectAction(actionName, inputs, user, logger);
        case 'adyen_enhanced': return executeAdyenEnhancedAction(actionName, inputs, user, logger);
        case 'mollie': return executeMollieAction(actionName, inputs, user, logger);
        case 'paystack': return executePaystackAction(actionName, inputs, user, logger);
        case 'flutterwave': return executeFlutterwaveAction(actionName, inputs, user, logger);
        case 'flutter_wave': return executeFlutterwaveAction(actionName, inputs, user, logger);

        // BI / Analytics / Data Engineering
        case 'redash': return executeRedashAction(actionName, inputs, user, logger);
        case 'apache_superset': return executeApacheSupersetAction(actionName, inputs, user, logger);
        case 'superset': return executeApacheSupersetAction(actionName, inputs, user, logger);
        case 'dbt_cloud': return executeDbtCloudAction(actionName, inputs, user, logger);
        case 'dbt-cloud': return executeDbtCloudAction(actionName, inputs, user, logger);
        case 'tableau': return executeTableauAction(actionName, inputs, user, logger);

        case 'salesforce_crm': return executeSalesforceCrmAction(actionName, inputs, user, logger);
        case 'salesforce-crm': return executeSalesforceCrmAction(actionName, inputs, user, logger);
        case 'hubspot_crm': return executeHubSpotCrmAction(actionName, inputs, user, logger);
        case 'hubspot-crm': return executeHubSpotCrmAction(actionName, inputs, user, logger);
        case 'copper-crm': return executeCopperCrmAction(actionName, inputs, user, logger);
        case 'close-crm': return executeCloseCrmNewAction(actionName, inputs, user, logger);

        // Auth / Identity Providers (new batch)
        case 'twilio_verify': return executeTwilioVerifyAction(actionName, inputs, user, logger);
        case 'twilio-verify': return executeTwilioVerifyAction(actionName, inputs, user, logger);
        case 'clerk': return executeClerkAction(actionName, inputs, user, logger);
        case 'stytch': return executeStytchAction(actionName, inputs, user, logger);
        case 'nango': return executeNangoAction(actionName, inputs, user, logger);
        case 'frontegg': return executeFronteggAction(actionName, inputs, user, logger);
        case 'front_egg': return executeFronteggAction(actionName, inputs, user, logger);

        case 'google_drive_enhanced': return executeGoogleDriveEnhancedAction(actionName, inputs, user, logger);
        case 'google_sheets_enhanced': return executeGoogleSheetsEnhancedAction(actionName, inputs, user, logger);
        case 'google_calendar_enhanced': return executeGoogleCalendarEnhancedAction(actionName, inputs, user, logger);
        case 'gmail_enhanced': return executeGmailEnhancedAction(actionName, inputs, user, logger);
        case 'google_tasks': return executeGoogleTasksEnhancedAction(actionName, inputs, user, logger);
        case 'google-tasks': return executeGoogleTasksEnhancedAction(actionName, inputs, user, logger);

        // Video Conferencing (new batch)
        case 'zoom_webinar': return executeZoomWebinarAction(actionName, inputs, user, logger);
        case 'zoom-webinar': return executeZoomWebinarAction(actionName, inputs, user, logger);
        case 'bluejeans': return executeBlueJeansAction(actionName, inputs, user, logger);
        case 'blue_jeans': return executeBlueJeansAction(actionName, inputs, user, logger);
        case 'chime': return executeChimeAction(actionName, inputs, user, logger);
        case 'aws_chime': return executeChimeAction(actionName, inputs, user, logger);
        case 'livekit': return executeLiveKitAction(actionName, inputs, user, logger);
        case 'live_kit': return executeLiveKitAction(actionName, inputs, user, logger);
        case 'whereby_enhanced': return executeWherebyAction(actionName, inputs, user, logger);

        case 'sendgrid_enhanced': return executeSendGridEnhancedAction(actionName, inputs, user, logger);
        case 'postmark_enhanced': return executePostmarkEnhancedAction(actionName, inputs, user, logger);
        case 'sparkpost': return executeSparkPostAction(actionName, inputs, user, logger);
        case 'spark_post': return executeSparkPostAction(actionName, inputs, user, logger);
        case 'resend': return executeResendAction(actionName, inputs, user, logger);
        case 'loops': return executeLoopsAction(actionName, inputs, user, logger);

        case 'upstash_redis': return executeUpstashRedisAction(actionName, interpolatedInputs, user, logger);
        case 'upstash-redis': return executeUpstashRedisAction(actionName, interpolatedInputs, user, logger);
        case 'upstash_kafka': return executeUpstashKafkaAction(actionName, interpolatedInputs, user, logger);
        case 'upstash-kafka': return executeUpstashKafkaAction(actionName, interpolatedInputs, user, logger);
        case 'ably': return executeAblyAction(actionName, interpolatedInputs, user, logger);
        case 'pusher': return executePusherAction(actionName, interpolatedInputs, user, logger);
        case 'soketi': return executeSoketiAction(actionName, interpolatedInputs, user, logger);

        // Social Media / Messaging (new batch)
        case 'slack_enhanced': return executeSlackEnhancedAction(actionName, inputs, user, logger);
        case 'discord_webhook': return executeDiscordWebhookAction(actionName, inputs, user, logger);
        case 'discord-webhook': return executeDiscordWebhookAction(actionName, inputs, user, logger);
        case 'reddit_enhanced': return executeRedditEnhancedAction(actionName, inputs, user, logger);
        case 'mastodon': return executeMastodonAction(actionName, inputs, user, logger);
        case 'bluesky': return executeBlueskyAction(actionName, inputs, user, logger);
        case 'blue_sky': return executeBlueskyAction(actionName, inputs, user, logger);

        // Live Chat / Support Platforms
        case 'crisp': return executeCrispAction(actionName, interpolatedInputs, user, logger);
        case 'tawkto':
        case 'tawk_to': return executeTawkToAction(actionName, interpolatedInputs, user, logger);
        case 'livechat':
        case 'live_chat': return executeLiveChatAction(actionName, interpolatedInputs, user, logger);
        case 'olark': return executeOlarkAction(actionName, interpolatedInputs, user, logger);

        // Vector Databases / AI Observability (new batch)
        case 'pinecone_enhanced': return executePineconeEnhancedAction(actionName, inputs, user, logger);
        case 'chroma': return executeChromaAction(actionName, inputs, user, logger);
        case 'chromadb': return executeChromaAction(actionName, inputs, user, logger);
        case 'milvus': return executeMilvusAction(actionName, inputs, user, logger);
        case 'langchain_api': return executeLangChainApiAction(actionName, inputs, user, logger);
        case 'langsmith': return executeLangChainApiAction(actionName, inputs, user, logger);


        case 'microsoft_mail': return executeMicrosoftMailAction(actionName, inputs, user, logger);
        case 'microsoft-mail': return executeMicrosoftMailAction(actionName, inputs, user, logger);
        case 'microsoft_calendar': return executeMicrosoftCalendarAction(actionName, inputs, user, logger);
        case 'microsoft_sharepoint': return executeMicrosoftSharePointAction(actionName, inputs, user, logger);
        case 'sharepoint': return executeMicrosoftSharePointAction(actionName, inputs, user, logger);
        case 'onedrive': return executeOneDriveAction(actionName, inputs, user, logger);
        case 'one_drive': return executeOneDriveAction(actionName, inputs, user, logger);
        case 'teams_enhanced': return executeTeamsEnhancedAction(actionName, inputs, user, logger);
        case 'microsoft_teams_enhanced': return executeTeamsEnhancedAction(actionName, inputs, user, logger);

        case 'cognito_forms': return executeCognitoFormsAction(actionName, inputs, user, logger);
        case 'cognito-forms': return executeCognitoFormsAction(actionName, inputs, user, logger);
        case 'paperform': return executePaperformAction(actionName, inputs, user, logger);
        case 'wufoo': return executeWufooAction(actionName, inputs, user, logger);
        case 'fillout': return executeFilloutAction(actionName, inputs, user, logger);

        case 'shopify_storefront': return executeShopifyStorefrontAction(actionName, inputs, user, logger);
        case 'shopify-storefront': return executeShopifyStorefrontAction(actionName, inputs, user, logger);
        case 'shoplazza': return executeShoplazzaAction(actionName, inputs, user, logger);
        case 'lightspeed': return executeLightspeedAction(actionName, inputs, user, logger);
        case 'light_speed': return executeLightspeedAction(actionName, inputs, user, logger);
        case 'shift4shop': return executeShift4ShopAction(actionName, inputs, user, logger);
        case 'shift4_shop': return executeShift4ShopAction(actionName, inputs, user, logger);

        case 'netsuite': return executeNetSuiteAction(actionName, inputs, user, logger);
        case 'net_suite': return executeNetSuiteAction(actionName, inputs, user, logger);
        case 'acumatica': return executeAcumaticaAction(actionName, inputs, user, logger);
        case 'odoo': return executeOdooAction(actionName, inputs, user, logger);
        case 'erpnext': return executeErpNextAction(actionName, inputs, user, logger);
        case 'erp_next': return executeErpNextAction(actionName, inputs, user, logger);
        case 'microsoft_dynamics': return executeMicrosoftDynamicsAction(actionName, inputs, user, logger);
        case 'dynamics365_crm': return executeMicrosoftDynamicsAction(actionName, inputs, user, logger);

        // Payment Gateways (new batch)
        case 'square_pos': return executeSquarePosAction(actionName, inputs, user, logger);
        case 'square-pos': return executeSquarePosAction(actionName, inputs, user, logger);
        case 'payu': return executePayUAction(actionName, inputs, user, logger);
        case 'pay_u': return executePayUAction(actionName, inputs, user, logger);
        case 'paytm': return executePaytmAction(actionName, inputs, user, logger);
        case 'midtrans': return executeMidtransAction(actionName, inputs, user, logger);
        case 'xendit': return executeXenditAction(actionName, inputs, user, logger);

        // AWS RDS / ELB / CloudWatch / KMS / SES Enhanced
        case 'aws_rds': return executeAwsRdsAction(actionName, inputs, user, logger);
        case 'aws-rds': return executeAwsRdsAction(actionName, inputs, user, logger);
        case 'aws_elb': return executeAwsElbAction(actionName, inputs, user, logger);
        case 'aws-elb': return executeAwsElbAction(actionName, inputs, user, logger);
        case 'aws_cloudwatch': return executeAwsCloudWatchNewAction(actionName, inputs, user, logger);
        case 'aws-cloudwatch': return executeAwsCloudWatchNewAction(actionName, inputs, user, logger);
        case 'aws_kms': return executeAwsKmsAction(actionName, inputs, user, logger);
        case 'aws-kms': return executeAwsKmsAction(actionName, inputs, user, logger);
        case 'aws_ses_enhanced': return executeAwsSesEnhancedAction(actionName, inputs, user, logger);
        case 'aws-ses-enhanced': return executeAwsSesEnhancedAction(actionName, inputs, user, logger);

        case 'recruitee': return executeRecruiteeAction(actionName, inputs, user, logger);
        case 'jazzhr': return executeJazzHRAction(actionName, inputs, user, logger);
        case 'jazz_hr': return executeJazzHRAction(actionName, inputs, user, logger);
        case 'breezy_hr': return executeBreezyHRAction(actionName, inputs, user, logger);
        case 'breezy-hr': return executeBreezyHRAction(actionName, inputs, user, logger);
        case 'aweber': return executeAWeberAction(actionName, inputs, user, logger);
        case 'greenhouse_enhanced': return executeGreenhouseEnhancedAction(actionName, inputs, user, logger);
        case 'amplitude_enhanced': return executeAmplitudeEnhancedAction(actionName, inputs, user, logger);
        case 'monday_enhanced': return executeMondayEnhancedAction(actionName, inputs, user, logger);
        case 'monday-enhanced': return executeMondayEnhancedAction(actionName, inputs, user, logger);
        case 'box_enhanced': return executeBoxEnhancedAction(actionName, inputs, user, logger);
        case 'box-enhanced': return executeBoxEnhancedAction(actionName, inputs, user, logger);
        case 'dropbox_enhanced': return executeDropboxEnhancedAction(actionName, inputs, user, logger);

        // CI/CD / GitOps Platforms
        case 'drone_ci': return executeDroneCiAction(actionName, inputs, user, logger);
        case 'drone-ci': return executeDroneCiAction(actionName, inputs, user, logger);
        case 'woodpecker_ci': return executeWoodpeckerCiAction(actionName, inputs, user, logger);
        case 'woodpecker-ci': return executeWoodpeckerCiAction(actionName, inputs, user, logger);
        case 'harness': return executeHarnessAction(actionName, inputs, user, logger);
        case 'argocd': return executeArgoCdAction(actionName, inputs, user, logger);
        case 'argo_cd': return executeArgoCdAction(actionName, inputs, user, logger);
        case 'spacelift': return executeSpaceLiftAction(actionName, inputs, user, logger);
        case 'space_lift': return executeSpaceLiftAction(actionName, inputs, user, logger);
        case 'zendesk_enhanced_v2': return executeZendeskEnhancedAction(actionName, inputs, user, logger);
        case 'zendesk-enhanced': return executeZendeskEnhancedAction(actionName, inputs, user, logger);

        case 'anthropic_enhanced': return executeAnthropicEnhancedAction(actionName, inputs, user, logger);
        case 'anthropic-enhanced': return executeAnthropicEnhancedAction(actionName, inputs, user, logger);
        case 'stability_ai_enhanced': return executeStabilityAIEnhancedAction(actionName, inputs, user, logger);
        case 'runwayml_enhanced': return executeRunwayMLAction(actionName, inputs, user, logger);
        case 'runway_ml_enhanced': return executeRunwayMLAction(actionName, inputs, user, logger);
        case 'elevenlabs_enhanced': return executeElevenLabsEnhancedAction(actionName, inputs, user, logger);
        case 'aws_iot': return executeAWSIoTAction(actionName, inputs, user, logger);

        case 'pinterest_analytics': return executePinterestAnalyticsAction(actionName, inputs, user, logger);
        case 'freshbooks_enhanced': return executeFreshBooksEnhancedAction(actionName, inputs, user, logger);
        case 'firebase_enhanced': return executeFirebaseEnhancedAction(actionName, inputs, user, logger);
        case 'firebase-enhanced': return executeFirebaseEnhancedAction(actionName, inputs, user, logger);
        case 'elasticsearch_enhanced': return executeElasticsearchEnhancedAction(actionName, inputs, user, logger);
        case 'meilisearch_enhanced': return executeMeiliSearchEnhancedAction(actionName, inputs, user, logger);

        case 'toggl_enhanced': return executeTogglEnhancedAction(actionName, inputs, user, logger);
        case 'toggl-enhanced': return executeTogglEnhancedAction(actionName, inputs, user, logger);
        case 'clockify_enhanced': return executeClockifyEnhancedAction(actionName, inputs, user, logger);
        case 'vercel_api': return executeVercelApiAction(actionName, inputs, user, logger);
        case 'vercel-api': return executeVercelApiAction(actionName, inputs, user, logger);
        case 'sentry-enhanced': return executeSentryEnhancedNewAction(actionName, inputs, user, logger);

        case 'azure_iot': return executeAzureIoTAction(actionName, inputs, user, logger);
        case 'azure-iot': return executeAzureIoTAction(actionName, inputs, user, logger);
        case 'twilio_video': return executeTwilioVideoAction(actionName, inputs, user, logger);
        case 'twilio-video': return executeTwilioVideoAction(actionName, inputs, user, logger);
        case 'linkedin_analytics': return executeLinkedInAnalyticsAction(actionName, inputs, user, logger);
        case 'tiktok_analytics': return executeTikTokAnalyticsAction(actionName, inputs, user, logger);
        case 'snapchat_marketing': return executeSnapchatMarketingAction(actionName, inputs, user, logger);

        case 'telegram_enhanced': return executeTelegramEnhancedAction(actionName, inputs, user, logger);
        case 'telegram-enhanced': return executeTelegramEnhancedAction(actionName, inputs, user, logger);
        case 'whatsapp_business': return executeWhatsAppBusinessAction(actionName, inputs, user, logger);
        case 'whatsapp-business': return executeWhatsAppBusinessAction(actionName, inputs, user, logger);
        case 'viber': return executeViberAction(actionName, inputs, user, logger);
        case 'line_messaging': return executeLineMessagingAction(actionName, inputs, user, logger);
        case 'wechat': return executeWeChatAction(actionName, inputs, user, logger);
        case 'we_chat': return executeWeChatAction(actionName, inputs, user, logger);

        case 'squadcast': return executeSquadcastAction(actionName, inputs, user, logger);
        case 'splunk': return executeSplunkAction(actionName, inputs, user, logger);
        case 'elastic_apm': return executeElasticAPMAction(actionName, inputs, user, logger);
        case 'betterstack': return executeBetterStackAction(actionName, inputs, user, logger);
        case 'better_stack': return executeBetterStackAction(actionName, inputs, user, logger);
        case 'statuspage': return executeStatusPageAction(actionName, inputs, user, logger);
        case 'status_page': return executeStatusPageAction(actionName, inputs, user, logger);

        case 'mode_analytics': return executeModeAnalyticsAction(actionName, inputs, user, logger);
        case 'sisense': return executeSisenseAction(actionName, inputs, user, logger);
        case 'domo': return executeDomoAction(actionName, inputs, user, logger);
        case 'qlik_sense': return executeQlikSenseAction(actionName, inputs, user, logger);
        case 'qlik-sense': return executeQlikSenseAction(actionName, inputs, user, logger);
        case 'looker_enhanced': return executeLookerEnhancedAction(actionName, inputs, user, logger);

        case 'chargebee_enhanced': return executeChargebeeEnhancedAction(actionName, inputs, user, logger);
        case 'paddle_enhanced': return executePaddleEnhancedAction(actionName, inputs, user, logger);
        case 'recurly': return executeRecurlyAction(actionName, inputs, user, logger);
        case 'chargify': return executeChargifyAction(actionName, inputs, user, logger);
        case 'lago': return executeLagoAction(actionName, inputs, user, logger);

        case 'bigquery_enhanced': return executeBigQueryEnhancedAction(actionName, inputs, user, logger);
        case 'bigquery-enhanced': return executeBigQueryEnhancedAction(actionName, inputs, user, logger);
        case 'snowflake_enhanced': return executeSnowflakeEnhancedAction(actionName, inputs, user, logger);
        case 'snowflake-enhanced': return executeSnowflakeEnhancedAction(actionName, inputs, user, logger);
        case 'clickhouse': return executeClickHouseAction(actionName, inputs, user, logger);
        case 'click_house': return executeClickHouseAction(actionName, inputs, user, logger);
        case 'singlestore': return executeSingleStoreAction(actionName, inputs, user, logger);
        case 'single_store': return executeSingleStoreAction(actionName, inputs, user, logger);
        case 'databricks_enhanced': return executeDatabricksEnhancedAction(actionName, inputs, user, logger);
        case 'databricks-enhanced': return executeDatabricksEnhancedAction(actionName, inputs, user, logger);
        case 'redshift_api': return executeRedshiftAPIAction(actionName, inputs, user, logger);
        case 'redshift-api': return executeRedshiftAPIAction(actionName, inputs, user, logger);

        case 'bamboohr_enhanced': return executeBamboohrEnhancedAction(actionName, inputs, user, logger);
        case 'workday': return executeWorkdayAction(actionName, inputs, user, logger);
        case 'adp_api': return executeADPApiAction(actionName, inputs, user, logger);
        case 'adp-api': return executeADPApiAction(actionName, inputs, user, logger);
        case 'rippling': return executeRipplingAction(actionName, inputs, user, logger);
        case 'gusto_enhanced': return executeGustoEnhancedAction(actionName, inputs, user, logger);

        case 'braintree_enhanced': return executeBraintreeEnhancedAction(actionName, inputs, user, logger);
        case 'authorize_net': return executeAuthorizeNetAction(actionName, inputs, user, logger);
        case 'authorize-net': return executeAuthorizeNetAction(actionName, inputs, user, logger);
        case 'worldpay': return executeWorldpayAction(actionName, inputs, user, logger);

        case 'datadog_enhanced': return executeDatadogEnhancedAction(actionName, inputs, user, logger);
        case 'new_relic_enhanced': return executeNewRelicEnhancedAction(actionName, inputs, user, logger);

        // CMS Enhanced (new batch)
        case 'contentful_enhanced': return executeContentfulEnhancedAction(actionName, inputs, user, logger);
        case 'contentful-enhanced': return executeContentfulEnhancedAction(actionName, inputs, user, logger);
        case 'datocms': return executeDatoCMSAction(actionName, inputs, user, logger);
        case 'dato_cms': return executeDatoCMSAction(actionName, inputs, user, logger);
        case 'payload_cms_v2': return executePayloadCMSAction(actionName, inputs, user, logger);

        case 'sendpulse': return executeSendPulseAction(actionName, inputs, user, logger);
        case 'send_pulse': return executeSendPulseAction(actionName, inputs, user, logger);
        case 'customerio_enhanced': return executeCustomerioEnhancedAction(actionName, inputs, user, logger);
        case 'klaviyo_v2': return executeKlaviyoV2Action(actionName, inputs, user, logger);
        case 'klaviyo-v2': return executeKlaviyoV2Action(actionName, inputs, user, logger);
        case 'drip_enhanced': return executeDripEnhancedAction(actionName, inputs, user, logger);
        case 'activecampaign_enhanced': return executeActivecampaignEnhancedAction(actionName, inputs, user, logger);

        case 'onelogin': return executeOneLoginAction(actionName, inputs, user, logger);
        case 'one_login': return executeOneLoginAction(actionName, inputs, user, logger);
        case 'ping_identity': return executePingIdentityAction(actionName, inputs, user, logger);
        case 'azure_ad': return executeAzureADAction(actionName, inputs, user, logger);
        case 'azure-ad': return executeAzureADAction(actionName, inputs, user, logger);
        case 'auth0_management': return executeAuth0ManagementAction(actionName, inputs, user, logger);
        case 'fusionauth': return executeFusionAuthAction(actionName, inputs, user, logger);
        case 'fusion_auth': return executeFusionAuthAction(actionName, inputs, user, logger);

        case 'agile_crm': return executeAgileCrmAction(actionName, inputs, user, logger);
        case 'agile-crm': return executeAgileCrmAction(actionName, inputs, user, logger);
        case 'less_annoying_crm': return executeLessAnnoyingCRMAction(actionName, inputs, user, logger);
        case 'zendesk_sell': return executeZendeskSellAction(actionName, inputs, user, logger);
        case 'zendesk-sell': return executeZendeskSellAction(actionName, inputs, user, logger);
        case 'streak_crm': return executeStreakCRMAction(actionName, inputs, user, logger);

        // Media / Image / File Processing
        case 'filestack': return executeFilestackAction(actionName, inputs, user, logger);
        case 'imgix': return executeImgixAction(actionName, inputs, user, logger);
        case 'transloadit': return executeTransloaditAction(actionName, inputs, user, logger);
        case 'mapbox_enhanced': return executeMapboxEnhancedAction(actionName, inputs, user, logger);
        case 'here_maps': return executeHereMapsAction(actionName, inputs, user, logger);
        case 'here-maps': return executeHereMapsAction(actionName, inputs, user, logger);

        case 'magnolia_cms': return executeMagnoliaCMSAction(actionName, inputs, user, logger);
        case 'pimcore': return executePimcoreAction(actionName, inputs, user, logger);
        case 'craft_cms': return executeCraftCMSAction(actionName, inputs, user, logger);
        case 'craft-cms': return executeCraftCMSAction(actionName, inputs, user, logger);
        case 'directus_enhanced': return executeDirectusEnhancedAction(actionName, inputs, user, logger);
        case 'umbraco': return executeUmbracoAction(actionName, inputs, user, logger);

        case 'questdb': return executeQuestDBAction(actionName, inputs, user, logger);
        case 'quest_db': return executeQuestDBAction(actionName, inputs, user, logger);
        case 'fauna': return executeFaunaAction(actionName, inputs, user, logger);
        case 'tidb_cloud': return executeTiDBCloudAction(actionName, inputs, user, logger);
        case 'neon_db': return executeNeonDBAction(actionName, inputs, user, logger);
        case 'neon-db': return executeNeonDBAction(actionName, inputs, user, logger);

        case 'framer': return executeFramerAction(actionName, inputs, user, logger);
        case 'loom_enhanced': return executeLoomEnhancedAction(actionName, inputs, user, logger);
        case 'invision': return executeInVisionAction(actionName, inputs, user, logger);
        case 'mural': return executeMuralAction(actionName, inputs, user, logger);
        case 'whimsical': return executeWhimsicalAction(actionName, inputs, user, logger);

        case 'expensify_enhanced': return executeExpensifyEnhancedAction(actionName, inputs, user, logger);
        case 'expensify-enhanced': return executeExpensifyEnhancedAction(actionName, inputs, user, logger);
        case 'coupa': return executeCoupaAction(actionName, inputs, user, logger);
        case 'sap_concur': return executeSAPConcurAction(actionName, inputs, user, logger);
        case 'sap-concur': return executeSAPConcurAction(actionName, inputs, user, logger);

        case 'heygen': return executeHeyGenAction(actionName, inputs, user, logger);
        case 'hey_gen': return executeHeyGenAction(actionName, inputs, user, logger);
        case 'd_id': return executeDIDAction(actionName, inputs, user, logger);
        case 'd-id': return executeDIDAction(actionName, inputs, user, logger);
        case 'synthesia': return executeSynthesiaAction(actionName, inputs, user, logger);
        case 'tavus': return executeTavusAction(actionName, inputs, user, logger);
        case 'descript': return executeDescriptAction(actionName, inputs, user, logger);

        case 'perplexity': return executePerplexityAction(actionName, inputs, user, logger);
        case 'cohere_enhanced': return executeCohereEnhancedAction(actionName, inputs, user, logger);
        case 'cohere-enhanced': return executeCohereEnhancedAction(actionName, inputs, user, logger);
        case 'deepgram': return executeDeepgramAction(actionName, inputs, user, logger);
        case 'assemblyai_enhanced': return executeAssemblyAIEnhancedAction(actionName, inputs, user, logger);
        case 'assemblyai-enhanced': return executeAssemblyAIEnhancedAction(actionName, inputs, user, logger);
        case 'snovio': return executeSnovioAction(actionName, inputs, user, logger);
        case 'snov_io': return executeSnovioAction(actionName, inputs, user, logger);

        case 'smartlead': return executeSmartleadAction(actionName, inputs, user, logger);
        case 'instantly': return executeInstantlyAction(actionName, inputs, user, logger);
        case 'woodpecker_email': return executeWoodpeckerEmailAction(actionName, inputs, user, logger);
        case 'woodpecker-email': return executeWoodpeckerEmailAction(actionName, inputs, user, logger);
        case 'reply_io': return executeReplyIOAction(actionName, inputs, user, logger);
        case 'reply-io': return executeReplyIOAction(actionName, inputs, user, logger);
        case 'lemlist_enhanced': return executeLemlistEnhancedAction(actionName, inputs, user, logger);

        // CDN / Edge / Hosting Platforms (new batch)
        case 'cloudflare_api': return executeCloudflareApiAction(actionName, inputs, user, logger);
        case 'cloudflare-api': return executeCloudflareApiAction(actionName, inputs, user, logger);
        case 'cloudflare_enhanced': return executeCloudflareEnhancedAction(actionName, inputs, user, logger);
        case 'cloudflare-enhanced': return executeCloudflareEnhancedAction(actionName, inputs, user, logger);
        case 'netlify_enhanced': return executeNetlifyEnhancedAction(actionName, inputs, user, logger);
        case 'netlify-enhanced': return executeNetlifyEnhancedAction(actionName, inputs, user, logger);
        case 'bunnycdn': return executeBunnyCDNAction(actionName, inputs, user, logger);
        case 'bunny_cdn': return executeBunnyCDNAction(actionName, inputs, user, logger);
        case 'akamai': return executeAkamaiAction(actionName, inputs, user, logger);
        case 'render_enhanced': return executeRenderEnhancedAction(actionName, inputs, user, logger);
        case 'railway_enhanced': return executeRailwayEnhancedAction(actionName, inputs, user, logger);
        case 'railway-enhanced': return executeRailwayEnhancedAction(actionName, inputs, user, logger);

        case 'n8n_api': return executeN8NApiAction(actionName, inputs, user, logger);
        case 'n8n-api': return executeN8NApiAction(actionName, inputs, user, logger);
        case 'pipedream': return executePipedreamAction(actionName, inputs, user, logger);
        case 'flowdash': return executeFlowdashAction(actionName, inputs, user, logger);
        case 'activepieces': return executeActivePiecesAction(actionName, inputs, user, logger);
        case 'active_pieces': return executeActivePiecesAction(actionName, inputs, user, logger);
        case 'pabbly_connect': return executePabblyConnectAction(actionName, inputs, user, logger);

        case 'mistral_enhanced': return executeMistralEnhancedAction(actionName, inputs, user, logger);
        case 'replicate_enhanced': return executeReplicateEnhancedAction(actionName, inputs, user, logger);
        case 'zoominfo': return executeZoomInfoAction(actionName, inputs, user, logger);
        case 'zoom_info': return executeZoomInfoAction(actionName, inputs, user, logger);
        case 'apollo_enhanced': return executeApolloEnhancedAction(actionName, inputs, user, logger);
        case 'hunter_enhanced': return executeHunterEnhancedAction(actionName, inputs, user, logger);

        case 'attio': return executeAttioAction(actionName, inputs, user, logger);
        case 'folk_crm': return executeFolkCRMAction(actionName, inputs, user, logger);
        case 'folk-crm': return executeFolkCRMAction(actionName, inputs, user, logger);
        case 'twenty_crm': return executeTwentyCRMAction(actionName, inputs, user, logger);
        case 'twenty-crm': return executeTwentyCRMAction(actionName, inputs, user, logger);
        case 'affinity_crm': return executeAffinityCRMAction(actionName, inputs, user, logger);
        case 'clay': return executeClayAction(actionName, inputs, user, logger);

        case 'notion_ai': return executeNotionAIAction(actionName, inputs, user, logger);
        case 'coda_enhanced': return executeCodaEnhancedAction(actionName, inputs, user, logger);
        case 'anytype': return executeAnytypeAction(actionName, inputs, user, logger);
        case 'capacitor_calendar': return executeCapacitorCalendarAction(actionName, inputs, user, logger);
        case 'obsidian_sync': return executeObsidianSyncAction(actionName, inputs, user, logger);
        case 'obsidian-sync': return executeObsidianSyncAction(actionName, inputs, user, logger);

        case 'finicity': return executeFinicityAction(actionName, inputs, user, logger);
        case 'mx_technologies': return executeMXTechnologiesAction(actionName, inputs, user, logger);
        case 'mono_africa': return executeMonoAfricaAction(actionName, inputs, user, logger);
        case 'stitch_finance': return executeStitchFinanceAction(actionName, inputs, user, logger);

        case 'prefect_enhanced': return executePrefectEnhancedAction(actionName, inputs, user, logger);
        case 'prefect-enhanced': return executePrefectEnhancedAction(actionName, inputs, user, logger);
        case 'airflow_enhanced': return executeAirflowEnhancedAction(actionName, inputs, user, logger);
        case 'airflow-enhanced': return executeAirflowEnhancedAction(actionName, inputs, user, logger);
        case 'conductor': return executeConductorAction(actionName, inputs, user, logger);
        case 'dagster': return executeDagsterAction(actionName, inputs, user, logger);
        case 'mage_ai': return executeMageAIAction(actionName, inputs, user, logger);
        case 'mage-ai': return executeMageAIAction(actionName, inputs, user, logger);

        // WhatsApp Gateway Providers
        case 'fonnte': return executeFonnteAction(actionName, inputs, user, logger);
        case 'wablas': return executeWablasAction(actionName, inputs, user, logger);
        case 'ultramsg': return executeUltraMsgAction(actionName, inputs, user, logger);
        case 'ultra_msg': return executeUltraMsgAction(actionName, inputs, user, logger);
        case 'chat_api': return executeChatAPIAction(actionName, inputs, user, logger);
        case 'chat-api': return executeChatAPIAction(actionName, inputs, user, logger);
        case 'wa_gateway': return executeWAGatewayAction(actionName, inputs, user, logger);

        case 'docuseal': return executeDocusealAction(actionName, inputs, user, logger);
        case 'documenso': return executeDocumensoAction(actionName, inputs, user, logger);
        case 'getaccept': return executeGetAcceptAction(actionName, inputs, user, logger);
        case 'get_accept': return executeGetAcceptAction(actionName, inputs, user, logger);
        case 'contractbook': return executeContractbookAction(actionName, inputs, user, logger);

        case 'google_ads_enhanced': return executeGoogleAdsEnhancedAction(actionName, inputs, user, logger);
        case 'microsoft_ads': return executeMicrosoftAdsAction(actionName, inputs, user, logger);
        case 'twitter_ads_enhanced': return executeTwitterAdsEnhancedAction(actionName, inputs, user, logger);
        case 'criteo': return executeCriteoAction(actionName, inputs, user, logger);
        case 'trade_desk': return executeTradeDeskAction(actionName, inputs, user, logger);
        case 'trade-desk': return executeTradeDeskAction(actionName, inputs, user, logger);

        case 'deel': return executeDeelAction(actionName, inputs, user, logger);
        case 'remote_com': return executeRemoteComAction(actionName, inputs, user, logger);
        case 'remote-com': return executeRemoteComAction(actionName, inputs, user, logger);
        case 'oyster_hr': return executeOysterHRAction(actionName, inputs, user, logger);
        case 'jumpcloud': return executeJumpCloudAction(actionName, inputs, user, logger);
        case 'jump_cloud': return executeJumpCloudAction(actionName, inputs, user, logger);
        case 'upwork': return executeUpworkAction(actionName, inputs, user, logger);

        case 'woocommerce_api': return executeWooCommerceApiAction(actionName, inputs, user, logger);
        case 'prestashop-enhanced': return executePrestaShopEnhancedAction(actionName, inputs, user, logger);
        case 'cs-cart': return executeCsCartAction(actionName, inputs, user, logger);
        case 'opencart_api': return executeOpenCartApiAction(actionName, inputs, user, logger);
        case 'nopcommerce': return executeNopCommerceAction(actionName, inputs, user, logger);
        case 'nop_commerce': return executeNopCommerceAction(actionName, inputs, user, logger);

        case 'taxjar': return executeTaxJarAction(actionName, inputs, user, logger);
        case 'tax_jar': return executeTaxJarAction(actionName, inputs, user, logger);
        case 'avalara': return executeAvalaraAction(actionName, inputs, user, logger);
        case 'vertex_tax': return executeVertexTaxAction(actionName, inputs, user, logger);
        case 'taxcloud': return executeTaxCloudAction(actionName, inputs, user, logger);
        case 'tax_cloud': return executeTaxCloudAction(actionName, inputs, user, logger);
        case 'quaderno': return executeQuadernoAction(actionName, inputs, user, logger);

        case 'common_room': return executeCommonRoomAction(actionName, inputs, user, logger);
        case 'common-room': return executeCommonRoomAction(actionName, inputs, user, logger);
        case 'bevy': return executeBevyAction(actionName, inputs, user, logger);
        case 'circle_community': return executeCircleCommunityAction(actionName, inputs, user, logger);
        case 'hivebrite': return executeHivebriteAction(actionName, inputs, user, logger);

        case 'magento_enhanced': return executeMagentoEnhancedAction(actionName, inputs, user, logger);
        case 'magento-enhanced': return executeMagentoEnhancedAction(actionName, inputs, user, logger);
        case 'vendasta': return executeVendastaAction(actionName, inputs, user, logger);
        case 'medusa_enhanced': return executeMedusaEnhancedAction(actionName, inputs, user, logger);
        case 'medusa-enhanced': return executeMedusaEnhancedAction(actionName, inputs, user, logger);
        case 'saleor_enhanced': return executeSaleorEnhancedAction(actionName, inputs, user, logger);
        case 'saleor-enhanced': return executeSaleorEnhancedAction(actionName, inputs, user, logger);

        // Analytics Platforms Enhanced
        case 'segment-enhanced': return executeSegmentEnhancedAction(actionName, inputs, user, logger);
        case 'posthog_v2': return executePostHogV2Action(actionName, inputs, user, logger);
        case 'posthog-v2': return executePostHogV2Action(actionName, inputs, user, logger);
        case 'mixpanel-enhanced': return executeMixpanelEnhancedAction(actionName, inputs, user, logger);
        case 'amplitude-enhanced': return executeAmplitudeEnhancedAction(actionName, inputs, user, logger);
        case 'heap-analytics': return executeHeapAnalyticsAction(actionName, inputs, user, logger);

        case 'intercom_v3': return executeIntercomV3Action(actionName, inputs, user, logger);
        case 'intercom-v3': return executeIntercomV3Action(actionName, inputs, user, logger);
        case 'front': return executeFrontAction(actionName, inputs, user, logger);
        case 'dixa': return executeDixaAction(actionName, inputs, user, logger);

        case 'aws_glue': return executeAwsGlueAction(actionName, inputs, user, logger);
        case 'aws-glue': return executeAwsGlueAction(actionName, inputs, user, logger);
        case 'azure_data_factory': return executeAzureDataFactoryAction(actionName, inputs, user, logger);
        case 'azure-data-factory': return executeAzureDataFactoryAction(actionName, inputs, user, logger);
        case 'google_cloud_dataflow': return executeGoogleCloudDataflowAction(actionName, inputs, user, logger);
        case 'google-cloud-dataflow': return executeGoogleCloudDataflowAction(actionName, inputs, user, logger);
        case 'fivetran_enhanced': return executeFivetranEnhancedAction(actionName, inputs, user, logger);
        case 'fivetran-enhanced': return executeFivetranEnhancedAction(actionName, inputs, user, logger);
        case 'stitch_data': return executeStitchDataAction(actionName, inputs, user, logger);
        case 'stitch-data': return executeStitchDataAction(actionName, inputs, user, logger);

        case 'wrike_enhanced': return executeWrikeEnhancedAction(actionName, inputs, user, logger);
        case 'wrike-enhanced': return executeWrikeEnhancedAction(actionName, inputs, user, logger);

        case 'salesforce-enhanced': return executeSalesforceEnhancedAction(actionName, inputs, user, logger);
        case 'hubspot_enhanced': return executeHubSpotEnhancedAction(actionName, inputs, user, logger);
        case 'hubspot-enhanced': return executeHubSpotEnhancedAction(actionName, inputs, user, logger);
        case 'pipedrive-enhanced': return executePipedriveEnhancedAction(actionName, inputs, user, logger);
        case 'zoho-crm-enhanced': return executeZohoCRMEnhancedAction(actionName, inputs, user, logger);

        case 'lark_feishu': return executeLarkFeishuAction(actionName, inputs, user, logger);
        case 'lark-feishu': return executeLarkFeishuAction(actionName, inputs, user, logger);
        case 'flock': return executeFlockAction(actionName, inputs, user, logger);
        case 'pumble': return executePumbleAction(actionName, inputs, user, logger);
        case 'chanty': return executeChantyAction(actionName, inputs, user, logger);
        case 'rocket_chat': return executeRocketChatAction(actionName, inputs, user, logger);
        case 'rocket-chat': return executeRocketChatAction(actionName, inputs, user, logger);

        // Communications Platforms Enhanced (new)
        case 'twilio-enhanced': return executeTwilioEnhancedActionNew(actionName, inputs, user, logger);
        case 'vonage-enhanced': return executeVonageEnhancedAction(actionName, inputs, user, logger);
        case 'plivo-enhanced': return executePlivoEnhancedAction(actionName, inputs, user, logger);
        case 'messagebird-enhanced': return executeMessageBirdEnhancedAction(actionName, inputs, user, logger);

        // Payment Processing Enhanced
        case 'stripe_enhanced': return executeStripeEnhancedAction(actionName, inputs, user, logger);
        case 'stripe-enhanced': return executeStripeEnhancedAction(actionName, inputs, user, logger);
        case 'square-enhanced': return executeSquareEnhancedAction(actionName, inputs, user, logger);
        case 'paypal-enhanced': return executePaypalEnhancedAction(actionName, inputs, user, logger);
        case 'adyen-enhanced': return executeAdyenEnhancedAction(actionName, inputs, user, logger);

        case 'shopify_enhanced': return executeShopifyEnhancedAction(actionName, inputs, user, logger);
        case 'shopify-enhanced': return executeShopifyEnhancedAction(actionName, inputs, user, logger);
        case 'woocommerce_v3': return executeWooCommerceV3Action(actionName, inputs, user, logger);
        case 'woocommerce-v3': return executeWooCommerceV3Action(actionName, inputs, user, logger);
        case 'bigcommerce_enhanced': return executeBigCommerceEnhancedAction(actionName, inputs, user, logger);
        case 'bigcommerce-enhanced': return executeBigCommerceEnhancedAction(actionName, inputs, user, logger);
        case 'squarespace_commerce': return executeSquarespaceCommerceAction(actionName, inputs, user, logger);
        case 'squarespace-commerce': return executeSquarespaceCommerceAction(actionName, inputs, user, logger);
        case 'ecwid_enhanced': return executeEcwidEnhancedAction(actionName, inputs, user, logger);
        case 'ecwid-enhanced': return executeEcwidEnhancedAction(actionName, inputs, user, logger);

        // Google Workspace Enhanced
        case 'google_calendar_enhanced': return executeGoogleCalendarEnhancedAction(actionName, inputs, user, logger);
        case 'google-calendar-enhanced': return executeGoogleCalendarEnhancedAction(actionName, inputs, user, logger);
        case 'google_drive_enhanced': return executeGoogleDriveEnhancedAction(actionName, inputs, user, logger);
        case 'google-drive-enhanced': return executeGoogleDriveEnhancedAction(actionName, inputs, user, logger);
        case 'google_sheets_enhanced': return executeGoogleSheetsEnhancedAction(actionName, inputs, user, logger);
        case 'google-sheets-enhanced': return executeGoogleSheetsEnhancedAction(actionName, inputs, user, logger);
        case 'google_gmail_enhanced': return executeGoogleGmailEnhancedAction(actionName, inputs, user, logger);
        case 'google-gmail-enhanced': return executeGoogleGmailEnhancedAction(actionName, inputs, user, logger);
        case 'google_meet': return executeGoogleMeetAction(actionName, inputs, user, logger);
        case 'google-meet': return executeGoogleMeetAction(actionName, inputs, user, logger);

        case 'aws_lambda_enhanced': return executeAWSLambdaEnhancedAction(actionName, inputs, user, logger);
        case 'aws-lambda-enhanced': return executeAWSLambdaEnhancedAction(actionName, inputs, user, logger);
        case 'aws_s3_enhanced': return executeAWSS3EnhancedAction(actionName, inputs, user, logger);
        case 'aws-s3-enhanced': return executeAWSS3EnhancedAction(actionName, inputs, user, logger);
        case 'aws_sns_enhanced': return executeAWSSNSEnhancedAction(actionName, inputs, user, logger);
        case 'aws-sns-enhanced': return executeAWSSNSEnhancedAction(actionName, inputs, user, logger);
        case 'aws_sqs_enhanced': return executeAWSSQSEnhancedAction(actionName, inputs, user, logger);
        case 'aws-sqs-enhanced': return executeAWSSQSEnhancedAction(actionName, inputs, user, logger);

        case 'microsoft_teams_enhanced': return executeMicrosoftTeamsEnhancedAction(actionName, inputs, user, logger);
        case 'microsoft-teams-enhanced': return executeMicrosoftTeamsEnhancedAction(actionName, inputs, user, logger);
        case 'outlook_enhanced': return executeOutlookEnhancedAction(actionName, inputs, user, logger);
        case 'outlook-enhanced': return executeOutlookEnhancedAction(actionName, inputs, user, logger);
        case 'sharepoint_enhanced': return executeSharePointEnhancedAction(actionName, inputs, user, logger);
        case 'sharepoint-enhanced': return executeSharePointEnhancedAction(actionName, inputs, user, logger);
        case 'onedrive_enhanced': return executeOneDriveEnhancedAction(actionName, inputs, user, logger);
        case 'onedrive-enhanced': return executeOneDriveEnhancedAction(actionName, inputs, user, logger);
        case 'azure_active_directory': return executeAzureActiveDirectoryAction(actionName, inputs, user, logger);
        case 'azure-active-directory': return executeAzureActiveDirectoryAction(actionName, inputs, user, logger);

        case 'together-ai': return executeTogetherAiActionNew(actionName, inputs, user, logger);
        case 'groq': return executeGroqAction(actionName, inputs, user, logger);

        // Video & Webinar Platforms Enhanced
        case 'zoom_enhanced': return executeZoomEnhancedAction(actionName, inputs, user, logger);
        case 'zoom-enhanced': return executeZoomEnhancedAction(actionName, inputs, user, logger);
        case 'webex_enhanced': return executeWebexEnhancedAction(actionName, inputs, user, logger);
        case 'webex-enhanced': return executeWebexEnhancedAction(actionName, inputs, user, logger);
        case 'gotowebinar': return executeGotowebinarAction(actionName, inputs, user, logger);
        case 'goto_webinar': return executeGotowebinarAction(actionName, inputs, user, logger);
        case 'livestorm': return executeLivestormAction(actionName, inputs, user, logger);
        case 'demio': return executeDemioAction(actionName, inputs, user, logger);

        // Help Desk & Ticketing Systems
        case 'kayako': return executeKayakoAction(actionName, inputs, user, logger);
        case 'helpscout-enhanced': return executeHelpScoutEnhancedAction(actionName, inputs, user, logger);


        // Database REST APIs
        case 'postgres_api': return executePostgresAPIAction(actionName, inputs, user, logger);
        case 'postgres-api': return executePostgresAPIAction(actionName, inputs, user, logger);
        case 'mysql_api': return executeMySQLAPIAction(actionName, inputs, user, logger);
        case 'mysql-api': return executeMySQLAPIAction(actionName, inputs, user, logger);
        case 'mongodb_atlas': return executeMongodbAtlasAction(actionName, inputs, user, logger);
        case 'mongodb-atlas': return executeMongodbAtlasAction(actionName, inputs, user, logger);
        case 'redis_enhanced': return executeRedisEnhancedAction(actionName, inputs, user, logger);
        case 'redis-enhanced': return executeRedisEnhancedAction(actionName, inputs, user, logger);
        case 'elasticsearch_enhanced': return executeElasticsearchEnhancedAction(actionName, inputs, user, logger);
        case 'elasticsearch-enhanced': return executeElasticsearchEnhancedAction(actionName, inputs, user, logger);


        // E-Signature Platforms Enhanced
        case 'docusign_enhanced': return executeDocusignEnhancedAction(actionName, inputs, user, logger);
        case 'docusign-enhanced': return executeDocusignEnhancedAction(actionName, inputs, user, logger);
        case 'pandadoc_enhanced': return executePandadocEnhancedAction(actionName, inputs, user, logger);
        case 'pandadoc-enhanced': return executePandadocEnhancedAction(actionName, inputs, user, logger);
        case 'adobe_sign_enhanced': return executeAdobeSignEnhancedAction(actionName, inputs, user, logger);
        case 'adobe-sign-enhanced': return executeAdobeSignEnhancedAction(actionName, inputs, user, logger);
        case 'dropbox_sign': return executeDropboxSignAction(actionName, inputs, user, logger);
        case 'dropbox-sign': return executeDropboxSignAction(actionName, inputs, user, logger);
        case 'formstack_documents': return executeFormstackDocumentsAction(actionName, inputs, user, logger);
        case 'formstack-documents': return executeFormstackDocumentsAction(actionName, inputs, user, logger);

        case 'calendly-enhanced': return executeCalendlyEnhancedAction(actionName, inputs, user, logger);
        case 'acuity_scheduling': return executeAcuitySchedulingAction(actionName, inputs, user, logger);
        case 'acuity-scheduling': return executeAcuitySchedulingAction(actionName, inputs, user, logger);
        case 'cal_com': return executeCalComAction(actionName, inputs, user, logger);
        case 'cal-com': return executeCalComAction(actionName, inputs, user, logger);
        case 'youcanbook_me': return executeYouCanBookMeAction(actionName, inputs, user, logger);
        case 'youcanbook-me': return executeYouCanBookMeAction(actionName, inputs, user, logger);

        case 'salesforce_marketing_cloud_enhanced': return executeSalesforceMarketingCloudAction(actionName, inputs, user, logger);
        case 'salesforce-marketing-cloud': return executeSalesforceMarketingCloudAction(actionName, inputs, user, logger);
        case 'marketo_enhanced': return executeMarketoEnhancedAction(actionName, inputs, user, logger);
        case 'marketo-enhanced': return executeMarketoEnhancedAction(actionName, inputs, user, logger);
        case 'eloqua': return executeEloquaAction(actionName, inputs, user, logger);
        case 'oracle_eloqua': return executeEloquaAction(actionName, inputs, user, logger);

        // CMS Platforms Enhanced
        case 'sanity-enhanced': return executeSanityEnhancedAction(actionName, inputs, user, logger);
        case 'strapi-enhanced': return executeStrapienHancedAction(actionName, inputs, user, logger);
        case 'ghost-cms': return executeGhostCmsAction(actionName, inputs, user, logger);

        // Accounting & Finance Platforms Enhanced
        case 'quickbooks-enhanced': return executeQuickbooksEnhancedAction(actionName, inputs, user, logger);
        case 'xero-enhanced': return executeXeroEnhancedAction(actionName, inputs, user, logger);
        case 'freshbooks-enhanced': return executeFreshBooksEnhancedAction(actionName, inputs, user, logger);
        case 'sage_accounting_enhanced': return executeSageAccountingAction(actionName, inputs, user, logger);
        case 'sage-accounting': return executeSageAccountingAction(actionName, inputs, user, logger);
        case 'wave_accounting_enhanced': return executeWaveAccountingEnhancedAction(actionName, inputs, user, logger);
        case 'wave-accounting': return executeWaveAccountingEnhancedAction(actionName, inputs, user, logger);

        default:
            logger.log(`Error: Action app "${appId}" is not implemented.`);
            return { error: `Action app "${appId}" is not implemented.` };
    }
}
