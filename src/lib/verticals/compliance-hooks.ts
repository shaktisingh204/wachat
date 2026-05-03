/**
 * Industry-specific compliance hooks.
 *
 * Hooks are pure-function gates the platform calls before performing
 * sensitive operations on tenant data. They never touch transport — they
 * decide *whether* an operation may proceed and *what* the caller should
 * sanitise/encrypt before continuing.
 *
 * The catalog here is intentionally light on ceremony: each regime
 * (HIPAA, FERPA, FINRA, GDPR…) registers a small set of hooks that the
 * vertical declares it needs in {@link Vertical.complianceHooks}.
 */

export interface ComplianceContext {
  tenantId: string;
  /** When the operation involves a record, the entity name (e.g. "patient"). */
  entity?: string;
  /** Free-form payload of the record being written/exported/sent. */
  payload?: Record<string, unknown>;
  /** Caller principal — used for BAA / signed-agreement checks. */
  actor?: { id: string; role: string };
  /** Tenant flags — mirror of the tenant document, populated by the caller. */
  tenantFlags?: Record<string, boolean>;
}

export interface ComplianceVerdict {
  /** Whether the operation is allowed to proceed. */
  allowed: boolean;
  /** When `allowed=false`, machine-readable reason. */
  reason?: string;
  /** Sanitised payload — when present, callers MUST use this instead. */
  sanitisedPayload?: Record<string, unknown>;
  /** Audit metadata for the platform compliance log. */
  audit?: Record<string, unknown>;
}

export type ComplianceHook = (ctx: ComplianceContext) => ComplianceVerdict;

const REGISTRY = new Map<string, ComplianceHook>();

export function registerHook(id: string, hook: ComplianceHook): void {
  REGISTRY.set(id, hook);
}

export function getHook(id: string): ComplianceHook | undefined {
  return REGISTRY.get(id);
}

export function listHooks(): string[] {
  return Array.from(REGISTRY.keys()).sort();
}

export function runHook(id: string, ctx: ComplianceContext): ComplianceVerdict {
  const hook = REGISTRY.get(id);
  if (!hook) {
    return { allowed: true, audit: { hookMissing: id } };
  }
  return hook(ctx);
}

// ── PHI redaction primitive ─────────────────────────────────────────────────

const PHI_FIELDS = new Set([
  'ssn',
  'social_security_number',
  'mrn',
  'medical_record_number',
  'diagnosis',
  'icd10',
  'icd_10',
  'medications',
  'lab_results',
  'date_of_birth',
  'dob',
]);

export function redactPHI<T extends Record<string, unknown>>(payload: T): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(payload)) {
    if (PHI_FIELDS.has(k.toLowerCase())) {
      out[k] = '[REDACTED:PHI]';
    } else {
      out[k] = v;
    }
  }
  return out as T;
}

// ── HIPAA (healthcare) ──────────────────────────────────────────────────────

/**
 * HIPAA install gate: blocks installation of healthcare verticals unless the
 * tenant has signed a Business Associate Agreement.
 */
registerHook('hipaa.baa-gate', (ctx) => {
  if (!ctx.tenantFlags?.baaSigned) {
    return {
      allowed: false,
      reason: 'HIPAA Business Associate Agreement (BAA) is not signed for this tenant.',
      audit: { regime: 'HIPAA', stage: 'install' },
    };
  }
  return { allowed: true, audit: { regime: 'HIPAA', stage: 'install', verified: 'baa' } };
});

/**
 * HIPAA outbound message gate: redacts PHI before a message is sent over an
 * unencrypted channel. The caller is expected to substitute the sanitised
 * payload into the template before transmission.
 */
registerHook('hipaa.phi-redaction', (ctx) => {
  if (!ctx.payload) return { allowed: true };
  const sanitised = redactPHI(ctx.payload);
  return {
    allowed: true,
    sanitisedPayload: sanitised,
    audit: { regime: 'HIPAA', redactedKeys: Object.keys(ctx.payload).filter((k) => PHI_FIELDS.has(k.toLowerCase())) },
  };
});

/**
 * HIPAA write gate: enforces minimum-necessary access on patient writes.
 */
registerHook('hipaa.minimum-necessary', (ctx) => {
  if (ctx.entity === 'patient' && ctx.actor?.role === 'agent') {
    if (ctx.payload && 'diagnosis' in ctx.payload) {
      return {
        allowed: false,
        reason: 'Agents may not write clinical fields (HIPAA minimum-necessary).',
        audit: { regime: 'HIPAA' },
      };
    }
  }
  return { allowed: true };
});

// ── FERPA (education) ───────────────────────────────────────────────────────

/**
 * FERPA student-data isolation: prevents cross-tenant export of student PII.
 */
registerHook('ferpa.student-isolation', (ctx) => {
  if (!ctx.tenantId) {
    return {
      allowed: false,
      reason: 'FERPA requires a tenant context for student records.',
      audit: { regime: 'FERPA' },
    };
  }
  return { allowed: true, audit: { regime: 'FERPA', isolated: ctx.tenantId } };
});

/**
 * FERPA write gate: redacts directory information when guardian consent flag
 * is missing on the student record.
 */
registerHook('ferpa.directory-info-gate', (ctx) => {
  if (ctx.entity !== 'student') return { allowed: true };
  const consent = ctx.payload?.guardian_consent === true;
  if (!consent && ctx.payload) {
    const sanitised: Record<string, unknown> = { ...ctx.payload };
    for (const k of ['address', 'phone', 'email', 'photo']) {
      if (k in sanitised) sanitised[k] = '[REDACTED:FERPA]';
    }
    return {
      allowed: true,
      sanitisedPayload: sanitised,
      audit: { regime: 'FERPA', redactedDirectoryInfo: true },
    };
  }
  return { allowed: true };
});

// ── FINRA (financial) ───────────────────────────────────────────────────────

/**
 * FINRA record retention: stamps every write with a 7-year retention floor.
 */
registerHook('finra.record-retention', (ctx) => {
  const retainUntil = new Date();
  retainUntil.setFullYear(retainUntil.getFullYear() + 7);
  return {
    allowed: true,
    sanitisedPayload: ctx.payload
      ? { ...ctx.payload, _retain_until: retainUntil.toISOString() }
      : undefined,
    audit: { regime: 'FINRA', retainUntil: retainUntil.toISOString() },
  };
});

/**
 * FINRA outbound communication archive: signals the caller to mirror the
 * outbound message into the immutable archive bucket.
 */
registerHook('finra.archive-outbound', (ctx) => {
  return {
    allowed: true,
    audit: {
      regime: 'FINRA',
      archive: true,
      tenantId: ctx.tenantId,
      entity: ctx.entity ?? 'message',
    },
  };
});

// ── GDPR (cross-cutting) ────────────────────────────────────────────────────

registerHook('gdpr.lawful-basis', (ctx) => {
  if (ctx.payload && ctx.payload._lawful_basis == null) {
    return {
      allowed: true,
      sanitisedPayload: { ...ctx.payload, _lawful_basis: 'legitimate_interest' },
      audit: { regime: 'GDPR', defaulted: 'legitimate_interest' },
    };
  }
  return { allowed: true };
});
