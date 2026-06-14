import 'server-only';

/**
 * SabCRM shared inbox — the read-only aggregator behind `/sabcrm/inbox`.
 *
 * One surface that shows recent SabMail messages mapped to the CRM record(s)
 * each one corresponds to (by the message's FROM address). It REUSES, never
 * rebuilds:
 *
 *   - SabMail reads: `listMailAccounts` (the tenant's active mail identities)
 *     + `listMailMessages` per account (the same session-scoped actions the
 *     record-detail Email tab uses in `sabcrm-email.actions.ts`);
 *   - the record-match shape from `email-inbound.ts` — an OR filter over each
 *     object's EMAIL / EMAILS field keys, run through the Rust engine with
 *     `rustFetchAs(userId, …)` (the two-store gotcha: record reads MUST go
 *     through the Rust path);
 *   - the pure flatten + best-match selection from `./crm-inbox.ts`.
 *
 * Read-only: it never writes activities or mutates records. It DEGRADES
 * GRACEFULLY — no SabMail accounts, the engine being down, or any per-account
 * read failing all collapse to fewer/empty rows, never an exception. The caller
 * (the gated `getCrmInboxTw` action) supplies `userId` + `projectId`.
 *
 * Not a `'use server'` action: exposing a tenant-impersonating reader as an
 * action endpoint would let any browser pass an arbitrary `userId`.
 */

import { rustFetchAs } from '@/lib/rust-client/fetcher';
import { listMailAccounts, listMailMessages } from '@/app/actions/mailbox.actions';
import type { MailMessageDoc } from '@/lib/rust-client/mail-messages';
import type { ObjectMetadata } from '@/lib/sabcrm/types';
import {
  deriveRecordLabel,
  mailDocToInboxRow,
  matchInboxRowToRecord,
  normaliseAddress,
  type CrmInboxRow,
  type CrmInboxMatchCandidate,
} from './crm-inbox';

/* ------------------------------------------------------------------------ */
/* Tunables                                                                  */
/* ------------------------------------------------------------------------ */

/** Default number of inbox rows returned. */
const DEFAULT_LIMIT = 30;
/** Hard ceiling on returned rows (guards a huge limit from the client). */
const MAX_LIMIT = 100;
/** How many recent mailbox rows to scan PER account before merging. */
const PER_ACCOUNT_SCAN = 100;
/** Per-object record-match cap (mirrors `email-inbound.ts`). */
const PER_OBJECT_LIMIT = 3;
/**
 * Object priority for best-match selection: the lower the rank, the more
 * preferred. People/contacts win over companies, both over leads, everything
 * else last. Surfaced as `rank` on the candidate (see `matchInboxRowToRecord`).
 */
const OBJECT_RANK: Record<string, number> = {
  people: 0,
  contacts: 0,
  persons: 0,
  companies: 1,
  accounts: 1,
  organizations: 1,
  leads: 2,
  opportunities: 2,
  deals: 2,
};

function rankForObject(slug: string): number {
  return OBJECT_RANK[slug] ?? 5;
}

/* ------------------------------------------------------------------------ */
/* Engine envelopes                                                          */
/* ------------------------------------------------------------------------ */

interface ObjectsEnvelope {
  objects: ObjectMetadata[];
}

interface RecordsEnvelope {
  records: Array<{ _id?: string; id?: string; data?: Record<string, unknown> }>;
  total: number;
}

/** A mail account narrowed to what the inbox aggregator needs. */
interface InboxAccount {
  id: string;
  email: string;
}

/* ------------------------------------------------------------------------ */
/* Result                                                                    */
/* ------------------------------------------------------------------------ */

export interface CrmInboxResult {
  rows: CrmInboxRow[];
  /** Number of active SabMail accounts scanned. */
  accountsScanned: number;
  /** True when SabMail has at least one active account for this tenant. */
  connected: boolean;
  /**
   * Soft status when there are no rows — `no-accounts` (connect SabMail),
   * `empty` (connected but no recent mail), or undefined when rows exist.
   */
  reason?: string;
}

/* ------------------------------------------------------------------------ */
/* Internals                                                                 */
/* ------------------------------------------------------------------------ */

/** The tenant's active SabMail identities (session-scoped read). */
async function loadAccounts(): Promise<InboxAccount[]> {
  try {
    const accounts = await listMailAccounts({ status: 'active', limit: 10 });
    return (accounts ?? [])
      .map((a) => {
        const email = a.emailAddress ?? a.localPart;
        return a._id && email ? { id: a._id, email } : null;
      })
      .filter((a): a is InboxAccount => a !== null);
  } catch {
    return [];
  }
}

/**
 * Objects that can hold an email, with their EMAIL / EMAILS field keys —
 * mirrors `email-inbound.ts`. Returns [] on any engine failure (degrade).
 */
async function loadEmailObjects(
  userId: string,
  projectId: string,
): Promise<Array<{ slug: string; keys: string[] }>> {
  try {
    const { objects } = await rustFetchAs<ObjectsEnvelope>(
      userId,
      `/v1/sabcrm/objects?projectId=${encodeURIComponent(projectId)}`,
    );
    return (objects ?? [])
      .map((o) => ({
        slug: o.slug,
        keys: (o.fields ?? [])
          .filter((f) => f.type === 'EMAIL' || f.type === 'EMAILS')
          .map((f) => f.key),
      }))
      .filter((o) => o.keys.length > 0)
      .sort((a, b) => rankForObject(a.slug) - rankForObject(b.slug));
  } catch {
    return [];
  }
}

/**
 * Resolve the CRM record candidates for ONE address across the email objects.
 * Same OR-filter shape as `email-inbound.ts` (each EMAIL key + its
 * `.primaryEmail` sub-path). Returns ranked candidates; never throws.
 */
async function candidatesForAddress(
  userId: string,
  projectId: string,
  emailObjects: Array<{ slug: string; keys: string[] }>,
  address: string,
): Promise<CrmInboxMatchCandidate[]> {
  const from = normaliseAddress(address);
  if (!from || !from.includes('@')) return [];

  const out: CrmInboxMatchCandidate[] = [];
  for (const obj of emailObjects) {
    const conditions = obj.keys.flatMap((k) => [
      { field: k, operator: 'contains', value: from },
      { field: `${k}.primaryEmail`, operator: 'contains', value: from },
    ]);
    const filters = { op: 'or', conditions };
    try {
      const res = await rustFetchAs<RecordsEnvelope>(
        userId,
        `/v1/sabcrm/records/${encodeURIComponent(obj.slug)}?projectId=${encodeURIComponent(
          projectId,
        )}&limit=${PER_OBJECT_LIMIT}&filters=${encodeURIComponent(JSON.stringify(filters))}`,
      );
      for (const r of res.records ?? []) {
        const id = String(r._id ?? r.id ?? '');
        if (!id) continue;
        out.push({
          object: obj.slug,
          recordId: id,
          label: deriveRecordLabel(r.data, id),
          rank: rankForObject(obj.slug),
        });
      }
    } catch {
      /* one object failing must not sink the rest */
    }
  }
  return out;
}

/* ------------------------------------------------------------------------ */
/* buildCrmInbox                                                             */
/* ------------------------------------------------------------------------ */

export interface BuildCrmInboxOptions {
  /** Max rows to return (default {@link DEFAULT_LIMIT}, clamped to {@link MAX_LIMIT}). */
  limit?: number;
}

/**
 * Build the shared CRM inbox for a tenant + project: aggregate recent SabMail
 * messages across the workspace's active accounts and resolve the matching CRM
 * record for each by FROM address. Read-only and exception-free.
 */
export async function buildCrmInbox(
  userId: string,
  projectId: string,
  options: BuildCrmInboxOptions = {},
): Promise<CrmInboxResult> {
  const limit = Math.min(Math.max(options.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);

  const accounts = await loadAccounts();
  if (accounts.length === 0) {
    return { rows: [], accountsScanned: 0, connected: false, reason: 'no-accounts' };
  }

  // 1. Pull recent rows from every active account, then merge + sort newest-first.
  const perAccount = await Promise.all(
    accounts.map(async (acc): Promise<MailMessageDoc[]> => {
      try {
        return (await listMailMessages({ accountId: acc.id, limit: PER_ACCOUNT_SCAN })) ?? [];
      } catch {
        return [];
      }
    }),
  );
  const merged = perAccount
    .flat()
    .sort((a, b) => {
      const ta = a.receivedAt ?? a.sentAt ?? a.createdAt ?? '';
      const tb = b.receivedAt ?? b.sentAt ?? b.createdAt ?? '';
      return tb.localeCompare(ta);
    })
    .slice(0, limit);

  if (merged.length === 0) {
    return { rows: [], accountsScanned: accounts.length, connected: true, reason: 'empty' };
  }

  // 2. Resolve matches once per DISTINCT from-address (de-dupes the engine work).
  const emailObjects = await loadEmailObjects(userId, projectId);
  const distinct = new Set<string>();
  for (const doc of merged) {
    const from = normaliseAddress(doc.fromAddr?.email);
    if (from) distinct.add(from);
  }

  const matchByAddress = new Map<string, CrmInboxMatchCandidate[]>();
  if (emailObjects.length > 0) {
    await Promise.all(
      [...distinct].map(async (addr) => {
        matchByAddress.set(
          addr,
          await candidatesForAddress(userId, projectId, emailObjects, addr),
        );
      }),
    );
  }

  // 3. Flatten each message into a row with its single best record match.
  const rows = merged.map((doc) => {
    const from = normaliseAddress(doc.fromAddr?.email);
    const match = matchInboxRowToRecord(matchByAddress.get(from));
    return mailDocToInboxRow(doc, match);
  });

  return {
    rows,
    accountsScanned: accounts.length,
    connected: true,
    reason: rows.length === 0 ? 'empty' : undefined,
  };
}
