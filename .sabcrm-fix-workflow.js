export const meta = {
  name: 'sabcrm-p2p3-typefix',
  description: 'Fix the remaining sabcrm-scope TypeScript errors from P2/P3 (integration-seam drift), typecheck-gated until 0 sabcrm-scope errors',
  phases: [{ title: 'Fix' }, { title: 'Gate' }],
};

const ROOT = '/Users/harshkhandelwal/Downloads/sabnode';
const TYPECHECK = 'cd ' + ROOT + ' && NODE_OPTIONS="--max-old-space-size=8192" npx tsc --noEmit';

const RULES = [
  'LIVE SabNode app — strict TS, no `any` (except sanctioned session casts), named exports, "use client"/"use server"/"server-only" preserved.',
  'Make the MINIMAL correct fix for the type error. Prefer fixing the CALLER to match the real exported signature/type; only change a shared type if it is genuinely wrong.',
  'NOTE: `CrmRecordWithLabel` now has an optional `expanded?: ExpandedRelations` field (added in types.ts) — import ExpandedRelations from "@/lib/sabcrm/types" where needed instead of redeclaring it.',
  'Do NOT touch the ~10 pre-existing worksuite/crm-*.actions.types.ts errors. Edit ONLY your assigned file.',
].join('\n');

const FIX_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['file', 'fixed', 'changes'],
  properties: {
    file: { type: 'string' },
    fixed: { type: 'boolean' },
    changes: { type: 'string' },
  },
};

const GATE_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['ok', 'sabcrmErrors', 'summary'],
  properties: {
    ok: { type: 'boolean' },
    sabcrmErrors: { type: 'array', items: { type: 'string' } },
    summary: { type: 'string' },
  },
};

phase('Fix');

// One agent per error-bearing file. Each reads the real types/signatures and fixes.
const TARGETS = [
  ['src/components/sabcrm/view-toolbar.tsx', 'Remove the duplicate local `export type SortDir` (line ~9) — it conflicts with the imported SortDir from records.server. Keep the import; re-export it if other files import SortDir from here (use `export type { SortDir }`). Then fix the SortDir/filter-operator argument mismatches at ~line 112 and ~140 so calls match the real exported types from records.server.ts (read its exports: SortDir, the filter operator type, list/group query option types).'],
  ['src/app/sabcrm/[objectSlug]/page.tsx', 'Fix line ~331: the row handler is typed (row: CrmRecordWithLabel)=>void but the table expects (row: CrmRecord)=>void. Align the record-table onRowClick prop and this handler to the SAME type (use CrmRecordWithLabel end-to-end since rows carry labels). Read record-table.tsx props.'],
  ['src/components/sabcrm/record-table.tsx', 'If record-table row/onRowClick types use CrmRecord but rows are CrmRecordWithLabel, widen the prop generics/types to CrmRecordWithLabel so the index page and table agree. Minimal change; keep existing behavior.'],
  ['src/components/sabcrm/record-board.tsx', 'Fix line ~88: `string | undefined` assigned to `string`. Guard/normalize the group key (e.g. fall back to a sentinel like "" or skip undefined) so the value is `string`. Read groupRecords/board types from records.server.ts.'],
  ['src/components/sabcrm/related-records-panel.tsx', 'Line ~60 used record.expanded — now that CrmRecordWithLabel has optional expanded?: ExpandedRelations, just ensure the optional access is handled (record.expanded?.[field.key]) and types import cleanly. Confirm no other type errors remain in this file.'],
  ['src/components/sabcrm/relation-input.tsx', 'Fix line ~44 relation value type mismatch: align the selected value(s) type with what the relation picker yields and what updateRecord expects (id string for MANY_TO_ONE, string[] for ONE_TO_MANY). Read FieldRelation in types.ts.'],
  ['src/components/sabcrm/activity-timeline.tsx', 'Fix line ~73 "no overload matches": likely a ZoruUI component prop or a date/map call mismatch. Read the real component/prop or function signature and pass correctly.'],
  ['src/components/sabcrm/activity-composer.tsx', 'Fix line ~91 attachment type mismatch: align the attachment objects built here with the attachment shape accepted by createActivityAction / activities.server (read its attachment type — likely {fileId, name?} refs from SabFiles). No raw URLs.'],
  ['src/components/sabcrm/record-detail.tsx', 'Fix line ~120: field.options is possibly undefined. Guard with field.options ?? [] (or narrow by field.type==="SELECT"/"MULTI_SELECT") before mapping.'],
  ['src/app/sabcrm/tasks/page.tsx', 'Fix line ~54 assignment type problem: align the data passed to the tasks board/component with listMyAssignmentsAction return type. Read that action + the consuming component props.'],
  ['src/components/sabcrm/assignment-control.tsx', 'Fix line ~38: Property "members" does not exist. Read src/context/project-context to get the correct way to obtain workspace members (the hook/prop name + shape); use the real source for the assignee list. If members are not in project-context, accept members via props from the server page instead.'],
  ['src/lib/sabcrm/relations.server.ts', 'Line ~57 returned { ...record, expanded } — now CrmRecordWithLabel has expanded?: ExpandedRelations. Import ExpandedRelations from "@/lib/sabcrm/types" and ensure the local ExpandedRelations alias (line ~42) is removed or aligned to the shared type so the return type matches. Fix any resulting mismatch.'],
  ['src/lib/sabcrm/activities.server.ts', 'Fix line ~132 attachment shape mismatch: make the stored attachment objects match the declared CrmActivity attachment type (and vice-versa). Read the CrmActivity/attachment type in this file or types.ts and reconcile.'],
  ['src/app/sabcrm/[objectSlug]/[recordId]/page.tsx', 'Fix line ~70 "missing props" (TS2739): a child component (record-detail-tabs / record-detail / related-records-panel) is rendered without required props. Read the component prop types and pass all required props.'],
];

const fixes = (await parallel(TARGETS.map(function (t) {
  return function () {
    return agent(
      'Fix the TypeScript error(s) in ' + ROOT + '/' + t[0] + '.\n\nError context: ' + t[1] + '\n\nFirst run `' + TYPECHECK + ' 2>&1 | grep "' + t[0].split('/').pop() + '"` to see the exact current errors for THIS file, read the relevant real types/signatures, apply the minimal fix, then re-run that grep to confirm THIS file is clean. ' + RULES,
      { label: 'fix:' + t[0].split('/').pop(), phase: 'Fix', schema: FIX_SCHEMA },
    );
  };
})).then(function (r) { return r.filter(Boolean); }));

log('Fix round done: ' + fixes.filter(function (f) { return f.fixed; }).length + '/' + fixes.length + ' files reported fixed.');

// ---------------------------------------------------------------- GATE (loop until clean)
phase('Gate');

let gate = null;
let round = 0;
while (round < 4) {
  round++;
  gate = await agent(
    'TYPECHECK GATE round ' + round + '. Run `' + TYPECHECK + '`. List EVERY remaining error whose path contains a sabcrm location (src/lib/sabcrm, src/app/sabcrm, src/components/sabcrm, src/app/actions/sabcrm.actions.ts). IGNORE the ~10 pre-existing worksuite/crm-*.actions.types.ts parser errors. If any sabcrm-scope errors remain, FIX them (minimal correct edits to the offending sabcrm files only, per the rules) and re-run. ' + RULES + '\nReturn ok=true with sabcrmErrors=[] only when the sabcrm scope is fully clean; else return the remaining sabcrm-scope errors.',
    { label: 'gate:' + round, phase: 'Gate', schema: GATE_SCHEMA },
  );
  if (gate && gate.ok && (gate.sabcrmErrors || []).length === 0) break;
  log('Gate round ' + round + ': ' + (gate ? (gate.sabcrmErrors || []).length : '?') + ' sabcrm-scope errors remain.');
}

return { fixes: fixes, gate: gate, rounds: round };
