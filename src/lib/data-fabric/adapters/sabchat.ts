/**
 * Read-only sabChat adapter for the cross-module Data Fabric.
 *
 * sabChat persists customer/visitor sessions in the `sabchat_sessions`
 * collection (see `src/lib/definitions.ts → SabChatSession`). Each row is
 * keyed by `_id`, scoped by `userId` (tenant), and carries a stable
 * `visitorId` (assigned client-side cookie) plus optional `visitorInfo`
 * (name/email/ip).
 *
 * The "customer" entity exposed to other modules is the visitor. Multiple
 * sessions for the same `visitorId` collapse onto a single fabric contact
 * because we project `sabchat_customer_id = visitorId` as the canonical
 * identity per tenant.
 */
import type { Collection, Document } from 'mongodb';
import { ObjectId } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import type { IdentityInput } from '../types';
import type { AdapterRow } from './wachat';

interface SabChatSessionDoc extends Document {
  _id: ObjectId;
  userId?: ObjectId | string;
  visitorId?: string;
  status?: string;
  visitorInfo?: {
    name?: string;
    email?: string;
    ip?: string;
    userAgent?: string;
    page?: string;
  };
}

const SOURCE = 'sabchat';

async function getCollection(): Promise<Collection<SabChatSessionDoc>> {
  const { db } = await connectToDatabase();
  return db.collection<SabChatSessionDoc>('sabchat_sessions');
}

function asString(v: unknown): string | undefined {
  if (!v) return undefined;
  if (typeof v === 'string') return v;
  if (v instanceof ObjectId) return v.toHexString();
  return String(v);
}

export function mapSabChatSession(doc: SabChatSessionDoc): AdapterRow | null {
  const tenantId = asString(doc.userId);
  if (!tenantId) return null;
  if (!doc.visitorId || !doc.visitorId.trim()) return null;

  const identities: IdentityInput[] = [
    { type: 'sabchat_customer_id', value: doc.visitorId, source: SOURCE },
  ];
  const info = doc.visitorInfo ?? {};
  if (info.email && info.email.trim()) {
    identities.push({ type: 'email', value: info.email, source: SOURCE });
  }

  const traits: Record<string, unknown> = {};
  if (doc.status) traits.sabchat_status = doc.status;
  if (info.ip) traits.sabchat_last_ip = info.ip;
  if (info.userAgent) traits.sabchat_user_agent = info.userAgent;
  if (info.page) traits.sabchat_last_page = info.page;

  return {
    externalId: doc._id.toHexString(),
    tenantId,
    displayName: info.name,
    identities,
    traits,
  };
}

export async function* iterateSabChatCustomers(
  tenantId: string,
  opts: { limit?: number } = {},
): AsyncIterableIterator<AdapterRow> {
  const col = await getCollection();
  const filter: Record<string, unknown> = ObjectId.isValid(tenantId)
    ? { $or: [{ userId: new ObjectId(tenantId) }, { userId: tenantId }] }
    : { userId: tenantId };

  const cursor = col.find(filter);
  if (opts.limit && opts.limit > 0) cursor.limit(opts.limit);

  let yielded = 0;
  for await (const doc of cursor) {
    const row = mapSabChatSession(doc);
    if (row) {
      yielded++;
      yield row;
      if (opts.limit && yielded >= opts.limit) break;
    }
  }
}

export async function listSabChatCustomers(
  tenantId: string,
  opts: { limit?: number } = {},
): Promise<AdapterRow[]> {
  const out: AdapterRow[] = [];
  for await (const row of iterateSabChatCustomers(tenantId, opts)) out.push(row);
  return out;
}

export const SABCHAT_ADAPTER_SOURCE = SOURCE;
