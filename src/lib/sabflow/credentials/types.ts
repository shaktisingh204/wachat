/**
 * SabFlow — Credential type definitions
 *
 * Each credential is a user-owned record scoped to a "workspace" (mapped to
 * `userId` in the current SabFlow auth model). Credentials are referenced by
 * `id` from block settings so that sensitive data is never embedded inside a
 * flow document.
 */

import {
  PRESET_CREDENTIAL_CATEGORIES,
  PRESET_CREDENTIAL_LABELS,
  PRESET_CREDENTIAL_SCHEMAS,
  PRESET_CREDENTIAL_TYPES,
  type PresetCredentialType,
} from './preset-credential-types.generated';

/* ── Supported credential providers ─────────────────────────────────────── */

/**
 * Hand-written providers (full bespoke schemas below). App presets reference
 * additional credential types — those are generated into
 * `./preset-credential-types.generated.ts` by
 * `scripts/sabflow-catalog-audit.ts --emit-credentials` and merged into the
 * exported `CredentialType` union + maps further down.
 */
export type KnownCredentialType =
  // ── AI ─────────────────────────────────────────────────────────────
  | 'openai'
  | 'anthropic'
  | 'mistral'
  | 'together_ai'
  | 'elevenlabs'
  | 'cohere'
  | 'groq'
  | 'perplexity'
  | 'openrouter'
  | 'huggingface'
  | 'humantic_ai'
  | 'mindee'
  | 'jina_ai'
  | 'lingvanex'
  | 'cortex'
  | 'airtop'
  // ── Email / Messaging ──────────────────────────────────────────────
  | 'smtp'
  | 'sendgrid'
  | 'mailgun'
  | 'postmark'
  | 'resend'
  | 'mailchimp'
  | 'mailjet'
  | 'mandrill'
  | 'convertkit'
  | 'getresponse'
  | 'brevo'
  | 'mailerlite'
  | 'vero'
  // ── Communication ──────────────────────────────────────────────────
  | 'slack'
  | 'discord'
  | 'telegram'
  | 'twilio'
  | 'microsoft_teams'
  | 'whatsapp'
  | 'chatwoot'
  | 'mattermost'
  | 'matrix'
  | 'rocketchat'
  | 'line'
  | 'messagebird'
  | 'vonage'
  | 'plivo'
  | 'sms77'
  // ── Storage / Files ────────────────────────────────────────────────
  | 'google_sheets'
  | 'google_drive'
  | 'google_analytics'
  | 'dropbox'
  | 'aws_s3'
  | 'nextcloud'
  | 'box'
  | 'ftp'
  | 'ssh'
  | 'snowflake'
  // ── CRM / Sales ────────────────────────────────────────────────────
  | 'hubspot'
  | 'salesforce'
  | 'pipedrive'
  | 'airtable'
  | 'activecampaign'
  | 'copper'
  | 'freshworks_crm'
  | 'zoho_crm'
  | 'agile_crm'
  | 'customerio'
  | 'intercom'
  | 'keap'
  | 'monica_crm'
  | 'drift'
  | 'demio'
  | 'salesmate'
  | 'syncro_msp'
  | 'highlevel'
  | 'microsoft_dynamics_crm'
  | 'affinity'
  | 'erpnext'
  // ── Marketing / Analytics extras ───────────────────────────────────
  | 'mautic'
  | 'egoi'
  | 'iterable'
  | 'hunter'
  | 'phantombuster'
  | 'posthog'
  | 'segment'
  | 'clearbit'
  | 'profitwell'
  | 'tapfiliate'
  // ── Social / CMS extras ────────────────────────────────────────────
  | 'bitly'
  | 'twitter'
  | 'yourls'
  | 'storyblok'
  | 'webflow'
  | 'medium'
  | 'disqus'
  // ── Tools extras ───────────────────────────────────────────────────
  | 'bannerbear'
  | 'brandfetch'
  | 'apitemplate_io'
  | 'peekalink'
  | 'kobotoolbox'
  | 'linkedin'
  | 'onesimpleapi'
  // ── Google OAuth (per-service) ─────────────────────────────────────
  | 'google_bigquery'
  | 'google_chat'
  | 'google_cloud_storage'
  | 'google_firestore'
  // ── Microsoft Graph (per-service) ──────────────────────────────────
  | 'microsoft_excel'
  | 'microsoft_onedrive'
  | 'microsoft_outlook'
  | 'microsoft_sharepoint'
  | 'microsoft_todo'
  // ── Productivity / Project Mgmt ────────────────────────────────────
  | 'notion'
  | 'asana'
  | 'trello'
  | 'clickup'
  | 'monday_com'
  | 'linear'
  | 'jira'
  | 'wekan'
  | 'taiga'
  | 'todoist'
  | 'servicenow'
  | 'freshdesk'
  // ── Code / Git ─────────────────────────────────────────────────────
  | 'github'
  | 'gitlab'
  | 'bitbucket'
  | 'jenkins'
  | 'circleci'
  | 'travisci'
  | 'aws_lambda'
  | 'cloudflare'
  | 'netlify'
  | 'git'
  // ── Docs / Content ─────────────────────────────────────────────────
  | 'coda'
  | 'baserow'
  | 'grist'
  | 'stackby'
  | 'seatable'
  | 'strapi'
  | 'ghost'
  | 'wordpress'
  // ── Monitoring / Support ───────────────────────────────────────────
  | 'sentry_io'
  | 'pagerduty'
  | 'grafana'
  | 'helpscout'
  | 'zendesk'
  | 'zammad'
  | 'deepl'
  | 'reddit'
  | 'discourse'
  // ── Commerce / Payments ────────────────────────────────────────────
  | 'stripe'
  | 'shopify'
  | 'woocommerce'
  | 'paddle'
  | 'chargebee'
  | 'paypal'
  | 'magento'
  | 'quickbooks'
  | 'xero'
  | 'invoiceninja'
  // ── Scheduling ─────────────────────────────────────────────────────
  | 'cal_com'
  | 'calendly'
  // ── Automation bridges ─────────────────────────────────────────────
  | 'zapier'
  | 'make_com'
  | 'pabbly_connect'
  | 'n8n'
  // ── Databases / Backends ───────────────────────────────────────────
  | 'nocodb'
  | 'supabase'
  | 'firebase'
  | 'mongodb'
  | 'postgres'
  | 'mysql'
  | 'redis'
  // ── Generic ────────────────────────────────────────────────────────
  | 'http_basic_auth'
  | 'http_header_auth'
  | 'oauth2'
  | 'custom';

/**
 * Every supported credential type — hand-written providers plus the generated
 * literal union of app-preset credential types (no `string & {}` widening).
 */
export type CredentialType = KnownCredentialType | PresetCredentialType;

/** Ordered list of all supported credential providers. */
export const CREDENTIAL_TYPES: CredentialType[] = [
  // AI
  'openai',
  'anthropic',
  'mistral',
  'together_ai',
  'elevenlabs',
  'cohere',
  'groq',
  'perplexity',
  'openrouter',
  'huggingface',
  'humantic_ai',
  'mindee',
  'jina_ai',
  'lingvanex',
  'cortex',
  'airtop',
  // Email
  'smtp',
  'sendgrid',
  'mailgun',
  'postmark',
  'resend',
  'mailchimp',
  'mailjet',
  'mandrill',
  'convertkit',
  'getresponse',
  'brevo',
  'mailerlite',
  'vero',
  // Communication
  'slack',
  'discord',
  'telegram',
  'twilio',
  'microsoft_teams',
  'whatsapp',
  'chatwoot',
  'mattermost',
  'matrix',
  'rocketchat',
  'line',
  'messagebird',
  'vonage',
  'plivo',
  'sms77',
  // Storage
  'google_sheets',
  'google_drive',
  'google_analytics',
  'dropbox',
  'aws_s3',
  'nextcloud',
  'box',
  'ftp',
  'ssh',
  'snowflake',
  // CRM
  'hubspot',
  'salesforce',
  'pipedrive',
  'airtable',
  'activecampaign',
  'copper',
  'freshworks_crm',
  'zoho_crm',
  'agile_crm',
  'customerio',
  'intercom',
  'keap',
  'monica_crm',
  'drift',
  'demio',
  'salesmate',
  'syncro_msp',
  'highlevel',
  'microsoft_dynamics_crm',
  'affinity',
  'erpnext',
  'mautic',
  'egoi',
  'iterable',
  'hunter',
  'phantombuster',
  'posthog',
  'segment',
  'clearbit',
  'profitwell',
  'tapfiliate',
  'bitly',
  'twitter',
  'yourls',
  'storyblok',
  'webflow',
  'medium',
  'disqus',
  'bannerbear',
  'brandfetch',
  'apitemplate_io',
  'peekalink',
  'kobotoolbox',
  'linkedin',
  'onesimpleapi',
  'google_bigquery',
  'google_chat',
  'google_cloud_storage',
  'google_firestore',
  'microsoft_excel',
  'microsoft_onedrive',
  'microsoft_outlook',
  'microsoft_sharepoint',
  'microsoft_todo',
  // Productivity
  'notion',
  'asana',
  'trello',
  'clickup',
  'monday_com',
  'linear',
  'jira',
  'wekan',
  'taiga',
  'todoist',
  'servicenow',
  'freshdesk',
  // Code
  'github',
  'gitlab',
  'bitbucket',
  'jenkins',
  'circleci',
  'travisci',
  'aws_lambda',
  'cloudflare',
  'netlify',
  'git',
  // Docs
  'coda',
  'baserow',
  'grist',
  'stackby',
  'seatable',
  'strapi',
  'ghost',
  'wordpress',
  // Monitoring / Support
  'sentry_io',
  'pagerduty',
  'grafana',
  'helpscout',
  'zendesk',
  'zammad',
  'deepl',
  'reddit',
  'discourse',
  // Commerce
  'stripe',
  'shopify',
  'woocommerce',
  'paddle',
  'chargebee',
  'paypal',
  'magento',
  'quickbooks',
  'xero',
  'invoiceninja',
  // Scheduling
  'cal_com',
  'calendly',
  // Automation
  'zapier',
  'make_com',
  'pabbly_connect',
  'n8n',
  // DB
  'nocodb',
  'supabase',
  'firebase',
  'mongodb',
  'postgres',
  'mysql',
  'redis',
  // Generic
  'http_basic_auth',
  'http_header_auth',
  'oauth2',
  'custom',
  // Generated app-preset credential types (see preset-credential-types.generated.ts)
  ...PRESET_CREDENTIAL_TYPES,
];

/* ── Categorisation (drives the picker UI) ──────────────────────────────── */

export type CredentialCategory =
  | 'ai'
  | 'email'
  | 'communication'
  | 'storage'
  | 'crm'
  | 'productivity'
  | 'code'
  | 'commerce'
  | 'scheduling'
  | 'automation'
  | 'database'
  | 'generic';

export const CREDENTIAL_CATEGORIES: CredentialCategory[] = [
  'ai',
  'email',
  'communication',
  'storage',
  'crm',
  'productivity',
  'code',
  'commerce',
  'scheduling',
  'automation',
  'database',
  'generic',
];

export const CREDENTIAL_CATEGORY_LABEL: Record<CredentialCategory, string> = {
  ai: 'AI & LLM',
  email: 'Email',
  communication: 'Communication',
  storage: 'Storage & Files',
  crm: 'CRM & Sales',
  productivity: 'Productivity',
  code: 'Code & Git',
  commerce: 'Commerce & Payments',
  scheduling: 'Scheduling',
  automation: 'Automation',
  database: 'Database & Backend',
  generic: 'Generic',
};

export const CREDENTIAL_TYPE_CATEGORY: Record<CredentialType, CredentialCategory> = {
  openai: 'ai',
  anthropic: 'ai',
  mistral: 'ai',
  together_ai: 'ai',
  elevenlabs: 'ai',
  cohere: 'ai',
  groq: 'ai',
  perplexity: 'ai',
  openrouter: 'ai',
  huggingface: 'ai',
  humantic_ai: 'ai',
  mindee: 'ai',
  jina_ai: 'ai',
  lingvanex: 'ai',
  cortex: 'ai',
  airtop: 'ai',

  smtp: 'email',
  sendgrid: 'email',
  mailgun: 'email',
  postmark: 'email',
  resend: 'email',
  mailchimp: 'email',
  mailjet: 'email',
  mandrill: 'email',
  convertkit: 'email',
  getresponse: 'email',
  brevo: 'email',
  mailerlite: 'email',
  vero: 'email',

  slack: 'communication',
  discord: 'communication',
  telegram: 'communication',
  twilio: 'communication',
  microsoft_teams: 'communication',
  whatsapp: 'communication',
  chatwoot: 'communication',
  mattermost: 'communication',
  matrix: 'communication',
  rocketchat: 'communication',
  line: 'communication',
  messagebird: 'communication',
  vonage: 'communication',
  plivo: 'communication',
  sms77: 'communication',

  google_sheets: 'storage',
  google_drive: 'storage',
  google_analytics: 'storage',
  dropbox: 'storage',
  aws_s3: 'storage',
  nextcloud: 'storage',
  box: 'storage',
  ftp: 'storage',
  ssh: 'storage',
  snowflake: 'storage',

  hubspot: 'crm',
  salesforce: 'crm',
  pipedrive: 'crm',
  airtable: 'crm',
  activecampaign: 'crm',
  copper: 'crm',
  freshworks_crm: 'crm',
  zoho_crm: 'crm',
  agile_crm: 'crm',
  customerio: 'crm',
  intercom: 'crm',
  keap: 'crm',
  monica_crm: 'crm',
  drift: 'crm',
  demio: 'crm',
  salesmate: 'crm',
  syncro_msp: 'crm',
  highlevel: 'crm',
  microsoft_dynamics_crm: 'crm',
  affinity: 'crm',
  erpnext: 'crm',
  mautic: 'crm',
  egoi: 'email',
  iterable: 'crm',
  hunter: 'crm',
  phantombuster: 'crm',
  posthog: 'generic',
  segment: 'generic',
  clearbit: 'crm',
  profitwell: 'commerce',
  tapfiliate: 'commerce',
  bitly: 'generic',
  twitter: 'communication',
  yourls: 'generic',
  storyblok: 'productivity',
  webflow: 'productivity',
  medium: 'productivity',
  disqus: 'communication',
  bannerbear: 'generic',
  brandfetch: 'generic',
  apitemplate_io: 'generic',
  peekalink: 'generic',
  kobotoolbox: 'productivity',
  linkedin: 'communication',
  onesimpleapi: 'generic',
  google_bigquery: 'storage',
  google_chat: 'communication',
  google_cloud_storage: 'storage',
  google_firestore: 'database',
  microsoft_excel: 'productivity',
  microsoft_onedrive: 'storage',
  microsoft_outlook: 'email',
  microsoft_sharepoint: 'productivity',
  microsoft_todo: 'productivity',

  notion: 'productivity',
  asana: 'productivity',
  trello: 'productivity',
  clickup: 'productivity',
  monday_com: 'productivity',
  linear: 'productivity',
  jira: 'productivity',
  wekan: 'productivity',
  taiga: 'productivity',
  todoist: 'productivity',
  servicenow: 'productivity',
  freshdesk: 'productivity',

  github: 'code',
  gitlab: 'code',
  bitbucket: 'code',
  jenkins: 'code',
  circleci: 'code',
  travisci: 'code',
  aws_lambda: 'code',
  cloudflare: 'code',
  netlify: 'code',
  git: 'code',
  coda: 'productivity',
  baserow: 'productivity',
  grist: 'productivity',
  stackby: 'productivity',
  seatable: 'productivity',
  strapi: 'productivity',
  ghost: 'productivity',
  wordpress: 'productivity',
  sentry_io: 'generic',
  pagerduty: 'generic',
  grafana: 'generic',
  helpscout: 'communication',
  zendesk: 'communication',
  zammad: 'communication',
  deepl: 'generic',
  reddit: 'communication',
  discourse: 'communication',

  stripe: 'commerce',
  shopify: 'commerce',
  woocommerce: 'commerce',
  paddle: 'commerce',
  chargebee: 'commerce',
  paypal: 'commerce',
  magento: 'commerce',
  quickbooks: 'commerce',
  xero: 'commerce',
  invoiceninja: 'commerce',

  cal_com: 'scheduling',
  calendly: 'scheduling',

  zapier: 'automation',
  make_com: 'automation',
  pabbly_connect: 'automation',
  n8n: 'automation',

  nocodb: 'database',
  supabase: 'database',
  firebase: 'database',
  mongodb: 'database',
  postgres: 'database',
  mysql: 'database',
  redis: 'database',

  http_basic_auth: 'generic',
  http_header_auth: 'generic',
  oauth2: 'generic',
  custom: 'generic',

  // Generated app-preset credential types
  ...PRESET_CREDENTIAL_CATEGORIES,
};

/* ── Credential record ──────────────────────────────────────────────────── */

/**
 * A stored credential.  `data` is encrypted at rest and decrypted in memory
 * when returned from DB helpers. API responses MUST mask this field.
 */
export type Credential = {
  /** Stable identifier (cuid/objectId hex) */
  id: string;
  /** Owner workspace — maps to `userId` in the current auth model. */
  workspaceId: string;
  /** Provider type. */
  type: CredentialType;
  /** User-defined label, e.g. "Production OpenAI". */
  name: string;
  /** Decrypted key → value map (e.g. { apiKey: "sk-…" }). */
  data: Record<string, string>;
  createdAt: Date;
  updatedAt: Date;
};

/** A credential returned to the client with its `data` field masked. */
export type MaskedCredential = Omit<Credential, 'data'> & {
  data: Record<string, string>;
};

/* ── UI helpers ─────────────────────────────────────────────────────────── */

/**
 * Human-readable labels for credential providers (used by the UI).
 */
export const CREDENTIAL_TYPE_LABEL: Record<CredentialType, string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  mistral: 'Mistral AI',
  together_ai: 'Together AI',
  elevenlabs: 'ElevenLabs',
  cohere: 'Cohere',
  groq: 'Groq',
  perplexity: 'Perplexity',
  openrouter: 'OpenRouter',
  huggingface: 'Hugging Face',
  humantic_ai: 'Humantic AI',
  mindee: 'Mindee',
  jina_ai: 'Jina AI',
  lingvanex: 'LingvaNex',
  cortex: 'Cortex',
  airtop: 'Airtop',

  smtp: 'SMTP',
  sendgrid: 'SendGrid',
  mailgun: 'Mailgun',
  postmark: 'Postmark',
  resend: 'Resend',
  mailchimp: 'Mailchimp',
  mailjet: 'Mailjet',
  mandrill: 'Mandrill',
  convertkit: 'ConvertKit',
  getresponse: 'GetResponse',
  brevo: 'Brevo',
  mailerlite: 'MailerLite',
  vero: 'Vero',

  slack: 'Slack',
  discord: 'Discord',
  telegram: 'Telegram',
  twilio: 'Twilio',
  microsoft_teams: 'Microsoft Teams',
  whatsapp: 'WhatsApp',
  chatwoot: 'Chatwoot',
  mattermost: 'Mattermost',
  matrix: 'Matrix',
  rocketchat: 'Rocket.Chat',
  line: 'LINE',
  messagebird: 'MessageBird',
  vonage: 'Vonage',
  plivo: 'Plivo',
  sms77: 'Sms77',

  google_sheets: 'Google Sheets',
  google_drive: 'Google Drive',
  google_analytics: 'Google Analytics',
  dropbox: 'Dropbox',
  aws_s3: 'AWS S3',
  nextcloud: 'NextCloud',
  box: 'Box',
  ftp: 'FTP / SFTP',
  ssh: 'SSH',
  snowflake: 'Snowflake',

  hubspot: 'HubSpot',
  salesforce: 'Salesforce',
  pipedrive: 'Pipedrive',
  airtable: 'Airtable',
  activecampaign: 'ActiveCampaign',
  copper: 'Copper',
  freshworks_crm: 'Freshworks CRM',
  zoho_crm: 'Zoho CRM',
  agile_crm: 'Agile CRM',
  customerio: 'Customer.io',
  intercom: 'Intercom',
  keap: 'Keap',
  monica_crm: 'Monica CRM',
  drift: 'Drift',
  demio: 'Demio',
  salesmate: 'Salesmate',
  syncro_msp: 'Syncro MSP',
  highlevel: 'HighLevel',
  microsoft_dynamics_crm: 'Microsoft Dynamics CRM',
  affinity: 'Affinity',
  erpnext: 'ERPNext',
  mautic: 'Mautic',
  egoi: 'E-goi',
  iterable: 'Iterable',
  hunter: 'Hunter',
  phantombuster: 'PhantomBuster',
  posthog: 'PostHog',
  segment: 'Segment',
  clearbit: 'Clearbit',
  profitwell: 'ProfitWell',
  tapfiliate: 'Tapfiliate',
  bitly: 'Bitly',
  twitter: 'X / Twitter',
  yourls: 'YOURLS',
  storyblok: 'Storyblok',
  webflow: 'Webflow',
  medium: 'Medium',
  disqus: 'Disqus',
  bannerbear: 'Bannerbear',
  brandfetch: 'Brandfetch',
  apitemplate_io: 'APITemplate.io',
  peekalink: 'Peekalink',
  kobotoolbox: 'KoBoToolbox',
  linkedin: 'LinkedIn',
  onesimpleapi: 'One Simple API',
  google_bigquery: 'Google BigQuery',
  google_chat: 'Google Chat',
  google_cloud_storage: 'Google Cloud Storage',
  google_firestore: 'Google Firestore',
  microsoft_excel: 'Microsoft Excel',
  microsoft_onedrive: 'Microsoft OneDrive',
  microsoft_outlook: 'Microsoft Outlook',
  microsoft_sharepoint: 'Microsoft SharePoint',
  microsoft_todo: 'Microsoft ToDo',

  notion: 'Notion',
  asana: 'Asana',
  trello: 'Trello',
  clickup: 'ClickUp',
  monday_com: 'Monday.com',
  linear: 'Linear',
  jira: 'Jira',
  wekan: 'Wekan',
  taiga: 'Taiga',
  todoist: 'Todoist',
  servicenow: 'ServiceNow',
  freshdesk: 'Freshdesk',

  github: 'GitHub',
  gitlab: 'GitLab',
  bitbucket: 'Bitbucket',
  jenkins: 'Jenkins',
  circleci: 'CircleCI',
  travisci: 'Travis CI',
  aws_lambda: 'AWS Lambda',
  cloudflare: 'Cloudflare',
  netlify: 'Netlify',
  git: 'Git',
  coda: 'Coda',
  baserow: 'Baserow',
  grist: 'Grist',
  stackby: 'Stackby',
  seatable: 'SeaTable',
  strapi: 'Strapi',
  ghost: 'Ghost',
  wordpress: 'WordPress',
  sentry_io: 'Sentry',
  pagerduty: 'PagerDuty',
  grafana: 'Grafana',
  helpscout: 'Help Scout',
  zendesk: 'Zendesk',
  zammad: 'Zammad',
  deepl: 'DeepL',
  reddit: 'Reddit',
  discourse: 'Discourse',

  stripe: 'Stripe',
  shopify: 'Shopify',
  woocommerce: 'WooCommerce',
  paddle: 'Paddle',
  chargebee: 'Chargebee',
  paypal: 'PayPal',
  magento: 'Magento',
  quickbooks: 'QuickBooks',
  xero: 'Xero',
  invoiceninja: 'Invoice Ninja',

  cal_com: 'Cal.com',
  calendly: 'Calendly',

  zapier: 'Zapier',
  make_com: 'Make.com',
  pabbly_connect: 'Pabbly Connect',
  n8n: 'n8n',

  nocodb: 'NocoDB',
  supabase: 'Supabase',
  firebase: 'Firebase',
  mongodb: 'MongoDB',
  postgres: 'PostgreSQL',
  mysql: 'MySQL',
  redis: 'Redis',

  http_basic_auth: 'HTTP Basic Auth',
  http_header_auth: 'HTTP Header Auth',
  oauth2: 'OAuth 2.0',
  custom: 'Custom',

  // Generated app-preset credential types
  ...PRESET_CREDENTIAL_LABELS,
};

/* ── Field schema (drives the create/edit form) ─────────────────────────── */

export type CredentialFieldKind = 'text' | 'password' | 'url' | 'number' | 'boolean';

export type CredentialField = {
  key: string;
  label: string;
  kind: CredentialFieldKind;
  placeholder?: string;
  required?: boolean;
  helpText?: string;
};

/**
 * Schema definitions for the dynamic create/edit form.  `custom` is not
 * represented here — its fields are user-defined at runtime.
 */
export const CREDENTIAL_FIELD_SCHEMAS: Record<
  Exclude<CredentialType, 'custom'>,
  CredentialField[]
> = {
  // ── AI ───────────────────────────────────────────────────────────────
  openai: [
    { key: 'apiKey', label: 'API key', kind: 'password', placeholder: 'sk-…', required: true },
    { key: 'organizationId', label: 'Organization ID', kind: 'text', placeholder: 'org-…' },
  ],
  anthropic: [
    { key: 'apiKey', label: 'API key', kind: 'password', placeholder: 'sk-ant-…', required: true },
  ],
  mistral: [
    { key: 'apiKey', label: 'API key', kind: 'password', required: true },
  ],
  together_ai: [
    { key: 'apiKey', label: 'API key', kind: 'password', placeholder: 'together-…', required: true },
  ],
  elevenlabs: [
    { key: 'apiKey', label: 'API key', kind: 'password', placeholder: 'sk_…', required: true },
  ],
  cohere: [
    { key: 'apiKey', label: 'API key', kind: 'password', required: true },
  ],
  groq: [
    { key: 'apiKey', label: 'API key', kind: 'password', placeholder: 'gsk_…', required: true },
  ],
  perplexity: [
    { key: 'apiKey', label: 'API key', kind: 'password', placeholder: 'pplx-…', required: true },
  ],
  openrouter: [
    { key: 'apiKey', label: 'API key', kind: 'password', placeholder: 'sk-or-…', required: true },
  ],
  huggingface: [
    { key: 'accessToken', label: 'Access token', kind: 'password', placeholder: 'hf_…', required: true },
  ],
  humantic_ai: [
    { key: 'apiKey', label: 'API key', kind: 'password', required: true },
  ],
  mindee: [
    { key: 'apiKey', label: 'API key', kind: 'password', required: true },
  ],
  jina_ai: [
    { key: 'apiKey', label: 'API key', kind: 'password', required: true, placeholder: 'jina_…' },
  ],
  lingvanex: [
    { key: 'apiKey', label: 'API key', kind: 'password', required: true },
  ],
  cortex: [
    { key: 'baseUrl', label: 'Base URL', kind: 'url', required: true },
    { key: 'apiKey', label: 'API key', kind: 'password', required: true },
  ],
  airtop: [
    { key: 'apiKey', label: 'API key', kind: 'password', required: true },
  ],

  // ── Email ────────────────────────────────────────────────────────────
  smtp: [
    { key: 'host', label: 'Host', kind: 'text', placeholder: 'smtp.example.com', required: true },
    { key: 'port', label: 'Port', kind: 'number', placeholder: '587', required: true },
    { key: 'username', label: 'Username', kind: 'text', required: true },
    { key: 'password', label: 'Password', kind: 'password', required: true },
    { key: 'useTls', label: 'Use TLS', kind: 'boolean' },
  ],
  sendgrid: [
    { key: 'apiKey', label: 'API key', kind: 'password', placeholder: 'SG.…', required: true },
  ],
  mailgun: [
    { key: 'apiKey', label: 'API key', kind: 'password', required: true },
    { key: 'domain', label: 'Domain', kind: 'text', placeholder: 'mg.example.com', required: true },
    { key: 'region', label: 'Region', kind: 'text', placeholder: 'us | eu' },
  ],
  postmark: [
    { key: 'serverToken', label: 'Server token', kind: 'password', required: true },
  ],
  resend: [
    { key: 'apiKey', label: 'API key', kind: 'password', placeholder: 're_…', required: true },
  ],
  mailchimp: [
    { key: 'apiKey', label: 'API key', kind: 'password', required: true, placeholder: 'xxxxx-us1' },
    { key: 'serverPrefix', label: 'Server prefix', kind: 'text', placeholder: 'us1', helpText: 'Suffix after the dash in your API key' },
  ],
  mailjet: [
    { key: 'apiKey', label: 'API key', kind: 'text', required: true },
    { key: 'secretKey', label: 'Secret key', kind: 'password', required: true },
  ],
  mandrill: [
    { key: 'apiKey', label: 'API key', kind: 'password', required: true },
  ],
  convertkit: [
    { key: 'apiSecret', label: 'API secret', kind: 'password', required: true },
  ],
  getresponse: [
    { key: 'apiKey', label: 'API key', kind: 'password', required: true },
  ],
  brevo: [
    { key: 'apiKey', label: 'API key', kind: 'password', required: true, placeholder: 'xkeysib-…' },
  ],
  mailerlite: [
    { key: 'apiKey', label: 'API key', kind: 'password', required: true },
  ],
  vero: [
    { key: 'authToken', label: 'Auth token', kind: 'password', required: true },
  ],

  // ── Communication ────────────────────────────────────────────────────
  slack: [
    { key: 'botToken', label: 'Bot token', kind: 'password', placeholder: 'xoxb-…', required: true },
    { key: 'signingSecret', label: 'Signing secret', kind: 'password' },
  ],
  discord: [
    { key: 'botToken', label: 'Bot token', kind: 'password', required: true },
    { key: 'webhookUrl', label: 'Webhook URL', kind: 'url' },
  ],
  telegram: [
    { key: 'botToken', label: 'Bot token', kind: 'password', required: true, helpText: 'Token from @BotFather' },
  ],
  twilio: [
    { key: 'accountSid', label: 'Account SID', kind: 'text', placeholder: 'AC…', required: true },
    { key: 'authToken', label: 'Auth token', kind: 'password', required: true },
    { key: 'fromNumber', label: 'From number', kind: 'text', placeholder: '+1…' },
  ],
  microsoft_teams: [
    { key: 'webhookUrl', label: 'Incoming webhook URL', kind: 'url', required: true },
  ],
  whatsapp: [
    { key: 'phoneNumberId', label: 'Phone number ID', kind: 'text', required: true },
    { key: 'accessToken', label: 'Access token', kind: 'password', required: true },
    { key: 'businessAccountId', label: 'Business account ID', kind: 'text' },
  ],
  chatwoot: [
    { key: 'baseUrl', label: 'Base URL', kind: 'url', placeholder: 'https://app.chatwoot.com', required: true },
    { key: 'accountId', label: 'Account ID', kind: 'text', required: true },
    { key: 'apiToken', label: 'API token', kind: 'password', required: true },
  ],
  mattermost: [
    { key: 'baseUrl', label: 'Base URL', kind: 'url', required: true, placeholder: 'https://mattermost.example.com' },
    { key: 'accessToken', label: 'Personal access token', kind: 'password', required: true },
  ],
  matrix: [
    { key: 'homeserverUrl', label: 'Homeserver URL', kind: 'url', required: true, placeholder: 'https://matrix.org' },
    { key: 'accessToken', label: 'Access token', kind: 'password', required: true },
  ],
  rocketchat: [
    { key: 'baseUrl', label: 'Base URL', kind: 'url', required: true },
    { key: 'userId', label: 'User ID', kind: 'text', required: true },
    { key: 'authToken', label: 'Auth token', kind: 'password', required: true },
  ],
  line: [
    { key: 'channelAccessToken', label: 'Channel access token', kind: 'password', required: true },
  ],
  messagebird: [
    { key: 'accessKey', label: 'Access key', kind: 'password', required: true },
  ],
  vonage: [
    { key: 'apiKey', label: 'API key', kind: 'text', required: true },
    { key: 'apiSecret', label: 'API secret', kind: 'password', required: true },
  ],
  plivo: [
    { key: 'authId', label: 'Auth ID', kind: 'text', required: true },
    { key: 'authToken', label: 'Auth token', kind: 'password', required: true },
  ],
  sms77: [
    { key: 'apiKey', label: 'API key', kind: 'password', required: true },
  ],

  // ── Storage / Files ──────────────────────────────────────────────────
  google_sheets: [
    { key: 'clientId', label: 'Client ID', kind: 'text', required: true },
    { key: 'clientSecret', label: 'Client secret', kind: 'password', required: true },
    { key: 'refreshToken', label: 'Refresh token', kind: 'password', required: true },
  ],
  google_drive: [
    { key: 'clientId', label: 'Client ID', kind: 'text', required: true },
    { key: 'clientSecret', label: 'Client secret', kind: 'password', required: true },
    { key: 'refreshToken', label: 'Refresh token', kind: 'password', required: true },
  ],
  google_analytics: [
    { key: 'clientId', label: 'Client ID', kind: 'text', required: true },
    { key: 'clientSecret', label: 'Client secret', kind: 'password', required: true },
    { key: 'refreshToken', label: 'Refresh token', kind: 'password', required: true },
  ],
  dropbox: [
    { key: 'accessToken', label: 'Access token', kind: 'password', required: true },
  ],
  aws_s3: [
    { key: 'accessKeyId', label: 'Access key ID', kind: 'text', required: true },
    { key: 'secretAccessKey', label: 'Secret access key', kind: 'password', required: true },
    { key: 'region', label: 'Region', kind: 'text', placeholder: 'us-east-1', required: true },
    { key: 'bucket', label: 'Default bucket', kind: 'text' },
  ],
  nextcloud: [
    { key: 'baseUrl', label: 'Base URL', kind: 'url', required: true, placeholder: 'https://nc.example.com' },
    { key: 'username', label: 'Username', kind: 'text', required: true },
    { key: 'password', label: 'App password', kind: 'password', required: true },
  ],
  box: [
    { key: 'accessToken', label: 'Access token', kind: 'password', required: true },
  ],
  ftp: [
    { key: 'host', label: 'Host', kind: 'text', required: true },
    { key: 'port', label: 'Port', kind: 'number', placeholder: '21 (FTP) / 22 (SFTP)' },
    { key: 'username', label: 'Username', kind: 'text', required: true },
    { key: 'password', label: 'Password', kind: 'password', required: true },
    { key: 'useSftp', label: 'Use SFTP', kind: 'boolean' },
  ],
  ssh: [
    { key: 'host', label: 'Host', kind: 'text', required: true },
    { key: 'port', label: 'Port', kind: 'number', placeholder: '22' },
    { key: 'username', label: 'Username', kind: 'text', required: true },
    { key: 'password', label: 'Password', kind: 'password' },
    { key: 'privateKey', label: 'Private key', kind: 'password', helpText: 'Paste full PEM if using key auth' },
  ],
  snowflake: [
    { key: 'account', label: 'Account', kind: 'text', required: true, placeholder: 'xy12345.us-east-1' },
    { key: 'username', label: 'Username', kind: 'text', required: true },
    { key: 'password', label: 'Password', kind: 'password', required: true },
    { key: 'database', label: 'Database', kind: 'text' },
    { key: 'warehouse', label: 'Warehouse', kind: 'text' },
    { key: 'schema', label: 'Schema', kind: 'text' },
  ],

  // ── CRM / Sales ──────────────────────────────────────────────────────
  hubspot: [
    { key: 'accessToken', label: 'Private app access token', kind: 'password', placeholder: 'pat-…', required: true },
  ],
  salesforce: [
    { key: 'clientId', label: 'Consumer key', kind: 'text', required: true },
    { key: 'clientSecret', label: 'Consumer secret', kind: 'password', required: true },
    { key: 'username', label: 'Username', kind: 'text', required: true },
    { key: 'password', label: 'Password + security token', kind: 'password', required: true },
    { key: 'instanceUrl', label: 'Instance URL', kind: 'url', placeholder: 'https://login.salesforce.com' },
  ],
  pipedrive: [
    { key: 'apiToken', label: 'API token', kind: 'password', required: true },
    { key: 'companyDomain', label: 'Company domain', kind: 'text', placeholder: 'mycompany' },
  ],
  airtable: [
    { key: 'apiKey', label: 'Personal access token', kind: 'password', placeholder: 'pat…', required: true },
  ],
  activecampaign: [
    { key: 'baseUrl', label: 'API URL', kind: 'url', required: true, placeholder: 'https://you.api-us1.com' },
    { key: 'apiKey', label: 'API key', kind: 'password', required: true },
  ],
  copper: [
    { key: 'apiKey', label: 'API key', kind: 'password', required: true },
    { key: 'email', label: 'Account email', kind: 'text', required: true },
  ],
  freshworks_crm: [
    { key: 'baseUrl', label: 'Domain', kind: 'url', required: true, placeholder: 'https://you.myfreshworks.com' },
    { key: 'apiKey', label: 'API key', kind: 'password', required: true },
  ],
  zoho_crm: [
    { key: 'clientId', label: 'Client ID', kind: 'text', required: true },
    { key: 'clientSecret', label: 'Client secret', kind: 'password', required: true },
    { key: 'refreshToken', label: 'Refresh token', kind: 'password', required: true },
    { key: 'baseUrl', label: 'API base', kind: 'url', placeholder: 'https://www.zohoapis.com' },
  ],
  agile_crm: [
    { key: 'domain', label: 'Domain', kind: 'text', required: true, placeholder: 'yourcompany' },
    { key: 'email', label: 'Account email', kind: 'text', required: true },
    { key: 'apiKey', label: 'API key', kind: 'password', required: true },
  ],
  customerio: [
    { key: 'siteId', label: 'Site ID', kind: 'text', required: true },
    { key: 'apiKey', label: 'Tracking API key', kind: 'password', required: true },
    { key: 'appApiKey', label: 'App API key', kind: 'password' },
    { key: 'region', label: 'Region', kind: 'text', placeholder: 'us | eu' },
  ],
  intercom: [
    { key: 'accessToken', label: 'Access token', kind: 'password', required: true },
  ],
  keap: [
    { key: 'accessToken', label: 'Access token', kind: 'password', required: true },
    { key: 'refreshToken', label: 'Refresh token', kind: 'password' },
  ],
  monica_crm: [
    { key: 'baseUrl', label: 'Base URL', kind: 'url', placeholder: 'https://app.monicahq.com' },
    { key: 'apiToken', label: 'API token', kind: 'password', required: true },
  ],
  drift: [
    { key: 'accessToken', label: 'Access token', kind: 'password', required: true },
  ],
  demio: [
    { key: 'apiKey', label: 'API key', kind: 'password', required: true },
    { key: 'apiSecret', label: 'API secret', kind: 'password' },
  ],
  salesmate: [
    { key: 'subdomain', label: 'Subdomain', kind: 'text', required: true, placeholder: 'mycompany' },
    { key: 'sessionToken', label: 'Session token', kind: 'password', required: true },
  ],
  syncro_msp: [
    { key: 'subdomain', label: 'Subdomain', kind: 'text', required: true },
    { key: 'apiKey', label: 'API key', kind: 'password', required: true },
  ],
  highlevel: [
    { key: 'apiKey', label: 'API key', kind: 'password', required: true },
    { key: 'locationId', label: 'Location ID', kind: 'text' },
  ],
  microsoft_dynamics_crm: [
    { key: 'baseUrl', label: 'Org URL', kind: 'url', required: true, placeholder: 'https://yourorg.api.crm.dynamics.com' },
    { key: 'accessToken', label: 'Access token', kind: 'password', required: true },
  ],
  affinity: [
    { key: 'apiKey', label: 'API key', kind: 'password', required: true },
  ],
  erpnext: [
    { key: 'baseUrl', label: 'Base URL', kind: 'url', required: true },
    { key: 'apiKey', label: 'API key', kind: 'text', required: true },
    { key: 'apiSecret', label: 'API secret', kind: 'password', required: true },
  ],
  mautic: [
    { key: 'baseUrl', label: 'Base URL', kind: 'url', required: true },
    { key: 'username', label: 'Username', kind: 'text', required: true },
    { key: 'password', label: 'Password', kind: 'password', required: true },
  ],
  egoi: [
    { key: 'apiKey', label: 'API key', kind: 'password', required: true },
  ],
  iterable: [
    { key: 'apiKey', label: 'API key', kind: 'password', required: true },
  ],
  hunter: [
    { key: 'apiKey', label: 'API key', kind: 'password', required: true },
  ],
  phantombuster: [
    { key: 'apiKey', label: 'API key', kind: 'password', required: true },
  ],
  posthog: [
    { key: 'baseUrl', label: 'Base URL', kind: 'url', placeholder: 'https://app.posthog.com' },
    { key: 'apiKey', label: 'Project API key', kind: 'password', required: true },
    { key: 'personalApiKey', label: 'Personal API key', kind: 'password' },
  ],
  segment: [
    { key: 'writeKey', label: 'Write key', kind: 'password', required: true },
  ],
  clearbit: [
    { key: 'apiKey', label: 'API key', kind: 'password', required: true },
  ],
  profitwell: [
    { key: 'apiToken', label: 'API token', kind: 'password', required: true },
  ],
  tapfiliate: [
    { key: 'apiKey', label: 'API key', kind: 'password', required: true },
  ],
  bitly: [
    { key: 'accessToken', label: 'Access token', kind: 'password', required: true },
  ],
  twitter: [
    { key: 'bearerToken', label: 'Bearer token', kind: 'password', required: true },
    { key: 'apiKey', label: 'API key', kind: 'text' },
    { key: 'apiKeySecret', label: 'API key secret', kind: 'password' },
    { key: 'accessToken', label: 'Access token', kind: 'text' },
    { key: 'accessTokenSecret', label: 'Access token secret', kind: 'password' },
  ],
  yourls: [
    { key: 'baseUrl', label: 'Base URL', kind: 'url', required: true },
    { key: 'signature', label: 'Signature token', kind: 'password', required: true },
  ],
  storyblok: [
    { key: 'oauthToken', label: 'OAuth token', kind: 'password', required: true },
    { key: 'previewToken', label: 'Preview token', kind: 'password' },
  ],
  webflow: [
    { key: 'apiToken', label: 'API token', kind: 'password', required: true },
  ],
  medium: [
    { key: 'accessToken', label: 'Integration token', kind: 'password', required: true },
  ],
  disqus: [
    { key: 'apiKey', label: 'API key', kind: 'text', required: true },
    { key: 'apiSecret', label: 'API secret', kind: 'password', required: true },
    { key: 'accessToken', label: 'Access token', kind: 'password' },
  ],
  bannerbear: [
    { key: 'apiKey', label: 'API key', kind: 'password', required: true },
  ],
  brandfetch: [
    { key: 'apiKey', label: 'API key', kind: 'password', required: true },
  ],
  apitemplate_io: [
    { key: 'apiKey', label: 'API key', kind: 'password', required: true },
  ],
  peekalink: [
    { key: 'apiKey', label: 'API key', kind: 'password', required: true },
  ],
  kobotoolbox: [
    { key: 'baseUrl', label: 'Base URL', kind: 'url', required: true, placeholder: 'https://kf.kobotoolbox.org' },
    { key: 'apiToken', label: 'API token', kind: 'password', required: true },
  ],
  linkedin: [
    { key: 'accessToken', label: 'Access token', kind: 'password', required: true },
    { key: 'userId', label: 'Person URN / User ID', kind: 'text' },
  ],
  onesimpleapi: [
    { key: 'apiToken', label: 'API token', kind: 'password', required: true },
  ],
  // ── Google OAuth (per-service) ───────────────────────────────────────
  google_bigquery: [
    { key: 'clientId', label: 'Client ID', kind: 'text', required: true },
    { key: 'clientSecret', label: 'Client secret', kind: 'password', required: true },
    { key: 'refreshToken', label: 'Refresh token', kind: 'password', required: true },
    { key: 'projectId', label: 'Project ID', kind: 'text', required: true },
  ],
  google_chat: [
    { key: 'clientId', label: 'Client ID', kind: 'text', required: true },
    { key: 'clientSecret', label: 'Client secret', kind: 'password', required: true },
    { key: 'refreshToken', label: 'Refresh token', kind: 'password', required: true },
  ],
  google_cloud_storage: [
    { key: 'clientId', label: 'Client ID', kind: 'text', required: true },
    { key: 'clientSecret', label: 'Client secret', kind: 'password', required: true },
    { key: 'refreshToken', label: 'Refresh token', kind: 'password', required: true },
  ],
  google_firestore: [
    { key: 'clientId', label: 'Client ID', kind: 'text', required: true },
    { key: 'clientSecret', label: 'Client secret', kind: 'password', required: true },
    { key: 'refreshToken', label: 'Refresh token', kind: 'password', required: true },
    { key: 'projectId', label: 'Project ID', kind: 'text', required: true },
  ],
  // ── Microsoft Graph (per-service) ────────────────────────────────────
  microsoft_excel: [
    { key: 'clientId', label: 'Client ID', kind: 'text', required: true },
    { key: 'clientSecret', label: 'Client secret', kind: 'password', required: true },
    { key: 'refreshToken', label: 'Refresh token', kind: 'password', required: true },
  ],
  microsoft_onedrive: [
    { key: 'clientId', label: 'Client ID', kind: 'text', required: true },
    { key: 'clientSecret', label: 'Client secret', kind: 'password', required: true },
    { key: 'refreshToken', label: 'Refresh token', kind: 'password', required: true },
  ],
  microsoft_outlook: [
    { key: 'clientId', label: 'Client ID', kind: 'text', required: true },
    { key: 'clientSecret', label: 'Client secret', kind: 'password', required: true },
    { key: 'refreshToken', label: 'Refresh token', kind: 'password', required: true },
  ],
  microsoft_sharepoint: [
    { key: 'clientId', label: 'Client ID', kind: 'text', required: true },
    { key: 'clientSecret', label: 'Client secret', kind: 'password', required: true },
    { key: 'refreshToken', label: 'Refresh token', kind: 'password', required: true },
  ],
  microsoft_todo: [
    { key: 'clientId', label: 'Client ID', kind: 'text', required: true },
    { key: 'clientSecret', label: 'Client secret', kind: 'password', required: true },
    { key: 'refreshToken', label: 'Refresh token', kind: 'password', required: true },
  ],

  // ── Productivity ─────────────────────────────────────────────────────
  notion: [
    { key: 'apiKey', label: 'Internal integration token', kind: 'password', placeholder: 'secret_…', required: true },
  ],
  asana: [
    { key: 'accessToken', label: 'Personal access token', kind: 'password', required: true },
  ],
  trello: [
    { key: 'apiKey', label: 'API key', kind: 'text', required: true },
    { key: 'apiToken', label: 'API token', kind: 'password', required: true },
  ],
  clickup: [
    { key: 'apiToken', label: 'API token', kind: 'password', placeholder: 'pk_…', required: true },
  ],
  monday_com: [
    { key: 'apiToken', label: 'API token (v2)', kind: 'password', required: true },
  ],
  linear: [
    { key: 'apiKey', label: 'API key', kind: 'password', placeholder: 'lin_api_…', required: true },
  ],
  jira: [
    { key: 'baseUrl', label: 'Base URL', kind: 'url', placeholder: 'https://you.atlassian.net', required: true },
    { key: 'email', label: 'Email', kind: 'text', required: true },
    { key: 'apiToken', label: 'API token', kind: 'password', required: true },
  ],
  wekan: [
    { key: 'baseUrl', label: 'Base URL', kind: 'url', required: true },
    { key: 'username', label: 'Username', kind: 'text', required: true },
    { key: 'password', label: 'Password', kind: 'password', required: true },
  ],
  taiga: [
    { key: 'baseUrl', label: 'Base URL', kind: 'url', required: true, placeholder: 'https://api.taiga.io' },
    { key: 'username', label: 'Username', kind: 'text', required: true },
    { key: 'password', label: 'Password', kind: 'password', required: true },
  ],
  todoist: [
    { key: 'apiToken', label: 'API token', kind: 'password', required: true },
  ],
  servicenow: [
    { key: 'instanceUrl', label: 'Instance URL', kind: 'url', required: true, placeholder: 'https://dev12345.service-now.com' },
    { key: 'username', label: 'Username', kind: 'text', required: true },
    { key: 'password', label: 'Password', kind: 'password', required: true },
  ],
  freshdesk: [
    { key: 'domain', label: 'Domain', kind: 'text', required: true, placeholder: 'yourcompany.freshdesk.com' },
    { key: 'apiKey', label: 'API key', kind: 'password', required: true },
  ],

  // ── Code / Git ───────────────────────────────────────────────────────
  github: [
    { key: 'accessToken', label: 'Personal access token', kind: 'password', placeholder: 'ghp_…', required: true },
  ],
  gitlab: [
    { key: 'accessToken', label: 'Personal access token', kind: 'password', required: true },
    { key: 'baseUrl', label: 'Base URL', kind: 'url', placeholder: 'https://gitlab.com' },
  ],
  bitbucket: [
    { key: 'username', label: 'Username', kind: 'text', required: true },
    { key: 'appPassword', label: 'App password', kind: 'password', required: true },
  ],
  jenkins: [
    { key: 'baseUrl', label: 'Base URL', kind: 'url', required: true, placeholder: 'https://jenkins.example.com' },
    { key: 'username', label: 'Username', kind: 'text', required: true },
    { key: 'apiToken', label: 'API token', kind: 'password', required: true },
  ],
  circleci: [
    { key: 'apiToken', label: 'Personal API token', kind: 'password', required: true },
  ],
  travisci: [
    { key: 'apiToken', label: 'API token', kind: 'password', required: true },
    { key: 'baseUrl', label: 'Base URL', kind: 'url', placeholder: 'https://api.travis-ci.com' },
  ],
  aws_lambda: [
    { key: 'accessKeyId', label: 'Access key ID', kind: 'text', required: true },
    { key: 'secretAccessKey', label: 'Secret access key', kind: 'password', required: true },
    { key: 'region', label: 'Region', kind: 'text', placeholder: 'us-east-1', required: true },
  ],
  cloudflare: [
    { key: 'apiToken', label: 'API token', kind: 'password', required: true },
    { key: 'accountId', label: 'Account ID', kind: 'text' },
  ],
  netlify: [
    { key: 'accessToken', label: 'Personal access token', kind: 'password', required: true },
  ],
  git: [
    { key: 'repositoryUrl', label: 'Default repo URL', kind: 'url', placeholder: 'https://github.com/owner/repo.git' },
    { key: 'username', label: 'Username', kind: 'text' },
    { key: 'password', label: 'Password / Token', kind: 'password' },
  ],
  // ── Docs / Content ───────────────────────────────────────────────────
  coda: [
    { key: 'apiToken', label: 'API token', kind: 'password', required: true },
  ],
  baserow: [
    { key: 'baseUrl', label: 'Base URL', kind: 'url', required: true, placeholder: 'https://api.baserow.io' },
    { key: 'apiToken', label: 'API token', kind: 'password', required: true },
  ],
  grist: [
    { key: 'baseUrl', label: 'Base URL', kind: 'url', required: true, placeholder: 'https://docs.getgrist.com' },
    { key: 'apiKey', label: 'API key', kind: 'password', required: true },
  ],
  stackby: [
    { key: 'apiKey', label: 'API key', kind: 'password', required: true },
  ],
  seatable: [
    { key: 'baseUrl', label: 'Base URL', kind: 'url', required: true, placeholder: 'https://cloud.seatable.io' },
    { key: 'apiToken', label: 'API token', kind: 'password', required: true },
  ],
  strapi: [
    { key: 'baseUrl', label: 'Base URL', kind: 'url', required: true },
    { key: 'apiToken', label: 'API token', kind: 'password', required: true },
  ],
  ghost: [
    { key: 'baseUrl', label: 'Base URL', kind: 'url', required: true },
    { key: 'adminApiKey', label: 'Admin API key', kind: 'password', required: true },
  ],
  wordpress: [
    { key: 'baseUrl', label: 'Base URL', kind: 'url', required: true },
    { key: 'username', label: 'Username', kind: 'text', required: true },
    { key: 'appPassword', label: 'Application password', kind: 'password', required: true },
  ],
  // ── Monitoring / Support ─────────────────────────────────────────────
  sentry_io: [
    { key: 'baseUrl', label: 'Base URL', kind: 'url', placeholder: 'https://sentry.io/api/0' },
    { key: 'authToken', label: 'Auth token', kind: 'password', required: true },
  ],
  pagerduty: [
    { key: 'apiToken', label: 'API token', kind: 'password', required: true },
  ],
  grafana: [
    { key: 'baseUrl', label: 'Base URL', kind: 'url', required: true },
    { key: 'apiKey', label: 'API key', kind: 'password', required: true },
  ],
  helpscout: [
    { key: 'appId', label: 'App ID', kind: 'text', required: true },
    { key: 'appSecret', label: 'App secret', kind: 'password', required: true },
  ],
  zendesk: [
    { key: 'subdomain', label: 'Subdomain', kind: 'text', required: true, placeholder: 'yourcompany' },
    { key: 'email', label: 'Email', kind: 'text', required: true },
    { key: 'apiToken', label: 'API token', kind: 'password', required: true },
  ],
  zammad: [
    { key: 'baseUrl', label: 'Base URL', kind: 'url', required: true },
    { key: 'accessToken', label: 'Access token', kind: 'password', required: true },
  ],
  deepl: [
    { key: 'apiKey', label: 'API key', kind: 'password', required: true, placeholder: 'free key ends with :fx' },
  ],
  reddit: [
    { key: 'clientId', label: 'Client ID', kind: 'text', required: true },
    { key: 'clientSecret', label: 'Client secret', kind: 'password', required: true },
    { key: 'username', label: 'Username', kind: 'text', required: true },
    { key: 'password', label: 'Password', kind: 'password', required: true },
  ],
  discourse: [
    { key: 'baseUrl', label: 'Base URL', kind: 'url', required: true },
    { key: 'apiKey', label: 'API key', kind: 'password', required: true },
    { key: 'apiUsername', label: 'API username', kind: 'text', required: true },
  ],

  // ── Commerce ─────────────────────────────────────────────────────────
  stripe: [
    { key: 'publicKey', label: 'Publishable key', kind: 'text', placeholder: 'pk_…', required: true },
    { key: 'secretKey', label: 'Secret key', kind: 'password', placeholder: 'sk_…', required: true },
    { key: 'webhookSecret', label: 'Webhook secret', kind: 'password', placeholder: 'whsec_…' },
  ],
  shopify: [
    { key: 'shopDomain', label: 'Shop domain', kind: 'text', placeholder: 'mystore.myshopify.com', required: true },
    { key: 'accessToken', label: 'Admin API access token', kind: 'password', placeholder: 'shpat_…', required: true },
  ],
  woocommerce: [
    { key: 'baseUrl', label: 'Store URL', kind: 'url', placeholder: 'https://store.example.com', required: true },
    { key: 'consumerKey', label: 'Consumer key', kind: 'text', placeholder: 'ck_…', required: true },
    { key: 'consumerSecret', label: 'Consumer secret', kind: 'password', placeholder: 'cs_…', required: true },
  ],
  paddle: [
    { key: 'apiKey', label: 'API key', kind: 'password', required: true, placeholder: 'pdl_live_…' },
    { key: 'environment', label: 'Environment', kind: 'text', placeholder: 'live | sandbox' },
  ],
  chargebee: [
    { key: 'site', label: 'Site name', kind: 'text', required: true, placeholder: 'mycompany' },
    { key: 'apiKey', label: 'API key', kind: 'password', required: true },
  ],
  paypal: [
    { key: 'clientId', label: 'Client ID', kind: 'text', required: true },
    { key: 'clientSecret', label: 'Client secret', kind: 'password', required: true },
    { key: 'environment', label: 'Environment', kind: 'text', placeholder: 'live | sandbox' },
  ],
  magento: [
    { key: 'baseUrl', label: 'Store URL', kind: 'url', required: true },
    { key: 'accessToken', label: 'Access token', kind: 'password', required: true },
  ],
  quickbooks: [
    { key: 'companyId', label: 'Company / Realm ID', kind: 'text', required: true },
    { key: 'accessToken', label: 'Access token', kind: 'password', required: true },
    { key: 'environment', label: 'Environment', kind: 'text', placeholder: 'production | sandbox' },
  ],
  xero: [
    { key: 'accessToken', label: 'Access token', kind: 'password', required: true },
    { key: 'tenantId', label: 'Tenant ID', kind: 'text', required: true },
  ],
  invoiceninja: [
    { key: 'baseUrl', label: 'Base URL', kind: 'url', required: true, placeholder: 'https://app.invoiceninja.com' },
    { key: 'apiToken', label: 'API token', kind: 'password', required: true },
  ],

  // ── Scheduling ───────────────────────────────────────────────────────
  cal_com: [
    { key: 'apiKey', label: 'API key', kind: 'password', placeholder: 'cal_live_…', required: true },
  ],
  calendly: [
    { key: 'accessToken', label: 'Personal access token', kind: 'password', required: true },
  ],

  // ── Automation bridges ───────────────────────────────────────────────
  zapier: [
    { key: 'webhookUrl', label: 'Webhook URL', kind: 'url', required: true },
  ],
  make_com: [
    { key: 'webhookUrl', label: 'Webhook URL', kind: 'url', required: true },
  ],
  pabbly_connect: [
    { key: 'webhookUrl', label: 'Webhook URL', kind: 'url', required: true },
  ],
  n8n: [
    { key: 'webhookUrl', label: 'Webhook URL', kind: 'url', required: true },
    { key: 'apiKey', label: 'API key', kind: 'password', helpText: 'Optional — used to call /rest endpoints' },
  ],

  // ── Database / Backend ───────────────────────────────────────────────
  nocodb: [
    { key: 'apiUrl', label: 'API URL', kind: 'url', placeholder: 'https://app.nocodb.com/api/v1', required: true },
    { key: 'apiToken', label: 'API token', kind: 'password', required: true },
  ],
  supabase: [
    { key: 'projectUrl', label: 'Project URL', kind: 'url', placeholder: 'https://xyz.supabase.co', required: true },
    { key: 'serviceRoleKey', label: 'Service-role key', kind: 'password', required: true },
  ],
  firebase: [
    { key: 'projectId', label: 'Project ID', kind: 'text', required: true },
    { key: 'clientEmail', label: 'Client email', kind: 'text', required: true },
    { key: 'privateKey', label: 'Private key', kind: 'password', required: true, helpText: 'Paste the full PEM block' },
  ],
  mongodb: [
    { key: 'connectionString', label: 'Connection string', kind: 'password', placeholder: 'mongodb+srv://…', required: true },
  ],
  postgres: [
    { key: 'host', label: 'Host', kind: 'text', required: true },
    { key: 'port', label: 'Port', kind: 'number', placeholder: '5432' },
    { key: 'database', label: 'Database', kind: 'text', required: true },
    { key: 'username', label: 'Username', kind: 'text', required: true },
    { key: 'password', label: 'Password', kind: 'password', required: true },
    { key: 'ssl', label: 'Use SSL', kind: 'boolean' },
  ],
  mysql: [
    { key: 'host', label: 'Host', kind: 'text', required: true },
    { key: 'port', label: 'Port', kind: 'number', placeholder: '3306' },
    { key: 'database', label: 'Database', kind: 'text', required: true },
    { key: 'username', label: 'Username', kind: 'text', required: true },
    { key: 'password', label: 'Password', kind: 'password', required: true },
  ],
  redis: [
    { key: 'connectionString', label: 'Connection string', kind: 'password', placeholder: 'redis://…', required: true },
  ],

  // ── Generic auth ─────────────────────────────────────────────────────
  http_basic_auth: [
    { key: 'username', label: 'Username', kind: 'text', required: true },
    { key: 'password', label: 'Password', kind: 'password', required: true },
  ],
  http_header_auth: [
    { key: 'headerName', label: 'Header name', kind: 'text', placeholder: 'Authorization', required: true },
    { key: 'headerValue', label: 'Header value', kind: 'password', required: true },
  ],
  oauth2: [
    { key: 'clientId', label: 'Client ID', kind: 'text', required: true },
    { key: 'clientSecret', label: 'Client secret', kind: 'password', required: true },
    { key: 'authUrl', label: 'Authorization URL', kind: 'url', required: true },
    { key: 'tokenUrl', label: 'Token URL', kind: 'url', required: true },
    { key: 'scope', label: 'Scope', kind: 'text' },
  ],

  // ── Generated app-preset credential types ────────────────────────────
  ...PRESET_CREDENTIAL_SCHEMAS,
};

/** The value stored in every masked `data` field. */
export const MASK_PLACEHOLDER = '••••••••';
