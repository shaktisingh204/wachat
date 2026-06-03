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

/** A SabCRM record-page layout as returned by the Rust engine. */
export interface SabcrmRustPageLayout {
  id: string;
  projectId: string;
  object: string;
  tabs: SabcrmLayoutTab[];
  createdAt: string;
  updatedAt: string;
}

/** Encode query params, dropping undefined/empty values. */
function qs(params: Record<string, string | undefined>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === '') continue;
    sp.set(k, v);
  }
  const s = sp.toString();
  return s ? `?${s}` : '';
}

const BASE = '/v1/sabcrm/page-layouts';

export const sabcrmPageLayoutsApi = {
  /**
   * `GET /v1/sabcrm/page-layouts` — the layout for one object. The Rust
   * engine returns `404` when none is configured; callers that want a
   * graceful empty default should catch that.
   */
  get(projectId: string, object: string): Promise<SabcrmRustPageLayout> {
    return rustFetch<SabcrmRustPageLayout>(`${BASE}${qs({ projectId, object })}`);
  },

  /**
   * `PUT /v1/sabcrm/page-layouts` — upsert the layout for one object. The
   * query-string `projectId` / `object` are authoritative.
   */
  save(
    projectId: string,
    object: string,
    tabs: SabcrmLayoutTab[],
  ): Promise<SabcrmRustPageLayout> {
    return rustFetch<SabcrmRustPageLayout>(`${BASE}${qs({ projectId, object })}`, {
      method: 'PUT',
      body: JSON.stringify({ projectId, object, tabs }),
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
