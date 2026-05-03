/**
 * High-level Data Fabric API — convenience wrappers other modules import.
 *
 * The lower-level primitives (`resolveContact`, `mergeContacts`,
 * `getContact`) are perfectly usable on their own; the helpers here add
 * the small but common ergonomics every caller would otherwise re-invent:
 *
 *   - `findOrCreateContact(tenantId, identity)` returns the full
 *     `Contact` aggregate, not just an id.
 *   - `mergeContactsByIdentity(tenantId, a, b)` resolves two identities
 *     and merges them — the natural operator-tooling entry point.
 *   - `getCanonicalContact(tenantId, anyModuleId)` looks up a contact
 *     given any module-specific identity (e.g. a CRM lead id) and
 *     returns the canonical fabric record.
 */
import type { Contact, IdentityInput, IdentityType } from './types';
import {
  resolveContact,
  mergeContacts,
  getContact,
  resolveAndLoadContact,
} from './identity';
import { getIdentitiesCollection } from './db';

/* ══════════════════════════════════════════════════════════
   findOrCreateContact
   ══════════════════════════════════════════════════════════ */

/**
 * Resolve an identity to its canonical contact, creating both if missing.
 * Returns the full aggregate.
 */
export async function findOrCreateContact(
  tenantId: string,
  identity: IdentityInput,
): Promise<Contact> {
  return resolveAndLoadContact(tenantId, identity);
}

/* ══════════════════════════════════════════════════════════
   mergeContactsByIdentity
   ══════════════════════════════════════════════════════════ */

/**
 * Resolve two identities to their canonical contacts and merge them.
 * The first identity's contact wins.
 *
 * Idempotent — calling twice with the same inputs is a no-op once the
 * loser is tombstoned.
 */
export async function mergeContactsByIdentity(
  tenantId: string,
  identityA: IdentityInput,
  identityB: IdentityInput,
): Promise<string> {
  const aId = await resolveContact(tenantId, identityA);
  const bId = await resolveContact(tenantId, identityB);
  if (aId === bId) return aId;
  return mergeContacts(tenantId, aId, bId);
}

/* ══════════════════════════════════════════════════════════
   getCanonicalContact
   ══════════════════════════════════════════════════════════ */

/**
 * Given any module-specific identifier (a Wachat `wa_id`, a CRM lead
 * `_id`, etc.), return the canonical contact. The caller specifies the
 * identity type so we know how to normalise the value.
 *
 * Returns null when no identity row matches.
 */
export async function getCanonicalContact(
  tenantId: string,
  anyModuleId: { type: IdentityType; value: string },
): Promise<Contact | null> {
  if (!tenantId) throw new Error('tenantId is required');
  const identities = await getIdentitiesCollection();
  // Reuse the resolver to honour normalisation without inserting on miss.
  // We do that by looking up the identity row directly first.
  const { normalizeIdentity } = await import('./identity');
  const value = normalizeIdentity(anyModuleId.type, anyModuleId.value);
  const row = await identities.findOne({
    tenantId,
    type: anyModuleId.type,
    value,
  });
  if (!row) return null;
  return getContact(tenantId, row.contactId);
}
