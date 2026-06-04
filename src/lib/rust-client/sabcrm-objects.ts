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
import type {
  FieldMetadata as BaseFieldMetadata,
  ObjectMetadata as BaseObjectMetadata,
} from '@/lib/sabcrm/types';

/**
 * Physical index type. Mirrors Twenty's `IndexType` — `BTREE` (default,
 * scalar keys) or `GIN` (jsonb / array / tsvector; persist-only on Mongo).
 */
export type SabcrmIndexType = 'BTREE' | 'GIN';

/**
 * One index definition on an object (Twenty `IndexMetadata` distilled).
 * Field entries are field `key`s; the records collection maps them to
 * `data.<key>` and always prefixes the physical index with `projectId` +
 * `object`.
 */
export interface SabcrmIndexMetadata {
  /** Index name (unique per object). */
  name: string;
  /** Ordered list of field keys participating in the index. */
  fields: string[];
  /** UNIQUE constraint. A single-field unique index drives `isUnique`. */
  unique?: boolean;
  /** Physical index type (`BTREE` default). */
  type?: SabcrmIndexType;
}

/**
 * Field metadata as carried by the Rust object surface — a superset of the
 * native {@link BaseFieldMetadata} with the Twenty-parity additions
 * `settings` (type-discriminated blob) and `isUnique`.
 */
export interface SabcrmFieldMetadata extends BaseFieldMetadata {
  /** Type-discriminated per-field settings blob (free-form JSON). */
  settings?: Record<string, unknown>;
  /** Whether this field is backed by a single-field UNIQUE index. */
  isUnique?: boolean;
}

/**
 * Object metadata as carried by the Rust object surface — a superset of the
 * native {@link BaseObjectMetadata} with the Twenty-parity flags
 * (`isSystem`, `isSearchable`), a `labelIdentifier` (field key acting as the
 * record title) and first-class `indexes`. `fields` is widened to carry the
 * per-field additions.
 */
export interface ObjectMetadata extends BaseObjectMetadata {
  fields: SabcrmFieldMetadata[];
  /** Internal object not surfaced as a normal CRM object. */
  isSystem?: boolean;
  /** Whether records of this object are indexed into search. */
  isSearchable?: boolean;
  /** Field `key` that acts as the record's display label. */
  labelIdentifier?: string;
  /** First-class index definitions for this object's records. */
  indexes?: SabcrmIndexMetadata[];
}

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

/**
 * Result of `POST /{slug}/sync` — the idempotent seed reconciliation report
 * for a system object (e.g. `workspaceMembers`) against the project team.
 */
export interface SabcrmSyncResult {
  /** Whether the sync ran successfully. */
  ok: boolean;
  /** Records inserted or refreshed from the project team. */
  upserted: number;
  /** Stale records removed (no longer on the team). */
  removed: number;
  /** Total records of the object after reconciliation. */
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

  /**
   * `PUT /v1/sabcrm/objects/{slug}/indexes` — replace the object's index
   * definitions and best-effort reconcile real `sabcrm_records` indexes
   * (scoped by `projectId` + object). Returns the merged object.
   */
  async setIndexes(
    projectId: string,
    slug: string,
    indexes: SabcrmIndexMetadata[],
  ): Promise<ObjectMetadata> {
    const res = await rustFetch<SingleEnvelope>(
      `${BASE}/${encodeURIComponent(slug)}/indexes`,
      { method: 'PUT', body: JSON.stringify({ projectId, indexes }) },
    );
    return res.object;
  },

  /**
   * `POST /v1/sabcrm/objects/{slug}/sync` — idempotently seed the object's
   * records from the project team (Wave 2). For `workspaceMembers` this upserts
   * a record per team member and removes records for members no longer on the
   * team, so relation / ACTOR enrichment can resolve real people. Returns the
   * reconciliation report.
   */
  sync(projectId: string, slug: string): Promise<SabcrmSyncResult> {
    return rustFetch<SabcrmSyncResult>(
      `${BASE}/${encodeURIComponent(slug)}/sync`,
      { method: 'POST', body: JSON.stringify({ projectId }) },
    );
  },
};
