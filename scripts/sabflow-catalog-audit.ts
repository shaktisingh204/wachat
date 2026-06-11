/**
 * SabFlow — catalog audit: app presets vs forge blocks vs Rust nodes vs
 * native static blocks.
 *
 * Classifies every preset JSON under `src/lib/sabflow/app-presets/` into:
 *   shadowed-by-native | shadowed-by-rust | shadowed-by-forge |
 *   live (baseUrl && endpoints) | repairable (endpoints && !baseUrl) |
 *   shell (!endpoints)
 *
 * Outputs a summary + full table to `scripts/output/sabflow-catalog-audit.json`
 * and prints a readable console table, a cross-tier collision report, and the
 * residual repair list (repairable AND not shadowed).
 *
 * Usage:
 *   npx tsx scripts/sabflow-catalog-audit.ts                     # audit only
 *   npx tsx scripts/sabflow-catalog-audit.ts --emit-credentials  # + generate
 *       src/lib/sabflow/credentials/preset-credential-types.generated.ts
 *   npx tsx scripts/sabflow-catalog-audit.ts --fix-categories    # rewrite
 *       useless n8n categories (Transform/Input/Output/missing) in-place
 */

/* eslint-disable no-console */

import * as fs from 'node:fs';
import * as path from 'node:path';

const REPO_ROOT = path.resolve(__dirname, '..');
const PRESETS_DIR = path.join(REPO_ROOT, 'src/lib/sabflow/app-presets');
const FORGE_BLOCKS_DIR = path.join(REPO_ROOT, 'src/lib/sabflow/forge/blocks');
const RUST_MOD_RS = path.join(
  REPO_ROOT,
  'rust/crates/sabflow-nodes/src/nodes/mod.rs',
);
const STATIC_REGISTRY = path.join(
  REPO_ROOT,
  'src/components/sabflow/editor/blockRegistry.ts',
);
const CREDENTIALS_TYPES = path.join(
  REPO_ROOT,
  'src/lib/sabflow/credentials/types.ts',
);
const GENERATED_CREDENTIALS = path.join(
  REPO_ROOT,
  'src/lib/sabflow/credentials/preset-credential-types.generated.ts',
);
const OUTPUT_DIR = path.join(REPO_ROOT, 'scripts/output');
const OUTPUT_JSON = path.join(OUTPUT_DIR, 'sabflow-catalog-audit.json');

const ARGV = process.argv.slice(2);
const EMIT_CREDENTIALS = ARGV.includes('--emit-credentials');
const FIX_CATEGORIES = ARGV.includes('--fix-categories');

// ───────────────────────────────────────────────────────────────────────────
// Slug normalisation
// ───────────────────────────────────────────────────────────────────────────

/**
 * Normalise an id/name for cross-tier comparison:
 *   - lowercase
 *   - strip leading `n8n-` / `forge_`
 *   - remove `[-_.\s]`
 *   - strip trailing version suffixes (`v2`, `v3`, …)
 *   - KEEP a trailing `trigger` suffix distinct (slack ≠ slacktrigger)
 */
export function normalizeSlug(raw: string): string {
  let s = raw.toLowerCase().trim();
  s = s.replace(/^n8n-/, '').replace(/^forge_/, '');
  s = s.replace(/[-_.\s]+/g, '');
  let trigger = false;
  if (s.endsWith('trigger')) {
    trigger = true;
    s = s.slice(0, -'trigger'.length);
  }
  s = s.replace(/v\d+$/, '');
  return s + (trigger ? 'trigger' : '');
}

// ───────────────────────────────────────────────────────────────────────────
// Loaders for the four tiers
// ───────────────────────────────────────────────────────────────────────────

type PresetJson = {
  id: string;
  name: string;
  description?: string;
  category?: string;
  baseUrl?: string;
  status?: string;
  auth?: {
    type?: string;
    credentialType?: string;
    baseUrlFromCredential?: string;
    awsService?: string;
  };
  endpoints?: Array<{ id: string; path: string }>;
  [k: string]: unknown;
};

/**
 * Mirrors `isPresetComplete` in `app-presets/runtime/loader.ts`: a preset's
 * base URL is resolvable when it is statically set, sourced from the
 * credential (`auth.baseUrlFromCredential`), or templated from the AWS
 * service + region (`aws_sigv4` + `auth.awsService`).
 */
function hasResolvableBaseUrl(preset: PresetJson): boolean {
  if (typeof preset.baseUrl === 'string' && preset.baseUrl.length > 0) return true;
  const auth = preset.auth;
  if (!auth) return false;
  if (typeof auth.baseUrlFromCredential === 'string' && auth.baseUrlFromCredential) return true;
  if (auth.type === 'aws_sigv4' && typeof auth.awsService === 'string' && auth.awsService) {
    return true;
  }
  return false;
}

function loadPresets(): Array<{ file: string; preset: PresetJson }> {
  const out: Array<{ file: string; preset: PresetJson }> = [];
  for (const name of fs.readdirSync(PRESETS_DIR).sort()) {
    if (!name.endsWith('.json')) continue;
    if (name === 'index.json' || name === 'package.json') continue;
    const file = path.join(PRESETS_DIR, name);
    try {
      const preset = JSON.parse(fs.readFileSync(file, 'utf-8')) as PresetJson;
      if (preset && typeof preset.id === 'string') out.push({ file, preset });
    } catch (err) {
      console.warn(`  ⚠ invalid JSON: ${name} — ${(err as Error).message}`);
    }
  }
  return out;
}

/** Walk forge/blocks/**, collect block-level ids (`id: 'forge_…'` at 2-space indent). */
function loadForgeBlockIds(): Set<string> {
  const ids = new Set<string>();
  const stack = [FORGE_BLOCKS_DIR];
  while (stack.length) {
    const dir = stack.pop()!;
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        stack.push(full);
        continue;
      }
      if (!e.isFile() || !e.name.endsWith('.ts')) continue;
      const text = fs.readFileSync(full, 'utf-8');
      if (!text.includes('registerForgeBlock(')) continue;
      for (const m of text.matchAll(/^ {0,2}id:\s*['"](forge_[a-z0-9_]+)['"]/gm)) {
        ids.add(m[1]);
      }
    }
  }
  return ids;
}

/** Parse `register_implemented` in the Rust node registry (do NOT touch stubs). */
function loadRustNodeNames(): Set<string> {
  const text = fs.readFileSync(RUST_MOD_RS, 'utf-8');
  const start = text.indexOf('fn register_implemented');
  if (start === -1) throw new Error('register_implemented not found in mod.rs');
  // Body ends at the next top-level `fn ` (column 0) or EOF.
  const rest = text.slice(start + 1);
  const endRel = rest.search(/\nfn /);
  const body = endRel === -1 ? rest : rest.slice(0, endRel);
  const names = new Set<string>();
  for (const m of body.matchAll(/r\.register\(([a-z0-9_]+)::/g)) {
    // Strip the `_node` module-name suffix (redis_node → redis).
    names.add(m[1].replace(/_node$/, ''));
  }
  return names;
}

/** Parse the static editor block registry (`type: '…'` entries). */
function loadStaticBlockTypes(): Set<string> {
  const text = fs.readFileSync(STATIC_REGISTRY, 'utf-8');
  const types = new Set<string>();
  for (const m of text.matchAll(/^\s{4}type:\s*'([a-z0-9_]+)'/gm)) {
    types.add(m[1]);
  }
  return types;
}

// ───────────────────────────────────────────────────────────────────────────
// Classification
// ───────────────────────────────────────────────────────────────────────────

type Classification =
  | 'shadowed-by-native'
  | 'shadowed-by-rust'
  | 'shadowed-by-forge'
  | 'live'
  | 'repairable'
  | 'shell';

type Row = {
  id: string;
  slug: string;
  name: string;
  category: string;
  status: string;
  endpointCount: number;
  hasBaseUrl: boolean;
  classification: Classification;
};

function classify(
  preset: PresetJson,
  slug: string,
  nativeSlugs: Set<string>,
  rustSlugs: Set<string>,
  forgeSlugs: Set<string>,
): Classification {
  if (nativeSlugs.has(slug)) return 'shadowed-by-native';
  if (rustSlugs.has(slug)) return 'shadowed-by-rust';
  if (forgeSlugs.has(slug)) return 'shadowed-by-forge';
  const endpoints = Array.isArray(preset.endpoints) ? preset.endpoints : [];
  const hasBaseUrl = hasResolvableBaseUrl(preset);
  if (hasBaseUrl && endpoints.length > 0) return 'live';
  if (endpoints.length > 0 && !hasBaseUrl) return 'repairable';
  return 'shell';
}

// ───────────────────────────────────────────────────────────────────────────
// Category remap (--fix-categories)
// ───────────────────────────────────────────────────────────────────────────

const USELESS_CATEGORIES = new Set([
  'transform',
  'input',
  'output',
  'imported (n8n)',
]);

export type PresetCategory =
  | 'communication'
  | 'productivity'
  | 'crm'
  | 'marketing'
  | 'dev'
  | 'data'
  | 'commerce'
  | 'finance'
  | 'ai'
  | 'storage'
  | 'support'
  | 'analytics'
  | 'misc';

/** Ordered keyword map — first matching category wins. */
const CATEGORY_KEYWORDS: Array<[PresetCategory, RegExp]> = [
  [
    'support',
    /zendesk|freshdesk|helpdesk|help-?scout|intercom|uservoice|kayako|zammad|gorgias|halo-?psa|ticket|drift\b/,
  ],
  [
    'crm',
    /\bcrm\b|hubspot|hub-?spot|salesforce|pipedrive|zoho|copper|insightly|salesmate|keap|affinity|attio|freshworks|agile-?crm|monica|odoo|capsule|vtiger|sugar|nutshell|lead\b|contacts\b|high-?level|gong\b|hunter\b|clearbit/,
  ],
  [
    'marketing',
    /mailchimp|klaviyo|convert-?kit|getresponse|mailerlite|drip\b|sendy|lemlist|brevo|sendinblue|beehiiv|buttondown|newsletter|campaign|customer-?io|iterable|mautic|emelia|autopilot|marketing|ads\b|adwords|facebook-?ads|google-?ads|e-?goi|vero\b|mailjet|bitly|short-?url|brandfetch|mandrill|mailcheck/,
  ],
  [
    'ai',
    /openai|gpt|anthropic|claude|mistral|cohere|hugging-?face|stability|eleven-?labs|assembly-?ai|deepgram|whisper|transcri|translate|deepl|lingva|\bai\b|llm|embedding|dall-?e|vision\b|jina|perplexity|openrouter|groq\b|replicate/,
  ],
  [
    'finance',
    /stripe|paypal|payment|invoice|billing|quick-?books|xero\b|wise\b|brex|ramp\b|plaid|adyen|mollie|razorpay|paddle|chargebee|coin|crypto|binance|kraken|accounting|expense|payu|bank|finance|fintech|profitwell|wave\b|harvest\b/,
  ],
  [
    'commerce',
    /shopify|woo-?commerce|magento|bigcommerce|e-?commerce|etsy|ebay|gumroad|lemon-?squeezy|store\b|cart\b|order|product|inventory|shipping|aftership|shippo|dhl|fedex|ups\b|onfleet/,
  ],
  [
    'storage',
    /\bs3\b|drive\b|dropbox|\bbox\b|ftp|sftp|file|storage|one-?drive|nextcloud|owncloud|cdn|bunny|cloudinary|imgix|blob|backblaze|minio/,
  ],
  [
    'data',
    /database|postgres|mysql|mongo|redis|elastic|snowflake|big-?query|airtable|baserow|nocodb|supabase|grist|seatable|quickbase|\bsql\b|\betl\b|scrap|crawl|apify|browserless|browserbase|dataset|spreadsheet|\bcsv\b|extract/,
  ],
  [
    'analytics',
    /analytics|mixpanel|amplitude|segment\b|posthog|matomo|plausible|metabase|tracking|datadog|grafana|splunk|airvisual|uptime|monitor|betterstack|bugsnag|sentry|statuspage|status\b/,
  ],
  [
    'dev',
    /github|gitlab|bitbucket|jenkins|circle-?ci|travis|deploy|vercel|netlify|heroku|docker|kubernetes|cloudflare|linode|digital-?ocean|\baws\b|azure|gcp\b|\bdns\b|serverless|lambda|jira|linear\b|\bgit\b|graphql|devops|iot\b|mqtt|home-?assistant|raspberry|\bssh\b|\bldap\b|certificate|venafi/,
  ],
  [
    'communication',
    /slack|discord|telegram|whatsapp|\bsms\b|twilio|vonage|plivo|message|messaging|\bchat\b|mattermost|matrix|rocket|zulip|\bline\b|signal\b|gotify|pushover|push\b|ntfy|webex|zoom\b|teams\b|gmail|imap|smtp|sendgrid|mailgun|postmark|email|\bmail\b|spontit|twist|msg91|sms77|mocean|call\b|voice|outlook|linked-?in|medium\b|disqus|discourse|twitter|\breddit\b|mastodon|bluesky/,
  ],
  [
    'productivity',
    /calendar|todo|to-?do|task|notion|trello|asana|monday|click-?up|docs?\b|sheet|form\b|survey|typeform|jotform|schedul|calendly|\btime\b|toggl|clockify|project|wrike|teamwork|workflow|note|wiki|confluence|coda\b|evernote|onenote|bamboo|\bhr\b|workable|recruit|crico|sign\b|docusign|pdf|excel|slides\b|presentation|webinar|ghost\b|contentful|cockpit|\bcms\b|word-?press|strapi|webflow/,
  ],
];

function remapCategory(preset: PresetJson): PresetCategory {
  const hay = `${preset.id} ${preset.name ?? ''} ${preset.description ?? ''}`.toLowerCase();
  for (const [cat, re] of CATEGORY_KEYWORDS) {
    if (re.test(hay)) return cat;
  }
  return 'misc';
}

const TAXONOMY: Set<string> = new Set(CATEGORY_KEYWORDS.map(([c]) => c).concat('misc'));

function fixCategories(entries: Array<{ file: string; preset: PresetJson }>): number {
  let rewritten = 0;
  for (const { file, preset } of entries) {
    const current = (preset.category ?? '').trim();
    // Remap n8n's useless groups, missing categories, and values this script
    // produced on a previous run (the remap is deterministic ⇒ idempotent).
    // Hand-curated categories (Fintech, HR, …) are left untouched.
    if (current && !USELESS_CATEGORIES.has(current.toLowerCase()) && !TAXONOMY.has(current)) {
      continue;
    }
    const next = remapCategory(preset);
    if (current === next) continue;
    preset.category = next;
    fs.writeFileSync(file, JSON.stringify(preset, null, 2) + '\n', 'utf-8');
    rewritten++;
  }
  return rewritten;
}

// ───────────────────────────────────────────────────────────────────────────
// Credentials generation (--emit-credentials)
// ───────────────────────────────────────────────────────────────────────────

/** Parse the hand-written CredentialType union out of credentials/types.ts. */
function parseKnownCredentialTypes(): Set<string> {
  const text = fs.readFileSync(CREDENTIALS_TYPES, 'utf-8');
  // After the generated merge lands the union is renamed KnownCredentialType.
  const m =
    text.match(/export type KnownCredentialType =([\s\S]*?);/) ??
    text.match(/export type CredentialType =([\s\S]*?);/);
  if (!m) throw new Error('CredentialType union not found in credentials/types.ts');
  const out = new Set<string>();
  for (const lit of m[1].matchAll(/'([a-z0-9_]+)'/g)) out.add(lit[1]);
  return out;
}

type CredFieldKind = 'text' | 'password' | 'url' | 'number' | 'boolean';
type CredField = {
  key: string;
  label: string;
  kind: CredFieldKind;
  placeholder?: string;
  required?: boolean;
  helpText?: string;
};

function schemaForAuthType(authType: string, baseUrlKey?: string): CredField[] {
  const fields: CredField[] = (() => {
    switch (authType) {
      case 'basic':
        return [
          { key: 'username', label: 'Username', kind: 'text', required: true },
          { key: 'password', label: 'Password', kind: 'password', required: true },
        ] as CredField[];
      case 'oauth2':
        return [
          { key: 'accessToken', label: 'Access token', kind: 'password', required: true },
          { key: 'refreshToken', label: 'Refresh token', kind: 'password' },
        ] as CredField[];
      case 'aws_sigv4':
        return [
          { key: 'accessKeyId', label: 'Access key ID', kind: 'text', required: true },
          { key: 'secretAccessKey', label: 'Secret access key', kind: 'password', required: true },
          {
            key: 'region',
            label: 'Region',
            kind: 'text',
            required: true,
            placeholder: 'us-east-1',
            helpText: 'AWS region — defaults to us-east-1 when left empty',
          },
          {
            key: 'sessionToken',
            label: 'Session token',
            kind: 'password',
            helpText: 'Optional — for temporary credentials (sent as x-amz-security-token)',
          },
        ] as CredField[];
      // bearer | header | query_token | api_key — single secret read as `apiKey`
      // by app-presets/runtime/exec.ts.
      default:
        return [{ key: 'apiKey', label: 'API key', kind: 'password', required: true }] as CredField[];
    }
  })();
  // Presets flagged `auth.baseUrlFromCredential` read the instance URL from
  // the credential — surface it as the first (required) field.
  if (baseUrlKey) {
    fields.unshift({ key: baseUrlKey, label: 'Instance URL', kind: 'text', required: true });
  }
  return fields;
}

const CATEGORY_TO_CREDENTIAL_CATEGORY: Record<PresetCategory, string> = {
  communication: 'communication',
  productivity: 'productivity',
  crm: 'crm',
  marketing: 'email',
  dev: 'code',
  data: 'database',
  commerce: 'commerce',
  finance: 'commerce',
  ai: 'ai',
  storage: 'storage',
  support: 'communication',
  analytics: 'productivity',
  misc: 'generic',
};

const KNOWN_CREDENTIAL_CATEGORIES = new Set([
  'ai', 'email', 'communication', 'storage', 'crm', 'productivity',
  'code', 'commerce', 'scheduling', 'automation', 'database', 'generic',
]);

function credentialCategoryFor(preset: PresetJson): string {
  const cat = (preset.category ?? '').toLowerCase();
  if (KNOWN_CREDENTIAL_CATEGORIES.has(cat)) return cat;
  const mapped = CATEGORY_TO_CREDENTIAL_CATEGORY[cat as PresetCategory];
  if (mapped) return mapped;
  return CATEGORY_TO_CREDENTIAL_CATEGORY[remapCategory(preset)];
}

function emitCredentials(rows: Row[], entries: Array<{ file: string; preset: PresetJson }>): number {
  const known = parseKnownCredentialTypes();
  const byId = new Map(entries.map((e) => [e.preset.id, e.preset]));

  type Pending = {
    credentialType: string;
    authType: string;
    label: string;
    category: string;
    baseUrlKey?: string;
  };
  const pending = new Map<string, Pending>();

  for (const row of rows) {
    // Cover every preset that is executable (complete — including ones the
    // shadow classification flags, they still list + execute) or repairable.
    const executable = row.hasBaseUrl && row.endpointCount > 0;
    const repairable = row.endpointCount > 0 && !row.hasBaseUrl;
    if (!executable && !repairable) continue;
    const preset = byId.get(row.id);
    const credType = preset?.auth?.credentialType;
    const authType = preset?.auth?.type ?? 'header';
    if (!credType || authType === 'none') continue;
    if (known.has(credType)) continue;
    if (!/^[a-z0-9_]+$/.test(credType)) {
      console.warn(`  ⚠ skipping non-snake credentialType '${credType}' (${row.id})`);
      continue;
    }
    if (!pending.has(credType)) {
      pending.set(credType, {
        credentialType: credType,
        authType,
        // The shared 'aws' type is used by many AWS presets — a neutral label
        // beats whichever preset happens to be scanned first.
        label: credType === 'aws' ? 'AWS' : preset?.name ?? credType,
        category: credType === 'aws' ? 'code' : credentialCategoryFor(preset!),
        baseUrlKey: preset?.auth?.baseUrlFromCredential,
      });
    }
  }

  const sorted = Array.from(pending.values()).sort((a, b) =>
    a.credentialType.localeCompare(b.credentialType),
  );

  const lines: string[] = [];
  lines.push('/**');
  lines.push(' * GENERATED by scripts/sabflow-catalog-audit.ts --emit-credentials — do not edit.');
  lines.push(' *');
  lines.push(' * Credential types referenced by live/repairable app presets that are not');
  lines.push(' * present in the hand-written union in `./types.ts`. Schemas follow the');
  lines.push(' * auth shape the preset dispatcher (`app-presets/runtime/exec.ts`) reads:');
  lines.push(' *   bearer/header/query_token → data.apiKey');
  lines.push(' *   basic                     → data.username + data.password');
  lines.push(' *   oauth2                    → data.accessToken (+ data.refreshToken)');
  lines.push(' */');
  lines.push('');
  lines.push('/** Mirrors `CredentialCategory` in ./types.ts (kept literal so the spread typechecks). */');
  lines.push('type GeneratedCredentialCategory =');
  lines.push("  | 'ai' | 'email' | 'communication' | 'storage' | 'crm' | 'productivity'");
  lines.push("  | 'code' | 'commerce' | 'scheduling' | 'automation' | 'database' | 'generic';");
  lines.push('');
  lines.push('type GeneratedCredentialField = {');
  lines.push('  key: string;');
  lines.push('  label: string;');
  lines.push("  kind: 'text' | 'password' | 'url' | 'number' | 'boolean';");
  lines.push('  placeholder?: string;');
  lines.push('  required?: boolean;');
  lines.push('  helpText?: string;');
  lines.push('};');
  lines.push('');
  lines.push('export const PRESET_CREDENTIAL_TYPES = [');
  for (const p of sorted) lines.push(`  '${p.credentialType}',`);
  lines.push('] as const;');
  lines.push('');
  lines.push('export type PresetCredentialType = (typeof PRESET_CREDENTIAL_TYPES)[number];');
  lines.push('');
  lines.push('export const PRESET_CREDENTIAL_LABELS: Record<PresetCredentialType, string> = {');
  for (const p of sorted) {
    lines.push(`  ${p.credentialType}: ${JSON.stringify(p.label)},`);
  }
  lines.push('};');
  lines.push('');
  lines.push('export const PRESET_CREDENTIAL_CATEGORIES: Record<PresetCredentialType, GeneratedCredentialCategory> = {');
  for (const p of sorted) {
    lines.push(`  ${p.credentialType}: '${p.category}',`);
  }
  lines.push('};');
  lines.push('');
  lines.push(
    'export const PRESET_CREDENTIAL_SCHEMAS: Record<PresetCredentialType, GeneratedCredentialField[]> = {',
  );
  for (const p of sorted) {
    const fields = schemaForAuthType(p.authType, p.baseUrlKey)
      .map((f) => {
        const parts = [
          `key: '${f.key}'`,
          `label: '${f.label}'`,
          `kind: '${f.kind}'`,
        ];
        if (f.placeholder) parts.push(`placeholder: ${JSON.stringify(f.placeholder)}`);
        if (f.required) parts.push('required: true');
        if (f.helpText) parts.push(`helpText: ${JSON.stringify(f.helpText)}`);
        return `{ ${parts.join(', ')} }`;
      })
      .join(', ');
    lines.push(`  ${p.credentialType}: [${fields}],`);
  }
  lines.push('};');
  lines.push('');

  fs.writeFileSync(GENERATED_CREDENTIALS, lines.join('\n'), 'utf-8');
  return sorted.length;
}

// ───────────────────────────────────────────────────────────────────────────
// Main
// ───────────────────────────────────────────────────────────────────────────

function main() {
  const entries = loadPresets();
  const forgeIds = loadForgeBlockIds();
  const rustNames = loadRustNodeNames();
  const staticTypes = loadStaticBlockTypes();

  const forgeSlugs = new Set(Array.from(forgeIds, normalizeSlug));
  const rustSlugs = new Set(Array.from(rustNames, normalizeSlug));
  const nativeSlugs = new Set(Array.from(staticTypes, normalizeSlug));

  console.log(
    `Loaded: ${entries.length} presets · ${forgeIds.size} forge blocks · ` +
      `${rustNames.size} rust nodes · ${staticTypes.size} static block types`,
  );

  if (FIX_CATEGORIES) {
    const n = fixCategories(entries);
    console.log(`--fix-categories: rewrote ${n} preset categories in-place.`);
  }

  const rows: Row[] = entries.map(({ preset }) => {
    const slug = normalizeSlug(preset.id);
    const endpoints = Array.isArray(preset.endpoints) ? preset.endpoints : [];
    return {
      id: preset.id,
      slug,
      name: preset.name ?? preset.id,
      category: preset.category ?? '',
      status: preset.status ?? 'verified',
      endpointCount: endpoints.length,
      hasBaseUrl: hasResolvableBaseUrl(preset),
      classification: classify(preset, slug, nativeSlugs, rustSlugs, forgeSlugs),
    };
  });

  // ── Summary ──────────────────────────────────────────────────────────────
  const counts = new Map<Classification, number>();
  for (const r of rows) counts.set(r.classification, (counts.get(r.classification) ?? 0) + 1);
  console.log('\n── Summary ──');
  for (const c of [
    'live',
    'repairable',
    'shell',
    'shadowed-by-native',
    'shadowed-by-rust',
    'shadowed-by-forge',
  ] as Classification[]) {
    console.log(`  ${c.padEnd(20)} ${counts.get(c) ?? 0}`);
  }

  // ── Collision report — slugs present in 2+ tiers ─────────────────────────
  const presetSlugs = new Set(rows.map((r) => r.slug));
  type Collision = { slug: string; tiers: string[] };
  const collisions: Collision[] = [];
  const allSlugs = new Set([...presetSlugs, ...forgeSlugs, ...rustSlugs, ...nativeSlugs]);
  for (const slug of Array.from(allSlugs).sort()) {
    const tiers: string[] = [];
    if (presetSlugs.has(slug)) tiers.push('preset');
    if (forgeSlugs.has(slug)) tiers.push('forge');
    if (rustSlugs.has(slug)) tiers.push('rust');
    if (nativeSlugs.has(slug)) tiers.push('native');
    if (tiers.length >= 2) collisions.push({ slug, tiers });
  }
  console.log(`\n── Collisions (slug in 2+ tiers): ${collisions.length} ──`);
  for (const c of collisions.slice(0, 40)) {
    console.log(`  ${c.slug.padEnd(28)} ${c.tiers.join(' + ')}`);
  }
  if (collisions.length > 40) console.log(`  … and ${collisions.length - 40} more (see JSON)`);

  // ── Residual repair list ──────────────────────────────────────────────────
  const residual = rows.filter((r) => r.classification === 'repairable');
  console.log(`\n── Residual repair list (repairable, not shadowed): ${residual.length} ──`);

  // ── Full table ────────────────────────────────────────────────────────────
  console.log('\n── Full table ──');
  console.log(
    'classification'.padEnd(20) + 'id'.padEnd(36) + 'eps'.padEnd(6) + 'baseUrl  category',
  );
  for (const r of rows) {
    console.log(
      r.classification.padEnd(20) +
        r.id.padEnd(36) +
        String(r.endpointCount).padEnd(6) +
        (r.hasBaseUrl ? 'yes' : 'no ').padEnd(9) +
        r.category,
    );
  }

  // ── JSON output ───────────────────────────────────────────────────────────
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(
    OUTPUT_JSON,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        counts: Object.fromEntries(counts),
        tierSizes: {
          presets: entries.length,
          forgeBlocks: forgeIds.size,
          rustNodes: rustNames.size,
          staticBlockTypes: staticTypes.size,
        },
        collisions,
        residualRepairIds: residual.map((r) => r.id),
        rows,
      },
      null,
      2,
    ) + '\n',
    'utf-8',
  );
  console.log(`\n✓ Wrote ${path.relative(REPO_ROOT, OUTPUT_JSON)}`);

  // ── Credentials emission ──────────────────────────────────────────────────
  if (EMIT_CREDENTIALS) {
    const n = emitCredentials(rows, entries);
    console.log(
      `--emit-credentials: generated ${n} credential types → ` +
        path.relative(REPO_ROOT, GENERATED_CREDENTIALS),
    );
  }
}

main();
