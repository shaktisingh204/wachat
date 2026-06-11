/**
 * Brand-LOGO mapping for SabFlow blocks — returns an Iconify icon name
 * rendered via `@iconify/react`'s `<Icon icon="..." />`.
 *
 * Goal: match n8n's canvas where every integration node shows the **full-
 * colour official brand logo** (OpenAI green swirl, Slack multi-colour
 * mark, etc.) — not a single-colour silhouette.
 *
 * Iconset choice:
 *   • `logos:<slug>` — full-colour multi-tone SVGs in the official brand
 *     palette. THIS is what n8n's nodes show. Use this whenever possible.
 *   • `skill-icons:<slug>` — same look-and-feel for a few brands not in
 *     `logos:` (mostly dev tools).
 *   • `simple-icons:<slug>` — monochrome silhouette. ONLY use as a last
 *     resort for brands the colour collections don't have (and let the
 *     renderer tint it with the block's category colour).
 *   • `mdi:<slug>` — material-design system icons (HTTP, webhook, SSH,
 *     etc.) for non-branded generic primitives.
 *
 * Browse / verify icon names at https://icon-sets.iconify.design.
 *
 * Resolution order in `getBlockBrandIcon(type)`:
 *   1. Explicit override in `BLOCK_BRAND_ICONS`
 *   2. Derived from the `forge_<provider>` suffix against `KNOWN_PROVIDERS`
 *   3. `null` — caller falls back to the existing Lucide icon
 */

/* ── Explicit overrides — prefer `logos:` (full-colour) ──────────────────── */

const BLOCK_BRAND_ICONS: Record<string, string> = {
  // ── Messaging ─────────────────────────────────────────────────────────
  forge_slack: 'logos:slack-icon',
  forge_slack_v1: 'logos:slack-icon',
  forge_discord: 'logos:discord-icon',
  forge_discord_v1: 'logos:discord-icon',
  forge_telegram: 'logos:telegram',
  forge_whatsapp: 'logos:whatsapp-icon',
  forge_microsoft_teams: 'logos:microsoft-teams',
  forge_mattermost: 'logos:mattermost-icon',
  forge_mattermost_v1: 'logos:mattermost-icon',
  forge_rocketchat: 'logos:rocket-chat',
  forge_line: 'logos:line',
  forge_signal: 'logos:signal',
  forge_messagebird: 'logos:messagebird-icon',
  forge_twilio: 'logos:twilio-icon',
  forge_vonage: 'logos:vonage',
  forge_plivo: 'logos:plivo',
  forge_matrix: 'logos:matrix-icon',

  // ── Productivity / docs ───────────────────────────────────────────────
  forge_notion: 'logos:notion-icon',
  forge_notion_v1: 'logos:notion-icon',
  forge_airtable: 'logos:airtable',
  forge_airtable_v1: 'logos:airtable',
  forge_google_sheets: 'logos:google-sheets',
  forge_google_drive: 'logos:google-drive',
  forge_google_calendar: 'logos:google-calendar',
  forge_google_docs: 'logos:google-docs',
  forge_google_analytics: 'logos:google-analytics',
  forge_google_contacts: 'logos:google-icon',
  forge_evernote: 'logos:evernote',
  forge_coda: 'logos:coda-icon',
  forge_clickup: 'logos:clickup-icon',
  forge_clickup_trigger: 'logos:clickup-icon',
  forge_monday: 'logos:monday-icon',
  forge_asana: 'logos:asana-icon',
  forge_asana_trigger: 'logos:asana-icon',
  forge_trello: 'logos:trello',
  forge_todoist: 'logos:todoist-icon',
  forge_cal_com: 'logos:cal',
  forge_cal_trigger: 'logos:cal',
  forge_calendly_trigger: 'logos:calendly',
  forge_jira: 'logos:jira',
  forge_confluence: 'logos:confluence',
  forge_linear: 'logos:linear-icon',

  // ── CRM ───────────────────────────────────────────────────────────────
  forge_hubspot: 'logos:hubspot',
  forge_hubspot_v1: 'logos:hubspot',
  forge_salesforce: 'logos:salesforce',
  forge_pipedrive: 'logos:pipedrive',
  forge_pipedrive_v1: 'logos:pipedrive',
  forge_zoho_crm: 'logos:zoho',
  forge_activecampaign: 'logos:activecampaign',
  forge_activecampaign_trigger: 'logos:activecampaign',
  forge_intercom: 'logos:intercom-icon',
  forge_freshworks_crm: 'logos:freshworks',
  forge_freshdesk: 'logos:freshworks',
  forge_copper: 'simple-icons:copper',
  forge_copper_trigger: 'simple-icons:copper',
  forge_agile_crm: 'simple-icons:agile',
  forge_customerio: 'simple-icons:customerio',
  forge_customerio_trigger: 'simple-icons:customerio',
  forge_drift: 'simple-icons:drift',

  // ── Email / marketing ────────────────────────────────────────────────
  forge_mailchimp: 'logos:mailchimp-icon',
  forge_mailgun: 'logos:mailgun-icon',
  forge_mailjet: 'logos:mailjet',
  forge_mandrill: 'logos:mailchimp-icon',
  forge_brevo: 'logos:brevo',
  forge_brevo_trigger: 'logos:brevo',
  forge_sendgrid: 'logos:sendgrid-icon',
  forge_sendgrid_ext: 'logos:sendgrid-icon',
  forge_convertkit: 'logos:convertkit',
  forge_convertkit_trigger: 'logos:convertkit',
  forge_getresponse: 'simple-icons:getresponse',
  forge_mailerlite: 'simple-icons:mailerlite',
  forge_lemlist: 'logos:lemlist',
  forge_lemlist_v1: 'logos:lemlist',
  forge_postmark: 'logos:postmark',

  // ── Developer / dev-ops ──────────────────────────────────────────────
  forge_github: 'logos:github-icon',
  forge_gitlab: 'logos:gitlab',
  forge_bitbucket: 'logos:bitbucket',
  forge_bitbucket_trigger: 'logos:bitbucket',
  forge_circleci: 'logos:circleci',
  forge_jenkins: 'logos:jenkins',
  forge_travis: 'logos:travis-ci',
  forge_npm: 'logos:npm-icon',
  forge_docker: 'logos:docker-icon',

  // ── e-Commerce / payments ────────────────────────────────────────────
  forge_shopify: 'logos:shopify',
  forge_woocommerce: 'logos:woocommerce-icon',
  forge_stripe: 'logos:stripe',
  forge_paypal: 'logos:paypal',
  forge_square: 'logos:square',
  forge_quickbooks: 'logos:quickbooks',
  forge_xero: 'logos:xero',

  // ── Storage / files ──────────────────────────────────────────────────
  forge_dropbox: 'logos:dropbox',
  forge_box: 'logos:box',
  forge_box_trigger: 'logos:box',
  forge_nextcloud: 'logos:nextcloud',
  forge_aws_s3: 'logos:aws-s3',
  forge_azure_storage: 'logos:microsoft-azure',
  forge_ftp: 'mdi:folder-network',
  forge_ssh: 'mdi:console-network',

  // ── Databases ────────────────────────────────────────────────────────
  forge_postgres: 'logos:postgresql',
  forge_mysql: 'logos:mysql-icon',
  forge_mongodb: 'logos:mongodb-icon',
  forge_redis: 'logos:redis',
  forge_snowflake: 'logos:snowflake-icon',
  forge_cratedb: 'simple-icons:crate',
  forge_supabase: 'logos:supabase-icon',
  forge_baserow: 'simple-icons:baserow',
  forge_azure_cosmos_db: 'logos:microsoft-azure',
  forge_aws_dynamodb: 'logos:aws-dynamodb',

  // ── AI / ML / LLM ────────────────────────────────────────────────────
  forge_openai: 'logos:openai-icon',
  forge_anthropic: 'logos:anthropic-icon',
  forge_cohere_rerank: 'logos:cohere',
  forge_deepl: 'logos:deepl',
  forge_huggingface: 'logos:hugging-face-icon',
  forge_google_gemini: 'logos:google-gemini',
  forge_mistral: 'logos:mistral-ai-icon',
  forge_together_ai: 'logos:meta-icon',
  forge_perplexity: 'logos:perplexity',

  // ── Analytics / observability ────────────────────────────────────────
  forge_segment: 'logos:segment-icon',
  forge_mixpanel: 'logos:mixpanel-icon',
  forge_amplitude: 'logos:amplitude-icon',
  forge_splunk: 'logos:splunk-icon',
  forge_splunk_v1: 'logos:splunk-icon',
  forge_datadog: 'logos:datadog',
  forge_grafana: 'logos:grafana',
  forge_sentry: 'logos:sentry-icon',

  // ── Social / misc ────────────────────────────────────────────────────
  forge_twitter: 'logos:x',
  forge_twitter_v1: 'logos:x',
  forge_facebook: 'logos:facebook',
  forge_instagram: 'skill-icons:instagram',
  forge_linkedin: 'logos:linkedin-icon',
  forge_youtube: 'logos:youtube-icon',
  forge_reddit: 'logos:reddit-icon',
  forge_medium: 'logos:medium',
  forge_wordpress: 'logos:wordpress-icon',
  forge_webflow: 'logos:webflow',
  forge_zoom: 'logos:zoom-icon',
  forge_typeform: 'logos:typeform-icon',
  forge_zendesk: 'simple-icons:zendesk',

  // ── Generic core blocks (forge versions of platform primitives) ───────
  forge_http_request: 'mdi:web',
  forge_http_request_v1: 'mdi:web',
  forge_http_request_v2: 'mdi:web',
  forge_webhook: 'mdi:webhook',
  forge_graphql: 'logos:graphql',
  forge_crypto: 'mdi:shield-key-outline',

  // ── Built-in (non-forge) integrations ─────────────────────────────────
  webhook: 'mdi:webhook',
  send_email: 'mdi:email-outline',
  google_sheets: 'logos:google-sheets',
  google_analytics: 'logos:google-analytics',
  open_ai: 'logos:openai-icon',
  zapier: 'simple-icons:zapier',
  make_com: 'simple-icons:makerbot',
  pabbly_connect: 'mdi:connection',
  chatwoot: 'simple-icons:chatwoot',
  cal_com: 'logos:cal',
  nocodb: 'simple-icons:nocodb',
  elevenlabs: 'logos:elevenlabs',
  anthropic: 'logos:anthropic-icon',
  together_ai: 'logos:meta-icon',
  mistral: 'logos:mistral-ai-icon',
};

/* ── Derivation fallback ─────────────────────────────────────────────────── */

/**
 * Last-chance derivation: turns `forge_<provider>` into a guessed iconify
 * name when no explicit mapping exists. Conservative — only returns a value
 * for providers known to have a clean simple-icons slug, so we don't render
 * a broken icon URL.
 */
const KNOWN_PROVIDERS = new Set<string>([
  'spotify', 'figma', 'gmail', 'okta', 'auth0', 'cloudflare', 'fastly',
  'algolia', 'pingdom', 'kafka', 'rabbitmq', 'elasticsearch', 'newrelic',
  'pagerduty', 'opsgenie', 'statuspage', 'twilio', 'gitter', 'flock',
  'gotowebinar', 'workable', 'humanitec', 'humantic', 'tally', 'shopware',
  'magento', 'bigcommerce',
]);

function deriveBrand(type: string): string | null {
  if (!type.startsWith('forge_')) return null;
  const provider = type
    .replace(/^forge_/, '')
    .replace(/_(v\d+|trigger|node|ext)$/g, '')
    .replace(/_/g, '');
  if (!provider) return null;
  // simple-icons (monochrome) — last-resort fallback for brands that don't
  // ship a coloured `logos:` SVG. Keep this conservative; rather have a
  // tinted Lucide icon than render a broken icon URL.
  if (KNOWN_PROVIDERS.has(provider)) return `simple-icons:${provider}`;
  return null;
}

/* ── Public API ──────────────────────────────────────────────────────────── */

/**
 * Returns an iconify icon name for the given block type, or `null` when
 * no brand icon is mapped. Callers should fall back to their existing
 * Lucide icon when this returns null.
 */
export function getBlockBrandIcon(type: string): string | null {
  return BLOCK_BRAND_ICONS[type] ?? deriveBrand(type);
}

/**
 * Speculative brand icon for a normalized app-catalog slug (lowercase,
 * separator-free, e.g. `openai`, `googlesheets`, `webflowtrigger`).
 *
 * Returns a `logos:` candidate name. The `logos:` collection is full-colour
 * official marks, so it is the best-looking guess — but the name is NOT
 * verified to exist. Callers MUST render it with a fallback (e.g.
 * `<Icon icon={name} fallback={<LucideIcon/>} />`) because Iconify renders
 * nothing for missing icons.
 */
export function getBrandIconForSlug(slug: string | null | undefined): string | null {
  if (!slug) return null;
  // Trigger variants share the provider's mark (`slacktrigger` → `slack`).
  const base = slug.replace(/trigger$/, '');
  if (!base || !/^[a-z0-9]+$/.test(base)) return null;
  return `logos:${base}`;
}

/** Total count of explicitly-mapped blocks (exposed for tests). */
export const BRAND_ICON_COUNT = Object.keys(BLOCK_BRAND_ICONS).length;
