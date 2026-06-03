import 'server-only';

/**
 * SabCRM Activities client — wraps the Rust `/v1/sabcrm/activities` surface
 * (crate `sabcrm-activities`, mounted by `sabnode-api`).
 *
 * The activities timeline is a per-project feed of NOTE / TASK / CALL /
 * MEETING / EMAIL / COMMENT entries, each attached to a single record via
 * `(targetObject, targetRecordId)`. Tenant scope is `projectId`; the Rust
 * side additionally requires a valid `AuthUser` JWT, which {@link rustFetch}
 * mints from the session cookie.
 *
 * The Rust handlers wrap responses in `{ activities: [...] }` (list) and
 * `{ activity: {...} }` (single); this client unwraps them so callers get the
 * raw rows. Wire shapes (camelCase) mirror the Rust handlers in
 * `rust/crates/sabcrm-activities/src/{dto,handlers}.rs`.
 */
import { rustFetch } from './fetcher';

/** A SabCRM activity as returned by the Rust engine (`_id` → `id` hex). */
export interface SabcrmRustActivity {
  id: string;
  projectId: string;
  /** NOTE | TASK | CALL | MEETING | EMAIL | COMMENT. */
  type: string;
  title: string;
  body?: string;
  targetObject: string;
  targetRecordId: string;
  authorId: string;
  /** TASK-only workflow status (TODO | IN_PROGRESS | DONE). */
  status?: string;
  /** TASK-only assignee user id. */
  assigneeId?: string;
  /** TASK-only due date (RFC3339). */
  dueAt?: string;
  createdAt: string;
  updatedAt: string;
}

/** `GET /` query params. `projectId` is required; the rest narrow / filter. */
export interface SabcrmActivityListParams {
  projectId: string;
  /** Object slug of the record whose timeline to read (optional). */
  targetObject?: string;
  /** Serialized id of the record whose timeline to read (optional). */
  targetRecordId?: string;
  /** Optional `type` filter (NOTE | TASK | CALL | MEETING | EMAIL | COMMENT). */
  type?: string;
  /** Page size. Clamped at 200 server-side; defaults to 50. */
  limit?: number;
}

/** `POST /` body — create a timeline activity. */
export interface SabcrmActivityCreateInput {
  projectId: string;
  /** Entry kind (NOTE | TASK | CALL | MEETING | EMAIL | COMMENT). */
  type: string;
  title: string;
  body?: string;
  targetObject: string;
  targetRecordId: string;
  authorId: string;
  status?: string;
  assigneeId?: string;
  dueAt?: string;
}

/**
 * `PATCH /{id}` body — partial update. `projectId` scopes the row; every
 * other key is `$set` verbatim (e.g. `{ status: 'DONE' }`).
 */
export interface SabcrmActivityUpdateInput {
  projectId: string;
  [key: string]: unknown;
}

/** Raw `{ activities }` envelope from `GET /`. */
interface ListEnvelope {
  activities: SabcrmRustActivity[];
}

/** Raw `{ activity }` envelope from `POST /` and `PATCH /{id}`. */
interface SingleEnvelope {
  activity: SabcrmRustActivity;
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

const BASE = '/v1/sabcrm/activities';

export const sabcrmActivitiesApi = {
  /** `GET /v1/sabcrm/activities` — timeline list, newest first. */
  async list(
    params: SabcrmActivityListParams,
  ): Promise<SabcrmRustActivity[]> {
    const res = await rustFetch<ListEnvelope>(
      `${BASE}${qs({
        projectId: params.projectId,
        targetObject: params.targetObject,
        targetRecordId: params.targetRecordId,
        type: params.type,
        limit: params.limit,
      })}`,
    );
    return res.activities;
  },

  /** `POST /v1/sabcrm/activities` — create a timeline entry. */
  async create(
    input: SabcrmActivityCreateInput,
  ): Promise<SabcrmRustActivity> {
    const res = await rustFetch<SingleEnvelope>(BASE, {
      method: 'POST',
      body: JSON.stringify(input),
    });
    return res.activity;
  },

  /** `PATCH /v1/sabcrm/activities/{id}` — partial update. */
  async update(
    id: string,
    input: SabcrmActivityUpdateInput,
  ): Promise<SabcrmRustActivity> {
    const res = await rustFetch<SingleEnvelope>(
      `${BASE}/${encodeURIComponent(id)}`,
      { method: 'PATCH', body: JSON.stringify(input) },
    );
    return res.activity;
  },

  /** `DELETE /v1/sabcrm/activities/{id}` — scoped delete. */
  remove(id: string, projectId: string): Promise<{ ok: boolean }> {
    return rustFetch<{ ok: boolean }>(
      `${BASE}/${encodeURIComponent(id)}${qs({ projectId })}`,
      { method: 'DELETE' },
    );
  },
};
