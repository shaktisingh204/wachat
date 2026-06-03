import 'server-only';

/**
 * SabCRM Objects client — wraps the Rust `/v1/sabcrm/objects` surface
 * (crate `sabcrm-objects`, mounted by `sabnode-api`).
 *
 * Object metadata is metadata-driven: the engine merges the six built-in
 * standard objects with per-project custom objects + extension fields. Tenant
 * scope is `projectId`; the Rust side requires a valid `AuthUser` JWT.
 *
 * The Rust handlers wrap responses in `{ objects: [...] }` (list) and
 * `{ object: {...} }` (single); this client unwraps them. The wire `object`
 * shape is the same `ObjectMetadata` the native metadata layer uses (see
 * `@/lib/sabcrm/types`), so we reuse that type. Mirrors
 * `rust/crates/sabcrm-objects/src/{dto,handlers}.rs`.
 */
import { rustFetch } from './fetcher';
import type { ObjectMetadata } from '@/lib/sabcrm/types';

/** `PATCH /{slug}` patch body sans `projectId` — a partial object document. */
export interface SabcrmObjectUpdateInput {
  [key: string]: unknown;
}

/** Raw `{ objects }` envelope from `GET /`. */
interface ListEnvelope {
  objects: ObjectMetadata[];
}

/** Raw `{ object }` envelope from `GET /{slug}`, `POST /`, `PATCH /{slug}`. */
interface SingleEnvelope {
  object: ObjectMetadata;
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

const BASE = '/v1/sabcrm/objects';

export const sabcrmObjectsApi = {
  /** `GET /v1/sabcrm/objects` — merged standard + custom object list. */
  async list(projectId: string): Promise<ObjectMetadata[]> {
    const res = await rustFetch<ListEnvelope>(`${BASE}${qs({ projectId })}`);
    return res.objects;
  },

  /** `GET /v1/sabcrm/objects/{slug}` — one merged object. */
  async get(slug: string, projectId: string): Promise<ObjectMetadata> {
    const res = await rustFetch<SingleEnvelope>(
      `${BASE}/${encodeURIComponent(slug)}${qs({ projectId })}`,
    );
    return res.object;
  },

  /** `POST /v1/sabcrm/objects` — insert a custom object. */
  async create(
    projectId: string,
    object: ObjectMetadata,
  ): Promise<ObjectMetadata> {
    const res = await rustFetch<SingleEnvelope>(BASE, {
      method: 'POST',
      body: JSON.stringify({ projectId, object }),
    });
    return res.object;
  },

  /** `PATCH /v1/sabcrm/objects/{slug}` — partial update of a custom object. */
  async update(
    projectId: string,
    slug: string,
    patch: SabcrmObjectUpdateInput,
  ): Promise<ObjectMetadata> {
    const res = await rustFetch<SingleEnvelope>(
      `${BASE}/${encodeURIComponent(slug)}`,
      { method: 'PATCH', body: JSON.stringify({ projectId, patch }) },
    );
    return res.object;
  },

  /** `DELETE /v1/sabcrm/objects/{slug}` — delete a custom object. */
  remove(projectId: string, slug: string): Promise<{ ok: boolean }> {
    return rustFetch<{ ok: boolean }>(
      `${BASE}/${encodeURIComponent(slug)}${qs({ projectId })}`,
      { method: 'DELETE' },
    );
  },
};
