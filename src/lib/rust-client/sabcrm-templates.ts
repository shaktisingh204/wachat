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
  subject?: string;
  body: string;
}

/** `PATCH /{id}` body sans `projectId` — a partial template document. */
export interface SabcrmTemplateUpdateInput {
  name?: string;
  kind?: SabcrmTemplateKind | string;
  subject?: string;
  body?: string;
  [key: string]: unknown;
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
  /** `GET /v1/sabcrm/templates` — list templates, optionally filtered by kind. */
  async list(
    projectId: string,
    kind?: string,
  ): Promise<SabcrmRustTemplate[]> {
    const res = await rustFetch<ListEnvelope>(
      `${BASE}${qs({ projectId, kind })}`,
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

  /** `DELETE /v1/sabcrm/templates/{id}` — scoped delete. */
  remove(projectId: string, id: string): Promise<{ ok: boolean }> {
    return rustFetch<{ ok: boolean }>(
      `${BASE}/${encodeURIComponent(id)}${qs({ projectId })}`,
      { method: 'DELETE' },
    );
  },
};
