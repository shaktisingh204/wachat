/**
 * Identity resolution and merge.
 *
 * `resolveContact()` is the single entrypoint every other module should use
 * to get a canonical `contactId` from any identifier they hold. It's
 * idempotent, tenant-scoped, and creates the canonical contact + identity row
 * if neither yet exists.
 *
 * `mergeContacts()` collapses two canonical contacts into one. It is
 * idempotent — calling it twice is a no-op — and follows mergedInto chains so
 * a long history of merges still resolves to the live canonical id.
 */

import { ObjectId } from 'mongodb';
import {
  getContactsCollection,
  getIdentitiesCollection,
  mapContact,
  type ContactDoc,
} from './db';
import type {
  Contact,
  IdentityInput,
  IdentityType,
  TraitEntry,
  Consent,
} from './types';
import { emit } from './events';

/* ══════════════════════════════════════════════════════════
   Normalisation
   ══════════════════════════════════════════════════════════ */

/**
 * Normalises an identity value so two equivalent inputs (e.g. " A@B.COM " vs
 * "a@b.com") resolve to the same row. Phone numbers are trimmed and
 * non-digit characters stripped except for a leading '+'.
 */
export function normalizeIdentity(type: IdentityType, value: string): string {
  const v = (value ?? '').trim();
  if (!v) throw new Error('Identity value cannot be empty');
  switch (type) {
    case 'email':
      return v.toLowerCase();
    case 'phone':
    case 'wachat_wa_id': {
      // Keep a leading '+', strip everything non-digit after.
      const hasPlus = v.startsWith('+');
      const digits = v.replace(/[^\d]/g, '');
      return hasPlus ? `+${digits}` : digits;
    }
    default:
      return v;
  }
}

/* ══════════════════════════════════════════════════════════
   Helpers
   ══════════════════════════════════════════════════════════ */

function makeId(): string {
  return new ObjectId().toHexString();
}

/**
 * Walk `mergedInto` until we reach the live canonical contact. Returns null
 * when the contactId does not exist. Cycle-safe via a visited set.
 */
export async function getCanonicalId(
  tenantId: string,
  contactId: string,
): Promise<string | null> {
  const col = await getContactsCollection();
  const seen = new Set<string>();
  let cursor: string | undefined = contactId;
  while (cursor && !seen.has(cursor)) {
    seen.add(cursor);
    const doc: { _id: unknown; mergedInto?: string } | null = await col.findOne(
      { _id: cursor as unknown as ObjectId, tenantId } as never,
      { projection: { _id: 1, mergedInto: 1 } } as never,
    );
    if (!doc) return null;
    if (!doc.mergedInto) return cursor;
    cursor = doc.mergedInto as string | undefined;
  }
  return cursor ?? null;
}

/* ══════════════════════════════════════════════════════════
   resolveContact
   ══════════════════════════════════════════════════════════ */

/**
 * Resolve an identity to a canonical contact, creating both the contact and
 * identity row when they do not yet exist.
 *
 * Idempotent — calling twice with the same input returns the same canonical
 * id. Concurrent calls race on the unique index `(tenantId, type, value)`
 * and we recover from the duplicate-key error by reading the winner.
 */
export async function resolveContact(
  tenantId: string,
  identity: IdentityInput,
): Promise<string> {
  if (!tenantId) throw new Error('tenantId is required');
  const value = normalizeIdentity(identity.type, identity.value);

  const identities = await getIdentitiesCollection();
  const contacts = await getContactsCollection();

  // Fast path — identity already mapped.
  const existing = await identities.findOne({
    tenantId,
    type: identity.type,
    value,
  });
  if (existing) {
    const live = await getCanonicalId(tenantId, existing.contactId);
    return live ?? existing.contactId;
  }

  // Create a fresh canonical contact + identity row in one logical step.
  const now = new Date();
  const contactId = makeId();
  const contactDoc: ContactDoc = {
    _id: contactId,
    tenantId,
    traits: {},
    consents: [],
    createdAt: now,
    updatedAt: now,
    ...(identity.type === 'email' ? { primaryEmail: value } : {}),
    ...(identity.type === 'phone' ? { primaryPhone: value } : {}),
  };

  try {
    await contacts.insertOne(contactDoc);
    await identities.insertOne({
      _id: new ObjectId(),
      tenantId,
      type: identity.type,
      value,
      contactId,
      source: identity.source,
      createdAt: now,
      updatedAt: now,
    });

    // Fire-and-forget — the event bus must never block resolution.
    void emit(tenantId, {
      type: 'contact.created',
      contactId,
      source: identity.source,
      payload: { type: identity.type, value },
    });
    void emit(tenantId, {
      type: 'identity.added',
      contactId,
      source: identity.source,
      payload: { type: identity.type, value },
    });

    return contactId;
  } catch (err) {
    // Race: another caller won the unique index. Re-read.
    const winner = await identities.findOne({
      tenantId,
      type: identity.type,
      value,
    });
    if (winner) {
      // Roll back the speculative contact insert.
      await contacts.deleteOne({ _id: contactId as unknown as ObjectId } as never).catch(() => {});
      const live = await getCanonicalId(tenantId, winner.contactId);
      return live ?? winner.contactId;
    }
    throw err;
  }
}

/* ══════════════════════════════════════════════════════════
   mergeContacts
   ══════════════════════════════════════════════════════════ */

/**
 * Merge `mergeFromId` into `canonicalId`. Idempotent.
 *
 * Steps:
 *   1. Resolve both ids to their live heads (so chained merges still work).
 *   2. If they are already the same, no-op.
 *   3. Re-point all identity rows to the canonical id.
 *   4. Union traits (canonical wins on conflict by `updatedAt`).
 *   5. Union consents (last-write-wins per channel).
 *   6. Mark the loser as `mergedInto = canonicalId`.
 *   7. Emit `contact.merged`.
 */
export async function mergeContacts(
  tenantId: string,
  canonicalId: string,
  mergeFromId: string,
): Promise<string> {
  if (!tenantId) throw new Error('tenantId is required');
  const liveCanonical = await getCanonicalId(tenantId, canonicalId);
  const liveLoser = await getCanonicalId(tenantId, mergeFromId);
  if (!liveCanonical) throw new Error(`Canonical contact ${canonicalId} not found`);
  if (!liveLoser) throw new Error(`Merge-from contact ${mergeFromId} not found`);
  if (liveCanonical === liveLoser) return liveCanonical;

  const contacts = await getContactsCollection();
  const identities = await getIdentitiesCollection();

  const [winner, loser] = await Promise.all([
    contacts.findOne({ _id: liveCanonical as unknown as ObjectId, tenantId } as never),
    contacts.findOne({ _id: liveLoser as unknown as ObjectId, tenantId } as never),
  ]);
  if (!winner || !loser) throw new Error('Merge failed: contact not found');

  // 3. Re-point identities. Some identity values may already exist on the
  // winner — skip those (idempotent re-merge).
  const loserIdentities = await identities
    .find({ tenantId, contactId: liveLoser })
    .toArray();
  for (const ident of loserIdentities) {
    const collision = await identities.findOne({
      tenantId,
      type: ident.type,
      value: ident.value,
      contactId: liveCanonical,
    });
    if (collision) {
      await identities.deleteOne({ _id: ident._id });
    } else {
      await identities.updateOne(
        { _id: ident._id },
        { $set: { contactId: liveCanonical, updatedAt: new Date() } },
      );
    }
  }

  // 4. Trait union — winner wins ties via `updatedAt`.
  const mergedTraits: Record<string, TraitEntry> = { ...loser.traits };
  for (const [k, v] of Object.entries(winner.traits ?? {})) {
    const existing = mergedTraits[k];
    if (!existing || existing.updatedAt < v.updatedAt) mergedTraits[k] = v;
  }

  // 5. Consent merge — newest per channel wins.
  const consentByChannel = new Map<string, Consent>();
  for (const c of [...(loser.consents ?? []), ...(winner.consents ?? [])]) {
    const cur = consentByChannel.get(c.channel);
    if (!cur || cur.updatedAt < c.updatedAt) consentByChannel.set(c.channel, c);
  }

  const now = new Date();
  await contacts.updateOne(
    { _id: liveCanonical as unknown as ObjectId } as never,
    {
      $set: {
        traits: mergedTraits,
        consents: Array.from(consentByChannel.values()),
        primaryEmail: winner.primaryEmail ?? loser.primaryEmail,
        primaryPhone: winner.primaryPhone ?? loser.primaryPhone,
        accountId: winner.accountId ?? loser.accountId,
        updatedAt: now,
      },
    },
  );

  // 6. Tombstone the loser.
  await contacts.updateOne(
    { _id: liveLoser as unknown as ObjectId } as never,
    { $set: { mergedInto: liveCanonical, updatedAt: now } },
  );

  // 7. Emit.
  void emit(tenantId, {
    type: 'contact.merged',
    contactId: liveCanonical,
    payload: { from: liveLoser, into: liveCanonical },
  });

  return liveCanonical;
}

/* ══════════════════════════════════════════════════════════
   Read helpers
   ══════════════════════════════════════════════════════════ */

/** Fetch a contact by id, following mergedInto to the live head. */
export async function getContact(
  tenantId: string,
  contactId: string,
): Promise<Contact | null> {
  const live = await getCanonicalId(tenantId, contactId);
  if (!live) return null;
  const col = await getContactsCollection();
  const doc = await col.findOne({ _id: live as unknown as ObjectId, tenantId } as never);
  return doc ? mapContact(doc) : null;
}

/**
 * Resolve an identity and return the full Contact aggregate. Convenience for
 * UI flows that need both the id and the data in one round-trip.
 */
export async function resolveAndLoadContact(
  tenantId: string,
  identity: IdentityInput,
): Promise<Contact> {
  const id = await resolveContact(tenantId, identity);
  const c = await getContact(tenantId, id);
  if (!c) throw new Error(`Contact ${id} disappeared after resolution`);
  return c;
}
