/**
 * Cross-Module Data Fabric — type definitions.
 *
 * The data fabric unifies SabNode's per-module contact stores (Wachat
 * `contacts`, CRM `leads`, sabChat `customers`, HRM `employees`, etc.) behind
 * a single canonical contact record per tenant. Each canonical contact carries
 * one or more `Identity` rows (phone, email, wachat_wa_id, …) and a free-form
 * `traits` bag updated last-write-wins. Domain events flow through the
 * in-process bus (`events.ts`) and are mirrored over Redis pub/sub for
 * cross-process fan-out.
 */

/* ══════════════════════════════════════════════════════════
   Identities
   ══════════════════════════════════════════════════════════ */

/**
 * The canonical set of identifier kinds we resolve against. Adding a new
 * source module = adding a string here.
 */
export type IdentityType =
  | 'phone'
  | 'email'
  | 'wachat_wa_id'
  | 'crm_lead_id'
  | 'sabchat_customer_id'
  | 'hrm_employee_id'
  | 'firebase_uid'
  | 'external';

/** A single identifier that resolves to a canonical contact. */
export interface Identity {
  /** Multi-tenant scope. */
  tenantId: string;
  /** Identifier kind. */
  type: IdentityType;
  /** The raw identifier value (already normalised — see `normalizeIdentity`). */
  value: string;
  /** Canonical contact this identity points at. */
  contactId: string;
  /** Optional source module that asserted this identity. */
  source?: string;
  createdAt: Date;
  updatedAt: Date;
}

/* ══════════════════════════════════════════════════════════
   Contacts
   ══════════════════════════════════════════════════════════ */

/**
 * A consent record gates outbound communication per channel.  Last-write-wins
 * via `updatedAt`; a `revokedAt` set means the contact has opted out.
 */
export interface Consent {
  channel: 'email' | 'sms' | 'whatsapp' | 'push' | 'voice' | string;
  granted: boolean;
  source?: string;
  /** ISO reason for grant/revoke (e.g. 'double_opt_in', 'unsubscribe_link'). */
  reason?: string;
  updatedAt: Date;
  revokedAt?: Date;
}

/** Free-form trait bag — values are last-write-wins per (contactId, key). */
export type Trait = string | number | boolean | null | Date | Record<string, unknown> | unknown[];

export interface TraitEntry {
  value: Trait;
  updatedAt: Date;
  source?: string;
}

/** The canonical contact aggregate. */
export interface Contact {
  /** Stable string id (Mongo ObjectId hex). */
  id: string;
  tenantId: string;
  /** Display name, best-known. */
  displayName?: string;
  /** Convenience denormalised fields — kept in sync with identities. */
  primaryEmail?: string;
  primaryPhone?: string;
  /** Account this contact belongs to (B2B). Optional. */
  accountId?: string;
  /** Free-form traits, last-write-wins. */
  traits: Record<string, TraitEntry>;
  /** Per-channel consent. */
  consents: Consent[];
  /** Soft-delete: when set, the contact has been merged into `mergedInto`. */
  mergedInto?: string;
  /** Audit. */
  createdAt: Date;
  updatedAt: Date;
}

/* ══════════════════════════════════════════════════════════
   Accounts (B2B grouping)
   ══════════════════════════════════════════════════════════ */

export interface Account {
  id: string;
  tenantId: string;
  name: string;
  domain?: string;
  externalIds?: Record<string, string>;
  traits?: Record<string, TraitEntry>;
  createdAt: Date;
  updatedAt: Date;
}

/* ══════════════════════════════════════════════════════════
   Domain events
   ══════════════════════════════════════════════════════════ */

export type DomainEventType =
  | 'contact.created'
  | 'contact.updated'
  | 'contact.merged'
  | 'identity.added'
  | 'identity.removed'
  | 'account.upserted'
  | 'consent.changed'
  | 'trait.changed';

export interface DomainEvent<T = unknown> {
  /** Stable string id (uuid-ish). */
  id: string;
  tenantId: string;
  type: DomainEventType;
  /** Optional contactId the event pertains to. */
  contactId?: string;
  /** Optional accountId the event pertains to. */
  accountId?: string;
  /** Origin module (e.g. 'wachat', 'crm', 'sabflow'). */
  source?: string;
  /** Event payload — arbitrary JSON-serialisable value. */
  payload: T;
  /** Server timestamp. */
  occurredAt: Date;
}

/** Identity input shape — the resolver normalises and looks this up. */
export interface IdentityInput {
  type: IdentityType;
  value: string;
  source?: string;
}

/** Subscriber callback. Throwing inside is logged but does not stop fan-out. */
export type EventHandler = (event: DomainEvent) => void | Promise<void>;

/** Disposer returned from `subscribe`. */
export type Unsubscribe = () => void;
