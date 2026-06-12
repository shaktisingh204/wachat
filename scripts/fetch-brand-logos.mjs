/**
 * fetch-brand-logos.mjs — scrape real SVG brand logos for the whole SabFlow
 * app catalog (presets + forge blocks) and the landing-page integrations wall.
 *
 * Sources (in preference order):
 *   1. Iconify `logos` collection  — full-colour official brand marks (svgporn)
 *   2. simpleicons.org CDN         — official monochrome marks, served in the
 *                                    brand's default colour
 *
 * Outputs:
 *   • public/brand-logos/<slug>.svg                       — one file per app
 *   • src/lib/sabflow/blocks/brand-logos.generated.ts     — slug → local path
 *   • scripts/output/brand-logos-report.json              — match report
 *
 * Run:  node scripts/fetch-brand-logos.mjs
 * Idempotent — re-running refreshes everything in place.
 */

import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(new URL('.', import.meta.url).pathname, '..');
const PRESETS_DIR = path.join(ROOT, 'src/lib/sabflow/app-presets');
const FORGE_DIR = path.join(ROOT, 'src/lib/sabflow/forge');
const N8N_ICON_DIRS = [
  path.join(ROOT, 'n8n-master/packages/nodes-base/nodes'),
  path.join(ROOT, 'n8n-master/packages/@n8n/nodes-langchain/nodes'),
];
const OUT_DIR = path.join(ROOT, 'public/brand-logos');
const GEN_FILE = path.join(ROOT, 'src/lib/sabflow/blocks/brand-logos.generated.ts');
const REPORT_FILE = path.join(ROOT, 'scripts/output/brand-logos-report.json');

/* ── Slug helpers (mirror normalizeAppSlug in useAppCatalog.ts) ──────────── */

function normalizeSlug(raw) {
  let s = String(raw).trim().toLowerCase();
  s = s.replace(/^n8n[-_.\s]+/, '');
  s = s.replace(/^forge[-_.\s]+/, '');
  s = s.replace(/[-_.\s]+/g, '');
  s = s.replace(/v\d+$/, '');
  s = s.replace(/trigger$/, ''); // trigger variants share the provider mark
  return s;
}

function kebab(raw) {
  return String(raw)
    .trim()
    .toLowerCase()
    .replace(/^n8n[-_.\s]+/, '')
    .replace(/^forge[-_.\s]+/, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-v\d+$/, '')
    .replace(/-trigger$/, '');
}

/* Tokens that must never match a brand on their own (too generic). */
const STOPWORDS = new Set([
  'email', 'mail', 'send', 'data', 'cloud', 'api', 'app', 'web', 'http',
  'json', 'file', 'files', 'text', 'image', 'video', 'audio', 'search',
  'chat', 'ai', 'agent', 'tool', 'array', 'object', 'string', 'number',
  'date', 'time', 'code', 'crm', 'sms', 'tts', 'db', 'database', 'form',
  'forms', 'event', 'events', 'task', 'tasks', 'page', 'pages', 'doc',
  'docs', 'sheet', 'sheets', 'drive', 'calendar', 'analytics', 'ads',
  'rest', 'legacy', 'health', 'io', 'com', 'hq', 'net', 'one', 'go',
]);

/* First-token vendor → vendor brand mark (product-level logo missing). */
const VENDOR_MARKS = {
  aws: 'logos:aws',
  amazon: 'logos:aws',
  azure: 'logos:microsoft-azure',
  microsoft: 'logos:microsoft-icon',
  google: 'logos:google-icon',
  cloudflare: 'logos:cloudflare-icon',
  facebook: 'logos:facebook',
  meta: 'logos:meta-icon',
  zoho: 'logos:zoho',
  cisco: 'logos:cisco',
  oracle: 'logos:oracle',
  ibm: 'logos:ibm',
  sap: 'logos:sap',
  adobe: 'logos:adobe-icon',
  atlassian: 'logos:atlassian',
  salesforce: 'logos:salesforce',
  twilio: 'logos:twilio-icon',
  github: 'logos:github-icon',
  gitlab: 'logos:gitlab',
  openai: 'logos:openai-icon',
  anthropic: 'logos:anthropic-icon',
  stripe: 'logos:stripe',
  shopify: 'logos:shopify',
  hubspot: 'logos:hubspot',
  notion: 'logos:notion-icon',
  slack: 'logos:slack-icon',
  linkedin: 'logos:linkedin-icon',
  apple: 'logos:apple',
  bunny: 'simple-icons:bunny',
  vercel: 'logos:vercel-icon',
  supabase: 'logos:supabase-icon',
  firebase: 'logos:firebase',
  mongodb: 'logos:mongodb-icon',
  postgres: 'logos:postgresql',
  redis: 'logos:redis',
  mysql: 'logos:mysql-icon',
  elastic: 'logos:elasticsearch',
  kafka: 'logos:kafka-icon',
};

/* ── Explicit overrides for tricky / high-visibility brands ──────────────── */
/* slugKey → iconify name ("logos:x" / "simple-icons:x"). Verified at runtime
 * against the fetched collection lists; falls through resolution if missing. */
const OVERRIDES = {
  google: 'logos:google-icon',
  meta: 'logos:meta-icon',
  facebook: 'logos:facebook',
  microsoftoutlook: 'logos:microsoft-outlook',
  outlook: 'logos:microsoft-outlook',
  shopify: 'logos:shopify',
  razorpay: 'simple-icons:razorpay',
  stripe: 'logos:stripe',
  slack: 'logos:slack-icon',
  notion: 'logos:notion-icon',
  zapier: 'logos:zapier-icon',
  hubspot: 'logos:hubspot',
  salesforce: 'logos:salesforce',
  linear: 'logos:linear-icon',
  github: 'logos:github-icon',
  postgres: 'logos:postgresql',
  postgresql: 'logos:postgresql',
  mongodb: 'logos:mongodb-icon',
  redis: 'logos:redis',
  awss3: 'logos:aws-s3',
  aws: 'logos:aws',
  twitter: 'logos:x',
  x: 'logos:x',
  gmail: 'logos:google-gmail',
  googlesheets: 'logos:google-sheets',
  googledrive: 'logos:google-drive',
  googlecalendar: 'logos:google-calendar',
  googledocs: 'logos:google-docs',
  googleanalytics: 'logos:google-analytics',
  microsoftteams: 'logos:microsoft-teams',
  openai: 'logos:openai-icon',
  anthropic: 'logos:anthropic-icon',
  whatsapp: 'logos:whatsapp-icon',
  instagram: 'skill-icons:instagram',
  wordpress: 'logos:wordpress-icon',
  youtube: 'logos:youtube-icon',
  zoom: 'logos:zoom-icon',
  apolloio: 'simple-icons:apollographql',
  hackernews: 'simple-icons:ycombinator',
  azure: 'logos:microsoft-azure',
  azuread: 'logos:microsoft-azure',
  googleworkspace: 'logos:google-workspace',
  googlegemini: 'logos:google-gemini',
  gemini: 'logos:google-gemini',
  bigquery: 'logos:google-bigquery',
  redshift: 'logos:aws-redshift',
  tiktok: 'logos:tiktok-icon',
  devto: 'simple-icons:devdotto',
  s3: 'logos:aws-s3',
  xtwitter: 'logos:x',
  msteams: 'logos:microsoft-teams',
  msoutlook: 'logos:microsoft-outlook',
  outlookcalendar: 'logos:microsoft-outlook',
  msexcel: 'logos:microsoft-excel',
  cal: 'logos:cal',
  calcom: 'logos:cal',
  coheregenerate: 'logos:cohere',
  coherererank: 'logos:cohere',
  togetherai: 'simple-icons:togetherai',
  emailimap: null, // generic primitives — keep Lucide icons
  emailsend: null,
  emailreadimap: null,
  sendemailn8n: null,
  webhook: null,
  httprequest: null,
  aggregate: null,
  code: null,
  form: null,
  html: null,
  limit: null,
  merge: null,
  sort: null,
  filter: null,
  wait: null,
  schedule: null,
  crypto: null,
  compression: null,
  datetime: null,
};

/* AI-provider tokens for LangChain-family blocks (lmchat*, embeddings*, vec*,
 * mem*, audio*, image*…). Only unambiguous provider names — checked via
 * substring against the slug remainder. */
const AI_FAMILY_PREFIX =
  /^(lmchat|lm|lc|embeddings|embed|vec|mem(ory)?|audio|image|video|chain|tool|outputparser|retriever|textsplitter|docloader|rerank|guardrails)/;
const PROVIDER_TOKENS = {
  anthropic: 'logos:anthropic-icon',
  openai: 'logos:openai-icon',
  azureopenai: 'logos:microsoft-azure',
  mistral: 'logos:mistral-ai-icon',
  cohere: 'logos:cohere',
  gemini: 'logos:google-gemini',
  googlevertex: 'logos:google-icon',
  vertex: 'logos:google-icon',
  ollama: 'logos:ollama',
  bedrock: 'logos:aws',
  huggingface: 'logos:hugging-face-icon',
  deepseek: 'logos:deepseek',
  fireworks: 'logos:fireworks-ai',
  replicate: 'simple-icons:replicate',
  openrouter: 'logos:openrouter',
  groq: 'logos:groq',
  xai: 'logos:xai',
  voyage: 'logos:voyage',
  pinecone: 'logos:pinecone-icon',
  qdrant: 'logos:qdrant-icon',
  chromadb: 'logos:chroma',
  supabase: 'logos:supabase-icon',
  pgvector: 'logos:postgresql',
  postgres: 'logos:postgresql',
  redis: 'logos:redis',
  mongo: 'logos:mongodb-icon',
  zep: 'simple-icons:zep',
  xata: 'logos:xata-icon',
  elevenlabs: 'logos:elevenlabs',
  deepgram: 'logos:deepgram',
  whisper: 'logos:openai-icon',
  dalle: 'logos:openai-icon',
  assemblyai: 'simple-icons:assemblyai',
  stablediffusion: 'logos:stability-ai',
  sdxl: 'logos:stability-ai',
  midjourney: 'simple-icons:midjourney',
  runway: 'simple-icons:runwayml',
  serpapi: 'simple-icons:serpapi',
  wikipedia: 'logos:wikipedia',
  wolframalpha: 'simple-icons:wolframalpha',
  searxng: 'simple-icons:searxng',
  tavily: 'logos:tavily',
  bravesearch: 'logos:brave',
};

/* Landing-page wall — these MUST end up on disk (build fails loudly if not). */
const LANDING = [
  'google', 'meta', 'shopify', 'razorpay', 'stripe', 'slack', 'notion',
  'zapier', 'hubspot', 'salesforce', 'linear', 'github', 'postgres',
  'mongodb', 'redis', 'awss3',
];

/* Extra brands referenced by marketing pages (/integrations directory). */
const EXTRA_APPS = [
  'outlook', 'cashfree', 'phonepe', 'delhivery', 'shiprocket', 'tiktok',
  'anthropic', 'googlegemini', 'ollama', 'weaviate', 'bigquery', 'redshift',
  'azure', 'googleworkspace', 'auth0', 'okta', 'vercel', 'paypal',
  'mailchimp', 'pinecone', 'mysql', 'snowflake', 'jira', 'asana',
  'pagerduty', 'datadog', 'sentry', 'cloudflare', 'whatsapp', 'gmail',
];

/* ── Iconify collection lists ────────────────────────────────────────────── */

async function fetchJson(url) {
  const res = await fetch(url, { headers: { 'user-agent': 'sabnode-logo-fetch' } });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
}

async function fetchCollection(prefix) {
  const j = await fetchJson(`https://api.iconify.design/collection?prefix=${prefix}`);
  const names = new Set([
    ...(j.uncategorized ?? []),
    ...Object.values(j.categories ?? {}).flat(),
    ...(j.hidden ?? []),
  ]);
  // aliases resolve too
  for (const alias of Object.keys(j.aliases ?? {})) names.add(alias);
  return names;
}

/* ── Gather catalog apps ─────────────────────────────────────────────────── */

async function loadPresets() {
  const files = (await readdir(PRESETS_DIR)).filter((f) => f.endsWith('.json'));
  const apps = [];
  for (const f of files) {
    try {
      const j = JSON.parse(await readFile(path.join(PRESETS_DIR, f), 'utf8'));
      if (j?.id && j?.name) apps.push({ id: j.id, name: j.name });
    } catch { /* skip unparseable */ }
  }
  return apps;
}

/* Index n8n's vendored node icons: normalized slug → absolute file path.
 * Prefers .svg over .png and light over `.dark.` variants. */
async function buildN8nIconIndex() {
  const index = new Map();
  function consider(key, file) {
    if (!key || key.length < 3) return;
    const prev = index.get(key);
    if (!prev) { index.set(key, file); return; }
    const better =
      (file.endsWith('.svg') && prev.endsWith('.png')) ||
      (prev.includes('.dark.') && !file.includes('.dark.'));
    if (better) index.set(key, file);
  }
  async function walk(dir) {
    let entries = [];
    try { entries = await readdir(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) await walk(p);
      else if (/\.(svg|png)$/.test(e.name)) {
        const base = e.name.replace(/\.(svg|png)$/, '').replace(/\.dark$/, '');
        consider(normalizeSlug(base), p);
        consider(normalizeSlug(path.basename(path.dirname(p))), p);
      }
    }
  }
  for (const d of N8N_ICON_DIRS) await walk(d);
  return index;
}

async function harvestForgeIds() {
  const ids = new Set();
  async function walk(dir) {
    let entries = [];
    try { entries = await readdir(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) await walk(p);
      else if (e.name.endsWith('.ts')) {
        const src = await readFile(p, 'utf8');
        for (const m of src.matchAll(/id:\s*['"](forge_[a-z0-9_]+)['"]/g)) ids.add(m[1]);
      }
    }
  }
  await walk(FORGE_DIR);
  return [...ids];
}

/* ── Resolution ──────────────────────────────────────────────────────────── */

function checkIconified(o, logos, simple, skills) {
  if (!o) return null;
  const [col, name] = o.split(':');
  const set = col === 'logos' ? logos : col === 'skill-icons' ? skills : simple;
  return set.has(name) ? { col, name } : null;
}

function tryExact(hyphenCands, alnumCands, logos, simple) {
  for (const c of hyphenCands) {
    if (logos.has(`${c}-icon`)) return { col: 'logos', name: `${c}-icon` };
    if (logos.has(c)) return { col: 'logos', name: c };
  }
  for (const c of alnumCands) {
    if (logos.has(`${c}-icon`)) return { col: 'logos', name: `${c}-icon` };
    if (logos.has(c)) return { col: 'logos', name: c };
  }
  for (const c of alnumCands) {
    if (simple.has(c)) return { col: 'simple-icons', name: c };
  }
  return null;
}

function resolve(slugKey, candidatesHyphen, candidatesAlnum, logos, simple, skills, n8nIcons) {
  if (slugKey in OVERRIDES && OVERRIDES[slugKey] === null) return null; // generic primitive
  const exactOverride = checkIconified(OVERRIDES[slugKey], logos, simple, skills);
  if (exactOverride) return exactOverride;

  const exact = tryExact(candidatesHyphen, candidatesAlnum, logos, simple);
  if (exact) return exact;

  /* n8n's vendored official node icons — exact slug match. */
  for (const c of candidatesAlnum) {
    const file = n8nIcons.get(c);
    if (file) return { col: 'n8n', name: path.relative(ROOT, file), file };
  }

  /* AI/LangChain family blocks → provider mark (lmchatanthropic → Anthropic). */
  if (AI_FAMILY_PREFIX.test(slugKey)) {
    const rest = slugKey.replace(AI_FAMILY_PREFIX, '');
    const tokens = Object.keys(PROVIDER_TOKENS).sort((a, b) => b.length - a.length);
    for (const t of tokens) {
      if (rest.includes(t)) {
        const hit = checkIconified(PROVIDER_TOKENS[t], logos, simple, skills);
        if (hit) return hit;
        const file = n8nIcons.get(t);
        if (file) return { col: 'n8n', name: path.relative(ROOT, file), file };
      }
    }
  }

  /* Token-dropping fallbacks: "adafruit-io" → "adafruit", "cal-com" → "cal". */
  for (const c of candidatesHyphen) {
    const tokens = c.split('-').filter(Boolean);
    if (tokens.length < 2) continue;
    // Drop trailing tokens one at a time.
    for (let n = tokens.length - 1; n >= 1; n--) {
      const head = tokens.slice(0, n);
      if (n === 1 && (STOPWORDS.has(head[0]) || head[0].length < 3)) break;
      const hit = tryExact([head.join('-')], [head.join('')], logos, simple);
      if (hit) return hit;
      const file = n8nIcons.get(head.join(''));
      if (file) return { col: 'n8n', name: path.relative(ROOT, file), file };
    }
    // Drop the leading token when it is a known vendor word ("cisco-webex").
    if (tokens.length >= 2 && VENDOR_MARKS[tokens[0]]) {
      const tail = tokens.slice(1);
      if (!(tail.length === 1 && (STOPWORDS.has(tail[0]) || tail[0].length < 3))) {
        const hit = tryExact([tail.join('-')], [tail.join('')], logos, simple);
        if (hit) return hit;
      }
    }
  }

  /* Vendor mark fallback: aws-iot-rest → AWS mark, cloudflare-kv → Cloudflare. */
  for (const c of candidatesHyphen) {
    const first = c.split('-')[0];
    const mark = checkIconified(VENDOR_MARKS[first], logos, simple, skills);
    if (mark && c !== first) return mark;
  }
  /* Alnum vendor prefix (slugs that lost their separators, e.g. "awsiam"). */
  for (const c of candidatesAlnum) {
    for (const [vendor, mark] of Object.entries(VENDOR_MARKS)) {
      if (c.startsWith(vendor) && c.length > vendor.length) {
        const hit = checkIconified(mark, logos, simple, skills);
        if (hit) return hit;
      }
    }
  }
  return null;
}

/* ── Download ────────────────────────────────────────────────────────────── */

const svgCache = new Map();

async function fetchSvg(col, name) {
  const key = `${col}:${name}`;
  if (svgCache.has(key)) return svgCache.get(key);
  const url =
    col === 'simple-icons'
      ? `https://cdn.simpleicons.org/${name}` // brand-coloured fill
      : `https://api.iconify.design/${col}/${name}.svg`;
  let svg = null;
  for (let attempt = 0; attempt < 2 && !svg; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'user-agent': 'sabnode-logo-fetch' } });
      if (res.ok) {
        const text = await res.text();
        if (text.includes('<svg')) svg = text;
      }
    } catch { /* retry */ }
  }
  // simple-icons CDN miss → iconify monochrome fallback
  if (!svg && col === 'simple-icons') {
    try {
      const res = await fetch(`https://api.iconify.design/simple-icons/${name}.svg?color=%23525252`);
      if (res.ok) {
        const text = await res.text();
        if (text.includes('<svg')) svg = text;
      }
    } catch { /* give up */ }
  }
  svgCache.set(key, svg);
  return svg;
}

async function pool(items, worker, size = 10) {
  const queue = [...items];
  const out = [];
  await Promise.all(
    Array.from({ length: size }, async () => {
      while (queue.length) {
        const item = queue.shift();
        out.push(await worker(item));
      }
    }),
  );
  return out;
}

/* ── Main ────────────────────────────────────────────────────────────────── */

const [presets, forgeIds, logos, simple, skills, n8nIcons] = await Promise.all([
  loadPresets(),
  harvestForgeIds(),
  fetchCollection('logos'),
  fetchCollection('simple-icons'),
  fetchCollection('skill-icons'),
  buildN8nIconIndex(),
]);

console.log(`presets: ${presets.length}, forge ids: ${forgeIds.length}, n8n icons: ${n8nIcons.size}`);
console.log(`iconify logos: ${logos.size}, simple-icons: ${simple.size}, skill-icons: ${skills.size}`);

/* Build the work list keyed by normalized slug. */
const work = new Map(); // slugKey → { slugKey, label, hyphen:[], alnum:[] }

function addApp(rawId, label) {
  const slugKey = normalizeSlug(rawId);
  if (!slugKey || slugKey.length < 2) return;
  const entry = work.get(slugKey) ?? { slugKey, label: label || rawId, hyphen: new Set(), alnum: new Set() };
  const idKebab = kebab(rawId);
  if (idKebab) entry.hyphen.add(idKebab);
  if (label) entry.hyphen.add(kebab(label));
  entry.alnum.add(slugKey);
  if (label) entry.alnum.add(normalizeSlug(label));
  work.set(slugKey, entry);
}

for (const p of presets) addApp(p.id, p.name);
for (const id of forgeIds) addApp(id, null);
for (const slug of LANDING) addApp(slug, null);
for (const slug of EXTRA_APPS) addApp(slug, null);

console.log(`unique apps to resolve: ${work.size}`);

await mkdir(OUT_DIR, { recursive: true });
await mkdir(path.dirname(REPORT_FILE), { recursive: true });

const matched = [];
const unmatched = [];

for (const entry of work.values()) {
  const r = resolve(entry.slugKey, [...entry.hyphen], [...entry.alnum], logos, simple, skills, n8nIcons);
  if (r) matched.push({ ...entry, ...r });
  else unmatched.push(entry.slugKey);
}

console.log(`matched: ${matched.length}, unmatched: ${unmatched.length}`);

const written = [];
const failed = [];

await pool(matched, async (m) => {
  if (m.col === 'n8n') {
    const ext = m.file.endsWith('.png') ? '.png' : '.svg';
    try {
      const buf = await readFile(m.file);
      await writeFile(path.join(OUT_DIR, `${m.slugKey}${ext}`), buf);
      written.push({ ...m, ext });
    } catch {
      failed.push(`${m.slugKey} (n8n:${m.name})`);
    }
    return;
  }
  const svg = await fetchSvg(m.col, m.name);
  if (!svg) { failed.push(`${m.slugKey} (${m.col}:${m.name})`); return; }
  await writeFile(path.join(OUT_DIR, `${m.slugKey}.svg`), svg, 'utf8');
  written.push({ ...m, ext: '.svg' });
});

written.sort((a, b) => a.slugKey.localeCompare(b.slugKey));

/* Landing sanity check */
const missingLanding = LANDING.filter((s) => !written.some((w) => w.slugKey === s));
if (missingLanding.length) {
  console.error(`FATAL: landing brands missing: ${missingLanding.join(', ')}`);
  process.exitCode = 1;
}

/* Generated TS map — keys are normalizeAppSlug()-compatible slugs. */
const lines = written.map((w) => `  ${JSON.stringify(w.slugKey)}: '/brand-logos/${w.slugKey}${w.ext}',`);
const ts = `/**
 * AUTO-GENERATED by scripts/fetch-brand-logos.mjs — DO NOT EDIT BY HAND.
 *
 * Normalized app slug → locally vendored SVG brand logo (scraped from the
 * Iconify \`logos\` collection and simpleicons.org). Keys match
 * normalizeAppSlug() output with any trailing "trigger" stripped.
 */

export const SLUG_BRAND_LOGOS: Record<string, string> = {
${lines.join('\n')}
};

export const SLUG_BRAND_LOGO_COUNT = ${written.length};
`;
await writeFile(GEN_FILE, ts, 'utf8');

await writeFile(
  REPORT_FILE,
  JSON.stringify(
    {
      presets: presets.length,
      forgeIds: forgeIds.length,
      uniqueApps: work.size,
      matched: matched.length,
      written: written.length,
      bySource: {
        logos: written.filter((w) => w.col === 'logos').length,
        simpleIcons: written.filter((w) => w.col === 'simple-icons').length,
        skillIcons: written.filter((w) => w.col === 'skill-icons').length,
        n8n: written.filter((w) => w.col === 'n8n').length,
      },
      downloadFailed: failed,
      unmatched: unmatched.sort(),
    },
    null,
    2,
  ),
  'utf8',
);

console.log(`written: ${written.length} SVGs → public/brand-logos/`);
console.log(`failed downloads: ${failed.length}`);
console.log(`report → scripts/output/brand-logos-report.json`);
