import 'server-only';

/**
 * SabCRM Templates client — wraps the Rust `/v1/sabcrm/templates` surface
 * (crate `sabcrm-templates`, mounted by `sabnode-api`).
 *
 * A template is a reusable note / email / task body (`name`, `kind`,
 * optional `subject`, `body`). Tenant scope is `projectId`; the Rust side
 * requires a valid `AuthUser` JWT.
 *
 * The Rust handlers wrap responses in `{ templates: [...] }` (list) and
 * `{ template: {...} }` (single); this client unwraps them. Wire shapes
 * mirror `rust/crates/sabcrm-templates/src/{dto,handlers}.rs`.
 */
import { rustFetch } from './fetcher';

/** A SabCRM template kind. */
export type SabcrmTemplateKind = 'note' | 'email' | 'task';

/** A SabCRM template as returned by the Rust engine (`_id` → `id` hex). */
export interface SabcrmRustTemplate {
  id: string;
  projectId: string;
  name: string;
  kind: SabcrmTemplateKind | string;
  /**
   * Optional per-object association (CRM object slug, e.g. `companies`).
   * Mirrors Twenty's object-scoped message/note templates.
   */
  objectType?: string;
  subject?: string;
  body: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * `POST /` body sans `projectId`. Sent as `{ projectId, ...input }`.
 */
export interface SabcrmTemplateCreateInput {
  name: string;
  kind: SabcrmTemplateKind | string;
  /**
   * Optional per-object association (CRM object slug, e.g. `companies`).
   * Mirrors Twenty's object-scoped templates.
   */
  objectType?: string;
  subject?: string;
  body: string;
}

/** `PATCH /{id}` body sans `projectId` — a partial template document. */
export interface SabcrmTemplateUpdateInput {
  name?: string;
  kind?: SabcrmTemplateKind | string;
  objectType?: string;
  subject?: string;
  body?: string;
  [key: string]: unknown;
}

/** Optional filters for {@link sabcrmTemplatesApi.list}. */
export interface SabcrmTemplateListOpts {
  /** Filter by kind (`note` | `email` | `task`). */
  kind?: SabcrmTemplateKind | string;
  /** Filter by per-object association (CRM object slug, e.g. `companies`). */
  objectType?: string;
}

/**
 * Body for {@link sabcrmTemplatesApi.render} sans `id` — render a stored
 * template against a variable source. Variables come from `recordId` + `object`
 * (the record's `data` map) and/or an inline `variables` map (layered on top
 * of a fetched record, or used alone for a preview). Mirrors `RenderInput`.
 */
export interface SabcrmTemplateRenderInput {
  /** CRM object slug for the record lookup (required when `recordId` set). */
  object?: string;
  /** Id of a record in `sabcrm_records` to source variables from. */
  recordId?: string;
  /** Inline variable map (used alone, or layered over a fetched record). */
  variables?: Record<string, unknown>;
}

/**
 * Body for {@link sabcrmTemplatesApi.preview} — render an ad-hoc, not-yet-saved
 * `subject` / `body` against the same variable sources as
 * {@link SabcrmTemplateRenderInput}. Mirrors the Rust `PreviewInput`.
 */
export interface SabcrmTemplatePreviewInput {
  /** Optional subject template string. */
  subject?: string;
  /** Body template string — required. */
  body: string;
  /** CRM object slug for the record lookup (required when `recordId` set). */
  object?: string;
  /** Id of a record in `sabcrm_records` to source variables from. */
  recordId?: string;
  /** Inline variable map (used alone, or layered over a fetched record). */
  variables?: Record<string, unknown>;
}

/**
 * Response from the render / preview endpoints — the interpolated strings plus
 * the distinct `{{placeholder}}` paths that did not resolve. Mirrors the Rust
 * `RenderResponse`.
 */
export interface SabcrmTemplateRenderResult {
  /** Rendered subject (omitted when the template had no subject). */
  subject?: string;
  /** Rendered body. */
  body: string;
  /**
   * Distinct `{{placeholder}}` paths that resolved to no value, across both
   * subject and body. Useful for highlighting gaps in a preview.
   */
  missingVariables: string[];
}

/** Raw `{ templates }` envelope from `GET /`. */
interface ListEnvelope {
  templates: SabcrmRustTemplate[];
}

/** Raw `{ template }` envelope from `GET /{id}`, `POST /`, `PATCH /{id}`. */
interface SingleEnvelope {
  template: SabcrmRustTemplate;
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

const BASE = '/v1/sabcrm/templates';

export const sabcrmTemplatesApi = {
  /**
   * `GET /v1/sabcrm/templates` — list templates, optionally filtered by `kind`
   * and/or `objectType` (the CRM object slug the template is scoped to). The
   * second arg may be a bare `kind` string (backward-compatible) or a
   * {@link SabcrmTemplateListOpts} object.
   */
  async list(
    projectId: string,
    opts?: string | SabcrmTemplateListOpts,
  ): Promise<SabcrmRustTemplate[]> {
    const o: SabcrmTemplateListOpts =
      typeof opts === 'string' ? { kind: opts } : opts ?? {};
    const res = await rustFetch<ListEnvelope>(
      `${BASE}${qs({ projectId, kind: o.kind, objectType: o.objectType })}`,
    );
    return res.templates;
  },

  /** `GET /v1/sabcrm/templates/{id}` — fetch a single template. */
  async get(projectId: string, id: string): Promise<SabcrmRustTemplate> {
    const res = await rustFetch<SingleEnvelope>(
      `${BASE}/${encodeURIComponent(id)}${qs({ projectId })}`,
    );
    return res.template;
  },

  /** `POST /v1/sabcrm/templates` — create a template. */
  async create(
    projectId: string,
    input: SabcrmTemplateCreateInput,
  ): Promise<SabcrmRustTemplate> {
    const res = await rustFetch<SingleEnvelope>(BASE, {
      method: 'POST',
      body: JSON.stringify({ projectId, ...input }),
    });
    return res.template;
  },

  /** `PATCH /v1/sabcrm/templates/{id}` — partial update. */
  async update(
    projectId: string,
    id: string,
    input: SabcrmTemplateUpdateInput,
  ): Promise<SabcrmRustTemplate> {
    const res = await rustFetch<SingleEnvelope>(
      `${BASE}/${encodeURIComponent(id)}`,
      { method: 'PATCH', body: JSON.stringify({ projectId, ...input }) },
    );
    return res.template;
  },

  /**
   * `POST /v1/sabcrm/templates/{id}/render` — render a stored template against
   * a record (`recordId` + `object`) and/or an inline `variables` map. Returns
   * the interpolated `{ subject?, body, missingVariables }`.
   */
  render(
    projectId: string,
    id: string,
    input?: SabcrmTemplateRenderInput,
  ): Promise<SabcrmTemplateRenderResult> {
    return rustFetch<SabcrmTemplateRenderResult>(
      `${BASE}/${encodeURIComponent(id)}/render`,
      { method: 'POST', body: JSON.stringify({ projectId, ...input }) },
    );
  },

  /**
   * `POST /v1/sabcrm/templates/preview` — render an ad-hoc (not-yet-saved)
   * `subject` / `body` against the same variable sources as {@link render}.
   * Returns `{ subject?, body, missingVariables }`.
   */
  preview(
    projectId: string,
    input: SabcrmTemplatePreviewInput,
  ): Promise<SabcrmTemplateRenderResult> {
    return rustFetch<SabcrmTemplateRenderResult>(`${BASE}/preview`, {
      method: 'POST',
      body: JSON.stringify({ projectId, ...input }),
    });
  },

  /** `DELETE /v1/sabcrm/templates/{id}` — scoped delete. */
  remove(projectId: string, id: string): Promise<{ ok: boolean }> {
    return rustFetch<{ ok: boolean }>(
      `${BASE}/${encodeURIComponent(id)}${qs({ projectId })}`,
      { method: 'DELETE' },
    );
  },
};
