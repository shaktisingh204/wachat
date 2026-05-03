/**
 * Barrel export for the SabNode Compliance, Security & Audit module.
 *
 * Public surface:
 *   - Types — `types.ts`
 *   - Audit log (hash-chained, capped Mongo collection)
 *   - Retention sweeper
 *   - GDPR DSR (export + erase)
 *   - DLP scanner (regex + entropy + Luhn)
 *   - Legal-hold management
 *   - BYOK envelope encryption (offline + AWS KMS)
 *   - SIEM webhook fan-out
 */

export * from './types';

export {
    audit,
    queryAuditLog,
    canonicalize,
    hashEvent,
    verifyChain,
    __internals as auditInternals,
} from './audit-log';
export type { AuditInput } from './audit-log';

export {
    applyRetention,
    __internals as retentionInternals,
} from './retention';
export type { RetentionSweepReport } from './retention';

export {
    exportData,
    eraseData,
    buildZip,
    __internals as dsrInternals,
} from './dsr';
export type { SubjectIndexEntry } from './dsr';

export {
    scan,
    redact,
    luhn,
    shannonEntropy,
    looksLikeJwt,
    DEFAULT_RULES,
} from './dlp';

export {
    applyHold,
    releaseHold,
    isHeld,
    __internals as legalHoldInternals,
} from './legal-hold';
export type { ApplyHoldInput } from './legal-hold';

export {
    wrapKey,
    unwrapKey,
    generateDataKey,
    __internals as byokInternals,
} from './byok';

export { pushToSiem, __internals as siemInternals } from './siem';
