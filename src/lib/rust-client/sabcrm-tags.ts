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
  /**
   * Derived count of records this tag is applied to. Present on `list` / `get`
   * / `create` / `update` responses (computed server-side); absent on rows
   * returned by other surfaces.
   */
  usageCount?: number;
}

/**
 * A tag→record assignment row in the `sabcrm_tag_assignments` join table, as
 * returned by `apply` (`_id` → `id` hex). Mirrors the assignment document in
 * `rust/crates/sabcrm-tags/src/dto.rs`.
 */
export interface SabcrmTagAssignment {
  id: string;
  projectId: string;
  tagId: string;
  object: string;
  recordId: string;
  createdAt: string;
}

/**
 * A single `{ tagId, usageCount }` row from `GET /counts`. Mirrors `TagCount`
 * in `rust/crates/sabcrm-tags/src/dto.rs`.
 */
export interface SabcrmTagCount {
  tagId: string;
  usageCount: number;
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

/** Raw `{ tag }` envelope from `POST /`, `PATCH /{id}` and `GET /{id}`. */
interface SingleEnvelope {
  tag: SabcrmRustTag;
}

/** Raw `{ assignment }` envelope from `POST /{id}/apply`. */
interface AssignmentEnvelope {
  assignment: SabcrmTagAssignment;
}

/**
 * Raw `{ records }` envelope from `GET /{id}/records` — the records a tag is
 * applied to (raw record documents, `_id` → `id`).
 */
interface TaggedRecordsEnvelope {
  records: Record<string, unknown>[];
}

/** Raw `{ tags }` envelope from `GET /for-record` — the tags on one record. */
interface TagsForRecordEnvelope {
  tags: SabcrmRustTag[];
}

/** Raw `{ counts }` envelope from `GET /counts`. */
interface CountsEnvelope {
  counts: SabcrmTagCount[];
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
  /** `GET /v1/sabcrm/tags` — list the tags for a project (with usage counts). */
  async list(projectId: string): Promise<SabcrmRustTag[]> {
    const res = await rustFetch<ListEnvelope>(`${BASE}${qs({ projectId })}`);
    return res.tags;
  },

  /** `GET /v1/sabcrm/tags/{id}` — fetch one tag (with usage count). */
  async get(projectId: string, id: string): Promise<SabcrmRustTag> {
    const res = await rustFetch<SingleEnvelope>(
      `${BASE}/${encodeURIComponent(id)}${qs({ projectId })}`,
    );
    return res.tag;
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

  /** `DELETE /v1/sabcrm/tags/{id}` — scoped delete (cascades assignments). */
  remove(projectId: string, id: string): Promise<{ ok: boolean }> {
    return rustFetch<{ ok: boolean }>(
      `${BASE}/${encodeURIComponent(id)}${qs({ projectId })}`,
      { method: 'DELETE' },
    );
  },

  /**
   * `POST /v1/sabcrm/tags/{id}/apply` — apply a tag to a single record
   * (upsert into the assignments join table). Returns the assignment row.
   */
  async apply(
    projectId: string,
    id: string,
    object: string,
    recordId: string,
  ): Promise<SabcrmTagAssignment> {
    const res = await rustFetch<AssignmentEnvelope>(
      `${BASE}/${encodeURIComponent(id)}/apply`,
      {
        method: 'POST',
        body: JSON.stringify({ projectId, object, recordId }),
      },
    );
    return res.assignment;
  },

  /**
   * `DELETE /v1/sabcrm/tags/{id}/apply` — remove a tag from a single record.
   * Idempotent.
   */
  remove_apply(
    projectId: string,
    id: string,
    object: string,
    recordId: string,
  ): Promise<{ ok: boolean }> {
    return rustFetch<{ ok: boolean }>(
      `${BASE}/${encodeURIComponent(id)}/apply${qs({
        projectId,
        object,
        recordId,
      })}`,
      { method: 'DELETE' },
    );
  },

  /**
   * `GET /v1/sabcrm/tags/{id}/records` — list the records a tag is applied to,
   * optionally filtered to a single `object` slug. Returns raw record
   * documents (`_id` → `id`).
   */
  async records(
    projectId: string,
    id: string,
    object?: string,
  ): Promise<Record<string, unknown>[]> {
    const res = await rustFetch<TaggedRecordsEnvelope>(
      `${BASE}/${encodeURIComponent(id)}/records${qs({ projectId, object })}`,
    );
    return res.records;
  },

  /**
   * `GET /v1/sabcrm/tags/for-record` — list the tags applied to one record.
   */
  async forRecord(
    projectId: string,
    object: string,
    recordId: string,
  ): Promise<SabcrmRustTag[]> {
    const res = await rustFetch<TagsForRecordEnvelope>(
      `${BASE}/for-record${qs({ projectId, object, recordId })}`,
    );
    return res.tags;
  },

  /**
   * `GET /v1/sabcrm/tags/counts` — per-tag usage counts for a project.
   */
  async counts(projectId: string): Promise<SabcrmTagCount[]> {
    const res = await rustFetch<CountsEnvelope>(
      `${BASE}/counts${qs({ projectId })}`,
    );
    return res.counts;
  },
};
