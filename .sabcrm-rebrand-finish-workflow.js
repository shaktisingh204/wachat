export const meta = {
  name: 'sabcrm-rebrand-finish',
  description: 'Finish Twenty->SabCRM rebrand on remaining files + app.twenty.com URL pass (build-independent + static verify)',
  phases: [
    { title: 'Discover' },
    { title: 'Transform' },
    { title: 'Verify' },
  ],
};

const ROOT = '/Users/harshkhandelwal/Downloads/sabnode';
const ENGINE = ROOT + '/services/sabcrm';
const FRONT = ENGINE + '/packages/twenty-front';
const UI = ENGINE + '/packages/twenty-ui';
const EMAILS = ENGINE + '/packages/twenty-emails';
const SERVER = ENGINE + '/packages/twenty-server';
const SHARED = ENGINE + '/packages/twenty-shared';
const BRAND_MAP = ROOT + '/SABCRM_BRAND_MAP.md';

const SAFE_RULES = [
  'STRICT RULES (the engine cannot be compiled here, so edits must be provably non-breaking):',
  '- Change USER-FACING display text where the product name "Twenty" appears -> "SabCRM"; company/org references -> "SabNode".',
  '- NEVER touch: import statements / module specifiers; anything matching twenty-ui|twenty-server|twenty-front|twenty-shared|twenty-emails|twenty-utils (package names, paths, "@ui/"); package.json "name"/dependency keys; GraphQL type/field names, *.graphql, generated/ files; *.entity.ts/*.dto.ts identifiers, class/enum/variable/object-key names; i18n msgid keys, #: source-path comments, and PO header lines like Last-Translator/Project-Id-Version (only translated msgstr VALUES may change); test snapshots (*.snap) and test fixtures whose exact strings are asserted.',
  '- Do NOT rename files or directories.',
  '- Preserve exact formatting/indentation.',
  '- If an occurrence is ambiguous or risky, SKIP it and report it.',
].join('\n');

const DISCOVERY_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['area', 'files', 'notes'],
  properties: {
    area: { type: 'string' },
    files: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['path', 'brandOccurrences', 'urlOccurrences'],
        properties: {
          path: { type: 'string', description: 'absolute path' },
          brandOccurrences: { type: 'number', description: 'user-facing "Twenty" display strings still present' },
          urlOccurrences: { type: 'number', description: 'twenty.com / app.twenty.com URL occurrences' },
        },
      },
    },
    notes: { type: 'string' },
  },
};

const URL_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['appUrl', 'marketingUrl', 'source'],
  properties: {
    appUrl: { type: 'string', description: 'canonical SabNode APP url to replace https://app.twenty.com (no trailing slash)' },
    marketingUrl: { type: 'string', description: 'canonical SabNode marketing url to replace https://twenty.com' },
    source: { type: 'string', description: 'where these were derived from, or "fallback" if invented' },
  },
};

const TRANSFORM_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['filesChanged', 'skipped', 'summary'],
  properties: {
    filesChanged: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['path', 'replacements'],
        properties: { path: { type: 'string' }, replacements: { type: 'number' } },
      },
    },
    skipped: { type: 'array', items: { type: 'string' } },
    summary: { type: 'string' },
  },
};

const VERIFY_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['ok', 'issues', 'summary'],
  properties: {
    ok: { type: 'boolean' },
    issues: { type: 'array', items: { type: 'string' } },
    summary: { type: 'string' },
  },
};

// ---------------------------------------------------------------- DISCOVER
phase('Discover');

const discoveryThunks = [];

discoveryThunks.push(function () {
  return agent(
    'Derive the canonical SabNode URLs from the main repo at ' + ROOT + ' (NOT the services/sabcrm subtree). Grep .env.example, src/, package.json, next config and any deploy docs for the production/app URL and marketing URL (look for keys like APP_URL, NEXT_PUBLIC_*_URL, NEXTAUTH_URL, AUTH_URL, BASE_URL, DOMAIN, or literal sabnode.com / app.sabnode.com references). ' +
    'Return the best APP url to replace https://app.twenty.com and the marketing url to replace https://twenty.com. If nothing concrete exists, return appUrl="https://app.sabnode.com" and marketingUrl="https://sabnode.com" with source="fallback".',
    { label: 'discover:urls', phase: 'Discover', schema: URL_SCHEMA, agentType: 'Explore' },
  );
});

discoveryThunks.push(function () {
  return agent(
    'In ' + FRONT + '/src (modules directories A-M, plus pages and components) find files that STILL contain USER-FACING "Twenty" display strings OR any twenty.com / app.twenty.com URL. Use ripgrep. For each file report brandOccurrences and urlOccurrences. ' + SAFE_RULES + '\nReturn area="front-am".',
    { label: 'discover:front-am', phase: 'Discover', schema: DISCOVERY_SCHEMA, agentType: 'Explore' },
  );
});

discoveryThunks.push(function () {
  return agent(
    'In ' + FRONT + '/src/modules (directories N-Z) find files that STILL contain USER-FACING "Twenty" display strings OR twenty.com / app.twenty.com URLs. Use ripgrep. Report brandOccurrences + urlOccurrences per file. ' + SAFE_RULES + '\nReturn area="front-nz".',
    { label: 'discover:front-nz', phase: 'Discover', schema: DISCOVERY_SCHEMA, agentType: 'Explore' },
  );
});

discoveryThunks.push(function () {
  return agent(
    'In ' + FRONT + '/src find the i18n catalogs (*.po) whose translated msgstr VALUES still contain "Twenty". Report each file with brandOccurrences (count of msgstr values, IGNORE msgid/#: comments/headers) and urlOccurrences. ' + SAFE_RULES + '\nReturn area="front-po".',
    { label: 'discover:front-po', phase: 'Discover', schema: DISCOVERY_SCHEMA, agentType: 'Explore' },
  );
});

discoveryThunks.push(function () {
  return agent(
    'In ' + EMAILS + '/src find email templates AND *.po catalogs that STILL contain USER-FACING "Twenty" OR twenty.com / app.twenty.com URLs (including the Logo.tsx image src and email body links). Use ripgrep. Report brandOccurrences + urlOccurrences per file (for .po only msgstr values). ' + SAFE_RULES + '\nReturn area="emails".',
    { label: 'discover:emails', phase: 'Discover', schema: DISCOVERY_SCHEMA, agentType: 'Explore' },
  );
});

discoveryThunks.push(function () {
  return agent(
    'In ' + UI + '/src and ' + SHARED + '/src find files with USER-FACING "Twenty" display strings OR twenty.com URLs (exclude theme/color files already reskinned, exclude identifiers). Report brandOccurrences + urlOccurrences. ' + SAFE_RULES + '\nReturn area="ui-shared".',
    { label: 'discover:ui-shared', phase: 'Discover', schema: DISCOVERY_SCHEMA, agentType: 'Explore' },
  );
});

discoveryThunks.push(function () {
  return agent(
    'In ' + SERVER + '/src find ONLY genuinely USER-FACING "Twenty" strings (default seed/standard-object labels shown in the UI, outbound email/notification copy, and twenty.com URLs). Be very conservative: server has ~493 "Twenty" hits but most are identifiers/types/comments which MUST NOT change. Report only safe display strings + URL occurrences. ' + SAFE_RULES + '\nReturn area="server".',
    { label: 'discover:server', phase: 'Discover', schema: DISCOVERY_SCHEMA, agentType: 'Explore' },
  );
});

const discovery = (await parallel(discoveryThunks)).filter(Boolean);

const urlPlan = discovery.find(function (d) { return d && d.appUrl; }) ||
  { appUrl: 'https://app.sabnode.com', marketingUrl: 'https://sabnode.com', source: 'fallback (no discovery result)' };
const fileDiscoveries = discovery.filter(function (d) { return d && Array.isArray(d.files); });

const seen = new Set();
const workFiles = [];
for (const d of fileDiscoveries) {
  for (const f of (d.files || [])) {
    if (!f || !f.path) continue;
    if (seen.has(f.path)) continue;
    const hasWork = (f.brandOccurrences || 0) > 0 || (f.urlOccurrences || 0) > 0;
    if (!hasWork) continue;
    seen.add(f.path);
    workFiles.push(f.path);
  }
}

const MAX_FILES = 300;
let droppedNote = '';
let queued = workFiles;
if (workFiles.length > MAX_FILES) {
  queued = workFiles.slice(0, MAX_FILES);
  droppedNote = 'NOTE: ' + (workFiles.length - MAX_FILES) + ' files dropped (cap ' + MAX_FILES + '); rerun to finish.';
  log(droppedNote);
}
log('Finish pass: ' + queued.length + ' files to process. URLs: app=' + urlPlan.appUrl + ' mkt=' + urlPlan.marketingUrl + ' (' + urlPlan.source + ').');

const NUM_AGENTS = Math.min(13, Math.max(1, Math.ceil(queued.length / 16)));
const batches = [];
for (let i = 0; i < NUM_AGENTS; i++) batches.push([]);
queued.forEach(function (p, i) { batches[i % NUM_AGENTS].push(p); });
const fileBatches = batches.filter(function (b) { return b.length; });

// ---------------------------------------------------------------- TRANSFORM
phase('Transform');

const transformThunks = [];
fileBatches.forEach(function (batch, idx) {
  transformThunks.push(function () {
    return agent(
      'Finish-rebrand pass ' + (idx + 1) + '/' + fileBatches.length + '. Edit ONLY these files (disjoint set — touch no other file):\n' + JSON.stringify(batch) + '\n\n' +
      'Do BOTH on each file:\n' +
      '1) Replace USER-FACING product name "Twenty" -> "SabCRM" (company/org -> "SabNode"). For .po files, change only translated msgstr VALUES.\n' +
      '2) URL swap: replace host "app.twenty.com" -> "' + urlPlan.appUrl.replace(/^https?:\/\//, '') + '" and bare "twenty.com" -> "' + urlPlan.marketingUrl.replace(/^https?:\/\//, '') + '" (keep scheme/path/query intact). Do NOT change twenty.com inside .po #: comments or PO header lines (Last-Translator etc.).\n' +
      SAFE_RULES + '\n' +
      'Report each file changed with total replacement count, and anything skipped and why.',
      { label: 'finish:' + (idx + 1), phase: 'Transform', schema: TRANSFORM_SCHEMA },
    );
  });
});

const transforms = (await parallel(transformThunks)).filter(Boolean);
let totalChanged = 0;
let totalReplacements = 0;
for (const t of transforms) {
  const fc = t.filesChanged || [];
  totalChanged += fc.length;
  for (const f of fc) totalReplacements += (f.replacements || 0);
}
log('Finish transform: ' + totalChanged + ' files changed, ~' + totalReplacements + ' replacements.');

// ---------------------------------------------------------------- VERIFY
phase('Verify');

const changedPaths = [];
for (const t of transforms) {
  for (const f of (t.filesChanged || [])) changedPaths.push(f.path);
}

const verifyThunks = [];

verifyThunks.push(function () {
  return agent(
    'STATIC SAFETY CHECK on ' + ENGINE + ' (cannot compile here). Confirm this finish-rebrand pass did NOT break code: grep for altered import specifiers/module paths, renamed package names, corrupted identifiers (SabCRM/SabNode appearing inside import paths or type/field names), changed i18n msgid keys, edited GraphQL types, or modified entity/dto identifiers. Report ok=false with file:line for any real breakage. Changed files sample: ' + JSON.stringify(changedPaths).slice(0, 6000),
    { label: 'verify:safety', phase: 'Verify', schema: VERIFY_SCHEMA, agentType: 'Explore' },
  );
});

verifyThunks.push(function () {
  return agent(
    'Residual check on ' + ENGINE + '. Count remaining USER-FACING "Twenty" display strings and remaining "app.twenty.com"/"twenty.com" URLs (excluding identifiers, imports, GraphQL types, msgid keys, #: comments, PO headers, and node_modules). Report the residual counts by package and whether the rebrand is effectively complete. ok=true if only identifier/structural "Twenty" remains.',
    { label: 'verify:residual', phase: 'Verify', schema: VERIFY_SCHEMA, agentType: 'Explore' },
  );
});

verifyThunks.push(function () {
  return agent(
    'Append a "Pass 2 (finish rebrand + URL swap)" section to ' + BRAND_MAP + ' summarizing this run: files changed, replacement count, the URL mapping used (app.twenty.com -> ' + urlPlan.appUrl + ', twenty.com -> ' + urlPlan.marketingUrl + ', source: ' + urlPlan.source + '), and any skipped items. Do not alter the existing sections or the "Do NOT rename" list. Base it on: ' + JSON.stringify(transforms).slice(0, 8000) + '\n' + droppedNote + '\nReport ok=true when saved.',
    { label: 'verify:brandmap', phase: 'Verify', schema: VERIFY_SCHEMA },
  );
});

const verify = (await parallel(verifyThunks)).filter(Boolean);

return {
  urls: urlPlan,
  discovery: { filesFound: workFiles.length, queued: queued.length, droppedNote: droppedNote },
  transform: { agents: transformThunks.length, filesChanged: totalChanged, replacements: totalReplacements },
  verify: verify,
};
