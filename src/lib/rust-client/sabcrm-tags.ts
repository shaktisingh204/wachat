import 'server-only';

/**
 * SabCRM Tags client — wraps the Rust `/v1/sabcrm/tags` surface
 * (crate `sabcrm-tags`, mounted by `sabnode-api`).
 *
 * A tag is a workspace-level label definition (`name`, `color`) within a
 * project. Tenant scope is `projectId`; the Rust side requires a valid
 * `AuthUser` JWT. A per-project unique `name` is enforced server-side: a
 * `create` (or rename) onto an existing name throws a `409` `RustApiError`.
 *
 * The Rust handlers wrap responses in `{ tags: [...] }` (list) and
 * `{ tag: {...} }` (single); this client unwraps them. Wire shapes mirror
 * `rust/crates/sabcrm-tags/src/{dto,handlers}.rs`.
 */
import { rustFetch } from './fetcher';

/** A SabCRM tag as returned by the Rust engine (`_id` → `id` hex). */
export interface SabcrmRustTag {
  id: string;
  projectId: string;
  name: string;
  color: string;
  createdAt: string;
}

/** `POST /` body sans `projectId`. Sent as `{ projectId, ...input }`. */
export interface SabcrmTagCreateInput {
  name: string;
  color?: string;
}

/** `PATCH /{id}` body sans `projectId` — a partial tag document. */
export interface SabcrmTagUpdateInput {
  name?: string;
  color?: string;
}

/** Raw `{ tags }` envelope from `GET /`. */
interface ListEnvelope {
  tags: SabcrmRustTag[];
}

/** Raw `{ tag }` envelope from `POST /` and `PATCH /{id}`. */
interface SingleEnvelope {
  tag: SabcrmRustTag;
}

/** Encode query params, dropping undefined/empty values. */
function qs(params: Record<string, string | undefined>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === '') continue;
    sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : '';
}

const BASE = '/v1/sabcrm/tags';

export const sabcrmTagsApi = {
  /** `GET /v1/sabcrm/tags` — list the tags for a project. */
  async list(projectId: string): Promise<SabcrmRustTag[]> {
    const res = await rustFetch<ListEnvelope>(`${BASE}${qs({ projectId })}`);
    return res.tags;
  },

  /** `POST /v1/sabcrm/tags` — create a tag (409 on duplicate name). */
  async create(
    projectId: string,
    input: SabcrmTagCreateInput,
  ): Promise<SabcrmRustTag> {
    const res = await rustFetch<SingleEnvelope>(BASE, {
      method: 'POST',
      body: JSON.stringify({ projectId, ...input }),
    });
    return res.tag;
  },

  /** `PATCH /v1/sabcrm/tags/{id}` — partial update (409 on duplicate name). */
  async update(
    projectId: string,
    id: string,
    input: SabcrmTagUpdateInput,
  ): Promise<SabcrmRustTag> {
    const res = await rustFetch<SingleEnvelope>(
      `${BASE}/${encodeURIComponent(id)}`,
      { method: 'PATCH', body: JSON.stringify({ projectId, ...input }) },
    );
    return res.tag;
  },

  /** `DELETE /v1/sabcrm/tags/{id}` — scoped delete. */
  remove(projectId: string, id: string): Promise<{ ok: boolean }> {
    return rustFetch<{ ok: boolean }>(
      `${BASE}/${encodeURIComponent(id)}${qs({ projectId })}`,
      { method: 'DELETE' },
    );
  },
};
