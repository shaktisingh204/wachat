import type { BlockType } from '@/lib/sabflow/types';
import type { ComponentType, SVGProps } from 'react';

import {
  LuMessageSquare,
  LuImage,
  LuVideo,
  LuMic,
  LuCode,
  LuType,
  LuHash,
  LuMail,
  LuPhone,
  LuLink,
  LuCalendar,
  LuClock,
  LuStar,
  LuUpload,
  LuCreditCard,
  LuSquareCheck,
  LuLayoutGrid,
  LuGitBranch,
  LuVariable,
  LuExternalLink,
  LuFileCode,
  LuLink2,
  LuTimer,
  LuShuffle,
  LuFlaskConical,
  LuGlobe,
  LuSend,
  LuSheet,
  LuChartBar,
  LuBot,
  LuZap,
  LuLayers,
  LuPlug,
  LuUsers,
  LuEye,
  LuActivity,
  LuCalendarDays,
  LuDatabase,
  LuVolume2,
  LuBrain,
  LuCpu,
  LuRepeat,
  LuGitMerge,
  LuSplit,
  LuFilter,
  LuArrowDownWideNarrow,
  LuFileBox,
  LuPlay,
  LuArrowLeft,
  LuFileText,
  LuMessageCircle,
  LuGithub,
  LuShare2,
  LuCloud,
  LuPaperclip,
  LuKey,
  LuPackage,
} from 'react-icons/lu';

type BlockMeta = {
  label: string;
  icon: ComponentType<SVGProps<SVGSVGElement>> | ComponentType<{ className?: string }>;
  category: 'bubbles' | 'inputs' | 'logic' | 'integrations' | 'forge';
  color?: string;
};

const BLOCK_REGISTRY: Record<string, BlockMeta> = {
  // ── Bubbles ──
  text:          { label: 'Text',           icon: LuMessageSquare, category: 'bubbles', color: '#6366f1' },
  image:         { label: 'Image',          icon: LuImage,         category: 'bubbles', color: '#8b5cf6' },
  video:         { label: 'Video',          icon: LuVideo,         category: 'bubbles', color: '#a855f7' },
  audio:         { label: 'Audio',          icon: LuMic,           category: 'bubbles', color: '#c084fc' },
  embed:         { label: 'Embed',          icon: LuCode,          category: 'bubbles', color: '#d946ef' },

  // ── Inputs ──
  text_input:    { label: 'Text Input',     icon: LuType,          category: 'inputs',  color: '#06b6d4' },
  number_input:  { label: 'Number',         icon: LuHash,          category: 'inputs',  color: '#0ea5e9' },
  email_input:   { label: 'Email',          icon: LuMail,          category: 'inputs',  color: '#3b82f6' },
  phone_input:   { label: 'Phone',          icon: LuPhone,         category: 'inputs',  color: '#2563eb' },
  url_input:     { label: 'URL',            icon: LuLink,          category: 'inputs',  color: '#1d4ed8' },
  date_input:    { label: 'Date',           icon: LuCalendar,      category: 'inputs',  color: '#60a5fa' },
  time_input:    { label: 'Time',           icon: LuClock,         category: 'inputs',  color: '#93c5fd' },
  rating_input:  { label: 'Rating',         icon: LuStar,          category: 'inputs',  color: '#fbbf24' },
  file_input:    { label: 'File Upload',    icon: LuUpload,        category: 'inputs',  color: '#f59e0b' },
  payment_input: { label: 'Payment',        icon: LuCreditCard,    category: 'inputs',  color: '#d97706' },
  choice_input:  { label: 'Buttons',        icon: LuSquareCheck,   category: 'inputs',  color: '#10b981' },
  picture_choice_input: { label: 'Picture Choice', icon: LuLayoutGrid, category: 'inputs', color: '#059669' },

  // ── Logic ──
  condition:     { label: 'Condition',      icon: LuGitBranch,     category: 'logic',   color: '#f97316' },
  set_variable:  { label: 'Set Variable',   icon: LuVariable,      category: 'logic',   color: '#fb923c' },
  set:           { label: 'Set Multiple',   icon: LuVariable,      category: 'logic',   color: '#fb923c' },
  redirect:      { label: 'Redirect',       icon: LuExternalLink,  category: 'logic',   color: '#fdba74' },
  script:        { label: 'Script',         icon: LuFileCode,      category: 'logic',   color: '#fed7aa' },
  typebot_link:  { label: 'Jump to Flow',   icon: LuLink2,         category: 'logic',   color: '#fde68a' },
  wait:          { label: 'Wait',           icon: LuTimer,         category: 'logic',   color: '#fcd34d' },
  jump:          { label: 'Jump',           icon: LuShuffle,       category: 'logic',   color: '#fbbf24' },
  ab_test:       { label: 'A/B Test',       icon: LuFlaskConical,  category: 'logic',   color: '#f59e0b' },
  loop:          { label: 'Loop',           icon: LuRepeat,        category: 'logic',   color: '#eab308' },
  merge:         { label: 'Merge',          icon: LuGitMerge,      category: 'logic',   color: '#facc15' },
  switch:        { label: 'Switch',         icon: LuSplit,         category: 'logic',   color: '#fde047' },
  filter:        { label: 'Filter',         icon: LuFilter,        category: 'logic',   color: '#fcd34d' },
  sort:          { label: 'Sort',           icon: LuArrowDownWideNarrow, category: 'logic', color: '#fbbf24' },
  execute_workflow:    { label: 'Execute Workflow',  icon: LuPlay,        category: 'logic', color: '#fde68a' },
  respond_to_webhook:  { label: 'Respond Webhook',   icon: LuArrowLeft,   category: 'logic', color: '#fde68a' },

  // ── Integrations ──
  webhook:          { label: 'HTTP Request',     icon: LuGlobe,        category: 'integrations', color: '#ec4899' },
  send_email:       { label: 'Send Email',       icon: LuSend,         category: 'integrations', color: '#f43f5e' },
  google_sheets:    { label: 'Google Sheets',    icon: LuSheet,        category: 'integrations', color: '#22c55e' },
  google_analytics: { label: 'Google Analytics', icon: LuChartBar,     category: 'integrations', color: '#ef4444' },
  open_ai:          { label: 'OpenAI',           icon: LuBot,          category: 'integrations', color: '#10b981' },
  zapier:           { label: 'Zapier',           icon: LuZap,          category: 'integrations', color: '#f97316' },
  make_com:         { label: 'Make',             icon: LuLayers,       category: 'integrations', color: '#6366f1' },
  pabbly_connect:   { label: 'Pabbly',           icon: LuPlug,         category: 'integrations', color: '#8b5cf6' },
  chatwoot:         { label: 'Chatwoot',         icon: LuUsers,        category: 'integrations', color: '#0ea5e9' },
  pixel:            { label: 'Pixel',            icon: LuEye,          category: 'integrations', color: '#64748b' },
  segment:          { label: 'Segment',          icon: LuActivity,     category: 'integrations', color: '#6366f1' },
  cal_com:          { label: 'Cal.com',          icon: LuCalendarDays, category: 'integrations', color: '#3b82f6' },
  nocodb:           { label: 'NocoDB',           icon: LuDatabase,     category: 'integrations', color: '#22c55e' },
  elevenlabs:       { label: 'ElevenLabs',       icon: LuVolume2,      category: 'integrations', color: '#f59e0b' },
  anthropic:        { label: 'Anthropic',        icon: LuBrain,        category: 'integrations', color: '#f97316' },
  together_ai:      { label: 'Together AI',      icon: LuCpu,          category: 'integrations', color: '#8b5cf6' },
  mistral:          { label: 'Mistral AI',       icon: LuBot,          category: 'integrations', color: '#6366f1' },

  // ── Forge (declarative) ──
  forge_notion:     { label: 'Notion',     icon: LuFileText,     category: 'forge', color: '#000000' },
  forge_airtable:   { label: 'Airtable',   icon: LuFileBox,      category: 'forge', color: '#fcb400' },
  forge_slack:      { label: 'Slack',      icon: LuMessageCircle, category: 'forge', color: '#4a154b' },
  forge_discord:    { label: 'Discord',    icon: LuShare2,       category: 'forge', color: '#5865f2' },
  forge_github:     { label: 'GitHub',     icon: LuGithub,       category: 'forge', color: '#181717' },
  forge_twilio:     { label: 'Twilio',     icon: LuPhone,        category: 'forge', color: '#f22f46' },
  forge_sendgrid:   { label: 'SendGrid',   icon: LuPaperclip,    category: 'forge', color: '#1a82e2' },
  // Generic dispatcher for app-preset JSON definitions. Per-instance brand
  // name lives in options.__label — see getBlockDisplay().
  forge_app_preset: { label: 'App preset', icon: LuPackage,      category: 'forge', color: '#64748b' },

  // ── n8n migration ports (see N8N_MIGRATION_PLAN.md) ──
  // Pilots
  forge_http_request: { label: 'HTTP Request', icon: LuGlobe,    category: 'forge', color: '#475569' },
  forge_linear:       { label: 'Linear',       icon: LuLayers,   category: 'forge', color: '#5e6ad2' },
  forge_mongodb:      { label: 'MongoDB',      icon: LuDatabase, category: 'forge', color: '#13aa52' },

  // Wave 1 — Communication
  forge_telegram:     { label: 'Telegram',     icon: LuSend,         category: 'forge', color: '#26a5e4' },
  forge_whatsapp:     { label: 'WhatsApp',     icon: LuMessageCircle, category: 'forge', color: '#25d366' },
  forge_mattermost:   { label: 'Mattermost',   icon: LuMessageCircle, category: 'forge', color: '#0072c6' },
  forge_matrix:       { label: 'Matrix',       icon: LuMessageCircle, category: 'forge', color: '#0dbd8b' },
  forge_rocketchat:   { label: 'Rocket.Chat',  icon: LuMessageCircle, category: 'forge', color: '#f5455c' },
  forge_line:         { label: 'LINE',         icon: LuMessageCircle, category: 'forge', color: '#06c755' },
  forge_messagebird:  { label: 'MessageBird',  icon: LuPhone,        category: 'forge', color: '#2481d7' },
  forge_vonage:       { label: 'Vonage',       icon: LuPhone,        category: 'forge', color: '#871fff' },
  forge_plivo:        { label: 'Plivo',        icon: LuPhone,        category: 'forge', color: '#3aa3e3' },
  forge_sms77:        { label: 'Sms77',        icon: LuPhone,        category: 'forge', color: '#0070c4' },

  // Wave 1 — CRM
  forge_hubspot:        { label: 'HubSpot',        icon: LuUsers,    category: 'forge', color: '#ff7a59' },
  forge_salesforce:     { label: 'Salesforce',     icon: LuCloud,    category: 'forge', color: '#00a1e0' },
  forge_pipedrive:      { label: 'Pipedrive',      icon: LuUsers,    category: 'forge', color: '#26292c' },
  forge_activecampaign: { label: 'ActiveCampaign', icon: LuActivity, category: 'forge', color: '#356ae6' },
  forge_copper:         { label: 'Copper',         icon: LuUsers,    category: 'forge', color: '#ff6c00' },
  forge_freshworks_crm: { label: 'Freshworks CRM', icon: LuUsers,    category: 'forge', color: '#0e9fcd' },
  forge_zoho_crm:       { label: 'Zoho CRM',       icon: LuUsers,    category: 'forge', color: '#ef4d3a' },
  forge_agile_crm:      { label: 'Agile CRM',      icon: LuUsers,    category: 'forge', color: '#1a8fff' },
  forge_customerio:     { label: 'Customer.io',    icon: LuActivity, category: 'forge', color: '#7c52ff' },
  forge_intercom:       { label: 'Intercom',       icon: LuMessageCircle, category: 'forge', color: '#0057ff' },

  // Wave 1 — Project Management
  forge_asana:       { label: 'Asana',       icon: LuSquareCheck, category: 'forge', color: '#f06a6a' },
  forge_trello:      { label: 'Trello',      icon: LuLayoutGrid,  category: 'forge', color: '#0079bf' },
  forge_clickup:     { label: 'ClickUp',     icon: LuSquareCheck, category: 'forge', color: '#7b68ee' },
  forge_monday:      { label: 'Monday.com',  icon: LuLayoutGrid,  category: 'forge', color: '#ff3d57' },
  forge_jira:        { label: 'Jira',        icon: LuSquareCheck, category: 'forge', color: '#0052cc' },
  forge_wekan:       { label: 'Wekan',       icon: LuLayoutGrid,  category: 'forge', color: '#338ed5' },
  forge_taiga:       { label: 'Taiga',       icon: LuSquareCheck, category: 'forge', color: '#83ca56' },
  forge_todoist:     { label: 'Todoist',     icon: LuSquareCheck, category: 'forge', color: '#e44332' },
  forge_servicenow:  { label: 'ServiceNow',  icon: LuSquareCheck, category: 'forge', color: '#62d84e' },
  forge_freshdesk:   { label: 'Freshdesk',   icon: LuUsers,       category: 'forge', color: '#25c16f' },

  // Wave 1 — Storage / DB
  forge_aws_s3:    { label: 'AWS S3',     icon: LuCloud,    category: 'forge', color: '#ff9900' },
  forge_dropbox:   { label: 'Dropbox',    icon: LuCloud,    category: 'forge', color: '#0061ff' },
  forge_nextcloud: { label: 'NextCloud',  icon: LuCloud,    category: 'forge', color: '#0082c9' },
  forge_box:       { label: 'Box',        icon: LuFileBox,  category: 'forge', color: '#0061d5' },
  forge_ftp:       { label: 'FTP / SFTP', icon: LuUpload,   category: 'forge', color: '#475569' },
  forge_ssh:       { label: 'SSH',        icon: LuFileCode, category: 'forge', color: '#475569' },
  forge_snowflake: { label: 'Snowflake',  icon: LuDatabase, category: 'forge', color: '#29b5e8' },
  forge_postgres:  { label: 'PostgreSQL', icon: LuDatabase, category: 'forge', color: '#336791' },
  forge_mysql:     { label: 'MySQL',      icon: LuDatabase, category: 'forge', color: '#4479a1' },
  forge_redis:     { label: 'Redis',      icon: LuDatabase, category: 'forge', color: '#dc382d' },

  // Wave 1 — Generic / Logic
  forge_webhook:      { label: 'Webhook',      icon: LuGlobe,    category: 'forge', color: '#ec4899' },
  forge_set_n8n:      { label: 'Set',          icon: LuVariable, category: 'forge', color: '#fb923c' },
  forge_if:           { label: 'If',           icon: LuGitBranch, category: 'forge', color: '#f97316' },
  forge_switch_n8n:   { label: 'Switch',       icon: LuShuffle,  category: 'forge', color: '#f97316' },
  forge_filter:       { label: 'Filter',       icon: LuFilter,   category: 'forge', color: '#fb923c' },
  forge_merge:        { label: 'Merge',        icon: LuGitMerge, category: 'forge', color: '#fb923c' },
  forge_graphql:      { label: 'GraphQL',      icon: LuGlobe,    category: 'forge', color: '#e10098' },
  forge_rename_keys:  { label: 'Rename Keys',  icon: LuVariable, category: 'forge', color: '#fb923c' },
  forge_crypto:       { label: 'Crypto',       icon: LuFileCode, category: 'forge', color: '#475569' },
  forge_code_n8n:     { label: 'Code',         icon: LuFileCode, category: 'forge', color: '#475569' },

  // Wave 2 — Email & Marketing
  forge_mailchimp:    { label: 'Mailchimp',    icon: LuMail,     category: 'forge', color: '#ffe01b' },
  forge_sendgrid_ext: { label: 'SendGrid+',    icon: LuMail,     category: 'forge', color: '#1a82e2' },
  forge_mailgun:      { label: 'Mailgun',      icon: LuMail,     category: 'forge', color: '#f0683b' },
  forge_mailjet:      { label: 'Mailjet',      icon: LuMail,     category: 'forge', color: '#f0a92c' },
  forge_mandrill:     { label: 'Mandrill',     icon: LuMail,     category: 'forge', color: '#ff6f30' },
  forge_convertkit:   { label: 'ConvertKit',   icon: LuMail,     category: 'forge', color: '#fb6970' },
  forge_getresponse:  { label: 'GetResponse',  icon: LuMail,     category: 'forge', color: '#00baff' },
  forge_brevo:        { label: 'Brevo',        icon: LuMail,     category: 'forge', color: '#0b996e' },
  forge_mailerlite:   { label: 'MailerLite',   icon: LuMail,     category: 'forge', color: '#09c269' },
  forge_vero:         { label: 'Vero',         icon: LuMail,     category: 'forge', color: '#3aaee0' },

  // Wave 3 — Commerce & Payments
  forge_shopify:      { label: 'Shopify',      icon: LuCreditCard, category: 'forge', color: '#95bf47' },
  forge_woocommerce:  { label: 'WooCommerce',  icon: LuCreditCard, category: 'forge', color: '#7f54b3' },
  forge_stripe:       { label: 'Stripe',       icon: LuCreditCard, category: 'forge', color: '#635bff' },
  forge_paddle:       { label: 'Paddle',       icon: LuCreditCard, category: 'forge', color: '#ffcd00' },
  forge_chargebee:    { label: 'Chargebee',    icon: LuCreditCard, category: 'forge', color: '#ff6c2c' },
  forge_paypal:       { label: 'PayPal',       icon: LuCreditCard, category: 'forge', color: '#0070ba' },
  forge_magento:      { label: 'Magento',      icon: LuCreditCard, category: 'forge', color: '#f26322' },
  forge_quickbooks:   { label: 'QuickBooks',   icon: LuCreditCard, category: 'forge', color: '#2ca01c' },
  forge_xero:         { label: 'Xero',         icon: LuCreditCard, category: 'forge', color: '#13b5ea' },
  forge_invoiceninja: { label: 'Invoice Ninja', icon: LuCreditCard, category: 'forge', color: '#3e8e6a' },

  // Wave 4 — DevOps & Git
  forge_gitlab:       { label: 'GitLab',       icon: LuGithub,   category: 'forge', color: '#fc6d26' },
  forge_bitbucket:    { label: 'Bitbucket',    icon: LuGithub,   category: 'forge', color: '#2684ff' },
  forge_jenkins:      { label: 'Jenkins',      icon: LuPlay,     category: 'forge', color: '#d24939' },
  forge_circleci:     { label: 'CircleCI',     icon: LuPlay,     category: 'forge', color: '#161616' },
  forge_travisci:     { label: 'Travis CI',    icon: LuPlay,     category: 'forge', color: '#3eaaaf' },
  forge_aws_lambda:   { label: 'AWS Lambda',   icon: LuCloud,    category: 'forge', color: '#ff9900' },
  forge_cloudflare:   { label: 'Cloudflare',   icon: LuCloud,    category: 'forge', color: '#f48120' },
  forge_netlify:      { label: 'Netlify',      icon: LuCloud,    category: 'forge', color: '#00c7b7' },
  forge_git:          { label: 'Git',          icon: LuGitBranch, category: 'forge', color: '#f05032' },
  forge_postbin:      { label: 'PostBin',      icon: LuGlobe,    category: 'forge', color: '#475569' },

  // Wave 5 — Docs & Productivity
  forge_coda:               { label: 'Coda',           icon: LuFileText, category: 'forge', color: '#f46a54' },
  forge_google_sheets_ext:  { label: 'Google Sheets+', icon: LuSheet,    category: 'forge', color: '#0f9d58' },
  forge_nocodb_ext:         { label: 'NocoDB+',        icon: LuDatabase, category: 'forge', color: '#1f6feb' },
  forge_baserow:            { label: 'Baserow',        icon: LuDatabase, category: 'forge', color: '#5190ff' },
  forge_grist:              { label: 'Grist',          icon: LuDatabase, category: 'forge', color: '#16b378' },
  forge_stackby:            { label: 'Stackby',        icon: LuDatabase, category: 'forge', color: '#1d6bcb' },
  forge_seatable:           { label: 'SeaTable',       icon: LuDatabase, category: 'forge', color: '#fa743e' },
  forge_strapi:             { label: 'Strapi',         icon: LuDatabase, category: 'forge', color: '#4945ff' },
  forge_ghost:              { label: 'Ghost',          icon: LuFileText, category: 'forge', color: '#212121' },
  forge_wordpress:          { label: 'WordPress',      icon: LuFileText, category: 'forge', color: '#21759b' },

  // Wave 6 — Monitoring & Support
  forge_sentry_io:    { label: 'Sentry',       icon: LuActivity, category: 'forge', color: '#362d59' },
  forge_pagerduty:    { label: 'PagerDuty',    icon: LuActivity, category: 'forge', color: '#06ac38' },
  forge_grafana:      { label: 'Grafana',      icon: LuChartBar, category: 'forge', color: '#f46800' },
  forge_helpscout:    { label: 'Help Scout',   icon: LuUsers,    category: 'forge', color: '#1292ee' },
  forge_zendesk:      { label: 'Zendesk',      icon: LuUsers,    category: 'forge', color: '#03363d' },
  forge_zammad:       { label: 'Zammad',       icon: LuUsers,    category: 'forge', color: '#ff9a00' },
  forge_deepl:        { label: 'DeepL',        icon: LuType,     category: 'forge', color: '#0f2b46' },
  forge_reddit:       { label: 'Reddit',       icon: LuMessageCircle, category: 'forge', color: '#ff4500' },
  forge_discourse:    { label: 'Discourse',    icon: LuMessageCircle, category: 'forge', color: '#000000' },
  forge_hackernews:   { label: 'Hacker News',  icon: LuFileText, category: 'forge', color: '#ff6600' },

  // Wave 7 — AI & ML
  forge_ai_transform:    { label: 'AI Transform',    icon: LuBrain,    category: 'forge', color: '#10b981' },
  forge_openai_ext:      { label: 'OpenAI+',         icon: LuBot,      category: 'forge', color: '#10a37f' },
  forge_mistral_ext:     { label: 'Mistral+',        icon: LuBot,      category: 'forge', color: '#fa520f' },
  forge_perplexity_ext:  { label: 'Perplexity+',     icon: LuBrain,    category: 'forge', color: '#1a73e8' },
  forge_humantic_ai:     { label: 'Humantic AI',     icon: LuBrain,    category: 'forge', color: '#3b82f6' },
  forge_mindee:          { label: 'Mindee',          icon: LuFileText, category: 'forge', color: '#7c3aed' },
  forge_jina_ai:         { label: 'Jina AI',         icon: LuBrain,    category: 'forge', color: '#009191' },
  forge_lingvanex:       { label: 'LingvaNex',       icon: LuType,     category: 'forge', color: '#22c55e' },
  forge_cortex:          { label: 'Cortex',          icon: LuActivity, category: 'forge', color: '#ef4444' },
  forge_airtop:          { label: 'Airtop',          icon: LuEye,      category: 'forge', color: '#0ea5e9' },

  // Wave 8 — Marketing & Analytics
  forge_mautic:          { label: 'Mautic',          icon: LuActivity, category: 'forge', color: '#4e5e9e' },
  forge_egoi:            { label: 'E-goi',           icon: LuMail,     category: 'forge', color: '#1f4e8c' },
  forge_iterable:        { label: 'Iterable',        icon: LuActivity, category: 'forge', color: '#1976d2' },
  forge_hunter:          { label: 'Hunter',          icon: LuMail,     category: 'forge', color: '#fdb813' },
  forge_phantombuster:   { label: 'PhantomBuster',   icon: LuActivity, category: 'forge', color: '#7b61ff' },
  forge_posthog:         { label: 'PostHog',         icon: LuChartBar, category: 'forge', color: '#f54e00' },
  forge_segment:         { label: 'Segment',         icon: LuActivity, category: 'forge', color: '#52bd95' },
  forge_clearbit:        { label: 'Clearbit',        icon: LuUsers,    category: 'forge', color: '#16324f' },
  forge_profitwell:      { label: 'ProfitWell',      icon: LuChartBar, category: 'forge', color: '#0288d1' },
  forge_tapfiliate:      { label: 'Tapfiliate',      icon: LuUsers,    category: 'forge', color: '#5a3ec9' },

  // Wave 9 — CRM Extensions
  forge_keap:                    { label: 'Keap',                  icon: LuUsers,    category: 'forge', color: '#1c8d3e' },
  forge_monica_crm:              { label: 'Monica CRM',            icon: LuUsers,    category: 'forge', color: '#3490dc' },
  forge_drift:                   { label: 'Drift',                 icon: LuMessageCircle, category: 'forge', color: '#3f70d6' },
  forge_demio:                   { label: 'Demio',                 icon: LuCalendarDays, category: 'forge', color: '#0fb6f3' },
  forge_salesmate:               { label: 'Salesmate',             icon: LuUsers,    category: 'forge', color: '#3f51b5' },
  forge_syncro_msp:              { label: 'Syncro MSP',            icon: LuActivity, category: 'forge', color: '#00afef' },
  forge_highlevel:               { label: 'HighLevel',             icon: LuUsers,    category: 'forge', color: '#0c1a2a' },
  forge_microsoft_dynamics_crm:  { label: 'Dynamics CRM',          icon: LuUsers,    category: 'forge', color: '#0078d4' },
  forge_affinity:                { label: 'Affinity',              icon: LuUsers,    category: 'forge', color: '#2945cd' },
  forge_erpnext:                 { label: 'ERPNext',               icon: LuLayoutGrid, category: 'forge', color: '#2b5b8e' },

  // Wave 10 — Social & CMS
  forge_bitly:           { label: 'Bitly',          icon: LuLink,     category: 'forge', color: '#ee6123' },
  forge_twitter:         { label: 'X / Twitter',    icon: LuMessageCircle, category: 'forge', color: '#000000' },
  forge_yourls:          { label: 'YOURLS',         icon: LuLink,     category: 'forge', color: '#86bd25' },
  forge_storyblok:       { label: 'Storyblok',      icon: LuFileText, category: 'forge', color: '#09b3af' },
  forge_webflow:         { label: 'Webflow',        icon: LuFileText, category: 'forge', color: '#4353ff' },
  forge_medium:          { label: 'Medium',         icon: LuFileText, category: 'forge', color: '#12100e' },
  forge_disqus:          { label: 'Disqus',         icon: LuMessageCircle, category: 'forge', color: '#2e9fff' },
  forge_linkedin:        { label: 'LinkedIn',       icon: LuShare2,   category: 'forge', color: '#0a66c2' },
  forge_rss_feed_read:   { label: 'RSS Feed',       icon: LuActivity, category: 'forge', color: '#f26522' },
  forge_markdown:        { label: 'Markdown',       icon: LuFileText, category: 'forge', color: '#475569' },

  // Wave 11 — Tools & Utilities
  forge_bannerbear:      { label: 'Bannerbear',     icon: LuImage,    category: 'forge', color: '#fdb338' },
  forge_brandfetch:      { label: 'Brandfetch',     icon: LuImage,    category: 'forge', color: '#1c1c1c' },
  forge_quickchart:      { label: 'QuickChart',     icon: LuChartBar, category: 'forge', color: '#3b82f6' },
  forge_apitemplate_io:  { label: 'APITemplate.io', icon: LuFileText, category: 'forge', color: '#ff3366' },
  forge_peekalink:       { label: 'Peekalink',      icon: LuLink,     category: 'forge', color: '#06b6d4' },
  forge_kobotoolbox:     { label: 'KoBoToolbox',    icon: LuLayoutGrid, category: 'forge', color: '#5a6679' },
  forge_onesimpleapi:    { label: 'One Simple API', icon: LuGlobe,    category: 'forge', color: '#475569' },
  forge_html:            { label: 'HTML',           icon: LuFileCode, category: 'forge', color: '#e44d26' },
  forge_xml:             { label: 'XML',            icon: LuFileCode, category: 'forge', color: '#0060a8' },
  forge_datetime:        { label: 'DateTime',       icon: LuCalendar, category: 'forge', color: '#fb923c' },

  // Wave 12 — Misc & Long Tail
  forge_openweathermap:  { label: 'OpenWeatherMap', icon: LuCloud,    category: 'forge', color: '#eb6e4b' },
  forge_coingecko:       { label: 'CoinGecko',      icon: LuChartBar, category: 'forge', color: '#8dc63f' },
  forge_urlscanio:       { label: 'URLScan.io',     icon: LuGlobe,    category: 'forge', color: '#0d6efd' },
  forge_marketstack:     { label: 'Marketstack',    icon: LuChartBar, category: 'forge', color: '#41b883' },
  forge_openthesaurus:   { label: 'OpenThesaurus',  icon: LuType,     category: 'forge', color: '#0e7490' },
  forge_nasa:            { label: 'NASA',           icon: LuStar,     category: 'forge', color: '#0b3d91' },
  forge_strava:          { label: 'Strava',         icon: LuActivity, category: 'forge', color: '#fc4c02' },
  forge_oura:            { label: 'Oura',           icon: LuActivity, category: 'forge', color: '#000000' },
  forge_spotify:         { label: 'Spotify',        icon: LuVolume2,  category: 'forge', color: '#1db954' },
  forge_zoom:            { label: 'Zoom',           icon: LuVideo,    category: 'forge', color: '#2d8cff' },

  // Wave 13 — Email/Marketing extras
  forge_lemlist:         { label: 'Lemlist',        icon: LuMail,     category: 'forge', color: '#ff6b6b' },
  forge_mailcheck:       { label: 'Mailcheck',      icon: LuMail,     category: 'forge', color: '#3b82f6' },
  forge_dropcontact:     { label: 'Dropcontact',    icon: LuUsers,    category: 'forge', color: '#06b6d4' },
  forge_sendy:           { label: 'Sendy',          icon: LuMail,     category: 'forge', color: '#1d4ed8' },
  forge_emelia:          { label: 'Emelia',         icon: LuMail,     category: 'forge', color: '#7c3aed' },
  forge_lonescale:       { label: 'LoneScale',      icon: LuUsers,    category: 'forge', color: '#0ea5e9' },
  forge_autopilot:       { label: 'Autopilot',      icon: LuActivity, category: 'forge', color: '#1f2937' },
  forge_action_network:  { label: 'Action Network', icon: LuUsers,    category: 'forge', color: '#dc2626' },
  forge_currents:        { label: 'Currents',       icon: LuActivity, category: 'forge', color: '#f59e0b' },
  forge_bubble:          { label: 'Bubble',         icon: LuDatabase, category: 'forge', color: '#0e83cd' },

  // Wave 14 — HR/Time/Productivity
  forge_bamboohr:        { label: 'BambooHR',       icon: LuUsers,    category: 'forge', color: '#71b352' },
  forge_clockify:        { label: 'Clockify',       icon: LuClock,    category: 'forge', color: '#03a9f4' },
  forge_harvest:         { label: 'Harvest',        icon: LuClock,    category: 'forge', color: '#ff7f00' },
  forge_gotowebinar:     { label: 'GoToWebinar',    icon: LuVideo,    category: 'forge', color: '#fb6532' },
  forge_gong:            { label: 'Gong',           icon: LuActivity, category: 'forge', color: '#8b5cf6' },
  forge_freshservice:    { label: 'Freshservice',   icon: LuUsers,    category: 'forge', color: '#25c16f' },
  forge_halopsa:         { label: 'HaloPSA',        icon: LuActivity, category: 'forge', color: '#1d4ed8' },
  forge_adalo:           { label: 'Adalo',          icon: LuLayoutGrid, category: 'forge', color: '#7d4cf2' },
  forge_onfleet:         { label: 'Onfleet',        icon: LuActivity, category: 'forge', color: '#ff6b00' },
  forge_twist:           { label: 'Twist',          icon: LuMessageCircle, category: 'forge', color: '#1976d2' },

  // Wave 15 — Comms/Messaging extras
  forge_twake:           { label: 'Twake',          icon: LuMessageCircle, category: 'forge', color: '#7c3aed' },
  forge_zulip:           { label: 'Zulip',          icon: LuMessageCircle, category: 'forge', color: '#52c41a' },
  forge_gotify:          { label: 'Gotify',         icon: LuActivity, category: 'forge', color: '#3b82f6' },
  forge_pushbullet:      { label: 'Pushbullet',     icon: LuPhone,    category: 'forge', color: '#4cb050' },
  forge_pushcut:         { label: 'Pushcut',        icon: LuPhone,    category: 'forge', color: '#fbbf24' },
  forge_pushover:        { label: 'Pushover',       icon: LuPhone,    category: 'forge', color: '#249df1' },
  forge_mocean:          { label: 'Mocean',         icon: LuPhone,    category: 'forge', color: '#0ea5e9' },
  forge_msg91:           { label: 'Msg91',          icon: LuPhone,    category: 'forge', color: '#1976d2' },
  forge_signl4:          { label: 'SIGNL4',         icon: LuActivity, category: 'forge', color: '#ee5a24' },
  forge_facebook:        { label: 'Facebook',       icon: LuShare2,   category: 'forge', color: '#1877f2' },

  // Wave 16 — DB/Infrastructure
  forge_questdb:         { label: 'QuestDB',        icon: LuDatabase, category: 'forge', color: '#d14671' },
  forge_cratedb:         { label: 'CrateDB',        icon: LuDatabase, category: 'forge', color: '#3a4f78' },
  forge_timescaledb:     { label: 'TimescaleDB',    icon: LuDatabase, category: 'forge', color: '#fdb515' },
  forge_oracle:          { label: 'Oracle SQL',     icon: LuDatabase, category: 'forge', color: '#f80000' },
  forge_kafka:           { label: 'Kafka',          icon: LuLayers,   category: 'forge', color: '#231f20' },
  forge_rabbitmq:        { label: 'RabbitMQ',       icon: LuLayers,   category: 'forge', color: '#ff6600' },
  forge_mqtt:            { label: 'MQTT',           icon: LuLayers,   category: 'forge', color: '#660066' },
  forge_amqp:            { label: 'AMQP',           icon: LuLayers,   category: 'forge', color: '#0078d4' },
  forge_ldap:            { label: 'LDAP',           icon: LuUsers,    category: 'forge', color: '#475569' },
  forge_supabase:        { label: 'Supabase',       icon: LuDatabase, category: 'forge', color: '#3ecf8e' },

  // Wave 17 — Security/Monitoring
  forge_bitwarden:           { label: 'Bitwarden',     icon: LuKey,      category: 'forge', color: '#175ddc' },
  forge_elastic_security:    { label: 'Elastic Sec',   icon: LuActivity, category: 'forge', color: '#00bfb3' },
  forge_misp:                { label: 'MISP',          icon: LuActivity, category: 'forge', color: '#2e3a8f' },
  forge_thehive:             { label: 'TheHive',       icon: LuActivity, category: 'forge', color: '#f57c00' },
  forge_security_scorecard:  { label: 'SecScorecard',  icon: LuChartBar, category: 'forge', color: '#1e40af' },
  forge_venafi:              { label: 'Venafi',        icon: LuKey,      category: 'forge', color: '#00a651' },
  forge_netscaler:           { label: 'Netscaler',     icon: LuActivity, category: 'forge', color: '#0091ea' },
  forge_okta:                { label: 'Okta',          icon: LuUsers,    category: 'forge', color: '#007dc1' },
  forge_totp:                { label: 'TOTP',          icon: LuKey,      category: 'forge', color: '#475569' },
  forge_jwt:                 { label: 'JWT',           icon: LuKey,      category: 'forge', color: '#000000' },

  // Wave 18 — Specialty/IoT
  forge_philips_hue:     { label: 'Philips Hue',    icon: LuActivity, category: 'forge', color: '#005bd0' },
  forge_home_assistant:  { label: 'Home Assistant', icon: LuActivity, category: 'forge', color: '#41bdf5' },
  forge_filemaker:       { label: 'FileMaker',      icon: LuDatabase, category: 'forge', color: '#888888' },
  forge_dhl:             { label: 'DHL',            icon: LuPlay,     category: 'forge', color: '#ffcc00' },
  forge_cisco_webex:     { label: 'Cisco Webex',    icon: LuVideo,    category: 'forge', color: '#049fd9' },
  forge_cockpit:         { label: 'Cockpit',        icon: LuFileText, category: 'forge', color: '#0f5959' },
  forge_rundeck:         { label: 'Rundeck',        icon: LuPlay,     category: 'forge', color: '#f15852' },
  forge_splunk:          { label: 'Splunk',         icon: LuChartBar, category: 'forge', color: '#65a637' },
  forge_contentful:      { label: 'Contentful',     icon: LuFileText, category: 'forge', color: '#2478cc' },
  forge_metabase:        { label: 'Metabase',       icon: LuChartBar, category: 'forge', color: '#509ee3' },

  // Wave 19 — Misc utilities
  forge_uproc:               { label: 'uProc',          icon: LuActivity, category: 'forge', color: '#475569' },
  forge_unleashed_software:  { label: 'Unleashed',      icon: LuLayers,   category: 'forge', color: '#1f6bbb' },
  forge_uplead:              { label: 'UpLead',         icon: LuUsers,    category: 'forge', color: '#00aae4' },
  forge_orbit:               { label: 'Orbit',          icon: LuActivity, category: 'forge', color: '#ec4899' },
  forge_raindrop:            { label: 'Raindrop',       icon: LuLayers,   category: 'forge', color: '#0b7dda' },
  forge_quickbase:           { label: 'QuickBase',      icon: LuDatabase, category: 'forge', color: '#e2231a' },
  forge_wise:                { label: 'Wise',           icon: LuCreditCard, category: 'forge', color: '#9fe870' },
  forge_uptimerobot:         { label: 'UptimeRobot',    icon: LuActivity, category: 'forge', color: '#3bb24a' },
  forge_htmlextract:         { label: 'HTML Extract',   icon: LuFileCode, category: 'forge', color: '#e44d26' },
  forge_read_pdf:            { label: 'Read PDF',       icon: LuFileText, category: 'forge', color: '#dc2626' },

  // Wave 20 — Final closers
  forge_beeminder:           { label: 'Beeminder',      icon: LuActivity, category: 'forge', color: '#fdcd45' },
  forge_npm:                 { label: 'NPM',            icon: LuFileBox,  category: 'forge', color: '#cb3837' },
  forge_google_ads:          { label: 'Google Ads',     icon: LuChartBar, category: 'forge', color: '#4285f4' },
  forge_edit_image:          { label: 'Edit Image',     icon: LuImage,    category: 'forge', color: '#475569' },
  forge_icalendar:           { label: 'iCalendar',      icon: LuCalendar, category: 'forge', color: '#dc2626' },
  forge_flow:                { label: 'Flow',           icon: LuLayoutGrid, category: 'forge', color: '#5a3ec9' },
  forge_send_email_n8n:      { label: 'Send Email',     icon: LuMail,     category: 'forge', color: '#475569' },
  forge_n8n_api:             { label: 'SabFlow API',    icon: LuGitBranch, category: 'forge', color: '#ea4b71' },
  forge_compression:         { label: 'Compression',    icon: LuFileBox,  category: 'forge', color: '#475569' },
  forge_wait_n8n:            { label: 'Wait',           icon: LuTimer,    category: 'forge', color: '#fcd34d' },

  // Wave 21 — Triggers-as-actions
  forge_cron_n8n:             { label: 'Cron',              icon: LuClock,    category: 'forge', color: '#fb923c' },
  forge_interval_n8n:         { label: 'Interval',          icon: LuTimer,    category: 'forge', color: '#fbbf24' },
  forge_manual_trigger:       { label: 'Manual Trigger',    icon: LuPlay,     category: 'forge', color: '#475569' },
  forge_n8n_trigger:          { label: 'SabFlow Trigger',   icon: LuActivity, category: 'forge', color: '#ea4b71' },
  forge_workflow_trigger:     { label: 'Workflow Trigger',  icon: LuActivity, category: 'forge', color: '#475569' },
  forge_error_trigger:        { label: 'Error Trigger',     icon: LuActivity, category: 'forge', color: '#dc2626' },
  forge_sse_trigger:          { label: 'SSE Trigger',       icon: LuActivity, category: 'forge', color: '#0ea5e9' },
  forge_email_read_imap:      { label: 'Email IMAP',        icon: LuMail,     category: 'forge', color: '#3b82f6' },
  forge_local_file_trigger:   { label: 'Local File',        icon: LuFileText, category: 'forge', color: '#475569' },
  forge_respond_to_webhook:   { label: 'Respond Webhook',   icon: LuGlobe,    category: 'forge', color: '#ec4899' },

  // Wave 22 — n8n internals
  forge_no_op:                { label: 'No Op',             icon: LuArrowLeft, category: 'forge', color: '#475569' },
  forge_sticky_note:          { label: 'Sticky Note',       icon: LuFileText, category: 'forge', color: '#fde68a' },
  forge_form_n8n:             { label: 'Form (Legacy)',     icon: LuSquareCheck, category: 'forge', color: '#475569' },
  forge_debug_helper:         { label: 'Debug Helper',      icon: LuActivity, category: 'forge', color: '#475569' },
  forge_execute_command:      { label: 'Execute Command',   icon: LuFileCode, category: 'forge', color: '#dc2626' },
  forge_execute_workflow:     { label: 'Execute Workflow',  icon: LuPlay,     category: 'forge', color: '#475569' },
  forge_execution_data:       { label: 'Execution Data',    icon: LuActivity, category: 'forge', color: '#475569' },
  forge_move_binary_data:     { label: 'Move Binary Data',  icon: LuFileBox,  category: 'forge', color: '#475569' },
  forge_split_in_batches:     { label: 'Split in Batches',  icon: LuSplit,    category: 'forge', color: '#fb923c' },
  forge_transform_sort:       { label: 'Sort',              icon: LuArrowDownWideNarrow, category: 'forge', color: '#fb923c' },

  // Wave 23 — Binary/file ops
  forge_read_binary_file:        { label: 'Read Binary',     icon: LuFileBox,  category: 'forge', color: '#475569' },
  forge_read_binary_files:       { label: 'Read Binaries',   icon: LuFileBox,  category: 'forge', color: '#475569' },
  forge_write_binary_file:       { label: 'Write Binary',    icon: LuFileBox,  category: 'forge', color: '#475569' },
  forge_read_write_file:         { label: 'Read/Write File', icon: LuFileBox,  category: 'forge', color: '#475569' },
  forge_spreadsheet_file:        { label: 'Spreadsheet',     icon: LuSheet,    category: 'forge', color: '#22c55e' },
  forge_simulate:                { label: 'Simulate',        icon: LuFlaskConical, category: 'forge', color: '#a855f7' },
  forge_e2e_test:                { label: 'E2E Test',        icon: LuFlaskConical, category: 'forge', color: '#a855f7' },
  forge_time_saved:              { label: 'Time Saved',      icon: LuTimer,    category: 'forge', color: '#10b981' },
  forge_dynamic_credential_check:{ label: 'Cred Check',      icon: LuKey,      category: 'forge', color: '#475569' },
  forge_data_table:              { label: 'Data Table',      icon: LuVariable, category: 'forge', color: '#fb923c' },

  // Wave 24 — Deprecated / training
  forge_compare_datasets:        { label: 'Compare Datasets',  icon: LuLayers,   category: 'forge', color: '#475569' },
  forge_evaluation:              { label: 'Evaluation',        icon: LuFlaskConical, category: 'forge', color: '#a855f7' },
  forge_function_legacy:         { label: 'Function (legacy)', icon: LuFileCode, category: 'forge', color: '#475569' },
  forge_function_item_legacy:    { label: 'FunctionItem',      icon: LuFileCode, category: 'forge', color: '#475569' },
  forge_training_datastore:      { label: 'Training Data',     icon: LuDatabase, category: 'forge', color: '#475569' },
  forge_training_messenger:      { label: 'Training Msg',      icon: LuMessageCircle, category: 'forge', color: '#475569' },
  forge_thehive_project:         { label: 'TheHive v5',        icon: LuActivity, category: 'forge', color: '#f57c00' },
  forge_stop_and_error:          { label: 'Stop & Error',      icon: LuActivity, category: 'forge', color: '#dc2626' },
  forge_ai_transform_v1:         { label: 'AI Transform v1',   icon: LuBrain,    category: 'forge', color: '#475569' },
  forge_legacy_variants_info:    { label: 'Legacy Variants',   icon: LuFileText, category: 'forge', color: '#475569' },

  // Wave 25 — AWS family
  forge_aws_dynamodb:        { label: 'AWS DynamoDB',     icon: LuDatabase, category: 'forge', color: '#ff9900' },
  forge_aws_ses:             { label: 'AWS SES',          icon: LuMail,     category: 'forge', color: '#ff9900' },
  forge_aws_sqs:             { label: 'AWS SQS',          icon: LuLayers,   category: 'forge', color: '#ff9900' },
  forge_aws_cognito:         { label: 'AWS Cognito',      icon: LuUsers,    category: 'forge', color: '#ff9900' },
  forge_aws_comprehend:      { label: 'AWS Comprehend',   icon: LuBrain,    category: 'forge', color: '#ff9900' },
  forge_aws_rekognition:     { label: 'AWS Rekognition',  icon: LuEye,      category: 'forge', color: '#ff9900' },
  forge_aws_textract:        { label: 'AWS Textract',     icon: LuFileText, category: 'forge', color: '#ff9900' },
  forge_aws_transcribe:      { label: 'AWS Transcribe',   icon: LuMic,      category: 'forge', color: '#ff9900' },
  forge_aws_cert_manager:    { label: 'AWS ACM',          icon: LuKey,      category: 'forge', color: '#ff9900' },
  forge_aws_iam:             { label: 'AWS IAM',          icon: LuKey,      category: 'forge', color: '#ff9900' },

  // Wave 26 — Google family A
  forge_google_drive:        { label: 'Google Drive',     icon: LuFileBox,  category: 'forge', color: '#4285f4' },
  forge_gmail:               { label: 'Gmail',            icon: LuMail,     category: 'forge', color: '#ea4335' },
  forge_google_calendar:     { label: 'Google Calendar',  icon: LuCalendarDays, category: 'forge', color: '#4285f4' },
  forge_google_contacts:     { label: 'Google Contacts',  icon: LuUsers,    category: 'forge', color: '#4285f4' },
  forge_google_docs:         { label: 'Google Docs',      icon: LuFileText, category: 'forge', color: '#4285f4' },
  forge_google_slides:       { label: 'Google Slides',    icon: LuFileText, category: 'forge', color: '#fbbc04' },
  forge_google_tasks:        { label: 'Google Tasks',     icon: LuSquareCheck, category: 'forge', color: '#4285f4' },
  forge_google_translate:    { label: 'Google Translate', icon: LuType,     category: 'forge', color: '#4285f4' },
  forge_youtube:             { label: 'YouTube',          icon: LuVideo,    category: 'forge', color: '#ff0000' },
  forge_google_analytics:    { label: 'Google Analytics', icon: LuChartBar, category: 'forge', color: '#e8710a' },

  // Wave 27 — Google B + Microsoft
  forge_google_bigquery:        { label: 'BigQuery',       icon: LuDatabase, category: 'forge', color: '#4285f4' },
  forge_google_chat:            { label: 'Google Chat',    icon: LuMessageCircle, category: 'forge', color: '#34a853' },
  forge_google_cloud_storage:   { label: 'GCS',            icon: LuCloud,    category: 'forge', color: '#4285f4' },
  forge_google_firestore:       { label: 'Firestore',      icon: LuDatabase, category: 'forge', color: '#ffa000' },
  forge_microsoft_excel:        { label: 'MS Excel',       icon: LuSheet,    category: 'forge', color: '#107c41' },
  forge_microsoft_onedrive:     { label: 'OneDrive',       icon: LuCloud,    category: 'forge', color: '#0078d4' },
  forge_microsoft_outlook:      { label: 'Outlook',        icon: LuMail,     category: 'forge', color: '#0078d4' },
  forge_microsoft_teams_full:   { label: 'MS Teams (full)', icon: LuMessageCircle, category: 'forge', color: '#6264a7' },
  forge_microsoft_sharepoint:   { label: 'SharePoint',     icon: LuFileText, category: 'forge', color: '#038387' },
  forge_microsoft_todo:         { label: 'MS ToDo',        icon: LuSquareCheck, category: 'forge', color: '#0078d4' },

  // Wave 28 — Transform / utility
  forge_aggregate:           { label: 'Aggregate',        icon: LuArrowDownWideNarrow, category: 'forge', color: '#fb923c' },
  forge_limit:               { label: 'Limit',            icon: LuFilter,   category: 'forge', color: '#fb923c' },
  forge_remove_duplicates:   { label: 'Remove Dup.',      icon: LuFilter,   category: 'forge', color: '#fb923c' },
  forge_split_out:           { label: 'Split Out',        icon: LuSplit,    category: 'forge', color: '#fb923c' },
  forge_summarize:           { label: 'Summarize',        icon: LuArrowDownWideNarrow, category: 'forge', color: '#fb923c' },
  forge_convert_to_file:     { label: 'To File',          icon: LuFileBox,  category: 'forge', color: '#475569' },
  forge_extract_from_file:   { label: 'From File',        icon: LuFileBox,  category: 'forge', color: '#475569' },
  forge_schedule_trigger:    { label: 'Schedule Info',    icon: LuClock,    category: 'forge', color: '#fbbf24' },
  forge_elasticsearch:       { label: 'Elasticsearch',    icon: LuDatabase, category: 'forge', color: '#00bfb3' },
  forge_venafi_cloud:        { label: 'Venafi Cloud',     icon: LuKey,      category: 'forge', color: '#00a651' },

  // Wave 29 — LangChain LLMs
  forge_lm_chat_anthropic:      { label: 'LM: Anthropic',    icon: LuBrain,    category: 'forge', color: '#d97757' },
  forge_lm_chat_openai:         { label: 'LM: OpenAI',       icon: LuBot,      category: 'forge', color: '#10a37f' },
  forge_lm_chat_ollama:         { label: 'LM: Ollama',       icon: LuBot,      category: 'forge', color: '#475569' },
  forge_lm_chat_bedrock:        { label: 'LM: Bedrock',      icon: LuBot,      category: 'forge', color: '#ff9900' },
  forge_lm_chat_azure_openai:   { label: 'LM: Azure OAI',    icon: LuBot,      category: 'forge', color: '#0078d4' },
  forge_lm_chat_gemini:         { label: 'LM: Gemini',       icon: LuBrain,    category: 'forge', color: '#1a73e8' },
  forge_lm_chat_groq:           { label: 'LM: Groq',         icon: LuBot,      category: 'forge', color: '#f55036' },
  forge_lm_chat_mistral:        { label: 'LM: Mistral',      icon: LuBot,      category: 'forge', color: '#fa520f' },
  forge_lm_cohere:              { label: 'LM: Cohere',       icon: LuBot,      category: 'forge', color: '#bb6bd9' },
  forge_lm_chat_alibaba:        { label: 'LM: Alibaba',      icon: LuBot,      category: 'forge', color: '#ff6a00' },

  // Wave 30 — LangChain Embeddings + Rerank
  forge_embeddings_openai:        { label: 'Emb: OpenAI',     icon: LuBrain, category: 'forge', color: '#10a37f' },
  forge_embeddings_cohere:        { label: 'Emb: Cohere',     icon: LuBrain, category: 'forge', color: '#bb6bd9' },
  forge_embeddings_mistral:       { label: 'Emb: Mistral',    icon: LuBrain, category: 'forge', color: '#fa520f' },
  forge_embeddings_ollama:        { label: 'Emb: Ollama',     icon: LuBrain, category: 'forge', color: '#475569' },
  forge_embeddings_gemini:        { label: 'Emb: Gemini',     icon: LuBrain, category: 'forge', color: '#1a73e8' },
  forge_embeddings_vertex:        { label: 'Emb: Vertex',     icon: LuBrain, category: 'forge', color: '#4285f4' },
  forge_embeddings_bedrock:       { label: 'Emb: Bedrock',    icon: LuBrain, category: 'forge', color: '#ff9900' },
  forge_embeddings_azure_openai:  { label: 'Emb: Azure OAI',  icon: LuBrain, category: 'forge', color: '#0078d4' },
  forge_embeddings_huggingface:   { label: 'Emb: HuggingFace', icon: LuBrain, category: 'forge', color: '#fff060' },
  forge_cohere_rerank:            { label: 'Cohere Rerank',   icon: LuArrowDownWideNarrow, category: 'forge', color: '#bb6bd9' },

  // Wave 31 — LangChain Vector Stores
  forge_vector_pinecone:        { label: 'Vec: Pinecone',  icon: LuDatabase, category: 'forge', color: '#00d1b2' },
  forge_vector_qdrant:          { label: 'Vec: Qdrant',    icon: LuDatabase, category: 'forge', color: '#a30084' },
  forge_vector_weaviate:        { label: 'Vec: Weaviate',  icon: LuDatabase, category: 'forge', color: '#27c4cb' },
  forge_vector_milvus:          { label: 'Vec: Milvus',    icon: LuDatabase, category: 'forge', color: '#0d8aff' },
  forge_vector_pgvector:        { label: 'Vec: pgvector',  icon: LuDatabase, category: 'forge', color: '#336791' },
  forge_vector_supabase:        { label: 'Vec: Supabase',  icon: LuDatabase, category: 'forge', color: '#3ecf8e' },
  forge_vector_redis:           { label: 'Vec: Redis',     icon: LuDatabase, category: 'forge', color: '#dc382d' },
  forge_vector_mongo:           { label: 'Vec: Mongo',     icon: LuDatabase, category: 'forge', color: '#13aa52' },
  forge_vector_chroma:          { label: 'Vec: Chroma',    icon: LuDatabase, category: 'forge', color: '#475569' },
  forge_vector_in_memory:       { label: 'Vec: In-Memory', icon: LuDatabase, category: 'forge', color: '#475569' },

  // Wave 32 — LangChain Agents/Chains/Tools
  forge_lc_agent:                   { label: 'LC: Agent',         icon: LuBrain,   category: 'forge', color: '#10b981' },
  forge_lc_openai_assistant:        { label: 'LC: OAI Asst',      icon: LuBot,     category: 'forge', color: '#10a37f' },
  forge_lc_chain_llm:               { label: 'LC: Chain LLM',     icon: LuBrain,   category: 'forge', color: '#a855f7' },
  forge_lc_chain_retrieval_qa:      { label: 'LC: Retrieval QA',  icon: LuBrain,   category: 'forge', color: '#a855f7' },
  forge_lc_chain_summarization:     { label: 'LC: Summarize',     icon: LuBrain,   category: 'forge', color: '#a855f7' },
  forge_lc_information_extractor:   { label: 'LC: Extract',       icon: LuFileText, category: 'forge', color: '#a855f7' },
  forge_lc_sentiment:               { label: 'LC: Sentiment',     icon: LuActivity, category: 'forge', color: '#a855f7' },
  forge_lc_text_classifier:         { label: 'LC: Classifier',    icon: LuLayers,   category: 'forge', color: '#a855f7' },
  forge_lc_tool_executor:           { label: 'LC: Tool Exec',     icon: LuPlay,     category: 'forge', color: '#a855f7' },
  forge_lc_output_parser_json:      { label: 'LC: JSON Parse',    icon: LuFileCode, category: 'forge', color: '#a855f7' },

  // Wave 33 — LangChain Memory
  forge_mem_motorhead:       { label: 'Mem: Motorhead',   icon: LuDatabase, category: 'forge', color: '#a855f7' },
  forge_mem_mongo:           { label: 'Mem: Mongo',       icon: LuDatabase, category: 'forge', color: '#a855f7' },
  forge_mem_redis:           { label: 'Mem: Redis',       icon: LuDatabase, category: 'forge', color: '#a855f7' },
  forge_mem_xata:            { label: 'Mem: Xata',        icon: LuDatabase, category: 'forge', color: '#a855f7' },
  forge_mem_zep:             { label: 'Mem: Zep',         icon: LuDatabase, category: 'forge', color: '#a855f7' },
  forge_mem_postgres:        { label: 'Mem: Postgres',    icon: LuDatabase, category: 'forge', color: '#a855f7' },
  forge_mem_buffer_window:   { label: 'Mem: Buffer Win',  icon: LuLayers,   category: 'forge', color: '#a855f7' },
  forge_mem_buffer:          { label: 'Mem: Buffer',      icon: LuLayers,   category: 'forge', color: '#a855f7' },
  forge_mem_summary:         { label: 'Mem: Summary',     icon: LuFileText, category: 'forge', color: '#a855f7' },
  forge_mem_vector_summary:  { label: 'Mem: Vec Summary', icon: LuFileText, category: 'forge', color: '#a855f7' },

  // Wave 34 — LangChain Retrievers + Doc Loaders
  forge_retriever_vector_store:           { label: 'R: VectorStore',  icon: LuDatabase, category: 'forge', color: '#a855f7' },
  forge_retriever_workflow:               { label: 'R: Workflow',     icon: LuLayers,   category: 'forge', color: '#a855f7' },
  forge_retriever_multi_query:            { label: 'R: MultiQuery',   icon: LuLayers,   category: 'forge', color: '#a855f7' },
  forge_retriever_contextual_compression: { label: 'R: CtxCompress',  icon: LuLayers,   category: 'forge', color: '#a855f7' },
  forge_doc_loader_binary:                { label: 'Doc: Binary',     icon: LuFileBox,  category: 'forge', color: '#a855f7' },
  forge_doc_loader_default:               { label: 'Doc: Default',    icon: LuFileText, category: 'forge', color: '#a855f7' },
  forge_doc_loader_github:                { label: 'Doc: GitHub',     icon: LuGithub,   category: 'forge', color: '#a855f7' },
  forge_doc_loader_json:                  { label: 'Doc: JSON',       icon: LuFileCode, category: 'forge', color: '#a855f7' },
  forge_vendor_n8n_credentials:           { label: 'Vendor: Creds',   icon: LuKey,      category: 'forge', color: '#a855f7' },
  forge_vendor_n8n_self:                  { label: 'Vendor: Self',    icon: LuActivity, category: 'forge', color: '#a855f7' },

  // Wave 35 — LangChain Misc
  forge_output_parser_structured: { label: 'Parse: Structured', icon: LuFileCode, category: 'forge', color: '#a855f7' },
  forge_output_parser_autofix:    { label: 'Parse: Autofix',    icon: LuFileCode, category: 'forge', color: '#a855f7' },
  forge_text_splitter_character:  { label: 'Split: Char',       icon: LuSplit,    category: 'forge', color: '#a855f7' },
  forge_text_splitter_recursive:  { label: 'Split: Recursive',  icon: LuSplit,    category: 'forge', color: '#a855f7' },
  forge_text_splitter_token:      { label: 'Split: Token',      icon: LuSplit,    category: 'forge', color: '#a855f7' },
  forge_guardrails_topical:       { label: 'Guard: Topical',    icon: LuEye,      category: 'forge', color: '#a855f7' },
  forge_guardrails_safety:        { label: 'Guard: Safety',     icon: LuEye,      category: 'forge', color: '#a855f7' },
  forge_guardrails_pii:           { label: 'Guard: PII',        icon: LuEye,      category: 'forge', color: '#a855f7' },
  forge_mcp_client:               { label: 'MCP Client',        icon: LuPlug,     category: 'forge', color: '#a855f7' },
  forge_tools_calculator:         { label: 'Tool: Calculator',  icon: LuHash,     category: 'forge', color: '#a855f7' },

  // Wave 36 — App triggers wave 1
  forge_hubspot_trigger:        { label: 'Trig: HubSpot',       icon: LuActivity, category: 'forge', color: '#ff7a59' },
  forge_shopify_trigger:        { label: 'Trig: Shopify',       icon: LuActivity, category: 'forge', color: '#95bf47' },
  forge_gitlab_trigger:         { label: 'Trig: GitLab',        icon: LuActivity, category: 'forge', color: '#fc6d26' },
  forge_mailchimp_trigger:      { label: 'Trig: Mailchimp',     icon: LuActivity, category: 'forge', color: '#ffe01b' },
  forge_stripe_trigger:         { label: 'Trig: Stripe',        icon: LuActivity, category: 'forge', color: '#635bff' },
  forge_woocommerce_trigger:    { label: 'Trig: WooCommerce',   icon: LuActivity, category: 'forge', color: '#7f54b3' },
  forge_strava_trigger:         { label: 'Trig: Strava',        icon: LuActivity, category: 'forge', color: '#fc4c02' },
  forge_activecampaign_trigger: { label: 'Trig: ActiveCampaign', icon: LuActivity, category: 'forge', color: '#356ae6' },
  forge_box_trigger:            { label: 'Trig: Box',           icon: LuActivity, category: 'forge', color: '#0061d5' },
  forge_calendly_trigger:       { label: 'Trig: Calendly',      icon: LuActivity, category: 'forge', color: '#006bff' },

  // Wave 37 — App triggers wave 2
  forge_pipedrive_trigger:      { label: 'Trig: Pipedrive',     icon: LuActivity, category: 'forge', color: '#26292c' },
  forge_trello_trigger:         { label: 'Trig: Trello',        icon: LuActivity, category: 'forge', color: '#0079bf' },
  forge_clickup_trigger:        { label: 'Trig: ClickUp',       icon: LuActivity, category: 'forge', color: '#7b68ee' },
  forge_asana_trigger:          { label: 'Trig: Asana',         icon: LuActivity, category: 'forge', color: '#f06a6a' },
  forge_jira_trigger:           { label: 'Trig: Jira',          icon: LuActivity, category: 'forge', color: '#0052cc' },
  forge_linear_trigger:         { label: 'Trig: Linear',        icon: LuActivity, category: 'forge', color: '#5e6ad2' },
  forge_notion_trigger:         { label: 'Trig: Notion',        icon: LuActivity, category: 'forge', color: '#000000' },
  forge_airtable_trigger:       { label: 'Trig: Airtable',      icon: LuActivity, category: 'forge', color: '#fcb400' },
  forge_telegram_trigger:       { label: 'Trig: Telegram',      icon: LuActivity, category: 'forge', color: '#26a5e4' },
  forge_slack_trigger:          { label: 'Trig: Slack',         icon: LuActivity, category: 'forge', color: '#4a154b' },

  // Final sweep — 60 trigger shims
  forge_acuity_trigger:           { label: 'Trig: Acuity',          icon: LuActivity, category: 'forge', color: '#fbbf24' },
  forge_affinity_trigger:         { label: 'Trig: Affinity',        icon: LuActivity, category: 'forge', color: '#2945cd' },
  forge_amqp_trigger:             { label: 'Trig: AMQP',            icon: LuActivity, category: 'forge', color: '#0078d4' },
  forge_autopilot_trigger:        { label: 'Trig: Autopilot',       icon: LuActivity, category: 'forge', color: '#1f2937' },
  forge_aws_trigger:              { label: 'Trig: AWS',             icon: LuActivity, category: 'forge', color: '#ff9900' },
  forge_bitbucket_trigger:        { label: 'Trig: Bitbucket',       icon: LuActivity, category: 'forge', color: '#2684ff' },
  forge_brevo_trigger:            { label: 'Trig: Brevo',           icon: LuActivity, category: 'forge', color: '#0b996e' },
  forge_cal_trigger:              { label: 'Trig: Cal',             icon: LuActivity, category: 'forge', color: '#0f172a' },
  forge_chargebee_trigger:        { label: 'Trig: Chargebee',       icon: LuActivity, category: 'forge', color: '#ff6c2c' },
  forge_eventbrite_trigger:       { label: 'Trig: Eventbrite',      icon: LuActivity, category: 'forge', color: '#f05537' },
  forge_cisco_webex_trigger:      { label: 'Trig: Cisco Webex',     icon: LuActivity, category: 'forge', color: '#049fd9' },
  forge_clockify_trigger:         { label: 'Trig: Clockify',        icon: LuActivity, category: 'forge', color: '#03a9f4' },
  forge_convertkit_trigger:       { label: 'Trig: ConvertKit',      icon: LuActivity, category: 'forge', color: '#fb6970' },
  forge_copper_trigger:           { label: 'Trig: Copper',          icon: LuActivity, category: 'forge', color: '#ff6c00' },
  forge_currents_trigger:         { label: 'Trig: Currents',        icon: LuActivity, category: 'forge', color: '#f59e0b' },
  forge_customerio_trigger:       { label: 'Trig: Customer.io',     icon: LuActivity, category: 'forge', color: '#7c52ff' },
  forge_emelia_trigger:           { label: 'Trig: Emelia',          icon: LuActivity, category: 'forge', color: '#7c3aed' },
  forge_facebook_trigger:         { label: 'Trig: Facebook',        icon: LuActivity, category: 'forge', color: '#1877f2' },
  forge_facebook_lead_ads_trigger: { label: 'Trig: FB Lead Ads',    icon: LuActivity, category: 'forge', color: '#1877f2' },
  forge_figma_trigger:            { label: 'Trig: Figma',           icon: LuActivity, category: 'forge', color: '#a259ff' },
  forge_flow_trigger:             { label: 'Trig: Flow',            icon: LuActivity, category: 'forge', color: '#5a3ec9' },
  forge_form_trigger:             { label: 'Trig: Form',            icon: LuActivity, category: 'forge', color: '#475569' },
  forge_formio_trigger:           { label: 'Trig: Form.io',         icon: LuActivity, category: 'forge', color: '#3a64a8' },
  forge_formstack_trigger:        { label: 'Trig: Formstack',       icon: LuActivity, category: 'forge', color: '#21b573' },
  forge_getresponse_trigger:      { label: 'Trig: GetResponse',     icon: LuActivity, category: 'forge', color: '#00baff' },
  forge_gumroad_trigger:          { label: 'Trig: Gumroad',         icon: LuActivity, category: 'forge', color: '#ff90e8' },
  forge_helpscout_trigger:        { label: 'Trig: Help Scout',      icon: LuActivity, category: 'forge', color: '#1292ee' },
  forge_invoiceninja_trigger:     { label: 'Trig: Invoice Ninja',   icon: LuActivity, category: 'forge', color: '#3e8e6a' },
  forge_jotform_trigger:          { label: 'Trig: JotForm',         icon: LuActivity, category: 'forge', color: '#ff6100' },
  forge_kafka_trigger:            { label: 'Trig: Kafka',           icon: LuActivity, category: 'forge', color: '#231f20' },
  forge_keap_trigger:             { label: 'Trig: Keap',            icon: LuActivity, category: 'forge', color: '#1c8d3e' },
  forge_kobotoolbox_trigger:      { label: 'Trig: KoBo',            icon: LuActivity, category: 'forge', color: '#5a6679' },
  forge_lemlist_trigger:          { label: 'Trig: Lemlist',         icon: LuActivity, category: 'forge', color: '#ff6b6b' },
  forge_lonescale_trigger:        { label: 'Trig: LoneScale',       icon: LuActivity, category: 'forge', color: '#0ea5e9' },
  forge_mqtt_trigger:             { label: 'Trig: MQTT',            icon: LuActivity, category: 'forge', color: '#660066' },
  forge_mailjet_trigger:          { label: 'Trig: Mailjet',         icon: LuActivity, category: 'forge', color: '#f0a92c' },
  forge_mautic_trigger:           { label: 'Trig: Mautic',          icon: LuActivity, category: 'forge', color: '#4e5e9e' },
  forge_microsoft_outlook_trigger:{ label: 'Trig: MS Outlook',      icon: LuActivity, category: 'forge', color: '#0078d4' },
  forge_microsoft_teams_trigger:  { label: 'Trig: MS Teams',        icon: LuActivity, category: 'forge', color: '#6264a7' },
  forge_mailerlite_trigger:       { label: 'Trig: MailerLite',      icon: LuActivity, category: 'forge', color: '#09c269' },
  forge_netlify_trigger:          { label: 'Trig: Netlify',         icon: LuActivity, category: 'forge', color: '#00c7b7' },
  forge_onfleet_trigger:          { label: 'Trig: Onfleet',         icon: LuActivity, category: 'forge', color: '#ff6b00' },
  forge_paypal_trigger:           { label: 'Trig: PayPal',          icon: LuActivity, category: 'forge', color: '#0070ba' },
  forge_postgres_trigger:         { label: 'Trig: Postgres',        icon: LuActivity, category: 'forge', color: '#336791' },
  forge_postmark_trigger:         { label: 'Trig: Postmark',        icon: LuActivity, category: 'forge', color: '#ffde00' },
  forge_pushcut_trigger:          { label: 'Trig: Pushcut',         icon: LuActivity, category: 'forge', color: '#fbbf24' },
  forge_rabbitmq_trigger:         { label: 'Trig: RabbitMQ',        icon: LuActivity, category: 'forge', color: '#ff6600' },
  forge_redis_trigger:            { label: 'Trig: Redis',           icon: LuActivity, category: 'forge', color: '#dc382d' },
  forge_seatable_trigger:         { label: 'Trig: SeaTable',        icon: LuActivity, category: 'forge', color: '#fa743e' },
  forge_salesforce_trigger:       { label: 'Trig: Salesforce',      icon: LuActivity, category: 'forge', color: '#00a1e0' },
  forge_surveymonkey_trigger:     { label: 'Trig: SurveyMonkey',    icon: LuActivity, category: 'forge', color: '#00bf6f' },
  forge_taiga_trigger:            { label: 'Trig: Taiga',           icon: LuActivity, category: 'forge', color: '#83ca56' },
  forge_thehive_trigger:          { label: 'Trig: TheHive',         icon: LuActivity, category: 'forge', color: '#f57c00' },
  forge_toggl_trigger:            { label: 'Trig: Toggl',           icon: LuActivity, category: 'forge', color: '#e57cd8' },
  forge_twilio_trigger:           { label: 'Trig: Twilio',          icon: LuActivity, category: 'forge', color: '#f22f46' },
  forge_typeform_trigger:         { label: 'Trig: Typeform',        icon: LuActivity, category: 'forge', color: '#262627' },
  forge_venafi_trigger:           { label: 'Trig: Venafi',          icon: LuActivity, category: 'forge', color: '#00a651' },
  forge_wise_trigger:             { label: 'Trig: Wise',            icon: LuActivity, category: 'forge', color: '#9fe870' },
  forge_workable_trigger:         { label: 'Trig: Workable',        icon: LuActivity, category: 'forge', color: '#1ad17e' },
  forge_wufoo_trigger:            { label: 'Trig: Wufoo',           icon: LuActivity, category: 'forge', color: '#ff3a07' },

  // Final sweep — subfolder extras
  forge_gsuite_admin:               { label: 'GSuite Admin',           icon: LuUsers,    category: 'forge', color: '#4285f4' },
  forge_google_business_profile:    { label: 'Business Profile',       icon: LuLayers,   category: 'forge', color: '#4285f4' },
  forge_google_books:               { label: 'Google Books',           icon: LuFileText, category: 'forge', color: '#4285f4' },
  forge_google_cnl:                 { label: 'Cloud Natural Lang.',    icon: LuBrain,    category: 'forge', color: '#4285f4' },
  forge_google_perspective:         { label: 'Google Perspective',     icon: LuEye,      category: 'forge', color: '#4285f4' },
  forge_google_firebase_rtdb:       { label: 'Firebase RTDB',          icon: LuDatabase, category: 'forge', color: '#ffa000' },
  forge_azure_cosmos_db:            { label: 'Azure Cosmos DB',        icon: LuDatabase, category: 'forge', color: '#0078d4' },
  forge_microsoft_entra:            { label: 'Microsoft Entra',        icon: LuUsers,    category: 'forge', color: '#0078d4' },
  forge_microsoft_graph_security:   { label: 'MS Graph Security',      icon: LuActivity, category: 'forge', color: '#0078d4' },
  forge_azure_storage:              { label: 'Azure Storage',          icon: LuCloud,    category: 'forge', color: '#0078d4' },

  // Final sweep — LangChain vendors / tools
  forge_tool_wikipedia:            { label: 'Tool: Wikipedia',        icon: LuFileText, category: 'forge', color: '#a855f7' },
  forge_tool_serpapi:              { label: 'Tool: SerpAPI',          icon: LuGlobe,    category: 'forge', color: '#a855f7' },
  forge_tool_wolframalpha:         { label: 'Tool: Wolfram',          icon: LuHash,     category: 'forge', color: '#a855f7' },
  forge_tool_sql:                  { label: 'Tool: SQL',              icon: LuDatabase, category: 'forge', color: '#a855f7' },
  forge_tool_http_request:         { label: 'Tool: HTTP',             icon: LuGlobe,    category: 'forge', color: '#a855f7' },
  forge_tool_code:                 { label: 'Tool: Code',             icon: LuFileCode, category: 'forge', color: '#a855f7' },
  forge_tool_calculator_n8n:       { label: 'Tool: Calc',             icon: LuHash,     category: 'forge', color: '#a855f7' },
  forge_tool_workflow:             { label: 'Tool: Workflow',         icon: LuLayers,   category: 'forge', color: '#a855f7' },
  forge_tool_vector_store:         { label: 'Tool: VectorStore',      icon: LuDatabase, category: 'forge', color: '#a855f7' },
  forge_tool_think:                { label: 'Tool: Think',            icon: LuBrain,    category: 'forge', color: '#a855f7' },

  // Final sweep — utility V1/V2 compat-shims
  forge_set_v1:           { label: 'Set (v1)',          icon: LuVariable, category: 'forge', color: '#fb923c' },
  forge_set_v2:           { label: 'Set (v2)',          icon: LuVariable, category: 'forge', color: '#fb923c' },
  forge_switch_v1:        { label: 'Switch (v1)',       icon: LuShuffle,  category: 'forge', color: '#f97316' },
  forge_switch_v2:        { label: 'Switch (v2)',       icon: LuShuffle,  category: 'forge', color: '#f97316' },
  forge_if_v1:            { label: 'If (v1)',           icon: LuGitBranch, category: 'forge', color: '#f97316' },
  forge_filter_v1:        { label: 'Filter (v1)',       icon: LuFilter,   category: 'forge', color: '#fb923c' },
  forge_merge_v1:         { label: 'Merge (v1)',        icon: LuGitMerge, category: 'forge', color: '#fb923c' },
  forge_merge_v2:         { label: 'Merge (v2)',        icon: LuGitMerge, category: 'forge', color: '#fb923c' },
  forge_http_request_v1:  { label: 'HTTP Req (v1)',     icon: LuGlobe,    category: 'forge', color: '#475569' },
  forge_http_request_v2:  { label: 'HTTP Req (v2)',     icon: LuGlobe,    category: 'forge', color: '#475569' },

  // Final sweep — service V1 compat-shims
  forge_slack_v1:         { label: 'Slack (v1)',        icon: LuMessageCircle, category: 'forge', color: '#4a154b' },
  forge_hubspot_v1:       { label: 'HubSpot (v1)',      icon: LuUsers,    category: 'forge', color: '#ff7a59' },
  forge_discord_v1:       { label: 'Discord (v1)',      icon: LuShare2,   category: 'forge', color: '#5865f2' },
  forge_pipedrive_v1:     { label: 'Pipedrive (v1)',    icon: LuUsers,    category: 'forge', color: '#26292c' },
  forge_notion_v1:        { label: 'Notion (v1)',       icon: LuFileText, category: 'forge', color: '#000000' },
  forge_airtable_v1:      { label: 'Airtable (v1)',     icon: LuFileBox,  category: 'forge', color: '#fcb400' },
  forge_twitter_v1:       { label: 'Twitter (v1)',      icon: LuMessageCircle, category: 'forge', color: '#1da1f2' },
  forge_mattermost_v1:    { label: 'Mattermost (v1)',   icon: LuMessageCircle, category: 'forge', color: '#0072c6' },
  forge_splunk_v1:        { label: 'Splunk (v1)',       icon: LuChartBar, category: 'forge', color: '#65a637' },
  forge_lemlist_v1:       { label: 'Lemlist (v1)',      icon: LuMail,     category: 'forge', color: '#ff6b6b' },
};

export function getBlockLabel(type: string): string {
  return BLOCK_REGISTRY[type]?.label ?? type;
}

/**
 * Block-aware display metadata. Unlike the type-keyed getters above, this
 * reads the block's `options` so generic dispatch blocks can surface their
 * configured identity — e.g. every `forge_app_preset` instance carries the
 * preset's brand name in `options.__label` (written by the editor catalog
 * when the block is created / configured).
 */
export function getBlockDisplay(block: {
  type: string;
  options?: Record<string, unknown> | null;
}): { label: string; icon: BlockMeta['icon'] | null; color: string } {
  if (block.type === 'forge_app_preset') {
    const raw = block.options?.__label;
    const label = typeof raw === 'string' && raw.trim() ? raw : 'App preset';
    return {
      label,
      icon: getBlockIcon(block.type),
      color: getBlockColor(block.type),
    };
  }
  return {
    label: getBlockLabel(block.type),
    icon: getBlockIcon(block.type),
    color: getBlockColor(block.type),
  };
}

export function getBlockIcon(type: string) {
  return BLOCK_REGISTRY[type]?.icon ?? null;
}

export function getBlockColor(type: string): string {
  return BLOCK_REGISTRY[type]?.color ?? '#9ca3af';
}

export function getBlockCategory(type: string) {
  return BLOCK_REGISTRY[type]?.category ?? 'integrations';
}

export const BLOCK_CATEGORIES = {
  bubbles: {
    label: 'Bubbles',
    color: '#6366f1',
    types: ['text', 'image', 'video', 'audio', 'embed'],
  },
  inputs: {
    label: 'Inputs',
    color: '#0ea5e9',
    types: ['text_input', 'number_input', 'email_input', 'phone_input', 'url_input', 'date_input', 'time_input', 'rating_input', 'file_input', 'payment_input', 'choice_input', 'picture_choice_input'],
  },
  logic: {
    label: 'Logic',
    color: '#f97316',
    types: ['condition', 'set_variable', 'set', 'redirect', 'script', 'typebot_link', 'wait', 'jump', 'ab_test', 'loop', 'merge', 'switch', 'filter', 'sort', 'execute_workflow', 'respond_to_webhook'],
  },
  integrations: {
    label: 'Integrations',
    color: '#ec4899',
    types: ['webhook', 'send_email', 'google_sheets', 'google_analytics', 'open_ai', 'zapier', 'make_com', 'pabbly_connect', 'chatwoot', 'pixel', 'segment', 'cal_com', 'nocodb', 'elevenlabs', 'anthropic', 'together_ai', 'mistral'],
  },
  forge: {
    label: 'Forge',
    color: '#a855f7',
    types: [
      // Existing
      'forge_notion', 'forge_airtable', 'forge_slack', 'forge_discord', 'forge_github', 'forge_twilio', 'forge_sendgrid',
      // Pilots
      'forge_http_request', 'forge_linear', 'forge_mongodb',
      // Wave 1 — Communication
      'forge_telegram', 'forge_whatsapp', 'forge_mattermost', 'forge_matrix', 'forge_rocketchat',
      'forge_line', 'forge_messagebird', 'forge_vonage', 'forge_plivo', 'forge_sms77',
      // Wave 1 — CRM
      'forge_hubspot', 'forge_salesforce', 'forge_pipedrive', 'forge_activecampaign', 'forge_copper',
      'forge_freshworks_crm', 'forge_zoho_crm', 'forge_agile_crm', 'forge_customerio', 'forge_intercom',
      // Wave 1 — Project Management
      'forge_asana', 'forge_trello', 'forge_clickup', 'forge_monday', 'forge_jira',
      'forge_wekan', 'forge_taiga', 'forge_todoist', 'forge_servicenow', 'forge_freshdesk',
      // Wave 1 — Storage / DB
      'forge_aws_s3', 'forge_dropbox', 'forge_nextcloud', 'forge_box', 'forge_ftp',
      'forge_ssh', 'forge_snowflake', 'forge_postgres', 'forge_mysql', 'forge_redis',
      // Wave 1 — Generic / Logic
      'forge_webhook', 'forge_set_n8n', 'forge_if', 'forge_switch_n8n', 'forge_filter',
      'forge_merge', 'forge_graphql', 'forge_rename_keys', 'forge_crypto', 'forge_code_n8n',
      // Wave 2 — Email & Marketing
      'forge_mailchimp', 'forge_sendgrid_ext', 'forge_mailgun', 'forge_mailjet', 'forge_mandrill',
      'forge_convertkit', 'forge_getresponse', 'forge_brevo', 'forge_mailerlite', 'forge_vero',
      // Wave 3 — Commerce & Payments
      'forge_shopify', 'forge_woocommerce', 'forge_stripe', 'forge_paddle', 'forge_chargebee',
      'forge_paypal', 'forge_magento', 'forge_quickbooks', 'forge_xero', 'forge_invoiceninja',
      // Wave 4 — DevOps & Git
      'forge_gitlab', 'forge_bitbucket', 'forge_jenkins', 'forge_circleci', 'forge_travisci',
      'forge_aws_lambda', 'forge_cloudflare', 'forge_netlify', 'forge_git', 'forge_postbin',
      // Wave 5 — Docs & Productivity
      'forge_coda', 'forge_google_sheets_ext', 'forge_nocodb_ext', 'forge_baserow', 'forge_grist',
      'forge_stackby', 'forge_seatable', 'forge_strapi', 'forge_ghost', 'forge_wordpress',
      // Wave 6 — Monitoring & Support
      'forge_sentry_io', 'forge_pagerduty', 'forge_grafana', 'forge_helpscout', 'forge_zendesk',
      'forge_zammad', 'forge_deepl', 'forge_reddit', 'forge_discourse', 'forge_hackernews',
      // Wave 7 — AI & ML
      'forge_ai_transform', 'forge_openai_ext', 'forge_mistral_ext', 'forge_perplexity_ext',
      'forge_humantic_ai', 'forge_mindee', 'forge_jina_ai', 'forge_lingvanex', 'forge_cortex', 'forge_airtop',
      // Wave 8 — Marketing & Analytics
      'forge_mautic', 'forge_egoi', 'forge_iterable', 'forge_hunter', 'forge_phantombuster',
      'forge_posthog', 'forge_segment', 'forge_clearbit', 'forge_profitwell', 'forge_tapfiliate',
      // Wave 9 — CRM Extensions
      'forge_keap', 'forge_monica_crm', 'forge_drift', 'forge_demio', 'forge_salesmate',
      'forge_syncro_msp', 'forge_highlevel', 'forge_microsoft_dynamics_crm', 'forge_affinity', 'forge_erpnext',
      // Wave 10 — Social & CMS
      'forge_bitly', 'forge_twitter', 'forge_yourls', 'forge_storyblok', 'forge_webflow',
      'forge_medium', 'forge_disqus', 'forge_linkedin', 'forge_rss_feed_read', 'forge_markdown',
      // Wave 11 — Tools & Utilities
      'forge_bannerbear', 'forge_brandfetch', 'forge_quickchart', 'forge_apitemplate_io', 'forge_peekalink',
      'forge_kobotoolbox', 'forge_onesimpleapi', 'forge_html', 'forge_xml', 'forge_datetime',
      // Wave 12 — Misc & Long Tail
      'forge_openweathermap', 'forge_coingecko', 'forge_urlscanio', 'forge_marketstack', 'forge_openthesaurus',
      'forge_nasa', 'forge_strava', 'forge_oura', 'forge_spotify', 'forge_zoom',
      // Wave 13 — Email/Marketing extras
      'forge_lemlist', 'forge_mailcheck', 'forge_dropcontact', 'forge_sendy', 'forge_emelia',
      'forge_lonescale', 'forge_autopilot', 'forge_action_network', 'forge_currents', 'forge_bubble',
      // Wave 14 — HR/Time/Productivity
      'forge_bamboohr', 'forge_clockify', 'forge_harvest', 'forge_gotowebinar', 'forge_gong',
      'forge_freshservice', 'forge_halopsa', 'forge_adalo', 'forge_onfleet', 'forge_twist',
      // Wave 15 — Comms/Messaging extras
      'forge_twake', 'forge_zulip', 'forge_gotify', 'forge_pushbullet', 'forge_pushcut',
      'forge_pushover', 'forge_mocean', 'forge_msg91', 'forge_signl4', 'forge_facebook',
      // Wave 16 — DB/Infrastructure
      'forge_questdb', 'forge_cratedb', 'forge_timescaledb', 'forge_oracle', 'forge_kafka',
      'forge_rabbitmq', 'forge_mqtt', 'forge_amqp', 'forge_ldap', 'forge_supabase',
      // Wave 17 — Security/Monitoring
      'forge_bitwarden', 'forge_elastic_security', 'forge_misp', 'forge_thehive', 'forge_security_scorecard',
      'forge_venafi', 'forge_netscaler', 'forge_okta', 'forge_totp', 'forge_jwt',
      // Wave 18 — Specialty/IoT
      'forge_philips_hue', 'forge_home_assistant', 'forge_filemaker', 'forge_dhl', 'forge_cisco_webex',
      'forge_cockpit', 'forge_rundeck', 'forge_splunk', 'forge_contentful', 'forge_metabase',
      // Wave 19 — Misc utilities
      'forge_uproc', 'forge_unleashed_software', 'forge_uplead', 'forge_orbit', 'forge_raindrop',
      'forge_quickbase', 'forge_wise', 'forge_uptimerobot', 'forge_htmlextract', 'forge_read_pdf',
      // Wave 20 — Final closers
      'forge_beeminder', 'forge_npm', 'forge_google_ads', 'forge_edit_image', 'forge_icalendar',
      'forge_flow', 'forge_send_email_n8n', 'forge_n8n_api', 'forge_compression', 'forge_wait_n8n',
      // Wave 21 — Triggers-as-actions
      'forge_cron_n8n', 'forge_interval_n8n', 'forge_manual_trigger', 'forge_n8n_trigger',
      'forge_workflow_trigger', 'forge_error_trigger', 'forge_sse_trigger', 'forge_email_read_imap',
      'forge_local_file_trigger', 'forge_respond_to_webhook',
      // Wave 22 — n8n internals
      'forge_no_op', 'forge_sticky_note', 'forge_form_n8n', 'forge_debug_helper',
      'forge_execute_command', 'forge_execute_workflow', 'forge_execution_data',
      'forge_move_binary_data', 'forge_split_in_batches', 'forge_transform_sort',
      // Wave 23 — Binary/file ops
      'forge_read_binary_file', 'forge_read_binary_files', 'forge_write_binary_file',
      'forge_read_write_file', 'forge_spreadsheet_file', 'forge_simulate', 'forge_e2e_test',
      'forge_time_saved', 'forge_dynamic_credential_check', 'forge_data_table',
      // Wave 24 — Deprecated / training
      'forge_compare_datasets', 'forge_evaluation', 'forge_function_legacy',
      'forge_function_item_legacy', 'forge_training_datastore', 'forge_training_messenger',
      'forge_thehive_project', 'forge_stop_and_error', 'forge_ai_transform_v1',
      'forge_legacy_variants_info',
      // Wave 25 — AWS family
      'forge_aws_dynamodb', 'forge_aws_ses', 'forge_aws_sqs', 'forge_aws_cognito', 'forge_aws_comprehend',
      'forge_aws_rekognition', 'forge_aws_textract', 'forge_aws_transcribe', 'forge_aws_cert_manager', 'forge_aws_iam',
      // Wave 26 — Google A
      'forge_google_drive', 'forge_gmail', 'forge_google_calendar', 'forge_google_contacts', 'forge_google_docs',
      'forge_google_slides', 'forge_google_tasks', 'forge_google_translate', 'forge_youtube', 'forge_google_analytics',
      // Wave 27 — Google B + Microsoft
      'forge_google_bigquery', 'forge_google_chat', 'forge_google_cloud_storage', 'forge_google_firestore',
      'forge_microsoft_excel', 'forge_microsoft_onedrive', 'forge_microsoft_outlook',
      'forge_microsoft_teams_full', 'forge_microsoft_sharepoint', 'forge_microsoft_todo',
      // Wave 28 — Transform / utility
      'forge_aggregate', 'forge_limit', 'forge_remove_duplicates', 'forge_split_out', 'forge_summarize',
      'forge_convert_to_file', 'forge_extract_from_file', 'forge_schedule_trigger', 'forge_elasticsearch', 'forge_venafi_cloud',
      // Wave 29 — LangChain LLMs
      'forge_lm_chat_anthropic', 'forge_lm_chat_openai', 'forge_lm_chat_ollama', 'forge_lm_chat_bedrock',
      'forge_lm_chat_azure_openai', 'forge_lm_chat_gemini', 'forge_lm_chat_groq', 'forge_lm_chat_mistral',
      'forge_lm_cohere', 'forge_lm_chat_alibaba',
      // Wave 30 — LangChain Embeddings + Rerank
      'forge_embeddings_openai', 'forge_embeddings_cohere', 'forge_embeddings_mistral', 'forge_embeddings_ollama',
      'forge_embeddings_gemini', 'forge_embeddings_vertex', 'forge_embeddings_bedrock',
      'forge_embeddings_azure_openai', 'forge_embeddings_huggingface', 'forge_cohere_rerank',
      // Wave 31 — LangChain Vector Stores
      'forge_vector_pinecone', 'forge_vector_qdrant', 'forge_vector_weaviate', 'forge_vector_milvus',
      'forge_vector_pgvector', 'forge_vector_supabase', 'forge_vector_redis', 'forge_vector_mongo',
      'forge_vector_chroma', 'forge_vector_in_memory',
      // Wave 32 — LangChain Agents/Chains/Tools
      'forge_lc_agent', 'forge_lc_openai_assistant', 'forge_lc_chain_llm', 'forge_lc_chain_retrieval_qa',
      'forge_lc_chain_summarization', 'forge_lc_information_extractor', 'forge_lc_sentiment',
      'forge_lc_text_classifier', 'forge_lc_tool_executor', 'forge_lc_output_parser_json',
      // Wave 33 — LangChain Memory
      'forge_mem_motorhead', 'forge_mem_mongo', 'forge_mem_redis', 'forge_mem_xata', 'forge_mem_zep',
      'forge_mem_postgres', 'forge_mem_buffer_window', 'forge_mem_buffer', 'forge_mem_summary', 'forge_mem_vector_summary',
      // Wave 34 — Retrievers + Doc Loaders
      'forge_retriever_vector_store', 'forge_retriever_workflow', 'forge_retriever_multi_query',
      'forge_retriever_contextual_compression', 'forge_doc_loader_binary', 'forge_doc_loader_default',
      'forge_doc_loader_github', 'forge_doc_loader_json', 'forge_vendor_n8n_credentials', 'forge_vendor_n8n_self',
      // Wave 35 — LangChain Misc
      'forge_output_parser_structured', 'forge_output_parser_autofix', 'forge_text_splitter_character',
      'forge_text_splitter_recursive', 'forge_text_splitter_token', 'forge_guardrails_topical',
      'forge_guardrails_safety', 'forge_guardrails_pii', 'forge_mcp_client', 'forge_tools_calculator',
      // Wave 36 — App triggers 1
      'forge_hubspot_trigger', 'forge_shopify_trigger', 'forge_gitlab_trigger', 'forge_mailchimp_trigger',
      'forge_stripe_trigger', 'forge_woocommerce_trigger', 'forge_strava_trigger',
      'forge_activecampaign_trigger', 'forge_box_trigger', 'forge_calendly_trigger',
      // Wave 37 — App triggers 2
      'forge_pipedrive_trigger', 'forge_trello_trigger', 'forge_clickup_trigger', 'forge_asana_trigger',
      'forge_jira_trigger', 'forge_linear_trigger', 'forge_notion_trigger', 'forge_airtable_trigger',
      'forge_telegram_trigger', 'forge_slack_trigger',
      // Final sweep — 60 trigger shims
      'forge_acuity_trigger', 'forge_affinity_trigger', 'forge_amqp_trigger', 'forge_autopilot_trigger',
      'forge_aws_trigger', 'forge_bitbucket_trigger', 'forge_brevo_trigger', 'forge_cal_trigger',
      'forge_chargebee_trigger', 'forge_eventbrite_trigger',
      'forge_cisco_webex_trigger', 'forge_clockify_trigger', 'forge_convertkit_trigger', 'forge_copper_trigger',
      'forge_currents_trigger', 'forge_customerio_trigger', 'forge_emelia_trigger', 'forge_facebook_trigger',
      'forge_facebook_lead_ads_trigger', 'forge_figma_trigger',
      'forge_flow_trigger', 'forge_form_trigger', 'forge_formio_trigger', 'forge_formstack_trigger',
      'forge_getresponse_trigger', 'forge_gumroad_trigger', 'forge_helpscout_trigger',
      'forge_invoiceninja_trigger', 'forge_jotform_trigger', 'forge_kafka_trigger',
      'forge_keap_trigger', 'forge_kobotoolbox_trigger', 'forge_lemlist_trigger', 'forge_lonescale_trigger',
      'forge_mqtt_trigger', 'forge_mailjet_trigger', 'forge_mautic_trigger',
      'forge_microsoft_outlook_trigger', 'forge_microsoft_teams_trigger', 'forge_mailerlite_trigger',
      'forge_netlify_trigger', 'forge_onfleet_trigger', 'forge_paypal_trigger', 'forge_postgres_trigger',
      'forge_postmark_trigger', 'forge_pushcut_trigger', 'forge_rabbitmq_trigger', 'forge_redis_trigger',
      'forge_seatable_trigger', 'forge_salesforce_trigger',
      'forge_surveymonkey_trigger', 'forge_taiga_trigger', 'forge_thehive_trigger', 'forge_toggl_trigger',
      'forge_twilio_trigger', 'forge_typeform_trigger', 'forge_venafi_trigger', 'forge_wise_trigger',
      'forge_workable_trigger', 'forge_wufoo_trigger',
      // Final sweep — subfolder extras (10)
      'forge_gsuite_admin', 'forge_google_business_profile', 'forge_google_books', 'forge_google_cnl',
      'forge_google_perspective', 'forge_google_firebase_rtdb', 'forge_azure_cosmos_db',
      'forge_microsoft_entra', 'forge_microsoft_graph_security', 'forge_azure_storage',
      // Final sweep — LangChain vendors / tools (10)
      'forge_tool_wikipedia', 'forge_tool_serpapi', 'forge_tool_wolframalpha', 'forge_tool_sql',
      'forge_tool_http_request', 'forge_tool_code', 'forge_tool_calculator_n8n', 'forge_tool_workflow',
      'forge_tool_vector_store', 'forge_tool_think',
      // Final sweep — utility V1/V2 compat-shims (10)
      'forge_set_v1', 'forge_set_v2', 'forge_switch_v1', 'forge_switch_v2', 'forge_if_v1',
      'forge_filter_v1', 'forge_merge_v1', 'forge_merge_v2', 'forge_http_request_v1', 'forge_http_request_v2',
      // Final sweep — service V1 compat-shims (10)
      'forge_slack_v1', 'forge_hubspot_v1', 'forge_discord_v1', 'forge_pipedrive_v1', 'forge_notion_v1',
      'forge_airtable_v1', 'forge_twitter_v1', 'forge_mattermost_v1', 'forge_splunk_v1', 'forge_lemlist_v1',
    ],
  },
} as const;

/* ── Lookup helpers ──────────────────────────────────── */

/** Return the full registry entry for a block type, or undefined if unknown. */
export function getBlockByType(type: string): BlockMeta | undefined {
  return BLOCK_REGISTRY[type];
}

/** Return all block types in a category, in registry order. */
export function getBlocksByCategory(
  cat: BlockMeta['category'],
): { type: string; meta: BlockMeta }[] {
  return Object.entries(BLOCK_REGISTRY)
    .filter(([, meta]) => meta.category === cat)
    .map(([type, meta]) => ({ type, meta }));
}

/**
 * Default block.options shape per block type. Returned object is a shallow
 * copy so callers can mutate it freely. Unknown types yield {}.
 *
 * Keep additions here in sync with the matching *Options type in
 * `@/lib/sabflow/types` and the settings panel's expected fields.
 */
export function getDefaultBlockData(type: string): Record<string, unknown> {
  switch (type) {
    case 'text':
      return { content: '' };
    case 'image':
      return { url: '', alt: '' };
    case 'video':
      return { url: '', aspectRatio: '16/9' };
    case 'audio':
      return { url: '' };
    case 'embed':
      return { url: '', height: { value: 300, unit: 'px' } };

    case 'text_input':
      return { placeholder: 'Type your answer…', buttonLabel: 'Send' };
    case 'number_input':
      return { placeholder: '0', buttonLabel: 'Send' };
    case 'email_input':
      return { placeholder: 'name@example.com', buttonLabel: 'Send' };
    case 'phone_input':
      return { placeholder: '+1 555 0100', buttonLabel: 'Send', defaultCountry: 'US' };
    case 'url_input':
      return { placeholder: 'https://…', buttonLabel: 'Send' };
    case 'date_input':
      return { format: 'YYYY-MM-DD', buttonLabel: 'Send' };
    case 'time_input':
      return { format: 'HH:mm', buttonLabel: 'Send' };
    case 'rating_input':
      return { length: 5, buttonLabel: 'Send' };
    case 'file_input':
      return { isMultipleAllowed: false, buttonLabel: 'Upload' };
    case 'payment_input':
      return { provider: 'stripe', amount: '0', currency: 'USD' };
    case 'choice_input':
      return { items: [], isMultipleChoice: false, buttonLabel: 'Send' };
    case 'picture_choice_input':
      return { items: [], isMultipleChoice: false, buttonLabel: 'Send' };

    case 'condition':
      return { items: [{ id: crypto.randomUUID(), comparisons: [] }] };
    case 'set_variable':
    case 'set':
      return { variableId: '', expressionToEvaluate: '' };
    case 'redirect':
      return { url: '', isNewTab: false };
    case 'script':
      return { content: '' };
    case 'typebot_link':
      return { typebotId: '' };
    case 'wait':
      return { secondsToWaitFor: 1 };
    case 'jump':
      return { groupId: '' };
    case 'ab_test':
      return { items: [{ id: crypto.randomUUID(), weight: 50 }, { id: crypto.randomUUID(), weight: 50 }] };
    case 'loop':
      return { listVariableId: '', maxIterations: 100 };
    case 'merge':
      return { mode: 'append' };
    case 'switch':
      return { variableId: '', cases: [] };
    case 'filter':
      return { listVariableId: '', condition: { items: [] } };
    case 'sort':
      return { listVariableId: '', key: '', direction: 'asc' };

    case 'webhook':
      return { url: '', method: 'POST', headers: [], body: '' };
    case 'send_email':
      return { to: '', subject: '', body: '' };
    case 'google_sheets':
      return { operation: 'append', spreadsheetId: '', sheetName: '' };
    case 'open_ai':
      return { model: 'openai/gpt-4o-mini', task: 'Create chat completion', messages: [] };

    case 'forge_notion':
    case 'forge_airtable':
    case 'forge_slack':
    case 'forge_discord':
    case 'forge_github':
    case 'forge_twilio':
    case 'forge_sendgrid':
    case 'forge_http_request':
    case 'forge_linear':
    case 'forge_mongodb':
    // Wave 1 — Communication
    case 'forge_telegram':
    case 'forge_whatsapp':
    case 'forge_mattermost':
    case 'forge_matrix':
    case 'forge_rocketchat':
    case 'forge_line':
    case 'forge_messagebird':
    case 'forge_vonage':
    case 'forge_plivo':
    case 'forge_sms77':
    // Wave 1 — CRM
    case 'forge_hubspot':
    case 'forge_salesforce':
    case 'forge_pipedrive':
    case 'forge_activecampaign':
    case 'forge_copper':
    case 'forge_freshworks_crm':
    case 'forge_zoho_crm':
    case 'forge_agile_crm':
    case 'forge_customerio':
    case 'forge_intercom':
    // Wave 1 — Project Management
    case 'forge_asana':
    case 'forge_trello':
    case 'forge_clickup':
    case 'forge_monday':
    case 'forge_jira':
    case 'forge_wekan':
    case 'forge_taiga':
    case 'forge_todoist':
    case 'forge_servicenow':
    case 'forge_freshdesk':
    // Wave 1 — Storage / DB
    case 'forge_aws_s3':
    case 'forge_dropbox':
    case 'forge_nextcloud':
    case 'forge_box':
    case 'forge_ftp':
    case 'forge_ssh':
    case 'forge_snowflake':
    case 'forge_postgres':
    case 'forge_mysql':
    case 'forge_redis':
    // Wave 1 — Generic / Logic
    case 'forge_webhook':
    case 'forge_set_n8n':
    case 'forge_if':
    case 'forge_switch_n8n':
    case 'forge_filter':
    case 'forge_merge':
    case 'forge_graphql':
    case 'forge_rename_keys':
    case 'forge_crypto':
    case 'forge_code_n8n':
    // Wave 2 — Email & Marketing
    case 'forge_mailchimp':
    case 'forge_sendgrid_ext':
    case 'forge_mailgun':
    case 'forge_mailjet':
    case 'forge_mandrill':
    case 'forge_convertkit':
    case 'forge_getresponse':
    case 'forge_brevo':
    case 'forge_mailerlite':
    case 'forge_vero':
    // Wave 3 — Commerce & Payments
    case 'forge_shopify':
    case 'forge_woocommerce':
    case 'forge_stripe':
    case 'forge_paddle':
    case 'forge_chargebee':
    case 'forge_paypal':
    case 'forge_magento':
    case 'forge_quickbooks':
    case 'forge_xero':
    case 'forge_invoiceninja':
    // Wave 4 — DevOps & Git
    case 'forge_gitlab':
    case 'forge_bitbucket':
    case 'forge_jenkins':
    case 'forge_circleci':
    case 'forge_travisci':
    case 'forge_aws_lambda':
    case 'forge_cloudflare':
    case 'forge_netlify':
    case 'forge_git':
    case 'forge_postbin':
    // Wave 5 — Docs & Productivity
    case 'forge_coda':
    case 'forge_google_sheets_ext':
    case 'forge_nocodb_ext':
    case 'forge_baserow':
    case 'forge_grist':
    case 'forge_stackby':
    case 'forge_seatable':
    case 'forge_strapi':
    case 'forge_ghost':
    case 'forge_wordpress':
    // Wave 6 — Monitoring & Support
    case 'forge_sentry_io':
    case 'forge_pagerduty':
    case 'forge_grafana':
    case 'forge_helpscout':
    case 'forge_zendesk':
    case 'forge_zammad':
    case 'forge_deepl':
    case 'forge_reddit':
    case 'forge_discourse':
    case 'forge_hackernews':
    // Wave 7 — AI & ML
    case 'forge_ai_transform':
    case 'forge_openai_ext':
    case 'forge_mistral_ext':
    case 'forge_perplexity_ext':
    case 'forge_humantic_ai':
    case 'forge_mindee':
    case 'forge_jina_ai':
    case 'forge_lingvanex':
    case 'forge_cortex':
    case 'forge_airtop':
    // Wave 8 — Marketing & Analytics
    case 'forge_mautic':
    case 'forge_egoi':
    case 'forge_iterable':
    case 'forge_hunter':
    case 'forge_phantombuster':
    case 'forge_posthog':
    case 'forge_segment':
    case 'forge_clearbit':
    case 'forge_profitwell':
    case 'forge_tapfiliate':
    // Wave 9 — CRM Extensions
    case 'forge_keap':
    case 'forge_monica_crm':
    case 'forge_drift':
    case 'forge_demio':
    case 'forge_salesmate':
    case 'forge_syncro_msp':
    case 'forge_highlevel':
    case 'forge_microsoft_dynamics_crm':
    case 'forge_affinity':
    case 'forge_erpnext':
    // Wave 10 — Social & CMS
    case 'forge_bitly':
    case 'forge_twitter':
    case 'forge_yourls':
    case 'forge_storyblok':
    case 'forge_webflow':
    case 'forge_medium':
    case 'forge_disqus':
    case 'forge_linkedin':
    case 'forge_rss_feed_read':
    case 'forge_markdown':
    // Wave 11 — Tools & Utilities
    case 'forge_bannerbear':
    case 'forge_brandfetch':
    case 'forge_quickchart':
    case 'forge_apitemplate_io':
    case 'forge_peekalink':
    case 'forge_kobotoolbox':
    case 'forge_onesimpleapi':
    case 'forge_html':
    case 'forge_xml':
    case 'forge_datetime':
    // Wave 12 — Misc & Long Tail
    case 'forge_openweathermap':
    case 'forge_coingecko':
    case 'forge_urlscanio':
    case 'forge_marketstack':
    case 'forge_openthesaurus':
    case 'forge_nasa':
    case 'forge_strava':
    case 'forge_oura':
    case 'forge_spotify':
    case 'forge_zoom':
    // Waves 13-20 — inline-auth blocks
    case 'forge_lemlist':
    case 'forge_mailcheck':
    case 'forge_dropcontact':
    case 'forge_sendy':
    case 'forge_emelia':
    case 'forge_lonescale':
    case 'forge_autopilot':
    case 'forge_action_network':
    case 'forge_currents':
    case 'forge_bubble':
    case 'forge_bamboohr':
    case 'forge_clockify':
    case 'forge_harvest':
    case 'forge_gotowebinar':
    case 'forge_gong':
    case 'forge_freshservice':
    case 'forge_halopsa':
    case 'forge_adalo':
    case 'forge_onfleet':
    case 'forge_twist':
    case 'forge_twake':
    case 'forge_zulip':
    case 'forge_gotify':
    case 'forge_pushbullet':
    case 'forge_pushcut':
    case 'forge_pushover':
    case 'forge_mocean':
    case 'forge_msg91':
    case 'forge_signl4':
    case 'forge_facebook':
    case 'forge_questdb':
    case 'forge_cratedb':
    case 'forge_timescaledb':
    case 'forge_oracle':
    case 'forge_kafka':
    case 'forge_rabbitmq':
    case 'forge_mqtt':
    case 'forge_amqp':
    case 'forge_ldap':
    case 'forge_supabase':
    case 'forge_bitwarden':
    case 'forge_elastic_security':
    case 'forge_misp':
    case 'forge_thehive':
    case 'forge_security_scorecard':
    case 'forge_venafi':
    case 'forge_netscaler':
    case 'forge_okta':
    case 'forge_totp':
    case 'forge_jwt':
    case 'forge_philips_hue':
    case 'forge_home_assistant':
    case 'forge_filemaker':
    case 'forge_dhl':
    case 'forge_cisco_webex':
    case 'forge_cockpit':
    case 'forge_rundeck':
    case 'forge_splunk':
    case 'forge_contentful':
    case 'forge_metabase':
    case 'forge_uproc':
    case 'forge_unleashed_software':
    case 'forge_uplead':
    case 'forge_orbit':
    case 'forge_raindrop':
    case 'forge_quickbase':
    case 'forge_wise':
    case 'forge_uptimerobot':
    case 'forge_htmlextract':
    case 'forge_read_pdf':
    case 'forge_beeminder':
    case 'forge_npm':
    case 'forge_google_ads':
    case 'forge_edit_image':
    case 'forge_icalendar':
    case 'forge_flow':
    case 'forge_send_email_n8n':
    case 'forge_n8n_api':
    case 'forge_compression':
    case 'forge_wait_n8n':
    // Waves 21-24
    case 'forge_cron_n8n':
    case 'forge_interval_n8n':
    case 'forge_manual_trigger':
    case 'forge_n8n_trigger':
    case 'forge_workflow_trigger':
    case 'forge_error_trigger':
    case 'forge_sse_trigger':
    case 'forge_email_read_imap':
    case 'forge_local_file_trigger':
    case 'forge_respond_to_webhook':
    case 'forge_no_op':
    case 'forge_sticky_note':
    case 'forge_form_n8n':
    case 'forge_debug_helper':
    case 'forge_execute_command':
    case 'forge_execute_workflow':
    case 'forge_execution_data':
    case 'forge_move_binary_data':
    case 'forge_split_in_batches':
    case 'forge_transform_sort':
    case 'forge_read_binary_file':
    case 'forge_read_binary_files':
    case 'forge_write_binary_file':
    case 'forge_read_write_file':
    case 'forge_spreadsheet_file':
    case 'forge_simulate':
    case 'forge_e2e_test':
    case 'forge_time_saved':
    case 'forge_dynamic_credential_check':
    case 'forge_data_table':
    case 'forge_compare_datasets':
    case 'forge_evaluation':
    case 'forge_function_legacy':
    case 'forge_function_item_legacy':
    case 'forge_training_datastore':
    case 'forge_training_messenger':
    case 'forge_thehive_project':
    case 'forge_stop_and_error':
    case 'forge_ai_transform_v1':
    case 'forge_legacy_variants_info':
    // Waves 25-32
    case 'forge_aws_dynamodb':
    case 'forge_aws_ses':
    case 'forge_aws_sqs':
    case 'forge_aws_cognito':
    case 'forge_aws_comprehend':
    case 'forge_aws_rekognition':
    case 'forge_aws_textract':
    case 'forge_aws_transcribe':
    case 'forge_aws_cert_manager':
    case 'forge_aws_iam':
    case 'forge_google_drive':
    case 'forge_gmail':
    case 'forge_google_calendar':
    case 'forge_google_contacts':
    case 'forge_google_docs':
    case 'forge_google_slides':
    case 'forge_google_tasks':
    case 'forge_google_translate':
    case 'forge_youtube':
    case 'forge_google_analytics':
    case 'forge_google_bigquery':
    case 'forge_google_chat':
    case 'forge_google_cloud_storage':
    case 'forge_google_firestore':
    case 'forge_microsoft_excel':
    case 'forge_microsoft_onedrive':
    case 'forge_microsoft_outlook':
    case 'forge_microsoft_teams_full':
    case 'forge_microsoft_sharepoint':
    case 'forge_microsoft_todo':
    case 'forge_aggregate':
    case 'forge_limit':
    case 'forge_remove_duplicates':
    case 'forge_split_out':
    case 'forge_summarize':
    case 'forge_convert_to_file':
    case 'forge_extract_from_file':
    case 'forge_schedule_trigger':
    case 'forge_elasticsearch':
    case 'forge_venafi_cloud':
    case 'forge_lm_chat_anthropic':
    case 'forge_lm_chat_openai':
    case 'forge_lm_chat_ollama':
    case 'forge_lm_chat_bedrock':
    case 'forge_lm_chat_azure_openai':
    case 'forge_lm_chat_gemini':
    case 'forge_lm_chat_groq':
    case 'forge_lm_chat_mistral':
    case 'forge_lm_cohere':
    case 'forge_lm_chat_alibaba':
    case 'forge_embeddings_openai':
    case 'forge_embeddings_cohere':
    case 'forge_embeddings_mistral':
    case 'forge_embeddings_ollama':
    case 'forge_embeddings_gemini':
    case 'forge_embeddings_vertex':
    case 'forge_embeddings_bedrock':
    case 'forge_embeddings_azure_openai':
    case 'forge_embeddings_huggingface':
    case 'forge_cohere_rerank':
    case 'forge_vector_pinecone':
    case 'forge_vector_qdrant':
    case 'forge_vector_weaviate':
    case 'forge_vector_milvus':
    case 'forge_vector_pgvector':
    case 'forge_vector_supabase':
    case 'forge_vector_redis':
    case 'forge_vector_mongo':
    case 'forge_vector_chroma':
    case 'forge_vector_in_memory':
    case 'forge_lc_agent':
    case 'forge_lc_openai_assistant':
    case 'forge_lc_chain_llm':
    case 'forge_lc_chain_retrieval_qa':
    case 'forge_lc_chain_summarization':
    case 'forge_lc_information_extractor':
    case 'forge_lc_sentiment':
    case 'forge_lc_text_classifier':
    case 'forge_lc_tool_executor':
    case 'forge_lc_output_parser_json':
    // Waves 33-37
    case 'forge_mem_motorhead':
    case 'forge_mem_mongo':
    case 'forge_mem_redis':
    case 'forge_mem_xata':
    case 'forge_mem_zep':
    case 'forge_mem_postgres':
    case 'forge_mem_buffer_window':
    case 'forge_mem_buffer':
    case 'forge_mem_summary':
    case 'forge_mem_vector_summary':
    case 'forge_retriever_vector_store':
    case 'forge_retriever_workflow':
    case 'forge_retriever_multi_query':
    case 'forge_retriever_contextual_compression':
    case 'forge_doc_loader_binary':
    case 'forge_doc_loader_default':
    case 'forge_doc_loader_github':
    case 'forge_doc_loader_json':
    case 'forge_vendor_n8n_credentials':
    case 'forge_vendor_n8n_self':
    case 'forge_output_parser_structured':
    case 'forge_output_parser_autofix':
    case 'forge_text_splitter_character':
    case 'forge_text_splitter_recursive':
    case 'forge_text_splitter_token':
    case 'forge_guardrails_topical':
    case 'forge_guardrails_safety':
    case 'forge_guardrails_pii':
    case 'forge_mcp_client':
    case 'forge_tools_calculator':
    case 'forge_hubspot_trigger':
    case 'forge_shopify_trigger':
    case 'forge_gitlab_trigger':
    case 'forge_mailchimp_trigger':
    case 'forge_stripe_trigger':
    case 'forge_woocommerce_trigger':
    case 'forge_strava_trigger':
    case 'forge_activecampaign_trigger':
    case 'forge_box_trigger':
    case 'forge_calendly_trigger':
    case 'forge_pipedrive_trigger':
    case 'forge_trello_trigger':
    case 'forge_clickup_trigger':
    case 'forge_asana_trigger':
    case 'forge_jira_trigger':
    case 'forge_linear_trigger':
    case 'forge_notion_trigger':
    case 'forge_airtable_trigger':
    case 'forge_telegram_trigger':
    case 'forge_slack_trigger':
    // Final sweep — 60 trigger shims
    case 'forge_acuity_trigger':
    case 'forge_affinity_trigger':
    case 'forge_amqp_trigger':
    case 'forge_autopilot_trigger':
    case 'forge_aws_trigger':
    case 'forge_bitbucket_trigger':
    case 'forge_brevo_trigger':
    case 'forge_cal_trigger':
    case 'forge_chargebee_trigger':
    case 'forge_eventbrite_trigger':
    case 'forge_cisco_webex_trigger':
    case 'forge_clockify_trigger':
    case 'forge_convertkit_trigger':
    case 'forge_copper_trigger':
    case 'forge_currents_trigger':
    case 'forge_customerio_trigger':
    case 'forge_emelia_trigger':
    case 'forge_facebook_trigger':
    case 'forge_facebook_lead_ads_trigger':
    case 'forge_figma_trigger':
    case 'forge_flow_trigger':
    case 'forge_form_trigger':
    case 'forge_formio_trigger':
    case 'forge_formstack_trigger':
    case 'forge_getresponse_trigger':
    case 'forge_gumroad_trigger':
    case 'forge_helpscout_trigger':
    case 'forge_invoiceninja_trigger':
    case 'forge_jotform_trigger':
    case 'forge_kafka_trigger':
    case 'forge_keap_trigger':
    case 'forge_kobotoolbox_trigger':
    case 'forge_lemlist_trigger':
    case 'forge_lonescale_trigger':
    case 'forge_mqtt_trigger':
    case 'forge_mailjet_trigger':
    case 'forge_mautic_trigger':
    case 'forge_microsoft_outlook_trigger':
    case 'forge_microsoft_teams_trigger':
    case 'forge_mailerlite_trigger':
    case 'forge_netlify_trigger':
    case 'forge_onfleet_trigger':
    case 'forge_paypal_trigger':
    case 'forge_postgres_trigger':
    case 'forge_postmark_trigger':
    case 'forge_pushcut_trigger':
    case 'forge_rabbitmq_trigger':
    case 'forge_redis_trigger':
    case 'forge_seatable_trigger':
    case 'forge_salesforce_trigger':
    case 'forge_surveymonkey_trigger':
    case 'forge_taiga_trigger':
    case 'forge_thehive_trigger':
    case 'forge_toggl_trigger':
    case 'forge_twilio_trigger':
    case 'forge_typeform_trigger':
    case 'forge_venafi_trigger':
    case 'forge_wise_trigger':
    case 'forge_workable_trigger':
    case 'forge_wufoo_trigger':
    // Final sweep — subfolder extras
    case 'forge_gsuite_admin':
    case 'forge_google_business_profile':
    case 'forge_google_books':
    case 'forge_google_cnl':
    case 'forge_google_perspective':
    case 'forge_google_firebase_rtdb':
    case 'forge_azure_cosmos_db':
    case 'forge_microsoft_entra':
    case 'forge_microsoft_graph_security':
    case 'forge_azure_storage':
    // Final sweep — LangChain vendors / tools
    case 'forge_tool_wikipedia':
    case 'forge_tool_serpapi':
    case 'forge_tool_wolframalpha':
    case 'forge_tool_sql':
    case 'forge_tool_http_request':
    case 'forge_tool_code':
    case 'forge_tool_calculator_n8n':
    case 'forge_tool_workflow':
    case 'forge_tool_vector_store':
    case 'forge_tool_think':
    // Final sweep — utility V1/V2 compat-shims
    case 'forge_set_v1':
    case 'forge_set_v2':
    case 'forge_switch_v1':
    case 'forge_switch_v2':
    case 'forge_if_v1':
    case 'forge_filter_v1':
    case 'forge_merge_v1':
    case 'forge_merge_v2':
    case 'forge_http_request_v1':
    case 'forge_http_request_v2':
    // Final sweep — service V1 compat-shims
    case 'forge_slack_v1':
    case 'forge_hubspot_v1':
    case 'forge_discord_v1':
    case 'forge_pipedrive_v1':
    case 'forge_notion_v1':
    case 'forge_airtable_v1':
    case 'forge_twitter_v1':
    case 'forge_mattermost_v1':
    case 'forge_splunk_v1':
    case 'forge_lemlist_v1':
      return { credentialId: '', __action: '' };

    default:
      return {};
  }
}

export { BLOCK_REGISTRY };
