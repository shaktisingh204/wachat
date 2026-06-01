export const meta = {
  name: 'sabcrm-native-p1',
  description: 'SabCRM Phase 1 — native Mongo + SabNode-auth CRM foundation (data layer, gated actions, standard objects, record-index UI) with typecheck gate',
  phases: [
    { title: 'Discover' },
    { title: 'Build' },
    { title: 'UI' },
    { title: 'Verify' },
  ],
};

const ROOT = '/Users/harshkhandelwal/Downloads/sabnode';
const LIB = ROOT + '/src/lib/sabcrm';
const APP = ROOT + '/src/app/sabcrm';
const ACTIONS = ROOT + '/src/app/actions/sabcrm.actions.ts';
const COMP = ROOT + '/src/components/sabcrm';
const PLAN = ROOT + '/SABCRM_NATIVE_PLAN.md';

const RULES = [
  'This is the LIVE SabNode Next.js app — broken TypeScript breaks the whole app. Be production-grade.',
  '- READ neighbouring SabNode code first and MATCH its conventions exactly (mongo access, server actions, ActionResult, session/project/RBAC/plan gating, ZoruUI usage).',
  '- Strict TypeScript, no `any` (except the established `session.user as any` cast). Named exports. Server-only code uses `import "server-only"` or `"use server"` as appropriate.',
  '- MongoDB only. Tenant-scope every query by projectId; scope records by userId/workspace per SabNode convention.',
  '- Use ZoruUI (`@/components/zoruui`) for all UI; reuse `src/components/crm/*` where it fits. File inputs MUST use SabFiles (`@/components/sabfiles`).',
  '- Reuse existing wiring: RBAC keys in `src/lib/sabcrm/rbac-keys.ts`, plan `sabcrmPlanFeature`, `getCachedSession`/`getCachedProjects`, `ProjectProvider`, `RBACGuard`.',
  '- Edit ONLY your assigned file(s). Do not modify other modules.',
].join('\n');

// Shared contract every implementer builds to (keeps parallel work consistent).
const CONTRACT = [
  'SHARED CONTRACT (implement exactly these signatures so the pieces fit):',
  'types: reuse src/lib/sabcrm/types.ts (ObjectMetadata, FieldMetadata, CrmRecord, CrmRecordWithLabel, RecordQuery, RecordPage, ActionResult<T>).',
  'src/lib/sabcrm/db.ts (server-only): export async accessors returning typed Mongo collections from SabNode\'s existing Mongo client — sabcrmObjects(), sabcrmRecords(), sabcrmViews(), sabcrmActivities(), sabcrmFavorites(). Collection names: sabcrm_objects, sabcrm_records, sabcrm_views, sabcrm_activities, sabcrm_favorites. Also ensureSabcrmIndexes().',
  'src/lib/sabcrm/schema.ts: export STANDARD_OBJECTS: ObjectMetadata[] (Companies, People, Opportunities, Notes, Tasks, Activities — faithful to Twenty\'s standard fields/relations) and getStandardObject(slug).',
  'src/lib/sabcrm/objects.server.ts (server-only): listObjects(projectId), getObject(projectId, slug), ensureStandardObjects(projectId), addCustomField(projectId, slug, FieldMetadata), removeCustomField(projectId, slug, fieldKey). Standard objects come from STANDARD_OBJECTS merged with any persisted custom objects/fields.',
  'src/lib/sabcrm/records.server.ts (server-only): listRecords(projectId, RecordQuery)->RecordPage (filter/search/sort/paginate + resolve display label from object metadata), getRecord(projectId, id), createRecord(projectId, userId, object, data)->CrmRecord, updateRecord(projectId, id, patch)->CrmRecord, deleteRecord(projectId, id). Use ObjectId-safe string ids.',
  'src/lib/sabcrm/views.server.ts + activities.server.ts (server-only): basic CRUD for saved views and timeline activities (notes/tasks/comments).',
  'src/app/actions/sabcrm.actions.ts ("use server"): thin wrappers over the above. EACH action: getCachedSession (redirect/Error if none) -> resolve active projectId (param or first project) -> RBAC check via SabNode\'s server-side can()/effective-permissions using sabcrm:view|manage|admin -> plan check (sabcrmPlanFeature) -> call lib -> return ActionResult<T>. Export: listObjectsAction, listRecordsAction, getRecordAction, createRecordAction, updateRecordAction, deleteRecordAction, listViewsAction, saveViewAction, addCustomFieldAction.',
].join('\n');

const PLUMBING_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['topic', 'findings', 'files'],
  properties: {
    topic: { type: 'string' },
    findings: { type: 'string', description: 'concrete how-to incl. exact import paths + function names + a short usage snippet' },
    files: { type: 'array', items: { type: 'string' } },
  },
};

const OBJECT_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['slug', 'labelSingular', 'labelPlural', 'icon', 'fields', 'views'],
  properties: {
    slug: { type: 'string' },
    labelSingular: { type: 'string' },
    labelPlural: { type: 'string' },
    icon: { type: 'string' },
    fields: { type: 'array', items: {
      type: 'object', additionalProperties: true,
      required: ['key', 'label', 'type'],
      properties: {
        key: { type: 'string' }, label: { type: 'string' },
        type: { type: 'string', description: 'one of types.ts FieldType' },
        isLabel: { type: 'boolean' }, inTable: { type: 'boolean' }, required: { type: 'boolean' }, system: { type: 'boolean' },
        options: { type: 'array', items: { type: 'object', additionalProperties: true } },
        relation: { type: 'object', additionalProperties: true },
      },
    } },
    views: { type: 'array', items: { type: 'string' } },
    board: { type: 'object', additionalProperties: true },
  },
};

const IMPL_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['filesWritten', 'exportsProvided', 'notes'],
  properties: {
    filesWritten: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['path', 'purpose'], properties: { path: { type: 'string' }, purpose: { type: 'string' } } } },
    exportsProvided: { type: 'array', items: { type: 'string' } },
    notes: { type: 'string' },
  },
};

const VERIFY_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['ok', 'issues', 'summary'],
  properties: { ok: { type: 'boolean' }, issues: { type: 'array', items: { type: 'string' } }, summary: { type: 'string' } },
};

// ---------------------------------------------------------------- DISCOVER
phase('Discover');

const plumbingTopics = [
  ['mongo-access', 'How SabNode connects to MongoDB: the exact client/helper module + function to get a Db/collection (search src/lib for mongodb/getDb/clientPromise/getMongo). Give import path + a usage snippet a server module would use to get a typed collection.'],
  ['server-actions', 'The SabNode server-action convention: a representative `src/app/actions/*.actions.ts` (e.g. sabwa/crm). How they declare "use server", resolve the session + active project, return results. Show the ActionResult shape and an example action.'],
  ['rbac-plan', 'Server-side RBAC enforcement: how to compute effective permissions + `can(effective, key, "view"|"create"|...)` (src/lib/rbac.ts / rbac-server.ts), and how plan-gating is checked (src/lib/plans.ts, sabcrmPlanFeature). Give the exact calls an action should make to gate by sabcrm:view/manage/admin + plan.'],
  ['nav-shell', 'How a module registers in the SabNode app navigation/shell (ZoruHomeShell / app rail / sidebar / apps list). Find the file listing modules (e.g. src/components/zoruui/shell/zoru-apps.ts) and exactly how to add a "SabCRM" entry pointing to /sabcrm with an icon.'],
  ['crm-components', 'Inventory the reusable parts in src/components/crm/* for a record index table, filters, saved-views bar, detail shell, and quick-create dialog (entity-list-shell, entity-detail-shell, crm-bulky-grid, crm-filter-panel, SavedViewsBar, quick-create-dialog, entity-picker, BulkImportWizard). For the top ~8, give their prop signatures so new sabcrm screens can reuse them.'],
  ['verify-cmd', 'Determine how to typecheck this Next.js app: is node_modules installed? what is the tsconfig path-alias for @/ ? the exact command to type-check only (e.g. `npx tsc --noEmit -p tsconfig.json`) and whether it runs in this environment. Report the command verifiers should use.'],
  ['existing-sabcrm-crm-lib', 'Read src/lib/sabcrm/types.ts fully and inventory src/lib/crm/* — report what already exists that the new data layer should build on or reuse (conversion, dispatch, list-export, number-safety, etc.).'],
  ['sabfiles', 'How to use SabFiles for a FILE field value in a form (the picker components in @/components/sabfiles and what value they yield) so record FILE fields integrate correctly.'],
];

const discoveryThunks = [];
plumbingTopics.forEach(function (t) {
  discoveryThunks.push(function () {
    return agent(
      'SabNode integration recon for the native SabCRM module (app root ' + ROOT + '). Topic: ' + t[0] + '. ' + t[1] + ' Return concrete import paths + a short snippet. READ-ONLY.',
      { label: 'discover:' + t[0], phase: 'Discover', schema: PLUMBING_SCHEMA, agentType: 'Explore' },
    );
  });
});

// One agent per standard object — design faithful metadata (Twenty parity).
const STD_OBJECTS = [
  ['companies', 'Company', 'Twenty Companies object: name(label), domainName(LINK), address, employees(NUMBER), linkedinLink(LINK), xLink(LINK), annualRecurringRevenue(CURRENCY), idealCustomerProfile(BOOLEAN), accountOwner(RELATION->People or workspaceMember), and ONE_TO_MANY to people/opportunities.'],
  ['people', 'Person', 'Twenty People object: name (first/last), email(EMAIL), phone(PHONE), city, jobTitle, linkedinLink(LINK), xLink(LINK), avatar(FILE), company(RELATION MANY_TO_ONE -> companies).'],
  ['opportunities', 'Opportunity', 'Twenty Opportunities object: name(label), amount(CURRENCY), closeDate(DATE_TIME), stage(SELECT: NEW/SCREENING/MEETING/PROPOSAL/CUSTOMER), pointOfContact(RELATION->people), company(RELATION MANY_TO_ONE->companies). board view grouped by stage.'],
  ['notes', 'Note', 'Twenty Notes object: title(label), body(rich text/TEXT), createdBy. relations to companies/people/opportunities via activity targets (model as MANY_TO_ONE or multi-relation).'],
  ['tasks', 'Task', 'Twenty Tasks object: title(label), body(TEXT), status(SELECT: TODO/IN_PROGRESS/DONE), dueAt(DATE_TIME), assignee. board view grouped by status.'],
  ['activities', 'Activity', 'Generic activity/timeline object: type(SELECT: NOTE/TASK/CALL/MEETING/EMAIL), title(label), body(TEXT), happenedAt(DATE_TIME), targetObject + targetRecordId (relation to any record).'],
];
STD_OBJECTS.forEach(function (o) {
  discoveryThunks.push(function () {
    return agent(
      'Design the SabCRM standard object "' + o[0] + '" (' + o[1] + ') as an ObjectMetadata faithful to Twenty, using ONLY the FieldType union + shapes in ' + LIB + '/types.ts. ' + o[2] + ' Mark exactly one isLabel field, sensible inTable fields, and SELECT options with values+labels. Return the full object metadata.',
      { label: 'object:' + o[0], phase: 'Discover', schema: OBJECT_SCHEMA, agentType: 'Explore' },
    );
  });
});

const discovery = (await parallel(discoveryThunks)).filter(Boolean);
const plumbing = discovery.filter(function (d) { return d && d.topic; });
const objects = discovery.filter(function (d) { return d && d.slug; });
const plumbingStr = JSON.stringify(plumbing).slice(0, 12000);
const objectsStr = JSON.stringify(objects).slice(0, 12000);
const verifyCmdFinding = (plumbing.find(function (p) { return p.topic === 'verify-cmd'; }) || {}).findings || 'npx tsc --noEmit';
log('Discovery done: ' + plumbing.length + ' plumbing topics, ' + objects.length + ' standard objects.');

// ---------------------------------------------------------------- BUILD (data layer + actions)
phase('Build');

const buildThunks = [];

function buildAgent(label, file, task) {
  buildThunks.push(function () {
    return agent(
      'Implement ' + file + ' for the native SabCRM module (app root ' + ROOT + ').\n\n' + CONTRACT + '\n\nPLUMBING (use these exact paths/patterns):\n' + plumbingStr + '\n\nTASK: ' + task + '\n\n' + RULES,
      { label: label, phase: 'Build', schema: IMPL_SCHEMA },
    );
  });
}

buildAgent('build:db', 'src/lib/sabcrm/db.ts', 'Mongo collection accessors + ensureSabcrmIndexes() using SabNode\'s mongo helper from discovery. Typed to the types.ts shapes.');
buildAgent('build:schema', 'src/lib/sabcrm/schema.ts', 'Assemble STANDARD_OBJECTS: ObjectMetadata[] from these designed objects (validate against types.ts):\n' + objectsStr + '\nAlso export getStandardObject(slug).');
buildAgent('build:objects', 'src/lib/sabcrm/objects.server.ts', 'Object/field metadata layer: list/get objects (merge STANDARD_OBJECTS with persisted custom), ensureStandardObjects(projectId), add/remove custom fields.');
buildAgent('build:records', 'src/lib/sabcrm/records.server.ts', 'Generic record CRUD + query (filter/search/sort/paginate) + display-label resolution from object metadata. Mongo, projectId+userId scoped.');
buildAgent('build:views-activities', 'src/lib/sabcrm/views.server.ts and src/lib/sabcrm/activities.server.ts', 'Saved views CRUD and timeline activities CRUD (notes/tasks/comments).');
buildAgent('build:actions', 'src/app/actions/sabcrm.actions.ts', 'The "use server" gated wrappers per the contract (session + project + RBAC sabcrm:view/manage/admin + plan checks, returning ActionResult<T>).');

const builds = (await parallel(buildThunks)).filter(Boolean);
log('Build: data layer + actions written.');

// ---------------------------------------------------------------- UI
phase('UI');

const uiThunks = [];

function uiAgent(label, file, task) {
  uiThunks.push(function () {
    return agent(
      'Build ' + file + ' for the native SabCRM UI (app root ' + ROOT + ').\n\nServer actions available from src/app/actions/sabcrm.actions.ts: listObjectsAction, listRecordsAction, getRecordAction, createRecordAction, updateRecordAction, deleteRecordAction, listViewsAction, saveViewAction, addCustomFieldAction (all return ActionResult<T>). Record/object types in src/lib/sabcrm/types.ts.\n\nPLUMBING/reusable components:\n' + plumbingStr + '\n\nTASK: ' + task + '\n\n' + RULES,
      { label: label, phase: 'UI', schema: IMPL_SCHEMA },
    );
  });
}

uiAgent('ui:nav', 'the SabNode app nav registry (file identified in discovery, e.g. src/components/zoruui/shell/zoru-apps.ts)', 'ADD a "SabCRM" module entry pointing to /sabcrm with a suitable icon, additively (do not change other entries). If the registry is elsewhere, edit the correct file. This is the ONLY cross-module edit allowed.');
uiAgent('ui:overview', 'src/app/sabcrm/page.tsx', 'Replace the current iframe/fallback page with a native ZoruUI overview: list the standard objects as cards/links to /sabcrm/<slug>, with simple per-object record counts (via listRecordsAction total). Server component.');
uiAgent('ui:index', 'src/app/sabcrm/[objectSlug]/page.tsx', 'Record INDEX page: load the object metadata + a page of records via actions, render a ZoruUI table (reuse src/components/crm grid if it fits) with the object\'s inTable columns, search box, create button (opens create dialog), row click -> /sabcrm/<slug>/<id>. Handle empty/loading/RBAC-denied states.');
uiAgent('ui:detail', 'src/app/sabcrm/[objectSlug]/[recordId]/page.tsx', 'Record DETAIL page: header with display label, a fields panel rendering each field by type (inline-editable via updateRecordAction), and a simple activity/timeline placeholder. Reuse src/components/sabcrm/record-detail.tsx (see ui:components).');
uiAgent('ui:components', 'src/components/sabcrm/record-table.tsx, src/components/sabcrm/record-form-dialog.tsx, src/components/sabcrm/record-detail.tsx, src/components/sabcrm/field-renderer.tsx', 'Reusable client components in ZoruUI: a metadata-driven table, a create/edit dialog (field inputs per FieldType; FILE fields use SabFiles picker), a detail view, and a field renderer (read + edit) covering all FieldTypes (TEXT/NUMBER/CURRENCY/BOOLEAN/DATE/DATE_TIME/EMAIL/PHONE/LINK/SELECT/MULTI_SELECT/RATING/RELATION/FILE).');
uiAgent('ui:shell', 'src/components/sabcrm/sabcrm-shell.tsx', 'A light module shell (sidebar listing objects + header) wrapping the route bodies, consistent with ZoruUI; OR if /dashboard\'s ZoruHomeShell is the standard, make this a thin wrapper. Keep it minimal and ZoruUI-native.');

const uis = (await parallel(uiThunks)).filter(Boolean);
log('UI: routes + components written.');

// ---------------------------------------------------------------- VERIFY
phase('Verify');

const allWritten = [];
for (const r of builds.concat(uis)) {
  for (const f of (r.filesWritten || [])) allWritten.push(f.path);
}
const writtenStr = JSON.stringify(allWritten).slice(0, 6000);

const verifyThunks = [];

verifyThunks.push(function () {
  return agent(
    'TYPE-CHECK + FIX the SabCRM data layer + actions (app root ' + ROOT + '). Run the project typecheck (' + verifyCmdFinding + '). Focus on src/lib/sabcrm/* and src/app/actions/sabcrm.actions.ts. Fix any type errors, missing imports, or contract mismatches you introduced — make minimal, correct edits to those files only. Re-run until those files are clean (or report the residual errors precisely). ' + RULES,
    { label: 'verify:lib', phase: 'Verify', schema: VERIFY_SCHEMA },
  );
});

verifyThunks.push(function () {
  return agent(
    'TYPE-CHECK + FIX the SabCRM UI (app root ' + ROOT + '): src/app/sabcrm/** and src/components/sabcrm/**. Run the project typecheck (' + verifyCmdFinding + '). Fix type errors, server/client boundary issues ("use client" where hooks/handlers are used), missing imports, and action-call signature mismatches. Edit only sabcrm UI files. Re-run until clean or report residuals precisely. Written files: ' + writtenStr + '\n' + RULES,
    { label: 'verify:ui', phase: 'Verify', schema: VERIFY_SCHEMA },
  );
});

verifyThunks.push(function () {
  return agent(
    'INTEGRATION CHECK for native SabCRM (app root ' + ROOT + '): confirm (1) /sabcrm layout still guards via getCachedSession + RBACGuard; (2) the nav registry now has a SabCRM entry; (3) every server action gates by session+project+RBAC(sabcrm:*)+plan; (4) all imports across src/lib/sabcrm, src/app/sabcrm, src/components/sabcrm, src/app/actions/sabcrm.actions.ts resolve; (5) Mongo collection names are consistent (sabcrm_*). Report ok=false with specifics for anything missing. Do not rewrite working code; note fixes needed.',
    { label: 'verify:integration', phase: 'Verify', schema: VERIFY_SCHEMA, agentType: 'Explore' },
  );
});

verifyThunks.push(function () {
  return agent(
    'Update ' + PLAN + ': mark Phase 1 progress in the session log with what was built (files + the standard objects seeded) and the typecheck status. Keep all other sections intact. Report ok=true when saved.',
    { label: 'verify:docs', phase: 'Verify', schema: VERIFY_SCHEMA },
  );
});

const verify = (await parallel(verifyThunks)).filter(Boolean);

return {
  discovery: { plumbing: plumbing.length, objects: objects.map(function (o) { return o.slug; }) },
  build: { files: builds.flatMap(function (b) { return (b.filesWritten || []).map(function (f) { return f.path; }); }) },
  ui: { files: uis.flatMap(function (u) { return (u.filesWritten || []).map(function (f) { return f.path; }); }) },
  verify: verify,
};
