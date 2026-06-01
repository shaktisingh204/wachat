export const meta = {
  name: 'sabcrm-native-p2p3',
  description: 'SabCRM Phase 2 (records UX: detail inline-edit, kanban, saved views/filters, relations, command-menu) + Phase 3 (activities/timeline, notes/tasks/comments, SabFiles, assignment, notifications) — native Mongo + SabNode, typecheck-gated',
  phases: [
    { title: 'Discover' },
    { title: 'P2-Data' },
    { title: 'P2-UI' },
    { title: 'P3-Data' },
    { title: 'P3-UI' },
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
  'This is the LIVE SabNode Next.js app — broken TypeScript breaks everything. Production-grade only.',
  '- READ the existing SabCRM code first (src/lib/sabcrm/*, src/app/actions/sabcrm.actions.ts, src/app/sabcrm/**, src/components/sabcrm/**) and EXTEND it; do not duplicate or rewrite working pieces.',
  '- Strict TypeScript, no `any` (except the sanctioned `session.user as ...` cast). Named exports. server-only lib uses `import "server-only"`; actions file is "use server"; client components need "use client".',
  '- MongoDB only, tenant-scoped by projectId (records also userId/workspace per existing convention). Reuse db.ts accessors + ensureSabcrmIndexes.',
  '- ALL UI in ZoruUI (`@/components/zoruui`), black-&-white; reuse src/components/crm/* + the P1 sabcrm components. FILE fields/attachments MUST use SabFiles (`@/components/sabfiles`).',
  '- Every new server action gates: getCachedSession -> resolve projectId -> RBAC (sabcrm:view read / sabcrm:manage write / sabcrm:admin model) -> plan (sabcrmPlanFeature) -> Mongo -> ActionResult<T>. Reuse the existing gate() helper in sabcrm.actions.ts.',
  '- Edit ONLY your assigned file(s). Additive. Do not touch other modules (except the one sanctioned command-menu registry edit).',
].join('\n');

const RECON_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['topic', 'findings', 'symbols'],
  properties: {
    topic: { type: 'string' },
    findings: { type: 'string', description: 'concrete: exact exports/signatures that exist + import paths + how to extend' },
    symbols: { type: 'array', items: { type: 'string' }, description: 'existing exported names the new code can call' },
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

const reconTopics = [
  ['lib-records', 'Read ' + LIB + '/records.server.ts fully. List exact exported function signatures (listRecords/getRecord/create/update/delete + any query type). How would I add: per-field filter operators, multi-sort, board grouping (group records by a SELECT field), and relation resolution (fetch related records by relationKey)?'],
  ['lib-objects-schema', 'Read ' + LIB + '/objects.server.ts, schema.ts, types.ts fully. Exact ObjectMetadata/FieldMetadata/FieldRelation/BoardConfig shapes, the standard objects + their relation fields, and getObject/listObjects signatures. How relations are declared (MANY_TO_ONE/ONE_TO_MANY, targetObject, labelField).'],
  ['lib-views-activities', 'Read ' + LIB + '/views.server.ts and activities.server.ts fully. Exact SavedView/CrmActivity shapes + CRUD signatures. What fields a view stores (filters/sorts/visibleFields/board) and what an activity stores.'],
  ['actions', 'Read ' + ACTIONS + ' fully. List every exported action + its signature, and the internal gate() helper signature (how to call it for read vs write vs admin). Show the exact pattern to add a new gated action.'],
  ['ui-components', 'Read src/components/sabcrm/* fully (record-table, record-form-dialog, record-detail, field-renderer, sabcrm-shell). List their props and what they already render, so P2/P3 components compose with them.'],
  ['ui-routes', 'Read src/app/sabcrm/page.tsx, [objectSlug]/page.tsx, [objectSlug]/[recordId]/page.tsx fully. How they fetch (which actions), server-vs-client split, and where a board toggle / detail tabs / timeline should slot in.'],
  ['zoru-inventory', 'From @/components/zoruui index, list the primitives available for: tabs, drawer/sheet, dropdown menu, command palette, popover, select, date picker, badge/tag, avatar, toast. Give exact import names for kanban-ish building blocks (no kanban primitive exists — confirm what to compose from).'],
  ['command-menu', 'Find SabNodes global command-menu / ⌘K registry (search src/components and src/app for command palette, action-search-bar, ZoruActionSearchBar, command). Identify the EXACT file + pattern to register SabCRM quick actions/navigation entries (open object, create record, search records). If none global exists, say so and propose a self-contained /sabcrm command palette instead.'],
  ['notifications', 'Read src/lib/notifications/* (esp. crm.ts) and any notification action/util. Exact function to emit an in-app notification to a user, and the payload shape. How assignment/mention notifications are emitted elsewhere.'],
  ['audit', 'Read src/lib/audit-log.ts. Exact function + payload to record an audit entry (actor, action, entity, projectId). So record/activity mutations can be audited.'],
  ['sabfiles', 'Read @/components/sabfiles barrel. Exact components/props for picking a file and the value yielded (id/url/name), for attachment fields on activities/records.'],
  ['project-context', 'How client components read the active projectId (src/context/project-context useProject hook) so client P2/P3 components pass projectId to actions consistently.'],
];

const discoveryThunks = [];
reconTopics.forEach(function (t) {
  discoveryThunks.push(function () {
    return agent(
      'SabCRM P2/P3 recon (app root ' + ROOT + '). Topic: ' + t[0] + '. ' + t[1] + ' READ-ONLY; return exact symbols + a short usage snippet.',
      { label: 'recon:' + t[0], phase: 'Discover', schema: RECON_SCHEMA, agentType: 'Explore' },
    );
  });
});

const discovery = (await parallel(discoveryThunks)).filter(Boolean);
const recon = {};
for (const d of discovery) { if (d && d.topic) recon[d.topic] = d; }
const reconStr = JSON.stringify(discovery).slice(0, 16000);
log('Discovery: ' + discovery.length + ' recon topics mapped.');

function impl(label, phaseName, file, task) {
  return function () {
    return agent(
      'Implement/extend ' + file + ' for SabCRM (app root ' + ROOT + ').\n\nRECON (use these exact existing symbols/paths):\n' + reconStr + '\n\nTASK: ' + task + '\n\n' + RULES,
      { label: label, phase: phaseName, schema: IMPL_SCHEMA },
    );
  };
}

// ---------------------------------------------------------------- P2 DATA
phase('P2-Data');
const p2data = (await parallel([
  impl('p2:records-query', 'P2-Data', LIB + '/records.server.ts', 'EXTEND record query: add typed filter operators (eq/neq/contains/gt/gte/lt/lte/in/isEmpty) per field, multi-key sort, and a groupRecords(projectId, object, groupByFieldKey) helper returning records bucketed by a SELECT field value (for kanban). Keep existing exports working.'),
  impl('p2:relations', 'P2-Data', LIB + '/relations.server.ts', 'NEW: relation resolution helpers. resolveRelation(projectId, record, FieldMetadata) -> related record(s) with display labels; listRelatedRecords(projectId, targetObject, byRelationKey, recordId) for ONE_TO_MANY back-references; searchRecordsForPicker(projectId, object, q) for relation pickers. Use objects.server + records.server.'),
  impl('p2:views', 'P2-Data', LIB + '/views.server.ts', 'EXTEND saved views: ensure a view stores {name, object, filters[], sorts[], visibleFieldKeys[], viewType: "table"|"board", boardGroupByKey?}; add setDefaultView + listViews(object) + duplicate. Keep existing exports.'),
  impl('p2:actions', 'P2-Data', ACTIONS, 'ADD gated actions (reuse gate()): listRecordsAction must accept the new filter/sort/group options; add groupRecordsAction, listRelatedRecordsAction, resolveRelationAction, searchRecordsForPickerAction, and view actions (listViewsAction/saveViewAction/deleteViewAction/setDefaultViewAction). Additive — keep existing action signatures backward-compatible.'),
]).then(function (r) { return r.filter(Boolean); }));
log('P2-Data done.');

// ---------------------------------------------------------------- P2 UI
phase('P2-UI');
const p2ui = (await parallel([
  impl('p2ui:detail-inline', 'P2-UI', COMP + '/record-detail.tsx', 'UPGRADE detail to full inline-edit: each field editable in place via field-renderer edit mode -> updateRecordAction with optimistic UI + toast; group fields into sections; show created/updated meta. Keep it a client component.'),
  impl('p2ui:detail-tabs', 'P2-UI', APP + '/[objectSlug]/[recordId]/page.tsx', 'Add tabbed detail: "Details" (record-detail) + "Related" (related-records panels) + "Activity" (timeline placeholder slot that P3 fills). Server component fetches record + object + related; uses ZoruUI Tabs.'),
  impl('p2ui:related-panel', 'P2-UI', COMP + '/related-records-panel.tsx', 'NEW client component: given a record + its relation fields, render related records (via listRelatedRecordsAction/resolveRelationAction) as compact lists with links to /sabcrm/<target>/<id> and an "add relation" picker using searchRecordsForPickerAction.'),
  impl('p2ui:relation-field', 'P2-UI', COMP + '/relation-input.tsx', 'NEW client relation picker input (used by field-renderer for RELATION fields): async search via searchRecordsForPickerAction, single (MANY_TO_ONE) or multi select, shows display labels, yields the related record id(s).'),
  impl('p2ui:field-renderer', 'P2-UI', COMP + '/field-renderer.tsx', 'EXTEND field-renderer: wire RELATION fields to relation-input.tsx (read shows label + link, edit shows picker). Keep all other FieldType handling intact.'),
  impl('p2ui:kanban', 'P2-UI', COMP + '/record-board.tsx', 'NEW client kanban board: columns from a SELECT field options (via object metadata), cards from groupRecordsAction; drag-card-to-column updates that field via updateRecordAction (optimistic). Compose from ZoruUI primitives (no native kanban). Used by objects whose views include "board" (opportunities by stage, tasks by status).'),
  impl('p2ui:filters', 'P2-UI', COMP + '/view-toolbar.tsx', 'NEW client toolbar above the index: search, per-field filter chips (operators from p2 query), sort control, table/board view toggle, and saved-views menu (list/apply/save/delete/setDefault via view actions).'),
  impl('p2ui:index-page', 'P2-UI', APP + '/[objectSlug]/page.tsx', 'UPGRADE index: render view-toolbar + switch between record-table and record-board per active view; apply filters/sorts/group; keep create dialog + RBAC-denied/empty/loading states.'),
  impl('p2ui:command-menu', 'P2-UI', COMP + '/sabcrm-command.tsx', 'NEW: a SabCRM command palette (or register into the global ⌘K registry if recon found one — prefer that). Entries: jump to each object, "Create <object>", and global record search via searchRecordsForPickerAction across objects. Wire it into sabcrm-shell.'),
]).then(function (r) { return r.filter(Boolean); }));
log('P2-UI done.');

// ---------------------------------------------------------------- P3 DATA
phase('P3-Data');
const p3data = (await parallel([
  impl('p3:activities', 'P3-Data', LIB + '/activities.server.ts', 'EXTEND timeline: createActivity (type NOTE/TASK/CALL/MEETING/EMAIL/COMMENT, body, targetObject, targetRecordId, authorId, attachments[] of SabFiles refs, mentions[]), listActivities(projectId, targetObject, targetRecordId, paginated), updateActivity, deleteActivity, and task helpers (setTaskStatus, assignTask). Tenant-scoped.'),
  impl('p3:assignment', 'P3-Data', LIB + '/assignment.server.ts', 'NEW: assign a record/task to a workspace member (store assigneeId on record.data or activity), reassign, listMyAssignments(projectId, userId). Emit notification + audit on assignment (use the notification + audit functions from recon).'),
  impl('p3:actions', 'P3-Data', ACTIONS, 'ADD gated actions (reuse gate(), additive): createActivityAction, listActivitiesAction, updateActivityAction, deleteActivityAction, setTaskStatusAction, assignRecordAction, listMyAssignmentsAction, addCommentAction. Writes require sabcrm:manage; emit notifications/audit where appropriate.'),
]).then(function (r) { return r.filter(Boolean); }));
log('P3-Data done.');

// ---------------------------------------------------------------- P3 UI
phase('P3-UI');
const p3ui = (await parallel([
  impl('p3ui:timeline', 'P3-UI', COMP + '/activity-timeline.tsx', 'NEW client timeline for a record: lists activities (notes/tasks/calls/comments) newest-first with author avatar + relative time, grouped by day; loads via listActivitiesAction; optimistic add.'),
  impl('p3ui:composer', 'P3-UI', COMP + '/activity-composer.tsx', 'NEW client composer: add a note/comment (rich text or textarea), create a task (with dueAt + assignee), log a call/meeting; attach files via SabFiles picker; @-mention members. Calls createActivityAction/addCommentAction.'),
  impl('p3ui:detail-activity-tab', 'P3-UI', APP + '/[objectSlug]/[recordId]/page.tsx', 'FILL the "Activity" tab from P2 with activity-timeline + activity-composer for this record. Keep Details/Related tabs intact (additive edit).'),
  impl('p3ui:tasks-inbox', 'P3-UI', APP + '/tasks/page.tsx', 'NEW "My Tasks/Assignments" page: list current user assignments via listMyAssignmentsAction, group by status, inline status change (setTaskStatusAction) + open the source record. Guarded route under /sabcrm/tasks.'),
  impl('p3ui:assignment-control', 'P3-UI', COMP + '/assignment-control.tsx', 'NEW client assignee picker (reuse src/components/crm/assignment-control.tsx if compatible): pick a workspace member, calls assignRecordAction, shows avatar; used in detail + board cards.'),
  impl('p3ui:notifications-bridge', 'P3-UI', COMP + '/sabcrm-notify.ts', 'NEW small client helper that surfaces assignment/mention results as ZoruUI toasts after actions; thin, no new global state. Document where deeper notification-center integration would hook in.'),
]).then(function (r) { return r.filter(Boolean); }));
log('P3-UI done.');

// ---------------------------------------------------------------- VERIFY
phase('Verify');

const allFiles = [];
for (const r of p2data.concat(p2ui, p3data, p3ui)) {
  for (const f of (r.filesWritten || [])) allFiles.push(f.path);
}
const TYPECHECK = 'cd ' + ROOT + ' && NODE_OPTIONS="--max-old-space-size=8192" npx tsc --noEmit';

// Loop-until-clean: up to 3 fix rounds, scoped to sabcrm files.
let cleanReport = null;
let round = 0;
while (round < 3) {
  round++;
  const fix = await agent(
    'TYPE-CHECK + FIX SabCRM scope (round ' + round + '). Run: `' + TYPECHECK + '`. Consider ONLY errors whose file path contains "sabcrm" (src/lib/sabcrm, src/app/sabcrm, src/components/sabcrm, src/app/actions/sabcrm.actions.ts). IGNORE the ~10 pre-existing errors in worksuite/crm-*.actions.types.ts (NOT ours). Fix every sabcrm-scope error with minimal correct edits (server/client boundary, imports, action signatures, types). Re-run until sabcrm scope is clean. Report ok=true ONLY if 0 sabcrm-scope errors remain, else list them. ' + RULES,
    { label: 'verify:typecheck-' + round, phase: 'Verify', schema: VERIFY_SCHEMA },
  );
  cleanReport = fix;
  if (fix && fix.ok) break;
  log('Typecheck round ' + round + ': ' + (fix ? (fix.issues || []).length : '?') + ' sabcrm issues remaining.');
}

const audits = (await parallel([
  function () { return agent(
    'INTEGRATION AUDIT (read-only) of SabCRM P2/P3 (app root ' + ROOT + '): confirm (1) every new action in sabcrm.actions.ts is gated session+project+RBAC+plan; (2) all new client components carry "use client" and call actions correctly; (3) relation/board/timeline data flows resolve (imports + action names match); (4) Mongo queries stay projectId-scoped; (5) FILE/attachment inputs use SabFiles, not raw URLs; (6) the /sabcrm/tasks route is covered by the RBAC route registry (sabcrm:view). Report ok=false with file:line for any gap.',
    { label: 'verify:integration', phase: 'Verify', schema: VERIFY_SCHEMA, agentType: 'Explore' }); },
  function () { return agent(
    'RBAC ROUTE COVERAGE: confirm src/config/dashboard-config.ts sabcrmMenuItems + src/lib/rbac-server.ts allMenuItems cover the new /sabcrm/tasks (and any new /sabcrm/* sub-routes) so getRequiredPermissionForPath returns sabcrm:view for them. If a new sub-route is uncovered, ADD it to sabcrmMenuItems (additive). Report what you changed.',
    { label: 'verify:rbac-routes', phase: 'Verify', schema: VERIFY_SCHEMA }); },
  function () { return agent(
    'Update ' + PLAN + ' session log: add a P2 + P3 row listing what was built (files + features) and the final sabcrm-scope typecheck status. Keep all other sections intact. ok=true when saved.',
    { label: 'verify:docs', phase: 'Verify', schema: VERIFY_SCHEMA }); },
]).then(function (r) { return r.filter(Boolean); }));

return {
  discovery: discovery.length,
  p2: { data: p2data.length, ui: p2ui.length },
  p3: { data: p3data.length, ui: p3ui.length },
  typecheck: cleanReport,
  audits: audits,
  files: allFiles,
};
