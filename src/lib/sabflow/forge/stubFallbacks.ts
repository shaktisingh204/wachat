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
