/**
 * Read-only Wachat adapter for the cross-module Data Fabric.
 *
 * Wachat persists per-tenant WhatsApp contacts in the `contacts` Mongo
 * collection (see `src/lib/definitions.ts → Contact`). Each row is keyed by
 * `_id: ObjectId` and scoped by `userId` (the SabNode tenant) and
 * `projectId` (the WABA project). The canonical identifier we project
 * into the fabric is `wachat_wa_id` — the raw WhatsApp Business `wa_id`
 * (E.164 phone digits, sometimes prefixed with `+`).
 *
 * The adapter is intentionally read-only: it does not mutate Wachat
 * documents. Backfill orchestration lives in `sync.ts`.
 */
import type { Collection, Document } from 'mongodb';
import { ObjectId } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import type { IdentityInput } from '../types';

/**
 * Public adapter row shape. Every adapter normalises its source rows to
 * this same shape so `sync.ts` can treat them uniformly.
 */
export interface AdapterRow {
  /** Source-row stable id (Mongo `_id` hex). */
  externalId: string;
  /** SabNode tenant id (string-coerced). */
  tenantId: string;
  /** Best-known display name. */
  displayName?: string;
  /** Identity tuples to assert on the canonical contact. */
  identities: IdentityInput[];
  /** Free-form trait map mirrored into the canonical record. */
  traits: Record<string, unknown>;
}

/** Wachat contact source shape — projected from the existing collection. */
interface WachatContactDoc extends Document {
  _id: ObjectId;
  userId?: ObjectId | string;
  projectId?: ObjectId | string;
  waId?: string;
  name?: string;
  phone?: string;
  email?: string;
  status?: string;
  tagIds?: unknown[];
}

const SOURCE = 'wachat';

async function getCollection(): Promise<Collection<WachatContactDoc>> {
  const { db } = await connectToDatabase();
  return db.collection<WachatContactDoc>('contacts');
}

/** Coerce ObjectId | string → string for the fabric tenant key. */
function asString(v: unknown): string | undefined {
  if (!v) return undefined;
  if (typeof v === 'string') return v;
  if (v instanceof ObjectId) return v.toHexString();
  if (typeof v === 'object' && v && 'toHexString' in v) {
    try {
      return (v as ObjectId).toHexString();
    } catch {
      return undefined;
    }
  }
  return String(v);
}

/** Map a single Wachat doc → AdapterRow. */
export function mapWachatContact(doc: WachatContactDoc): AdapterRow | null {
  const tenantId = asString(doc.userId);
  if (!tenantId) return null;

  const identities: IdentityInput[] = [];
  if (doc.waId && doc.waId.trim()) {
    identities.push({ type: 'wachat_wa_id', value: doc.waId, source: SOURCE });
  }
  if (doc.phone && doc.phone.trim()) {
    identities.push({ type: 'phone', value: doc.phone, source: SOURCE });
  } else if (doc.waId && doc.waId.trim()) {
    // The wa_id IS effectively the phone — assert it as a phone identity too
    // so cross-module phone lookups (CRM/email-sourced phone) align.
    identities.push({ type: 'phone', value: doc.waId, source: SOURCE });
  }
  if (doc.email && doc.email.trim()) {
    identities.push({ type: 'email', value: doc.email, source: SOURCE });
  }

  if (identities.length === 0) return null;

  const traits: Record<string, unknown> = {};
  if (doc.status) traits.wachat_status = doc.status;
  if (doc.projectId) traits.wachat_project_id = asString(doc.projectId);
  if (Array.isArray(doc.tagIds) && doc.tagIds.length) {
    traits.wachat_tag_ids = doc.tagIds.map((t) => asString(t)).filter(Boolean);
  }

  return {
    externalId: doc._id.toHexString(),
    tenantId,
    displayName: doc.name,
    identities,
    traits,
  };
}

/**
 * Stream Wachat contacts for a tenant, optionally limited. Returns an async
 * iterator so the caller can decide batching.
 */
export async function* iterateWachatContacts(
  tenantId: string,
  opts: { limit?: number } = {},
): AsyncIterableIterator<AdapterRow> {
  const col = await getCollection();
  // Wachat uses ObjectId for userId; tolerate both shapes.
  const filter: Record<string, unknown> = ObjectId.isValid(tenantId)
    ? { $or: [{ userId: new ObjectId(tenantId) }, { userId: tenantId }] }
    : { userId: tenantId };

  const cursor = col.find(filter);
  if (opts.limit && opts.limit > 0) cursor.limit(opts.limit);

  let yielded = 0;
  for await (const doc of cursor) {
    const row = mapWachatContact(doc);
    if (row) {
      yielded++;
      yield row;
      if (opts.limit && yielded >= opts.limit) break;
    }
  }
}

/** Eager array form, convenient for tests. */
export async function listWachatContacts(
  tenantId: string,
  opts: { limit?: number } = {},
): Promise<AdapterRow[]> {
  const out: AdapterRow[] = [];
  for await (const row of iterateWachatContacts(tenantId, opts)) out.push(row);
  return out;
}

export const WACHAT_ADAPTER_SOURCE = SOURCE;
