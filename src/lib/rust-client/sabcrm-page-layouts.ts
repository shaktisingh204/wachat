import 'server-only';

/**
 * SabCRM Page-Layouts client — wraps the Rust `/v1/sabcrm/page-layouts`
 * surface (crate `sabcrm-page-layouts`, mounted by `sabnode-api`).
 *
 * A page layout is the configurable record-show composition for ONE object:
 * an ordered list of `tabs`, each an ordered list of `widgets` (FIELDS,
 * NOTES, TASKS, TIMELINE, FILES, RECORD_TABLE, RICH_TEXT, GRAPH, IFRAME, …).
 * There is exactly one layout per `(projectId, object)`; writes upsert.
 *
 * Tenant scope is `projectId`; the Rust side requires a valid `AuthUser`
 * JWT. Wire shapes mirror `rust/crates/sabcrm-page-layouts/src/{dto,handlers}.rs`.
 */
import { rustFetch } from './fetcher';

/**
 * Which record surface a layout composes (Twenty's `pageLayoutType`). SabCRM
 * renders the record **detail** page from `DETAIL` and reserves `FORM` for the
 * create/edit surface. Mirrors `PageLayoutType` in
 * `rust/crates/sabcrm-page-layouts/src/dto.rs`; the engine deserialises
 * leniently, falling unknown values back to `DETAIL`.
 */
export type SabcrmPageLayoutType = 'DETAIL' | 'FORM';

/** The widget kinds SabCRM renders on a record-show page. */
export type SabcrmWidgetType =
  | 'FIELDS'
  | 'NOTES'
  | 'TASKS'
  | 'TIMELINE'
  | 'FILES'
  | 'RECORD_TABLE'
  | 'RICH_TEXT'
  | 'GRAPH'
  | 'IFRAME'
  | (string & {});

/** One widget inside a tab. `config` is an opaque per-type blob. */
export interface SabcrmLayoutWidget {
  id: string;
  type: SabcrmWidgetType;
  title?: string;
  config?: unknown;
}

/** One tab — an ordered group of widgets. */
export interface SabcrmLayoutTab {
  id: string;
  title?: string;
  widgets: SabcrmLayoutWidget[];
}

/**
 * A SabCRM record-page layout as returned by the Rust engine — the structured
 * `LayoutResponse` (returned directly, not enveloped). Mirrors `LayoutResponse`
 * in `rust/crates/sabcrm-page-layouts/src/dto.rs`.
 */
export interface SabcrmRustPageLayout {
  /** Hex `_id` of the persisted layout document (empty for a server default). */
  id: string;
  projectId: string;
  object: string;
  /** Which record surface this layout composes. */
  pageLayoutType: SabcrmPageLayoutType;
  /**
   * `true` when this body is a server-built default rather than a stored row
   * (only ever set by `getDefault()` / `get(..., { withDefault: true })`). The
   * `id` is then empty and `createdAt` / `updatedAt` are empty strings.
   */
  isDefault: boolean;
  tabs: SabcrmLayoutTab[];
  /** RFC3339 creation timestamp (empty for a server-built default). */
  createdAt: string;
  /** RFC3339 last-update timestamp (empty for a server-built default). */
  updatedAt: string;
}

/** Encode query params, dropping undefined/empty values. */
function qs(
  params: Record<string, string | boolean | undefined>,
): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === '') continue;
    sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : '';
}

const BASE = '/v1/sabcrm/page-layouts';

export const sabcrmPageLayoutsApi = {
  /**
   * `GET /v1/sabcrm/page-layouts` — the layout for one object. By default the
   * Rust engine returns `404` when none is configured; pass
   * `{ withDefault: true }` to receive the server-built default layout (with an
   * empty `id` and `isDefault: true`) instead of a `404`.
   */
  get(
    projectId: string,
    object: string,
    opts?: { withDefault?: boolean },
  ): Promise<SabcrmRustPageLayout> {
    return rustFetch<SabcrmRustPageLayout>(
      `${BASE}${qs({ projectId, object, withDefault: opts?.withDefault })}`,
    );
  },

  /**
   * `GET /v1/sabcrm/page-layouts/default` — the per-object server-built default
   * layout (a Details tab + an Activity tab of Notes/Tasks/Timeline). Always
   * returns a body with an empty `id` and `isDefault: true`; never `404`s.
   */
  getDefault(
    projectId: string,
    object: string,
  ): Promise<SabcrmRustPageLayout> {
    return rustFetch<SabcrmRustPageLayout>(
      `${BASE}/default${qs({ projectId, object })}`,
    );
  },

  /**
   * `PUT /v1/sabcrm/page-layouts` — upsert the layout for one object. The
   * query-string `projectId` / `object` are authoritative. `pageLayoutType`
   * defaults to `DETAIL` server-side when omitted.
   */
  save(
    projectId: string,
    object: string,
    tabs: SabcrmLayoutTab[],
    pageLayoutType?: SabcrmPageLayoutType,
  ): Promise<SabcrmRustPageLayout> {
    return rustFetch<SabcrmRustPageLayout>(`${BASE}${qs({ projectId, object })}`, {
      method: 'PUT',
      body: JSON.stringify({ projectId, object, tabs, pageLayoutType }),
    });
  },

  /**
   * `DELETE /v1/sabcrm/page-layouts` — reset the object to the default
   * layout by deleting its persisted row. Idempotent.
   */
  reset(projectId: string, object: string): Promise<{ ok: boolean }> {
    return rustFetch<{ ok: boolean }>(`${BASE}${qs({ projectId, object })}`, {
      method: 'DELETE',
    });
  },
};
