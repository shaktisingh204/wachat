/**
 * SabFlow executor — credential-specific audit log.
 *
 * Thin wrapper around `src/lib/sabflow/audit/middleware.ts` (which in
 * turn calls `src/lib/sabflow/audit/db.ts`) — exposes a tightly typed
 * `recordCredentialAudit` entry point used by the credential-store
 * read/write path and by the runtime when nodes pull secrets.
 *
 * Conceptually this file is the executor-layer analogue of
 * `src/lib/sabflow/persistence/audit.ts` (which handles doc-level
 * audits): it never reshapes the underlying schema, it just funnels
 * credential lifecycle events into the existing `sabflow_audit_log`
 * Mongo collection under the `cred.*` namespace.
 *
 * Design contract
 * ───────────────
 *   • **Audit must never break the user action.** Every write is
 *     wrapped in try/catch + log + swallow.
 *   • **Never log credential plaintext.** The `meta` whitelist below
 *     enforces this at the type + runtime level — anything outside the
 *     whitelist is silently stripped before hitting Mongo.
 *   • **Hash the credentialId.** Raw ids may be deleted from the
 *     credential store later (GDPR / DSR), but audit rows must remain
 *     useful — so we store a stable salted SHA-256 of the id in both
 *     `target` and `metadata.credentialHash` instead of the raw value.
 *   • **Per-day rate cap.** A single execution can legitimately read
 *     the same OAuth token thousands of times in a loop; we cap at
 *     10k rows/exec/day and only emit every 100th read past the cap
 *     (with a `dropped: N` summary on the surviving rows).
 */

import { createHash } from 'crypto';
import { recordFlowAction } from '@/lib/sabflow/audit/middleware';

/* ──────────────────────────────────────────────────────────────────────────
   Types
   ────────────────────────────────────────────────────────────────────────── */

/**
 * Discrete audit actions emitted by the credential subsystem.
 *
 * Kept as a standalone union (rather than extending `AuditAction` in
 * `../../audit/db.ts`) so the existing schema isn't reshaped — the
 * underlying writer already accepts `AuditAction | string`.  The
 * pre-existing `credential.*` actions in `AuditAction` track *lifecycle*
 * changes (created / updated / deleted); these `cred.*` actions track
 * *access* events (read / write / share / test / refresh).
 */
export type CredentialAuditAction =
  | 'cred.read'
  | 'cred.write'
  | 'cred.delete'
  | 'cred.share'
  | 'cred.unshare'
  | 'cred.test'
  | 'cred.refresh';

/**
 * Whitelisted meta fields.
 *
 * NOTHING outside this surface may be persisted — the runtime sanitiser
 * below silently drops any other key.  Critically, neither plaintext
 * secrets, OAuth tokens, refresh tokens, nor decrypted values appear
 * here; only descriptive metadata.
 */
export interface CredentialAuditMeta {
  /** Credential type identifier (e.g. `'oauth2.google'`, `'apiKey.openai'`). */
  credentialType?: string;
  /** OAuth / API scope string or array — purely descriptive, no token. */
  scope?: string | string[];
  /** Where the call originated: UI page, REST API, or in-flight runtime read. */
  source?: 'ui' | 'api' | 'runtime';
  /** Node type performing a runtime read (e.g. `'http.request'`, `'gmail.send'`). */
  nodeType?: string;
  /**
   * Number of dropped reads represented by this row, set automatically
   * by the rate-cap when the per-execution daily quota is exceeded.
   */
  dropped?: number;
}

const ALLOWED_META_KEYS: ReadonlySet<keyof CredentialAuditMeta> = new Set([
  'credentialType',
  'scope',
  'source',
  'nodeType',
  'dropped',
]);

export interface RecordCredentialAuditInput {
  /** Workspace the credential belongs to.  Doubles as `userId` for the
   *  writer when no explicit actor is available (single-tenant fallback). */
  workspaceId: string;
  /** Raw credential id — hashed before persistence. */
  credentialId: string;
  /** The actor performing the action.  Falls back to `workspaceId`. */
  userId?: string;
  /** Execution id, when the read happens mid-run.  Used as the rate-cap key. */
  executionId?: string;
  /** One of the discrete credential-access actions. */
  action: CredentialAuditAction;
  /** Optional structured payload — see `CredentialAuditMeta` for the
   *  whitelist.  Anything else is silently dropped. */
  meta?: CredentialAuditMeta & Record<string, unknown>;
}

/* ──────────────────────────────────────────────────────────────────────────
   Internal helpers — hashing
   ────────────────────────────────────────────────────────────────────────── */

/**
 * Salt for credentialId hashing.
 *
 * A static, build-time salt is enough here — we only need the hash to
 * be stable + non-reversible-by-rainbow-table; we explicitly do NOT
 * want it rotatable, because old audit rows must remain joinable to
 * new ones for the same credential.  Sourced from env so each
 * deployment gets its own salt; falls back to a fixed string in dev so
 * the hash is reproducible across restarts.
 */
const CRED_HASH_SALT =
  process.env.SABFLOW_CRED_AUDIT_SALT ?? 'sabflow.cred-audit.salt.v1';

function hashCredentialId(credentialId: string): string {
  return createHash('sha256')
    .update(CRED_HASH_SALT)
    .update('\x00') // delimiter so salt|id != salt+id
    .update(credentialId)
    .digest('hex');
}

/* ──────────────────────────────────────────────────────────────────────────
   Internal helpers — meta sanitisation
   ────────────────────────────────────────────────────────────────────────── */

/**
 * Strip anything outside the `CredentialAuditMeta` whitelist.
 *
 * This is the last line of defence against an accidental
 * `meta: { token: '...' }` slipping through from a careless caller.
 */
function sanitiseMeta(
  raw: (CredentialAuditMeta & Record<string, unknown>) | undefined,
): CredentialAuditMeta | undefined {
  if (!raw) return undefined;
  const out: CredentialAuditMeta = {};
  for (const key of Object.keys(raw) as Array<keyof typeof raw>) {
    if (ALLOWED_META_KEYS.has(key as keyof CredentialAuditMeta)) {
      // Safe cast — key membership in the whitelist is checked above.
      (out as Record<string, unknown>)[key] = raw[key];
    }
  }
  return Object.keys(out).length ? out : undefined;
}

/* ──────────────────────────────────────────────────────────────────────────
   Internal helpers — per-execution daily rate cap
   ────────────────────────────────────────────────────────────────────────── */

/** Hard cap on `cred.read` rows persisted per execution per UTC day. */
const READ_DAILY_CAP = 10_000;
/** Past the cap, only every Nth read is persisted (with a `dropped: N` summary). */
const POST_CAP_SAMPLE_EVERY = 100;

interface ReadCounter {
  /** UTC day-bucket this counter applies to (YYYY-MM-DD). */
  day: string;
  /** Total reads observed in this bucket. */
  count: number;
  /** Reads dropped since the last persisted sample, reset on each emit. */
  droppedSinceLastEmit: number;
}

/**
 * In-process rate-cap table.  Lives for the duration of the Node
 * runtime — which on Vercel Functions is the per-invocation lifetime
 * for cold starts, and the warm-instance lifetime when reused.  That's
 * intentionally fine: the cap is a noise-reduction guardrail, not a
 * security boundary.  A new warm instance simply gets a fresh budget,
 * which is the correct behaviour (each instance pays its own audit
 * cost separately).
 */
const readCounters = new Map<string, ReadCounter>();

function currentUtcDay(): string {
  // YYYY-MM-DD, UTC — cheap and timezone-agnostic.
  return new Date().toISOString().slice(0, 10);
}

/**
 * Decide whether a `cred.read` should be persisted, and how much
 * dropped-read overflow to attribute to it.
 *
 * Returns `null` if the event should be silently dropped, or a
 * `{ dropped }` patch (possibly `dropped: 0`) to merge into the meta
 * payload when the event survives the cap.
 */
function consumeReadBudget(
  executionId: string | undefined,
): { dropped: number } | null {
  // Without an execution id we can't safely group reads — let them all
  // through.  This matches the spec: the cap is keyed on "from one
  // execution".  UI/API reads (no executionId) are vanishingly rare
  // compared to runtime reads, so the noise is negligible.
  if (!executionId) return { dropped: 0 };

  const day = currentUtcDay();
  const key = `${executionId}|${day}`;
  let counter = readCounters.get(key);

  // Garbage-collect entries from previous days when we cross a boundary.
  if (counter && counter.day !== day) {
    readCounters.delete(key);
    counter = undefined;
  }
  if (!counter) {
    counter = { day, count: 0, droppedSinceLastEmit: 0 };
    readCounters.set(key, counter);
  }

  counter.count += 1;

  // Under the cap → always persist, no dropped attribution.
  if (counter.count <= READ_DAILY_CAP) {
    return { dropped: 0 };
  }

  // Over the cap → sample every Nth event; everything else is dropped.
  // The very first over-cap event (count === CAP + 1) is the sentinel
  // emit that flags the cap was crossed.
  const overCapIndex = counter.count - READ_DAILY_CAP; // 1-based
  if (overCapIndex === 1 || overCapIndex % POST_CAP_SAMPLE_EVERY === 0) {
    const dropped = counter.droppedSinceLastEmit;
    counter.droppedSinceLastEmit = 0;
    return { dropped };
  }

  counter.droppedSinceLastEmit += 1;
  return null;
}

/* ──────────────────────────────────────────────────────────────────────────
   Public API
   ────────────────────────────────────────────────────────────────────────── */

/**
 * Record a single credential-level audit entry.
 *
 * Resolves with `undefined` in every case — including failure — because
 * the underlying `recordFlowAction` catches + logs internally and this
 * wrapper additionally guards against unexpected throws.  Callers may
 * `await` for ordering guarantees or fire-and-forget; either way an
 * audit-write failure will never break the user-facing operation.
 *
 * The `credentialId` is hashed before persistence (see
 * `hashCredentialId`) so the audit trail survives a later credential
 * deletion / GDPR purge without leaking the original id.
 */
export async function recordCredentialAudit(
  input: RecordCredentialAuditInput,
): Promise<void> {
  // Defensive guard — log + swallow, never throw.
  if (
    !input ||
    !input.workspaceId ||
    !input.credentialId ||
    !input.action
  ) {
    // eslint-disable-next-line no-console
    console.warn(
      '[sabflow-cred-audit] recordCredentialAudit skipped: missing workspaceId/credentialId/action',
      {
        hasWorkspaceId: !!input?.workspaceId,
        hasCredentialId: !!input?.credentialId,
        action: input?.action,
      },
    );
    return;
  }

  // Rate-cap only applies to `cred.read` — the noisy path.  Write /
  // delete / share / test / refresh are always persisted in full.
  let droppedPatch: { dropped: number } | null = { dropped: 0 };
  if (input.action === 'cred.read') {
    droppedPatch = consumeReadBudget(input.executionId);
    if (droppedPatch === null) {
      // Quietly dropped — the next surviving sample will roll up the
      // count into its `meta.dropped`.
      return;
    }
  }

  const sanitisedMeta = sanitiseMeta(input.meta);
  const credentialHash = hashCredentialId(input.credentialId);

  // Compose the final metadata payload.  `credentialHash` is always
  // present so downstream readers can group rows for the same logical
  // credential without needing the raw id.  `executionId` rides along
  // when supplied so per-run timelines can be reconstructed.  The
  // `dropped` counter is set only when the rate-cap actually elided
  // any reads (avoids polluting normal rows with `dropped: 0`).
  const metadata: Record<string, unknown> = {
    ...(sanitisedMeta ?? {}),
    credentialHash,
  };
  if (input.executionId) {
    metadata.executionId = input.executionId;
  }
  if (droppedPatch.dropped > 0) {
    metadata.dropped = droppedPatch.dropped;
  }

  const actor = input.userId ?? input.workspaceId;

  try {
    await recordFlowAction(input.action, {
      userId: actor,
      workspaceId: input.workspaceId,
      // `target` is the canonical affected-resource field; we store the
      // HASH there, never the raw id, so a later credential deletion
      // can't be undone by reading the audit log.
      target: credentialHash,
      metadata,
    });
  } catch (err) {
    // `recordFlowAction` is already try/catch-internal, but belt-and-
    // braces: audit must never propagate.
    // eslint-disable-next-line no-console
    console.error(
      '[sabflow-cred-audit] recordCredentialAudit unexpected throw:',
      err,
    );
  }
}

/* ──────────────────────────────────────────────────────────────────────────
   Test-only helpers (not part of the public API surface)
   ────────────────────────────────────────────────────────────────────────── */

/**
 * Reset the in-process rate-cap table.  Exported solely so unit tests
 * can exercise the cap deterministically across cases; production code
 * must never call this (it would silently re-open the budget mid-run).
 *
 * @internal
 */
export function __resetCredentialAuditRateCapForTests(): void {
  readCounters.clear();
}
