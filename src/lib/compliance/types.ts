/**
 * SabNode Compliance, Security & Audit — shared types.
 *
 * These types are the contract between the audit log, retention, DSR,
 * DLP, legal-hold, BYOK, and SIEM modules.  They are deliberately
 * framework-agnostic so they can be re-used by background workers,
 * admin tooling and tenant-facing dashboards.
 */

/* ── Data classification ────────────────────────────────────────────── */

/**
 * Sensitivity classification applied to a record or field.  Used by
 * retention, DSR and DLP policies to decide what may be exported,
 * tombstoned or scrubbed.
 */
export type DataClassification =
    | 'public'
    | 'internal'
    | 'confidential'
    | 'restricted'
    | 'pii'
    | 'phi'
    | 'pci';

/* ── Audit events ───────────────────────────────────────────────────── */

/**
 * A single, append-only entry in the per-tenant audit log.  Each entry
 * is hash-chained: `hash = SHA256(prev_hash || canonical(payload))`.
 */
export interface AuditEvent {
    /** Tenant scope for the event (multi-tenant SaaS). */
    tenantId: string;
    /** Stable client-generated identifier for the entry. */
    id: string;
    /** UTC ISO-8601 timestamp the event was recorded. */
    ts: string;
    /** Acting user / service principal (`user:abc`, `system`, etc.). */
    actor: string;
    /** Verb describing what happened (`contact.update`, `auth.login`). */
    action: string;
    /** Logical resource the action targeted (`contacts/123`). */
    resource: string;
    /** Snapshot of the resource before the change (optional). */
    before?: Record<string, unknown>;
    /** Snapshot of the resource after the change (optional). */
    after?: Record<string, unknown>;
    /** Free-form metadata: ip, user-agent, request-id, etc. */
    metadata?: Record<string, unknown>;
    /** SHA-256 of the previous entry — links the chain. */
    prev_hash: string;
    /** SHA-256 of this entry's canonical payload + prev_hash. */
    hash: string;
}

/** Filter used by `queryAuditLog` — all fields are optional. */
export interface AuditQueryFilter {
    tenantId: string;
    actor?: string;
    action?: string;
    resource?: string;
    from?: string;
    to?: string;
    /** Opaque cursor returned by the previous page. */
    cursor?: string;
    /** Page size (default 100, max 1000). */
    limit?: number;
}

/** Page returned by `queryAuditLog`. */
export interface AuditQueryPage {
    items: AuditEvent[];
    nextCursor: string | null;
}

/* ── Retention ──────────────────────────────────────────────────────── */

/**
 * Per-classification retention policy.  Records that have been
 * tombstoned (`deletedAt` set) past their TTL are physically purged by
 * `applyRetention(tenantId)`.
 */
export interface RetentionPolicy {
    tenantId: string;
    /** Logical collection name (`contacts`, `messages`, …). */
    collection: string;
    classification: DataClassification;
    /** Days to keep tombstoned records before physical purge. */
    ttlDays: number;
    /** If true, records marked for legal hold are skipped. */
    respectLegalHold: boolean;
}

/* ── Legal hold ─────────────────────────────────────────────────────── */

/**
 * A legal-hold scope freezes a set of records — preventing both
 * retention purges and DSR erasure — until the hold is released.
 */
export interface LegalHold {
    id: string;
    tenantId: string;
    /**
     * Scope filter — interpreted as a Mongo-style match document
     * scoped to the tenant.  Examples:
     *   `{ collection: 'messages', subjectId: 'subject_123' }`
     *   `{ collection: '*' }` (everything in the tenant)
     */
    scope: Record<string, unknown>;
    /** Free-form reason: case number, regulator notice, etc. */
    reason: string;
    createdAt: string;
    createdBy: string;
    releasedAt?: string;
    releasedBy?: string;
}

/* ── Data subject requests ──────────────────────────────────────────── */

/** Lifecycle states for a GDPR-style data-subject request (DSR). */
export type DsrStatus =
    | 'pending'
    | 'in_progress'
    | 'completed'
    | 'rejected'
    | 'failed';

/** Type of right being exercised (Art 15 / 17 / 20). */
export type DsrType = 'export' | 'erase' | 'rectify' | 'restrict';

/**
 * A data-subject request submitted by, or on behalf of, an individual
 * whose personal data we hold.
 */
export interface DataSubjectRequest {
    id: string;
    tenantId: string;
    subjectId: string;
    type: DsrType;
    status: DsrStatus;
    requestedAt: string;
    completedAt?: string;
    /** S3 / blob URL where the export ZIP can be downloaded (export). */
    artifactUrl?: string;
    notes?: string;
}

/* ── BAA agreements ─────────────────────────────────────────────────── */

/**
 * A signed Business Associate Agreement — required under HIPAA before
 * a tenant may store PHI.
 */
export interface BaaAgreement {
    id: string;
    tenantId: string;
    counterpartyName: string;
    signedAt: string;
    expiresAt: string;
    /** Reference to the executed PDF in storage. */
    documentUrl: string;
    /** True once both parties have countersigned. */
    active: boolean;
}

/* ── DLP rules ──────────────────────────────────────────────────────── */

/**
 * A single Data-Loss-Prevention rule.  Patterns may be plain regex or
 * augmented by a custom validator (e.g. Luhn for credit cards).
 */
export interface DlpRule {
    id: string;
    name: string;
    /** What kind of secret we are looking for. */
    category:
        | 'email'
        | 'phone'
        | 'credit_card'
        | 'ssn'
        | 'aws_access_key'
        | 'aws_secret_key'
        | 'jwt'
        | 'api_key'
        | 'private_key'
        | 'iban'
        | 'custom';
    /** ECMAScript regex source. */
    pattern: string;
    /** Regex flags (defaults to 'g'). */
    flags?: string;
    /** Optional custom validator — return `true` to keep the match. */
    validator?: 'luhn' | 'entropy' | 'jwt';
    /** Minimum Shannon entropy for `validator: 'entropy'`. */
    minEntropy?: number;
    severity: 'low' | 'medium' | 'high' | 'critical';
}

/** A single occurrence of a DLP rule match in scanned text. */
export interface DlpFinding {
    ruleId: string;
    ruleName: string;
    category: DlpRule['category'];
    severity: DlpRule['severity'];
    /** Index in the scanned string where the match starts. */
    start: number;
    /** Index where the match ends (exclusive). */
    end: number;
    /** The raw matched substring (caller decides whether to redact). */
    match: string;
}

/* ── Data residency ─────────────────────────────────────────────────── */

/**
 * Per-tenant data-residency configuration.  The `region` field is the
 * authoritative jurisdiction; `allowedRegions` is the set of regions
 * where replicas / backups may legally be stored.
 */
export interface DataResidency {
    tenantId: string;
    region: 'us' | 'eu' | 'uk' | 'in' | 'ap' | 'au' | 'ca';
    allowedRegions: Array<DataResidency['region']>;
    /** ISO-3166 alpha-2 code for the legal entity controlling the data. */
    controllerCountry: string;
    updatedAt: string;
}

/* ── BYOK ───────────────────────────────────────────────────────────── */

/**
 * Envelope-encrypted data key — what `wrapKey` returns and `unwrapKey`
 * consumes.  All fields are base64-encoded so the structure is safe to
 * store in JSON / Mongo.
 */
export interface WrappedKey {
    /** AWS KMS / CMK ARN that produced the wrap. */
    kekArn: string;
    /** Algorithm used to wrap (we use AES-256-GCM offline). */
    alg: 'AES-256-GCM' | 'aws:kms';
    /** Base64 IV / nonce. */
    iv: string;
    /** Base64 GCM auth tag. */
    tag: string;
    /** Base64 ciphertext of the data key. */
    ct: string;
}

/* ── SIEM ───────────────────────────────────────────────────────────── */

/** Supported SIEM forwarding targets. */
export type SiemTarget = 'splunk' | 'datadog' | 'elastic';

/** Result of a SIEM push attempt. */
export interface SiemPushResult {
    target: SiemTarget;
    accepted: number;
    rejected: number;
    errors: string[];
}
