/**
 * RecordSurface adapter — pure mapping functions between the 20ui
 * RecordSurface composites' client-side models and the SabCRM server-action
 * wire formats.
 *
 * Bridged surfaces:
 *
 *   - composites' {@link FilterGroup} tree  ⇄  the Rust engine's `filters`
 *     value ({@link SabcrmRecordFilters}: legacy field-keyed map OR widened
 *     `{ op, conditions }` tree) consumed by `listSabcrmRecordsTw` /
 *     `countSabcrmRecordsTw` / `aggregateSabcrmRecordsTw`.
 *   - composites' ordered {@link ViewSort} list  ⇄  the engine's single-key
 *     `sortBy` / `sortDir` pair (primary sort wins) + the saved-view
 *     `viewSorts` depth field (full list round-trips).
 *   - composites' {@link SavedView}  ⇄  the Rust saved-view document
 *     ({@link SabcrmRustView}) via `listViewsTw` / `createViewTw` /
 *     `updateViewTw`.
 *   - Rust record wire shape ({@link SabcrmRustRecord}, `id`)  →  the
 *     composites' {@link CrmRecord} (`_id`).
 *
 * Operator translation: the composites' {@link FilterOp} dialect (eq | ne |
 * contains | gt | lt | gte | lte | isEmpty | isNotEmpty) is EXACTLY a subset
 * of the engine dialect, so serialization is verbatim. Deserialization
 * normalises engine aliases (`neq` → `ne`) and degrades unknown operators to
 * `eq` over the stringified value (the legacy view-bar's behaviour).
 *
 * This module MUST stay free of React, CSS and `server-only` imports so it
 * can be unit-tested directly (`tsx --test`). All composite/wire types are
 * imported `type`-only (erased at runtime).
 */

import type {
  FilterGroup,
  FilterCondition,
  FilterNode,
  FilterOp,
  FilterConjunction,
  ViewSort,
  SavedView,
  SavedViewPatch,
  RecordViewType,
} from '@/components/sabcrm/20ui/composites/record';
import type {
  SabcrmRecordFilters,
  SabcrmRustRecord,
} from '@/app/actions/sabcrm-twenty.actions.types';
import type {
  SabcrmRustView,
  SabcrmViewCreateInput,
  SabcrmViewUpdateInput,
} from '@/app/actions/sabcrm-views.actions.types';
import type { CrmRecord } from '@/lib/sabcrm/types';

/* -------------------------------------------------------------------------- */
/* Local tree helpers (re-implemented, not imported from the composites, so   */
/* this module never drags .tsx/.css through a node test runner)              */
/* -------------------------------------------------------------------------- */

/** An empty root group (AND over no conditions). */
export const EMPTY_WIRE_GROUP: FilterGroup = { op: 'and', conditions: [] };

/** The 9 operators the composites emit (and the engine accepts verbatim). */
const FILTER_OPS: ReadonlySet<string> = new Set<FilterOp>([
  'eq',
  'ne',
  'contains',
  'gt',
  'lt',
  'gte',
  'lte',
  'isEmpty',
  'isNotEmpty',
]);

/** Discriminate a {@link FilterGroup} from a leaf {@link FilterCondition}. */
export function isGroupNode(node: FilterNode): node is FilterGroup {
  return (
    typeof (node as FilterGroup).op === 'string' &&
    Array.isArray((node as FilterGroup).conditions)
  );
}

/** Operators that take no operand. */
function isUnaryOp(op: FilterOp): boolean {
  return op === 'isEmpty' || op === 'isNotEmpty';
}

/** Total leaf-condition count in a tree. */
export function countLeaves(group: FilterGroup): number {
  let n = 0;
  for (const node of group.conditions) {
    n += isGroupNode(node) ? countLeaves(node) : 1;
  }
  return n;
}

/**
 * Drop incomplete leaves (binary op without a value) and emptied sub-groups —
 * same semantics as the composites' `pruneFilterGroup`, duplicated here so
 * serialization is safe even when a caller forgets to prune.
 */
export function pruneGroup(group: FilterGroup): FilterGroup {
  const conditions: FilterNode[] = [];
  for (const node of group.conditions) {
    if (isGroupNode(node)) {
      const sub = pruneGroup(node);
      if (sub.conditions.length > 0) conditions.push(sub);
    } else if (
      node.fieldKey &&
      (isUnaryOp(node.op) || (node.value ?? '').trim() !== '')
    ) {
      conditions.push(node);
    }
  }
  return { op: group.op, conditions };
}

/* -------------------------------------------------------------------------- */
/* FilterGroup → wire                                                         */
/* -------------------------------------------------------------------------- */

/** Best-effort numeric coercion so `gt`/`lt`/`gte`/`lte` compare numerically. */
export function coerceFilterValue(raw: string): string | number {
  if (raw.trim() === '') return raw;
  const n = Number(raw);
  return Number.isNaN(n) ? raw : n;
}

/** Serialize one leaf into the engine's `{ op, value }` condition shape. */
function leafToWire(c: FilterCondition): Record<string, unknown> {
  if (isUnaryOp(c.op)) return { op: c.op };
  return { op: c.op, value: coerceFilterValue(c.value ?? '') };
}

/** Serialize a tree into the engine's widened `{ op, conditions }` shape. */
function groupToWireTree(group: FilterGroup): Record<string, unknown> {
  return {
    op: group.op,
    conditions: group.conditions.map((node) =>
      isGroupNode(node)
        ? groupToWireTree(node)
        : { field: node.fieldKey, ...leafToWire(node) },
    ),
  };
}

/**
 * Whether a tree is a single flat AND group over UNIQUE fields — the only
 * shape the legacy field-keyed map can represent without clobbering (two
 * conditions on the same field would collide on the map key).
 */
function isFlatUniqueAndGroup(group: FilterGroup): boolean {
  if (group.op !== 'and') return false;
  const seen = new Set<string>();
  for (const node of group.conditions) {
    if (isGroupNode(node)) return false;
    if (seen.has(node.fieldKey)) return false;
    seen.add(node.fieldKey);
  }
  return true;
}

/**
 * Translate the composites' filter tree into the engine's `filters` value.
 *
 * - empty (after pruning) → `undefined` (callers omit the param entirely);
 * - flat AND over unique fields → the legacy field-keyed map
 *   (`{ fieldKey: { op, value } }`) every engine version understands;
 * - anything else (OR root, nested groups, repeated fields) → the widened
 *   `{ op, conditions: [...] }` tree.
 */
export function filterGroupToWire(
  group: FilterGroup,
): SabcrmRecordFilters | undefined {
  const pruned = pruneGroup(group);
  if (pruned.conditions.length === 0) return undefined;

  if (isFlatUniqueAndGroup(pruned)) {
    const out: Record<string, unknown> = {};
    for (const node of pruned.conditions) {
      if (isGroupNode(node)) continue; // unreachable in a flat group
      out[node.fieldKey] = leafToWire(node);
    }
    return out;
  }
  return groupToWireTree(pruned) as SabcrmRecordFilters;
}

/* -------------------------------------------------------------------------- */
/* Wire → FilterGroup (saved-view round-trip)                                 */
/* -------------------------------------------------------------------------- */

/**
 * Normalise a persisted operator string into the composites' dialect.
 * `neq` (engine alias) folds to `ne`; anything unrecognised degrades to `eq`
 * (the legacy view-bar's parse behaviour).
 */
export function normalizeOp(raw: unknown): FilterOp {
  const op = String(raw ?? '');
  if (op === 'neq') return 'ne';
  return FILTER_OPS.has(op) ? (op as FilterOp) : 'eq';
}

/** Parse one persisted `{ op, value }` (or bare scalar) leaf payload. */
function parseLeaf(raw: unknown): { op: FilterOp; value?: string } {
  if (raw && typeof raw === 'object' && 'op' in (raw as Record<string, unknown>)) {
    const obj = raw as Record<string, unknown>;
    const op = normalizeOp(obj.op);
    if (isUnaryOp(op)) return { op };
    const value = obj.value;
    return {
      op,
      value: value === undefined || value === null ? '' : String(value),
    };
  }
  return {
    op: 'eq',
    value: raw === undefined || raw === null ? '' : String(raw),
  };
}

/**
 * Reverse of {@link filterGroupToWire}: turn a persisted `filters` value back
 * into the editable tree. Accepts BOTH wire shapes:
 *
 *   - legacy field-keyed map `{ fieldKey: scalar | { op, value } }` → a flat
 *     AND group;
 *   - widened tree `{ op, conditions: [...] }` (leaves carry `field`) →
 *     parsed recursively, preserving nested sub-groups.
 */
export function wireToFilterGroup(filters: unknown): FilterGroup {
  if (!filters || typeof filters !== 'object' || Array.isArray(filters)) {
    return { ...EMPTY_WIRE_GROUP };
  }

  const obj = filters as Record<string, unknown>;

  // Widened tree shape.
  if (Array.isArray(obj.conditions) && (obj.op === 'and' || obj.op === 'or')) {
    const conditions: FilterNode[] = [];
    for (const node of obj.conditions as unknown[]) {
      if (!node || typeof node !== 'object') continue;
      const n = node as Record<string, unknown>;
      if (Array.isArray(n.conditions)) {
        conditions.push(wireToFilterGroup(n));
      } else if (typeof n.field === 'string' && n.field) {
        conditions.push({ fieldKey: n.field, ...parseLeaf(n) });
      }
    }
    return { op: obj.op as FilterConjunction, conditions };
  }

  // Legacy field-keyed map.
  const conditions: FilterNode[] = [];
  for (const [fieldKey, raw] of Object.entries(obj)) {
    if (raw === undefined || raw === null) continue;
    conditions.push({ fieldKey, ...parseLeaf(raw) });
  }
  return { op: 'and', conditions };
}

/* -------------------------------------------------------------------------- */
/* NL filter — model JSON → FilterGroup ("validate, never trust")              */
/* -------------------------------------------------------------------------- */

/**
 * The slice of {@link import('@/lib/sabcrm/types').FieldMetadata} the NL
 * validation walk needs: key membership, the SELECT/MULTI_SELECT label→value
 * mapping, and nothing else. Kept structural so the server action can pass
 * Rust-client field metadata without a cast.
 */
export interface NlCatalogueField {
  key: string;
  type: string;
  options?: Array<{ value: string; label: string }>;
}

/** The FilterBuilder's `maxDepth` — sub-groups nested deeper are dropped. */
const NL_MAX_DEPTH = 3;

/**
 * Strip markdown code fences (```json … ```) and parse; when the reply embeds
 * prose around the JSON, fall back to the first `{ … }` slice. `null` when
 * nothing parses.
 */
function extractJsonObject(raw: string): unknown {
  let text = raw.trim();
  const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(text);
  if (fenced?.[1]) text = fenced[1].trim();
  try {
    return JSON.parse(text);
  } catch {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(text.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

/**
 * Validate an LLM reply into a committed-shape {@link FilterGroup} — the
 * "validate, never trust" walk behind `nlToFilterTw`:
 *
 *   - strips ```json fences / surrounding prose, `JSON.parse`s the rest;
 *   - recursive walk capped at {@link NL_MAX_DEPTH} (the builder's `maxDepth`);
 *   - leaves must name a catalogue field (`fieldKey`, `field` accepted as an
 *     alias) and get their op normalised via {@link normalizeOp};
 *   - SELECT/MULTI_SELECT leaves map a value matching an option **label** onto
 *     the option **value** (case-insensitive); non-option values fail closed
 *     (leaf dropped);
 *   - anything invalid is dropped; the result is {@link pruneGroup}d.
 *
 * Returns `null` when nothing survives (callers surface "Could not turn that
 * into a filter."). The model's top-level `unresolved` note rides along.
 */
export function nlFilterFromModelJson(
  raw: string,
  fields: NlCatalogueField[],
): { group: FilterGroup; unresolved?: string } | null {
  const parsed = extractJsonObject(raw);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return null;
  }

  const byKey = new Map(fields.map((f) => [f.key, f]));

  const walkGroup = (
    node: Record<string, unknown>,
    depth: number,
  ): FilterGroup | null => {
    if (depth > NL_MAX_DEPTH) return null;
    if (!Array.isArray(node.conditions)) return null;
    const op: FilterConjunction = node.op === 'or' ? 'or' : 'and';
    const conditions: FilterNode[] = [];
    for (const child of node.conditions as unknown[]) {
      if (!child || typeof child !== 'object' || Array.isArray(child)) continue;
      const c = child as Record<string, unknown>;

      // Nested sub-group.
      if (Array.isArray(c.conditions)) {
        const sub = walkGroup(c, depth + 1);
        if (sub && sub.conditions.length > 0) conditions.push(sub);
        continue;
      }

      // Leaf — `fieldKey` per the schema; `field` accepted as a wire alias.
      const keyRaw =
        typeof c.fieldKey === 'string' && c.fieldKey
          ? c.fieldKey
          : typeof c.field === 'string'
            ? c.field
            : '';
      const field = byKey.get(keyRaw);
      if (!field) continue;

      const leafOp = normalizeOp(c.op);
      if (isUnaryOp(leafOp)) {
        conditions.push({ fieldKey: field.key, op: leafOp });
        continue;
      }

      const rawValue = c.value;
      if (
        rawValue === undefined ||
        rawValue === null ||
        (typeof rawValue !== 'string' &&
          typeof rawValue !== 'number' &&
          typeof rawValue !== 'boolean')
      ) {
        continue;
      }
      let value = String(rawValue);

      if (field.type === 'SELECT' || field.type === 'MULTI_SELECT') {
        const lower = value.toLowerCase();
        const match = (field.options ?? []).find(
          (o) =>
            o.value.toLowerCase() === lower || o.label.toLowerCase() === lower,
        );
        if (!match) continue; // fails closed — non-option values are dropped
        value = match.value;
      }

      conditions.push({ fieldKey: field.key, op: leafOp, value });
    }
    return { op, conditions };
  };

  const group = walkGroup(parsed as Record<string, unknown>, 0);
  if (!group) return null;
  const pruned = pruneGroup(group);
  if (pruned.conditions.length === 0) return null;

  const unresolvedRaw = (parsed as Record<string, unknown>).unresolved;
  const unresolved =
    typeof unresolvedRaw === 'string' && unresolvedRaw.trim() !== ''
      ? unresolvedRaw.trim().slice(0, 300)
      : undefined;
  return unresolved ? { group: pruned, unresolved } : { group: pruned };
}

/* -------------------------------------------------------------------------- */
/* Sorts                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * The list/count actions take a single `sortBy`/`sortDir` pair — the PRIMARY
 * entry of the ordered multi-sort wins; an empty list omits both.
 */
export function sortsToWire(sorts: ViewSort[]): {
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
} {
  const primary = sorts[0];
  if (!primary?.fieldKey) return {};
  return { sortBy: primary.fieldKey, sortDir: primary.dir };
}

/**
 * Multi-sort from a persisted view: the Twenty-parity `viewSorts` depth field
 * is authoritative when present; else the legacy `sortBy`/`sortDir` pair.
 */
export function viewSortsFromWire(view: SabcrmRustView): ViewSort[] {
  if (Array.isArray(view.viewSorts) && view.viewSorts.length > 0) {
    return view.viewSorts
      .filter((s) => typeof s.fieldKey === 'string' && s.fieldKey)
      .map((s) => ({
        fieldKey: s.fieldKey,
        dir: s.direction === 'asc' ? 'asc' : 'desc',
      }));
  }
  if (view.sortBy) {
    return [{ fieldKey: view.sortBy, dir: view.sortDir === 'desc' ? 'desc' : 'asc' }];
  }
  return [];
}

/* -------------------------------------------------------------------------- */
/* Saved views                                                                 */
/* -------------------------------------------------------------------------- */

/** Map a persisted view `kind` onto the composites' view-type union. */
export function viewTypeFromKind(kind: string | undefined): RecordViewType {
  return kind === 'board' ? 'board' : 'table';
}

/** Map the composites' view type onto the persisted `kind` (board|table). */
export function kindFromViewType(viewType: RecordViewType | undefined): string {
  return viewType === 'board' ? 'board' : 'table';
}

/** Map a Rust saved-view document into the ViewBar's {@link SavedView}. */
export function savedViewFromWire(view: SabcrmRustView): SavedView {
  return {
    id: view.id,
    name: view.name,
    viewType: viewTypeFromKind(view.kind),
    filters: wireToFilterGroup(view.filters),
    sorts: viewSortsFromWire(view),
    groupBy: view.groupByField ?? null,
    isDefault: view.isDefault === true,
  };
}

/** The client-side state snapshot a saved view persists. */
export interface ViewStateSnapshot {
  viewType: RecordViewType;
  filters: FilterGroup;
  sorts: ViewSort[];
  groupBy: string | null;
  /** Table column widths (px) keyed by field key — RecordGrid resize state. */
  columnWidths?: Record<string, number>;
}

/** Serialize a snapshot's view dimensions into the wire view document keys. */
function snapshotToWireKeys(snap: ViewStateSnapshot): Record<string, unknown> {
  const { sortBy, sortDir } = sortsToWire(snap.sorts);
  return {
    kind: kindFromViewType(snap.viewType),
    // An emptied tree persists as `{}` (the engine's "no filters" map) so
    // clearing filters on an existing view round-trips.
    filters: filterGroupToWire(snap.filters) ?? {},
    sortBy,
    sortDir,
    groupByField: snap.groupBy ?? undefined,
    viewSorts: snap.sorts.map((s, i) => ({
      fieldKey: s.fieldKey,
      direction: s.dir,
      position: i,
    })),
    // Extra additive key — the Rust view handlers `#[serde(flatten)]` the
    // body, so unknown keys persist on the document and round-trip on read.
    // An empty map (widths reset) round-trips the same way `filters` does.
    columnWidths: snap.columnWidths ?? {},
  };
}

/**
 * Read the persisted `columnWidths` map back off a saved-view document. The
 * key is additive (not in {@link SabcrmRustView}'s declared shape — the Rust
 * engine round-trips any extra keys the client writes), so it is accessed
 * defensively: non-object payloads and non-positive / non-numeric entries are
 * dropped.
 */
export function columnWidthsFromWire(
  view: SabcrmRustView,
): Record<string, number> {
  const raw = (view as unknown as Record<string, unknown>).columnWidths;
  const out: Record<string, number> = {};
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
      const px = Number(value);
      if (Number.isFinite(px) && px > 0) out[key] = px;
    }
  }
  return out;
}

/* -------------------------------------------------------------------------- */
/* Work-queue config (additive `queue` key on the view doc)                   */
/* -------------------------------------------------------------------------- */

/**
 * The client-side slice of a saved view's work-queue config. The persisted
 * wire shape (`view.queue`) is
 * `{ enabled, doneWhen: { field, op, value? }, slaField, snoozeMinutes }`;
 * `doneWhen` maps onto the composites' {@link FilterCondition} leaf.
 */
export interface QueueViewConfig {
  /** Leaf condition marking a record as inherently done. */
  doneWhen?: FilterCondition;
  /** DATE/DATE_TIME field key driving the SLA chip (overdue when < now). */
  slaFieldKey?: string;
  /** Default snooze, minutes. */
  snoozeMinutes?: number;
}

/**
 * Read the persisted `queue` config back off a saved-view document. Like
 * {@link columnWidthsFromWire}, the key is additive (not in
 * {@link SabcrmRustView}'s declared shape — the Rust engine round-trips any
 * extra keys), so it is accessed defensively: non-object payloads return
 * `null`, a malformed `doneWhen` is dropped (its `op` is normalised via
 * {@link normalizeOp}), and non-positive / non-numeric `snoozeMinutes` are
 * ignored.
 */
export function queueConfigFromWire(
  view: SabcrmRustView,
): QueueViewConfig | null {
  const raw = (view as unknown as Record<string, unknown>).queue;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const obj = raw as Record<string, unknown>;

  const out: QueueViewConfig = {};

  const doneWhen = obj.doneWhen;
  if (doneWhen && typeof doneWhen === 'object' && !Array.isArray(doneWhen)) {
    const leaf = doneWhen as Record<string, unknown>;
    const field = typeof leaf.field === 'string' ? leaf.field.trim() : '';
    if (field) {
      const op = normalizeOp(leaf.op);
      const condition: FilterCondition = { fieldKey: field, op };
      if (!isUnaryOp(op)) {
        const value = leaf.value;
        condition.value =
          value === undefined || value === null ? '' : String(value);
      }
      out.doneWhen = condition;
    }
  }

  if (typeof obj.slaField === 'string' && obj.slaField.trim()) {
    out.slaFieldKey = obj.slaField.trim();
  }

  const minutes = Number(obj.snoozeMinutes);
  if (Number.isFinite(minutes) && minutes > 0) {
    out.snoozeMinutes = Math.round(minutes);
  }

  return out;
}

/**
 * Serialize a {@link QueueViewConfig} back into the persisted `queue` wire
 * key for `updateViewTw` (reverse of {@link queueConfigFromWire}).
 */
export function queueConfigToWire(
  cfg: QueueViewConfig,
): Record<string, unknown> {
  const out: Record<string, unknown> = { enabled: true };
  if (cfg.doneWhen?.fieldKey) {
    const leaf: Record<string, unknown> = {
      field: cfg.doneWhen.fieldKey,
      op: cfg.doneWhen.op,
    };
    if (!isUnaryOp(cfg.doneWhen.op)) leaf.value = cfg.doneWhen.value ?? '';
    out.doneWhen = leaf;
  }
  if (cfg.slaFieldKey) out.slaField = cfg.slaFieldKey;
  if (
    typeof cfg.snoozeMinutes === 'number' &&
    Number.isFinite(cfg.snoozeMinutes) &&
    cfg.snoozeMinutes > 0
  ) {
    out.snoozeMinutes = Math.round(cfg.snoozeMinutes);
  }
  return out;
}

/** Build the `createViewTw` input for "Save view as…". */
export function savedViewToWireInput(
  objectSlug: string,
  name: string,
  snap: ViewStateSnapshot,
): SabcrmViewCreateInput {
  return {
    object: objectSlug,
    name,
    ...snapshotToWireKeys(snap),
  };
}

/**
 * Build the `updateViewTw` patch from a ViewBar {@link SavedViewPatch} (rename
 * today) and/or a fresh state snapshot (persist-on-change).
 */
export function savedViewPatchToWire(
  patch: SavedViewPatch,
  snap?: ViewStateSnapshot,
): SabcrmViewUpdateInput {
  const out: SabcrmViewUpdateInput = {};
  if (typeof patch.name === 'string' && patch.name.trim()) {
    out.name = patch.name.trim();
  }
  if (snap) Object.assign(out, snapshotToWireKeys(snap));
  return out;
}

/* -------------------------------------------------------------------------- */
/* Records                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Map a Rust wire record (`id`) onto the composites' {@link CrmRecord}
 * (`_id`). `userId` is a scoping key the composites never read — the wire
 * shape scopes by `projectId`, threaded through verbatim.
 */
export function rustRecordToCrm(record: SabcrmRustRecord): CrmRecord {
  return {
    _id: record.id,
    object: record.object,
    userId: record.createdBy ?? record.projectId,
    data: record.data ?? {},
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

/**
 * Harvest resolved RELATION/ACTOR labels from enriched wire records
 * (`__relations` / `__actors` hints) into an id → label map. Merges into
 * `into` when given (so a host can accumulate across pages/searches).
 */
export function collectRelationLabels(
  records: ReadonlyArray<SabcrmRustRecord>,
  into?: Map<string, string>,
): Map<string, string> {
  const map = into ?? new Map<string, string>();
  for (const record of records) {
    const relations = record.__relations;
    if (relations) {
      for (const hint of Object.values(relations)) {
        if (hint && hint.id && hint.label) map.set(hint.id, hint.label);
      }
    }
    const actor = record.__actors?.createdBy;
    if (actor && actor.id && actor.label) map.set(actor.id, actor.label);
  }
  return map;
}

/* -------------------------------------------------------------------------- */
/* URL view-state codec (shareable links)                                     */
/* -------------------------------------------------------------------------- */

/**
 * The slice of RecordSurface state encoded into the page's searchParams so
 * links are shareable. Deliberately minimal — filters/sorts/group-by stay in
 * the saved view (`viewId` references it); only the navigation dimensions
 * ride the URL.
 *
 * Params: `view` (saved view id) · `vt` (view type) · `page` · `q`.
 */
export interface UrlViewState {
  viewId?: string;
  viewType?: RecordViewType;
  page?: number;
  q?: string;
}

const URL_PARAM_VIEW = 'view';
const URL_PARAM_VIEW_TYPE = 'vt';
const URL_PARAM_PAGE = 'page';
const URL_PARAM_Q = 'q';

/** View types the surface can actually render (and thus encode). */
const URL_VIEW_TYPES: ReadonlySet<string> = new Set(['table', 'board', 'queue']);

/**
 * Parse a `location.search` string (with or without the leading `?`) into a
 * {@link UrlViewState}. Defaults are omitted from the result: page 1, empty
 * `q`, unknown view types and blank ids never appear.
 */
export function parseUrlViewState(search: string): UrlViewState {
  const sp = new URLSearchParams(search);
  const out: UrlViewState = {};
  const viewId = sp.get(URL_PARAM_VIEW);
  if (viewId) out.viewId = viewId;
  const vt = sp.get(URL_PARAM_VIEW_TYPE);
  if (vt && URL_VIEW_TYPES.has(vt)) out.viewType = vt as RecordViewType;
  const page = Number(sp.get(URL_PARAM_PAGE));
  if (Number.isInteger(page) && page > 1) out.page = page;
  const q = sp.get(URL_PARAM_Q);
  if (q && q.trim()) out.q = q.trim();
  return out;
}

/**
 * Reverse of {@link parseUrlViewState}: write a state onto an existing
 * `location.search` string, PRESERVING any foreign params. Default values
 * delete their param (page 1, empty `q`, `table`, no view id) so URLs stay
 * clean. Returns `''` or a `?`-prefixed query string, ready to append to the
 * pathname.
 */
export function applyUrlViewState(search: string, state: UrlViewState): string {
  const sp = new URLSearchParams(search);
  const put = (key: string, value: string | null): void => {
    if (value) sp.set(key, value);
    else sp.delete(key);
  };
  put(URL_PARAM_VIEW, state.viewId ?? null);
  put(
    URL_PARAM_VIEW_TYPE,
    state.viewType && state.viewType !== 'table' && URL_VIEW_TYPES.has(state.viewType)
      ? state.viewType
      : null,
  );
  put(
    URL_PARAM_PAGE,
    state.page && Number.isInteger(state.page) && state.page > 1
      ? String(state.page)
      : null,
  );
  put(URL_PARAM_Q, state.q && state.q.trim() ? state.q.trim() : null);
  const s = sp.toString();
  return s ? `?${s}` : '';
}

/* -------------------------------------------------------------------------- */
/* Client-side matchers (board path: the group action takes no q/filters)     */
/* -------------------------------------------------------------------------- */

/** Whether a raw cell value is "empty" for the unary operators. */
function isEmptyValue(v: unknown): boolean {
  if (v === null || v === undefined) return true;
  if (typeof v === 'string') return v.trim() === '';
  if (Array.isArray(v)) return v.length === 0;
  return false;
}

/** Evaluate one leaf condition against a record's raw cell value. */
function matchLeaf(cell: unknown, c: FilterCondition): boolean {
  switch (c.op) {
    case 'isEmpty':
      return isEmptyValue(cell);
    case 'isNotEmpty':
      return !isEmptyValue(cell);
    default:
      break;
  }

  const want = coerceFilterValue(c.value ?? '');

  // Multi-value cells (e.g. MULTI_SELECT) match when any member matches.
  if (Array.isArray(cell)) {
    return cell.some((m) => matchLeaf(m, c));
  }

  if (c.op === 'contains') {
    return String(cell ?? '')
      .toLowerCase()
      .includes(String(want).toLowerCase());
  }

  // Numeric comparison when both sides parse as numbers, else lexical.
  const cellNum = typeof cell === 'number' ? cell : Number(cell);
  const wantNum = typeof want === 'number' ? want : Number(want);
  const numeric =
    !Number.isNaN(cellNum) &&
    !Number.isNaN(wantNum) &&
    cell !== null &&
    cell !== undefined &&
    String(cell).trim() !== '';

  switch (c.op) {
    case 'eq':
      return numeric ? cellNum === wantNum : String(cell ?? '') === String(want);
    case 'ne':
      return numeric ? cellNum !== wantNum : String(cell ?? '') !== String(want);
    case 'gt':
      return numeric ? cellNum > wantNum : String(cell ?? '') > String(want);
    case 'lt':
      return numeric ? cellNum < wantNum : String(cell ?? '') < String(want);
    case 'gte':
      return numeric ? cellNum >= wantNum : String(cell ?? '') >= String(want);
    case 'lte':
      return numeric ? cellNum <= wantNum : String(cell ?? '') <= String(want);
    default:
      return true;
  }
}

/**
 * Evaluate a whole filter tree against a record's `data` map — the same
 * operator semantics the engine applies server-side. An empty group matches
 * everything. Used to keep the board honest with the active filters, since
 * the `group` action accepts no filter predicate.
 */
export function recordMatchesFilters(
  data: Record<string, unknown> | undefined,
  group: FilterGroup,
): boolean {
  if (group.conditions.length === 0) return true;
  const d = data ?? {};
  const results = group.conditions.map((node) =>
    isGroupNode(node)
      ? recordMatchesFilters(d, node)
      : matchLeaf(d[node.fieldKey], node),
  );
  return group.op === 'or' ? results.some(Boolean) : results.every(Boolean);
}

/**
 * Case-insensitive free-text match over a record's scalar `data` values —
 * the client-side fallback mirroring the engine's `q` regex scan, for
 * surfaces (board) whose fetch path has no `q` param.
 */
export function recordMatchesSearch(
  data: Record<string, unknown> | undefined,
  q: string,
): boolean {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  const d = data ?? {};
  for (const value of Object.values(d)) {
    if (value === null || value === undefined) continue;
    if (typeof value === 'string' || typeof value === 'number') {
      if (String(value).toLowerCase().includes(needle)) return true;
    } else if (Array.isArray(value)) {
      for (const member of value) {
        if (
          (typeof member === 'string' || typeof member === 'number') &&
          String(member).toLowerCase().includes(needle)
        ) {
          return true;
        }
      }
    }
  }
  return false;
}
