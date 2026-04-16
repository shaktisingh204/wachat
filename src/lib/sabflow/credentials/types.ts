/**
 * SabFlow — Credential type definitions
 *
 * Each credential is a user-owned record scoped to a "workspace" (mapped to
 * `userId` in the current SabFlow auth model). Credentials are referenced by
 * `id` from block settings so that sensitive data is never embedded inside a
 * flow document.
 */

/* ── Supported credential providers ─────────────────────────────────────── */

export type CredentialType =
  | 'openai'
  | 'anthropic'
  | 'google_sheets'
  | 'google_analytics'
  | 'smtp'
  | 'stripe'
  | 'whatsapp'
  | 'chatwoot'
  | 'cal_com'
  | 'elevenlabs'
  | 'mistral'
  | 'together_ai'
  | 'zapier'
  | 'make_com'
  | 'pabbly_connect'
  | 'nocodb'
  | 'custom';

/** Ordered list of all supported credential providers. */
export const CREDENTIAL_TYPES: CredentialType[] = [
  'openai',
  'anthropic',
  'mistral',
  'together_ai',
  'elevenlabs',
  'google_sheets',
  'google_analytics',
  'smtp',
  'stripe',
  'whatsapp',
  'chatwoot',
  'cal_com',
  'zapier',
  'make_com',
  'pabbly_connect',
  'nocodb',
  'custom',
];

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
  google_sheets: 'Google Sheets',
  google_analytics: 'Google Analytics',
  smtp: 'SMTP',
  stripe: 'Stripe',
  whatsapp: 'WhatsApp',
  chatwoot: 'Chatwoot',
  cal_com: 'Cal.com',
  elevenlabs: 'ElevenLabs',
  mistral: 'Mistral AI',
  together_ai: 'Together AI',
  zapier: 'Zapier',
  make_com: 'Make.com',
  pabbly_connect: 'Pabbly Connect',
  nocodb: 'NocoDB',
  custom: 'Custom',
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
  openai: [
    { key: 'apiKey', label: 'API key', kind: 'password', placeholder: 'sk-…', required: true },
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
  google_sheets: [
    { key: 'clientId', label: 'Client ID', kind: 'text', required: true },
    { key: 'clientSecret', label: 'Client secret', kind: 'password', required: true },
    { key: 'refreshToken', label: 'Refresh token', kind: 'password', required: true },
  ],
  google_analytics: [
    { key: 'clientId', label: 'Client ID', kind: 'text', required: true },
    { key: 'clientSecret', label: 'Client secret', kind: 'password', required: true },
    { key: 'refreshToken', label: 'Refresh token', kind: 'password', required: true },
  ],
  smtp: [
    { key: 'host', label: 'Host', kind: 'text', placeholder: 'smtp.example.com', required: true },
    { key: 'port', label: 'Port', kind: 'number', placeholder: '587', required: true },
    { key: 'username', label: 'Username', kind: 'text', required: true },
    { key: 'password', label: 'Password', kind: 'password', required: true },
    { key: 'useTls', label: 'Use TLS', kind: 'boolean' },
  ],
  stripe: [
    { key: 'publicKey', label: 'Publishable key', kind: 'text', placeholder: 'pk_…', required: true },
    { key: 'secretKey', label: 'Secret key', kind: 'password', placeholder: 'sk_…', required: true },
    { key: 'webhookSecret', label: 'Webhook secret', kind: 'password', placeholder: 'whsec_…' },
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
  cal_com: [
    { key: 'apiKey', label: 'API key', kind: 'password', required: true },
  ],
  zapier: [
    { key: 'webhookUrl', label: 'Webhook URL', kind: 'url', required: true },
  ],
  make_com: [
    { key: 'webhookUrl', label: 'Webhook URL', kind: 'url', required: true },
  ],
  pabbly_connect: [
    { key: 'webhookUrl', label: 'Webhook URL', kind: 'url', required: true },
  ],
  nocodb: [
    { key: 'apiUrl', label: 'API URL', kind: 'url', placeholder: 'https://app.nocodb.com/api/v1', required: true },
    { key: 'apiToken', label: 'API token', kind: 'password', required: true },
  ],
};

/** The value stored in every masked `data` field. */
export const MASK_PLACEHOLDER = '••••••••';
