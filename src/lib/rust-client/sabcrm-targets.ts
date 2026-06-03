import 'server-only';

/**
 * SabCRM Targets client — wraps the Rust `/v1/sabcrm/targets` surface
 * (crate `sabcrm-targets`, mounted by `sabnode-api`).
 *
 * Targets are polymorphic junctions linking ONE source activity (a note /
 * task / activity) to MANY records of ANY object — Twenty's `task-target` /
 * `note-target` morph pattern. Each row is
 * `(sourceObject, sourceId) → (targetObject, targetId)`. Tenant scope is
 * `projectId`. The two list directions answer:
 *
 *   - `listForSource` — what records a note / task points at; and
 *   - `listForRecord` — what notes / tasks are attached to a record.
 *
 * The Rust handlers wrap responses in `{ targets: [...] }` (list) and
 * `{ target: {...} }` (single); this client unwraps them. Wire shapes
 * mirror `rust/crates/sabcrm-targets/src/{dto,handlers}.rs`.
 */
import { rustFetch } from './fetcher';

/** A SabCRM target row as returned by the Rust engine (`_id` → `id` hex). */
export interface SabcrmRustTarget {
  id: string;
  projectId: string;
  /** Source activity kind (`notes` | `tasks` | `activities`). */
  sourceObject: string;
  sourceId: string;
  /** Object slug of the linked record (e.g. `companies`, `people`). */
  targetObject: string;
  targetId: string;
  createdAt: string;
}

/** Raw `{ targets }` envelope from the `GET` directions. */
interface ListEnvelope {
  targets: SabcrmRustTarget[];
}

/** Raw `{ target }` envelope from `POST /`. */
interface SingleEnvelope {
  target: SabcrmRustTarget;
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

const BASE = '/v1/sabcrm/targets';

export const sabcrmTargetsApi = {
  /**
   * `GET /v1/sabcrm/targets` — the records a single note / task / activity
   * is attached to, newest first.
   */
  async listForSource(
    projectId: string,
    sourceObject: string,
    sourceId: string,
  ): Promise<SabcrmRustTarget[]> {
    const res = await rustFetch<ListEnvelope>(
      `${BASE}${qs({ projectId, sourceObject, sourceId })}`,
    );
    return res.targets;
  },

  /**
   * `GET /v1/sabcrm/targets/for-record` — the notes / tasks / activities
   * attached to a single record, newest first.
   */
  async listForRecord(
    projectId: string,
    targetObject: string,
    targetId: string,
  ): Promise<SabcrmRustTarget[]> {
    const res = await rustFetch<ListEnvelope>(
      `${BASE}/for-record${qs({ projectId, targetObject, targetId })}`,
    );
    return res.targets;
  },

  /** `POST /v1/sabcrm/targets` — link a source to a record (idempotent). */
  async link(
    projectId: string,
    sourceObject: string,
    sourceId: string,
    targetObject: string,
    targetId: string,
  ): Promise<SabcrmRustTarget> {
    const res = await rustFetch<SingleEnvelope>(BASE, {
      method: 'POST',
      body: JSON.stringify({
        projectId,
        sourceObject,
        sourceId,
        targetObject,
        targetId,
      }),
    });
    return res.target;
  },

  /** `DELETE /v1/sabcrm/targets` — unlink a source from a record (idempotent). */
  unlink(
    projectId: string,
    sourceObject: string,
    sourceId: string,
    targetObject: string,
    targetId: string,
  ): Promise<{ ok: boolean }> {
    return rustFetch<{ ok: boolean }>(
      `${BASE}${qs({ projectId, sourceObject, sourceId, targetObject, targetId })}`,
      { method: 'DELETE' },
    );
  },
};
