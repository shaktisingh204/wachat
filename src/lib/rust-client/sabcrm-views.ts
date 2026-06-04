import 'server-only';

/**
 * SabCRM Views client — wraps the Rust `/v1/sabcrm/views` surface
 * (crate `sabcrm-views`, mounted by `sabnode-api`).
 *
 * A saved view is a per-object configuration (`name`, `kind`, `filters`,
 * `sortBy`, `sortDir`, `fields`, `groupByField`, `isDefault`). Tenant scope is
 * `projectId`; the Rust side requires a valid `AuthUser` JWT.
 *
 * The Rust handlers wrap responses in `{ views: [...] }` (list) and
 * `{ view: {...} }` (single); this client unwraps them. Wire shapes mirror
 * `rust/crates/sabcrm-views/src/{dto,handlers}.rs`.
 */
import { rustFetch } from './fetcher';
import type { SabcrmRustRecord } from './sabcrm-records';

/**
 * Surface a saved view renders — Twenty's `ViewType` flattened
 * (`GRID` → `table`, `KANBAN` → `board`, plus `calendar`). Serialized
 * lowercase; unknown future kinds survive a round-trip.
 */
export type SabcrmViewKind = 'table' | 'board' | 'calendar' | (string & {});

/** Sort direction for a {@link SabcrmViewSort} level. */
export type SabcrmViewSortDirection = 'asc' | 'desc';

/** Logical operator combining the members of a {@link SabcrmViewFilterGroup}. */
export type SabcrmViewLogicalOperator = 'and' | 'or';

/** Twenty's filter comparator set (serialized snake_case). */
export type SabcrmViewFilterOperator =
  | 'is'
  | 'is_not'
  | 'contains'
  | 'does_not_contain'
  | 'greater_than'
  | 'greater_than_or_equal'
  | 'less_than'
  | 'less_than_or_equal'
  | 'is_empty'
  | 'is_not_empty'
  | 'in'
  | 'not_in'
  | (string & {});

/**
 * One per-view visible field with explicit order/width. When present
 * (`viewFields`) this is authoritative over the legacy `fields: string[]`.
 */
export interface SabcrmViewField {
  /** Field key (matches a record's `data.<fieldKey>`). */
  fieldKey: string;
  /** 0-based display order within the view. */
  position?: number;
  /** Whether the field is shown. Defaults to `true` server-side. */
  isVisible?: boolean;
  /** Optional column width in px (table views). */
  size?: number;
}

/**
 * A single leaf filter condition: `fieldKey <operator> value`. `value` is an
 * arbitrary JSON scalar/array (e.g. the operand list for `in`); omitted for
 * `is_empty` / `is_not_empty`. Belongs to the group named by `groupId`
 * (root group when absent).
 */
export interface SabcrmViewFilter {
  /** Field key being filtered (matches `data.<fieldKey>`). */
  fieldKey: string;
  /** Comparator. Defaults to `is` server-side. */
  operator?: SabcrmViewFilterOperator;
  /** Operand. Omitted/null for `is_empty` / `is_not_empty`. */
  value?: unknown;
  /** Owning filter group id; absent ⇒ the view's root group. */
  groupId?: string;
}

/**
 * A nestable AND/OR group of filters. Leaves reference a group through
 * {@link SabcrmViewFilter.groupId}; groups nest through `parentGroupId`.
 */
export interface SabcrmViewFilterGroup {
  /** Stable id referenced by leaves / child groups. */
  id: string;
  /** How this group's members combine. Defaults to `and` server-side. */
  logicalOperator?: SabcrmViewLogicalOperator;
  /** Parent group id; absent ⇒ this is the root group. */
  parentGroupId?: string;
  /** Display order among sibling groups. */
  position?: number;
}

/**
 * One level of a multi-sort. The view's full sort is an ordered
 * `viewSorts` (first entry is the primary key); authoritative over the
 * legacy `sortBy`/`sortDir` pair.
 */
export interface SabcrmViewSort {
  /** Field key to sort on (matches `data.<fieldKey>`). */
  fieldKey: string;
  /** Direction. Defaults to `desc` server-side. */
  direction?: SabcrmViewSortDirection;
  /** Order among sort levels (lower = applied first / primary). */
  position?: number;
}

/**
 * A SabCRM saved view as returned by the Rust engine (`_id` → `id` hex).
 *
 * Carries both the legacy shape (`filters` map, `sortBy`/`sortDir`,
 * `fields: string[]`) and the additive Twenty-parity depth fields
 * (`viewFields`, `filterGroups`/`viewFilters`, `viewSorts`, `userId`). All
 * depth fields are optional/additive — older documents that only carry the
 * legacy keys still round-trip.
 */
export interface SabcrmRustView {
  id: string;
  projectId: string;
  /** Owner of a private view; omitted for project-shared views. */
  userId?: string;
  object: string;
  name: string;
  /** Surface to render (`table` | `board` | `calendar`). */
  kind?: SabcrmViewKind;
  filters?: unknown;
  sortBy?: string;
  sortDir?: SabcrmViewSortDirection;
  fields?: string[];
  groupByField?: string;
  isDefault?: boolean;

  // --- Twenty-parity depth (additive, optional) ---
  /**
   * Per-view visible fields with explicit order/width. Authoritative over
   * the legacy `fields` key when present.
   */
  viewFields?: SabcrmViewField[];
  /** AND/OR filter groups (nested via `parentGroupId`). */
  filterGroups?: SabcrmViewFilterGroup[];
  /** Structured leaf filters (`fieldKey`/`operator`/`value`, `groupId`). */
  viewFilters?: SabcrmViewFilter[];
  /** Multi-sort, ordered (primary first). Authoritative over the legacy pair. */
  viewSorts?: SabcrmViewSort[];

  createdAt: string;
  updatedAt: string;
}

/**
 * `POST /` body sans `projectId` — the flattened view document. Sent as
 * `{ projectId, ...input }`.
 */
export interface SabcrmViewCreateInput {
  object: string;
  name: string;
  kind?: SabcrmViewKind;
  /** Owner of a private view; omitted for project-shared views. */
  userId?: string;
  filters?: unknown;
  sortBy?: string;
  sortDir?: SabcrmViewSortDirection;
  fields?: string[];
  groupByField?: string;
  isDefault?: boolean;

  // --- Twenty-parity depth (additive, optional) ---
  viewFields?: SabcrmViewField[];
  filterGroups?: SabcrmViewFilterGroup[];
  viewFilters?: SabcrmViewFilter[];
  viewSorts?: SabcrmViewSort[];
}

/** `PATCH /{id}` body sans `projectId` — a partial view document. */
export interface SabcrmViewUpdateInput {
  [key: string]: unknown;
}

/** Raw `{ views }` envelope from `GET /`. */
interface ListEnvelope {
  views: SabcrmRustView[];
}

/** Raw `{ view }` envelope from `POST /`, `PATCH /{id}`, `POST /{id}/default`. */
interface SingleEnvelope {
  view: SabcrmRustView;
}

/** Pagination options accepted by `run`. */
export interface SabcrmViewRunOpts {
  /** 1-indexed page number. Defaults to 1 server-side. */
  page?: number;
  /** Page size. Clamped at 100 server-side; defaults to 50. */
  limit?: number;
}

/**
 * `{ records, total }` envelope from `POST /{id}/run` — a page of records
 * matching the view's filters/sort, in the records list wire shape.
 */
export interface SabcrmViewRunResponse {
  records: SabcrmRustRecord[];
  total: number;
}

/** Encode query params, dropping undefined/empty values. */
function qs(params: Record<string, string | number | undefined>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === '') continue;
    sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : '';
}

const BASE = '/v1/sabcrm/views';

export const sabcrmViewsApi = {
  /** `GET /v1/sabcrm/views` — list the views for one object. */
  async list(projectId: string, object: string): Promise<SabcrmRustView[]> {
    const res = await rustFetch<ListEnvelope>(
      `${BASE}${qs({ projectId, object })}`,
    );
    return res.views;
  },

  /** `POST /v1/sabcrm/views` — create a saved view. */
  async create(
    projectId: string,
    input: SabcrmViewCreateInput,
  ): Promise<SabcrmRustView> {
    const res = await rustFetch<SingleEnvelope>(BASE, {
      method: 'POST',
      body: JSON.stringify({ projectId, ...input }),
    });
    return res.view;
  },

  /** `PATCH /v1/sabcrm/views/{id}` — partial update. */
  async update(
    projectId: string,
    id: string,
    input: SabcrmViewUpdateInput,
  ): Promise<SabcrmRustView> {
    const res = await rustFetch<SingleEnvelope>(
      `${BASE}/${encodeURIComponent(id)}`,
      { method: 'PATCH', body: JSON.stringify({ projectId, ...input }) },
    );
    return res.view;
  },

  /** `DELETE /v1/sabcrm/views/{id}` — scoped delete. */
  remove(projectId: string, id: string): Promise<{ ok: boolean }> {
    return rustFetch<{ ok: boolean }>(
      `${BASE}/${encodeURIComponent(id)}${qs({ projectId })}`,
      { method: 'DELETE' },
    );
  },

  /** `POST /v1/sabcrm/views/{id}/default` — make this view the object default. */
  async setDefault(projectId: string, id: string): Promise<SabcrmRustView> {
    const res = await rustFetch<SingleEnvelope>(
      `${BASE}/${encodeURIComponent(id)}/default`,
      { method: 'POST', body: JSON.stringify({ projectId }) },
    );
    return res.view;
  },

  /**
   * `POST /v1/sabcrm/views/{id}/run` — apply the saved view's filters/sort to
   * the records collection server-side and return a page of records.
   */
  run(
    projectId: string,
    id: string,
    opts?: SabcrmViewRunOpts,
  ): Promise<SabcrmViewRunResponse> {
    return rustFetch<SabcrmViewRunResponse>(
      `${BASE}/${encodeURIComponent(id)}/run`,
      {
        method: 'POST',
        body: JSON.stringify({
          projectId,
          page: opts?.page,
          limit: opts?.limit,
        }),
      },
    );
  },
};
