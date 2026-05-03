/**
 * Trait getter/setter — last-write-wins per (tenantId, contactId, traitKey).
 *
 * Traits are stored on the canonical contact document under `traits[key]` as
 * `{ value, updatedAt, source? }`. A write with an older `updatedAt` than the
 * stored entry is ignored, preserving idempotence under out-of-order
 * delivery.
 *
 * Consents are also exposed here since they're the most common cross-module
 * "trait-like" record.
 */

import { ObjectId } from 'mongodb';
import { getContactsCollection } from './db';
import { getCanonicalId } from './identity';
import { emit } from './events';
import type { Trait, TraitEntry, Consent } from './types';

/* ══════════════════════════════════════════════════════════
   Traits
   ══════════════════════════════════════════════════════════ */

/** Returns the raw trait entry (with metadata) or null. */
export async function getTraitEntry(
  tenantId: string,
  contactId: string,
  key: string,
): Promise<TraitEntry | null> {
  const live = await getCanonicalId(tenantId, contactId);
  if (!live) return null;
  const col = await getContactsCollection();
  const doc = await col.findOne(
    { _id: live as unknown as ObjectId, tenantId } as never,
    { projection: { [`traits.${key}`]: 1 } } as never,
  );
  return doc?.traits?.[key] ?? null;
}

/** Convenience: bare value, or null. */
export async function getTrait(
  tenantId: string,
  contactId: string,
  key: string,
): Promise<Trait | null> {
  const entry = await getTraitEntry(tenantId, contactId, key);
  return entry ? entry.value : null;
}

/** Returns the full traits map (live canonical only). */
export async function getTraits(
  tenantId: string,
  contactId: string,
): Promise<Record<string, TraitEntry>> {
  const live = await getCanonicalId(tenantId, contactId);
  if (!live) return {};
  const col = await getContactsCollection();
  const doc = await col.findOne(
    { _id: live as unknown as ObjectId, tenantId } as never,
    { projection: { traits: 1 } } as never,
  );
  return doc?.traits ?? {};
}

/**
 * Set a trait with last-write-wins semantics.
 *
 * Returns:
 *   - 'written'  when the trait was created or replaced
 *   - 'stale'    when the existing trait has a newer `updatedAt`
 *   - 'missing'  when the contact does not exist
 */
export async function setTrait(
  tenantId: string,
  contactId: string,
  key: string,
  value: Trait,
  opts?: { source?: string; updatedAt?: Date },
): Promise<'written' | 'stale' | 'missing'> {
  if (!key) throw new Error('trait key is required');
  const live = await getCanonicalId(tenantId, contactId);
  if (!live) return 'missing';

  const updatedAt = opts?.updatedAt ?? new Date();
  const col = await getContactsCollection();

  // Conditional write — only overwrite when the new entry is strictly newer.
  // Use $or to also match the "no entry yet" case.
  const filter: Record<string, unknown> = {
    _id: live as unknown as ObjectId,
    tenantId,
    $or: [
      { [`traits.${key}`]: { $exists: false } },
      { [`traits.${key}.updatedAt`]: { $lt: updatedAt } },
    ],
  };
  const entry: TraitEntry = {
    value,
    updatedAt,
    ...(opts?.source ? { source: opts.source } : {}),
  };
  const res = await col.updateOne(filter as never, {
    $set: { [`traits.${key}`]: entry, updatedAt: new Date() },
  });

  if (res.matchedCount === 0) return 'stale';

  void emit(tenantId, {
    type: 'trait.changed',
    contactId: live,
    source: opts?.source,
    payload: { key, value, updatedAt },
  });

  return 'written';
}

/** Bulk set — convenience wrapper, all traits share the same `updatedAt`. */
export async function setTraits(
  tenantId: string,
  contactId: string,
  traits: Record<string, Trait>,
  opts?: { source?: string; updatedAt?: Date },
): Promise<Record<string, 'written' | 'stale' | 'missing'>> {
  const out: Record<string, 'written' | 'stale' | 'missing'> = {};
  for (const [k, v] of Object.entries(traits)) {
    out[k] = await setTrait(tenantId, contactId, k, v, opts);
  }
  return out;
}

/* ══════════════════════════════════════════════════════════
   Consents
   ══════════════════════════════════════════════════════════ */

/**
 * Set or update a consent record. Last-write-wins per channel — a write with
 * an older `updatedAt` than the stored consent is ignored.
 */
export async function setConsent(
  tenantId: string,
  contactId: string,
  consent: Omit<Consent, 'updatedAt'> & { updatedAt?: Date },
): Promise<'written' | 'stale' | 'missing'> {
  const live = await getCanonicalId(tenantId, contactId);
  if (!live) return 'missing';

  const col = await getContactsCollection();
  const doc = await col.findOne(
    { _id: live as unknown as ObjectId, tenantId } as never,
    { projection: { consents: 1 } } as never,
  );
  if (!doc) return 'missing';

  const updatedAt = consent.updatedAt ?? new Date();
  const next: Consent = {
    channel: consent.channel,
    granted: consent.granted,
    source: consent.source,
    reason: consent.reason,
    updatedAt,
    revokedAt: consent.granted ? undefined : (consent.revokedAt ?? updatedAt),
  };

  const existing = (doc.consents ?? []).find((c) => c.channel === consent.channel);
  if (existing && existing.updatedAt >= updatedAt) return 'stale';

  const filtered = (doc.consents ?? []).filter((c) => c.channel !== consent.channel);
  const updated = [...filtered, next];

  await col.updateOne(
    { _id: live as unknown as ObjectId } as never,
    { $set: { consents: updated, updatedAt: new Date() } },
  );

  void emit(tenantId, {
    type: 'consent.changed',
    contactId: live,
    source: consent.source,
    payload: next,
  });

  return 'written';
}

/** Returns the consent record for a channel, or null. */
export async function getConsent(
  tenantId: string,
  contactId: string,
  channel: string,
): Promise<Consent | null> {
  const live = await getCanonicalId(tenantId, contactId);
  if (!live) return null;
  const col = await getContactsCollection();
  const doc = await col.findOne(
    { _id: live as unknown as ObjectId, tenantId } as never,
    { projection: { consents: 1 } } as never,
  );
  return (doc?.consents ?? []).find((c) => c.channel === channel) ?? null;
}

/** Returns true when a contact has an active grant on the given channel. */
export async function hasConsent(
  tenantId: string,
  contactId: string,
  channel: string,
): Promise<boolean> {
  const c = await getConsent(tenantId, contactId, channel);
  return !!(c && c.granted && !c.revokedAt);
}
