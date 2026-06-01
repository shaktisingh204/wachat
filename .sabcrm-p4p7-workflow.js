export const meta = {
  name: 'sabcrm-p4-p7',
  description: 'SabCRM P4 (metadata admin / runtime custom objects+fields), P5 (production hardening), P6 (dashboards/analytics/reporting), P7 (automation/API/integrations + e2e + cleanup) — native Mongo + SabNode, typecheck-gated, per-task model selection',
  phases: [
    { title: 'Discover' },
    { title: 'P4' },
    { title: 'P5' },
    { title: 'P6' },
    { title: 'P7' },
    { title: 'Verify' },
  ],
};

const ROOT = '/Users/harshkhandelwal/Downloads/sabnode';
const LIB = ROOT + '/src/lib/sabcrm';
const APP = ROOT + '/src/app/sabcrm';
const ACTIONS = ROOT + '/src/app/actions/sabcrm.actions.ts';
const COMP = ROOT + '/src/components/sabcrm';
const PLAN = ROOT + '/SABCRM_NATIVE_PLAN.md';
const TYPECHECK = 'cd ' + ROOT + ' && NODE_OPTIONS="--max-old-space-size=8192" npx tsc --noEmit';

const RULES = [
  'LIVE SabNode Next.js app — broken TypeScript breaks everything. Production-grade only.',
  '- READ existing SabCRM code first (src/lib/sabcrm/*, src/app/actions/sabcrm.actions.ts, src/app/sabcrm/**, src/components/sabcrm/**) and EXTEND it; never duplicate/rewrite working pieces.',
  '- Strict TS, no `any` (except sanctioned session casts). Named exports. server-only libs use `import "server-only"`; client components need "use client".',
  '- MongoDB only, tenant-scoped by projectId (records also userId/workspace). Reuse db.ts accessors + ensureSabcrmIndexes.',
  '- ALL UI in ZoruUI (@/components/zoruui), black-&-white. Reuse src/components/crm/* + existing sabcrm components. File inputs MUST use SabFiles (@/components/sabfiles) — never raw URLs.',
  '- Reuse the existing gate() in sabcrm.actions.ts for any action (session->project->RBAC sabcrm:view/manage/admin->plan->Mongo->ActionResult<T>).',
  '- EDIT ONLY YOUR ASSIGNED FILE(S). Do not touch files owned by other agents. Additive edits only on existing shared files.',
].join('\n');

const RECON_SCHEMA = { type: 'object', additionalProperties: false, required: ['topic', 'findings', 'symbols'], properties: { topic: { type: 'string' }, findings: { type: 'string' }, symbols: { type: 'array', items: { type: 'string' } } } };
const IMPL_SCHEMA = { type: 'object', additionalProperties: false, required: ['filesWritten', 'exportsProvided', 'notes'], properties: { filesWritten: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['path', 'purpose'], properties: { path: { type: 'string' }, purpose: { type: 'string' } } } }, exportsProvided: { type: 'array', items: { type: 'string' } }, notes: { type: 'string' } } };
const VERIFY_SCHEMA = { type: 'object', additionalProperties: false, required: ['ok', 'issues', 'summary'], properties: { ok: { type: 'boolean' }, issues: { type: 'array', items: { type: 'string' } }, summary: { type: 'string' } } };

// ---------------------------------------------------------------- DISCOVER
phase('Discover');

const reconTopics = [
  ['objects-engine', 'opus', 'Read ' + LIB + '/objects.server.ts, schema.ts, types.ts, db.ts fully. Exact current object/field metadata CRUD + storage shape. What is needed to support RUNTIME custom objects + custom fields + relations created by users (create/update/delete object, add/reorder/remove field, define a relation between two objects, validate against existing records). Note constraints: standard objects are seeded, custom live in sabcrm_objects per project.'],
  ['records-actions', 'sonnet', 'Read ' + ACTIONS + ' + records/views/activities/relations/assignment.server.ts. List every exported action + the gate() signature (read/create/edit/admin mapping). Show the exact additive pattern to add new gated actions.'],
  ['plans-limits', 'opus', 'Read src/lib/plans.ts (sabcrmPlanFeature + how feature limits/credits/caps are modeled elsewhere) and any usage-metering/credit helper (src/lib/billing/*, credits). How would SabCRM enforce per-plan limits (e.g. max records, max custom objects) at the action layer? Give exact functions to check/decrement.'],
  ['audit', 'sonnet', 'Read src/lib/audit-log.ts. Exact function + payload to record an audit entry; how other modules call it on create/update/delete.'],
  ['notifications', 'sonnet', 'Read src/lib/notifications/*. Exact function + payload to emit in-app notification; how a digest/feed is produced if any.'],
  ['charts', 'sonnet', 'From @/components/zoruui, list chart primitives (ChartContainer/ChartTooltip/recharts wrappers) + StatCard + any KPI/stat components and their props, for building dashboards.'],
  ['bulk-import-export', 'sonnet', 'Read src/components/crm/BulkImportWizard.tsx + src/lib/bulk-import/* + src/lib/crm-list-export.ts. Their props/exports so SabCRM can wire CSV/XLSX import+export for records.'],
  ['api-keys-webhooks', 'opus', 'Find how SabNode issues API keys + handles webhooks for other modules (search src/lib/api-platform/*, sabwa api-keys/webhooks, route handlers under src/app/api/*). The exact pattern for a public REST route handler with key auth + a webhook dispatch util, so SabCRM can expose records via REST + emit webhooks.'],
  ['route-handlers', 'sonnet', 'How API route handlers are structured in this app (src/app/api/**/route.ts), auth middleware, and response conventions. Give a template for a new gated /api/sabcrm/* route.'],
  ['e2e', 'sonnet', 'How tests run in this repo (jest/playwright config, scripts in package.json, existing *.test.ts/spec). The command + location to add a SabCRM smoke test. If e2e infra is absent, say so and propose lightweight unit smoke tests for the server libs.'],
  ['rbac-routes', 'sonnet', 'Read src/config/dashboard-config.ts (sabcrmMenuItems) + src/lib/rbac-server.ts (allMenuItems, getRequiredPermissionForPath). Exact additive way to register new /sabcrm/* sub-routes (settings, dashboards, reports) with the right permissionKey (view vs admin).'],
  ['project-context', 'sonnet', 'src/context/project-context useProject hook: how client components get activeProjectId, sessionUser, effectivePermissions, members/roster (if any). Exact names.'],
];

const discoveryThunks = [];
reconTopics.forEach(function (t) {
  discoveryThunks.push(function () {
    return agent(
      'SabCRM P4-P7 recon (app root ' + ROOT + '). Topic: ' + t[0] + '. ' + t[2] + ' READ-ONLY. Return exact symbols/paths + a short snippet.',
      { label: 'recon:' + t[0], phase: 'Discover', schema: RECON_SCHEMA, agentType: 'Explore', model: t[1] },
    );
  });
});
const discovery = (await parallel(discoveryThunks)).filter(Boolean);
const reconStr = JSON.stringify(discovery).slice(0, 18000);
log('Discovery: ' + discovery.length + ' topics.');

function impl(label, phaseName, model, file, task) {
  return function () {
    return agent(
      'Implement/extend ' + file + ' for SabCRM (app root ' + ROOT + ').\n\nRECON (use these exact existing symbols/paths):\n' + reconStr + '\n\nTASK: ' + task + '\n\n' + RULES,
      { label: label, phase: phaseName, schema: IMPL_SCHEMA, model: model },
    );
  };
}
// A single serialized actions-agent per phase (only writer of sabcrm.actions.ts in that phase).
function actionsAgent(label, phaseName, task) {
  return agent(
    'EXTEND ' + ACTIONS + ' (the ONLY agent editing this file in phase ' + phaseName + '). Additive, reuse gate(). ' + task + '\n\nRECON:\n' + reconStr + '\n\n' + RULES,
    { label: label, phase: phaseName, schema: IMPL_SCHEMA, model: 'sonnet' },
  );
}

// ================================================================ P4 — metadata admin / runtime custom objects+fields
phase('P4');
const p4data = (await parallel([
  impl('p4:objects-engine', 'P4', 'opus', LIB + '/objects.server.ts', 'EXTEND to a full runtime metadata engine (additive): createCustomObject(projectId, ObjectMetadata), updateObject(projectId, slug, patch), deleteCustomObject(projectId, slug) (guard: refuse if records exist unless force), addField/updateField/removeField/reorderFields, and createRelation(projectId, fromSlug, fieldKey, FieldRelation) with reciprocal back-reference. Validate slugs unique per project; standard objects immutable except adding custom fields. Keep existing exports.'),
  impl('p4:migrations', 'P4', 'opus', LIB + '/metadata-migrations.server.ts', 'NEW: when a field is removed/retyped on an object with existing records, provide safe data-migration helpers (drop key / coerce type / set default) operating on sabcrm_records for that projectId+object. Used by objects-engine on field delete/retype.'),
  impl('p4:members', 'P4', 'sonnet', LIB + '/members.server.ts', 'NEW: list workspace members + their SabCRM roles for the active project (source from SabNode user/project membership found in recon), for assignee pickers + a members settings page. Read-only listing; do not duplicate RBAC.'),
  impl('p4:import-export', 'P4', 'sonnet', LIB + '/import-export.server.ts', 'NEW: server helpers to import records from parsed rows (map columns->fields, validate by field type, bulk insert tenant-scoped) and export an object\'s records to a serialisable rows array for CSV/XLSX (reuse crm-list-export per recon).'),
])).filter(Boolean);
const p4actions = await actionsAgent('p4:actions', 'P4', 'Add gated actions: createCustomObjectAction/updateObjectAction/deleteCustomObjectAction (admin), addFieldAction/updateFieldAction/removeFieldAction/reorderFieldsAction (admin), createRelationAction (admin), listMembersAction (view), importRecordsAction/exportRecordsAction (manage). Wire audit on object/field mutations.');
const p4ui = (await parallel([
  impl('p4ui:settings-home', 'P4', 'sonnet', APP + '/settings/page.tsx', 'NEW settings hub page (guarded sabcrm:admin): links to Data Model, Members, Views, Import/Export. ZoruUI.'),
  impl('p4ui:object-editor', 'P4', 'opus', APP + '/settings/data-model/page.tsx', 'NEW data-model admin: list objects, create custom object, open an object to manage fields. Client interactivity via a child component. Calls object/field actions. This is the runtime metadata-engine UI.'),
  impl('p4ui:object-editor-comp', 'P4', 'sonnet', COMP + '/object-editor.tsx', 'NEW client component: create/edit object (label/plural/icon/slug), list its fields with add/edit/remove/reorder, and a relation builder (pick target object + cardinality). Uses P4 actions optimistically.'),
  impl('p4ui:field-editor', 'P4', 'sonnet', COMP + '/field-editor.tsx', 'NEW client field editor dialog: name/label/type (all FieldType), options for SELECT/MULTI_SELECT, required/isLabel/inTable flags, relation target for RELATION. Validates and calls addField/updateField actions.'),
  impl('p4ui:members-page', 'P4', 'sonnet', APP + '/settings/members/page.tsx', 'NEW members settings page (guarded): list members + roles via listMembersAction; show how RBAC keys map to abilities (read-only, points to SabNode role admin).'),
  impl('p4ui:views-mgmt', 'P4', 'sonnet', APP + '/settings/views/page.tsx', 'NEW saved-views management page: list/rename/delete/set-default views per object via existing view actions.'),
  impl('p4ui:import', 'P4', 'sonnet', COMP + '/import-dialog.tsx', 'NEW client import dialog: upload CSV/XLSX via SabFiles, map columns to fields, preview, call importRecordsAction. Reuse BulkImportWizard if compatible.'),
  impl('p4ui:export', 'P4', 'haiku', COMP + '/export-button.tsx', 'NEW small client export button: calls exportRecordsAction and downloads CSV. Trivial.'),
])).filter(Boolean);
log('P4 done.');

// ================================================================ P5 — production hardening
phase('P5');
const p5data = (await parallel([
  impl('p5:indexes', 'P5', 'sonnet', LIB + '/db.ts', 'EXTEND ensureSabcrmIndexes: add compound indexes for common queries (projectId+object, projectId+object+createdAt, text index on label fields, projectId+object+data.<relationKey>, activities by target, assignments by assignee). Idempotent. Keep existing accessors.'),
  impl('p5:plan-limits', 'P5', 'opus', LIB + '/limits.server.ts', 'NEW: enforce per-plan SabCRM limits using the plan/credit helpers from recon — e.g. assertWithinRecordLimit(projectId), assertWithinCustomObjectLimit(projectId). Returns/throws so actions can fail closed with a clear error. Define sane default caps per plan tier.'),
  impl('p5:audit-coverage', 'P5', 'sonnet', LIB + '/audit.server.ts', 'NEW thin wrapper around src/lib/audit-log so every record/object/activity mutation logs a consistent SabCRM audit entry (actor, action, object, recordId, projectId). Export logSabcrmAudit().'),
  impl('p5:seed', 'P5', 'sonnet', LIB + '/seed.server.ts', 'NEW: ensureProjectSeeded(projectId) — idempotently ensureStandardObjects + ensureSabcrmIndexes; safe to call on first /sabcrm load. Plus a script-style export for a one-off backfill across projects.'),
])).filter(Boolean);
const p5actions = await actionsAgent('p5:actions', 'P5', 'Harden existing actions additively: call ensureProjectSeeded on read entrypoints; enforce limits.server checks before create/createCustomObject; route all mutations through logSabcrmAudit. Do NOT change action signatures — wrap internals.');
const p5ui = (await parallel([
  impl('p5ui:loading', 'P5', 'haiku', APP + '/loading.tsx', 'NEW route loading.tsx with ZoruUI Skeleton matching the overview/index layout. Trivial.'),
  impl('p5ui:error', 'P5', 'haiku', APP + '/error.tsx', 'NEW "use client" route error boundary with ZoruUI EmptyState + retry. Trivial.'),
  impl('p5ui:obj-loading', 'P5', 'haiku', APP + '/[objectSlug]/loading.tsx', 'NEW skeleton for the record index. Trivial.'),
  impl('p5ui:obj-error', 'P5', 'haiku', APP + '/[objectSlug]/error.tsx', 'NEW "use client" error boundary for the object route. Trivial.'),
  impl('p5ui:empty-states', 'P5', 'haiku', COMP + '/empty-states.tsx', 'NEW reusable ZoruUI empty/zero-state components (no records, no objects, no results) for reuse across pages. Trivial.'),
  impl('p5ui:optimistic-table', 'P5', 'sonnet', COMP + '/record-table.tsx', 'HARDEN (additive): optimistic row delete/update with rollback-on-error + toast; keyboard a11y (row focus, Enter to open); ARIA roles on the table. Keep existing API.'),
  impl('p5ui:optimistic-board', 'P5', 'sonnet', COMP + '/record-board.tsx', 'HARDEN: optimistic drag-move with rollback-on-error + toast; aria-grabbed/dnd a11y; keyboard move fallback. Keep existing API.'),
  impl('p5ui:a11y-form', 'P5', 'sonnet', COMP + '/record-form-dialog.tsx', 'HARDEN: full labels/aria-describedby on fields, focus trap, error summary, disabled-while-submitting; keep API.'),
  impl('p5ui:a11y-detail', 'P5', 'sonnet', COMP + '/record-detail.tsx', 'HARDEN: inline-edit a11y (aria-live save status, escape-to-cancel), error states; keep API.'),
])).filter(Boolean);
log('P5 done.');

// ================================================================ P6 — dashboards / analytics / reporting
phase('P6');
const p6data = (await parallel([
  impl('p6:analytics', 'P6', 'opus', LIB + '/analytics.server.ts', 'NEW: aggregation helpers over sabcrm_records via Mongo aggregation, tenant-scoped: countByField(object, fieldKey) (e.g. opportunities by stage), sumByField (e.g. pipeline amount by stage), timeSeries(object, dateField, interval), recordTotals per object. Efficient $group pipelines.'),
  impl('p6:reports', 'P6', 'sonnet', LIB + '/reports.server.ts', 'NEW: saved reports (definition = object + metric + groupBy + filters + chartType) CRUD in a sabcrm_reports collection, tenant-scoped + run a report -> data series via analytics.server.'),
  impl('p6:kpis', 'P6', 'sonnet', LIB + '/kpis.server.ts', 'NEW: dashboard KPIs (total records per object, open opportunities + pipeline value, tasks due today/overdue, new this week). Composed from analytics.'),
  impl('p6:activity-feed', 'P6', 'sonnet', LIB + '/feed.server.ts', 'NEW: project activity feed/digest from sabcrm_activities (recent across all records), paginated, tenant-scoped.'),
])).filter(Boolean);
const p6actions = await actionsAgent('p6:actions', 'P6', 'Add gated read actions (view): getKpisAction, runAnalyticsAction(spec), listReportsAction/saveReportAction/deleteReportAction (save=manage), getActivityFeedAction. Reuse gate().');
const p6ui = (await parallel([
  impl('p6ui:dashboard', 'P6', 'sonnet', APP + '/dashboard/page.tsx', 'NEW SabCRM dashboard route (guarded sabcrm:view): KPI stat cards + a few default charts (opportunities by stage, pipeline value, tasks status) + recent activity feed. Server component fetching via actions; charts via a client child.'),
  impl('p6ui:overview-widgets', 'P6', 'sonnet', APP + '/page.tsx', 'UPGRADE overview (additive): add a KPI strip (getKpisAction) above the object cards. Keep existing object-cards grid.'),
  impl('p6ui:kpi-cards', 'P6', 'haiku', COMP + '/kpi-cards.tsx', 'NEW client KPI stat-card row using ZoruUI StatCard from a KPIs payload. Mostly presentational.'),
  impl('p6ui:chart-bar', 'P6', 'sonnet', COMP + '/charts/bar-chart.tsx', 'NEW client bar chart (ZoruUI Chart/recharts wrapper) for countByField/sumByField series. B&W palette.'),
  impl('p6ui:chart-line', 'P6', 'sonnet', COMP + '/charts/line-chart.tsx', 'NEW client line/time-series chart for timeSeries data. B&W palette.'),
  impl('p6ui:chart-donut', 'P6', 'sonnet', COMP + '/charts/donut-chart.tsx', 'NEW client donut/pie for distribution (e.g. by stage). B&W palette.'),
  impl('p6ui:report-builder', 'P6', 'sonnet', APP + '/reports/page.tsx', 'NEW reports route (guarded): list saved reports, a builder (pick object/metric/groupBy/filter/chart), run + render via the chart components, save via saveReportAction.'),
  impl('p6ui:report-builder-comp', 'P6', 'sonnet', COMP + '/report-builder.tsx', 'NEW client report builder component used by the reports page (form + live preview chart).'),
  impl('p6ui:activity-feed', 'P6', 'haiku', COMP + '/activity-feed.tsx', 'NEW client recent-activity feed list from getActivityFeedAction. Mostly presentational.'),
])).filter(Boolean);
log('P6 done.');

// ================================================================ P7 — automation / API / integrations + e2e + cleanup
phase('P7');
const p7data = (await parallel([
  impl('p7:webhooks', 'P7', 'opus', LIB + '/webhooks.server.ts', 'NEW: webhook subscriptions per project (sabcrm_webhooks: url, events[], secret) CRUD + dispatchWebhook(projectId, event, payload) with HMAC signature + best-effort delivery. Events: record.created/updated/deleted, activity.created. Tenant-scoped.'),
  impl('p7:apikeys', 'P7', 'opus', LIB + '/apikeys.server.ts', 'NEW: SabCRM API keys (reuse SabNode api-platform from recon if present; else sabcrm_api_keys with hashed key) — issue/list/revoke + verifyApiKey(req)->{projectId} for the public REST routes. Tenant-scoped, hashed at rest.'),
  impl('p7:automation', 'P7', 'sonnet', LIB + '/automation.server.ts', 'NEW: simple automation rules (sabcrm_automations: when event + condition -> action: create task / send notification / call webhook). evaluateAutomations(projectId, event, record) invoked from record/activity mutations. Keep minimal + safe.'),
  impl('p7:hooks-wire', 'P7', 'sonnet', LIB + '/events.server.ts', 'NEW: a single emitSabcrmEvent(projectId, event, payload) that fans out to dispatchWebhook + evaluateAutomations + notifications, so mutations have one call. Document where records/activities should call it (do NOT edit those files here; the actions agent wires the call).'),
])).filter(Boolean);
const p7actions = await actionsAgent('p7:actions', 'P7', 'Add gated actions: webhook CRUD (admin), apikey issue/list/revoke (admin), automation CRUD (admin). AND additively call emitSabcrmEvent on create/update/delete record + create activity inside the existing actions. Keep signatures stable.');
const p7ui = (await parallel([
  impl('p7ui:api-route-records', 'P7', 'opus', APP.replace('/sabcrm', '') + '/api/sabcrm/[objectSlug]/route.ts', 'NEW public REST route handler (GET list / POST create) for an object, authed via verifyApiKey -> projectId, returning JSON; reuse records.server. Follow the app route-handler convention from recon. (Path: src/app/api/sabcrm/[objectSlug]/route.ts)'),
  impl('p7ui:api-route-record', 'P7', 'opus', APP.replace('/sabcrm', '') + '/api/sabcrm/[objectSlug]/[recordId]/route.ts', 'NEW REST route (GET/PATCH/DELETE) for a single record, api-key authed. (Path: src/app/api/sabcrm/[objectSlug]/[recordId]/route.ts)'),
  impl('p7ui:settings-api', 'P7', 'sonnet', APP + '/settings/api/page.tsx', 'NEW API settings page (guarded admin): issue/list/revoke API keys, show base URL + example curl; manage webhooks (url/events) via actions.'),
  impl('p7ui:settings-automation', 'P7', 'sonnet', APP + '/settings/automations/page.tsx', 'NEW automations settings page (guarded admin): list/create/delete simple automation rules via actions.'),
  impl('p7ui:webhooks-comp', 'P7', 'sonnet', COMP + '/webhook-manager.tsx', 'NEW client webhook manager (add/remove subscription, pick events, show secret) used by the API settings page.'),
  impl('p7ui:apikeys-comp', 'P7', 'sonnet', COMP + '/apikey-manager.tsx', 'NEW client API-key manager (issue shows key once, list masked, revoke) used by the API settings page.'),
])).filter(Boolean);
// Cleanup (haiku) — safe deletions + deploy wiring; run after P7 build so nothing depends on removed glue.
const p7cleanup = (await parallel([
  impl('p7:cleanup-glue', 'P7', 'haiku', APP + '/page.tsx', 'CONFIRM the overview page no longer references the retired iframe/engine-client/sso flow (it should already be native). If any dead import to engine-client/sso remains in src/app/sabcrm/**, remove it. Do not change working native code.'),
  impl('p7:docs', 'P7', 'haiku', PLAN, 'Append P4/P5/P6/P7 rows to the Session log with what was built. Add a short "API & Webhooks" + "Automation" subsection. Keep all other sections intact.'),
])).filter(Boolean);
log('P7 done.');

// ================================================================ VERIFY — typecheck gate (opus, loop) + audits + route coverage
phase('Verify');

let gate = null; let round = 0;
while (round < 5) {
  round++;
  gate = await agent(
    'TYPECHECK GATE round ' + round + '. Run `' + TYPECHECK + '`. Consider ONLY errors whose path contains a sabcrm location (src/lib/sabcrm, src/app/sabcrm, src/app/api/sabcrm, src/components/sabcrm, src/app/actions/sabcrm.actions.ts). IGNORE the ~10 pre-existing worksuite/crm-*.actions.types.ts parser errors (NOT ours). FIX every sabcrm-scope error with minimal correct edits to the offending sabcrm file(s) only (server/client boundary, imports, action signatures, types), then re-run. ' + RULES + '\nReturn ok=true with issues=[] only when sabcrm scope is fully clean; else list remaining sabcrm-scope errors.',
    { label: 'gate:' + round, phase: 'Verify', schema: VERIFY_SCHEMA, model: 'opus' },
  );
  if (gate && gate.ok && (gate.issues || []).length === 0) break;
  log('Gate round ' + round + ': ' + (gate ? (gate.issues || []).length : '?') + ' sabcrm-scope errors remain.');
}

const audits = (await parallel([
  function () { return agent(
    'RBAC ROUTE COVERAGE: ensure src/config/dashboard-config.ts sabcrmMenuItems + src/lib/rbac-server.ts allMenuItems cover ALL new /sabcrm/* sub-routes from P4-P7 (settings, settings/data-model, settings/members, settings/views, settings/api, settings/automations, dashboard, reports, tasks). Settings/* must require sabcrm:admin; the rest sabcrm:view. ADD any missing entries additively (longest-prefix wins). Verify /api/sabcrm/* routes are api-key authed (NOT relying on the menu RBAC). Report what you changed.',
    { label: 'verify:rbac-routes', phase: 'Verify', schema: VERIFY_SCHEMA, model: 'sonnet' }); },
  function () { return agent(
    'SECURITY/INTEGRATION AUDIT (read-only) of SabCRM P4-P7 (app root ' + ROOT + '): confirm (1) every new server action gates session+project+RBAC+plan; (2) plan limits enforced on create/createCustomObject; (3) public /api/sabcrm/* routes verify an API key and scope strictly to that key\'s projectId (no cross-tenant leakage); (4) webhooks signed; api keys hashed at rest; (5) all Mongo queries projectId-scoped; (6) FILE inputs use SabFiles. Report ok=false with file:line for any gap.',
    { label: 'verify:security', phase: 'Verify', schema: VERIFY_SCHEMA, agentType: 'Explore', model: 'opus' }); },
  function () { return agent(
    'CROSS-TENANT + DATA-MIGRATION AUDIT (read-only): confirm custom-object field delete/retype runs the metadata-migration helpers safely (no orphaned/corrupt record data) and that deleting an object guards against existing records. Confirm automations/events cannot loop infinitely. Report ok=false with specifics.',
    { label: 'verify:engine', phase: 'Verify', schema: VERIFY_SCHEMA, agentType: 'Explore', model: 'opus' }); },
  function () { return agent(
    'Update ' + PLAN + ' session log: confirm final sabcrm-scope typecheck status (' + (gate && gate.ok ? 'CLEAN' : 'see gate report') + ') and list P4-P7 deliverables. Keep other sections intact. ok=true when saved.',
    { label: 'verify:docs', phase: 'Verify', schema: VERIFY_SCHEMA, model: 'haiku' }); },
]).then(function (r) { return r.filter(Boolean); }));

return {
  discovery: discovery.length,
  p4: { data: p4data.length, ui: p4ui.length, actions: !!p4actions },
  p5: { data: p5data.length, ui: p5ui.length, actions: !!p5actions },
  p6: { data: p6data.length, ui: p6ui.length, actions: !!p6actions },
  p7: { data: p7data.length, ui: p7ui.length, cleanup: p7cleanup.length, actions: !!p7actions },
  typecheckClean: !!(gate && gate.ok),
  gate: gate,
  audits: audits,
};
