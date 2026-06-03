import 'server-only';

/**
 * C8 — CRM data-layer router (Phase 0 contract / Seam B).
 *
 * One interface, two implementations: the existing Rust+Mongo engine and the
 * new Twenty (Postgres/GraphQL) backend. `getCrmDataLayer(projectId)` returns
 * whichever is active for that project, so the SabCRM server actions can cut
 * over from Rust → Twenty PER PROJECT behind a flag without touching call sites
 * (PLAN.md §5, Phase 5). This is the seam that keeps the migration reversible:
 * if twenty-server is down for a project, flip it back to `rust`.
 *
 * Phase 0 defines the interface + selection logic. Both concrete impls land in
 * Phase 4 (Agent 4C builds the Twenty impl; the Rust impl wraps today's
 * `sabcrm-twenty.actions` helpers). Until then the factory returns a stub that
 * throws on use, so the default Rust path keeps flowing through the existing
 * actions and nothing silently changes.
 */

import type { ActionResult, ObjectMetadata } from '@/lib/sabcrm/types';

/** A CRM record as the UI consumes it (id + free-form field bag). */
export interface CrmRecord {
  id: string;
  data: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
}

export interface ListRecordsParams {
  object: string;
  page?: number;
  pageSize?: number;
  search?: string;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
  filters?: unknown;
  /** Fields to hydrate (relations/actors must be requested explicitly). */
  select?: string[];
}

export interface RecordsPage {
  records: CrmRecord[];
  total: number;
}

/** The capability surface both backends must satisfy. */
export interface CrmDataLayer {
  listObjects(): Promise<ActionResult<ObjectMetadata[]>>;
  listRecords(params: ListRecordsParams): Promise<ActionResult<RecordsPage>>;
  getRecord(object: string, id: string): Promise<ActionResult<CrmRecord | null>>;
  createRecord(object: string, data: Record<string, unknown>): Promise<ActionResult<CrmRecord>>;
  updateRecord(
    object: string,
    id: string,
    patch: Record<string, unknown>,
  ): Promise<ActionResult<CrmRecord>>;
  deleteRecord(object: string, id: string): Promise<ActionResult<{ ok: boolean }>>;
}

export type CrmDataLayerKind = 'rust' | 'twenty';

/**
 * Resolve which backend a project uses. Phase 0: env-level default only
 * (`CRM_DATA_LAYER`, default `rust`). Phase 5 extends this to a per-project
 * lookup so tenants can be migrated one at a time.
 */
export function resolveCrmDataLayerKind(_projectId?: string): CrmDataLayerKind {
  return process.env.CRM_DATA_LAYER === 'twenty' ? 'twenty' : 'rust';
}

class UnwiredCrmDataLayer implements CrmDataLayer {
  constructor(private readonly kind: CrmDataLayerKind) {}
  private fail(): never {
    throw new Error(
      `CrmDataLayer "${this.kind}" is not wired yet (Phase 4). ` +
        'Continue using the existing sabcrm-twenty server actions until cutover.',
    );
  }
  listObjects() { return this.fail(); }
  listRecords() { return this.fail(); }
  getRecord() { return this.fail(); }
  createRecord() { return this.fail(); }
  updateRecord() { return this.fail(); }
  deleteRecord() { return this.fail(); }
}

/**
 * Returns the active data layer for a project. Phase 0 returns an unwired stub
 * (both kinds) — real impls are injected in Phase 4.
 */
export function getCrmDataLayer(projectId?: string): {
  kind: CrmDataLayerKind;
  impl: CrmDataLayer;
} {
  const kind = resolveCrmDataLayerKind(projectId);
  return { kind, impl: new UnwiredCrmDataLayer(kind) };
}
