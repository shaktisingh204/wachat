/**
 * SabCRM — GDPR / data-privacy tooling — PURE helpers.
 *
 * The structural twin of `./scoring.ts` / `./access-compiler.ts`: a
 * `'server-only'`- and I/O-free module so the unit tests (`tsx --test`) AND the
 * `'use client'` privacy settings page can import the types + the deterministic
 * consent / anonymization math directly. All Mongo side effects live in
 * `./gdpr.server.ts`, which re-exports everything here.
 *
 * Three responsibilities, all pure:
 *
 *  1. **Consent** — {@link ConsentRecord} model + {@link isConsentValid}: is a
 *     subject's consent for a given purpose currently active (granted, not
 *     withdrawn, not expired)?
 *  2. **Erasure (Right-To-Be-Forgotten)** — {@link anonymizationPlan}: given a
 *     record's `data` bag and the PII field keys, produce the dotted `$set`
 *     redaction map that NULLS the PII while keeping the row (so referential
 *     integrity, counts and aggregates survive). Conservative: it only ever
 *     redacts keys explicitly listed as PII; it never invents keys.
 *  3. **DSAR (data-subject access request)** — {@link dsarBundleShape}: the
 *     canonical export envelope assembled by the server side, expressed as a
 *     pure builder so the shape is unit-testable.
 *
 * SECURITY: anonymization only ever REMOVES information (sets PII to null). It
 * can never widen a subject's data exposure. `isConsentValid` fails CLOSED — an
 * unrecognised / malformed consent record is treated as "no valid consent".
 */

/* -------------------------------------------------------------------------- */
/* Consent model                                                               */
/* -------------------------------------------------------------------------- */

/** Lifecycle status of a consent grant. */
export type ConsentStatus = 'granted' | 'withdrawn';

/**
 * A single consent record for one data subject + one processing purpose.
 *
 * `purpose` is a free-form string the tenant defines (e.g. `marketing`,
 * `analytics`, `transactional`). `subjectEmail` is the natural key that ties a
 * consent to CRM records / activities (normalized lower-case in the server).
 */
export interface ConsentRecord {
  /** Stable id (Mongo `_id` hex on the server side). */
  id: string;
  projectId: string;
  /** The data subject — normalized lower-case email. */
  subjectEmail: string;
  /** Processing purpose this consent covers. */
  purpose: string;
  status: ConsentStatus;
  /** ISO-8601 timestamp consent was granted. */
  grantedAt: string;
  /** ISO-8601 timestamp consent was withdrawn (null while active). */
  withdrawnAt: string | null;
  /**
   * Optional ISO-8601 expiry. When set and in the past, the consent is no
   * longer valid even if not explicitly withdrawn.
   */
  expiresAt?: string | null;
  /** Free-form source/notes (e.g. "double opt-in form #42"). */
  source?: string;
  createdAt: string;
  updatedAt: string;
}

/** Shape accepted by the record-consent action (server stamps id/timestamps). */
export interface ConsentInput {
  subjectEmail: string;
  purpose: string;
  status: ConsentStatus;
  /** ISO-8601; defaults to "now" on the server when omitted for a grant. */
  grantedAt?: string;
  expiresAt?: string | null;
  source?: string;
}

/**
 * Parse an ISO-8601 string to epoch millis, or `null` when missing/invalid.
 * Pure; used by {@link isConsentValid} so expiry math is unit-tested.
 */
export function parseIsoMs(value: unknown): number | null {
  if (typeof value !== 'string' || value.trim() === '') return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

/**
 * Whether a consent record currently authorizes processing for `purpose`.
 *
 * Fails CLOSED:
 *  - null/malformed consent → false.
 *  - purpose mismatch (case-insensitive, trimmed) → false.
 *  - status !== 'granted' → false.
 *  - withdrawnAt set → false.
 *  - expiresAt set and <= now → false.
 *
 * `now` is injected (defaults to `Date.now()`) so the check is deterministic in
 * tests.
 */
export function isConsentValid(
  consent: ConsentRecord | null | undefined,
  purpose: string,
  now: number = Date.now(),
): boolean {
  if (!consent || typeof consent !== 'object') return false;
  if (consent.status !== 'granted') return false;
  if (consent.withdrawnAt) return false;

  const wantPurpose = String(purpose ?? '').trim().toLowerCase();
  const havePurpose = String(consent.purpose ?? '').trim().toLowerCase();
  if (!wantPurpose || wantPurpose !== havePurpose) return false;

  const granted = parseIsoMs(consent.grantedAt);
  // A grant with no parseable grantedAt cannot be trusted — fail closed.
  if (granted === null || granted > now) return false;

  const expires = parseIsoMs(consent.expiresAt);
  if (expires !== null && expires <= now) return false;

  return true;
}

/* -------------------------------------------------------------------------- */
/* Erasure (Right-To-Be-Forgotten) — anonymization plan                        */
/* -------------------------------------------------------------------------- */

/** Sentinel written to `data.__gdpr.erasedAt` and similar audit markers. */
export const ERASURE_MARKER_KEY = '__gdpr';

/**
 * The redaction map for erasing one record: dotted `data.<key>` paths set to
 * `null`, plus the erasure audit marker. Designed to be passed straight to a
 * Mongo `$set` (the keys are already fully-qualified). This is the OUTPUT of
 * {@link anonymizationPlan}.
 */
export interface AnonymizationPlan {
  /** Dotted `$set` map: `data.<piiKey>` -> null + the `data.__gdpr` marker. */
  set: Record<string, unknown>;
  /** The PII field keys that were actually present + nulled (for the log). */
  redactedKeys: string[];
  /** True when at least one PII key was present and will be nulled. */
  hasChanges: boolean;
}

/**
 * Build the anonymization (erasure) plan for one record.
 *
 * Keeps the row; sets each present PII field to `null`; never touches a key that
 * isn't in `piiFieldKeys`. Composite values (e.g. a FULL_NAME `{first,last}` or
 * an EMAILS array) are nulled wholesale — the safest redaction. Keys absent
 * from `data` are skipped so the `$set` stays minimal (and `hasChanges` reflects
 * whether the record actually carried any of the subject's PII).
 *
 * The `data.__gdpr` marker records WHEN the row was erased + which keys were
 * redacted, so the erasure is auditable on the record itself. Callers stamp the
 * outer `erasedAt` timestamp via {@link buildErasureMarker}.
 *
 * Pure + deterministic given `data`, `piiFieldKeys` and `erasedAt`.
 */
export function anonymizationPlan(
  data: Record<string, unknown> | null | undefined,
  piiFieldKeys: readonly string[],
  erasedAt: string = new Date().toISOString(),
): AnonymizationPlan {
  const bag = data && typeof data === 'object' ? data : {};
  const set: Record<string, unknown> = {};
  const redactedKeys: string[] = [];

  for (const rawKey of piiFieldKeys ?? []) {
    const key = String(rawKey ?? '').trim();
    if (!key) continue;
    // Never let a key escape the `data.<key>` path or pollute the query object.
    if (key.includes('$') || key.includes('.')) continue;
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
      continue;
    }
    // Only redact a key that is actually present + non-null on the record.
    if (!(key in bag)) continue;
    const current = bag[key];
    if (current === null || current === undefined) continue;
    set[`data.${key}`] = null;
    redactedKeys.push(key);
  }

  const hasChanges = redactedKeys.length > 0;
  if (hasChanges) {
    set[`data.${ERASURE_MARKER_KEY}`] = buildErasureMarker(erasedAt, redactedKeys);
  }

  return { set, redactedKeys, hasChanges };
}

/** The per-record erasure audit marker stored at `data.__gdpr`. */
export interface ErasureMarker {
  erasedAt: string;
  redactedKeys: string[];
}

/** Build the {@link ErasureMarker} written to `data.__gdpr`. */
export function buildErasureMarker(
  erasedAt: string,
  redactedKeys: string[],
): ErasureMarker {
  return { erasedAt, redactedKeys: [...redactedKeys] };
}

/* -------------------------------------------------------------------------- */
/* DSAR (data-subject access request) — bundle shape                           */
/* -------------------------------------------------------------------------- */

/** One CRM record included in a DSAR export (object + redacted-safe data). */
export interface DsarRecordEntry {
  object: string;
  recordId: string;
  data: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
}

/** One activity (timeline entry) included in a DSAR export. */
export interface DsarActivityEntry {
  activityId: string;
  type: string;
  title?: string;
  body?: string;
  targetObject?: string;
  targetRecordId?: string;
  occurredAt?: string | null;
  createdAt?: string;
}

/** The complete DSAR export bundle for one data subject. */
export interface DsarBundle {
  /** Bundle format version (bump on breaking shape changes). */
  version: 1;
  projectId: string;
  subjectEmail: string;
  /** ISO-8601 timestamp the bundle was generated. */
  generatedAt: string;
  records: DsarRecordEntry[];
  activities: DsarActivityEntry[];
  consents: ConsentRecord[];
  counts: {
    records: number;
    activities: number;
    consents: number;
  };
}

/**
 * Assemble a {@link DsarBundle} from already-gathered parts. Pure: the server
 * gathers the records / activities / consents (I/O) then calls this to produce
 * the canonical, versioned, counted envelope. Keeping it pure means the shape is
 * unit-tested and the JSON is stable across callers.
 */
export function dsarBundleShape(args: {
  projectId: string;
  subjectEmail: string;
  records: DsarRecordEntry[];
  activities: DsarActivityEntry[];
  consents: ConsentRecord[];
  generatedAt?: string;
}): DsarBundle {
  const records = args.records ?? [];
  const activities = args.activities ?? [];
  const consents = args.consents ?? [];
  return {
    version: 1,
    projectId: args.projectId,
    subjectEmail: args.subjectEmail,
    generatedAt: args.generatedAt ?? new Date().toISOString(),
    records,
    activities,
    consents,
    counts: {
      records: records.length,
      activities: activities.length,
      consents: consents.length,
    },
  };
}

/* -------------------------------------------------------------------------- */
/* Subject-email normalization                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Normalize a subject email for matching + storage: trimmed, lower-cased.
 * Returns '' for non-string / empty input (callers treat '' as "no subject").
 * Pure; the single canonicalization rule shared by consent lookups, erasure and
 * DSAR so a subject is matched consistently everywhere.
 */
export function normalizeSubjectEmail(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.trim().toLowerCase();
}
