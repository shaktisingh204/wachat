/**
 * SabFlow — KMS abstraction for Key-Encryption Keys (KEKs)
 *
 * Track B · Phase 5 · #3 of 10.
 *
 * The credential store uses envelope encryption: each credential row is
 * sealed with a per-row Data-Encryption Key (DEK) which is itself wrapped
 * by a Key-Encryption Key (KEK). The KEK material is *not* stored in
 * Mongo — it is resolved at runtime through this abstraction.
 *
 * Two implementations ship out of the box:
 *
 * 1. {@link EnvKms} — the default. Reads KEKs from `SABFLOW_KEK_<id>` env
 *    vars provisioned via `vercel env` (or the Vercel dashboard). This
 *    matches the platform-native env workflow and requires no extra
 *    infrastructure.
 *
 * 2. {@link VercelMarketplaceKms} — a stub illustrating the swap point for
 *    a Vercel Marketplace key-management integration (e.g. an AWS KMS or
 *    Google Cloud KMS resource provisioned through the Marketplace, whose
 *    secrets are auto-injected as env vars). Until such an integration is
 *    formally adopted, the stub throws — callers fall back to `EnvKms`.
 *
 * Sibling forward-decl: this module imports `rotateCredential` from
 * `./crypto` (Track B · Phase 5 · #2). The import is intentionally typed
 * loose so this file can land before #2 merges; the wire-up is a one-line
 * change once #2 exports the concrete signature.
 *
 * Runbook: `docs/runbooks/sabflow-credentials-kms-rotation.md`.
 */

import 'server-only';

import { ObjectId, type Collection } from 'mongodb';
import { randomBytes } from 'node:crypto';

import { connectToDatabase } from '@/lib/mongodb';

/* ── Public types ───────────────────────────────────────────────────── */

/**
 * Metadata describing a single registered KEK. The raw key material is
 * never included — only enough to drive listing, rotation, and audit.
 */
export interface KekMetadata {
  /** Stable opaque identifier, e.g. `"2026-05-18"` or `"v3"`. */
  id: string;
  /** Source backend that holds the actual key bytes. */
  source: 'env' | 'marketplace';
  /** When this KEK was first observed by the process (best-effort). */
  observedAt: Date;
  /**
   * Optional deprecation flag — set when an operator rolls a successor in
   * but wants to keep the old KEK around for the 30-day rollback window
   * documented in the runbook (§5).
   */
  deprecated?: boolean;
}

/**
 * The pluggable KMS contract. Implementations resolve KEK material on
 * demand, mint new KEKs, and enumerate the keys they know about.
 *
 * All returned `Buffer`s are exactly 32 bytes (AES-256 key length).
 * Callers MUST NOT log, persist, or transmit the returned key material.
 */
export interface Kms {
  /** Fetch the 32-byte KEK identified by `id`. Throws if unknown. */
  getKek(id: string): Promise<Buffer>;

  /**
   * Mint a fresh KEK. The implementation chooses the id (typically an
   * ISO date or monotonic counter) and is responsible for making the new
   * key material discoverable by a subsequent `getKek` call — which, for
   * env-backed KEKs, means an operator must run `vercel env add` with the
   * returned base64 value. See runbook §2.
   */
  generateKek(): Promise<{ id: string; key: Buffer }>;

  /** Enumerate every KEK the implementation can resolve. */
  listKeks(): Promise<KekMetadata[]>;
}

/* ── Env-based default ──────────────────────────────────────────────── */

const KEK_ENV_PREFIX = 'SABFLOW_KEK_';
const KEK_LENGTH = 32;

/**
 * Decode a base64 env-var value into a 32-byte key. Throws on the wrong
 * length so a typo'd env var can't silently produce weak crypto.
 */
function decodeKekBase64(raw: string, id: string): Buffer {
  const buf = Buffer.from(raw, 'base64');
  if (buf.length !== KEK_LENGTH) {
    throw new Error(
      `[sabflow/kms] SABFLOW_KEK_${id} decoded to ${buf.length} bytes; expected ${KEK_LENGTH}`,
    );
  }
  return buf;
}

/**
 * Read KEKs from `SABFLOW_KEK_<id>` env vars. Each value is the
 * base64-encoded 32 random bytes generated via `generateKek` (or the
 * `openssl rand -base64 32` recipe in the runbook).
 *
 * This is the production-default backend on Vercel: KEKs are managed
 * through `vercel env` and rotated by adding a new env var, never by
 * editing committed code.
 */
export class EnvKms implements Kms {
  /** Cache decoded buffers so we don't re-base64-decode on every call. */
  private readonly cache = new Map<string, Buffer>();

  async getKek(id: string): Promise<Buffer> {
    if (!id) throw new Error('[sabflow/kms] getKek: id is required');
    const cached = this.cache.get(id);
    if (cached) return cached;

    const raw = process.env[`${KEK_ENV_PREFIX}${id}`];
    if (!raw) {
      throw new Error(
        `[sabflow/kms] SABFLOW_KEK_${id} is not set; provision it via \`vercel env add\``,
      );
    }
    const key = decodeKekBase64(raw, id);
    this.cache.set(id, key);
    return key;
  }

  /**
   * Mint a fresh 32-byte KEK with a date-stamped id. The caller still
   * has to persist the returned `key` into Vercel env vars — this method
   * does not (and cannot) write to the platform on its own. The runbook
   * shows the exact `vercel env add` invocation.
   */
  async generateKek(): Promise<{ id: string; key: Buffer }> {
    const id = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const key = randomBytes(KEK_LENGTH);
    return { id, key };
  }

  async listKeks(): Promise<KekMetadata[]> {
    const out: KekMetadata[] = [];
    const now = new Date();
    for (const name of Object.keys(process.env)) {
      if (!name.startsWith(KEK_ENV_PREFIX)) continue;
      const id = name.slice(KEK_ENV_PREFIX.length);
      out.push({ id, source: 'env', observedAt: now });
    }
    return out.sort((a, b) => a.id.localeCompare(b.id));
  }
}

/* ── Vercel Marketplace stub ────────────────────────────────────────── */

/**
 * Placeholder for a Vercel Marketplace-provisioned KMS integration.
 *
 * When a future Marketplace listing supplies a managed KMS (AWS KMS,
 * Google Cloud KMS, or equivalent) its bindings will land here as the
 * concrete implementation — secrets auto-provisioned by the Marketplace
 * install, no hand-rolled provider setup required (see CLAUDE.md
 * "Deployment platform — Vercel"). The swap point is the three method
 * bodies below.
 *
 * Until that integration is adopted, this class throws on use and
 * production deployments stay on {@link EnvKms}.
 */
export class VercelMarketplaceKms implements Kms {
  private throwNotConfigured(): never {
    throw new Error(
      '[sabflow/kms] VercelMarketplaceKms is a stub. ' +
        'Install a Vercel Marketplace KMS integration and implement this class, ' +
        'or set SABFLOW_KMS_BACKEND=env to use EnvKms.',
    );
  }

  async getKek(_id: string): Promise<Buffer> {
    this.throwNotConfigured();
  }
  async generateKek(): Promise<{ id: string; key: Buffer }> {
    this.throwNotConfigured();
  }
  async listKeks(): Promise<KekMetadata[]> {
    this.throwNotConfigured();
  }
}

/* ── Default instance + factory ─────────────────────────────────────── */

/**
 * Resolve the KMS backend for the current process. Reads
 * `SABFLOW_KMS_BACKEND`; defaults to `"env"`. Set to `"marketplace"` only
 * after wiring a real Marketplace integration into
 * {@link VercelMarketplaceKms}.
 */
export function getKms(): Kms {
  const backend = process.env.SABFLOW_KMS_BACKEND ?? 'env';
  if (backend === 'marketplace') return new VercelMarketplaceKms();
  return new EnvKms();
}

/** Shared instance — reuse to keep the env-decoded cache warm. */
export const kms: Kms = getKms();

/* ── Rotation ───────────────────────────────────────────────────────── */

/**
 * Forward-decl for `rotateCredential` (Track B · Phase 5 · #2). Once #2
 * lands, replace this `Promise<void>`-returning shim with the real
 * import. Kept loose so this file can be merged independently.
 *
 * Contract (per #2 spec): given a credential id and a `{ from, to }` KEK
 * pair, unwrap each value's DEK with `from`, re-wrap with `to`, and
 * atomically swap the row's wrapped-DEK bytes plus its `kek` field.
 * Errors propagate unchanged.
 */
type RotateCredentialFn = (
  credentialId: string,
  args: { from: string; to: string },
) => Promise<void>;

let rotateCredentialImpl: RotateCredentialFn | null = null;

/**
 * Allow #2 to register its real implementation at module-load time,
 * keeping this file's surface stable while #2 is still in flight. Tests
 * also use this to inject a fake.
 */
export function __setRotateCredentialImpl(fn: RotateCredentialFn): void {
  rotateCredentialImpl = fn;
}

/** Lazy loader so we can import once #2 publishes the symbol. */
async function loadRotateCredential(): Promise<RotateCredentialFn> {
  if (rotateCredentialImpl) return rotateCredentialImpl;
  try {
    // Sibling file from Phase 5 #2.
    const mod = (await import('./crypto')) as {
      rotateCredential?: any;
    };
    if (typeof mod.rotateCredential === 'function') {
      rotateCredentialImpl = async (credentialId: string, { from, to }: { from: string; to: string }) => {
        const col = await getCredentialsCollection();
        const objId = new ObjectId(credentialId);
        const row = await col.findOne({ _id: objId });
        if (!row) {
          throw new Error(`Credential ${credentialId} not found`);
        }
        const fullRow = row as any;
        if (!fullRow.dataEncrypted) {
          throw new Error(`Credential ${credentialId} is missing dataEncrypted buffer`);
        }

        const buf = fullRow.dataEncrypted;
        const IV_LENGTH = 12;
        const TAG_LENGTH = 16;
        const WRAPPED_DEK_LENGTH = 60;

        if (buf.length < IV_LENGTH + TAG_LENGTH + WRAPPED_DEK_LENGTH) {
          throw new Error(`Credential ${credentialId} has malformed dataEncrypted buffer (length ${buf.length})`);
        }

        const iv = buf.subarray(0, IV_LENGTH);
        const ciphertext = buf.subarray(IV_LENGTH, buf.length - TAG_LENGTH - WRAPPED_DEK_LENGTH);
        const tag = buf.subarray(buf.length - TAG_LENGTH - WRAPPED_DEK_LENGTH, buf.length - WRAPPED_DEK_LENGTH);
        const dek = buf.subarray(buf.length - WRAPPED_DEK_LENGTH);

        const envelope = { iv, ciphertext, tag, dek, kekId: from };

        // Call crypto-level rotateCredential
        const rotatedEnv = mod.rotateCredential(envelope, from, to);

        // Pack it back
        const newBuf = Buffer.concat([rotatedEnv.iv, rotatedEnv.ciphertext, rotatedEnv.tag, rotatedEnv.dek]);

        // Save back
        await col.updateOne(
          { _id: objId },
          {
            $set: {
              dataEncrypted: newBuf,
              kek: to,
              updatedAt: new Date(),
            },
          }
        );
      };
      return rotateCredentialImpl;
    }
  } catch (err) {
    // Fall through
  }
  throw new Error(
    '[sabflow/kms] rotateCredential is not available yet — Phase 5 #2 has not landed. ' +
      'Call __setRotateCredentialImpl(...) from a test, or wait for the crypto module.',
  );
}

/** Minimal projection of a credential row needed for rotation. */
interface CredentialKekRow {
  _id: ObjectId;
  kek?: string;
}

async function getCredentialsCollection(): Promise<Collection<CredentialKekRow>> {
  const { db } = await connectToDatabase();
  return db.collection<CredentialKekRow>('sabflow_credentials');
}

export interface RotateAllArgs {
  /** KEK id currently used by the rows that will be rotated. */
  from: string;
  /** KEK id the rows should be re-wrapped under. */
  to: string;
  /**
   * When true, iterate the matching rows and report the count but do not
   * mutate anything. Used by the runbook §3 dry-run procedure.
   */
  dryRun?: boolean;
}

export interface RotateAllResult {
  /** Count of credentials successfully re-wrapped (or counted in dry-run). */
  rotated: number;
  /** Per-credential failure entries; empty on a clean run. */
  failed: Array<{ credentialId: string; error: string }>;
}

/**
 * Re-wrap every credential currently sealed under `from` with `to`.
 *
 * Iterates `sabflow_credentials` in batches, calling `rotateCredential`
 * per row (which performs the actual DEK unwrap/re-wrap inside the
 * crypto module — see #2). On success the row's `kek` field is set to
 * `to` by `rotateCredential` itself; this function only orchestrates.
 *
 * Failures are collected and returned rather than aborting the run, so a
 * single bad row does not strand the rest of the fleet. Operators
 * triage the `failed` list against the runbook §6 incident playbook.
 */
export async function rotateAll(args: RotateAllArgs): Promise<RotateAllResult> {
  const { from, to, dryRun = false } = args;
  if (!from) throw new Error('[sabflow/kms] rotateAll: `from` is required');
  if (!to) throw new Error('[sabflow/kms] rotateAll: `to` is required');
  if (from === to) {
    throw new Error('[sabflow/kms] rotateAll: `from` and `to` must differ');
  }

  // Resolve both KEKs up-front so a typo in either fails fast, before we
  // touch a single row.
  await kms.getKek(from);
  await kms.getKek(to);

  const col = await getCredentialsCollection();
  const cursor = col.find({ kek: from }, { projection: { _id: 1, kek: 1 } });

  const failed: Array<{ credentialId: string; error: string }> = [];
  let rotated = 0;

  if (dryRun) {
    rotated = await col.countDocuments({ kek: from });
    return { rotated, failed };
  }

  const doRotate = await loadRotateCredential();
  for await (const row of cursor) {
    const credentialId = row._id.toHexString();
    try {
      await doRotate(credentialId, { from, to });
      rotated += 1;
    } catch (err) {
      failed.push({
        credentialId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return { rotated, failed };
}
