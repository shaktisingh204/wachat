export const meta = {
  name: 'sabcrm-reskin-rebrand',
  description: 'Black-&-white reskin + Twenty->SabCRM rebrand of the vendored Twenty engine (build-independent edits + static verification)',
  phases: [
    { title: 'Discover' },
    { title: 'Transform' },
    { title: 'Verify' },
  ],
};

const ENGINE = '/Users/harshkhandelwal/Downloads/sabnode/services/sabcrm';
const FRONT = ENGINE + '/packages/twenty-front';
const UI = ENGINE + '/packages/twenty-ui';
const EMAILS = ENGINE + '/packages/twenty-emails';
const SERVER = ENGINE + '/packages/twenty-server';
const BRAND_MAP = '/Users/harshkhandelwal/Downloads/sabnode/SABCRM_BRAND_MAP.md';

const SAFE_RULES = [
  'STRICT RULES (the engine cannot be compiled here, so edits must be provably non-breaking):',
  '- ONLY change USER-FACING display text where the product name "Twenty" appears -> "SabCRM". Company/org references -> "SabNode".',
  '- NEVER touch: import statements / module specifiers; anything matching twenty-ui|twenty-server|twenty-front|twenty-shared|twenty-emails|twenty-utils (package names, paths, "@ui/", "twenty-ui/..."); package.json "name"/dependency keys; GraphQL type/field names, *.graphql, generated/ files; *.entity.ts / *.dto.ts identifiers, class names, enum keys, variable names, object keys, i18n message IDs (only translated VALUES/msgstr may change, never the key/msgid); test snapshots (*.snap); URLs containing twenty.com (leave for a later pass).',
  '- Do NOT rename files or directories.',
  '- Preserve exact formatting/indentation; change only the brand word inside human-readable strings/JSX text/titles/descriptions/email copy.',
  '- If a given occurrence is ambiguous or risky, SKIP it and report it under "skipped".',
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
        required: ['path', 'occurrences', 'kind'],
        properties: {
          path: { type: 'string', description: 'absolute path' },
          occurrences: { type: 'number' },
          kind: { type: 'string', description: 'po | jsx-copy | string-literal | html | manifest | meta | email | readme | other' },
        },
      },
    },
    notes: { type: 'string' },
  },
};

const THEME_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['activeMechanism', 'filesToEdit', 'approach', 'keyShapes'],
  properties: {
    activeMechanism: { type: 'string' },
    filesToEdit: { type: 'array', items: { type: 'string' } },
    approach: { type: 'string' },
    keyShapes: { type: 'string' },
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
    'Investigate the B&W reskin mechanism for the vendored Twenty front at ' + UI + ' and ' + FRONT + '.\n' +
    'Determine which theme system is ACTUALLY used at runtime: the Emotion theme object (' + UI + '/src/theme/constants/ThemeLight.ts -> THEME_LIGHT, consumed via @emotion useTheme) vs the CSS-variable reader (' + UI + '/src/theme-constants/ThemeProvider.tsx + theme-light.css with --t-* vars). Check ' + FRONT + '/src/index.tsx imports and how App wires providers. It may be BOTH (mid-migration).\n' +
    'Read AccentLight.ts, AccentDark.ts, ColorsLight.ts, ColorsDark.ts and note the exact key shapes + value formats (hex, rgba, Radix indigoP3 color(display-p3 ...)).\n' +
    'Return a precise plan to make the WHOLE app black & white (neutralize accent + all color families to luminance-preserving grayscale), covering every active mechanism. Prefer editing the color SOURCE constants + (if the CSS-var path is active) a standalone luminance-grayscale transform over theme-light.css/theme-dark.css (a plain node script that runs on the current Node). Do NOT edit yet; produce the plan, exact file list, and key shapes.',
    { label: 'discover:theme', phase: 'Discover', schema: THEME_SCHEMA, agentType: 'Explore' },
  );
});

discoveryThunks.push(function () {
  return agent(
    'Find USER-FACING occurrences of the product name "Twenty" in i18n catalogs under ' + FRONT + ' (and ' + EMAILS + ', ' + UI + ' if any): *.po / *.pot files. Report files with how many translated VALUES (msgstr) contain "Twenty" (ignore msgid/keys). ' + SAFE_RULES + '\nReturn area="i18n".',
    { label: 'discover:i18n', phase: 'Discover', schema: DISCOVERY_SCHEMA, agentType: 'Explore' },
  );
});

discoveryThunks.push(function () {
  return agent(
    'Scan ' + FRONT + '/src/modules for USER-FACING "Twenty" brand strings (JSX text, titles, descriptions, placeholders, labels) — directories A through M alphabetically only. Use ripgrep. Classify each file. ' + SAFE_RULES + '\nReturn area="front-modules-am".',
    { label: 'discover:front-am', phase: 'Discover', schema: DISCOVERY_SCHEMA, agentType: 'Explore' },
  );
});

discoveryThunks.push(function () {
  return agent(
    'Scan ' + FRONT + '/src/modules (directories N through Z alphabetically) PLUS ' + FRONT + '/src/pages and ' + FRONT + '/src/components for USER-FACING "Twenty" brand strings. Use ripgrep. Classify each file. ' + SAFE_RULES + '\nReturn area="front-modules-nz".',
    { label: 'discover:front-nz', phase: 'Discover', schema: DISCOVERY_SCHEMA, agentType: 'Explore' },
  );
});

discoveryThunks.push(function () {
  return agent(
    'Scan ' + EMAILS + '/src for USER-FACING "Twenty" brand strings in email templates (sender names, headings, body copy, footers), INCLUDING the *.po catalog translated values. Use ripgrep. ' + SAFE_RULES + '\nReturn area="emails".',
    { label: 'discover:emails', phase: 'Discover', schema: DISCOVERY_SCHEMA, agentType: 'Explore' },
  );
});

discoveryThunks.push(function () {
  return agent(
    'Find static/brand surfaces under ' + FRONT + ': index.html, public/manifest.json and any *.webmanifest, <title>/meta tags, public/ html, and any user-facing app display name (NOT package.json "name"). Report "Twenty" occurrences to change to "SabCRM". ' + SAFE_RULES + '\nReturn area="static".',
    { label: 'discover:static', phase: 'Discover', schema: DISCOVERY_SCHEMA, agentType: 'Explore' },
  );
});

discoveryThunks.push(function () {
  return agent(
    'Scan ' + UI + '/src for USER-FACING "Twenty" display strings (component default labels, banners) AND ' + SERVER + '/src for user-facing "Twenty" in seed/standard-object default labels and outbound email/notification copy. Be conservative — server identifiers and entity names must NOT be touched. ' + SAFE_RULES + '\nReturn area="ui-server".',
    { label: 'discover:ui-server', phase: 'Discover', schema: DISCOVERY_SCHEMA, agentType: 'Explore' },
  );
});

const discovery = (await parallel(discoveryThunks)).filter(Boolean);
const themePlan = discovery.find(function (d) { return d && d.activeMechanism; }) || null;
const rebrandDiscoveries = discovery.filter(function (d) { return d && Array.isArray(d.files); });

function isThemeFile(p) {
  return /theme\/constants\/(Accent|Colors|MainColors|SecondaryColors|TransparentColors|Tag|SnackBar|Theme)(Light|Dark)?\.ts$/.test(p) ||
    /theme-constants\/theme-(light|dark)\.css$/.test(p) ||
    /theme-constants\/themeCssVariables\.ts$/.test(p);
}

const seen = new Set();
const rebrandFiles = [];
for (const d of rebrandDiscoveries) {
  const files = d.files || [];
  for (const f of files) {
    if (!f || !f.path) continue;
    if (isThemeFile(f.path)) continue;
    if (seen.has(f.path)) continue;
    seen.add(f.path);
    rebrandFiles.push(f);
  }
}

const MAX_REBRAND_FILES = 260;
let droppedNote = '';
let workFiles = rebrandFiles;
if (rebrandFiles.length > MAX_REBRAND_FILES) {
  workFiles = rebrandFiles.slice(0, MAX_REBRAND_FILES);
  droppedNote = 'NOTE: ' + (rebrandFiles.length - MAX_REBRAND_FILES) + ' rebrand files dropped from this run (cap ' + MAX_REBRAND_FILES + '); run again to finish.';
  log(droppedNote);
}
log('Discovery: ' + workFiles.length + ' rebrand files queued; theme plan ' + (themePlan ? 'ready' : 'MISSING') + '.');

const NUM_REBRAND_AGENTS = Math.min(12, Math.max(1, Math.ceil(workFiles.length / 18)));
const batches = [];
for (let i = 0; i < NUM_REBRAND_AGENTS; i++) batches.push([]);
workFiles.forEach(function (f, i) { batches[i % NUM_REBRAND_AGENTS].push(f.path); });
const rebrandBatches = batches.filter(function (b) { return b.length; });

// ---------------------------------------------------------------- TRANSFORM
phase('Transform');

const transformThunks = [];

transformThunks.push(function () {
  return agent(
    'Apply a full BLACK-&-WHITE reskin to the vendored Twenty front. Engine: ' + ENGINE + '.\n' +
    'Authoritative plan from investigation:\n' + (themePlan ? JSON.stringify(themePlan) : '(theme investigation missing — re-derive it yourself by reading the theme files before editing)') + '\n\n' +
    'Goal: neutralize the accent (Twenty blue/indigo) AND every named color family to LUMINANCE-PRESERVING grayscale, across EVERY active theme mechanism (Emotion theme object AND/OR the --t-* CSS variables). Keep backgrounds/text/border structure intact (remove only hue). Convert each color to gray via Rec.709 luma (0.2126R+0.7152G+0.0722B) and emit a neutral gray of the same lightness; handle hex, rgba(), and Radix color(display-p3 ...) forms.\n' +
    'If the CSS-variable path is active, write a SELF-CONTAINED node script (runs on the current Node — do NOT require Twenty build/toolchain) that rewrites color values in theme-light.css/theme-dark.css to grayscale, RUN it, and confirm via grep that no chromatic values remain. Also edit the TS color source constants (ColorsLight/Dark, AccentLight/Dark, etc.) to grayscale so the Emotion object matches, keeping exact key shapes (strict TS, no any).\n' +
    'Only touch theme/color files. Report exactly what changed.',
    { label: 'transform:theme', phase: 'Transform', schema: TRANSFORM_SCHEMA },
  );
});

rebrandBatches.forEach(function (batch, idx) {
  transformThunks.push(function () {
    return agent(
      'Rebrand pass ' + (idx + 1) + '/' + rebrandBatches.length + '. Edit ONLY these files (disjoint set — do not touch any other file):\n' + JSON.stringify(batch) + '\n\n' +
      'In each file, replace the USER-FACING product name "Twenty" with "SabCRM" (company/org references -> "SabNode"). For .po catalogs, change only translated VALUES (msgstr), never msgid/keys.\n' + SAFE_RULES + '\n' +
      'Report each file changed with replacement count, and anything skipped and why.',
      { label: 'transform:rebrand-' + (idx + 1), phase: 'Transform', schema: TRANSFORM_SCHEMA },
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
log('Transform: ' + totalChanged + ' files changed, ~' + totalReplacements + ' replacements.');

// ---------------------------------------------------------------- VERIFY
phase('Verify');

const changedPaths = [];
for (const t of transforms) {
  for (const f of (t.filesChanged || [])) changedPaths.push(f.path);
}

const verifyThunks = [];

verifyThunks.push(function () {
  return agent(
    'STATIC SAFETY CHECK on the vendored Twenty engine at ' + ENGINE + ' (it cannot be compiled here).\n' +
    'Confirm the rebrand did NOT break compilable code: grep the changed files and broadly for red flags introduced by the rebrand — altered import specifiers / module paths, renamed package names, "SabCRM-ui"/"sabcrm-server"-style identifier corruption, changed i18n msgid keys, edited GraphQL type names, modified *.entity.ts/*.dto.ts identifiers. Changed files: ' + JSON.stringify(changedPaths).slice(0, 6000) + '.\n' +
    'List any real breakage with file:line. Report ok=false if any identifier/import was wrongly changed.',
    { label: 'verify:safety', phase: 'Verify', schema: VERIFY_SCHEMA, agentType: 'Explore' },
  );
});

verifyThunks.push(function () {
  return agent(
    'Verify the BLACK-&-WHITE reskin at ' + ENGINE + '. Grep the theme color sources (ColorsLight/Dark.ts, AccentLight/Dark.ts) and theme-light.css/theme-dark.css for remaining CHROMATIC values (saturated hex, rgba with unequal channels, color(display-p3 ...) with hue). Report whether the app is now effectively grayscale and list any chromatic leftovers with file:line. ok=true only if essentially no hue remains in the theme.',
    { label: 'verify:theme', phase: 'Verify', schema: VERIFY_SCHEMA, agentType: 'Explore' },
  );
});

verifyThunks.push(function () {
  return agent(
    'Update the brand-map doc at ' + BRAND_MAP + ': fill in a concise summary table of what the rebrand pass changed (areas, file counts, replacement counts) and the B&W theme changes, marking applied items done. Base it on this data:\n' +
    'Transforms: ' + JSON.stringify(transforms).slice(0, 8000) + '\n' + droppedNote + '\n' +
    'Keep the existing "Do NOT rename" section. Report ok=true when the file is updated.',
    { label: 'verify:brandmap', phase: 'Verify', schema: VERIFY_SCHEMA },
  );
});

const verify = (await parallel(verifyThunks)).filter(Boolean);

return {
  discovery: { rebrandFilesFound: rebrandFiles.length, queued: workFiles.length, droppedNote: droppedNote, themePlanReady: !!themePlan },
  transform: { agents: transformThunks.length, filesChanged: totalChanged, replacements: totalReplacements },
  verify: verify,
  transforms: transforms,
};
