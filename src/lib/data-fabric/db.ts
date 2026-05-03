/**
 * Mongo collection accessors for the data-fabric module.
 *
 * Mirrors the pattern used in `src/lib/sabflow/db.ts`: thin async helpers
 * that lazily connect via `connectToDatabase()` and ensure indexes on first
 * use (createIndex is idempotent in MongoDB so this is safe to call on every
 * accessor invocation).
 */

import { connectToDatabase } from '@/lib/mongodb';
import type { Collection, Document } from 'mongodb';
import type { ObjectId } from 'mongodb';
import type {
  Contact,
  Identity,
  Account,
  DomainEvent,
} from './types';

/* ══════════════════════════════════════════════════════════
   Mongo document shapes — `_id` is a Mongo ObjectId, while the
   public `id`/`contactId`/etc. fields are string projections.
   ══════════════════════════════════════════════════════════ */

export interface ContactDoc extends Omit<Contact, 'id'> {
  _id: ObjectId | string;
}

export interface IdentityDoc extends Identity {
  _id?: ObjectId;
}

export interface AccountDoc extends Omit<Account, 'id'> {
  _id: ObjectId | string;
}

export interface EventDoc extends Omit<DomainEvent, 'id'> {
  _id: string;
}

/* ══════════════════════════════════════════════════════════
   Accessors
   ══════════════════════════════════════════════════════════ */

let contactsIdx = false;
let identitiesIdx = false;
let accountsIdx = false;
let eventsIdx = false;

export async function getContactsCollection(): Promise<Collection<ContactDoc>> {
  const { db } = await connectToDatabase();
  const col = db.collection<ContactDoc>('df_contacts');
  if (!contactsIdx) {
    await col.createIndex({ tenantId: 1, updatedAt: -1 }, { background: true });
    await col.createIndex({ tenantId: 1, mergedInto: 1 }, { background: true });
    await col.createIndex({ tenantId: 1, accountId: 1 }, { background: true });
    contactsIdx = true;
  }
  return col;
}

export async function getIdentitiesCollection(): Promise<Collection<IdentityDoc>> {
  const { db } = await connectToDatabase();
  const col = db.collection<IdentityDoc>('df_identities');
  if (!identitiesIdx) {
    // (tenantId, type, value) is the natural key. Unique enforces one canonical
    // contactId per identifier within a tenant — re-asserts upsert idempotently.
    await col.createIndex(
      { tenantId: 1, type: 1, value: 1 },
      { unique: true, background: true },
    );
    await col.createIndex({ tenantId: 1, contactId: 1 }, { background: true });
    identitiesIdx = true;
  }
  return col;
}

export async function getAccountsCollection(): Promise<Collection<AccountDoc>> {
  const { db } = await connectToDatabase();
  const col = db.collection<AccountDoc>('df_accounts');
  if (!accountsIdx) {
    await col.createIndex({ tenantId: 1, name: 1 }, { background: true });
    await col.createIndex(
      { tenantId: 1, domain: 1 },
      { background: true, sparse: true },
    );
    accountsIdx = true;
  }
  return col;
}

export async function getEventsCollection(): Promise<Collection<EventDoc>> {
  const { db } = await connectToDatabase();
  const col = db.collection<EventDoc>('df_events');
  if (!eventsIdx) {
    await col.createIndex({ tenantId: 1, occurredAt: -1 }, { background: true });
    await col.createIndex(
      { tenantId: 1, contactId: 1, occurredAt: -1 },
      { background: true, sparse: true },
    );
    await col.createIndex({ type: 1, occurredAt: -1 }, { background: true });
    eventsIdx = true;
  }
  return col;
}

/* ══════════════════════════════════════════════════════════
   Mapping helpers
   ══════════════════════════════════════════════════════════ */

/** Strip Mongo internals and surface `_id` as `id`. */
export function mapContact(doc: ContactDoc): Contact {
  const { _id, ...rest } = doc as ContactDoc & Document;
  return {
    id: typeof _id === 'string' ? _id : (_id as ObjectId).toHexString(),
    ...(rest as Omit<Contact, 'id'>),
  };
}

export function mapAccount(doc: AccountDoc): Account {
  const { _id, ...rest } = doc as AccountDoc & Document;
  return {
    id: typeof _id === 'string' ? _id : (_id as ObjectId).toHexString(),
    ...(rest as Omit<Account, 'id'>),
  };
}

export function mapEvent(doc: EventDoc): DomainEvent {
  const { _id, ...rest } = doc as EventDoc & Document;
  return {
    id: String(_id),
    ...(rest as Omit<DomainEvent, 'id'>),
  };
}
