import 'server-only';

/**
 * SabCRM Audit client — wraps the Rust `/v1/sabcrm/audit` surface
 * (crate `sabcrm-audit`, mounted by `sabnode-api`).
 *
 * An audit entry is an append-only change-log row: an `action`
 * (`create` / `update` / `delete` / arbitrary) against an optional
 * `object` + `recordId` within a project, with an optional human `summary`
 * and structured `meta`. The acting `actorId` is resolved on the Rust side
 * from the `AuthUser` JWT — never sent in the body. Tenant scope is
 * `projectId`.
 *
 * The Rust handlers wrap responses in `{ entries: [...] }` (list) and
 * `{ entry: {...} }` (single); this client unwraps them. Wire shapes mirror
 * `rust/crates/sabcrm-audit/src/{dto,handlers}.rs`.
 */
import { rustFetch } from './fetcher';

/** A SabCRM audit entry as returned by the Rust engine (`_id` → `id` hex). */
export interface SabcrmRustAuditEntry {
  id: string;
  projectId: string;
  actorId: string;
  action: string;
  object?: string;
  recordId?: string;
  summary?: string;
  meta?: Record<string, unknown>;
  createdAt: string;
}

/** Body accepted by {@link sabcrmAuditApi.log}. */
export interface SabcrmAuditLogInput {
  action: string;
  object?: string;
  recordId?: string;
  summary?: string;
  meta?: Record<string, unknown>;
}

/** Optional filters for {@link sabcrmAuditApi.list}. */
export interface SabcrmAuditListOpts {
  object?: string;
  recordId?: string;
  limit?: number;
}

/** Raw `{ entries }` envelope from `GET /`. */
interface ListEnvelope {
  entries: SabcrmRustAuditEntry[];
}

/** Raw `{ entry }` envelope from `POST /`. */
interface SingleEnvelope {
  entry: SabcrmRustAuditEntry;
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

const BASE = '/v1/sabcrm/audit';

export const sabcrmAuditApi = {
  /** `GET /v1/sabcrm/audit` — a project's audit entries, newest first. */
  async list(
    projectId: string,
    opts?: SabcrmAuditListOpts,
  ): Promise<SabcrmRustAuditEntry[]> {
    const res = await rustFetch<ListEnvelope>(
      `${BASE}${qs({
        projectId,
        object: opts?.object,
        recordId: opts?.recordId,
        limit: opts?.limit,
      })}`,
    );
    return res.entries;
  },

  /** `POST /v1/sabcrm/audit` — append an audit entry for the caller. */
  async log(
    projectId: string,
    input: SabcrmAuditLogInput,
  ): Promise<SabcrmRustAuditEntry> {
    const res = await rustFetch<SingleEnvelope>(`${BASE}${qs({ projectId })}`, {
      method: 'POST',
      body: JSON.stringify({ projectId, ...input }),
    });
    return res.entry;
  },
};
