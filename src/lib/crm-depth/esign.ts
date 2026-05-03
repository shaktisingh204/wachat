/**
 * E-signature primitives. Provides a minimal session record covering session
 * lifecycle, per-signer status, audit trail and a "seal" step.
 *
 * Real PDF mutation (drawing signatures, generating sealed bundles) is
 * intentionally deferred — we record the data necessary to drive an external
 * sealer (e.g. PDFTron or a server-side renderer) and store a deterministic
 * `sealHash` summarising the completed session.
 */
import type {
  EsignAuditEntry,
  EsignSession,
  EsignSigner,
  EsignSignerStatus,
} from './types';

function randomId(prefix: string): string {
  const rnd = Math.random().toString(36).slice(2, 10);
  const ts = Date.now().toString(36);
  return `${prefix}_${ts}${rnd}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

function appendAudit(
  session: EsignSession,
  actor: string,
  event: string,
  detail?: string,
): EsignSession {
  const entry: EsignAuditEntry = { at: nowIso(), actor, event, detail };
  return { ...session, audit: [...session.audit, entry] };
}

export interface CreateEsignOptions {
  flow?: 'parallel' | 'sequential';
  expiresAt?: string;
  documentHash?: string;
}

export interface CreateSignerInput {
  name: string;
  email: string;
  role?: string;
  order?: number;
}

/**
 * Create a new e-sign session. Each signer gets an `id` and is initialised
 * with status `pending`.
 */
export function createEsignSession(
  documentUrl: string,
  signers: CreateSignerInput[],
  options: CreateEsignOptions = {},
): EsignSession {
  if (!documentUrl) throw new Error('documentUrl is required');
  if (!signers || signers.length === 0) throw new Error('at least one signer required');

  const flow = options.flow ?? 'sequential';
  const orderedSigners: EsignSigner[] = signers.map((s, i) => ({
    id: randomId('signer'),
    name: s.name,
    email: s.email,
    role: s.role,
    order: typeof s.order === 'number' ? s.order : i,
    status: 'pending',
  }));
  // Stable ordering by `order` then index.
  orderedSigners.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  const session: EsignSession = {
    id: randomId('esign'),
    documentUrl,
    documentHash: options.documentHash,
    signers: orderedSigners,
    status: 'created',
    flow,
    audit: [],
    createdAt: nowIso(),
    expiresAt: options.expiresAt,
  };
  return appendAudit(session, 'system', 'session.created', `signers=${orderedSigners.length}`);
}

/**
 * Mark a signer as having viewed the document. Idempotent.
 */
export function markSignerViewed(
  session: EsignSession,
  signerId: string,
): EsignSession {
  const signers = session.signers.map(s =>
    s.id === signerId && s.status === 'pending'
      ? { ...s, status: 'viewed' as EsignSignerStatus }
      : s,
  );
  const next = { ...session, signers, status: session.status === 'created' ? 'in-progress' : session.status };
  return appendAudit(next, signerId, 'signer.viewed');
}

export interface KeystrokeSignatureInput {
  /** Typed name / drawn-as-text signature value. */
  signature: string;
  ip?: string;
  userAgent?: string;
}

/**
 * Apply a keystroke (typed-name) signature for a signer. For sequential
 * flows the signer must be next-in-line.
 */
export function signWithKeystroke(
  session: EsignSession,
  signerId: string,
  payload: KeystrokeSignatureInput,
): EsignSession {
  if (session.status === 'completed' || session.status === 'cancelled' || session.status === 'expired') {
    throw new Error(`session is ${session.status}`);
  }
  if (!payload.signature || !payload.signature.trim()) {
    throw new Error('signature is required');
  }
  const signer = session.signers.find(s => s.id === signerId);
  if (!signer) throw new Error('signer not found');
  if (signer.status === 'signed') {
    return session;
  }

  if (session.flow === 'sequential') {
    const nextPending = session.signers.find(s => s.status !== 'signed' && s.status !== 'declined');
    if (nextPending && nextPending.id !== signerId) {
      throw new Error('out-of-order signature attempt');
    }
  }

  const signers = session.signers.map(s =>
    s.id === signerId
      ? {
          ...s,
          status: 'signed' as EsignSignerStatus,
          signature: payload.signature.trim(),
          ip: payload.ip,
          userAgent: payload.userAgent,
          signedAt: nowIso(),
        }
      : s,
  );

  const allSigned = signers.every(s => s.status === 'signed');
  const next: EsignSession = {
    ...session,
    signers,
    status: allSigned ? 'completed' : 'in-progress',
  };
  return appendAudit(
    next,
    signerId,
    'signer.signed',
    `len=${payload.signature.length}`,
  );
}

/**
 * Decline by signer — terminates the session.
 */
export function declineSession(
  session: EsignSession,
  signerId: string,
  reason?: string,
): EsignSession {
  const signers = session.signers.map(s =>
    s.id === signerId ? { ...s, status: 'declined' as EsignSignerStatus } : s,
  );
  const next: EsignSession = { ...session, signers, status: 'cancelled' };
  return appendAudit(next, signerId, 'signer.declined', reason);
}

/**
 * Compute a deterministic seal hash for a completed session. Uses a simple
 * stringified concatenation hashed with the FNV-1a 32-bit algorithm — good
 * enough for an integrity placeholder, NOT for cryptographic guarantees.
 */
function fnv1a(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = (hash * 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

/**
 * Seal a completed session. Real PDF mutation is deferred — this records a
 * seal hash + sealedAt timestamp. Throws if not all signers have signed.
 */
export function sealDocument(session: EsignSession): EsignSession {
  if (session.status !== 'completed') {
    throw new Error('session must be completed before sealing');
  }
  if (!session.signers.every(s => s.status === 'signed')) {
    throw new Error('all signers must have signed');
  }
  const payload = JSON.stringify({
    id: session.id,
    documentUrl: session.documentUrl,
    documentHash: session.documentHash,
    signers: session.signers.map(s => ({
      id: s.id,
      email: s.email,
      signedAt: s.signedAt,
    })),
  });
  const sealHash = fnv1a(payload);
  const sealedAt = nowIso();
  const sealed: EsignSession = { ...session, sealedAt, sealHash };
  return appendAudit(sealed, 'system', 'session.sealed', `hash=${sealHash}`);
}
