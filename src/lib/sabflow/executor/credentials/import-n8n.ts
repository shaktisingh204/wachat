/**
 * SabFlow — n8n credentials bulk import.
 *
 * Accepts an n8n `credentials.json` export and re-encrypts each row under the
 * SabFlow KEK before persisting via the SabFlow credentials repository.
 *
 * n8n's exporter writes one of two shapes for the per-row `data` field:
 *
 *   1. **Encrypted** (default in n8n production):
 *      `data: "<aes-256-cbc-base64-string>"` — encrypted with a pre-shared
 *      AES key, with the IV prepended (n8n uses node-forge's `cipher` in CBC
 *      mode and historically writes `iv:ciphertext` hex/base64 strings).
 *
 *   2. **Plaintext** (when an admin chose `--decrypted` on `n8n export`):
 *      `data: { username: "...", password: "..." }` — already a key/value map.
 *
 * Both shapes are accepted. When `encryptionKey` is omitted we only honour the
 * plaintext shape so that an admin cannot accidentally insert garbage.
 *
 * **Sibling responsibilities (forward-declared):**
 *   - The SabFlow credentials repository (sub-task #1) exposes
 *     `createCredentialDirect({ workspaceId, requesterId, type, name, encryptedData })`.
 *   - The SabFlow KEK module (sub-task #2) exposes `encryptDataKek(plain: string)`.
 *
 * To stay decoupled we resolve both at runtime via dynamic `import()` against
 * conventional paths under `./repo` and `./kek` (or `../crypto/kek`). Callers
 * may inject overrides via the `_repo` / `_crypto` test seams.
 */

import 'server-only';

import type { CredentialType } from '@/lib/sabflow/credentials/types';

/* ── n8n shapes ─────────────────────────────────────────────────────────── */

/** Single entry in an n8n `credentials.json` export. */
export interface N8nCredentialExport {
  id?: string;
  name: string;
  type: string;
  /** Either an encrypted string (n8n CBC) or a decrypted key/value map. */
  data: string | Record<string, string | number | boolean | null>;
  nodesAccess?: Array<{ nodeType: string; date?: string }>;
  createdAt?: string;
  updatedAt?: string;
}

/* ── n8n type → SabFlow type mapping ────────────────────────────────────── */

/**
 * Known mappings from n8n credential `type` strings → SabFlow `CredentialType`.
 *
 * Exported so the admin import UI can render a compatibility matrix before
 * the user commits to importing. Anything not in this table is skipped with a
 * `reason: 'unknown_type'` error.
 *
 * The list mirrors the most commonly-exported n8n credential kinds and the
 * SabFlow providers we already have field schemas for.
 */
export const N8N_TYPE_MAP: Readonly<Record<string, CredentialType>> = Object.freeze({
  /* Generic auth ────────────────────────────────────────────────────── */
  httpBasicAuth: 'http_basic_auth',
  httpDigestAuth: 'http_basic_auth',
  httpHeaderAuth: 'http_header_auth',
  httpQueryAuth: 'http_header_auth',
  oAuth1Api: 'oauth2',
  oAuth2Api: 'oauth2',

  /* AI ──────────────────────────────────────────────────────────────── */
  openAiApi: 'openai',
  anthropicApi: 'anthropic',
  mistralCloudApi: 'mistral',
  togetherAiApi: 'together_ai',
  elevenLabsApi: 'elevenlabs',
  cohereApi: 'cohere',
  groqApi: 'groq',
  perplexityApi: 'perplexity',
  openRouterApi: 'openrouter',
  huggingFaceApi: 'huggingface',
  jinaAiApi: 'jina_ai',
  deepLApi: 'deepl',

  /* Google (OAuth2) — collapse all per-service entries onto their
     SabFlow per-service credential type. */
  googleSheetsOAuth2Api: 'google_sheets',
  googleDriveOAuth2Api: 'google_drive',
  googleAnalyticsOAuth2: 'google_analytics',
  googleBigQueryOAuth2Api: 'google_bigquery',
  googleChatOAuth2Api: 'google_chat',
  googleCloudStorageOAuth2Api: 'google_cloud_storage',
  googleFirebaseCloudFirestoreOAuth2Api: 'google_firestore',

  /* Microsoft Graph ────────────────────────────────────────────────── */
  microsoftExcelOAuth2Api: 'microsoft_excel',
  microsoftOneDriveOAuth2Api: 'microsoft_onedrive',
  microsoftOutlookOAuth2Api: 'microsoft_outlook',
  microsoftSharePointOAuth2Api: 'microsoft_sharepoint',
  microsoftToDoOAuth2Api: 'microsoft_todo',
  microsoftTeamsOAuth2Api: 'microsoft_teams',
  microsoftDynamicsOAuth2Api: 'microsoft_dynamics_crm',

  /* Communication ──────────────────────────────────────────────────── */
  slackApi: 'slack',
  slackOAuth2Api: 'slack',
  discordApi: 'discord',
  telegramApi: 'telegram',
  twilioApi: 'twilio',
  whatsAppApi: 'whatsapp',
  chatwootApi: 'chatwoot',
  mattermostApi: 'mattermost',
  matrixApi: 'matrix',
  rocketchatApi: 'rocketchat',
  lineNotifyOAuth2Api: 'line',
  messageBirdApi: 'messagebird',
  vonageApi: 'vonage',
  plivoApi: 'plivo',
  sms77Api: 'sms77',

  /* Email ──────────────────────────────────────────────────────────── */
  smtp: 'smtp',
  sendGridApi: 'sendgrid',
  mailgunApi: 'mailgun',
  postmarkApi: 'postmark',
  resendApi: 'resend',
  mailchimpApi: 'mailchimp',
  mailjetEmailApi: 'mailjet',
  mandrillApi: 'mandrill',
  convertKitApi: 'convertkit',
  getResponseApi: 'getresponse',
  brevoApi: 'brevo',
  mailerLiteApi: 'mailerlite',
  veroApi: 'vero',

  /* CRM ────────────────────────────────────────────────────────────── */
  hubspotApi: 'hubspot',
  hubspotOAuth2Api: 'hubspot',
  salesforceOAuth2Api: 'salesforce',
  pipedriveApi: 'pipedrive',
  airtableApi: 'airtable',
  airtableTokenApi: 'airtable',
  activeCampaignApi: 'activecampaign',
  copperApi: 'copper',
  freshworksCrmApi: 'freshworks_crm',
  zohoOAuth2Api: 'zoho_crm',
  agileCrmApi: 'agile_crm',
  customerIoApi: 'customerio',
  intercomApi: 'intercom',
  keapOAuth2Api: 'keap',
  monicaCrmApi: 'monica_crm',
  driftApi: 'drift',
  demioApi: 'demio',
  salesmateApi: 'salesmate',
  highLevelOAuth2Api: 'highlevel',
  affinityApi: 'affinity',
  erpNextApi: 'erpnext',
  mauticApi: 'mautic',
  egoiApi: 'egoi',
  iterableApi: 'iterable',
  hunterApi: 'hunter',
  phantombusterApi: 'phantombuster',
  clearbitApi: 'clearbit',
  profitWellApi: 'profitwell',

  /* Storage / databases ────────────────────────────────────────────── */
  dropboxApi: 'dropbox',
  dropboxOAuth2Api: 'dropbox',
  aws: 'aws_s3',
  awsS3: 'aws_s3',
  s3: 'aws_s3',
  nextCloudApi: 'nextcloud',
  boxOAuth2Api: 'box',
  ftp: 'ftp',
  sftp: 'ftp',
  sshPassword: 'ssh',
  sshPrivateKey: 'ssh',
  snowflake: 'snowflake',
  postgres: 'postgres',
  mySql: 'mysql',
  redis: 'redis',
  mongoDb: 'mongodb',
  supabaseApi: 'supabase',
  firebaseCloudFirestoreApi: 'firebase',
  noCoDbApi: 'nocodb',

  /* Productivity ───────────────────────────────────────────────────── */
  notionApi: 'notion',
  notionOAuth2Api: 'notion',
  asanaApi: 'asana',
  trelloApi: 'trello',
  clickUpApi: 'clickup',
  mondayComApi: 'monday_com',
  linearApi: 'linear',
  jiraSoftwareApi: 'jira',
  jiraSoftwareCloudApi: 'jira',
  wekanApi: 'wekan',
  taigaApi: 'taiga',
  todoistApi: 'todoist',
  serviceNowOAuth2Api: 'servicenow',
  freshdeskApi: 'freshdesk',
  codaApi: 'coda',
  baserowApi: 'baserow',
  gristApi: 'grist',
  stackbyApi: 'stackby',
  seaTableApi: 'seatable',
  strapiApi: 'strapi',
  ghostApi: 'ghost',
  wordpressApi: 'wordpress',

  /* Code / Git / Ops ───────────────────────────────────────────────── */
  githubApi: 'github',
  githubOAuth2Api: 'github',
  gitlabApi: 'gitlab',
  bitbucketApi: 'bitbucket',
  jenkinsApi: 'jenkins',
  circleCiApi: 'circleci',
  travisCiApi: 'travisci',
  awsLambda: 'aws_lambda',
  cloudflareApi: 'cloudflare',
  netlifyApi: 'netlify',

  /* Commerce / scheduling ──────────────────────────────────────────── */
  stripeApi: 'stripe',
  shopifyApi: 'shopify',
  shopifyOAuth2Api: 'shopify',
  wooCommerceApi: 'woocommerce',
  paddleApi: 'paddle',
  chargebeeApi: 'chargebee',
  payPalApi: 'paypal',
  magento2Api: 'magento',
  quickBooksOAuth2Api: 'quickbooks',
  xeroOAuth2Api: 'xero',
  invoiceNinjaApi: 'invoiceninja',
  calComApi: 'cal_com',
  calendlyApi: 'calendly',

  /* Monitoring / support ───────────────────────────────────────────── */
  sentryIoApi: 'sentry_io',
  sentryIoOAuth2Api: 'sentry_io',
  pagerDutyApi: 'pagerduty',
  grafanaApi: 'grafana',
  helpScoutOAuth2Api: 'helpscout',
  zendeskApi: 'zendesk',
  zammadApi: 'zammad',
  redditOAuth2Api: 'reddit',
  discourseApi: 'discourse',

  /* Social / CMS ───────────────────────────────────────────────────── */
  bitlyApi: 'bitly',
  twitterOAuth2Api: 'twitter',
  twitterApi: 'twitter',
  yourlsApi: 'yourls',
  storyblokContentApi: 'storyblok',
  webflowOAuth2Api: 'webflow',
  mediumApi: 'medium',
  disqusApi: 'disqus',
  bannerbearApi: 'bannerbear',
  brandfetchApi: 'brandfetch',
  apiTemplateIoApi: 'apitemplate_io',
  peekalinkApi: 'peekalink',
  koboToolboxApi: 'kobotoolbox',
  linkedInOAuth2Api: 'linkedin',
  oneSimpleApiApi: 'onesimpleapi',
});

/* ── Forward-declared sibling contracts ─────────────────────────────────── */

/**
 * Minimum shape we need from the SabFlow credentials repo. The real module
 * (sibling #1) is resolved dynamically; this interface keeps the importer
 * compilable in isolation.
 */
export interface CredentialRepoLike {
  createCredentialDirect(input: {
    workspaceId: string;
    requesterId: string;
    type: CredentialType;
    name: string;
    /** KEK-encrypted blob produced by `CryptoLike.encryptDataKek`. */
    encryptedData: string;
  }): Promise<{ id: string }>;
}

/** Minimum shape we need from the KEK crypto module (sibling #2). */
export interface CryptoLike {
  /**
   * Encrypts an arbitrary UTF-8 string under SabFlow's KEK and returns an
   * opaque transport string (envelope, AEAD tag, etc).
   */
  encryptDataKek(plain: string): Promise<string> | string;
}

/* ── Result types ───────────────────────────────────────────────────────── */

export interface ImportPlanEntry {
  /** Original `id` from n8n (if any) — useful for the UI's diff view. */
  n8nId?: string;
  /** Original `name` from n8n. */
  name: string;
  /** Original `type` from n8n. */
  n8nType: string;
  /** Mapped SabFlow type. */
  sabflowType: CredentialType;
  /** Keys we'll persist (values omitted — never logged). */
  fields: string[];
}

export interface ImportError {
  /** `null` when the failure happened before we could identify the row. */
  n8nId: string | null;
  name: string | null;
  n8nType: string | null;
  reason:
    | 'unknown_type'
    | 'invalid_shape'
    | 'decryption_failed'
    | 'empty_payload'
    | 'persist_failed';
  message: string;
}

export interface ImportResult {
  /** Number of rows successfully written (always 0 on `dryRun`). */
  imported: number;
  /** Rows that were intentionally skipped (no mapping, empty data, …). */
  skipped: number;
  /** Per-row failures (also includes skips when caller wants to inspect). */
  errors: ImportError[];
  /**
   * Always populated — describes every row we *would* persist (or did).
   * The admin UI renders this table for both dry-run and real imports.
   */
  plan: ImportPlanEntry[];
}

/* ── Public API ─────────────────────────────────────────────────────────── */

export interface ImportFromN8nOptions {
  workspaceId: string;
  requesterId: string;
  /** Raw `credentials.json` body — `string` or `Buffer` (Node streams must be drained first). */
  json: string | Buffer;
  /**
   * n8n's pre-shared AES-CBC encryption key. When omitted the importer only
   * accepts rows whose `data` is already in plaintext map form.
   */
  encryptionKey?: string;
  /** When `true`, returns the plan but writes nothing. */
  dryRun?: boolean;
  /* Test seams — allow the unit tests to inject in-memory mocks. */
  _repo?: CredentialRepoLike;
  _crypto?: CryptoLike;
}

export async function importFromN8n(
  opts: ImportFromN8nOptions,
): Promise<ImportResult> {
  const { workspaceId, requesterId } = opts;
  if (!workspaceId) throw new Error('importFromN8n: workspaceId is required');
  if (!requesterId) throw new Error('importFromN8n: requesterId is required');

  /* ── Parse top-level JSON ── */
  const text =
    typeof opts.json === 'string' ? opts.json : Buffer.from(opts.json).toString('utf8');

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    throw new Error(
      `importFromN8n: payload is not valid JSON — ${(err as Error).message}`,
    );
  }

  // n8n historically wraps the array in `{ credentials: [...] }`; accept both.
  const rows: unknown[] = Array.isArray(parsed)
    ? parsed
    : Array.isArray((parsed as { credentials?: unknown[] }).credentials)
      ? (parsed as { credentials: unknown[] }).credentials
      : [];

  if (rows.length === 0) {
    return { imported: 0, skipped: 0, errors: [], plan: [] };
  }

  /* ── Resolve siblings lazily ── */
  const repo = opts._repo ?? (await resolveRepo());
  const crypto = opts._crypto ?? (await resolveCrypto());

  const plan: ImportPlanEntry[] = [];
  const errors: ImportError[] = [];
  let imported = 0;
  let skipped = 0;

  for (const raw of rows) {
    const row = raw as Partial<N8nCredentialExport> | null;
    if (!row || typeof row !== 'object' || typeof row.type !== 'string' || typeof row.name !== 'string') {
      skipped++;
      errors.push({
        n8nId: (row && typeof row.id === 'string') ? row.id : null,
        name: (row && typeof row.name === 'string') ? row.name : null,
        n8nType: (row && typeof row.type === 'string') ? row.type : null,
        reason: 'invalid_shape',
        message: 'Row is missing required `type` or `name`',
      });
      continue;
    }

    /* ── Map type ── */
    const sabflowType = N8N_TYPE_MAP[row.type];
    if (!sabflowType) {
      skipped++;
      errors.push({
        n8nId: row.id ?? null,
        name: row.name,
        n8nType: row.type,
        reason: 'unknown_type',
        message: `No SabFlow mapping for n8n type "${row.type}"`,
      });
      continue;
    }

    /* ── Resolve data into a flat string-map ── */
    let data: Record<string, string>;
    try {
      data = await extractData(row.data, opts.encryptionKey);
    } catch (err) {
      skipped++;
      errors.push({
        n8nId: row.id ?? null,
        name: row.name,
        n8nType: row.type,
        reason: 'decryption_failed',
        message: (err as Error).message,
      });
      continue;
    }

    if (Object.keys(data).length === 0) {
      skipped++;
      errors.push({
        n8nId: row.id ?? null,
        name: row.name,
        n8nType: row.type,
        reason: 'empty_payload',
        message: 'Decoded `data` map was empty',
      });
      continue;
    }

    plan.push({
      n8nId: row.id,
      name: row.name,
      n8nType: row.type,
      sabflowType,
      fields: Object.keys(data),
    });

    if (opts.dryRun) continue;

    /* ── Re-encrypt under SabFlow KEK ── */
    let encryptedData: string;
    try {
      encryptedData = await crypto.encryptDataKek(JSON.stringify(data));
    } catch (err) {
      errors.push({
        n8nId: row.id ?? null,
        name: row.name,
        n8nType: row.type,
        reason: 'persist_failed',
        message: `KEK encryption failed: ${(err as Error).message}`,
      });
      continue;
    }

    /* ── Persist via repo ── */
    try {
      await repo.createCredentialDirect({
        workspaceId,
        requesterId,
        type: sabflowType,
        name: row.name,
        encryptedData,
      });
      imported++;
    } catch (err) {
      errors.push({
        n8nId: row.id ?? null,
        name: row.name,
        n8nType: row.type,
        reason: 'persist_failed',
        message: (err as Error).message,
      });
    }
  }

  return { imported, skipped, errors, plan };
}

/* ── n8n-side decryption + shape detection ──────────────────────────────── */

/**
 * Coerce the `data` field of an n8n export row into a flat
 * `Record<string, string>`.
 *
 * - Already-plaintext objects pass through verbatim (with values stringified).
 * - Encrypted strings require `encryptionKey`; we decrypt with AES-256-CBC
 *   (n8n's default) and then JSON-parse the result.
 */
async function extractData(
  raw: unknown,
  encryptionKey: string | undefined,
): Promise<Record<string, string>> {
  if (raw == null) return {};

  if (typeof raw === 'object') {
    // Already plaintext — flatten all values to strings.
    return flattenStringValues(raw as Record<string, unknown>);
  }

  if (typeof raw !== 'string') {
    throw new Error(`Unsupported \`data\` shape: ${typeof raw}`);
  }

  // String form — either plaintext JSON or n8n's CBC payload.
  const trimmed = raw.trim();
  if (trimmed.startsWith('{')) {
    try {
      const obj = JSON.parse(trimmed);
      if (obj && typeof obj === 'object') {
        return flattenStringValues(obj as Record<string, unknown>);
      }
    } catch {
      /* fall through to ciphertext path */
    }
  }

  if (!encryptionKey) {
    throw new Error(
      'Encrypted `data` field present but no `encryptionKey` was supplied',
    );
  }

  const decoded = await decryptN8nCbc(raw, encryptionKey);
  try {
    const obj = JSON.parse(decoded);
    if (obj && typeof obj === 'object') {
      return flattenStringValues(obj as Record<string, unknown>);
    }
  } catch (err) {
    throw new Error(`Decrypted payload was not JSON: ${(err as Error).message}`);
  }
  return {};
}

function flattenStringValues(
  obj: Record<string, unknown>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v == null) continue;
    if (typeof v === 'string') out[k] = v;
    else if (typeof v === 'number' || typeof v === 'boolean') out[k] = String(v);
    else out[k] = JSON.stringify(v);
  }
  return out;
}

/**
 * Decrypt an n8n encryption-key-protected `data` string. n8n uses
 * AES-256-CBC with a SHA-256 of the encryption key and a random 16-byte IV
 * prepended to the ciphertext.  Payload encoding observed in the wild:
 *
 *   - `"<hex-iv>:<hex-ciphertext>"`            (older exports)
 *   - `"<base64-iv><base64-ciphertext>"`        (single concatenated base64,
 *                                                IV = first 16 bytes)
 *
 * We try both encodings to be tolerant of either exporter version.
 */
async function decryptN8nCbc(payload: string, encryptionKey: string): Promise<string> {
  const { createDecipheriv, createHash } = await import('node:crypto');
  const key = createHash('sha256').update(encryptionKey, 'utf8').digest();

  // Variant A — colon-delimited hex.
  if (payload.includes(':')) {
    const [ivHex, ctHex] = payload.split(':', 2);
    if (ivHex && ctHex && /^[0-9a-fA-F]+$/.test(ivHex) && /^[0-9a-fA-F]+$/.test(ctHex)) {
      try {
        const iv = Buffer.from(ivHex, 'hex');
        const ct = Buffer.from(ctHex, 'hex');
        const dec = createDecipheriv('aes-256-cbc', key, iv);
        return Buffer.concat([dec.update(ct), dec.final()]).toString('utf8');
      } catch {
        /* fall through */
      }
    }
  }

  // Variant B — single base64 string with IV prepended.
  try {
    const buf = Buffer.from(payload, 'base64');
    if (buf.length > 16) {
      const iv = buf.subarray(0, 16);
      const ct = buf.subarray(16);
      const dec = createDecipheriv('aes-256-cbc', key, iv);
      return Buffer.concat([dec.update(ct), dec.final()]).toString('utf8');
    }
  } catch {
    /* fall through */
  }

  throw new Error('Failed to decrypt n8n `data` field — wrong key or unsupported payload format');
}

/* ── Dynamic sibling resolution ─────────────────────────────────────────── */

/**
 * Forward-declared sibling module paths. Wrapped in a small helper so TS
 * does not attempt to resolve them at compile time — sibling sub-tasks #1
 * and #2 own the actual implementations.
 */
const SIBLING_REPO_PATHS = ['./repo'] as const;
const SIBLING_CRYPTO_PATHS = ['../crypto/kek', './kek'] as const;

async function dynamicImport(spec: string): Promise<unknown> {
  // Indirect through a non-literal so the bundler/TS treats this as an
  // opaque runtime import (siblings author these files later).
  const dynamic = new Function('s', 'return import(s)') as (
    s: string,
  ) => Promise<unknown>;
  return dynamic(spec);
}

/**
 * Resolve the SabFlow credentials repo at runtime.  The actual module is
 * authored by sub-task #1; the path here is a forward-declaration that the
 * caller can override via the `_repo` test seam.
 */
async function resolveRepo(): Promise<CredentialRepoLike> {
  for (const path of SIBLING_REPO_PATHS) {
    try {
      const mod = (await dynamicImport(path)) as Partial<CredentialRepoLike>;
      if (typeof mod.createCredentialDirect === 'function') {
        return mod as CredentialRepoLike;
      }
    } catch {
      /* try next candidate */
    }
  }
  throw new Error(
    'importFromN8n: credentials repo not available — pass `_repo` or implement ./repo',
  );
}

/**
 * Resolve the SabFlow KEK crypto module at runtime.  Authored by sub-task #2.
 */
async function resolveCrypto(): Promise<CryptoLike> {
  for (const path of SIBLING_CRYPTO_PATHS) {
    try {
      const mod = (await dynamicImport(path)) as Partial<CryptoLike>;
      if (typeof mod.encryptDataKek === 'function') {
        return mod as CryptoLike;
      }
    } catch {
      /* try next candidate */
    }
  }
  throw new Error(
    'importFromN8n: KEK crypto module not available — pass `_crypto` or implement ../crypto/kek',
  );
}
