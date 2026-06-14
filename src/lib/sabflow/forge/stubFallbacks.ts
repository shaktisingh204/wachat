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

  /* ── Email — extended ESP coverage ──────────────────── */
  sendGridLists: {
    forgeType: 'webhook',
    label: 'HTTP Request → SendGrid Marketing',
    rationale: 'Drive https://api.sendgrid.com/v3/marketing via HTTP Request with bearer token.',
  },
  sendGridContacts: {
    forgeType: 'webhook',
    label: 'HTTP Request → SendGrid Contacts',
    rationale: 'PUT https://api.sendgrid.com/v3/marketing/contacts via HTTP Request.',
  },
  sendGridStats: {
    forgeType: 'webhook',
    label: 'HTTP Request → SendGrid Stats',
    rationale: 'GET https://api.sendgrid.com/v3/stats via HTTP Request with bearer.',
  },
  mailgunLists: {
    forgeType: 'webhook',
    label: 'HTTP Request → Mailgun Lists',
    rationale: 'Drive https://api.mailgun.net/v3/lists via HTTP Request with API key.',
  },
  mailgunValidation: {
    forgeType: 'webhook',
    label: 'HTTP Request → Mailgun Validate',
    rationale: 'GET https://api.mailgun.net/v4/address/validate via HTTP Request.',
  },
  postmarkTemplates: {
    forgeType: 'webhook',
    label: 'HTTP Request → Postmark Templates',
    rationale: 'Drive https://api.postmarkapp.com/templates via HTTP Request with X-Postmark-Server-Token.',
  },
  postmarkServers: {
    forgeType: 'webhook',
    label: 'HTTP Request → Postmark Servers',
    rationale: 'Drive https://api.postmarkapp.com/servers via HTTP Request with X-Postmark-Account-Token.',
  },
  resendEmails: {
    forgeType: 'webhook',
    label: 'HTTP Request → Resend Emails',
    rationale: 'POST https://api.resend.com/emails via HTTP Request with bearer token.',
  },
  resendAudiences: {
    forgeType: 'webhook',
    label: 'HTTP Request → Resend Audiences',
    rationale: 'Drive https://api.resend.com/audiences via HTTP Request with bearer.',
  },
  resendDomains: {
    forgeType: 'webhook',
    label: 'HTTP Request → Resend Domains',
    rationale: 'Drive https://api.resend.com/domains via HTTP Request with bearer.',
  },
  mailchimpAutomations: {
    forgeType: 'webhook',
    label: 'HTTP Request → Mailchimp Automations',
    rationale: 'Drive {dc}.api.mailchimp.com/3.0/automations via HTTP Request with API-key auth.',
  },
  mailchimpCampaigns: {
    forgeType: 'webhook',
    label: 'HTTP Request → Mailchimp Campaigns',
    rationale: 'Drive {dc}.api.mailchimp.com/3.0/campaigns via HTTP Request with API-key auth.',
  },
  mailchimpReports: {
    forgeType: 'webhook',
    label: 'HTTP Request → Mailchimp Reports',
    rationale: 'GET {dc}.api.mailchimp.com/3.0/reports via HTTP Request with API-key auth.',
  },
  klaviyoCampaigns: {
    forgeType: 'webhook',
    label: 'HTTP Request → Klaviyo Campaigns',
    rationale: 'Drive https://a.klaviyo.com/api/campaigns via HTTP Request with private key.',
  },
  klaviyoProfiles: {
    forgeType: 'webhook',
    label: 'HTTP Request → Klaviyo Profiles',
    rationale: 'Drive https://a.klaviyo.com/api/profiles via HTTP Request with private key.',
  },
  klaviyoEvents: {
    forgeType: 'webhook',
    label: 'HTTP Request → Klaviyo Events',
    rationale: 'POST https://a.klaviyo.com/api/events via HTTP Request with private key.',
  },
  klaviyoLists: {
    forgeType: 'webhook',
    label: 'HTTP Request → Klaviyo Lists',
    rationale: 'Drive https://a.klaviyo.com/api/lists via HTTP Request with private key.',
  },
  brevoContacts: {
    forgeType: 'webhook',
    label: 'HTTP Request → Brevo Contacts',
    rationale: 'Drive https://api.brevo.com/v3/contacts via HTTP Request with api-key header.',
  },
  brevoTransactional: {
    forgeType: 'webhook',
    label: 'HTTP Request → Brevo SMTP',
    rationale: 'POST https://api.brevo.com/v3/smtp/email via HTTP Request with api-key header.',
  },
  brevoCampaigns: {
    forgeType: 'webhook',
    label: 'HTTP Request → Brevo Campaigns',
    rationale: 'Drive https://api.brevo.com/v3/emailCampaigns via HTTP Request.',
  },
  convertkitForms: {
    forgeType: 'webhook',
    label: 'HTTP Request → ConvertKit Forms',
    rationale: 'Drive https://api.convertkit.com/v3/forms via HTTP Request with API key.',
  },
  convertkitTags: {
    forgeType: 'webhook',
    label: 'HTTP Request → ConvertKit Tags',
    rationale: 'Drive https://api.convertkit.com/v3/tags via HTTP Request with API key.',
  },
  convertkitSubscribers: {
    forgeType: 'webhook',
    label: 'HTTP Request → ConvertKit Subscribers',
    rationale: 'Drive https://api.convertkit.com/v3/subscribers via HTTP Request with API key.',
  },
  mailerliteSubscribers: {
    forgeType: 'webhook',
    label: 'HTTP Request → MailerLite Subscribers',
    rationale: 'Drive https://connect.mailerlite.com/api/subscribers via HTTP Request with bearer.',
  },
  mailerliteCampaigns: {
    forgeType: 'webhook',
    label: 'HTTP Request → MailerLite Campaigns',
    rationale: 'Drive https://connect.mailerlite.com/api/campaigns via HTTP Request with bearer.',
  },
  loopsContacts: {
    forgeType: 'webhook',
    label: 'HTTP Request → Loops Contacts',
    rationale: 'Drive https://app.loops.so/api/v1/contacts via HTTP Request with bearer token.',
  },
  loopsEvents: {
    forgeType: 'webhook',
    label: 'HTTP Request → Loops Events',
    rationale: 'POST https://app.loops.so/api/v1/events/send via HTTP Request with bearer.',
  },
  beehiivPublications: {
    forgeType: 'webhook',
    label: 'HTTP Request → Beehiiv Publications',
    rationale: 'Drive https://api.beehiiv.com/v2/publications via HTTP Request with bearer.',
  },
  beehiivSubscribers: {
    forgeType: 'webhook',
    label: 'HTTP Request → Beehiiv Subscribers',
    rationale: 'Drive https://api.beehiiv.com/v2/publications/{id}/subscriptions via HTTP Request.',
  },

  /* ── Messaging — extended ───────────────────────────── */
  twilioConversations: {
    forgeType: 'forge_twilio',
    label: 'Twilio (Conversations via forge)',
    rationale: 'Use the Twilio forge block with the conversations action for two-way threads.',
  },
  twilioVerify: {
    forgeType: 'webhook',
    label: 'HTTP Request → Twilio Verify',
    rationale: 'POST https://verify.twilio.com/v2/Services/{sid}/Verifications via HTTP Request with basic auth.',
  },
  twilioStudio: {
    forgeType: 'webhook',
    label: 'HTTP Request → Twilio Studio',
    rationale: 'POST https://studio.twilio.com/v2/Flows/{sid}/Executions via HTTP Request with basic auth.',
  },
  twilioLookup: {
    forgeType: 'webhook',
    label: 'HTTP Request → Twilio Lookup',
    rationale: 'GET https://lookups.twilio.com/v2/PhoneNumbers via HTTP Request with basic auth.',
  },
  slackReactions: {
    forgeType: 'forge_slack',
    label: 'Slack (reactions via forge)',
    rationale: 'Use the Slack forge block with the reactions.add action.',
  },
  slackFiles: {
    forgeType: 'forge_slack',
    label: 'Slack (files via forge)',
    rationale: 'Use the Slack forge block with the files.upload action.',
  },
  slackPins: {
    forgeType: 'forge_slack',
    label: 'Slack (pins via forge)',
    rationale: 'Use the Slack forge block with the pins.add action.',
  },
  slackStars: {
    forgeType: 'forge_slack',
    label: 'Slack (stars via forge)',
    rationale: 'Use the Slack forge block with the stars.add action.',
  },
  slackUsergroups: {
    forgeType: 'forge_slack',
    label: 'Slack (usergroups via forge)',
    rationale: 'Use the Slack forge block with the usergroups.create action.',
  },
  discordEmbeds: {
    forgeType: 'forge_discord',
    label: 'Discord (rich embeds via forge)',
    rationale: 'Use the Discord forge block — supply an embeds payload to the webhook.',
  },
  discordThreads: {
    forgeType: 'webhook',
    label: 'HTTP Request → Discord Threads',
    rationale: 'POST {webhook}?thread_id={id} via HTTP Request for threaded webhook posts.',
  },
  microsoftTeamsChannel: {
    forgeType: 'webhook',
    label: 'HTTP Request → Teams Incoming Webhook',
    rationale: 'POST your Teams channel webhook URL via HTTP Request with an Adaptive Card body.',
  },

  /* ── Stripe — sub-features ──────────────────────────── */
  stripeCustomers: {
    forgeType: 'webhook',
    label: 'HTTP Request → Stripe Customers',
    rationale: 'Drive https://api.stripe.com/v1/customers via HTTP Request with secret key.',
  },
  stripeSubscriptions: {
    forgeType: 'webhook',
    label: 'HTTP Request → Stripe Subscriptions',
    rationale: 'Drive https://api.stripe.com/v1/subscriptions via HTTP Request with secret key.',
  },
  stripeInvoices: {
    forgeType: 'webhook',
    label: 'HTTP Request → Stripe Invoices',
    rationale: 'Drive https://api.stripe.com/v1/invoices via HTTP Request with secret key.',
  },
  stripeCheckout: {
    forgeType: 'webhook',
    label: 'HTTP Request → Stripe Checkout Sessions',
    rationale: 'POST https://api.stripe.com/v1/checkout/sessions via HTTP Request with secret key.',
  },
  stripePaymentIntents: {
    forgeType: 'webhook',
    label: 'HTTP Request → Stripe Payment Intents',
    rationale: 'Drive https://api.stripe.com/v1/payment_intents via HTTP Request with secret key.',
  },
  stripeRefunds: {
    forgeType: 'webhook',
    label: 'HTTP Request → Stripe Refunds',
    rationale: 'POST https://api.stripe.com/v1/refunds via HTTP Request with secret key.',
  },
  stripeProducts: {
    forgeType: 'webhook',
    label: 'HTTP Request → Stripe Products',
    rationale: 'Drive https://api.stripe.com/v1/products via HTTP Request with secret key.',
  },
  stripePrices: {
    forgeType: 'webhook',
    label: 'HTTP Request → Stripe Prices',
    rationale: 'Drive https://api.stripe.com/v1/prices via HTTP Request with secret key.',
  },
  stripePayouts: {
    forgeType: 'webhook',
    label: 'HTTP Request → Stripe Payouts',
    rationale: 'Drive https://api.stripe.com/v1/payouts via HTTP Request with secret key.',
  },

  /* ── Notion — sub-features ──────────────────────────── */
  notionPages: {
    forgeType: 'forge_notion',
    label: 'Notion (pages via forge)',
    rationale: 'Use the Notion forge block with the pages.create / pages.update action.',
  },
  notionDatabases: {
    forgeType: 'forge_notion',
    label: 'Notion (databases via forge)',
    rationale: 'Use the Notion forge block with the databases.query action.',
  },
  notionBlocks: {
    forgeType: 'forge_notion',
    label: 'Notion (blocks via forge)',
    rationale: 'Use the Notion forge block to append/retrieve child blocks.',
  },
  notionComments: {
    forgeType: 'webhook',
    label: 'HTTP Request → Notion Comments',
    rationale: 'POST https://api.notion.com/v1/comments via HTTP Request with bearer + Notion-Version header.',
  },
  notionUsers: {
    forgeType: 'webhook',
    label: 'HTTP Request → Notion Users',
    rationale: 'GET https://api.notion.com/v1/users via HTTP Request with bearer + Notion-Version header.',
  },

  /* ── Airtable — variants ────────────────────────────── */
  airtableMeta: {
    forgeType: 'webhook',
    label: 'HTTP Request → Airtable Metadata',
    rationale: 'GET https://api.airtable.com/v0/meta/bases via HTTP Request with bearer.',
  },
  airtableWebhooks: {
    forgeType: 'webhook',
    label: 'HTTP Request → Airtable Webhooks',
    rationale: 'Drive https://api.airtable.com/v0/bases/{baseId}/webhooks via HTTP Request.',
  },
  airtableComments: {
    forgeType: 'webhook',
    label: 'HTTP Request → Airtable Comments',
    rationale: 'Drive https://api.airtable.com/v0/{baseId}/{table}/{record}/comments via HTTP Request.',
  },

  /* ── GitHub / GitLab — sub-actions ──────────────────── */
  githubIssues: {
    forgeType: 'forge_github',
    label: 'GitHub (issues via forge)',
    rationale: 'Use the GitHub forge block with the issues.create / issues.update action.',
  },
  githubPulls: {
    forgeType: 'forge_github',
    label: 'GitHub (pulls via forge)',
    rationale: 'Use the GitHub forge block with the pulls.create action.',
  },
  githubReleases: {
    forgeType: 'webhook',
    label: 'HTTP Request → GitHub Releases',
    rationale: 'POST https://api.github.com/repos/{o}/{r}/releases via HTTP Request with bearer.',
  },
  githubActions: {
    forgeType: 'webhook',
    label: 'HTTP Request → GitHub Actions',
    rationale: 'POST https://api.github.com/repos/{o}/{r}/actions/workflows/{id}/dispatches via HTTP Request.',
  },
  githubGists: {
    forgeType: 'webhook',
    label: 'HTTP Request → GitHub Gists',
    rationale: 'Drive https://api.github.com/gists via HTTP Request with bearer.',
  },
  githubProjects: {
    forgeType: 'webhook',
    label: 'HTTP Request → GitHub Projects (GraphQL)',
    rationale: 'POST https://api.github.com/graphql via HTTP Request with bearer for Projects v2.',
  },
  gitlabMergeRequests: {
    forgeType: 'webhook',
    label: 'HTTP Request → GitLab Merge Requests',
    rationale: 'Drive https://gitlab.com/api/v4/projects/{id}/merge_requests via HTTP Request.',
  },
  gitlabIssues: {
    forgeType: 'webhook',
    label: 'HTTP Request → GitLab Issues',
    rationale: 'Drive https://gitlab.com/api/v4/projects/{id}/issues via HTTP Request.',
  },
  gitlabPipelines: {
    forgeType: 'webhook',
    label: 'HTTP Request → GitLab Pipelines',
    rationale: 'Drive https://gitlab.com/api/v4/projects/{id}/pipelines via HTTP Request.',
  },
  gitlabReleases: {
    forgeType: 'webhook',
    label: 'HTTP Request → GitLab Releases',
    rationale: 'Drive https://gitlab.com/api/v4/projects/{id}/releases via HTTP Request.',
  },

  /* ── AWS — sub-services ─────────────────────────────── */
  awsSns: {
    forgeType: 'webhook',
    label: 'HTTP Request → AWS SNS (signed)',
    rationale: 'Sign requests via SigV4 on your backend, then HTTP Request handles the POST.',
  },
  awsLambdaInvoke: {
    forgeType: 'webhook',
    label: 'HTTP Request → AWS Lambda invoke',
    rationale: 'Sign with SigV4 on your backend, then HTTP Request invokes the function URL.',
  },
  awsKinesis: {
    forgeType: 'webhook',
    label: 'HTTP Request → AWS Kinesis',
    rationale: 'Pre-sign with SigV4, then HTTP Request hits kinesis.{region}.amazonaws.com.',
  },
  awsEventBridge: {
    forgeType: 'webhook',
    label: 'HTTP Request → AWS EventBridge',
    rationale: 'Pre-sign with SigV4, then HTTP Request puts events on the bus.',
  },
  awsStepFunctions: {
    forgeType: 'webhook',
    label: 'HTTP Request → AWS Step Functions',
    rationale: 'Pre-sign with SigV4, then HTTP Request starts an execution.',
  },
  awsSecretsManager: {
    forgeType: 'webhook',
    label: 'HTTP Request → AWS Secrets Manager',
    rationale: 'Pre-sign with SigV4, then HTTP Request reads / writes secrets.',
  },
  awsParameterStore: {
    forgeType: 'webhook',
    label: 'HTTP Request → AWS Parameter Store',
    rationale: 'Pre-sign with SigV4, then HTTP Request reads parameters from SSM.',
  },
  awsCloudwatchLogs: {
    forgeType: 'webhook',
    label: 'HTTP Request → CloudWatch Logs',
    rationale: 'Pre-sign with SigV4, then HTTP Request puts log events.',
  },
  awsCloudwatchMetrics: {
    forgeType: 'webhook',
    label: 'HTTP Request → CloudWatch Metrics',
    rationale: 'Pre-sign with SigV4, then HTTP Request puts metric data.',
  },
  awsRoute53: {
    forgeType: 'webhook',
    label: 'HTTP Request → Route 53',
    rationale: 'Pre-sign with SigV4, then HTTP Request manages record sets.',
  },

  /* ── Google Workspace — sub-actions ─────────────────── */
  googleDocsCreate: {
    forgeType: 'webhook',
    label: 'HTTP Request → Google Docs',
    rationale: 'Drive https://docs.googleapis.com/v1/documents via HTTP Request with OAuth bearer.',
  },
  googleSlidesCreate: {
    forgeType: 'webhook',
    label: 'HTTP Request → Google Slides',
    rationale: 'Drive https://slides.googleapis.com/v1/presentations via HTTP Request with OAuth bearer.',
  },
  googleFormsSubmit: {
    forgeType: 'webhook',
    label: 'HTTP Request → Google Forms',
    rationale: 'Drive https://forms.googleapis.com/v1/forms via HTTP Request with OAuth bearer.',
  },
  googleAdmin: {
    forgeType: 'webhook',
    label: 'HTTP Request → Google Workspace Admin',
    rationale: 'Drive https://admin.googleapis.com/admin/directory/v1 via HTTP Request with OAuth bearer.',
  },
  googleGroups: {
    forgeType: 'webhook',
    label: 'HTTP Request → Google Groups',
    rationale: 'Drive https://www.googleapis.com/admin/directory/v1/groups via HTTP Request.',
  },
  googleVoice: {
    forgeType: 'webhook',
    label: 'HTTP Request → Google Voice',
    rationale: 'Drive https://voice.googleapis.com via HTTP Request with OAuth bearer (BYO scopes).',
  },
  googleChatSpaces: {
    forgeType: 'webhook',
    label: 'HTTP Request → Google Chat Spaces',
    rationale: 'Drive https://chat.googleapis.com/v1/spaces via HTTP Request with OAuth bearer.',
  },
  googleMeet: {
    forgeType: 'webhook',
    label: 'HTTP Request → Google Meet (Calendar conferences)',
    rationale: 'Create a Calendar event with conferenceData via the Google Calendar HTTP path.',
  },
  googlePhotos: {
    forgeType: 'webhook',
    label: 'HTTP Request → Google Photos',
    rationale: 'Drive https://photoslibrary.googleapis.com/v1 via HTTP Request with OAuth bearer.',
  },
  googleSearchConsole: {
    forgeType: 'webhook',
    label: 'HTTP Request → Search Console',
    rationale: 'Drive https://searchconsole.googleapis.com/v1 via HTTP Request with OAuth bearer.',
  },
  googleAds: {
    forgeType: 'webhook',
    label: 'HTTP Request → Google Ads',
    rationale: 'POST https://googleads.googleapis.com/{v} via HTTP Request with OAuth + developer token.',
  },
  googleMyBusiness: {
    forgeType: 'webhook',
    label: 'HTTP Request → Google Business Profile',
    rationale: 'Drive https://mybusinessbusinessinformation.googleapis.com via HTTP Request.',
  },

  /* ── Microsoft 365 ──────────────────────────────────── */
  outlookMail: {
    forgeType: 'webhook',
    label: 'HTTP Request → Outlook Mail (Graph)',
    rationale: 'POST https://graph.microsoft.com/v1.0/me/sendMail via HTTP Request with OAuth bearer.',
  },
  outlookContacts: {
    forgeType: 'webhook',
    label: 'HTTP Request → Outlook Contacts',
    rationale: 'Drive https://graph.microsoft.com/v1.0/me/contacts via HTTP Request.',
  },
  msTeamsMessages: {
    forgeType: 'webhook',
    label: 'HTTP Request → Teams Messages (Graph)',
    rationale: 'POST https://graph.microsoft.com/v1.0/teams/{id}/channels/{c}/messages via HTTP Request.',
  },
  msPlanner: {
    forgeType: 'webhook',
    label: 'HTTP Request → Planner (Graph)',
    rationale: 'Drive https://graph.microsoft.com/v1.0/planner via HTTP Request with OAuth bearer.',
  },
  msToDo: {
    forgeType: 'webhook',
    label: 'HTTP Request → Microsoft To Do',
    rationale: 'Drive https://graph.microsoft.com/v1.0/me/todo/lists via HTTP Request.',
  },

  /* ── CRM extras ─────────────────────────────────────── */
  hubspotContacts: {
    forgeType: 'webhook',
    label: 'HTTP Request → HubSpot CRM Contacts',
    rationale: 'Drive https://api.hubapi.com/crm/v3/objects/contacts via HTTP Request with bearer.',
  },
  hubspotDeals: {
    forgeType: 'webhook',
    label: 'HTTP Request → HubSpot CRM Deals',
    rationale: 'Drive https://api.hubapi.com/crm/v3/objects/deals via HTTP Request with bearer.',
  },
  hubspotCompanies: {
    forgeType: 'webhook',
    label: 'HTTP Request → HubSpot CRM Companies',
    rationale: 'Drive https://api.hubapi.com/crm/v3/objects/companies via HTTP Request with bearer.',
  },
  hubspotTickets: {
    forgeType: 'webhook',
    label: 'HTTP Request → HubSpot Tickets',
    rationale: 'Drive https://api.hubapi.com/crm/v3/objects/tickets via HTTP Request with bearer.',
  },
  salesforceObjects: {
    forgeType: 'webhook',
    label: 'HTTP Request → Salesforce sObjects',
    rationale: 'Drive https://{instance}/services/data/v{v}/sobjects via HTTP Request with OAuth bearer.',
  },
  salesforceQuery: {
    forgeType: 'webhook',
    label: 'HTTP Request → Salesforce SOQL',
    rationale: 'GET https://{instance}/services/data/v{v}/query via HTTP Request with OAuth bearer.',
  },
  zohoCrmRecords: {
    forgeType: 'webhook',
    label: 'HTTP Request → Zoho CRM',
    rationale: 'Drive https://www.zohoapis.com/crm/v3 via HTTP Request with Zoho-oauthtoken.',
  },
  pipedriveDeals: {
    forgeType: 'webhook',
    label: 'HTTP Request → Pipedrive Deals',
    rationale: 'Drive https://api.pipedrive.com/v1/deals via HTTP Request with api_token.',
  },
  pipedrivePersons: {
    forgeType: 'webhook',
    label: 'HTTP Request → Pipedrive Persons',
    rationale: 'Drive https://api.pipedrive.com/v1/persons via HTTP Request with api_token.',
  },
  pipedriveActivities: {
    forgeType: 'webhook',
    label: 'HTTP Request → Pipedrive Activities',
    rationale: 'Drive https://api.pipedrive.com/v1/activities via HTTP Request with api_token.',
  },
  copperCrm: {
    forgeType: 'webhook',
    label: 'HTTP Request → Copper CRM',
    rationale: 'Drive https://api.copper.com/developer_api/v1 via HTTP Request with X-PW-AccessToken.',
  },
  closeIo: {
    forgeType: 'webhook',
    label: 'HTTP Request → Close.io',
    rationale: 'Drive https://api.close.com/api/v1 via HTTP Request with basic auth.',
  },
  attioCrm: {
    forgeType: 'webhook',
    label: 'HTTP Request → Attio',
    rationale: 'Drive https://api.attio.com/v2 via HTTP Request with bearer.',
  },
  folkCrm: {
    forgeType: 'webhook',
    label: 'HTTP Request → Folk',
    rationale: 'Drive https://api.folk.app/v1 via HTTP Request with bearer.',
  },

  /* ── Support / helpdesk ─────────────────────────────── */
  helpScoutMailboxes: {
    forgeType: 'webhook',
    label: 'HTTP Request → Help Scout',
    rationale: 'Drive https://api.helpscout.net/v2 via HTTP Request with bearer.',
  },
  frontConversations: {
    forgeType: 'webhook',
    label: 'HTTP Request → Front',
    rationale: 'Drive https://api2.frontapp.com via HTTP Request with bearer.',
  },
  crispChat: {
    forgeType: 'webhook',
    label: 'HTTP Request → Crisp',
    rationale: 'Drive https://api.crisp.chat/v1 via HTTP Request with basic auth.',
  },
  livechatAgents: {
    forgeType: 'webhook',
    label: 'HTTP Request → LiveChat',
    rationale: 'Drive https://api.livechatinc.com/v3.5 via HTTP Request with bearer.',
  },
  driftConversations: {
    forgeType: 'webhook',
    label: 'HTTP Request → Drift',
    rationale: 'Drive https://driftapi.com/conversations/v1 via HTTP Request with bearer.',
  },
  customerlyChat: {
    forgeType: 'webhook',
    label: 'HTTP Request → Customerly',
    rationale: 'Drive https://api.customerly.io/v1 via HTTP Request with bearer.',
  },
  groove: {
    forgeType: 'webhook',
    label: 'HTTP Request → Groove',
    rationale: 'Drive https://api.groovehq.com/v1 via HTTP Request with bearer.',
  },

  /* ── Forms / surveys ────────────────────────────────── */
  typeformResponses: {
    forgeType: 'webhook',
    label: 'HTTP Request → Typeform Responses',
    rationale: 'GET https://api.typeform.com/forms/{id}/responses via HTTP Request with bearer.',
  },
  typeformCreate: {
    forgeType: 'webhook',
    label: 'HTTP Request → Typeform Create',
    rationale: 'POST https://api.typeform.com/forms via HTTP Request with bearer.',
  },
  jotformSubmissions: {
    forgeType: 'webhook',
    label: 'HTTP Request → Jotform',
    rationale: 'Drive https://api.jotform.com via HTTP Request with apiKey query param.',
  },
  surveyMonkey: {
    forgeType: 'webhook',
    label: 'HTTP Request → SurveyMonkey',
    rationale: 'Drive https://api.surveymonkey.com/v3 via HTTP Request with bearer.',
  },
  formstackForms: {
    forgeType: 'webhook',
    label: 'HTTP Request → Formstack',
    rationale: 'Drive https://www.formstack.com/api/v2 via HTTP Request with bearer.',
  },
  tally: {
    forgeType: 'webhook',
    label: 'HTTP Request → Tally',
    rationale: 'Drive https://api.tally.so via HTTP Request with bearer.',
  },
  calendlyBookings: {
    forgeType: 'webhook',
    label: 'HTTP Request → Calendly v2',
    rationale: 'Drive https://api.calendly.com via HTTP Request with bearer.',
  },

  /* ── E-commerce / payments extras ───────────────────── */
  shopifyOrders: {
    forgeType: 'webhook',
    label: 'HTTP Request → Shopify Orders',
    rationale: 'Drive {shop}.myshopify.com/admin/api/2024-04/orders.json via HTTP Request.',
  },
  shopifyProducts: {
    forgeType: 'webhook',
    label: 'HTTP Request → Shopify Products',
    rationale: 'Drive {shop}.myshopify.com/admin/api/2024-04/products.json via HTTP Request.',
  },
  shopifyCustomers: {
    forgeType: 'webhook',
    label: 'HTTP Request → Shopify Customers',
    rationale: 'Drive {shop}.myshopify.com/admin/api/2024-04/customers.json via HTTP Request.',
  },
  bigcommerce: {
    forgeType: 'webhook',
    label: 'HTTP Request → BigCommerce',
    rationale: 'Drive https://api.bigcommerce.com/stores/{hash}/v3 via HTTP Request with X-Auth-Token.',
  },
  squareApi: {
    forgeType: 'webhook',
    label: 'HTTP Request → Square',
    rationale: 'Drive https://connect.squareup.com/v2 via HTTP Request with bearer.',
  },
  squareSpace: {
    forgeType: 'webhook',
    label: 'HTTP Request → Squarespace Commerce',
    rationale: 'Drive https://api.squarespace.com/1.0/commerce via HTTP Request with bearer.',
  },
  recurly: {
    forgeType: 'webhook',
    label: 'HTTP Request → Recurly',
    rationale: 'Drive https://v3.recurly.com via HTTP Request with basic auth (API key:).',
  },
  lemonSqueezy: {
    forgeType: 'webhook',
    label: 'HTTP Request → Lemon Squeezy',
    rationale: 'Drive https://api.lemonsqueezy.com/v1 via HTTP Request with bearer.',
  },
  gumroad: {
    forgeType: 'webhook',
    label: 'HTTP Request → Gumroad',
    rationale: 'Drive https://api.gumroad.com/v2 via HTTP Request with bearer.',
  },
  paddleBilling: {
    forgeType: 'webhook',
    label: 'HTTP Request → Paddle Billing',
    rationale: 'Drive https://api.paddle.com/billing/v1 via HTTP Request with bearer.',
  },

  /* ── Analytics / events ─────────────────────────────── */
  segmentTrack: {
    forgeType: 'segment',
    label: 'Segment (track)',
    rationale: 'Use the native Segment block with the track event action.',
  },
  segmentIdentify: {
    forgeType: 'segment',
    label: 'Segment (identify)',
    rationale: 'Use the native Segment block with the identify event action.',
  },
  rudderstack: {
    forgeType: 'webhook',
    label: 'HTTP Request → RudderStack',
    rationale: 'POST https://hosted.rudderlabs.com/v1/track via HTTP Request with basic auth.',
  },
  heapAnalytics: {
    forgeType: 'webhook',
    label: 'HTTP Request → Heap',
    rationale: 'POST https://heapanalytics.com/api/track via HTTP Request.',
  },
  hotjar: {
    forgeType: 'webhook',
    label: 'HTTP Request → Hotjar',
    rationale: 'Drive https://insights.hotjar.com/api/v1 via HTTP Request with bearer.',
  },
  pendo: {
    forgeType: 'webhook',
    label: 'HTTP Request → Pendo',
    rationale: 'POST https://app.pendo.io/data/track via HTTP Request with x-pendo-integration-key.',
  },
  fullStory: {
    forgeType: 'webhook',
    label: 'HTTP Request → FullStory',
    rationale: 'Drive https://api.fullstory.com/users/v1 via HTTP Request with basic auth.',
  },
  june: {
    forgeType: 'webhook',
    label: 'HTTP Request → June',
    rationale: 'POST https://api.june.so/api/track via HTTP Request with basic auth (writeKey:).',
  },

  /* ── Storage / file services ────────────────────────── */
  cloudflareR2: {
    forgeType: 'webhook',
    label: 'HTTP Request → Cloudflare R2 (S3 API)',
    rationale: 'Pre-sign with SigV4 against R2, then HTTP Request handles the PUT.',
  },
  cloudflareImages: {
    forgeType: 'webhook',
    label: 'HTTP Request → Cloudflare Images',
    rationale: 'POST https://api.cloudflare.com/client/v4/accounts/{id}/images/v1 via HTTP Request.',
  },
  cloudflareStream: {
    forgeType: 'webhook',
    label: 'HTTP Request → Cloudflare Stream',
    rationale: 'POST https://api.cloudflare.com/client/v4/accounts/{id}/stream via HTTP Request.',
  },
  cloudflareKv: {
    forgeType: 'webhook',
    label: 'HTTP Request → Cloudflare Workers KV',
    rationale: 'Drive https://api.cloudflare.com/client/v4/accounts/{id}/storage/kv/namespaces via HTTP Request.',
  },
  vercelBlob: {
    forgeType: 'webhook',
    label: 'HTTP Request → Vercel Blob',
    rationale: 'PUT https://blob.vercel-storage.com via HTTP Request with bearer.',
  },
  backblazeB2: {
    forgeType: 'webhook',
    label: 'HTTP Request → Backblaze B2',
    rationale: 'Authorise on your backend, then HTTP Request uploads to b2_upload_url.',
  },
  digitaloceanSpaces: {
    forgeType: 'webhook',
    label: 'HTTP Request → DO Spaces',
    rationale: 'Pre-sign with SigV4, then HTTP Request handles the PUT to {region}.digitaloceanspaces.com.',
  },
  wasabi: {
    forgeType: 'webhook',
    label: 'HTTP Request → Wasabi',
    rationale: 'Pre-sign with SigV4, then HTTP Request handles the PUT to s3.wasabisys.com.',
  },
  uploadcare: {
    forgeType: 'webhook',
    label: 'HTTP Request → Uploadcare',
    rationale: 'POST https://upload.uploadcare.com/base/ via HTTP Request with multipart body.',
  },
  cloudinary: {
    forgeType: 'webhook',
    label: 'HTTP Request → Cloudinary',
    rationale: 'POST https://api.cloudinary.com/v1_1/{cloud}/upload via HTTP Request with signed params.',
  },
  imgix: {
    forgeType: 'webhook',
    label: 'HTTP Request → imgix',
    rationale: 'Drive https://api.imgix.com/api/v1 via HTTP Request with bearer.',
  },

  /* ── Databases / caches ─────────────────────────────── */
  upstashRedis: {
    forgeType: 'webhook',
    label: 'HTTP Request → Upstash Redis REST',
    rationale: 'Drive https://{db}.upstash.io via HTTP Request with bearer token.',
  },
  upstashKafka: {
    forgeType: 'webhook',
    label: 'HTTP Request → Upstash Kafka REST',
    rationale: 'Drive https://{cluster}.upstash.io via HTTP Request with bearer.',
  },
  upstashQstash: {
    forgeType: 'webhook',
    label: 'HTTP Request → Upstash QStash',
    rationale: 'POST https://qstash.upstash.io/v2/publish via HTTP Request with bearer.',
  },
  upstashVector: {
    forgeType: 'webhook',
    label: 'HTTP Request → Upstash Vector',
    rationale: 'Drive https://{index}.upstash.io via HTTP Request with bearer.',
  },
  planetscale: {
    forgeType: 'webhook',
    label: 'HTTP Request → PlanetScale',
    rationale: 'Drive https://api.planetscale.com/v1 via HTTP Request with bearer.',
  },
  neonDb: {
    forgeType: 'webhook',
    label: 'HTTP Request → Neon',
    rationale: 'Drive https://console.neon.tech/api/v2 via HTTP Request with bearer.',
  },
  fauna: {
    forgeType: 'webhook',
    label: 'HTTP Request → Fauna',
    rationale: 'POST https://db.fauna.com/query/1 via HTTP Request with bearer.',
  },
  turso: {
    forgeType: 'webhook',
    label: 'HTTP Request → Turso',
    rationale: 'Drive https://api.turso.tech/v1 via HTTP Request with bearer.',
  },

  /* ── AI / vector DB extras ──────────────────────────── */
  pineconeIndexes: {
    forgeType: 'webhook',
    label: 'HTTP Request → Pinecone Indexes',
    rationale: 'Drive https://api.pinecone.io/indexes via HTTP Request with Api-Key header.',
  },
  qdrant: {
    forgeType: 'webhook',
    label: 'HTTP Request → Qdrant',
    rationale: 'Drive {host}/collections via HTTP Request with api-key header.',
  },
  chroma: {
    forgeType: 'webhook',
    label: 'HTTP Request → Chroma',
    rationale: 'Drive {host}/api/v1 via HTTP Request.',
  },
  milvus: {
    forgeType: 'webhook',
    label: 'HTTP Request → Milvus',
    rationale: 'Drive {host}/v1 via HTTP Request with bearer.',
  },
  voyageAi: {
    forgeType: 'webhook',
    label: 'HTTP Request → Voyage AI',
    rationale: 'POST https://api.voyageai.com/v1/embeddings via HTTP Request with bearer.',
  },
  jinaAi: {
    forgeType: 'webhook',
    label: 'HTTP Request → Jina AI',
    rationale: 'POST https://api.jina.ai/v1/embeddings via HTTP Request with bearer.',
  },
  groqCloud: {
    forgeType: 'webhook',
    label: 'HTTP Request → Groq',
    rationale: 'POST https://api.groq.com/openai/v1/chat/completions via HTTP Request with bearer.',
  },
  fireworksAi: {
    forgeType: 'webhook',
    label: 'HTTP Request → Fireworks AI',
    rationale: 'POST https://api.fireworks.ai/inference/v1 via HTTP Request with bearer.',
  },
  deepseek: {
    forgeType: 'webhook',
    label: 'HTTP Request → DeepSeek',
    rationale: 'POST https://api.deepseek.com/v1 via HTTP Request with bearer.',
  },
  openrouter: {
    forgeType: 'webhook',
    label: 'HTTP Request → OpenRouter',
    rationale: 'POST https://openrouter.ai/api/v1/chat/completions via HTTP Request with bearer.',
  },
  xaiGrok: {
    forgeType: 'webhook',
    label: 'HTTP Request → xAI Grok',
    rationale: 'POST https://api.x.ai/v1/chat/completions via HTTP Request with bearer.',
  },
  geminiApi: {
    forgeType: 'webhook',
    label: 'HTTP Request → Google AI (Gemini)',
    rationale: 'POST https://generativelanguage.googleapis.com/v1beta/models via HTTP Request.',
  },

  /* ── Customer messaging / journeys ──────────────────── */
  customerioJourneys: {
    forgeType: 'webhook',
    label: 'HTTP Request → Customer.io Journeys',
    rationale: 'POST https://track.customer.io/api/v1/customers/{id}/events via HTTP Request with basic auth.',
  },
  customerioApp: {
    forgeType: 'webhook',
    label: 'HTTP Request → Customer.io App API',
    rationale: 'Drive https://api.customer.io/v1 via HTTP Request with bearer.',
  },
  oneSignal: {
    forgeType: 'webhook',
    label: 'HTTP Request → OneSignal',
    rationale: 'POST https://api.onesignal.com/notifications via HTTP Request with bearer.',
  },
  knockNotifications: {
    forgeType: 'webhook',
    label: 'HTTP Request → Knock',
    rationale: 'POST https://api.knock.app/v1/workflows/{key}/trigger via HTTP Request with bearer.',
  },
  courier: {
    forgeType: 'webhook',
    label: 'HTTP Request → Courier',
    rationale: 'POST https://api.courier.com/send via HTTP Request with bearer.',
  },
  postmarkBroadcast: {
    forgeType: 'webhook',
    label: 'HTTP Request → Postmark Broadcast',
    rationale: 'POST https://api.postmarkapp.com/email/batch via HTTP Request with X-Postmark-Server-Token.',
  },

  /* ── Misc SaaS ──────────────────────────────────────── */
  airtableExtended: {
    forgeType: 'forge_airtable',
    label: 'Airtable (records via forge)',
    rationale: 'Use the Airtable forge block — list/create/update records.',
  },
  webflowItems: {
    forgeType: 'webhook',
    label: 'HTTP Request → Webflow Items',
    rationale: 'Drive https://api.webflow.com/v2/collections/{id}/items via HTTP Request with bearer.',
  },
  framerCms: {
    forgeType: 'webhook',
    label: 'HTTP Request → Framer CMS',
    rationale: 'Drive https://api.framer.com/v1 via HTTP Request with bearer.',
  },
  superblocks: {
    forgeType: 'webhook',
    label: 'HTTP Request → Superblocks',
    rationale: 'Drive https://app.superblocks.com/api/v1 via HTTP Request with bearer.',
  },
  retool: {
    forgeType: 'webhook',
    label: 'HTTP Request → Retool Workflows',
    rationale: 'POST your Retool workflow webhook via HTTP Request with bearer.',
  },
  loom: {
    forgeType: 'webhook',
    label: 'HTTP Request → Loom',
    rationale: 'Drive https://www.loom.com/api/v1 via HTTP Request with bearer.',
  },
  miro: {
    forgeType: 'webhook',
    label: 'HTTP Request → Miro',
    rationale: 'Drive https://api.miro.com/v2 via HTTP Request with bearer.',
  },
  figmaApi: {
    forgeType: 'webhook',
    label: 'HTTP Request → Figma',
    rationale: 'Drive https://api.figma.com/v1 via HTTP Request with X-Figma-Token.',
  },
  vimeo: {
    forgeType: 'webhook',
    label: 'HTTP Request → Vimeo',
    rationale: 'Drive https://api.vimeo.com via HTTP Request with bearer.',
  },
  youtubeData: {
    forgeType: 'webhook',
    label: 'HTTP Request → YouTube Data API',
    rationale: 'Drive https://www.googleapis.com/youtube/v3 via HTTP Request with OAuth bearer.',
  },
  spotifyTracks: {
    forgeType: 'webhook',
    label: 'HTTP Request → Spotify',
    rationale: 'Drive https://api.spotify.com/v1 via HTTP Request with OAuth bearer.',
  },
  asanaTasks: {
    forgeType: 'webhook',
    label: 'HTTP Request → Asana Tasks',
    rationale: 'Drive https://app.asana.com/api/1.0/tasks via HTTP Request with bearer.',
  },
  asanaProjects: {
    forgeType: 'webhook',
    label: 'HTTP Request → Asana Projects',
    rationale: 'Drive https://app.asana.com/api/1.0/projects via HTTP Request with bearer.',
  },
  linearIssues: {
    forgeType: 'forge_linear',
    label: 'Linear (issues via forge)',
    rationale: 'Use the Linear forge block — create / update issues directly.',
  },
  linearProjects: {
    forgeType: 'forge_linear',
    label: 'Linear (projects via forge)',
    rationale: 'Use the Linear forge block with the project action.',
  },
  mondayBoards: {
    forgeType: 'webhook',
    label: 'HTTP Request → Monday.com Boards',
    rationale: 'POST https://api.monday.com/v2 (GraphQL) via HTTP Request with api-token header.',
  },
  clickupTasks: {
    forgeType: 'webhook',
    label: 'HTTP Request → ClickUp Tasks',
    rationale: 'Drive https://api.clickup.com/api/v2/list/{id}/task via HTTP Request.',
  },
  airtopBrowser: {
    forgeType: 'webhook',
    label: 'HTTP Request → Airtop',
    rationale: 'Drive https://api.airtop.ai/api/v1 via HTTP Request with bearer.',
  },
  apify: {
    forgeType: 'webhook',
    label: 'HTTP Request → Apify',
    rationale: 'POST https://api.apify.com/v2/acts/{id}/runs via HTTP Request with bearer.',
  },
  browserless: {
    forgeType: 'webhook',
    label: 'HTTP Request → Browserless',
    rationale: 'POST https://chrome.browserless.io/screenshot via HTTP Request with token query.',
  },
  scrapingbee: {
    forgeType: 'webhook',
    label: 'HTTP Request → ScrapingBee',
    rationale: 'GET https://app.scrapingbee.com/api/v1 via HTTP Request with api_key query.',
  },
  firecrawl: {
    forgeType: 'webhook',
    label: 'HTTP Request → Firecrawl',
    rationale: 'POST https://api.firecrawl.dev/v1/scrape via HTTP Request with bearer.',
  },
  perplexitySearch: {
    forgeType: 'webhook',
    label: 'HTTP Request → Perplexity Search',
    rationale: 'POST https://api.perplexity.ai/chat/completions via HTTP Request with bearer.',
  },
  exaSearch: {
    forgeType: 'webhook',
    label: 'HTTP Request → Exa Search',
    rationale: 'POST https://api.exa.ai/search via HTTP Request with x-api-key header.',
  },
  serperSearch: {
    forgeType: 'webhook',
    label: 'HTTP Request → Serper',
    rationale: 'POST https://google.serper.dev/search via HTTP Request with X-API-KEY header.',
  },
  tavilySearch: {
    forgeType: 'webhook',
    label: 'HTTP Request → Tavily',
    rationale: 'POST https://api.tavily.com/search via HTTP Request with bearer.',
  },
  braveSearch: {
    forgeType: 'webhook',
    label: 'HTTP Request → Brave Search',
    rationale: 'GET https://api.search.brave.com/res/v1/web/search via HTTP Request with subscription token.',
  },
  algoliaSearch: {
    forgeType: 'webhook',
    label: 'HTTP Request → Algolia',
    rationale: 'Drive https://{app}.algolia.net/1 via HTTP Request with X-Algolia-API-Key.',
  },
  meilisearch: {
    forgeType: 'webhook',
    label: 'HTTP Request → Meilisearch',
    rationale: 'Drive {host}/indexes via HTTP Request with bearer.',
  },
  typesense: {
    forgeType: 'webhook',
    label: 'HTTP Request → Typesense',
    rationale: 'Drive {host}/collections via HTTP Request with X-TYPESENSE-API-KEY.',
  },

  /* ── HR / payroll / scheduling ──────────────────────── */
  bambooHr: {
    forgeType: 'webhook',
    label: 'HTTP Request → BambooHR',
    rationale: 'Drive https://api.bamboohr.com/api/gateway.php/{company}/v1 via HTTP Request with basic auth.',
  },
  gustoPayroll: {
    forgeType: 'webhook',
    label: 'HTTP Request → Gusto',
    rationale: 'Drive https://api.gusto.com/v1 via HTTP Request with bearer.',
  },
  rippling: {
    forgeType: 'webhook',
    label: 'HTTP Request → Rippling',
    rationale: 'Drive https://rest.ripplingapis.com/platform/api/companies/current via HTTP Request with bearer.',
  },
  deelHr: {
    forgeType: 'webhook',
    label: 'HTTP Request → Deel',
    rationale: 'Drive https://api.letsdeel.com/rest/v1 via HTTP Request with bearer.',
  },
  workdayHr: {
    forgeType: 'webhook',
    label: 'HTTP Request → Workday',
    rationale: 'Drive https://{tenant}.workday.com/ccx/api/v1 via HTTP Request with bearer.',
  },
  leverAts: {
    forgeType: 'webhook',
    label: 'HTTP Request → Lever',
    rationale: 'Drive https://api.lever.co/v1 via HTTP Request with basic auth.',
  },
  greenhouseAts: {
    forgeType: 'webhook',
    label: 'HTTP Request → Greenhouse',
    rationale: 'Drive https://harvest.greenhouse.io/v1 via HTTP Request with basic auth.',
  },

  /* ── Accounting / finance ───────────────────────────── */
  xeroAccounting: {
    forgeType: 'webhook',
    label: 'HTTP Request → Xero',
    rationale: 'Drive https://api.xero.com/api.xro/2.0 via HTTP Request with OAuth bearer + tenant header.',
  },
  quickbooks: {
    forgeType: 'webhook',
    label: 'HTTP Request → QuickBooks Online',
    rationale: 'Drive https://quickbooks.api.intuit.com/v3 via HTTP Request with OAuth bearer.',
  },
  freshbooks: {
    forgeType: 'webhook',
    label: 'HTTP Request → FreshBooks',
    rationale: 'Drive https://api.freshbooks.com/accounting/account/{id} via HTTP Request with OAuth bearer.',
  },
  waveAccounting: {
    forgeType: 'webhook',
    label: 'HTTP Request → Wave',
    rationale: 'POST https://gql.waveapps.com/graphql/public via HTTP Request with bearer.',
  },
  mercuryBank: {
    forgeType: 'webhook',
    label: 'HTTP Request → Mercury',
    rationale: 'Drive https://api.mercury.com/api/v1 via HTTP Request with bearer.',
  },
  plaidBanking: {
    forgeType: 'webhook',
    label: 'HTTP Request → Plaid',
    rationale: 'POST https://production.plaid.com/{path} via HTTP Request with client_id + secret in body.',
  },

  /* ── Governance / GRC ───────────────────────────────────── */
  drata: {
    forgeType: 'webhook',
    label: 'HTTP Request → Drata API',
    rationale: 'Drive https://public-api.drata.com/public via HTTP Request with bearer token.',
  },
  vantaExt: {
    forgeType: 'webhook',
    label: 'HTTP Request → Vanta',
    rationale: 'Drive https://api.vanta.com via HTTP Request with bearer token.',
  },
  onetrustExt: {
    forgeType: 'webhook',
    label: 'HTTP Request → OneTrust',
    rationale: 'Drive https://app.onetrust.com/api via HTTP Request with bearer.',
  },
  secureFrameExt: {
    forgeType: 'webhook',
    label: 'HTTP Request → SecureFrame',
    rationale: 'Drive https://api.secureframe.com via HTTP Request with bearer.',
  },
  trustero: {
    forgeType: 'webhook',
    label: 'HTTP Request → Trustero',
    rationale: 'Drive https://api.trustero.com via HTTP Request with bearer.',
  },
  hyperproof: {
    forgeType: 'webhook',
    label: 'HTTP Request → Hyperproof',
    rationale: 'Drive https://api.hyperproof.app/v1 via HTTP Request with bearer.',
  },
  tugboatLogic: {
    forgeType: 'webhook',
    label: 'HTTP Request → Tugboat Logic',
    rationale: 'Drive Tugboat Logic compliance API via HTTP Request.',
  },
  laika: {
    forgeType: 'webhook',
    label: 'HTTP Request → Laika',
    rationale: 'Drive Laika compliance API via HTTP Request with bearer.',
  },
  thoropass: {
    forgeType: 'webhook',
    label: 'HTTP Request → Thoropass',
    rationale: 'Drive Thoropass (formerly Laika) audit API via HTTP Request.',
  },
  scrut: {
    forgeType: 'webhook',
    label: 'HTTP Request → Scrut Automation',
    rationale: 'Drive Scrut compliance API via HTTP Request with bearer.',
  },
  sprintoExt: {
    forgeType: 'webhook',
    label: 'HTTP Request → Sprinto',
    rationale: 'Drive Sprinto compliance API via HTTP Request with bearer.',
  },
  archerGrc: {
    forgeType: 'webhook',
    label: 'HTTP Request → RSA Archer GRC',
    rationale: 'Drive Archer Suite REST API via HTTP Request.',
  },
  logicGate: {
    forgeType: 'webhook',
    label: 'HTTP Request → LogicGate Risk Cloud',
    rationale: 'Drive LogicGate REST API via HTTP Request with bearer.',
  },
  metricStream: {
    forgeType: 'webhook',
    label: 'HTTP Request → MetricStream',
    rationale: 'Drive MetricStream BCM/GRC API via HTTP Request.',
  },
  auditBoard: {
    forgeType: 'webhook',
    label: 'HTTP Request → AuditBoard',
    rationale: 'Drive AuditBoard REST API via HTTP Request with bearer.',
  },

  /* ── API gateways ──────────────────────────────────────── */
  kong: {
    forgeType: 'webhook',
    label: 'HTTP Request → Kong Admin API',
    rationale: 'Drive Kong Gateway admin REST API via HTTP Request.',
  },
  kongKonnect: {
    forgeType: 'webhook',
    label: 'HTTP Request → Kong Konnect',
    rationale: 'Drive https://us.api.konghq.com via HTTP Request with bearer.',
  },
  tyk: {
    forgeType: 'webhook',
    label: 'HTTP Request → Tyk Dashboard API',
    rationale: 'Drive Tyk Dashboard REST API via HTTP Request with X-Tyk-Authorization.',
  },
  tykCloud: {
    forgeType: 'webhook',
    label: 'HTTP Request → Tyk Cloud',
    rationale: 'Drive Tyk Cloud admin REST API via HTTP Request.',
  },
  awsApiGateway: {
    forgeType: 'webhook',
    label: 'HTTP Request → AWS API Gateway',
    rationale: 'Drive https://apigateway.{region}.amazonaws.com via HTTP Request with SigV4.',
  },
  awsApiGatewayV2: {
    forgeType: 'webhook',
    label: 'HTTP Request → AWS API Gateway v2',
    rationale: 'Drive HTTP API control plane via HTTP Request with SigV4.',
  },
  apigee: {
    forgeType: 'webhook',
    label: 'HTTP Request → Apigee',
    rationale: 'Drive https://apigee.googleapis.com/v1 via HTTP Request with OAuth.',
  },
  apigeeEdge: {
    forgeType: 'webhook',
    label: 'HTTP Request → Apigee Edge',
    rationale: 'Drive Apigee Edge management API via HTTP Request.',
  },
  mulesoftAnypoint: {
    forgeType: 'webhook',
    label: 'HTTP Request → MuleSoft Anypoint',
    rationale: 'Drive https://anypoint.mulesoft.com via HTTP Request with bearer.',
  },
  azureApim: {
    forgeType: 'webhook',
    label: 'HTTP Request → Azure API Management',
    rationale: 'Drive Azure APIM REST API via HTTP Request with bearer.',
  },
  wso2: {
    forgeType: 'webhook',
    label: 'HTTP Request → WSO2 API Manager',
    rationale: 'Drive WSO2 APIM REST API via HTTP Request.',
  },
  ambassador: {
    forgeType: 'webhook',
    label: 'HTTP Request → Ambassador Edge Stack',
    rationale: 'Drive Ambassador Edge Stack REST API via HTTP Request.',
  },
  gravitee: {
    forgeType: 'webhook',
    label: 'HTTP Request → Gravitee',
    rationale: 'Drive Gravitee.io API management REST endpoints via HTTP Request.',
  },
  postmanGateway: {
    forgeType: 'webhook',
    label: 'HTTP Request → Postman Gateway',
    rationale: 'Drive Postman API gateway REST endpoints via HTTP Request.',
  },

  /* ── CDN / edge ────────────────────────────────────────── */
  fastly: {
    forgeType: 'webhook',
    label: 'HTTP Request → Fastly',
    rationale: 'Drive https://api.fastly.com via HTTP Request with Fastly-Key header.',
  },
  fastlyCompute: {
    forgeType: 'webhook',
    label: 'HTTP Request → Fastly Compute',
    rationale: 'Drive Fastly Compute@Edge management API via HTTP Request.',
  },
  akamai: {
    forgeType: 'webhook',
    label: 'HTTP Request → Akamai Open API',
    rationale: 'Drive Akamai Open APIs via HTTP Request (EdgeGrid auth required).',
  },
  akamaiEdgeWorker: {
    forgeType: 'webhook',
    label: 'HTTP Request → Akamai EdgeWorkers',
    rationale: 'Drive Akamai EdgeWorker management API via HTTP Request.',
  },
  imperva: {
    forgeType: 'webhook',
    label: 'HTTP Request → Imperva Cloud WAF',
    rationale: 'Drive Imperva Cloud Application Security REST API via HTTP Request.',
  },
  cloudflareWorkers: {
    forgeType: 'forge_cloudflare_kv',
    label: 'Cloudflare KV (forge)',
    rationale: 'Closest Workers-side primitive available; for full Workers ops use HTTP Request to https://api.cloudflare.com/client/v4.',
  },
  cloudflarePages: {
    forgeType: 'webhook',
    label: 'HTTP Request → Cloudflare Pages',
    rationale: 'Drive Cloudflare Pages REST API via HTTP Request with bearer.',
  },
  bunny: {
    forgeType: 'webhook',
    label: 'HTTP Request → Bunny.net',
    rationale: 'Drive https://api.bunny.net via HTTP Request with AccessKey header.',
  },
  keycdn: {
    forgeType: 'webhook',
    label: 'HTTP Request → KeyCDN',
    rationale: 'Drive https://api.keycdn.com via HTTP Request with basic auth.',
  },
  stackpath: {
    forgeType: 'webhook',
    label: 'HTTP Request → StackPath',
    rationale: 'Drive https://gateway.stackpath.com via HTTP Request with bearer.',
  },
  cdn77: {
    forgeType: 'webhook',
    label: 'HTTP Request → CDN77',
    rationale: 'Drive CDN77 REST API via HTTP Request with login + passhash.',
  },
  edgio: {
    forgeType: 'webhook',
    label: 'HTTP Request → Edgio',
    rationale: 'Drive Edgio (Limelight + Layer0) REST API via HTTP Request.',
  },

  /* ── Email validation ──────────────────────────────────── */
  hunter: {
    forgeType: 'webhook',
    label: 'HTTP Request → Hunter.io',
    rationale: 'Drive https://api.hunter.io/v2 via HTTP Request with api_key query param.',
  },
  zerobounce: {
    forgeType: 'webhook',
    label: 'HTTP Request → ZeroBounce',
    rationale: 'Drive https://api.zerobounce.net/v2 via HTTP Request with api_key.',
  },
  neverbounce: {
    forgeType: 'webhook',
    label: 'HTTP Request → NeverBounce',
    rationale: 'Drive https://api.neverbounce.com/v4 via HTTP Request with api_key.',
  },
  kickbox: {
    forgeType: 'webhook',
    label: 'HTTP Request → Kickbox',
    rationale: 'Drive https://api.kickbox.com/v2 via HTTP Request with apikey.',
  },
  mailboxlayer: {
    forgeType: 'webhook',
    label: 'HTTP Request → mailboxlayer',
    rationale: 'Drive https://apilayer.net/api/check via HTTP Request with access_key.',
  },
  emailable: {
    forgeType: 'webhook',
    label: 'HTTP Request → Emailable',
    rationale: 'Drive https://api.emailable.com/v1 via HTTP Request with api_key.',
  },
  bouncer: {
    forgeType: 'webhook',
    label: 'HTTP Request → Bouncer',
    rationale: 'Drive https://api.usebouncer.com/v1.1 via HTTP Request with x-api-key.',
  },
  debounce: {
    forgeType: 'webhook',
    label: 'HTTP Request → DeBounce',
    rationale: 'Drive https://api.debounce.io/v1 via HTTP Request with api_key.',
  },
  mailtester: {
    forgeType: 'webhook',
    label: 'HTTP Request → Mail-Tester',
    rationale: 'Drive Mail-Tester deliverability API via HTTP Request.',
  },
  reoonEmail: {
    forgeType: 'webhook',
    label: 'HTTP Request → Reoon Email Verifier',
    rationale: 'Drive https://emailverifier.reoon.com/api/v1 via HTTP Request.',
  },

  /* ── Survey tools ──────────────────────────────────────── */
  typeformExt: {
    forgeType: 'webhook',
    label: 'HTTP Request → Typeform API',
    rationale: 'Drive https://api.typeform.com via HTTP Request with bearer.',
  },
  questionPro: {
    forgeType: 'webhook',
    label: 'HTTP Request → QuestionPro',
    rationale: 'Drive https://api.questionpro.com/a/api/v2 via HTTP Request with api-key.',
  },
  alchemer: {
    forgeType: 'webhook',
    label: 'HTTP Request → Alchemer (SurveyGizmo)',
    rationale: 'Drive https://api.alchemer.com/v5 via HTTP Request with bearer.',
  },
  qualtrics: {
    forgeType: 'webhook',
    label: 'HTTP Request → Qualtrics',
    rationale: 'Drive https://{datacenter}.qualtrics.com/API/v3 via HTTP Request with X-API-TOKEN.',
  },
  delighted: {
    forgeType: 'webhook',
    label: 'HTTP Request → Delighted',
    rationale: 'Drive https://api.delighted.com/v1 via HTTP Request with basic auth.',
  },
  surveySparrow: {
    forgeType: 'webhook',
    label: 'HTTP Request → SurveySparrow',
    rationale: 'Drive https://api.surveysparrow.com/v3 via HTTP Request with bearer.',
  },
  refiner: {
    forgeType: 'webhook',
    label: 'HTTP Request → Refiner',
    rationale: 'Drive https://api.refiner.io/v1 via HTTP Request with project token.',
  },

  /* ── Donation / fundraising ───────────────────────────── */
  donorbox: {
    forgeType: 'webhook',
    label: 'HTTP Request → Donorbox',
    rationale: 'Drive https://donorbox.org/api/v1 via HTTP Request with bearer.',
  },
  giveForms: {
    forgeType: 'webhook',
    label: 'HTTP Request → GiveForms',
    rationale: 'Drive GiveForms REST API via HTTP Request with api token.',
  },
  charifi: {
    forgeType: 'webhook',
    label: 'HTTP Request → ChariFi',
    rationale: 'Drive ChariFi donation REST API via HTTP Request with bearer.',
  },
  classy: {
    forgeType: 'webhook',
    label: 'HTTP Request → Classy',
    rationale: 'Drive https://api.classy.org/2.0 via HTTP Request with bearer.',
  },
  givebutter: {
    forgeType: 'webhook',
    label: 'HTTP Request → Givebutter',
    rationale: 'Drive https://api.givebutter.com/v1 via HTTP Request with bearer.',
  },
  fundraiseUp: {
    forgeType: 'webhook',
    label: 'HTTP Request → Fundraise Up',
    rationale: 'Drive Fundraise Up REST API via HTTP Request with bearer.',
  },
  donorPerfect: {
    forgeType: 'webhook',
    label: 'HTTP Request → DonorPerfect',
    rationale: 'Drive DonorPerfect XML/JSON API via HTTP Request.',
  },
  blackbaud: {
    forgeType: 'webhook',
    label: 'HTTP Request → Blackbaud SKY',
    rationale: 'Drive https://api.sky.blackbaud.com via HTTP Request with bb-api-subscription-key.',
  },
  givelify: {
    forgeType: 'webhook',
    label: 'HTTP Request → Givelify',
    rationale: 'Drive Givelify donation REST API via HTTP Request.',
  },
  bonterra: {
    forgeType: 'webhook',
    label: 'HTTP Request → Bonterra',
    rationale: 'Drive Bonterra (formerly EveryAction) REST API via HTTP Request.',
  },

  /* ── Event platforms ──────────────────────────────────── */
  eventbrite: {
    forgeType: 'webhook',
    label: 'HTTP Request → Eventbrite',
    rationale: 'Drive https://www.eventbriteapi.com/v3 via HTTP Request with bearer.',
  },
  hopin: {
    forgeType: 'webhook',
    label: 'HTTP Request → Hopin',
    rationale: 'Drive https://api.hopin.com via HTTP Request with bearer.',
  },
  bevy: {
    forgeType: 'webhook',
    label: 'HTTP Request → Bevy',
    rationale: 'Drive https://api.bevy.com/v1 via HTTP Request with bearer.',
  },
  splash: {
    forgeType: 'webhook',
    label: 'HTTP Request → Splash',
    rationale: 'Drive https://api.splashthat.com via HTTP Request with bearer.',
  },
  cvent: {
    forgeType: 'webhook',
    label: 'HTTP Request → Cvent',
    rationale: 'Drive https://api-platform.cvent.com via HTTP Request with bearer.',
  },
  whova: {
    forgeType: 'webhook',
    label: 'HTTP Request → Whova',
    rationale: 'Drive Whova event REST API via HTTP Request.',
  },
  meetup: {
    forgeType: 'webhook',
    label: 'HTTP Request → Meetup',
    rationale: 'Drive https://api.meetup.com/gql via HTTP Request with bearer.',
  },
  brella: {
    forgeType: 'webhook',
    label: 'HTTP Request → Brella',
    rationale: 'Drive Brella event REST API via HTTP Request with bearer.',
  },
  rainfocus: {
    forgeType: 'webhook',
    label: 'HTTP Request → RainFocus',
    rationale: 'Drive RainFocus REST API via HTTP Request with bearer.',
  },
  swoogo: {
    forgeType: 'webhook',
    label: 'HTTP Request → Swoogo',
    rationale: 'Drive https://api.swoogo.com/api/v1 via HTTP Request with bearer.',
  },

  /* ── Background checks ─────────────────────────────────── */
  checkr: {
    forgeType: 'webhook',
    label: 'HTTP Request → Checkr',
    rationale: 'Drive https://api.checkr.com/v1 via HTTP Request with basic auth.',
  },
  yardstik: {
    forgeType: 'webhook',
    label: 'HTTP Request → Yardstik',
    rationale: 'Drive Yardstik REST API via HTTP Request with bearer.',
  },
  sterling: {
    forgeType: 'webhook',
    label: 'HTTP Request → Sterling',
    rationale: 'Drive Sterling Identity REST API via HTTP Request with bearer.',
  },
  goodHire: {
    forgeType: 'webhook',
    label: 'HTTP Request → GoodHire',
    rationale: 'Drive GoodHire REST API via HTTP Request with bearer.',
  },
  certnExt: {
    forgeType: 'webhook',
    label: 'HTTP Request → Certn',
    rationale: 'Drive https://api.certn.co/api/v1 via HTTP Request with token.',
  },
  hireRight: {
    forgeType: 'webhook',
    label: 'HTTP Request → HireRight',
    rationale: 'Drive HireRight REST API via HTTP Request with OAuth.',
  },
  accurate: {
    forgeType: 'webhook',
    label: 'HTTP Request → Accurate Background',
    rationale: 'Drive Accurate Background REST API via HTTP Request.',
  },
  shareable: {
    forgeType: 'webhook',
    label: 'HTTP Request → Shareable for Hires',
    rationale: 'Drive Shareable REST API via HTTP Request.',
  },

  /* ── Tax ───────────────────────────────────────────────── */
  avalara: {
    forgeType: 'webhook',
    label: 'HTTP Request → Avalara AvaTax',
    rationale: 'Drive https://rest.avatax.com/api/v2 via HTTP Request with basic auth.',
  },
  taxjar: {
    forgeType: 'webhook',
    label: 'HTTP Request → TaxJar',
    rationale: 'Drive https://api.taxjar.com/v2 via HTTP Request with bearer.',
  },
  stripeTax: {
    forgeType: 'webhook',
    label: 'HTTP Request → Stripe Tax',
    rationale: 'Drive Stripe Tax via the existing Stripe REST API (tax_calculations + tax_transactions resources).',
  },
  vertex: {
    forgeType: 'webhook',
    label: 'HTTP Request → Vertex Tax',
    rationale: 'Drive Vertex O Series REST API via HTTP Request.',
  },
  taxify: {
    forgeType: 'webhook',
    label: 'HTTP Request → Taxify (Sovos)',
    rationale: 'Drive Sovos Taxify REST API via HTTP Request with bearer.',
  },
  sovos: {
    forgeType: 'webhook',
    label: 'HTTP Request → Sovos',
    rationale: 'Drive Sovos Cloud Indirect Tax API via HTTP Request.',
  },
  zonosTax: {
    forgeType: 'webhook',
    label: 'HTTP Request → Zonos',
    rationale: 'Drive https://api.zonos.com via HTTP Request with bearer.',
  },
  thomsonReutersOnesource: {
    forgeType: 'webhook',
    label: 'HTTP Request → Thomson Reuters ONESOURCE',
    rationale: 'Drive ONESOURCE Indirect Tax Determination via HTTP Request.',
  },

  /* ── Legal / CLM ──────────────────────────────────────── */
  ironclad: {
    forgeType: 'webhook',
    label: 'HTTP Request → Ironclad',
    rationale: 'Drive https://api.ironcladapp.com/public/api/v1 via HTTP Request with bearer.',
  },
  juro: {
    forgeType: 'webhook',
    label: 'HTTP Request → Juro',
    rationale: 'Drive https://api.juro.com/api/v1 via HTTP Request with bearer.',
  },
  docusignClm: {
    forgeType: 'webhook',
    label: 'HTTP Request → DocuSign CLM',
    rationale: 'Drive DocuSign CLM REST API via HTTP Request with OAuth bearer.',
  },
  contractWorks: {
    forgeType: 'webhook',
    label: 'HTTP Request → ContractWorks',
    rationale: 'Drive ContractWorks REST API via HTTP Request with bearer.',
  },
  pandaDoc: {
    forgeType: 'webhook',
    label: 'HTTP Request → PandaDoc',
    rationale: 'Drive https://api.pandadoc.com/public/v1 via HTTP Request with bearer.',
  },
  contractbook: {
    forgeType: 'webhook',
    label: 'HTTP Request → Contractbook',
    rationale: 'Drive https://api.contractbook.com/v1 via HTTP Request with bearer.',
  },
  agiloft: {
    forgeType: 'webhook',
    label: 'HTTP Request → Agiloft CLM',
    rationale: 'Drive Agiloft REST API via HTTP Request with bearer.',
  },
  conga: {
    forgeType: 'webhook',
    label: 'HTTP Request → Conga CLM',
    rationale: 'Drive Conga Contract Lifecycle REST API via HTTP Request.',
  },
  icertis: {
    forgeType: 'webhook',
    label: 'HTTP Request → Icertis',
    rationale: 'Drive Icertis ICI REST API via HTTP Request with bearer.',
  },
  evisort: {
    forgeType: 'webhook',
    label: 'HTTP Request → Evisort',
    rationale: 'Drive Evisort REST API via HTTP Request with bearer.',
  },
  spotdraft: {
    forgeType: 'webhook',
    label: 'HTTP Request → SpotDraft',
    rationale: 'Drive SpotDraft REST API via HTTP Request with bearer.',
  },

  /* ── Reviews / reputation ─────────────────────────────── */
  trustpilot: {
    forgeType: 'webhook',
    label: 'HTTP Request → Trustpilot',
    rationale: 'Drive https://api.trustpilot.com/v1 via HTTP Request with bearer.',
  },
  yotpo: {
    forgeType: 'webhook',
    label: 'HTTP Request → Yotpo',
    rationale: 'Drive https://api.yotpo.com/v1 via HTTP Request with token.',
  },
  capterra: {
    forgeType: 'webhook',
    label: 'HTTP Request → Capterra',
    rationale: 'Drive Capterra review REST API via HTTP Request with bearer.',
  },
  g2: {
    forgeType: 'webhook',
    label: 'HTTP Request → G2',
    rationale: 'Drive https://data.g2.com/api/v1 via HTTP Request with bearer.',
  },
  bazaarvoice: {
    forgeType: 'webhook',
    label: 'HTTP Request → Bazaarvoice',
    rationale: 'Drive Bazaarvoice Conversations REST API via HTTP Request.',
  },
  reviewsIo: {
    forgeType: 'webhook',
    label: 'HTTP Request → REVIEWS.io',
    rationale: 'Drive https://api.reviews.io via HTTP Request with bearer.',
  },
  judgeMe: {
    forgeType: 'webhook',
    label: 'HTTP Request → Judge.me',
    rationale: 'Drive https://judge.me/api/v1 via HTTP Request with shop_domain + token.',
  },
  loox: {
    forgeType: 'webhook',
    label: 'HTTP Request → Loox',
    rationale: 'Drive Loox reviews REST API via HTTP Request with bearer.',
  },
  feefo: {
    forgeType: 'webhook',
    label: 'HTTP Request → Feefo',
    rationale: 'Drive Feefo REST API via HTTP Request with bearer.',
  },
  okendo: {
    forgeType: 'webhook',
    label: 'HTTP Request → Okendo',
    rationale: 'Drive Okendo REST API via HTTP Request with bearer.',
  },
  birdEye: {
    forgeType: 'webhook',
    label: 'HTTP Request → Birdeye',
    rationale: 'Drive Birdeye REST API via HTTP Request with api_key.',
  },
  podium: {
    forgeType: 'webhook',
    label: 'HTTP Request → Podium',
    rationale: 'Drive https://api.podium.com/v4 via HTTP Request with bearer.',
  },

  /* ── Maps / location ──────────────────────────────────── */
  mapboxExt: {
    forgeType: 'webhook',
    label: 'HTTP Request → Mapbox',
    rationale: 'Drive https://api.mapbox.com via HTTP Request with access_token.',
  },
  googleMapsPlatform: {
    forgeType: 'webhook',
    label: 'HTTP Request → Google Maps Platform',
    rationale: 'Drive https://maps.googleapis.com/maps/api via HTTP Request with key query param.',
  },
  here: {
    forgeType: 'webhook',
    label: 'HTTP Request → HERE',
    rationale: 'Drive HERE Location Services REST API via HTTP Request with apiKey.',
  },
  tomTom: {
    forgeType: 'webhook',
    label: 'HTTP Request → TomTom',
    rationale: 'Drive https://api.tomtom.com via HTTP Request with key query param.',
  },
  openStreetMap: {
    forgeType: 'webhook',
    label: 'HTTP Request → OpenStreetMap (Nominatim)',
    rationale: 'Drive https://nominatim.openstreetmap.org via HTTP Request (User-Agent required).',
  },
  geoapify: {
    forgeType: 'webhook',
    label: 'HTTP Request → Geoapify',
    rationale: 'Drive https://api.geoapify.com/v1 via HTTP Request with apiKey.',
  },
  positionstack: {
    forgeType: 'webhook',
    label: 'HTTP Request → positionstack',
    rationale: 'Drive http://api.positionstack.com/v1 via HTTP Request with access_key.',
  },
  radarIo: {
    forgeType: 'webhook',
    label: 'HTTP Request → Radar.io',
    rationale: 'Drive https://api.radar.io/v1 via HTTP Request with secret key.',
  },
  what3Words: {
    forgeType: 'webhook',
    label: 'HTTP Request → what3words',
    rationale: 'Drive https://api.what3words.com/v3 via HTTP Request with key.',
  },
  foursquarePlaces: {
    forgeType: 'webhook',
    label: 'HTTP Request → Foursquare Places',
    rationale: 'Drive https://api.foursquare.com/v3/places via HTTP Request with bearer.',
  },
  uberApi: {
    forgeType: 'webhook',
    label: 'HTTP Request → Uber API',
    rationale: 'Drive https://api.uber.com/v1.2 via HTTP Request with bearer.',
  },
  lyftApi: {
    forgeType: 'webhook',
    label: 'HTTP Request → Lyft API',
    rationale: 'Drive https://api.lyft.com/v1 via HTTP Request with bearer.',
  },

  /* ── Email API / transactional ─────────────────────────── */
  mandrill: {
    forgeType: 'send_email',
    label: 'Send Email (with Mandrill SMTP)',
    rationale: 'Configure SMTP pointing at smtp.mandrillapp.com on the Send Email block.',
  },
  mailerSend: {
    forgeType: 'webhook',
    label: 'HTTP Request → MailerSend',
    rationale: 'Drive https://api.mailersend.com/v1 via HTTP Request with bearer.',
  },
  loops: {
    forgeType: 'webhook',
    label: 'HTTP Request → Loops',
    rationale: 'Drive https://app.loops.so/api/v1 via HTTP Request with bearer.',
  },
  postmark: {
    forgeType: 'webhook',
    label: 'HTTP Request → Postmark',
    rationale: 'Drive https://api.postmarkapp.com via HTTP Request with X-Postmark-Server-Token.',
  },
  sparkpost: {
    forgeType: 'webhook',
    label: 'HTTP Request → SparkPost',
    rationale: 'Drive https://api.sparkpost.com/api/v1 via HTTP Request with Authorization header.',
  },
  amazonSes: {
    forgeType: 'webhook',
    label: 'HTTP Request → Amazon SES',
    rationale: 'Drive https://email.{region}.amazonaws.com via HTTP Request with SigV4.',
  },
  sendinblue: {
    forgeType: 'webhook',
    label: 'HTTP Request → Brevo (Sendinblue)',
    rationale: 'Drive https://api.brevo.com/v3 via HTTP Request with api-key.',
  },
  brevo: {
    forgeType: 'webhook',
    label: 'HTTP Request → Brevo',
    rationale: 'Drive https://api.brevo.com/v3 via HTTP Request with api-key.',
  },
  elasticEmail: {
    forgeType: 'webhook',
    label: 'HTTP Request → Elastic Email',
    rationale: 'Drive https://api.elasticemail.com/v4 via HTTP Request with X-ElasticEmail-ApiKey.',
  },
  mailtrap: {
    forgeType: 'webhook',
    label: 'HTTP Request → Mailtrap',
    rationale: 'Drive https://send.api.mailtrap.io/api/send via HTTP Request with bearer.',
  },
  mailjet: {
    forgeType: 'webhook',
    label: 'HTTP Request → Mailjet',
    rationale: 'Drive https://api.mailjet.com/v3.1 via HTTP Request with basic auth.',
  },
  customerIoEmail: {
    forgeType: 'webhook',
    label: 'HTTP Request → Customer.io Transactional',
    rationale: 'Drive https://api.customer.io/v1 via HTTP Request with bearer.',
  },

  /* ── Translation / localisation ───────────────────────── */
  smartling: {
    forgeType: 'webhook',
    label: 'HTTP Request → Smartling',
    rationale: 'Drive https://api.smartling.com via HTTP Request with bearer.',
  },
  bureauWorks: {
    forgeType: 'webhook',
    label: 'HTTP Request → Bureau Works',
    rationale: 'Drive Bureau Works REST API via HTTP Request with bearer.',
  },
  phraseStrings: {
    forgeType: 'webhook',
    label: 'HTTP Request → Phrase Strings',
    rationale: 'Drive https://api.phrase.com/v2 via HTTP Request with bearer.',
  },
  lokalise: {
    forgeType: 'webhook',
    label: 'HTTP Request → Lokalise',
    rationale: 'Drive https://api.lokalise.com/api2 via HTTP Request with x-api-token.',
  },
  crowdin: {
    forgeType: 'webhook',
    label: 'HTTP Request → Crowdin',
    rationale: 'Drive https://api.crowdin.com/api/v2 via HTTP Request with bearer.',
  },
  transifex: {
    forgeType: 'webhook',
    label: 'HTTP Request → Transifex',
    rationale: 'Drive https://rest.api.transifex.com via HTTP Request with bearer.',
  },
  weglot: {
    forgeType: 'webhook',
    label: 'HTTP Request → Weglot',
    rationale: 'Drive https://api.weglot.com via HTTP Request with api-key.',
  },
  poEditor: {
    forgeType: 'webhook',
    label: 'HTTP Request → POEditor',
    rationale: 'Drive https://api.poeditor.com/v2 via HTTP Request with api_token.',
  },
  deepl: {
    forgeType: 'webhook',
    label: 'HTTP Request → DeepL',
    rationale: 'Drive https://api.deepl.com/v2 via HTTP Request with auth_key.',
  },
  googleTranslate: {
    forgeType: 'webhook',
    label: 'HTTP Request → Google Cloud Translation',
    rationale: 'Drive https://translation.googleapis.com/v3 via HTTP Request with bearer.',
  },
  awsTranslate: {
    forgeType: 'webhook',
    label: 'HTTP Request → AWS Translate',
    rationale: 'Drive AWS Translate via HTTP Request with SigV4.',
  },

  /* ── HR-ext / payroll ──────────────────────────────────── */
  payChex: {
    forgeType: 'webhook',
    label: 'HTTP Request → Paychex Flex',
    rationale: 'Drive https://api.paychex.com via HTTP Request with bearer.',
  },
  adp: {
    forgeType: 'webhook',
    label: 'HTTP Request → ADP Workforce Now',
    rationale: 'Drive https://api.adp.com via HTTP Request with bearer (mutual TLS required).',
  },
  triNet: {
    forgeType: 'webhook',
    label: 'HTTP Request → TriNet',
    rationale: 'Drive TriNet REST API via HTTP Request with bearer.',
  },
  justworksExt: {
    forgeType: 'webhook',
    label: 'HTTP Request → Justworks',
    rationale: 'Drive Justworks REST API via HTTP Request with bearer.',
  },
  gustoExt: {
    forgeType: 'webhook',
    label: 'HTTP Request → Gusto',
    rationale: 'Drive https://api.gusto.com/v1 via HTTP Request with bearer.',
  },
  deelExt: {
    forgeType: 'webhook',
    label: 'HTTP Request → Deel',
    rationale: 'Drive https://api.letsdeel.com/rest/v2 via HTTP Request with bearer.',
  },
  remoteCom: {
    forgeType: 'webhook',
    label: 'HTTP Request → Remote.com',
    rationale: 'Drive https://gateway.remote.com/v1 via HTTP Request with bearer.',
  },
  papayaGlobal: {
    forgeType: 'webhook',
    label: 'HTTP Request → Papaya Global',
    rationale: 'Drive Papaya Global REST API via HTTP Request with bearer.',
  },
  multiplier: {
    forgeType: 'webhook',
    label: 'HTTP Request → Multiplier',
    rationale: 'Drive Multiplier REST API via HTTP Request with bearer.',
  },
  oysterHr: {
    forgeType: 'webhook',
    label: 'HTTP Request → Oyster HR',
    rationale: 'Drive Oyster HR REST API via HTTP Request with bearer.',
  },
  zenefits: {
    forgeType: 'webhook',
    label: 'HTTP Request → Zenefits / TriNet HR',
    rationale: 'Drive https://api.zenefits.com/core via HTTP Request with bearer.',
  },
  squarePayroll: {
    forgeType: 'webhook',
    label: 'HTTP Request → Square Payroll',
    rationale: 'Drive https://connect.squareup.com/v2/payroll via HTTP Request with bearer.',
  },
  workdayHcm: {
    forgeType: 'webhook',
    label: 'HTTP Request → Workday HCM',
    rationale: 'Drive Workday REST API via HTTP Request with bearer (tenant-scoped).',
  },

  /* ── Analytics / product ──────────────────────────────── */
  heap: {
    forgeType: 'webhook',
    label: 'HTTP Request → Heap',
    rationale: 'Drive https://heapanalytics.com/api via HTTP Request with app_id.',
  },
  pendoExt: {
    forgeType: 'webhook',
    label: 'HTTP Request → Pendo',
    rationale: 'Drive https://app.pendo.io/api/v1 via HTTP Request with x-pendo-integration-key.',
  },
  fullstory: {
    forgeType: 'webhook',
    label: 'HTTP Request → FullStory',
    rationale: 'Drive https://api.fullstory.com/v2 via HTTP Request with bearer.',
  },
  logRocket: {
    forgeType: 'webhook',
    label: 'HTTP Request → LogRocket',
    rationale: 'Drive https://api.logrocket.com via HTTP Request with bearer.',
  },
  appcues: {
    forgeType: 'webhook',
    label: 'HTTP Request → Appcues',
    rationale: 'Drive https://api.appcues.com/v1 via HTTP Request with bearer.',
  },
  productboard: {
    forgeType: 'webhook',
    label: 'HTTP Request → Productboard',
    rationale: 'Drive https://api.productboard.com via HTTP Request with bearer.',
  },
  aha: {
    forgeType: 'webhook',
    label: 'HTTP Request → Aha!',
    rationale: 'Drive https://{subdomain}.aha.io/api/v1 via HTTP Request with bearer.',
  },
  canny: {
    forgeType: 'webhook',
    label: 'HTTP Request → Canny',
    rationale: 'Drive https://canny.io/api/v1 via HTTP Request with api_key.',
  },
  userVoice: {
    forgeType: 'webhook',
    label: 'HTTP Request → UserVoice',
    rationale: 'Drive UserVoice REST API via HTTP Request with bearer.',
  },

  /* ── Video / streaming ────────────────────────────────── */
  muxVideo: {
    forgeType: 'webhook',
    label: 'HTTP Request → Mux Video',
    rationale: 'Drive https://api.mux.com/video/v1 via HTTP Request with basic auth.',
  },
  vimeoOtt: {
    forgeType: 'webhook',
    label: 'HTTP Request → Vimeo OTT',
    rationale: 'Drive https://api.vhx.tv via HTTP Request with basic auth.',
  },
  jwPlayer: {
    forgeType: 'webhook',
    label: 'HTTP Request → JW Player',
    rationale: 'Drive https://api.jwplayer.com/v2 via HTTP Request with bearer.',
  },
  panopto: {
    forgeType: 'webhook',
    label: 'HTTP Request → Panopto',
    rationale: 'Drive Panopto REST API via HTTP Request with bearer.',
  },
  wistia: {
    forgeType: 'webhook',
    label: 'HTTP Request → Wistia',
    rationale: 'Drive https://api.wistia.com/v1 via HTTP Request with bearer.',
  },
  livestreamCom: {
    forgeType: 'webhook',
    label: 'HTTP Request → Vimeo Livestream',
    rationale: 'Drive https://livestreamapis.com/v3 via HTTP Request with bearer.',
  },
  agora: {
    forgeType: 'webhook',
    label: 'HTTP Request → Agora.io',
    rationale: 'Drive https://api.agora.io/v1 via HTTP Request with basic auth.',
  },
  daily: {
    forgeType: 'webhook',
    label: 'HTTP Request → Daily.co',
    rationale: 'Drive https://api.daily.co/v1 via HTTP Request with bearer.',
  },
  hundredMs: {
    forgeType: 'webhook',
    label: 'HTTP Request → 100ms',
    rationale: 'Drive https://api.100ms.live/v2 via HTTP Request with bearer.',
  },

  /* ── Chat infra ────────────────────────────────────────── */
  pusher: {
    forgeType: 'webhook',
    label: 'HTTP Request → Pusher Channels',
    rationale: 'Drive https://api-{cluster}.pusher.com/apps via HTTP Request with HMAC auth.',
  },
  ably: {
    forgeType: 'webhook',
    label: 'HTTP Request → Ably',
    rationale: 'Drive https://rest.ably.io via HTTP Request with basic auth (key).',
  },
  streamChat: {
    forgeType: 'webhook',
    label: 'HTTP Request → Stream Chat',
    rationale: 'Drive https://chat.stream-io-api.com via HTTP Request with HMAC + API key.',
  },
  sendbird: {
    forgeType: 'webhook',
    label: 'HTTP Request → Sendbird',
    rationale: 'Drive https://api-{app_id}.sendbird.com/v3 via HTTP Request with Api-Token.',
  },
  crisp: {
    forgeType: 'webhook',
    label: 'HTTP Request → Crisp',
    rationale: 'Drive https://api.crisp.chat/v1 via HTTP Request with basic auth.',
  },
  front: {
    forgeType: 'webhook',
    label: 'HTTP Request → Front',
    rationale: 'Drive https://api2.frontapp.com via HTTP Request with bearer.',
  },
  helpScout: {
    forgeType: 'webhook',
    label: 'HTTP Request → Help Scout',
    rationale: 'Drive https://api.helpscout.net/v2 via HTTP Request with bearer.',
  },
  zoomChat: {
    forgeType: 'webhook',
    label: 'HTTP Request → Zoom Team Chat',
    rationale: 'Drive Zoom Team Chat REST API via HTTP Request with bearer.',
  },
  tawkTo: {
    forgeType: 'webhook',
    label: 'HTTP Request → tawk.to',
    rationale: 'Drive https://api.tawk.to/v1 via HTTP Request with bearer.',
  },
  liveAgent: {
    forgeType: 'webhook',
    label: 'HTTP Request → LiveAgent',
    rationale: 'Drive https://{account}.ladesk.com/api/v3 via HTTP Request with bearer.',
  },

  /* ── KYC / identity ────────────────────────────────────── */
  persona: {
    forgeType: 'webhook',
    label: 'HTTP Request → Persona',
    rationale: 'Drive https://withpersona.com/api/v1 via HTTP Request with bearer.',
  },
  stripeIdentity: {
    forgeType: 'webhook',
    label: 'HTTP Request → Stripe Identity',
    rationale: 'Drive Stripe Identity verification REST API via HTTP Request with bearer.',
  },
  onfido: {
    forgeType: 'webhook',
    label: 'HTTP Request → Onfido',
    rationale: 'Drive https://api.onfido.com/v3.6 via HTTP Request with Token token=.',
  },
  jumio: {
    forgeType: 'webhook',
    label: 'HTTP Request → Jumio',
    rationale: 'Drive Jumio Netverify REST API via HTTP Request with basic auth.',
  },
  trulioo: {
    forgeType: 'webhook',
    label: 'HTTP Request → Trulioo',
    rationale: 'Drive https://api.globaldatacompany.com/verifications/v1 via HTTP Request with bearer.',
  },
  sumsub: {
    forgeType: 'webhook',
    label: 'HTTP Request → Sumsub',
    rationale: 'Drive https://api.sumsub.com via HTTP Request with HMAC signature.',
  },
  veriff: {
    forgeType: 'webhook',
    label: 'HTTP Request → Veriff',
    rationale: 'Drive https://stationapi.veriff.com/v1 via HTTP Request with X-AUTH-CLIENT.',
  },
  idnow: {
    forgeType: 'webhook',
    label: 'HTTP Request → IDnow',
    rationale: 'Drive IDnow REST API via HTTP Request with bearer.',
  },
  socure: {
    forgeType: 'webhook',
    label: 'HTTP Request → Socure',
    rationale: 'Drive https://api.socure.com via HTTP Request with bearer.',
  },
  alloy: {
    forgeType: 'webhook',
    label: 'HTTP Request → Alloy',
    rationale: 'Drive https://sandbox.alloy.co/v1 via HTTP Request with basic auth.',
  },

  /* ── Transcription / speech ───────────────────────────── */
  assemblyAi: {
    forgeType: 'webhook',
    label: 'HTTP Request → AssemblyAI',
    rationale: 'Drive https://api.assemblyai.com/v2 via HTTP Request with Authorization header (token).',
  },
  deepgramExt: {
    forgeType: 'webhook',
    label: 'HTTP Request → Deepgram',
    rationale: 'Drive https://api.deepgram.com/v1 via HTTP Request with Token auth.',
  },
  rev: {
    forgeType: 'webhook',
    label: 'HTTP Request → Rev.ai',
    rationale: 'Drive https://api.rev.ai/speechtotext/v1 via HTTP Request with bearer.',
  },
  speechmatics: {
    forgeType: 'webhook',
    label: 'HTTP Request → Speechmatics',
    rationale: 'Drive https://asr.api.speechmatics.com/v2 via HTTP Request with bearer.',
  },
  whisperApi: {
    forgeType: 'open_ai',
    label: 'OpenAI Whisper (native)',
    rationale: 'Use the OpenAI block — transcriptions endpoint runs Whisper.',
  },
  awsTranscribe: {
    forgeType: 'webhook',
    label: 'HTTP Request → AWS Transcribe',
    rationale: 'Drive AWS Transcribe REST API via HTTP Request with SigV4.',
  },
  googleSpeechToText: {
    forgeType: 'webhook',
    label: 'HTTP Request → Google Speech-to-Text',
    rationale: 'Drive https://speech.googleapis.com/v1 via HTTP Request with bearer.',
  },
  azureSpeech: {
    forgeType: 'webhook',
    label: 'HTTP Request → Azure Speech',
    rationale: 'Drive Azure Speech REST API via HTTP Request with Ocp-Apim-Subscription-Key.',
  },

  /* ── Forms / no-code ──────────────────────────────────── */
  tallyExt: {
    forgeType: 'webhook',
    label: 'HTTP Request → Tally',
    rationale: 'Drive https://api.tally.so via HTTP Request with bearer.',
  },
  feathery: {
    forgeType: 'webhook',
    label: 'HTTP Request → Feathery',
    rationale: 'Drive https://api.feathery.io/api/v1 via HTTP Request with bearer.',
  },
  paperformExt: {
    forgeType: 'webhook',
    label: 'HTTP Request → Paperform',
    rationale: 'Drive Paperform REST API via HTTP Request with bearer.',
  },
  fillout: {
    forgeType: 'webhook',
    label: 'HTTP Request → Fillout',
    rationale: 'Drive https://api.fillout.com/v1 via HTTP Request with bearer.',
  },
  formless: {
    forgeType: 'webhook',
    label: 'HTTP Request → Formless',
    rationale: 'Drive Formless REST API via HTTP Request with bearer.',
  },

  /* ── ML / model ops ───────────────────────────────────── */
  replicatePred: {
    forgeType: 'webhook',
    label: 'HTTP Request → Replicate Predictions',
    rationale: 'Drive https://api.replicate.com/v1/predictions via HTTP Request with Token auth.',
  },
  banana: {
    forgeType: 'webhook',
    label: 'HTTP Request → Banana.dev',
    rationale: 'Drive Banana inference REST API via HTTP Request with bearer.',
  },
  modal: {
    forgeType: 'webhook',
    label: 'HTTP Request → Modal',
    rationale: 'Drive Modal REST API via HTTP Request with bearer.',
  },
  runpod: {
    forgeType: 'webhook',
    label: 'HTTP Request → RunPod',
    rationale: 'Drive https://api.runpod.io/v2 via HTTP Request with bearer.',
  },
  predibase: {
    forgeType: 'webhook',
    label: 'HTTP Request → Predibase',
    rationale: 'Drive Predibase REST API via HTTP Request with bearer.',
  },
  baseten: {
    forgeType: 'webhook',
    label: 'HTTP Request → Baseten',
    rationale: 'Drive Baseten REST API via HTTP Request with Api-Key.',
  },
  groq: {
    forgeType: 'webhook',
    label: 'HTTP Request → Groq',
    rationale: 'Drive https://api.groq.com/openai/v1 via HTTP Request with bearer.',
  },
  fireworks: {
    forgeType: 'webhook',
    label: 'HTTP Request → Fireworks AI',
    rationale: 'Drive https://api.fireworks.ai/inference/v1 via HTTP Request with bearer.',
  },
  octoAi: {
    forgeType: 'webhook',
    label: 'HTTP Request → OctoAI',
    rationale: 'Drive https://text.octoai.run/v1 via HTTP Request with bearer.',
  },
  anyscale: {
    forgeType: 'webhook',
    label: 'HTTP Request → Anyscale',
    rationale: 'Drive https://api.endpoints.anyscale.com/v1 via HTTP Request with bearer.',
  },
  vertexAi: {
    forgeType: 'webhook',
    label: 'HTTP Request → Google Vertex AI',
    rationale: 'Drive Vertex AI REST API via HTTP Request with bearer.',
  },
  // awsBedrock fallback removed — `forge_lm_chat_bedrock` and
  // `forge_embeddings_bedrock` are now real SigV4-signing executors
  // (see src/lib/sabflow/forge/aws/sigv4.ts).
  azureOpenAi: {
    forgeType: 'webhook',
    label: 'HTTP Request → Azure OpenAI',
    rationale: 'Drive https://{resource}.openai.azure.com/openai/deployments via HTTP Request with api-key.',
  },

  /* ── Customer data / CDP ──────────────────────────────── */
  customerIoExt: {
    forgeType: 'webhook',
    label: 'HTTP Request → Customer.io',
    rationale: 'Drive https://track.customer.io/api/v1 via HTTP Request with basic auth.',
  },
  freshpaint: {
    forgeType: 'webhook',
    label: 'HTTP Request → Freshpaint',
    rationale: 'Drive Freshpaint REST API via HTTP Request with bearer.',
  },
  treasureData: {
    forgeType: 'webhook',
    label: 'HTTP Request → Treasure Data CDP',
    rationale: 'Drive https://api.treasuredata.com/v3 via HTTP Request with TD1 auth.',
  },
  amperity: {
    forgeType: 'webhook',
    label: 'HTTP Request → Amperity',
    rationale: 'Drive Amperity REST API via HTTP Request with bearer.',
  },
  blueshift: {
    forgeType: 'webhook',
    label: 'HTTP Request → Blueshift',
    rationale: 'Drive https://api.getblueshift.com/api via HTTP Request with basic auth.',
  },
  iterableExt: {
    forgeType: 'webhook',
    label: 'HTTP Request → Iterable',
    rationale: 'Drive https://api.iterable.com/api via HTTP Request with Api-Key.',
  },
  brazeExt: {
    forgeType: 'webhook',
    label: 'HTTP Request → Braze',
    rationale: 'Drive https://rest.iad-01.braze.com via HTTP Request with bearer.',
  },
  bloomreach: {
    forgeType: 'webhook',
    label: 'HTTP Request → Bloomreach Engagement',
    rationale: 'Drive Bloomreach REST API via HTTP Request with basic auth.',
  },
  emarsysExt: {
    forgeType: 'webhook',
    label: 'HTTP Request → Emarsys',
    rationale: 'Drive https://api.emarsys.net/api/v2 via HTTP Request with WSSE auth.',
  },

  /* ── Ad networks ──────────────────────────────────────── */
  googleAdsExt: {
    forgeType: 'webhook',
    label: 'HTTP Request → Google Ads',
    rationale: 'Drive https://googleads.googleapis.com via HTTP Request with bearer + developer-token.',
  },
  metaAdsExt: {
    forgeType: 'webhook',
    label: 'HTTP Request → Meta Marketing API',
    rationale: 'Drive https://graph.facebook.com/v25.0 via HTTP Request with bearer.',
  },
  linkedinAds: {
    forgeType: 'webhook',
    label: 'HTTP Request → LinkedIn Ads',
    rationale: 'Drive https://api.linkedin.com/rest via HTTP Request with bearer + LinkedIn-Version.',
  },
  tiktokAds: {
    forgeType: 'webhook',
    label: 'HTTP Request → TikTok Marketing API',
    rationale: 'Drive https://business-api.tiktok.com/open_api/v1.3 via HTTP Request with Access-Token.',
  },
  redditAds: {
    forgeType: 'webhook',
    label: 'HTTP Request → Reddit Ads',
    rationale: 'Drive https://ads-api.reddit.com/api/v3 via HTTP Request with bearer.',
  },
  pinterestAds: {
    forgeType: 'webhook',
    label: 'HTTP Request → Pinterest Ads',
    rationale: 'Drive https://api.pinterest.com/v5 via HTTP Request with bearer.',
  },
  snapchatAds: {
    forgeType: 'webhook',
    label: 'HTTP Request → Snapchat Marketing API',
    rationale: 'Drive https://adsapi.snapchat.com/v1 via HTTP Request with bearer.',
  },
  bingAds: {
    forgeType: 'webhook',
    label: 'HTTP Request → Microsoft Ads',
    rationale: 'Drive Microsoft Advertising REST API via HTTP Request with bearer.',
  },
  twitterAdsExt: {
    forgeType: 'webhook',
    label: 'HTTP Request → X (Twitter) Ads',
    rationale: 'Drive https://ads-api.twitter.com/12 via HTTP Request with OAuth 1.0a.',
  },
  amazonAds: {
    forgeType: 'webhook',
    label: 'HTTP Request → Amazon Advertising',
    rationale: 'Drive https://advertising-api.amazon.com via HTTP Request with bearer + Amazon-Advertising-API-Scope.',
  },
  tradeDesk: {
    forgeType: 'webhook',
    label: 'HTTP Request → The Trade Desk',
    rationale: 'Drive https://api.thetradedesk.com/v3 via HTTP Request with TTD-Auth.',
  },
  taboola: {
    forgeType: 'webhook',
    label: 'HTTP Request → Taboola',
    rationale: 'Drive https://backstage.taboola.com/backstage/api/1.0 via HTTP Request with bearer.',
  },
  outbrain: {
    forgeType: 'webhook',
    label: 'HTTP Request → Outbrain',
    rationale: 'Drive https://api.outbrain.com/amplify/v0.1 via HTTP Request with OB-TOKEN-V1.',
  },

  /* ── Ecommerce ────────────────────────────────────────── */
  magento: {
    forgeType: 'webhook',
    label: 'HTTP Request → Adobe Commerce (Magento)',
    rationale: 'Drive https://{store}/rest/V1 via HTTP Request with bearer.',
  },
  prestashop: {
    forgeType: 'webhook',
    label: 'HTTP Request → PrestaShop',
    rationale: 'Drive https://{store}/api via HTTP Request with basic auth.',
  },
  shopware: {
    forgeType: 'webhook',
    label: 'HTTP Request → Shopware',
    rationale: 'Drive Shopware Admin REST API via HTTP Request with bearer.',
  },
  squarespaceCommerce: {
    forgeType: 'webhook',
    label: 'HTTP Request → Squarespace Commerce',
    rationale: 'Drive https://api.squarespace.com/1.0/commerce via HTTP Request with bearer.',
  },
  wixCommerce: {
    forgeType: 'webhook',
    label: 'HTTP Request → Wix Commerce',
    rationale: 'Drive https://www.wixapis.com/stores/v1 via HTTP Request with bearer.',
  },
  ecwid: {
    forgeType: 'webhook',
    label: 'HTTP Request → Ecwid',
    rationale: 'Drive https://app.ecwid.com/api/v3 via HTTP Request with bearer.',
  },
  salla: {
    forgeType: 'webhook',
    label: 'HTTP Request → Salla',
    rationale: 'Drive https://api.salla.dev/admin/v2 via HTTP Request with bearer.',
  },
  saleor: {
    forgeType: 'webhook',
    label: 'HTTP Request → Saleor',
    rationale: 'Drive Saleor GraphQL API via HTTP Request with bearer.',
  },
  commercetools: {
    forgeType: 'webhook',
    label: 'HTTP Request → commercetools',
    rationale: 'Drive https://api.{region}.commercetools.com via HTTP Request with bearer.',
  },
  swell: {
    forgeType: 'webhook',
    label: 'HTTP Request → Swell',
    rationale: 'Drive https://api.swell.store via HTTP Request with basic auth.',
  },
  cratejoy: {
    forgeType: 'webhook',
    label: 'HTTP Request → Cratejoy',
    rationale: 'Drive https://api.cratejoy.com/v1 via HTTP Request with basic auth.',
  },

  /* ── Logistics / shipping ─────────────────────────────── */
  shippo: {
    forgeType: 'webhook',
    label: 'HTTP Request → Shippo',
    rationale: 'Drive https://api.goshippo.com via HTTP Request with ShippoToken.',
  },
  easypost: {
    forgeType: 'webhook',
    label: 'HTTP Request → EasyPost',
    rationale: 'Drive https://api.easypost.com/v2 via HTTP Request with basic auth.',
  },
  shipstation: {
    forgeType: 'webhook',
    label: 'HTTP Request → ShipStation',
    rationale: 'Drive https://ssapi.shipstation.com via HTTP Request with basic auth.',
  },
  shipbob: {
    forgeType: 'webhook',
    label: 'HTTP Request → ShipBob',
    rationale: 'Drive https://api.shipbob.com/1.0 via HTTP Request with bearer.',
  },
  shipHero: {
    forgeType: 'webhook',
    label: 'HTTP Request → ShipHero',
    rationale: 'Drive https://public-api.shiphero.com/graphql via HTTP Request with bearer.',
  },
  upsApi: {
    forgeType: 'webhook',
    label: 'HTTP Request → UPS',
    rationale: 'Drive https://onlinetools.ups.com/api via HTTP Request with bearer.',
  },
  fedexApi: {
    forgeType: 'webhook',
    label: 'HTTP Request → FedEx',
    rationale: 'Drive https://apis.fedex.com via HTTP Request with bearer.',
  },
  dhlApi: {
    forgeType: 'webhook',
    label: 'HTTP Request → DHL Express',
    rationale: 'Drive https://api-eu.dhl.com/mydhlapi via HTTP Request with bearer.',
  },
  uspsApi: {
    forgeType: 'webhook',
    label: 'HTTP Request → USPS',
    rationale: 'Drive https://api.usps.com via HTTP Request with bearer.',
  },
  delhivery: {
    forgeType: 'webhook',
    label: 'HTTP Request → Delhivery',
    rationale: 'Drive Delhivery REST API via HTTP Request with Token bearer.',
  },
  blueDart: {
    forgeType: 'webhook',
    label: 'HTTP Request → BlueDart',
    rationale: 'Drive BlueDart REST API via HTTP Request with license-key.',
  },
  shiprocket: {
    forgeType: 'webhook',
    label: 'HTTP Request → Shiprocket',
    rationale: 'Drive https://apiv2.shiprocket.in/v1/external via HTTP Request with bearer.',
  },

  /* ── Project / PM ─────────────────────────────────────── */
  basecamp: {
    forgeType: 'webhook',
    label: 'HTTP Request → Basecamp',
    rationale: 'Drive https://3.basecampapi.com/{account_id} via HTTP Request with bearer.',
  },
  shortcut: {
    forgeType: 'webhook',
    label: 'HTTP Request → Shortcut',
    rationale: 'Drive https://api.app.shortcut.com/api/v3 via HTTP Request with Shortcut-Token.',
  },
  height: {
    forgeType: 'webhook',
    label: 'HTTP Request → Height',
    rationale: 'Drive https://api.height.app via HTTP Request with api-key.',
  },
  fibery: {
    forgeType: 'webhook',
    label: 'HTTP Request → Fibery',
    rationale: 'Drive Fibery REST API via HTTP Request with bearer.',
  },
  smartsheet: {
    forgeType: 'webhook',
    label: 'HTTP Request → Smartsheet',
    rationale: 'Drive https://api.smartsheet.com/2.0 via HTTP Request with bearer.',
  },
  wrike: {
    forgeType: 'webhook',
    label: 'HTTP Request → Wrike',
    rationale: 'Drive https://www.wrike.com/api/v4 via HTTP Request with bearer.',
  },
  teamwork: {
    forgeType: 'webhook',
    label: 'HTTP Request → Teamwork',
    rationale: 'Drive https://{installation}.teamwork.com via HTTP Request with bearer.',
  },
  freshrelease: {
    forgeType: 'webhook',
    label: 'HTTP Request → Freshrelease',
    rationale: 'Drive Freshrelease REST API via HTTP Request with bearer.',
  },
  zohoProjects: {
    forgeType: 'webhook',
    label: 'HTTP Request → Zoho Projects',
    rationale: 'Drive https://projectsapi.zoho.com/restapi via HTTP Request with bearer.',
  },
  azureDevops: {
    forgeType: 'webhook',
    label: 'HTTP Request → Azure DevOps',
    rationale: 'Drive https://dev.azure.com/{organization} via HTTP Request with basic auth (PAT).',
  },
  pivotalTracker: {
    forgeType: 'webhook',
    label: 'HTTP Request → Pivotal Tracker',
    rationale: 'Drive https://www.pivotaltracker.com/services/v5 via HTTP Request with X-TrackerToken.',
  },
  ravetree: {
    forgeType: 'webhook',
    label: 'HTTP Request → Ravetree',
    rationale: 'Drive Ravetree REST API via HTTP Request with bearer.',
  },

  /* ── Knowledge / docs ─────────────────────────────────── */
  guru: {
    forgeType: 'webhook',
    label: 'HTTP Request → Guru',
    rationale: 'Drive https://api.getguru.com/api/v1 via HTTP Request with basic auth.',
  },
  bloomfire: {
    forgeType: 'webhook',
    label: 'HTTP Request → Bloomfire',
    rationale: 'Drive Bloomfire REST API via HTTP Request with bearer.',
  },
  document360: {
    forgeType: 'webhook',
    label: 'HTTP Request → Document360',
    rationale: 'Drive https://apihub.document360.io/v2 via HTTP Request with api_token.',
  },
  helpjuice: {
    forgeType: 'webhook',
    label: 'HTTP Request → Helpjuice',
    rationale: 'Drive Helpjuice REST API via HTTP Request with bearer.',
  },
  helpDocs: {
    forgeType: 'webhook',
    label: 'HTTP Request → HelpDocs',
    rationale: 'Drive https://api.helpdocs.io/v1 via HTTP Request with bearer.',
  },
  slabExt: {
    forgeType: 'webhook',
    label: 'HTTP Request → Slab',
    rationale: 'Drive Slab GraphQL API via HTTP Request with bearer.',
  },
  outline: {
    forgeType: 'webhook',
    label: 'HTTP Request → Outline',
    rationale: 'Drive https://app.getoutline.com/api via HTTP Request with bearer.',
  },
  nuclino: {
    forgeType: 'webhook',
    label: 'HTTP Request → Nuclino',
    rationale: 'Drive https://api.nuclino.com/v0 via HTTP Request with API-Key.',
  },
  almanac: {
    forgeType: 'webhook',
    label: 'HTTP Request → Almanac',
    rationale: 'Drive Almanac REST API via HTTP Request with bearer.',
  },
  craftDocs: {
    forgeType: 'webhook',
    label: 'HTTP Request → Craft Docs',
    rationale: 'Drive Craft Docs REST API via HTTP Request with bearer.',
  },

  /* ── Observability ────────────────────────────────────── */
  honeycomb: {
    forgeType: 'webhook',
    label: 'HTTP Request → Honeycomb',
    rationale: 'Drive https://api.honeycomb.io/1 via HTTP Request with X-Honeycomb-Team.',
  },
  lightstep: {
    forgeType: 'webhook',
    label: 'HTTP Request → Lightstep',
    rationale: 'Drive Lightstep REST API via HTTP Request with bearer.',
  },
  signoz: {
    forgeType: 'webhook',
    label: 'HTTP Request → SigNoz',
    rationale: 'Drive SigNoz Cloud REST API via HTTP Request with bearer.',
  },
  prometheusExt: {
    forgeType: 'webhook',
    label: 'HTTP Request → Prometheus',
    rationale: 'Drive Prometheus HTTP API via HTTP Request (no auth by default).',
  },
  grafanaCloud: {
    forgeType: 'webhook',
    label: 'HTTP Request → Grafana Cloud',
    rationale: 'Drive Grafana Cloud REST API via HTTP Request with bearer.',
  },
  splunk: {
    forgeType: 'webhook',
    label: 'HTTP Request → Splunk HEC',
    rationale: 'Drive https://{instance}:8088/services/collector via HTTP Request with bearer.',
  },
  elasticCloud: {
    forgeType: 'webhook',
    label: 'HTTP Request → Elastic Cloud',
    rationale: 'Drive Elastic Cloud REST API via HTTP Request with bearer.',
  },
  loggly: {
    forgeType: 'webhook',
    label: 'HTTP Request → Loggly',
    rationale: 'Drive https://logs-01.loggly.com/inputs via HTTP Request with token.',
  },
  papertrail: {
    forgeType: 'webhook',
    label: 'HTTP Request → Papertrail',
    rationale: 'Drive Papertrail REST API via HTTP Request with bearer.',
  },
  bugsnag: {
    forgeType: 'webhook',
    label: 'HTTP Request → Bugsnag',
    rationale: 'Drive https://api.bugsnag.com via HTTP Request with bearer.',
  },
  appSignal: {
    forgeType: 'webhook',
    label: 'HTTP Request → AppSignal',
    rationale: 'Drive https://appsignal.com/api/v2 via HTTP Request with bearer.',
  },
  raygun: {
    forgeType: 'webhook',
    label: 'HTTP Request → Raygun',
    rationale: 'Drive https://api.raygun.com/v3 via HTTP Request with bearer.',
  },

  /* ── Finance / accounting ─────────────────────────────── */
  xero: {
    forgeType: 'webhook',
    label: 'HTTP Request → Xero',
    rationale: 'Drive https://api.xero.com/api.xro/2.0 via HTTP Request with bearer.',
  },
  sageIntacct: {
    forgeType: 'webhook',
    label: 'HTTP Request → Sage Intacct',
    rationale: 'Drive Sage Intacct REST API via HTTP Request with bearer.',
  },
  netsuite: {
    forgeType: 'webhook',
    label: 'HTTP Request → NetSuite',
    rationale: 'Drive https://{account}.suitetalk.api.netsuite.com via HTTP Request with OAuth.',
  },
  zohoBooks: {
    forgeType: 'webhook',
    label: 'HTTP Request → Zoho Books',
    rationale: 'Drive https://www.zohoapis.com/books/v3 via HTTP Request with bearer.',
  },
  bill: {
    forgeType: 'webhook',
    label: 'HTTP Request → BILL',
    rationale: 'Drive https://api.bill.com/api/v2 via HTTP Request with bearer.',
  },
  brexExt: {
    forgeType: 'webhook',
    label: 'HTTP Request → Brex',
    rationale: 'Drive https://platform.brexapis.com/v2 via HTTP Request with bearer.',
  },
  ramp: {
    forgeType: 'webhook',
    label: 'HTTP Request → Ramp',
    rationale: 'Drive https://api.ramp.com/developer/v1 via HTTP Request with bearer.',
  },
  rampDirect: {
    forgeType: 'webhook',
    label: 'HTTP Request → Ramp Direct',
    rationale: 'Drive Ramp Direct REST API via HTTP Request with bearer.',
  },
  mercury: {
    forgeType: 'webhook',
    label: 'HTTP Request → Mercury',
    rationale: 'Drive https://api.mercury.com/api/v1 via HTTP Request with bearer.',
  },
  wiseExt: {
    forgeType: 'webhook',
    label: 'HTTP Request → Wise',
    rationale: 'Drive https://api.wise.com/v1 via HTTP Request with bearer.',
  },
  plaid: {
    forgeType: 'webhook',
    label: 'HTTP Request → Plaid',
    rationale: 'Drive https://production.plaid.com via HTTP Request with client_id + secret.',
  },
  finicity: {
    forgeType: 'webhook',
    label: 'HTTP Request → Finicity',
    rationale: 'Drive https://api.finicity.com via HTTP Request with App-Token.',
  },

  /* ── CRM ──────────────────────────────────────────────── */
  hubspot: {
    forgeType: 'webhook',
    label: 'HTTP Request → HubSpot',
    rationale: 'Drive https://api.hubapi.com via HTTP Request with bearer.',
  },
  salesforce: {
    forgeType: 'webhook',
    label: 'HTTP Request → Salesforce',
    rationale: 'Drive https://{instance}.salesforce.com/services/data/v60.0 via HTTP Request with bearer.',
  },
  zohoCrm: {
    forgeType: 'webhook',
    label: 'HTTP Request → Zoho CRM',
    rationale: 'Drive https://www.zohoapis.com/crm/v6 via HTTP Request with bearer.',
  },
  sugarCrm: {
    forgeType: 'webhook',
    label: 'HTTP Request → SugarCRM',
    rationale: 'Drive https://{instance}/rest/v11 via HTTP Request with bearer.',
  },
  insightly: {
    forgeType: 'webhook',
    label: 'HTTP Request → Insightly',
    rationale: 'Drive https://api.{pod}.insightly.com/v3.1 via HTTP Request with basic auth.',
  },
  copper: {
    forgeType: 'webhook',
    label: 'HTTP Request → Copper',
    rationale: 'Drive https://api.copper.com/developer_api/v1 via HTTP Request with X-PW-AccessToken.',
  },
  capsule: {
    forgeType: 'webhook',
    label: 'HTTP Request → Capsule CRM',
    rationale: 'Drive https://api.capsulecrm.com/api/v2 via HTTP Request with bearer.',
  },
  freshsales: {
    forgeType: 'webhook',
    label: 'HTTP Request → Freshsales',
    rationale: 'Drive https://{domain}.freshsales.io/api via HTTP Request with bearer.',
  },
  outreach: {
    forgeType: 'webhook',
    label: 'HTTP Request → Outreach',
    rationale: 'Drive https://api.outreach.io/api/v2 via HTTP Request with bearer.',
  },
  salesloft: {
    forgeType: 'webhook',
    label: 'HTTP Request → Salesloft',
    rationale: 'Drive https://api.salesloft.com/v2 via HTTP Request with bearer.',
  },
  apolloIo: {
    forgeType: 'webhook',
    label: 'HTTP Request → Apollo.io',
    rationale: 'Drive https://api.apollo.io/v1 via HTTP Request with Api-Key.',
  },
  attio: {
    forgeType: 'webhook',
    label: 'HTTP Request → Attio',
    rationale: 'Drive https://api.attio.com/v2 via HTTP Request with bearer.',
  },
  folk: {
    forgeType: 'webhook',
    label: 'HTTP Request → folk',
    rationale: 'Drive folk REST API via HTTP Request with bearer.',
  },

  /* ── Social / community ───────────────────────────────── */
  buffer: {
    forgeType: 'webhook',
    label: 'HTTP Request → Buffer',
    rationale: 'Drive https://api.bufferapp.com/1 via HTTP Request with bearer.',
  },
  hootsuite: {
    forgeType: 'webhook',
    label: 'HTTP Request → Hootsuite',
    rationale: 'Drive https://platform.hootsuite.com/v1 via HTTP Request with bearer.',
  },
  sproutSocial: {
    forgeType: 'webhook',
    label: 'HTTP Request → Sprout Social',
    rationale: 'Drive https://api.sproutsocial.com/v1 via HTTP Request with bearer.',
  },
  later: {
    forgeType: 'webhook',
    label: 'HTTP Request → Later',
    rationale: 'Drive Later REST API via HTTP Request with bearer.',
  },
  loomly: {
    forgeType: 'webhook',
    label: 'HTTP Request → Loomly',
    rationale: 'Drive Loomly REST API via HTTP Request with bearer.',
  },
  circle: {
    forgeType: 'webhook',
    label: 'HTTP Request → Circle',
    rationale: 'Drive https://app.circle.so/api/v1 via HTTP Request with bearer.',
  },
  discourse: {
    forgeType: 'webhook',
    label: 'HTTP Request → Discourse',
    rationale: 'Drive https://{forum}/api via HTTP Request with Api-Key + Api-Username.',
  },
  mighty: {
    forgeType: 'webhook',
    label: 'HTTP Request → Mighty Networks',
    rationale: 'Drive Mighty Networks REST API via HTTP Request with bearer.',
  },
  beehiiv: {
    forgeType: 'webhook',
    label: 'HTTP Request → beehiiv',
    rationale: 'Drive https://api.beehiiv.com/v2 via HTTP Request with bearer.',
  },
  substack: {
    forgeType: 'webhook',
    label: 'HTTP Request → Substack',
    rationale: 'Drive Substack public REST endpoints via HTTP Request.',
  },
  convertkit: {
    forgeType: 'webhook',
    label: 'HTTP Request → ConvertKit',
    rationale: 'Drive https://api.convertkit.com/v3 via HTTP Request with api_secret.',
  },

  /* ── Misc cloud ───────────────────────────────────────── */
  hetznerCloud: {
    forgeType: 'webhook',
    label: 'HTTP Request → Hetzner Cloud',
    rationale: 'Drive https://api.hetzner.cloud/v1 via HTTP Request with bearer.',
  },
  scaleway: {
    forgeType: 'webhook',
    label: 'HTTP Request → Scaleway',
    rationale: 'Drive https://api.scaleway.com via HTTP Request with X-Auth-Token.',
  },
  ovh: {
    forgeType: 'webhook',
    label: 'HTTP Request → OVHcloud',
    rationale: 'Drive https://eu.api.ovh.com/1.0 via HTTP Request with HMAC signature.',
  },
  upcloud: {
    forgeType: 'webhook',
    label: 'HTTP Request → UpCloud',
    rationale: 'Drive https://api.upcloud.com/1.3 via HTTP Request with basic auth.',
  },
  vultr: {
    forgeType: 'webhook',
    label: 'HTTP Request → Vultr',
    rationale: 'Drive https://api.vultr.com/v2 via HTTP Request with bearer.',
  },
  oracleCloud: {
    forgeType: 'webhook',
    label: 'HTTP Request → Oracle Cloud Infrastructure',
    rationale: 'Drive OCI REST API via HTTP Request with API-signature.',
  },
  ibmCloud: {
    forgeType: 'webhook',
    label: 'HTTP Request → IBM Cloud',
    rationale: 'Drive IBM Cloud REST API via HTTP Request with bearer.',
  },
  alibabaCloud: {
    forgeType: 'webhook',
    label: 'HTTP Request → Alibaba Cloud',
    rationale: 'Drive Alibaba Cloud REST API via HTTP Request with HMAC signature.',
  },
  tencentCloud: {
    forgeType: 'webhook',
    label: 'HTTP Request → Tencent Cloud',
    rationale: 'Drive Tencent Cloud REST API via HTTP Request with HMAC signature.',
  },
  baiduCloud: {
    forgeType: 'webhook',
    label: 'HTTP Request → Baidu Cloud',
    rationale: 'Drive Baidu BCE REST API via HTTP Request with HMAC signature.',
  },

  /* ── Misc tooling ─────────────────────────────────────── */
  brightdata: {
    forgeType: 'webhook',
    label: 'HTTP Request → Bright Data',
    rationale: 'Drive Bright Data Web Scraper API via HTTP Request with bearer.',
  },
  oxylabs: {
    forgeType: 'webhook',
    label: 'HTTP Request → Oxylabs',
    rationale: 'Drive Oxylabs Web Scraper API via HTTP Request with basic auth.',
  },
  diffbot: {
    forgeType: 'webhook',
    label: 'HTTP Request → Diffbot',
    rationale: 'Drive https://api.diffbot.com/v3 via HTTP Request with token.',
  },
  firecrawlExt: {
    forgeType: 'webhook',
    label: 'HTTP Request → Firecrawl',
    rationale: 'Drive https://api.firecrawl.dev/v1 via HTTP Request with bearer.',
  },
  exa: {
    forgeType: 'webhook',
    label: 'HTTP Request → Exa',
    rationale: 'Drive https://api.exa.ai via HTTP Request with x-api-key.',
  },
  serpApi: {
    forgeType: 'webhook',
    label: 'HTTP Request → SerpApi',
    rationale: 'Drive https://serpapi.com/search via HTTP Request with api_key.',
  },
  tavily: {
    forgeType: 'webhook',
    label: 'HTTP Request → Tavily Search',
    rationale: 'Drive https://api.tavily.com via HTTP Request with bearer.',
  },
  searxng: {
    forgeType: 'webhook',
    label: 'HTTP Request → SearxNG',
    rationale: 'Drive self-hosted SearxNG search API via HTTP Request.',
  },

  /* ── Notifications / status ───────────────────────────── */
  ntfy: {
    forgeType: 'webhook',
    label: 'HTTP Request → ntfy',
    rationale: 'Drive https://ntfy.sh via HTTP Request (POST topic).',
  },
  gotify: {
    forgeType: 'webhook',
    label: 'HTTP Request → Gotify',
    rationale: 'Drive self-hosted Gotify REST API via HTTP Request with X-Gotify-Key.',
  },
  pushcut: {
    forgeType: 'webhook',
    label: 'HTTP Request → Pushcut',
    rationale: 'Drive https://api.pushcut.io/v1 via HTTP Request with api-key.',
  },
  pushover: {
    forgeType: 'webhook',
    label: 'HTTP Request → Pushover',
    rationale: 'Drive https://api.pushover.net/1 via HTTP Request with token + user.',
  },
  pushbullet: {
    forgeType: 'webhook',
    label: 'HTTP Request → Pushbullet',
    rationale: 'Drive https://api.pushbullet.com/v2 via HTTP Request with Access-Token.',
  },
  prowl: {
    forgeType: 'webhook',
    label: 'HTTP Request → Prowl',
    rationale: 'Drive https://api.prowlapp.com/publicapi via HTTP Request with apikey.',
  },
  statuspageExt: {
    forgeType: 'webhook',
    label: 'HTTP Request → Statuspage',
    rationale: 'Drive https://api.statuspage.io/v1 via HTTP Request with OAuth token.',
  },
  instatus: {
    forgeType: 'webhook',
    label: 'HTTP Request → Instatus',
    rationale: 'Drive https://api.instatus.com/v1 via HTTP Request with bearer.',
  },
  betterStack: {
    forgeType: 'webhook',
    label: 'HTTP Request → Better Stack',
    rationale: 'Drive https://uptime.betterstack.com/api/v2 via HTTP Request with bearer.',
  },
  uptimeRobot: {
    forgeType: 'webhook',
    label: 'HTTP Request → UptimeRobot',
    rationale: 'Drive https://api.uptimerobot.com/v2 via HTTP Request with api_key.',
  },

  /* ── Communication APIs ───────────────────────────────── */
  postscript: {
    forgeType: 'webhook',
    label: 'HTTP Request → Postscript',
    rationale: 'Drive https://api.postscript.io/api/v2 via HTTP Request with bearer.',
  },
  attentive: {
    forgeType: 'webhook',
    label: 'HTTP Request → Attentive',
    rationale: 'Drive https://api.attentivemobile.com/v1 via HTTP Request with bearer.',
  },
  textMagic: {
    forgeType: 'webhook',
    label: 'HTTP Request → TextMagic',
    rationale: 'Drive https://rest.textmagic.com/api/v2 via HTTP Request with basic auth.',
  },
  clickSend: {
    forgeType: 'webhook',
    label: 'HTTP Request → ClickSend',
    rationale: 'Drive https://rest.clicksend.com/v3 via HTTP Request with basic auth.',
  },
  msg91: {
    forgeType: 'webhook',
    label: 'HTTP Request → MSG91',
    rationale: 'Drive https://control.msg91.com/api/v5 via HTTP Request with authkey.',
  },
  exotel: {
    forgeType: 'webhook',
    label: 'HTTP Request → Exotel',
    rationale: 'Drive https://api.exotel.com/v1 via HTTP Request with basic auth.',
  },
  fast2sms: {
    forgeType: 'webhook',
    label: 'HTTP Request → Fast2SMS',
    rationale: 'Drive https://www.fast2sms.com/dev/bulkV2 via HTTP Request with authorization.',
  },
  textlocal: {
    forgeType: 'webhook',
    label: 'HTTP Request → Textlocal',
    rationale: 'Drive https://api.txtlocal.com/send via HTTP Request with apikey.',
  },
  knock: {
    forgeType: 'webhook',
    label: 'HTTP Request → Knock',
    rationale: 'Drive https://api.knock.app/v1 via HTTP Request with bearer.',
  },
  novu: {
    forgeType: 'webhook',
    label: 'HTTP Request → Novu',
    rationale: 'Drive https://api.novu.co/v1 via HTTP Request with ApiKey header.',
  },

  /* ── Calendaring / scheduling ─────────────────────────── */
  acuity: {
    forgeType: 'webhook',
    label: 'HTTP Request → Acuity Scheduling',
    rationale: 'Drive https://acuityscheduling.com/api/v1 via HTTP Request with basic auth.',
  },
  setmore: {
    forgeType: 'webhook',
    label: 'HTTP Request → Setmore',
    rationale: 'Drive Setmore REST API via HTTP Request with bearer.',
  },
  appointlet: {
    forgeType: 'webhook',
    label: 'HTTP Request → Appointlet',
    rationale: 'Drive Appointlet REST API via HTTP Request with bearer.',
  },
  squareAppointments: {
    forgeType: 'webhook',
    label: 'HTTP Request → Square Appointments',
    rationale: 'Drive Square Appointments REST API via HTTP Request with bearer.',
  },
  bookingCom: {
    forgeType: 'webhook',
    label: 'HTTP Request → Booking.com Partner',
    rationale: 'Drive Booking.com Partner REST API via HTTP Request with bearer.',
  },
  expedia: {
    forgeType: 'webhook',
    label: 'HTTP Request → Expedia Partner Solutions',
    rationale: 'Drive Expedia Partner REST API via HTTP Request with bearer.',
  },
  resy: {
    forgeType: 'webhook',
    label: 'HTTP Request → Resy',
    rationale: 'Drive Resy REST API via HTTP Request with bearer.',
  },
  opentable: {
    forgeType: 'webhook',
    label: 'HTTP Request → OpenTable',
    rationale: 'Drive OpenTable REST API via HTTP Request with bearer.',
  },

  /* ── Misc storage / files ─────────────────────────────── */
  pcloud: {
    forgeType: 'webhook',
    label: 'HTTP Request → pCloud',
    rationale: 'Drive https://api.pcloud.com via HTTP Request with access_token.',
  },
  syncCom: {
    forgeType: 'webhook',
    label: 'HTTP Request → Sync.com',
    rationale: 'Drive Sync.com REST API via HTTP Request with bearer.',
  },
  mega: {
    forgeType: 'webhook',
    label: 'HTTP Request → MEGA',
    rationale: 'Drive MEGA REST API via HTTP Request with session token.',
  },
  filesCom: {
    forgeType: 'webhook',
    label: 'HTTP Request → Files.com',
    rationale: 'Drive https://app.files.com/api/rest/v1 via HTTP Request with X-FilesAPI-Key.',
  },
  filestack: {
    forgeType: 'webhook',
    label: 'HTTP Request → Filestack',
    rationale: 'Drive https://www.filestackapi.com/api via HTTP Request with api_key.',
  },

  // ═══════════════════════════════════════════════════════════════
  // === Wave-B additions: comms, AI speech, files, marketing, surveys ===
  // ═══════════════════════════════════════════════════════════════

  /* ── SMS / voice / communication (Wave-B) ─────────────── */
  plivoMessages: {
    forgeType: 'webhook',
    label: 'HTTP Request → Plivo Messages',
    rationale: 'Drive https://api.plivo.com/v1/Account/{AuthID}/Message via HTTP Request with basic auth.',
  },
  plivoVoice: {
    forgeType: 'webhook',
    label: 'HTTP Request → Plivo Voice',
    rationale: 'Drive https://api.plivo.com/v1/Account/{AuthID}/Call via HTTP Request with basic auth.',
  },
  plivoLookup: {
    forgeType: 'webhook',
    label: 'HTTP Request → Plivo Lookup',
    rationale: 'Drive https://lookup.plivo.com/v1/Number via HTTP Request with basic auth.',
  },
  vonageSms: {
    forgeType: 'webhook',
    label: 'HTTP Request → Vonage SMS',
    rationale: 'Drive https://rest.nexmo.com/sms/json via HTTP Request with api_key + api_secret.',
  },
  vonageVoice: {
    forgeType: 'webhook',
    label: 'HTTP Request → Vonage Voice',
    rationale: 'Drive https://api.nexmo.com/v1/calls via HTTP Request with JWT auth.',
  },
  vonageVerify: {
    forgeType: 'webhook',
    label: 'HTTP Request → Vonage Verify',
    rationale: 'Drive https://api.nexmo.com/verify via HTTP Request with api_key + api_secret.',
  },
  vonageVideo: {
    forgeType: 'webhook',
    label: 'HTTP Request → Vonage Video (OpenTok)',
    rationale: 'Drive https://api.opentok.com/v2/project via HTTP Request with X-OPENTOK-AUTH JWT.',
  },
  messageBirdMessages: {
    forgeType: 'webhook',
    label: 'HTTP Request → MessageBird Messages',
    rationale: 'Drive https://rest.messagebird.com/messages via HTTP Request with AccessKey header.',
  },
  messageBirdConversations: {
    forgeType: 'webhook',
    label: 'HTTP Request → MessageBird Conversations',
    rationale: 'Drive https://conversations.messagebird.com/v1 via HTTP Request with AccessKey header.',
  },
  messageBirdVerify: {
    forgeType: 'webhook',
    label: 'HTTP Request → MessageBird Verify',
    rationale: 'Drive https://rest.messagebird.com/verify via HTTP Request with AccessKey header.',
  },
  bandwidthMessaging: {
    forgeType: 'webhook',
    label: 'HTTP Request → Bandwidth Messaging',
    rationale: 'Drive https://messaging.bandwidth.com/api/v2/users/{accountId}/messages via HTTP Request with basic auth.',
  },
  bandwidthVoice: {
    forgeType: 'webhook',
    label: 'HTTP Request → Bandwidth Voice',
    rationale: 'Drive https://voice.bandwidth.com/api/v2/accounts/{accountId}/calls via HTTP Request with basic auth.',
  },
  bandwidth911: {
    forgeType: 'webhook',
    label: 'HTTP Request → Bandwidth Emergency 911',
    rationale: 'Drive https://dashboard.bandwidth.com/api/accounts/{accountId}/emergencyNotificationEndpoints via HTTP Request with basic auth.',
  },
  sinchSms: {
    forgeType: 'webhook',
    label: 'HTTP Request → Sinch SMS',
    rationale: 'Drive https://sms.api.sinch.com/xms/v1/{servicePlanId}/batches via HTTP Request with bearer.',
  },
  sinchVoice: {
    forgeType: 'webhook',
    label: 'HTTP Request → Sinch Voice',
    rationale: 'Drive https://calling.api.sinch.com/calling/v1/callouts via HTTP Request with application signed auth.',
  },
  sinchVerify: {
    forgeType: 'webhook',
    label: 'HTTP Request → Sinch Verification',
    rationale: 'Drive https://verification.api.sinch.com/verification/v1/verifications via HTTP Request with basic auth.',
  },
  sinchRcs: {
    forgeType: 'webhook',
    label: 'HTTP Request → Sinch RCS',
    rationale: 'Drive https://rcs.api.sinch.com/v1/projects/{projectId}/messages via HTTP Request with bearer.',
  },
  telnyxMessaging: {
    forgeType: 'webhook',
    label: 'HTTP Request → Telnyx Messaging',
    rationale: 'Drive https://api.telnyx.com/v2/messages via HTTP Request with bearer.',
  },
  telnyxVoice: {
    forgeType: 'webhook',
    label: 'HTTP Request → Telnyx Voice',
    rationale: 'Drive https://api.telnyx.com/v2/calls via HTTP Request with bearer.',
  },
  telnyxNumbers: {
    forgeType: 'webhook',
    label: 'HTTP Request → Telnyx Numbers',
    rationale: 'Drive https://api.telnyx.com/v2/phone_numbers via HTTP Request with bearer.',
  },
  fortySixElks: {
    forgeType: 'webhook',
    label: 'HTTP Request → 46elks',
    rationale: 'Drive https://api.46elks.com/a1 via HTTP Request with basic auth.',
  },
  infobip: {
    forgeType: 'webhook',
    label: 'HTTP Request → Infobip',
    rationale: 'Drive https://api.infobip.com/sms/2/text/advanced via HTTP Request with App {apiKey} header.',
  },
  karix: {
    forgeType: 'webhook',
    label: 'HTTP Request → Karix',
    rationale: 'Drive https://api.karix.io/message via HTTP Request with basic auth.',
  },
  gupshup: {
    forgeType: 'webhook',
    label: 'HTTP Request → Gupshup',
    rationale: 'Drive https://api.gupshup.io/sm/api/v1/msg via HTTP Request with apikey header.',
  },
  kaleyra: {
    forgeType: 'webhook',
    label: 'HTTP Request → Kaleyra',
    rationale: 'Drive https://api.kaleyra.io/v1/{sid}/messages via HTTP Request with api-key header.',
  },

  /* ── Translation / Speech AI (Wave-B) ─────────────────── */
  deepLGlossary: {
    forgeType: 'webhook',
    label: 'HTTP Request → DeepL Glossaries',
    rationale: 'Drive https://api.deepl.com/v2/glossaries via HTTP Request with DeepL-Auth-Key header.',
  },
  azureTranslator: {
    forgeType: 'webhook',
    label: 'HTTP Request → Azure Translator',
    rationale: 'Drive https://api.cognitive.microsofttranslator.com/translate via HTTP Request with Ocp-Apim-Subscription-Key.',
  },
  amazonTranslate: {
    forgeType: 'webhook',
    label: 'HTTP Request → Amazon Translate',
    rationale: 'Drive AWS Translate REST API via HTTP Request with SigV4 (TranslateText action).',
  },
  assemblyAiLlms: {
    forgeType: 'webhook',
    label: 'HTTP Request → AssemblyAI LeMUR',
    rationale: 'Drive https://api.assemblyai.com/lemur/v3 via HTTP Request with Authorization (token).',
  },
  assemblyAiSentiment: {
    forgeType: 'webhook',
    label: 'HTTP Request → AssemblyAI Sentiment',
    rationale: 'Drive AssemblyAI /v2/transcript with sentiment_analysis=true via HTTP Request with token.',
  },
  deepgramTranscribe: {
    forgeType: 'webhook',
    label: 'HTTP Request → Deepgram Transcribe',
    rationale: 'Drive https://api.deepgram.com/v1/listen via HTTP Request with Token auth.',
  },
  deepgramTts: {
    forgeType: 'webhook',
    label: 'HTTP Request → Deepgram TTS',
    rationale: 'Drive https://api.deepgram.com/v1/speak via HTTP Request with Token auth.',
  },
  revAi: {
    forgeType: 'webhook',
    label: 'HTTP Request → Rev.ai',
    rationale: 'Drive https://api.rev.ai/speechtotext/v1/jobs via HTTP Request with bearer.',
  },
  whisperOpenai: {
    forgeType: 'open_ai',
    label: 'OpenAI Whisper (native)',
    rationale: 'Use the OpenAI block — audio.transcriptions endpoint runs Whisper-1.',
  },
  elevenLabsTts: {
    forgeType: 'forge_audio_elevenlabs_tts',
    label: 'ElevenLabs TTS (forge)',
    rationale: 'Text-to-speech via the ElevenLabs forge block.',
  },
  elevenLabsVoiceCloning: {
    forgeType: 'webhook',
    label: 'HTTP Request → ElevenLabs Voice Cloning',
    rationale: 'Drive https://api.elevenlabs.io/v1/voices/add via HTTP Request with xi-api-key header.',
  },
  elevenLabsDubbing: {
    forgeType: 'webhook',
    label: 'HTTP Request → ElevenLabs Dubbing',
    rationale: 'Drive https://api.elevenlabs.io/v1/dubbing via HTTP Request with xi-api-key header.',
  },
  playHt: {
    forgeType: 'webhook',
    label: 'HTTP Request → PlayHT',
    rationale: 'Drive https://api.play.ht/api/v2/tts via HTTP Request with Authorization + X-USER-ID headers.',
  },
  resembleAi: {
    forgeType: 'webhook',
    label: 'HTTP Request → Resemble.ai',
    rationale: 'Drive https://app.resemble.ai/api/v2 via HTTP Request with bearer.',
  },
  cartesia: {
    forgeType: 'webhook',
    label: 'HTTP Request → Cartesia',
    rationale: 'Drive https://api.cartesia.ai/tts/bytes via HTTP Request with X-API-Key + Cartesia-Version headers.',
  },
  coqui: {
    forgeType: 'webhook',
    label: 'HTTP Request → Coqui TTS',
    rationale: 'Drive https://app.coqui.ai/api/v2/samples via HTTP Request with bearer.',
  },

  /* ── File services (Wave-B) ───────────────────────────── */
  boxFiles: {
    forgeType: 'webhook',
    label: 'HTTP Request → Box Files',
    rationale: 'Drive https://api.box.com/2.0/files via HTTP Request with bearer.',
  },
  boxFolders: {
    forgeType: 'webhook',
    label: 'HTTP Request → Box Folders',
    rationale: 'Drive https://api.box.com/2.0/folders via HTTP Request with bearer.',
  },
  boxCollaborations: {
    forgeType: 'webhook',
    label: 'HTTP Request → Box Collaborations',
    rationale: 'Drive https://api.box.com/2.0/collaborations via HTTP Request with bearer.',
  },
  boxComments: {
    forgeType: 'webhook',
    label: 'HTTP Request → Box Comments',
    rationale: 'Drive https://api.box.com/2.0/comments via HTTP Request with bearer.',
  },
  boxMetadata: {
    forgeType: 'webhook',
    label: 'HTTP Request → Box Metadata',
    rationale: 'Drive https://api.box.com/2.0/metadata_templates via HTTP Request with bearer.',
  },
  dropboxBusiness: {
    forgeType: 'webhook',
    label: 'HTTP Request → Dropbox Business',
    rationale: 'Drive https://api.dropboxapi.com/2/team via HTTP Request with bearer (team token).',
  },
  dropboxSharedFolders: {
    forgeType: 'webhook',
    label: 'HTTP Request → Dropbox Shared Folders',
    rationale: 'Drive https://api.dropboxapi.com/2/sharing via HTTP Request with bearer.',
  },
  dropboxTeam: {
    forgeType: 'webhook',
    label: 'HTTP Request → Dropbox Team',
    rationale: 'Drive https://api.dropboxapi.com/2/team/members via HTTP Request with bearer.',
  },
  oneDriveFiles: {
    forgeType: 'webhook',
    label: 'HTTP Request → OneDrive Files',
    rationale: 'Drive https://graph.microsoft.com/v1.0/me/drive via HTTP Request with bearer.',
  },
  oneDriveSharing: {
    forgeType: 'webhook',
    label: 'HTTP Request → OneDrive Sharing',
    rationale: 'Drive https://graph.microsoft.com/v1.0/shares via HTTP Request with bearer.',
  },
  oneDriveSites: {
    forgeType: 'webhook',
    label: 'HTTP Request → OneDrive Sites',
    rationale: 'Drive https://graph.microsoft.com/v1.0/sites via HTTP Request with bearer.',
  },
  egnyte: {
    forgeType: 'webhook',
    label: 'HTTP Request → Egnyte',
    rationale: 'Drive https://{domain}.egnyte.com/pubapi/v1 via HTTP Request with bearer.',
  },
  tresorit: {
    forgeType: 'webhook',
    label: 'HTTP Request → Tresorit',
    rationale: 'Drive https://api.tresorit.com via HTTP Request with bearer.',
  },
  shareFile: {
    forgeType: 'webhook',
    label: 'HTTP Request → Citrix ShareFile',
    rationale: 'Drive https://{subdomain}.sharefile.com/sf/v3 via HTTP Request with bearer.',
  },
  bytescale: {
    forgeType: 'webhook',
    label: 'HTTP Request → Bytescale',
    rationale: 'Drive https://api.bytescale.com/v2 via HTTP Request with bearer (api-key).',
  },

  /* ── Marketing automation (Wave-B) ────────────────────── */
  marketoLeads: {
    forgeType: 'webhook',
    label: 'HTTP Request → Marketo Leads',
    rationale: 'Drive https://{munchkinId}.mktorest.com/rest/v1/leads.json via HTTP Request with bearer.',
  },
  marketoPrograms: {
    forgeType: 'webhook',
    label: 'HTTP Request → Marketo Programs',
    rationale: 'Drive https://{munchkinId}.mktorest.com/rest/asset/v1/programs via HTTP Request with bearer.',
  },
  marketoCampaigns: {
    forgeType: 'webhook',
    label: 'HTTP Request → Marketo Campaigns',
    rationale: 'Drive https://{munchkinId}.mktorest.com/rest/v1/campaigns.json via HTTP Request with bearer.',
  },
  marketoLists: {
    forgeType: 'webhook',
    label: 'HTTP Request → Marketo Lists',
    rationale: 'Drive https://{munchkinId}.mktorest.com/rest/v1/lists.json via HTTP Request with bearer.',
  },
  pardot: {
    forgeType: 'webhook',
    label: 'HTTP Request → Pardot / Account Engagement',
    rationale: 'Drive https://pi.pardot.com/api/v5 via HTTP Request with Salesforce bearer + Pardot-Business-Unit-Id.',
  },
  activeCampaignAutomations: {
    forgeType: 'webhook',
    label: 'HTTP Request → ActiveCampaign Automations',
    rationale: 'Drive https://{account}.api-us1.com/api/3/automations via HTTP Request with Api-Token header.',
  },
  activeCampaignDeals: {
    forgeType: 'webhook',
    label: 'HTTP Request → ActiveCampaign Deals',
    rationale: 'Drive https://{account}.api-us1.com/api/3/deals via HTTP Request with Api-Token header.',
  },
  drip: {
    forgeType: 'webhook',
    label: 'HTTP Request → Drip Subscribers',
    rationale: 'Drive https://api.getdrip.com/v2/{accountId}/subscribers via HTTP Request with basic auth.',
  },
  dripEvents: {
    forgeType: 'webhook',
    label: 'HTTP Request → Drip Events',
    rationale: 'Drive https://api.getdrip.com/v2/{accountId}/events via HTTP Request with basic auth.',
  },
  dripCampaigns: {
    forgeType: 'webhook',
    label: 'HTTP Request → Drip Campaigns',
    rationale: 'Drive https://api.getdrip.com/v2/{accountId}/campaigns via HTTP Request with basic auth.',
  },
  iterableUsers: {
    forgeType: 'webhook',
    label: 'HTTP Request → Iterable Users',
    rationale: 'Drive https://api.iterable.com/api/users via HTTP Request with Api-Key header.',
  },
  iterableEvents: {
    forgeType: 'webhook',
    label: 'HTTP Request → Iterable Events',
    rationale: 'Drive https://api.iterable.com/api/events/track via HTTP Request with Api-Key header.',
  },
  iterableCampaigns: {
    forgeType: 'webhook',
    label: 'HTTP Request → Iterable Campaigns',
    rationale: 'Drive https://api.iterable.com/api/campaigns via HTTP Request with Api-Key header.',
  },
  iterableTemplates: {
    forgeType: 'webhook',
    label: 'HTTP Request → Iterable Templates',
    rationale: 'Drive https://api.iterable.com/api/templates via HTTP Request with Api-Key header.',
  },
  iterableInApp: {
    forgeType: 'webhook',
    label: 'HTTP Request → Iterable In-App',
    rationale: 'Drive https://api.iterable.com/api/inApp/getMessages via HTTP Request with Api-Key header.',
  },
  brazeUsers: {
    forgeType: 'webhook',
    label: 'HTTP Request → Braze Users',
    rationale: 'Drive https://rest.iad-01.braze.com/users/track via HTTP Request with bearer.',
  },
  brazeEvents: {
    forgeType: 'webhook',
    label: 'HTTP Request → Braze Events',
    rationale: 'Drive https://rest.iad-01.braze.com/users/track (events array) via HTTP Request with bearer.',
  },
  brazeCampaigns: {
    forgeType: 'webhook',
    label: 'HTTP Request → Braze Campaigns',
    rationale: 'Drive https://rest.iad-01.braze.com/campaigns/trigger/send via HTTP Request with bearer.',
  },
  brazeCanvases: {
    forgeType: 'webhook',
    label: 'HTTP Request → Braze Canvases',
    rationale: 'Drive https://rest.iad-01.braze.com/canvas/trigger/send via HTTP Request with bearer.',
  },
  customerIoBroadcasts: {
    forgeType: 'webhook',
    label: 'HTTP Request → Customer.io Broadcasts',
    rationale: 'Drive https://api.customer.io/v1/api/campaigns/{id}/triggers via HTTP Request with bearer.',
  },
  customerIoTransactional: {
    forgeType: 'webhook',
    label: 'HTTP Request → Customer.io Transactional',
    rationale: 'Drive https://api.customer.io/v1/send/email via HTTP Request with bearer.',
  },
  brevoSmsCampaign: {
    forgeType: 'webhook',
    label: 'HTTP Request → Brevo SMS Campaigns',
    rationale: 'Drive https://api.brevo.com/v3/smsCampaigns via HTTP Request with api-key header.',
  },
  brevoAutomation: {
    forgeType: 'webhook',
    label: 'HTTP Request → Brevo Automation',
    rationale: 'Drive https://in-automate.brevo.com/api/v2/trackEvent via HTTP Request with ma-key header.',
  },
  clickFunnels: {
    forgeType: 'webhook',
    label: 'HTTP Request → ClickFunnels',
    rationale: 'Drive https://{workspace}.myclickfunnels.com/api/v2 via HTTP Request with bearer.',
  },
  getResponse: {
    forgeType: 'webhook',
    label: 'HTTP Request → GetResponse',
    rationale: 'Drive https://api.getresponse.com/v3 via HTTP Request with X-Auth-Token: api-key.',
  },
  aWeber: {
    forgeType: 'webhook',
    label: 'HTTP Request → AWeber',
    rationale: 'Drive https://api.aweber.com/1.0 via HTTP Request with OAuth2 bearer.',
  },
  constantContact: {
    forgeType: 'webhook',
    label: 'HTTP Request → Constant Contact',
    rationale: 'Drive https://api.cc.email/v3 via HTTP Request with OAuth2 bearer.',
  },
  sailthru: {
    forgeType: 'webhook',
    label: 'HTTP Request → Sailthru',
    rationale: 'Drive https://api.sailthru.com via HTTP Request with HMAC api_key + sig signature.',
  },
  cordial: {
    forgeType: 'webhook',
    label: 'HTTP Request → Cordial',
    rationale: 'Drive https://api.cordial.io/v2 via HTTP Request with basic auth.',
  },
  listrak: {
    forgeType: 'webhook',
    label: 'HTTP Request → Listrak',
    rationale: 'Drive https://api.listrak.com/email/v1 via HTTP Request with OAuth2 bearer.',
  },

  /* ── Surveys & feedback (Wave-B) ──────────────────────── */
  surveyJsCloud: {
    forgeType: 'webhook',
    label: 'HTTP Request → SurveyJS Cloud',
    rationale: 'Drive https://api.surveyjs.io/private/Surveys via HTTP Request with bearer.',
  },
  askNicely: {
    forgeType: 'webhook',
    label: 'HTTP Request → AskNicely',
    rationale: 'Drive https://{account}.asknice.ly/api/v1 via HTTP Request with X-apikey header.',
  },
  wootric: {
    forgeType: 'webhook',
    label: 'HTTP Request → Wootric (InMoment)',
    rationale: 'Drive https://api.wootric.com/v1 via HTTP Request with OAuth2 bearer.',
  },
  featurebase: {
    forgeType: 'webhook',
    label: 'HTTP Request → Featurebase',
    rationale: 'Drive https://do.featurebase.app/v2 via HTTP Request with X-API-Key header.',
  },
  productBoard: {
    forgeType: 'webhook',
    label: 'HTTP Request → Productboard',
    rationale: 'Drive https://api.productboard.com via HTTP Request with bearer + X-Version header.',
  },
  featureflagIo: {
    forgeType: 'webhook',
    label: 'HTTP Request → Featureflag.io',
    rationale: 'Drive https://api.featureflag.io/v1 via HTTP Request with bearer.',
  },
  sprig: {
    forgeType: 'webhook',
    label: 'HTTP Request → Sprig',
    rationale: 'Drive https://api.sprig.com/v2 via HTTP Request with API-Key header.',
  },
  cycleApp: {
    forgeType: 'webhook',
    label: 'HTTP Request → Cycle',
    rationale: 'Drive https://api.product.cycle.app/graphql via HTTP Request with bearer.',
  },
  pendoFeedback: {
    forgeType: 'webhook',
    label: 'HTTP Request → Pendo Feedback',
    rationale: 'Drive https://app.pendo.io/api/v1/feedback via HTTP Request with x-pendo-integration-key header.',
  },
  userpilot: {
    forgeType: 'webhook',
    label: 'HTTP Request → Userpilot',
    rationale: 'Drive https://analytex.userpilot.io/v1 via HTTP Request with X-API-KEY header.',
  },
  chameleon: {
    forgeType: 'webhook',
    label: 'HTTP Request → Chameleon',
    rationale: 'Drive https://api.trychameleon.com/v3 via HTTP Request with X-Account-Secret header.',
  },

  /* ── Translation localization platforms (Wave-B) ──────── */
  phraseLocalize: {
    forgeType: 'webhook',
    label: 'HTTP Request → Phrase Localize',
    rationale: 'Drive https://api.phrase.com/v2 via HTTP Request with Authorization: token <api-token>.',
  },
  memsource: {
    forgeType: 'webhook',
    label: 'HTTP Request → Memsource (Phrase TMS)',
    rationale: 'Drive https://cloud.memsource.com/web/api2/v1 via HTTP Request with bearer.',
  },

  // ═══════════════════════════════════════════════════════════════
  // === Wave-A additions: identity, devops, fintech, pm, time ===
  // ═══════════════════════════════════════════════════════════════

  /* ── Identity & SSO (Wave-A) ──────────────────────────── */
  okta: {
    forgeType: 'webhook',
    label: 'HTTP Request → Okta',
    rationale: 'Drive https://{domain}.okta.com/api/v1 via HTTP Request with SSWS token.',
  },
  oktaUsers: {
    forgeType: 'webhook',
    label: 'HTTP Request → Okta Users',
    rationale: 'Drive https://{domain}.okta.com/api/v1/users via HTTP Request with SSWS token.',
  },
  oktaGroups: {
    forgeType: 'webhook',
    label: 'HTTP Request → Okta Groups',
    rationale: 'Drive https://{domain}.okta.com/api/v1/groups via HTTP Request with SSWS token.',
  },
  oktaApps: {
    forgeType: 'webhook',
    label: 'HTTP Request → Okta Apps',
    rationale: 'Drive https://{domain}.okta.com/api/v1/apps via HTTP Request with SSWS token.',
  },
  oktaFactors: {
    forgeType: 'webhook',
    label: 'HTTP Request → Okta Factors',
    rationale: 'Drive https://{domain}.okta.com/api/v1/users/{id}/factors via HTTP Request with SSWS token.',
  },
  auth0: {
    forgeType: 'webhook',
    label: 'HTTP Request → Auth0',
    rationale: 'Drive https://{tenant}.auth0.com/api/v2 via HTTP Request with Management API bearer.',
  },
  auth0Users: {
    forgeType: 'webhook',
    label: 'HTTP Request → Auth0 Users',
    rationale: 'Drive https://{tenant}.auth0.com/api/v2/users via HTTP Request with bearer.',
  },
  auth0Organizations: {
    forgeType: 'webhook',
    label: 'HTTP Request → Auth0 Organizations',
    rationale: 'Drive https://{tenant}.auth0.com/api/v2/organizations via HTTP Request with bearer.',
  },
  auth0Roles: {
    forgeType: 'webhook',
    label: 'HTTP Request → Auth0 Roles',
    rationale: 'Drive https://{tenant}.auth0.com/api/v2/roles via HTTP Request with bearer.',
  },
  auth0Rules: {
    forgeType: 'webhook',
    label: 'HTTP Request → Auth0 Rules',
    rationale: 'Drive https://{tenant}.auth0.com/api/v2/rules via HTTP Request with bearer.',
  },
  oneLogin: {
    forgeType: 'webhook',
    label: 'HTTP Request → OneLogin',
    rationale: 'Drive https://api.{region}.onelogin.com/api via HTTP Request with bearer.',
  },
  jumpCloud: {
    forgeType: 'webhook',
    label: 'HTTP Request → JumpCloud',
    rationale: 'Drive https://console.jumpcloud.com/api via HTTP Request with x-api-key header.',
  },
  pingIdentity: {
    forgeType: 'webhook',
    label: 'HTTP Request → Ping Identity',
    rationale: 'Drive https://api.pingone.com/v1 via HTTP Request with bearer.',
  },
  fusionAuth: {
    forgeType: 'webhook',
    label: 'HTTP Request → FusionAuth',
    rationale: 'Drive https://{host}/api via HTTP Request with Authorization API key header.',
  },
  stytch: {
    forgeType: 'webhook',
    label: 'HTTP Request → Stytch',
    rationale: 'Drive https://api.stytch.com/v1 via HTTP Request with basic auth (project_id:secret).',
  },
  workOs: {
    forgeType: 'webhook',
    label: 'HTTP Request → WorkOS',
    rationale: 'Drive https://api.workos.com via HTTP Request with bearer.',
  },
  awsCognito: {
    forgeType: 'webhook',
    label: 'HTTP Request → AWS Cognito',
    rationale: 'Drive https://cognito-idp.{region}.amazonaws.com via HTTP Request with SigV4 / bearer.',
  },

  /* ── DevOps & Observability (Wave-A) ──────────────────── */
  sentry: {
    forgeType: 'webhook',
    label: 'HTTP Request → Sentry',
    rationale: 'Drive https://sentry.io/api/0 via HTTP Request with bearer.',
  },
  sentryEvents: {
    forgeType: 'webhook',
    label: 'HTTP Request → Sentry Events',
    rationale: 'Drive https://sentry.io/api/0/projects/{org}/{project}/events via HTTP Request with bearer.',
  },
  sentryReleases: {
    forgeType: 'webhook',
    label: 'HTTP Request → Sentry Releases',
    rationale: 'Drive https://sentry.io/api/0/organizations/{org}/releases via HTTP Request with bearer.',
  },
  sentryProjects: {
    forgeType: 'webhook',
    label: 'HTTP Request → Sentry Projects',
    rationale: 'Drive https://sentry.io/api/0/projects via HTTP Request with bearer.',
  },
  sentryIssues: {
    forgeType: 'webhook',
    label: 'HTTP Request → Sentry Issues',
    rationale: 'Drive https://sentry.io/api/0/organizations/{org}/issues via HTTP Request with bearer.',
  },
  datadog: {
    forgeType: 'webhook',
    label: 'HTTP Request → Datadog',
    rationale: 'Drive https://api.datadoghq.com/api/v1 via HTTP Request with DD-API-KEY + DD-APPLICATION-KEY.',
  },
  datadogLogs: {
    forgeType: 'webhook',
    label: 'HTTP Request → Datadog Logs',
    rationale: 'POST https://http-intake.logs.datadoghq.com/api/v2/logs via HTTP Request with DD-API-KEY.',
  },
  datadogMetrics: {
    forgeType: 'webhook',
    label: 'HTTP Request → Datadog Metrics',
    rationale: 'POST https://api.datadoghq.com/api/v2/series via HTTP Request with DD-API-KEY.',
  },
  datadogTraces: {
    forgeType: 'webhook',
    label: 'HTTP Request → Datadog Traces',
    rationale: 'POST https://trace.agent.datadoghq.com/v0.4/traces via HTTP Request with DD-API-KEY.',
  },
  datadogMonitors: {
    forgeType: 'webhook',
    label: 'HTTP Request → Datadog Monitors',
    rationale: 'Drive https://api.datadoghq.com/api/v1/monitor via HTTP Request with API + APP keys.',
  },
  datadogDashboards: {
    forgeType: 'webhook',
    label: 'HTTP Request → Datadog Dashboards',
    rationale: 'Drive https://api.datadoghq.com/api/v1/dashboard via HTTP Request with API + APP keys.',
  },
  datadogSlos: {
    forgeType: 'webhook',
    label: 'HTTP Request → Datadog SLOs',
    rationale: 'Drive https://api.datadoghq.com/api/v1/slo via HTTP Request with API + APP keys.',
  },
  newRelic: {
    forgeType: 'webhook',
    label: 'HTTP Request → New Relic',
    rationale: 'Drive https://api.newrelic.com/v2 via HTTP Request with Api-Key header.',
  },
  newRelicEvents: {
    forgeType: 'webhook',
    label: 'HTTP Request → New Relic Events',
    rationale: 'POST https://insights-collector.newrelic.com/v1/accounts/{id}/events via HTTP Request with X-Insert-Key.',
  },
  newRelicMetrics: {
    forgeType: 'webhook',
    label: 'HTTP Request → New Relic Metrics',
    rationale: 'POST https://metric-api.newrelic.com/metric/v1 via HTTP Request with Api-Key.',
  },
  newRelicAlerts: {
    forgeType: 'webhook',
    label: 'HTTP Request → New Relic Alerts',
    rationale: 'Drive https://api.newrelic.com/v2/alerts_policies.json via HTTP Request with Api-Key.',
  },
  honeycombExt: {
    forgeType: 'webhook',
    label: 'HTTP Request → Honeycomb (extended)',
    rationale: 'Drive https://api.honeycomb.io/1 via HTTP Request with X-Honeycomb-Team header.',
  },
  betterStackLogs: {
    forgeType: 'webhook',
    label: 'HTTP Request → BetterStack Logs (Logtail)',
    rationale: 'POST https://in.logs.betterstack.com via HTTP Request with bearer source token.',
  },
  betterStackUptime: {
    forgeType: 'webhook',
    label: 'HTTP Request → BetterStack Uptime',
    rationale: 'Drive https://uptime.betterstack.com/api/v2 via HTTP Request with bearer.',
  },
  bugsnagExt: {
    forgeType: 'webhook',
    label: 'HTTP Request → Bugsnag (extended)',
    rationale: 'Drive https://api.bugsnag.com via HTTP Request with bearer.',
  },
  rollbar: {
    forgeType: 'webhook',
    label: 'HTTP Request → Rollbar',
    rationale: 'POST https://api.rollbar.com/api/1 via HTTP Request with X-Rollbar-Access-Token header.',
  },
  raygunExt: {
    forgeType: 'webhook',
    label: 'HTTP Request → Raygun (extended)',
    rationale: 'Drive https://api.raygun.com/v3 via HTTP Request with bearer.',
  },
  appSignalExt: {
    forgeType: 'webhook',
    label: 'HTTP Request → AppSignal (extended)',
    rationale: 'Drive https://appsignal.com/api/v2 via HTTP Request with bearer.',
  },
  statsig: {
    forgeType: 'webhook',
    label: 'HTTP Request → Statsig',
    rationale: 'Drive https://statsigapi.net/console/v1 via HTTP Request with STATSIG-API-KEY header.',
  },
  launchDarkly: {
    forgeType: 'webhook',
    label: 'HTTP Request → LaunchDarkly',
    rationale: 'Drive https://app.launchdarkly.com/api/v2 via HTTP Request with Authorization API key.',
  },
  splitIo: {
    forgeType: 'webhook',
    label: 'HTTP Request → Split.io',
    rationale: 'Drive https://api.split.io/internal/api/v2 via HTTP Request with bearer.',
  },
  unleash: {
    forgeType: 'webhook',
    label: 'HTTP Request → Unleash',
    rationale: 'Drive https://{host}/api/admin via HTTP Request with Authorization API token.',
  },
  pagerduty: {
    forgeType: 'webhook',
    label: 'HTTP Request → PagerDuty',
    rationale: 'Drive https://api.pagerduty.com via HTTP Request with Token token=... header.',
  },
  pagerdutyIncidents: {
    forgeType: 'webhook',
    label: 'HTTP Request → PagerDuty Incidents',
    rationale: 'Drive https://api.pagerduty.com/incidents via HTTP Request with Token token=... header.',
  },
  pagerdutyServices: {
    forgeType: 'webhook',
    label: 'HTTP Request → PagerDuty Services',
    rationale: 'Drive https://api.pagerduty.com/services via HTTP Request with Token token=... header.',
  },
  pagerdutySchedules: {
    forgeType: 'webhook',
    label: 'HTTP Request → PagerDuty Schedules',
    rationale: 'Drive https://api.pagerduty.com/schedules via HTTP Request with Token token=... header.',
  },
  pagerdutyEscalations: {
    forgeType: 'webhook',
    label: 'HTTP Request → PagerDuty Escalation Policies',
    rationale: 'Drive https://api.pagerduty.com/escalation_policies via HTTP Request with Token token=... header.',
  },
  opsgenie: {
    forgeType: 'webhook',
    label: 'HTTP Request → Opsgenie',
    rationale: 'Drive https://api.opsgenie.com/v2 via HTTP Request with GenieKey API key header.',
  },
  squadcast: {
    forgeType: 'webhook',
    label: 'HTTP Request → Squadcast',
    rationale: 'Drive https://api.squadcast.com/v3 via HTTP Request with bearer.',
  },
  grafanaAnnotations: {
    forgeType: 'webhook',
    label: 'HTTP Request → Grafana Annotations',
    rationale: 'POST https://{host}/api/annotations via HTTP Request with bearer.',
  },
  grafanaAlerts: {
    forgeType: 'webhook',
    label: 'HTTP Request → Grafana Alerts',
    rationale: 'Drive https://{host}/api/v1/provisioning/alert-rules via HTTP Request with bearer.',
  },
  prometheusPushgateway: {
    forgeType: 'webhook',
    label: 'HTTP Request → Prometheus Pushgateway',
    rationale: 'POST https://{host}/metrics/job/{name} via HTTP Request with text-plain body (no auth by default).',
  },

  /* ── Banking & Fintech (Wave-A) ───────────────────────── */
  plaidTransactions: {
    forgeType: 'webhook',
    label: 'HTTP Request → Plaid Transactions',
    rationale: 'POST https://production.plaid.com/transactions/get via HTTP Request with client_id + secret.',
  },
  plaidAccounts: {
    forgeType: 'webhook',
    label: 'HTTP Request → Plaid Accounts',
    rationale: 'POST https://production.plaid.com/accounts/get via HTTP Request with client_id + secret.',
  },
  plaidIdentity: {
    forgeType: 'webhook',
    label: 'HTTP Request → Plaid Identity',
    rationale: 'POST https://production.plaid.com/identity/get via HTTP Request with client_id + secret.',
  },
  plaidIncome: {
    forgeType: 'webhook',
    label: 'HTTP Request → Plaid Income',
    rationale: 'POST https://production.plaid.com/credit/payroll_income/get via HTTP Request with client_id + secret.',
  },
  plaidLiabilities: {
    forgeType: 'webhook',
    label: 'HTTP Request → Plaid Liabilities',
    rationale: 'POST https://production.plaid.com/liabilities/get via HTTP Request with client_id + secret.',
  },
  stripeIssuing: {
    forgeType: 'webhook',
    label: 'HTTP Request → Stripe Issuing',
    rationale: 'Drive https://api.stripe.com/v1/issuing via HTTP Request with secret key.',
  },
  wise: {
    forgeType: 'webhook',
    label: 'HTTP Request → Wise',
    rationale: 'Drive https://api.wise.com/v1 via HTTP Request with bearer.',
  },
  brex: {
    forgeType: 'webhook',
    label: 'HTTP Request → Brex',
    rationale: 'Drive https://platform.brexapis.com/v2 via HTTP Request with bearer.',
  },
  rampExt: {
    forgeType: 'webhook',
    label: 'HTTP Request → Ramp (extended)',
    rationale: 'Drive https://api.ramp.com/developer/v1 via HTTP Request with bearer.',
  },
  mercuryExt: {
    forgeType: 'webhook',
    label: 'HTTP Request → Mercury (extended)',
    rationale: 'Drive https://api.mercury.com/api/v1 via HTTP Request with bearer.',
  },
  modernTreasury: {
    forgeType: 'webhook',
    label: 'HTTP Request → Modern Treasury',
    rationale: 'Drive https://app.moderntreasury.com/api via HTTP Request with basic auth (org_id:api_key).',
  },
  increase: {
    forgeType: 'webhook',
    label: 'HTTP Request → Increase',
    rationale: 'Drive https://api.increase.com via HTTP Request with bearer.',
  },
  unitFinance: {
    forgeType: 'webhook',
    label: 'HTTP Request → Unit',
    rationale: 'Drive https://api.s.unit.sh via HTTP Request with bearer.',
  },
  treasuryPrime: {
    forgeType: 'webhook',
    label: 'HTTP Request → Treasury Prime',
    rationale: 'Drive https://api.treasuryprime.com via HTTP Request with basic auth (api_id:api_key).',
  },
  method: {
    forgeType: 'webhook',
    label: 'HTTP Request → Method Financial',
    rationale: 'Drive https://production.methodfi.com via HTTP Request with bearer.',
  },
  lithic: {
    forgeType: 'webhook',
    label: 'HTTP Request → Lithic',
    rationale: 'Drive https://api.lithic.com/v1 via HTTP Request with Authorization api-key header.',
  },
  marqeta: {
    forgeType: 'webhook',
    label: 'HTTP Request → Marqeta',
    rationale: 'Drive https://sandbox-api.marqeta.com/v3 via HTTP Request with basic auth (app_token:access_token).',
  },
  bond: {
    forgeType: 'webhook',
    label: 'HTTP Request → Bond Financial',
    rationale: 'Drive https://api.bond.tech/api/v0.1 via HTTP Request with Identity + Authorization headers.',
  },

  /* ── Project management sub-actions (Wave-A) ──────────── */
  jiraIssues: {
    forgeType: 'webhook',
    label: 'HTTP Request → Jira Issues',
    rationale: 'Drive https://{site}.atlassian.net/rest/api/3/issue via HTTP Request with basic auth (email:api_token).',
  },
  jiraProjects: {
    forgeType: 'webhook',
    label: 'HTTP Request → Jira Projects',
    rationale: 'Drive https://{site}.atlassian.net/rest/api/3/project via HTTP Request with basic auth.',
  },
  jiraSprints: {
    forgeType: 'webhook',
    label: 'HTTP Request → Jira Sprints',
    rationale: 'Drive https://{site}.atlassian.net/rest/agile/1.0/sprint via HTTP Request with basic auth.',
  },
  jiraBoards: {
    forgeType: 'webhook',
    label: 'HTTP Request → Jira Boards',
    rationale: 'Drive https://{site}.atlassian.net/rest/agile/1.0/board via HTTP Request with basic auth.',
  },
  jiraComponents: {
    forgeType: 'webhook',
    label: 'HTTP Request → Jira Components',
    rationale: 'Drive https://{site}.atlassian.net/rest/api/3/component via HTTP Request with basic auth.',
  },
  jiraVersions: {
    forgeType: 'webhook',
    label: 'HTTP Request → Jira Versions',
    rationale: 'Drive https://{site}.atlassian.net/rest/api/3/version via HTTP Request with basic auth.',
  },
  jiraWorklogs: {
    forgeType: 'webhook',
    label: 'HTTP Request → Jira Worklogs',
    rationale: 'Drive https://{site}.atlassian.net/rest/api/3/issue/{id}/worklog via HTTP Request with basic auth.',
  },
  asanaTeams: {
    forgeType: 'webhook',
    label: 'HTTP Request → Asana Teams',
    rationale: 'Drive https://app.asana.com/api/1.0/teams via HTTP Request with bearer.',
  },
  asanaCustomFields: {
    forgeType: 'webhook',
    label: 'HTTP Request → Asana Custom Fields',
    rationale: 'Drive https://app.asana.com/api/1.0/custom_fields via HTTP Request with bearer.',
  },
  asanaSections: {
    forgeType: 'webhook',
    label: 'HTTP Request → Asana Sections',
    rationale: 'Drive https://app.asana.com/api/1.0/sections via HTTP Request with bearer.',
  },
  mondayItems: {
    forgeType: 'webhook',
    label: 'HTTP Request → Monday.com Items',
    rationale: 'POST https://api.monday.com/v2 (GraphQL items query/mutation) via HTTP Request with api-token header.',
  },
  mondayColumns: {
    forgeType: 'webhook',
    label: 'HTTP Request → Monday.com Columns',
    rationale: 'POST https://api.monday.com/v2 (GraphQL columns query) via HTTP Request with api-token header.',
  },
  mondayUpdates: {
    forgeType: 'webhook',
    label: 'HTTP Request → Monday.com Updates',
    rationale: 'POST https://api.monday.com/v2 (GraphQL updates mutation) via HTTP Request with api-token header.',
  },
  clickupLists: {
    forgeType: 'webhook',
    label: 'HTTP Request → ClickUp Lists',
    rationale: 'Drive https://api.clickup.com/api/v2/folder/{id}/list via HTTP Request with Authorization token.',
  },
  clickupFolders: {
    forgeType: 'webhook',
    label: 'HTTP Request → ClickUp Folders',
    rationale: 'Drive https://api.clickup.com/api/v2/space/{id}/folder via HTTP Request with Authorization token.',
  },
  clickupSpaces: {
    forgeType: 'webhook',
    label: 'HTTP Request → ClickUp Spaces',
    rationale: 'Drive https://api.clickup.com/api/v2/team/{id}/space via HTTP Request with Authorization token.',
  },
  clickupComments: {
    forgeType: 'webhook',
    label: 'HTTP Request → ClickUp Comments',
    rationale: 'Drive https://api.clickup.com/api/v2/task/{id}/comment via HTTP Request with Authorization token.',
  },
  notionRelations: {
    forgeType: 'forge_notion',
    label: 'Notion Relations (forge)',
    rationale: 'Use the forge Notion block to manage relation-type properties between databases.',
  },
  notionProperties: {
    forgeType: 'forge_notion',
    label: 'Notion Properties (forge)',
    rationale: 'Use the forge Notion block to read/update page properties via the database schema.',
  },
  trelloCards: {
    forgeType: 'webhook',
    label: 'HTTP Request → Trello Cards',
    rationale: 'Drive https://api.trello.com/1/cards via HTTP Request with key + token query params.',
  },
  trelloLists: {
    forgeType: 'webhook',
    label: 'HTTP Request → Trello Lists',
    rationale: 'Drive https://api.trello.com/1/lists via HTTP Request with key + token query params.',
  },
  trelloBoards: {
    forgeType: 'webhook',
    label: 'HTTP Request → Trello Boards',
    rationale: 'Drive https://api.trello.com/1/boards via HTTP Request with key + token query params.',
  },
  trelloLabels: {
    forgeType: 'webhook',
    label: 'HTTP Request → Trello Labels',
    rationale: 'Drive https://api.trello.com/1/labels via HTTP Request with key + token query params.',
  },
  trelloChecklists: {
    forgeType: 'webhook',
    label: 'HTTP Request → Trello Checklists',
    rationale: 'Drive https://api.trello.com/1/checklists via HTTP Request with key + token query params.',
  },

  /* ── Time tracking & productivity (Wave-A) ────────────── */
  toggl: {
    forgeType: 'webhook',
    label: 'HTTP Request → Toggl',
    rationale: 'Drive https://api.track.toggl.com/api/v9 via HTTP Request with basic auth (api_token:api_token).',
  },
  togglTrack: {
    forgeType: 'webhook',
    label: 'HTTP Request → Toggl Track',
    rationale: 'Drive https://api.track.toggl.com/api/v9/me/time_entries via HTTP Request with basic auth.',
  },
  harvest: {
    forgeType: 'webhook',
    label: 'HTTP Request → Harvest',
    rationale: 'Drive https://api.harvestapp.com/v2 via HTTP Request with bearer + Harvest-Account-Id header.',
  },
  clockify: {
    forgeType: 'webhook',
    label: 'HTTP Request → Clockify',
    rationale: 'Drive https://api.clockify.me/api/v1 via HTTP Request with X-Api-Key header.',
  },
  rescueTime: {
    forgeType: 'webhook',
    label: 'HTTP Request → RescueTime',
    rationale: 'Drive https://www.rescuetime.com/anapi via HTTP Request with key query param.',
  },
  timely: {
    forgeType: 'webhook',
    label: 'HTTP Request → Timely',
    rationale: 'Drive https://api.timelyapp.com/1.1 via HTTP Request with bearer.',
  },
  everhour: {
    forgeType: 'webhook',
    label: 'HTTP Request → Everhour',
    rationale: 'Drive https://api.everhour.com via HTTP Request with X-Api-Key header.',
  },
  hubstaff: {
    forgeType: 'webhook',
    label: 'HTTP Request → Hubstaff',
    rationale: 'Drive https://api.hubstaff.com/v2 via HTTP Request with bearer.',
  },
  workflowMax: {
    forgeType: 'webhook',
    label: 'HTTP Request → WorkflowMax',
    rationale: 'Drive https://api.workflowmax2.com via HTTP Request with bearer + Account-Id header.',
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
