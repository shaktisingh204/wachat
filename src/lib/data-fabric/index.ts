/**
 * Cross-Module Data Fabric — public barrel.
 *
 * Other SabNode modules (Wachat, CRM, sabChat, HRM, SabFlow, …) import from
 * here only:
 *
 *   import { resolveContact, setTrait, hasConsent } from '@/lib/data-fabric';
 *
 * Internal helpers live in their own files and are intentionally not
 * re-exported (e.g. trait/consent persistence, Mongo doc shapes).
 */

export type {
  Contact,
  Identity,
  IdentityType,
  IdentityInput,
  Account,
  Consent,
  Trait,
  TraitEntry,
  DomainEvent,
  DomainEventType,
  EventHandler,
  Unsubscribe,
} from './types';

export {
  resolveContact,
  resolveAndLoadContact,
  mergeContacts,
  getContact,
  getCanonicalId,
  normalizeIdentity,
} from './identity';

export {
  emit,
  subscribe,
  _resetEmitterForTests,
} from './events';

export {
  getTrait,
  getTraitEntry,
  getTraits,
  setTrait,
  setTraits,
  getConsent,
  hasConsent,
  setConsent,
} from './cdp-traits';

export {
  getContactsCollection,
  getIdentitiesCollection,
  getAccountsCollection,
  getEventsCollection,
} from './db';
