export const meta = {
  name: 'sabcrm-complete',
  description: 'Finish rebrand across all packages + M3 SabNode integration (RBAC, plan-gating, guarded layout, SSO scaffold)',
  phases: [
    { title: 'Discover' },
    { title: 'Transform' },
    { title: 'Verify' },
  ],
};

const ROOT = '/Users/harshkhandelwal/Downloads/sabnode';
const ENGINE = ROOT + '/services/sabcrm';
const PKGS = ENGINE + '/packages';
const BRAND_MAP = ROOT + '/SABCRM_BRAND_MAP.md';

const APP_URL = 'app.sabnode.com';
const MKT_URL = 'sabnode.com';
const DOCS_URL = 'docs.sabnode.com';

const SAFE_RULES = [
  'STRICT RULES (the engine cannot be compiled here; edits must be provably non-breaking):',
  '- Change USER-FACING display text "Twenty" -> "SabCRM"; company/org -> "SabNode".',
  '- URL swap: host "app.twenty.com" -> "' + APP_URL + '", "docs.twenty.com" -> "' + DOCS_URL + '", bare "twenty.com" -> "' + MKT_URL + '"; email addresses like contact@twenty.com -> contact@' + MKT_URL + '. Keep scheme/path/query intact.',
  '- NEVER touch: import statements / module specifiers; package names matching twenty-ui|twenty-server|twenty-front|twenty-shared|twenty-emails|twenty-utils|twenty-website|twenty-apps|twenty-sdk (and "@ui/"); package.json "name"/dependency keys; GraphQL type/field names, *.graphql, generated/ dirs; *.entity.ts/*.dto.ts identifiers, class/enum/variable/object-key names; i18n msgid keys, #: comments, PO header lines (Project-Id-Version, Last-Translator); *.snap snapshots and asserted test-fixture literals.',
  '- For .po files change only translated msgstr VALUES.',
  '- Do NOT rename files/dirs. Preserve formatting. Skip ambiguous/risky cases and report them.',
].join('\n');

const M3_RULES = [
  'SABNODE-SIDE RULES (this IS the live SabNode app — a broken edit breaks the whole app):',
  '- READ each target file FULLY before editing; match the EXISTING pattern exactly.',
  '- Make ADDITIVE changes only; do NOT modify or remove existing entries/keys.',
  '- Follow the SabWa precedent (src/lib/sabwa/*, src/app/sabwa/layout.tsx) as the reference pattern.',
  '- No new deps. Keep TypeScript strict-clean (no any). Named exports.',
].join('\n');

const DISCOVERY_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['area', 'files', 'notes'],
  properties: {
    area: { type: 'string' },
    files: { type: 'array', items: {
      type: 'object', additionalProperties: false,
      required: ['path', 'brandOccurrences', 'urlOccurrences'],
      properties: { path: { type: 'string' }, brandOccurrences: { type: 'number' }, urlOccurrences: { type: 'number' } },
    } },
    notes: { type: 'string' },
  },
};

const RECON_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['rbac', 'plans', 'layout', 'sso', 'notes'],
  properties: {
    rbac: { type: 'string', description: 'exact file(s) + pattern for registering a module RBAC key (e.g. src/lib/permission-modules.ts, src/lib/definitions.ts) — how sabwa keys are enumerated' },
    plans: { type: 'string', description: 'exact file + pattern for plan-gating a module (src/lib/plans.ts feature matrix)' },
    layout: { type: 'string', description: 'exact pattern for a guarded module layout (RBACGuard, session/project providers) from src/app/sabwa/layout.tsx' },
    sso: { type: 'string', description: 'how a SabNode session could mint a login token for the Twenty engine (any existing Twenty auth endpoint for loginToken / workspace member auth), and what the SabNode-side handoff should call' },
    notes: { type: 'string' },
  },
};

const TRANSFORM_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['filesChanged', 'skipped', 'summary'],
  properties: {
    filesChanged: { type: 'array', items: {
      type: 'object', additionalProperties: false,
      required: ['path', 'replacements'],
      properties: { path: { type: 'string' }, replacements: { type: 'number' } },
    } },
    skipped: { type: 'array', items: { type: 'string' } },
    summary: { type: 'string' },
  },
};

const VERIFY_SCHEMA = {
  type: 'object', additionalProperties: false,
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

// Engine rebrand residual discovery, one agent per package group.
const PKG_GROUPS = [
  { area: 'front', glob: PKGS + '/twenty-front/src' },
  { area: 'emails', glob: PKGS + '/twenty-emails/src' },
  { area: 'server', glob: PKGS + '/twenty-server/src' },
  { area: 'ui-shared', glob: PKGS + '/twenty-ui/src ' + PKGS + '/twenty-shared/src' },
  { area: 'website-apps-sdk', glob: PKGS + '/twenty-website/src ' + PKGS + '/twenty-apps ' + PKGS + '/twenty-sdk' },
];
PKG_GROUPS.forEach(function (g) {
  discoveryThunks.push(function () {
    return agent(
      'In ' + g.glob + ' find files STILL containing USER-FACING "Twenty" display strings OR twenty.com/app.twenty.com/docs.twenty.com URLs (incl. contact@twenty.com style emails). Use ripgrep. For each file report brandOccurrences and urlOccurrences. For ' + g.area + ', be careful per the rules. IMPORTANT: exclude pure identifier/type/comment hits and node_modules. ' + SAFE_RULES + '\nReturn area="' + g.area + '".',
      { label: 'discover:' + g.area, phase: 'Discover', schema: DISCOVERY_SCHEMA, agentType: 'Explore' },
    );
  });
});

// M3 integration recon (read-only) on the SabNode side.
discoveryThunks.push(function () {
  return agent(
    'Map the SabNode integration points for wiring the /sabcrm module (the live Next.js app at ' + ROOT + ', NOT services/sabcrm). Find the EXACT files + patterns for: ' +
    '(1) registering a module RBAC permission key — how SabWa keys in src/lib/sabwa/rbac-keys.ts are enumerated into src/lib/permission-modules.ts and the GlobalRolePermissions type in src/lib/definitions.ts; ' +
    '(2) plan-gating a module via src/lib/plans.ts (feature matrix per tier); ' +
    '(3) the guarded layout pattern in src/app/sabwa/layout.tsx (RBACGuard, getCachedSession, ProjectProvider); ' +
    '(4) any existing Twenty engine auth path to mint a login/access token for a workspace member (look in services/sabcrm/packages/twenty-server/src/engine/core-modules/auth for loginToken / token endpoints) so SabNode can SSO-handoff into the embedded SPA. ' +
    'Return concrete file paths and the exact additive edits needed.',
    { label: 'discover:m3-recon', phase: 'Discover', schema: RECON_SCHEMA, agentType: 'Explore' },
  );
});

const discovery = (await parallel(discoveryThunks)).filter(Boolean);
const recon = discovery.find(function (d) { return d && d.rbac; }) || null;
const fileDiscoveries = discovery.filter(function (d) { return d && Array.isArray(d.files); });

const seen = new Set();
const workFiles = [];
for (const d of fileDiscoveries) {
  for (const f of (d.files || [])) {
    if (!f || !f.path) continue;
    if (seen.has(f.path)) continue;
    if (((f.brandOccurrences || 0) + (f.urlOccurrences || 0)) <= 0) continue;
    seen.add(f.path);
    workFiles.push(f.path);
  }
}

const MAX_FILES = 320;
let droppedNote = '';
let queued = workFiles;
if (workFiles.length > MAX_FILES) {
  queued = workFiles.slice(0, MAX_FILES);
  droppedNote = 'NOTE: ' + (workFiles.length - MAX_FILES) + ' files dropped (cap ' + MAX_FILES + '); rerun to finish.';
  log(droppedNote);
}
log('Complete pass: ' + queued.length + ' engine files to rebrand; M3 recon ' + (recon ? 'ready' : 'MISSING') + '.');

const NUM_AGENTS = Math.min(16, Math.max(1, Math.ceil(queued.length / 16)));
const batches = [];
for (let i = 0; i < NUM_AGENTS; i++) batches.push([]);
queued.forEach(function (p, i) { batches[i % NUM_AGENTS].push(p); });
const fileBatches = batches.filter(function (b) { return b.length; });

// ---------------------------------------------------------------- TRANSFORM
phase('Transform');

const transformThunks = [];

// Engine rebrand finish (disjoint batches).
fileBatches.forEach(function (batch, idx) {
  transformThunks.push(function () {
    return agent(
      'Complete-rebrand batch ' + (idx + 1) + '/' + fileBatches.length + '. Edit ONLY these files (disjoint — touch no other file):\n' + JSON.stringify(batch) + '\n\n' +
      'On each file do BOTH: (1) replace user-facing "Twenty"->"SabCRM" (org->"SabNode"); (2) swap twenty.com URLs/emails per the rules.\n' + SAFE_RULES + '\n' +
      'Report each file changed with replacement count, plus anything skipped and why.',
      { label: 'rebrand:' + (idx + 1), phase: 'Transform', schema: TRANSFORM_SCHEMA },
    );
  });
});

const reconStr = recon ? JSON.stringify(recon) : '(recon missing — re-derive by reading the SabNode files yourself before editing)';

// M3a — RBAC registration (SabNode registry files).
transformThunks.push(function () {
  return agent(
    'Wire the SabCRM module RBAC keys into the SabNode registry (live app at ' + ROOT + '). Keys already defined in src/lib/sabcrm/rbac-keys.ts (sabcrm:view/manage/admin). Using this recon:\n' + reconStr + '\n' +
    'Add SabCRM entries additively to the central permission registry + GlobalRolePermissions type, EXACTLY mirroring how SabWa keys are registered. Touch ONLY the registry/type files (e.g. src/lib/permission-modules.ts, src/lib/definitions.ts). Do not alter SabWa or other modules.\n' + M3_RULES + '\n' +
    'Report files changed.',
    { label: 'm3:rbac', phase: 'Transform', schema: TRANSFORM_SCHEMA },
  );
});

// M3b — plan-gating + guarded layout.
transformThunks.push(function () {
  return agent(
    'Wire plan-gating + a guarded layout for /sabcrm in the SabNode app at ' + ROOT + '. Using this recon:\n' + reconStr + '\n' +
    '(1) Add a "sabcrm" feature entry to the plan matrix in src/lib/plans.ts additively (mirror an existing module like sabwa). ' +
    '(2) Replace the placeholder src/app/sabcrm/layout.tsx with a guarded layout mirroring src/app/sabwa/layout.tsx: getCachedSession redirect, onboarding/project checks, RBACGuard, ProjectProvider, keep the .zoruui scope and the existing iframe page. Do NOT add a SabWa-specific session provider; keep it minimal for an embedded SPA. ' +
    'Touch ONLY src/lib/plans.ts and src/app/sabcrm/layout.tsx.\n' + M3_RULES + '\nReport files changed.',
    { label: 'm3:plan-layout', phase: 'Transform', schema: TRANSFORM_SCHEMA },
  );
});

// M3c — SSO handoff scaffold.
transformThunks.push(function () {
  return agent(
    'Scaffold the SabNode->SabCRM SSO handoff in src/lib/sabcrm/ (app at ' + ROOT + '). Using this recon:\n' + reconStr + '\n' +
    'Create src/lib/sabcrm/sso.ts (server-only) exporting a function that, given the current SabNode session/user, returns a handoff URL for the embedded Twenty SPA — calling the engine via the existing engine-client.ts to mint a login/access token for the corresponding workspace member. Where the engine contract is not yet known/confirmed, leave a clearly-marked TODO documenting the exact engine endpoint/payload needed (do NOT invent a working secret). Also export a typed result. Do NOT modify engine-client.ts beyond adding a focused helper if needed. ' + M3_RULES + '\nReport files changed and the documented engine contract.',
    { label: 'm3:sso', phase: 'Transform', schema: TRANSFORM_SCHEMA },
  );
});

const transforms = (await parallel(transformThunks)).filter(Boolean);
let totalChanged = 0;
let totalReplacements = 0;
for (const t of transforms) {
  const fc = t.filesChanged || [];
  totalChanged += fc.length;
  for (const f of fc) totalReplacements += (f.replacements || 0);
}
log('Transform: ' + totalChanged + ' files changed, ~' + totalReplacements + ' replacements.');

// ---------------------------------------------------------------- VERIFY
phase('Verify');

const verifyThunks = [];

verifyThunks.push(function () {
  return agent(
    'STATIC SAFETY CHECK on the engine at ' + ENGINE + ' (cannot compile here). Confirm the rebrand did not break code: no altered imports/module paths, package names, GraphQL types, entity/dto identifiers, or i18n msgid keys. Report ok=false with file:line for any real breakage.',
    { label: 'verify:engine-safety', phase: 'Verify', schema: VERIFY_SCHEMA, agentType: 'Explore' },
  );
});

verifyThunks.push(function () {
  return agent(
    'Residual brand check on ' + ENGINE + '. Report remaining USER-FACING "Twenty" strings and twenty.com URLs by package (exclude identifiers/imports/types/msgid/#:comments/PO-headers/snapshots/node_modules). State whether the rebrand is effectively complete for the runtime packages (twenty-front/ui/emails/server/shared). ok=true if only structural/identifier "Twenty" remains in those.',
    { label: 'verify:residual', phase: 'Verify', schema: VERIFY_SCHEMA, agentType: 'Explore' },
  );
});

verifyThunks.push(function () {
  return agent(
    'STATIC CHECK of the SabNode-side M3 edits (live app at ' + ROOT + ', NOT services/sabcrm). For the changed files (src/lib/permission-modules.ts, src/lib/definitions.ts, src/lib/plans.ts, src/app/sabcrm/layout.tsx, src/lib/sabcrm/sso.ts): run `npx tsc --noEmit` scoped if feasible, OR carefully read each to confirm: valid TS, imports resolve, additive-only (no existing entries changed), follows the SabWa pattern, no `any`. If tsc is too heavy, do a focused syntactic/type review and grep that existing module entries are intact. Report ok=false with specifics if anything looks broken.',
    { label: 'verify:sabnode-m3', phase: 'Verify', schema: VERIFY_SCHEMA, agentType: 'Explore' },
  );
});

verifyThunks.push(function () {
  return agent(
    'Append a "Pass 3 (complete rebrand + M3 integration)" section to ' + BRAND_MAP + ' summarizing this run (engine files changed + replacements, packages covered, and the M3 SabNode wiring: RBAC keys registered, plan entry, guarded layout, SSO scaffold + documented engine contract). Do NOT alter existing sections or the "Do NOT rename" list. Base it on: ' + JSON.stringify(transforms).slice(0, 9000) + '\n' + droppedNote + '\nReport ok=true when saved.',
    { label: 'verify:brandmap', phase: 'Verify', schema: VERIFY_SCHEMA },
  );
});

const verify = (await parallel(verifyThunks)).filter(Boolean);

return {
  discovery: { engineFilesFound: workFiles.length, queued: queued.length, droppedNote: droppedNote, reconReady: !!recon },
  transform: { agents: transformThunks.length, filesChanged: totalChanged, replacements: totalReplacements },
  verify: verify,
};
