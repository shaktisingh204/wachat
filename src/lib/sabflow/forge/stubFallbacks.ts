/**
 * Rust-stub → forge fallback map.
 *
 * The Rust `sabflow-nodes` crate publishes descriptors for ~230 integrations
 * that don't yet have executors implemented on the Rust side.  The
 * `NodeSettings` panel renders a "stub" banner for these.  Without a
 * fallback, users hit a dead end — the block configures fine but never runs.
 *
 * This map tells the editor "we already have a working forge block for that
 * functionality" so users can swap the stub for the equivalent forge block
 * in one click.  Forge blocks are full TypeScript implementations
 * (`src/lib/sabflow/forge/blocks/`) and run end-to-end.
 *
 * Curated by likely usage — focused on AI, messaging, email, databases,
 * CRM, and storage where forge already has coverage.  Adding more is a
 * one-line config change.
 */

/** Suggested forge replacement for a Rust stub block type. */
export type StubFallback = {
  /** The forge block type slug to swap to (must match Block.type). */
  forgeType: string;
  /** Short human label for the dropdown / button. */
  label: string;
  /**
   * One-line rationale shown alongside the suggestion.  Helps users decide
   * when the forge replacement is "close enough" but not identical.
   */
  rationale: string;
};

/**
 * Map of `rust_node_name` (or `rust_node_name_with_underscores`) →
 * forge fallback.
 *
 * Keys are tried in this order:
 *   1. exact match on the rust descriptor name
 *   2. snake_case rewrite of camelCase
 *   3. lowercase canonicalisation
 */
export const STUB_FALLBACKS: Record<string, StubFallback> = {
  /* ── AI providers ─────────────────────────────────────── */
  openai: {
    forgeType: 'open_ai',
    label: 'OpenAI (native)',
    rationale: 'Use the built-in OpenAI block — chat completions, transcription, images.',
  },
  anthropic: {
    forgeType: 'anthropic',
    label: 'Anthropic (native)',
    rationale: 'Use the built-in Anthropic block for Claude chat completions.',
  },
  mistral: {
    forgeType: 'mistral',
    label: 'Mistral (native)',
    rationale: 'Use the built-in Mistral block.',
  },
  togetherAi: {
    forgeType: 'together_ai',
    label: 'Together AI (native)',
    rationale: 'Use the built-in Together AI block.',
  },
  elevenLabs: {
    forgeType: 'forge_audio_elevenlabs_tts',
    label: 'ElevenLabs TTS (forge)',
    rationale: 'Text-to-speech via the ElevenLabs forge block.',
  },

  /* ── Messaging / Communication ────────────────────────── */
  slack: {
    forgeType: 'forge_slack',
    label: 'Slack (forge)',
    rationale: 'Full Slack support — messages, channels, files via forge.',
  },
  discord: {
    forgeType: 'forge_discord',
    label: 'Discord (forge)',
    rationale: 'Send Discord messages via webhook or bot token.',
  },
  twilio: {
    forgeType: 'forge_twilio',
    label: 'Twilio (forge)',
    rationale: 'Send SMS / WhatsApp / voice via Twilio forge block.',
  },

  /* ── Email ───────────────────────────────────────────── */
  emailSend: {
    forgeType: 'send_email',
    label: 'Send Email (native)',
    rationale: 'Use the native Send Email block with workspace SMTP or custom.',
  },
  sendGrid: {
    forgeType: 'forge_sendgrid',
    label: 'SendGrid (forge)',
    rationale: 'Transactional email via SendGrid.',
  },
  mailgun: {
    forgeType: 'send_email',
    label: 'Send Email (with Mailgun SMTP)',
    rationale: 'Configure custom SMTP pointing at Mailgun on the Send Email block.',
  },
  resend: {
    forgeType: 'send_email',
    label: 'Send Email (with Resend SMTP)',
    rationale: 'Configure custom SMTP pointing at Resend on the Send Email block.',
  },

  /* ── HTTP / Webhooks ─────────────────────────────────── */
  httpRequest: {
    forgeType: 'webhook',
    label: 'HTTP Request (native)',
    rationale: 'Use the native HTTP Request block — supports auth, headers, body.',
  },
  webhook: {
    forgeType: 'webhook',
    label: 'HTTP Request (native)',
    rationale: 'Use the native HTTP Request block for arbitrary REST calls.',
  },
  respondToWebhook: {
    forgeType: 'forge_respond_to_webhook',
    label: 'Respond to Webhook (forge)',
    rationale: 'Send a custom HTTP response from a webhook trigger.',
  },

  /* ── Storage / Productivity ──────────────────────────── */
  googleSheets: {
    forgeType: 'google_sheets',
    label: 'Google Sheets (native)',
    rationale: 'Use the native Google Sheets block — get/insert/update/delete rows.',
  },
  notion: {
    forgeType: 'forge_notion',
    label: 'Notion (forge)',
    rationale: 'CRUD against Notion databases via forge.',
  },
  airtable: {
    forgeType: 'forge_airtable',
    label: 'Airtable (forge)',
    rationale: 'Query and write Airtable bases via forge.',
  },
  github: {
    forgeType: 'forge_github',
    label: 'GitHub (forge)',
    rationale: 'Issues, PRs, repositories via the GitHub forge block.',
  },

  /* ── Generic logic / utility ─────────────────────────── */
  if: {
    forgeType: 'condition',
    label: 'Condition (native)',
    rationale: 'Use the native Condition block — supports AND/OR groups.',
  },
  switch: {
    forgeType: 'switch',
    label: 'Switch (native)',
    rationale: 'Use the native Switch block with named output pins.',
  },
  set: {
    forgeType: 'set_variable',
    label: 'Set Variable (native)',
    rationale: 'Use the native Set Variable block.',
  },
  code: {
    forgeType: 'script',
    label: 'Script (native)',
    rationale: 'Use the native Script block — JS sandbox with timeouts.',
  },
  wait: {
    forgeType: 'wait',
    label: 'Wait (native)',
    rationale: 'Use the native Wait block — seconds/minutes/hours.',
  },
  merge: {
    forgeType: 'merge',
    label: 'Merge (native)',
    rationale: 'Use the native Merge block — append / mergeByKey / multiplex.',
  },
  splitInBatches: {
    forgeType: 'loop',
    label: 'Loop (native)',
    rationale: 'Use the native Loop block — sequential/parallel, batch size, max iterations.',
  },
  filter: {
    forgeType: 'filter',
    label: 'Filter (native)',
    rationale: 'Use the native Filter block.',
  },
  sort: {
    forgeType: 'sort',
    label: 'Sort (native)',
    rationale: 'Use the native Sort block.',
  },

  /* ── Dev / project-management SaaS ───────────────────── */
  linear: {
    forgeType: 'webhook',
    label: 'HTTP Request → Linear GraphQL',
    rationale: 'Drive https://api.linear.app/graphql via the HTTP Request block with an OAuth bearer credential.',
  },
  jira: {
    forgeType: 'webhook',
    label: 'HTTP Request → Jira REST',
    rationale: 'Drive Atlassian REST via the HTTP Request block with basic auth.',
  },
  gitlab: {
    forgeType: 'webhook',
    label: 'HTTP Request → GitLab API',
    rationale: 'Drive https://gitlab.com/api/v4 via HTTP Request with a Personal Access Token.',
  },
  bitbucket: {
    forgeType: 'webhook',
    label: 'HTTP Request → Bitbucket Cloud',
    rationale: 'Drive Bitbucket Cloud REST via HTTP Request with an app password.',
  },
  asana: {
    forgeType: 'webhook',
    label: 'HTTP Request → Asana API',
    rationale: 'Drive https://app.asana.com/api/1.0 via HTTP Request with a Personal Access Token.',
  },
  trello: {
    forgeType: 'webhook',
    label: 'HTTP Request → Trello REST',
    rationale: 'Drive https://api.trello.com/1 via HTTP Request with key + token.',
  },
  monday: {
    forgeType: 'webhook',
    label: 'HTTP Request → Monday.com GraphQL',
    rationale: 'Drive https://api.monday.com/v2 via HTTP Request with an API key.',
  },
  clickup: {
    forgeType: 'webhook',
    label: 'HTTP Request → ClickUp API v2',
    rationale: 'Drive https://api.clickup.com/api/v2 via HTTP Request.',
  },
  coda: {
    forgeType: 'webhook',
    label: 'HTTP Request → Coda v1',
    rationale: 'Drive https://coda.io/apis/v1 via HTTP Request.',
  },
  confluence: {
    forgeType: 'webhook',
    label: 'HTTP Request → Confluence REST',
    rationale: 'Drive Atlassian Confluence REST via HTTP Request.',
  },

  /* ── CRM / Marketing ─────────────────────────────────── */
  pipedrive: {
    forgeType: 'webhook',
    label: 'HTTP Request → Pipedrive v1',
    rationale: 'Drive https://api.pipedrive.com/v1 with an API token via HTTP Request.',
  },
  activeCampaign: {
    forgeType: 'webhook',
    label: 'HTTP Request → ActiveCampaign',
    rationale: 'Drive {ACCOUNT}.api-us1.com/api/3 via HTTP Request with Api-Token header.',
  },
  mailchimp: {
    forgeType: 'webhook',
    label: 'HTTP Request → Mailchimp 3.0',
    rationale: 'Drive {dc}.api.mailchimp.com/3.0 via HTTP Request with API-key auth.',
  },
  klaviyo: {
    forgeType: 'webhook',
    label: 'HTTP Request → Klaviyo',
    rationale: 'Drive https://a.klaviyo.com/api via HTTP Request with private key.',
  },
  intercom: {
    forgeType: 'webhook',
    label: 'HTTP Request → Intercom',
    rationale: 'Drive https://api.intercom.io via HTTP Request with bearer token.',
  },
  zendesk: {
    forgeType: 'webhook',
    label: 'HTTP Request → Zendesk REST',
    rationale: 'Drive {SUBDOMAIN}.zendesk.com/api/v2 via HTTP Request.',
  },
  freshdesk: {
    forgeType: 'webhook',
    label: 'HTTP Request → Freshdesk',
    rationale: 'Drive {SUBDOMAIN}.freshdesk.com/api/v2 via HTTP Request.',
  },

  /* ── Analytics / observability ───────────────────────── */
  mixpanel: {
    forgeType: 'webhook',
    label: 'HTTP Request → Mixpanel',
    rationale: 'POST events to https://api.mixpanel.com/track via HTTP Request.',
  },
  amplitude: {
    forgeType: 'webhook',
    label: 'HTTP Request → Amplitude',
    rationale: 'POST events to https://api2.amplitude.com/2/httpapi via HTTP Request.',
  },
  segmentAnalytics: {
    forgeType: 'segment',
    label: 'Segment (native)',
    rationale: 'Use the native Segment block — track/identify/group events.',
  },
  posthog: {
    forgeType: 'webhook',
    label: 'HTTP Request → PostHog',
    rationale: 'POST to {host}/capture/ via HTTP Request with project API key.',
  },
  googleAnalytics: {
    forgeType: 'google_analytics',
    label: 'Google Analytics (native)',
    rationale: 'Use the native GA4 block — measurement protocol events.',
  },

  /* ── Storage ─────────────────────────────────────────── */
  dropbox: {
    forgeType: 'webhook',
    label: 'HTTP Request → Dropbox v2',
    rationale: 'Drive https://api.dropboxapi.com/2 via HTTP Request with OAuth bearer.',
  },
  box: {
    forgeType: 'webhook',
    label: 'HTTP Request → Box',
    rationale: 'Drive https://api.box.com/2.0 via HTTP Request with OAuth bearer.',
  },
  s3: {
    forgeType: 'webhook',
    label: 'HTTP Request → S3 (with signed URL)',
    rationale: 'Pre-sign uploads on your backend, then HTTP Request handles the PUT.',
  },
  awsS3: {
    forgeType: 'webhook',
    label: 'HTTP Request → S3 (with signed URL)',
    rationale: 'Pre-sign uploads on your backend, then HTTP Request handles the PUT.',
  },
  gcs: {
    forgeType: 'webhook',
    label: 'HTTP Request → GCS (signed URL)',
    rationale: 'Pre-sign with a service account, then HTTP Request handles the PUT.',
  },
  oneDrive: {
    forgeType: 'webhook',
    label: 'HTTP Request → OneDrive (Graph)',
    rationale: 'Drive https://graph.microsoft.com/v1.0/me/drive via HTTP Request.',
  },
  googleDrive: {
    forgeType: 'webhook',
    label: 'HTTP Request → Google Drive v3',
    rationale: 'Drive https://www.googleapis.com/drive/v3 via HTTP Request with OAuth bearer.',
  },

  /* ── AI / LLM extras ─────────────────────────────────── */
  replicate: {
    forgeType: 'webhook',
    label: 'HTTP Request → Replicate',
    rationale: 'Drive https://api.replicate.com/v1 via HTTP Request with API token.',
  },
  huggingFace: {
    forgeType: 'webhook',
    label: 'HTTP Request → Hugging Face',
    rationale: 'Drive https://api-inference.huggingface.co/models via HTTP Request.',
  },
  perplexity: {
    forgeType: 'webhook',
    label: 'HTTP Request → Perplexity',
    rationale: 'Drive https://api.perplexity.ai via HTTP Request with bearer token.',
  },
  cohere: {
    forgeType: 'webhook',
    label: 'HTTP Request → Cohere',
    rationale: 'Drive https://api.cohere.ai/v1 via HTTP Request with bearer token.',
  },
  pinecone: {
    forgeType: 'webhook',
    label: 'HTTP Request → Pinecone',
    rationale: 'Drive {index}-{project}.svc.{env}.pinecone.io via HTTP Request.',
  },
  weaviate: {
    forgeType: 'webhook',
    label: 'HTTP Request → Weaviate',
    rationale: 'Drive {host}/v1 via HTTP Request with bearer token.',
  },

  /* ── Calendaring / video ─────────────────────────────── */
  googleCalendar: {
    forgeType: 'webhook',
    label: 'HTTP Request → Google Calendar v3',
    rationale: 'Drive https://www.googleapis.com/calendar/v3 via HTTP Request with OAuth bearer.',
  },
  outlookCalendar: {
    forgeType: 'webhook',
    label: 'HTTP Request → Outlook (Graph)',
    rationale: 'Drive https://graph.microsoft.com/v1.0/me/events via HTTP Request.',
  },
  zoom: {
    forgeType: 'webhook',
    label: 'HTTP Request → Zoom API',
    rationale: 'Drive https://api.zoom.us/v2 via HTTP Request with OAuth bearer.',
  },
  calComScheduling: {
    forgeType: 'cal_com',
    label: 'Cal.com (native)',
    rationale: 'Use the native Cal.com block — bookings, availability.',
  },

  /* ── E-commerce ──────────────────────────────────────── */
  shopify: {
    forgeType: 'webhook',
    label: 'HTTP Request → Shopify Admin',
    rationale: 'Drive {shop}.myshopify.com/admin/api/2024-04 via HTTP Request.',
  },
  woocommerce: {
    forgeType: 'webhook',
    label: 'HTTP Request → WooCommerce REST',
    rationale: 'Drive {site}/wp-json/wc/v3 via HTTP Request with API key/secret.',
  },
  stripeCommerce: {
    forgeType: 'webhook',
    label: 'HTTP Request → Stripe',
    rationale: 'Drive https://api.stripe.com/v1 via HTTP Request with secret key.',
  },

  /* ── Workflow & automation ──────────────────────────── */
  zapier: {
    forgeType: 'zapier',
    label: 'Zapier (native)',
    rationale: 'Use the native Zapier block — webhook trigger to your Zap.',
  },
  makeCom: {
    forgeType: 'make_com',
    label: 'Make.com (native)',
    rationale: 'Use the native Make.com block — scenario webhook.',
  },
  pabblyConnect: {
    forgeType: 'pabbly_connect',
    label: 'Pabbly Connect (native)',
    rationale: 'Use the native Pabbly Connect block.',
  },

  /* ── DevOps / observability ─────────────────────────── */
  jenkins: {
    forgeType: 'webhook',
    label: 'HTTP Request → Jenkins REST',
    rationale: 'Trigger Jenkins jobs via {host}/job/{name}/build with Basic auth.',
  },
  circleCi: {
    forgeType: 'webhook',
    label: 'HTTP Request → CircleCI v2',
    rationale: 'Drive https://circleci.com/api/v2 via HTTP Request with API token.',
  },
  travisCi: {
    forgeType: 'webhook',
    label: 'HTTP Request → Travis CI',
    rationale: 'Drive https://api.travis-ci.com/v3 via HTTP Request.',
  },
  datadog: {
    forgeType: 'webhook',
    label: 'HTTP Request → Datadog v1/v2',
    rationale: 'Drive https://api.datadoghq.com/api/v2 via HTTP Request with DD-API-KEY.',
  },
  sentry: {
    forgeType: 'webhook',
    label: 'HTTP Request → Sentry API',
    rationale: 'Drive https://sentry.io/api/0 via HTTP Request with bearer token.',
  },
  pagerDuty: {
    forgeType: 'webhook',
    label: 'HTTP Request → PagerDuty Events v2',
    rationale: 'POST to https://events.pagerduty.com/v2/enqueue via HTTP Request.',
  },
  newRelic: {
    forgeType: 'webhook',
    label: 'HTTP Request → New Relic',
    rationale: 'Drive https://api.newrelic.com/v2 via HTTP Request with Api-Key.',
  },
  grafana: {
    forgeType: 'webhook',
    label: 'HTTP Request → Grafana API',
    rationale: 'Drive {host}/api via HTTP Request with bearer token.',
  },
  opsGenie: {
    forgeType: 'webhook',
    label: 'HTTP Request → OpsGenie v2',
    rationale: 'Drive https://api.opsgenie.com/v2 via HTTP Request with GenieKey header.',
  },
  rollbar: {
    forgeType: 'webhook',
    label: 'HTTP Request → Rollbar API',
    rationale: 'Drive https://api.rollbar.com/api/1 via HTTP Request.',
  },
  statuspage: {
    forgeType: 'webhook',
    label: 'HTTP Request → Statuspage v1',
    rationale: 'Drive https://api.statuspage.io/v1 via HTTP Request.',
  },

  /* ── Communications (extras) ────────────────────────── */
  microsoftTeams: {
    forgeType: 'webhook',
    label: 'HTTP Request → Teams (Graph)',
    rationale: 'POST to https://graph.microsoft.com/v1.0/teams/{id}/channels/{ch}/messages via HTTP Request.',
  },
  whatsappBusiness: {
    forgeType: 'webhook',
    label: 'HTTP Request → WhatsApp Cloud API',
    rationale: 'Drive https://graph.facebook.com/v18.0/{phone-id}/messages via HTTP Request.',
  },
  viber: {
    forgeType: 'webhook',
    label: 'HTTP Request → Viber',
    rationale: 'Drive https://chatapi.viber.com/pa via HTTP Request with X-Viber-Auth-Token.',
  },
  line: {
    forgeType: 'webhook',
    label: 'HTTP Request → LINE Messaging',
    rationale: 'Drive https://api.line.me/v2 via HTTP Request with bearer token.',
  },
  wechat: {
    forgeType: 'webhook',
    label: 'HTTP Request → WeChat',
    rationale: 'Drive https://api.weixin.qq.com via HTTP Request with access_token.',
  },
  mattermost: {
    forgeType: 'webhook',
    label: 'HTTP Request → Mattermost v4',
    rationale: 'Drive {host}/api/v4 via HTTP Request with bearer token.',
  },
  rocketChat: {
    forgeType: 'webhook',
    label: 'HTTP Request → Rocket.Chat REST',
    rationale: 'Drive {host}/api/v1 via HTTP Request with X-Auth-Token + X-User-Id.',
  },
  signal: {
    forgeType: 'webhook',
    label: 'HTTP Request → signal-cli REST',
    rationale: 'Drive your self-hosted signal-cli-rest-api via HTTP Request.',
  },

  /* ── HR / ATS ───────────────────────────────────────── */
  greenhouse: {
    forgeType: 'webhook',
    label: 'HTTP Request → Greenhouse Harvest',
    rationale: 'Drive https://harvest.greenhouse.io/v1 via HTTP Request with Basic auth.',
  },
  lever: {
    forgeType: 'webhook',
    label: 'HTTP Request → Lever v1',
    rationale: 'Drive https://api.lever.co/v1 via HTTP Request with Basic auth.',
  },
  bamboohr: {
    forgeType: 'webhook',
    label: 'HTTP Request → BambooHR v1',
    rationale: 'Drive https://api.bamboohr.com/api/gateway.php/{company}/v1 via HTTP Request.',
  },
  workable: {
    forgeType: 'webhook',
    label: 'HTTP Request → Workable v3',
    rationale: 'Drive https://{subdomain}.workable.com/spi/v3 via HTTP Request.',
  },
  recruitee: {
    forgeType: 'webhook',
    label: 'HTTP Request → Recruitee',
    rationale: 'Drive https://api.recruitee.com/c/{company} via HTTP Request.',
  },

  /* ── Payments ───────────────────────────────────────── */
  payPal: {
    forgeType: 'webhook',
    label: 'HTTP Request → PayPal v1',
    rationale: 'Drive https://api-m.paypal.com/v1 via HTTP Request with OAuth bearer.',
  },
  square: {
    forgeType: 'webhook',
    label: 'HTTP Request → Square API',
    rationale: 'Drive https://connect.squareup.com/v2 via HTTP Request with bearer.',
  },
  razorpay: {
    forgeType: 'webhook',
    label: 'HTTP Request → Razorpay v1',
    rationale: 'Drive https://api.razorpay.com/v1 via HTTP Request with Basic auth.',
  },
  adyen: {
    forgeType: 'webhook',
    label: 'HTTP Request → Adyen API',
    rationale: 'Drive https://checkout-live.adyen.com/v70 via HTTP Request with X-API-Key.',
  },
  braintree: {
    forgeType: 'webhook',
    label: 'HTTP Request → Braintree GraphQL',
    rationale: 'Drive https://payments.braintree-api.com/graphql via HTTP Request.',
  },

  /* ── Productivity / notes ───────────────────────────── */
  evernote: {
    forgeType: 'webhook',
    label: 'HTTP Request → Evernote',
    rationale: 'Drive https://www.evernote.com/shard/{shard}/notestore via HTTP Request.',
  },
  oneNote: {
    forgeType: 'webhook',
    label: 'HTTP Request → OneNote (Graph)',
    rationale: 'Drive https://graph.microsoft.com/v1.0/me/onenote via HTTP Request.',
  },
  todoist: {
    forgeType: 'webhook',
    label: 'HTTP Request → Todoist Sync v9',
    rationale: 'Drive https://api.todoist.com/sync/v9 via HTTP Request with bearer.',
  },
  things3: {
    forgeType: 'webhook',
    label: 'HTTP Request → Things URL scheme',
    rationale: 'Things accepts `things:///` URL deep-links — synthesize via HTTP Request.',
  },
  obsidian: {
    forgeType: 'webhook',
    label: 'HTTP Request → Obsidian REST plugin',
    rationale: 'Drive your local Obsidian REST API plugin via HTTP Request.',
  },

  /* ── FTP / storage extras ───────────────────────────── */
  ftp: {
    forgeType: 'webhook',
    label: 'HTTP Request → FTP gateway',
    rationale: 'Drive your FTP gateway (e.g. transfer.sh / Bunny Storage) via HTTP Request.',
  },
  sftp: {
    forgeType: 'webhook',
    label: 'HTTP Request → SFTP gateway',
    rationale: 'Drive your SFTP gateway via HTTP Request — true SFTP needs a worker.',
  },
  webdav: {
    forgeType: 'webhook',
    label: 'HTTP Request → WebDAV',
    rationale: 'PROPFIND/PUT against WebDAV servers via HTTP Request.',
  },
  backblazeB2: {
    forgeType: 'webhook',
    label: 'HTTP Request → Backblaze B2',
    rationale: 'Drive https://api.backblazeb2.com via HTTP Request with B2 Authorization.',
  },
  wasabi: {
    forgeType: 'webhook',
    label: 'HTTP Request → Wasabi (S3-compat)',
    rationale: 'S3-compatible — pre-sign on backend, PUT via HTTP Request.',
  },
  nextcloudFile: {
    forgeType: 'webhook',
    label: 'HTTP Request → Nextcloud OCS',
    rationale: 'Drive {host}/ocs/v2.php via HTTP Request with Basic auth + OCS-APIRequest header.',
  },

  /* ── Forms ──────────────────────────────────────────── */
  typeform: {
    forgeType: 'webhook',
    label: 'HTTP Request → Typeform v1',
    rationale: 'Drive https://api.typeform.com via HTTP Request with bearer token.',
  },
  tally: {
    forgeType: 'webhook',
    label: 'HTTP Request → Tally',
    rationale: 'Tally posts to webhooks — receive in HTTP Request trigger.',
  },
  jotform: {
    forgeType: 'webhook',
    label: 'HTTP Request → Jotform',
    rationale: 'Drive https://api.jotform.com via HTTP Request with apiKey query.',
  },
  wufoo: {
    forgeType: 'webhook',
    label: 'HTTP Request → Wufoo REST',
    rationale: 'Drive https://{subdomain}.wufoo.com/api/v3 via HTTP Request with Basic auth.',
  },
  formstack: {
    forgeType: 'webhook',
    label: 'HTTP Request → Formstack v2',
    rationale: 'Drive https://www.formstack.com/api/v2 via HTTP Request.',
  },
  googleForms: {
    forgeType: 'webhook',
    label: 'HTTP Request → Apps Script webhook',
    rationale: 'Bind a Google Apps Script trigger to your Form, POST to SabFlow via HTTP Request.',
  },

  /* ── Data / ETL ─────────────────────────────────────── */
  airbyte: {
    forgeType: 'webhook',
    label: 'HTTP Request → Airbyte API',
    rationale: 'Drive https://api.airbyte.com/v1 (Cloud) or your self-host via HTTP Request.',
  },
  fivetran: {
    forgeType: 'webhook',
    label: 'HTTP Request → Fivetran v1',
    rationale: 'Drive https://api.fivetran.com/v1 via HTTP Request with Basic auth.',
  },
  hightouch: {
    forgeType: 'webhook',
    label: 'HTTP Request → Hightouch API',
    rationale: 'Drive https://api.hightouch.com via HTTP Request with bearer.',
  },
  census: {
    forgeType: 'webhook',
    label: 'HTTP Request → Census API',
    rationale: 'Drive https://app.getcensus.com/api/v1 via HTTP Request.',
  },
  dbtCloud: {
    forgeType: 'webhook',
    label: 'HTTP Request → dbt Cloud',
    rationale: 'Drive https://cloud.getdbt.com/api/v2 via HTTP Request with bearer.',
  },

  /* ── Maps / geo ─────────────────────────────────────── */
  googleMaps: {
    forgeType: 'webhook',
    label: 'HTTP Request → Google Maps Platform',
    rationale: 'Drive maps.googleapis.com endpoints via HTTP Request with API key.',
  },
  mapbox: {
    forgeType: 'webhook',
    label: 'HTTP Request → Mapbox API',
    rationale: 'Drive https://api.mapbox.com via HTTP Request with access_token query.',
  },

  /* ── SMS / phone (extras) ───────────────────────────── */
  vonage: {
    forgeType: 'webhook',
    label: 'HTTP Request → Vonage (Nexmo)',
    rationale: 'Drive https://rest.nexmo.com via HTTP Request with key+secret.',
  },
  plivo: {
    forgeType: 'webhook',
    label: 'HTTP Request → Plivo v1',
    rationale: 'Drive https://api.plivo.com/v1/Account/{auth_id} via HTTP Request with Basic auth.',
  },
  messageBird: {
    forgeType: 'webhook',
    label: 'HTTP Request → MessageBird REST',
    rationale: 'Drive https://rest.messagebird.com via HTTP Request with AccessKey header.',
  },
  bandwidth: {
    forgeType: 'webhook',
    label: 'HTTP Request → Bandwidth Messaging v2',
    rationale: 'Drive https://messaging.bandwidth.com/api/v2 via HTTP Request.',
  },
  sinch: {
    forgeType: 'webhook',
    label: 'HTTP Request → Sinch SMS REST',
    rationale: 'Drive https://us.sms.api.sinch.com via HTTP Request with bearer.',
  },

  /* ── Misc verticals ─────────────────────────────────── */
  airtableEnterprise: {
    forgeType: 'forge_airtable',
    label: 'Airtable (forge)',
    rationale: 'Use the existing Airtable forge block.',
  },
  contentful: {
    forgeType: 'webhook',
    label: 'HTTP Request → Contentful CMA',
    rationale: 'Drive https://api.contentful.com via HTTP Request with bearer token.',
  },
  sanity: {
    forgeType: 'webhook',
    label: 'HTTP Request → Sanity API',
    rationale: 'Drive https://{projectId}.api.sanity.io via HTTP Request with bearer.',
  },
  strapi: {
    forgeType: 'webhook',
    label: 'HTTP Request → Strapi REST',
    rationale: 'Drive your Strapi instance REST API via HTTP Request with bearer.',
  },
  webflow: {
    forgeType: 'webhook',
    label: 'HTTP Request → Webflow CMS API',
    rationale: 'Drive https://api.webflow.com/v2 via HTTP Request with bearer.',
  },
  wordpress: {
    forgeType: 'webhook',
    label: 'HTTP Request → WordPress REST',
    rationale: 'Drive {site}/wp-json/wp/v2 via HTTP Request with App Password.',
  },
  ghost: {
    forgeType: 'webhook',
    label: 'HTTP Request → Ghost Admin API',
    rationale: 'Drive {site}/ghost/api/admin via HTTP Request with JWT.',
  },
  medium: {
    forgeType: 'webhook',
    label: 'HTTP Request → Medium v1',
    rationale: 'Drive https://api.medium.com/v1 via HTTP Request with bearer.',
  },
};

/* ── Public API ─────────────────────────────────────────────────────────── */

/**
 * Look up a fallback for a Rust descriptor name.  Returns `undefined` when
 * no curated replacement exists — caller should keep the stub banner as-is.
 */
export function getStubFallback(rustNodeName: string): StubFallback | undefined {
  if (!rustNodeName) return undefined;
  // Try exact match first.
  if (STUB_FALLBACKS[rustNodeName]) return STUB_FALLBACKS[rustNodeName];
  // Try snake_case → camelCase rewrite (rust descriptors sometimes
  // publish camelCase names while block types are snake_case).
  const camel = rustNodeName.replace(/_([a-z0-9])/g, (_m, c: string) =>
    c.toUpperCase(),
  );
  if (STUB_FALLBACKS[camel]) return STUB_FALLBACKS[camel];
  // Try the snake_case form too.
  const snake = rustNodeName.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
  if (STUB_FALLBACKS[snake]) return STUB_FALLBACKS[snake];
  // Try lowercase canonical.
  const lower = rustNodeName.toLowerCase();
  for (const key of Object.keys(STUB_FALLBACKS)) {
    if (key.toLowerCase() === lower) return STUB_FALLBACKS[key];
  }
  return undefined;
}

/** Total number of stub-types we have curated fallbacks for. */
export const STUB_FALLBACK_COUNT = Object.keys(STUB_FALLBACKS).length;
