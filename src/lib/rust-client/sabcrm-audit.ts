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

/**
 * A SabCRM audit entry as returned by the Rust engine (`_id` → `id` hex).
 * The canonical structured shape mirrors the Rust `AuditEvent` DTO — actor +
 * action + object/record target + timestamp + structured `meta`.
 */
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

/**
 * Alias for the fully-shaped Rust `AuditEvent` view of one `sabcrm_audit` row.
 * Identical on the wire to {@link SabcrmRustAuditEntry}; named to match the
 * Rust DTO for typed consumers.
 */
export type SabcrmAuditEvent = SabcrmRustAuditEntry;

/** Body accepted by {@link sabcrmAuditApi.log}. */
export interface SabcrmAuditLogInput {
  action: string;
  object?: string;
  recordId?: string;
  summary?: string;
  meta?: Record<string, unknown>;
}

/**
 * Optional filters for {@link sabcrmAuditApi.list} / {@link sabcrmAuditApi.listPaged}.
 * Twenty-parity: the append-only log can be narrowed by acting `actorId`,
 * `action`, target `object` + `recordId`, and a `[from, to]` `createdAt` RFC3339
 * range, then paginated (`page` / `limit`).
 */
export interface SabcrmAuditListOpts {
  /** Filter by the recorded acting-user `actorId`. */
  actorId?: string;
  /** Filter by action (`create` / `update` / `delete` / arbitrary). */
  action?: string;
  object?: string;
  recordId?: string;
  /** Inclusive lower bound on `createdAt` (RFC3339). */
  from?: string;
  /** Inclusive upper bound on `createdAt` (RFC3339). */
  to?: string;
  /** 1-based page number for offset pagination. Defaults to 1 server-side. */
  page?: number;
  /** Max entries to return. Default 100, capped at 500 server-side. */
  limit?: number;
}

/**
 * Paged list result from `GET /` — the project's audit entries plus pagination
 * metadata. Mirrors the Rust `ListResponse`: `total` is the full match count
 * (ignoring `page` / `limit`), `page` / `limit` echo the resolved (clamped)
 * request values.
 */
export interface SabcrmAuditListResult {
  entries: SabcrmRustAuditEntry[];
  total: number;
  page: number;
  limit: number;
}

/** Raw `{ entries, total, page, limit }` envelope from `GET /`. */
interface ListEnvelope {
  entries: SabcrmRustAuditEntry[];
  total: number;
  page: number;
  limit: number;
}

/** Raw `{ entry }` envelope from `POST /`. */
interface SingleEnvelope {
  entry: SabcrmRustAuditEntry;
}

/**
 * Describes the first detected break in a project's audit hash-chain. Returned
 * inside {@link SabcrmAuditVerifyResult} when `intact` is `false`. Mirrors the
 * Rust `ChainBreak` DTO.
 */
export interface SabcrmAuditChainBreak {
  /** Hex id of the offending entry (the relabelled `_id`). */
  entryId: string;
  /** 0-based position of the entry within the chain (insertion order). */
  index: number;
  /** Server-set `createdAt` of the offending entry, when present. */
  createdAt?: string;
  /** Human-readable explanation of why the link is broken. */
  reason: string;
  /** The `hash` the entry actually stores. */
  storedHash: string;
  /** The `hash` recomputed from the entry's content + its predecessor. */
  computedHash: string;
}

/**
 * Tamper-evidence result of walking a project's append-only audit hash-chain.
 * `intact` is `true` only when every link recomputes to its stored `hash` (and
 * each `prevHash` matches its predecessor's `hash`); when `false`,
 * {@link breakAt} pinpoints the **first** broken link — where an edit, deletion
 * or reorder is detectable. Mirrors the Rust `VerifyResponse` DTO.
 */
export interface SabcrmAuditVerifyResult {
  /** Tenant scope that was verified. */
  projectId: string;
  /** `true` when the whole chain verifies; `false` when a break was found. */
  intact: boolean;
  /** Number of entries walked. */
  checked: number;
  /** The first broken link, present only when `intact` is `false`. */
  breakAt?: SabcrmAuditChainBreak;
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
  /**
   * `GET /v1/sabcrm/audit` — a project's audit entries, newest first. Returns
   * just the entries array (backward-compatible); use {@link listPaged} for the
   * full `{ total, page, limit }` envelope.
   */
  async list(
    projectId: string,
    opts?: SabcrmAuditListOpts,
  ): Promise<SabcrmRustAuditEntry[]> {
    const res = await this.listPaged(projectId, opts);
    return res.entries;
  },

  /**
   * `GET /v1/sabcrm/audit` — paged variant exposing the full Rust
   * `ListResponse` (`entries`, `total`, `page`, `limit`). Supports the
   * `actorId` / `action` / `object` / `recordId` / `from` / `to` filters and
   * offset (`page` / `limit`) pagination.
   */
  async listPaged(
    projectId: string,
    opts?: SabcrmAuditListOpts,
  ): Promise<SabcrmAuditListResult> {
    const res = await rustFetch<ListEnvelope>(
      `${BASE}${qs({
        projectId,
        actorId: opts?.actorId,
        action: opts?.action,
        object: opts?.object,
        recordId: opts?.recordId,
        from: opts?.from,
        to: opts?.to,
        page: opts?.page,
        limit: opts?.limit,
      })}`,
    );
    return {
      entries: res.entries,
      total: res.total,
      page: res.page,
      limit: res.limit,
    };
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

  /**
   * `GET /v1/sabcrm/audit/verify` — verify the project's append-only audit
   * hash-chain end to end. Returns `{ projectId, intact, checked, breakAt? }`:
   * when `intact` is `false`, `breakAt` pinpoints the first link whose stored
   * hash no longer matches its recomputed content — the earliest point where
   * tampering (an edit, deletion or reorder) is detectable.
   */
  verify(projectId: string): Promise<SabcrmAuditVerifyResult> {
    return rustFetch<SabcrmAuditVerifyResult>(
      `${BASE}/verify${qs({ projectId })}`,
    );
  },
};
