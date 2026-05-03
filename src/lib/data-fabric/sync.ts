/**
 * Cross-module backfill orchestrator.
 *
 * Walks the four read-only adapters (Wachat, CRM, sabChat, HRM) and, for
 * every adapter row, resolves the canonical contact, mirrors the row's
 * traits onto it (last-write-wins), and emits a `contact.upserted`
 * domain event onto the data-fabric event bus.
 *
 * `contact.upserted` is mapped onto the existing `contact.updated` event
 * type (we do not extend `DomainEventType` from this file because it
 * would touch shared types). Subscribers can filter by
 * `payload.kind === 'upserted'` if they need to distinguish the source.
 *
 * Backfill is idempotent — re-running it against the same data produces
 * no duplicate identities and no spurious trait writes (older
 * `updatedAt` traits are dropped by `setTrait`).
 */
import type { IdentityInput, Trait } from './types';
import { resolveContact } from './identity';
import { setTrait } from './cdp-traits';
import { emit } from './events';
import {
  iterateWachatContacts,
  WACHAT_ADAPTER_SOURCE,
  type AdapterRow,
} from './adapters/wachat';
import { iterateCrmLeads, CRM_ADAPTER_SOURCE } from './adapters/crm';
import {
  iterateSabChatCustomers,
  SABCHAT_ADAPTER_SOURCE,
} from './adapters/sabchat';
import { iterateHrmEmployees, HRM_ADAPTER_SOURCE } from './adapters/hrm';

/* ══════════════════════════════════════════════════════════
   Types
   ══════════════════════════════════════════════════════════ */

export type AdapterSource = 'wachat' | 'crm' | 'sabchat' | 'hrm';

export interface BackfillResult {
  tenantId: string;
  /** Total adapter rows scanned across every source. */
  scanned: number;
  /** Rows successfully mirrored into the fabric. */
  upserted: number;
  /** Rows that errored (logged, not thrown). */
  failed: number;
  /** Per-source counts. */
  bySource: Record<AdapterSource, { scanned: number; upserted: number; failed: number }>;
}

export interface BackfillOptions {
  /** Optionally bound how many rows we process per source — useful for tests. */
  limitPerSource?: number;
  /**
   * If supplied, restricts the run to a subset of adapters. Defaults to all
   * four. Order is preserved and matters for trait LWW (later wins on tie).
   */
  sources?: AdapterSource[];
}

/** Adapter iterators paired with their source label. */
type AdapterIter = (
  tenantId: string,
  opts: { limit?: number },
) => AsyncIterableIterator<AdapterRow>;

const ADAPTERS: Record<AdapterSource, { iter: AdapterIter; source: string }> = {
  wachat: { iter: iterateWachatContacts, source: WACHAT_ADAPTER_SOURCE },
  crm: { iter: iterateCrmLeads, source: CRM_ADAPTER_SOURCE },
  sabchat: { iter: iterateSabChatCustomers, source: SABCHAT_ADAPTER_SOURCE },
  hrm: { iter: iterateHrmEmployees, source: HRM_ADAPTER_SOURCE },
};

/* ══════════════════════════════════════════════════════════
   Test seam — adapters are pluggable so unit tests can substitute
   in-memory iterators without hitting Mongo.
   ══════════════════════════════════════════════════════════ */

export type AdapterMap = Partial<Record<AdapterSource, AdapterIter>>;

/* ══════════════════════════════════════════════════════════
   Helpers
   ══════════════════════════════════════════════════════════ */

/**
 * Push a row into the fabric: assert each identity in turn (the FIRST
 * identity becomes the seed; subsequent identities re-point through
 * `resolveContact`'s natural collision behaviour as the same canonical id
 * is returned). Then mirror traits.
 */
async function upsertRow(
  tenantId: string,
  source: string,
  row: AdapterRow,
): Promise<string> {
  if (row.identities.length === 0) {
    throw new Error('AdapterRow has no identities');
  }
  // First, claim a canonical id via the most-stable identity (the
  // module-internal id is always present on adapter rows, so try it first).
  const ordered = orderIdentities(row.identities);
  const seed = ordered[0]!;
  const canonicalId = await resolveContact(tenantId, seed);

  // Assert any remaining identities. Each call may return either the same
  // canonicalId (already asserted, idempotent) or — pathologically — a
  // *different* canonical id if the value previously belonged to another
  // contact. In that case we leave merge to an explicit operator action via
  // `mergeContactsByIdentity`.
  for (let i = 1; i < ordered.length; i++) {
    await resolveContact(tenantId, ordered[i]!).catch((err) => {
      // Emit but do not throw — backfill must keep moving.
      void emit(tenantId, {
        type: 'identity.added',
        contactId: canonicalId,
        source,
        payload: {
          identity: ordered[i],
          error: err instanceof Error ? err.message : String(err),
        },
      });
    });
  }

  // Mirror traits — last-write-wins is enforced by `setTrait`.
  for (const [k, v] of Object.entries(row.traits)) {
    if (v === undefined) continue;
    await setTrait(tenantId, canonicalId, k, v as Trait, { source });
  }

  // Emit the unified upsert event.
  void emit(tenantId, {
    type: 'contact.updated',
    contactId: canonicalId,
    source,
    payload: {
      kind: 'upserted',
      externalId: row.externalId,
      displayName: row.displayName,
      identities: row.identities,
    },
  });

  return canonicalId;
}

/**
 * Order identities so the most-specific module-internal id comes first; this
 * stabilises canonical-id assignment when the same row is replayed.
 */
function orderIdentities(identities: IdentityInput[]): IdentityInput[] {
  const priority: Record<string, number> = {
    crm_lead_id: 0,
    sabchat_customer_id: 1,
    hrm_employee_id: 2,
    wachat_wa_id: 3,
    firebase_uid: 4,
    email: 5,
    phone: 6,
    external: 7,
  };
  return [...identities].sort(
    (a, b) =>
      (priority[a.type] ?? 99) - (priority[b.type] ?? 99),
  );
}

/* ══════════════════════════════════════════════════════════
   Public API
   ══════════════════════════════════════════════════════════ */

/**
 * Walk all (or a subset of) adapters for `tenantId`, mirroring rows into
 * the fabric and emitting `contact.upserted` events. Returns counts.
 *
 * `adapters` is the test seam: when omitted, the production adapters are
 * used; tests pass in mock iterators here.
 */
export async function backfillFromAdapters(
  tenantId: string,
  opts: BackfillOptions = {},
  adapters?: AdapterMap,
): Promise<BackfillResult> {
  if (!tenantId) throw new Error('tenantId is required');

  const sources: AdapterSource[] = opts.sources ?? ['wachat', 'crm', 'sabchat', 'hrm'];
  const result: BackfillResult = {
    tenantId,
    scanned: 0,
    upserted: 0,
    failed: 0,
    bySource: {
      wachat: { scanned: 0, upserted: 0, failed: 0 },
      crm: { scanned: 0, upserted: 0, failed: 0 },
      sabchat: { scanned: 0, upserted: 0, failed: 0 },
      hrm: { scanned: 0, upserted: 0, failed: 0 },
    },
  };

  for (const src of sources) {
    const def = ADAPTERS[src];
    const iter = adapters?.[src] ?? def.iter;
    const source = def.source;

    try {
      for await (const row of iter(tenantId, { limit: opts.limitPerSource })) {
        result.scanned++;
        result.bySource[src].scanned++;
        try {
          await upsertRow(tenantId, source, row);
          result.upserted++;
          result.bySource[src].upserted++;
        } catch (err) {
          result.failed++;
          result.bySource[src].failed++;
          if (process.env.NODE_ENV !== 'test') {
            console.warn(
              `[data-fabric/sync] upsert failed (${source}/${row.externalId}):`,
              err,
            );
          }
        }
      }
    } catch (err) {
      // An adapter-level failure (e.g. Mongo down) should not abort the run.
      if (process.env.NODE_ENV !== 'test') {
        console.warn(`[data-fabric/sync] adapter ${source} failed:`, err);
      }
    }
  }

  return result;
}
