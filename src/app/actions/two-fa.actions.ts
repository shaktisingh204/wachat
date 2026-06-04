'use server';

/**
 * Two-factor authentication — Email and TOTP (Google Authenticator).
 *
 * The user document carries:
 *   twoFactorEnabled: boolean
 *   twoFactorMethod: 'email' | 'totp'
 *   twoFactorSecret: string                  // encrypted base32 TOTP secret
 *   twoFactorEmailCode: string               // hashed pending email code
 *   twoFactorEmailCodeExpiresAt: Date
 *   twoFactorBackupCodes: string[]           // bcrypt-hashed
 *
 * The login flow runs in `verifyTwoFactorChallenge` (see
 * `src/app/api/auth/two-fa/route.ts` — added in this changeset).
 */

import bcrypt from 'bcryptjs';
import { ObjectId } from 'mongodb';
import { revalidatePath } from 'next/cache';
import { randomInt, createHash } from 'node:crypto';

import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';
import { comparePassword } from '@/lib/auth';
import {
  generateBackupCodes,
  generateQrUrl,
  generateSecret,
  verifyTotpCode,
} from '@/lib/totp';
import {
  encryptData,
  decryptData,
} from '@/lib/sabflow/credentials/encryption';
import { dispatchTransactionalEmail } from '@/lib/email-dispatcher';
// C4 flags + C2 PG MFA store for the staged Mongo→Postgres auth migration.
// Defaults (off/mongo) keep every path below byte-identical to today.
import {
  shouldWritePg,
  shouldReadPg,
  pgReadAllowsFallback,
  authPgRead,
} from '@/lib/identity/auth-flags';
import { pgMfaStore } from '@/lib/identity/pg-stores';
import type { PgMfaMethodRow } from '@/lib/postgres-schema';

const PROFILE_PATH = '/dashboard/profile/2fa-setup';
const EMAIL_CODE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const BACKUP_CODE_ROUNDS = 10;

type TwoFactorMethod = 'email' | 'totp';

interface TwoFactorStatus {
  enabled: boolean;
  method: TwoFactorMethod | null;
  hasBackupCodes: boolean;
  /** Number of currently-active backup codes (not the codes themselves). */
  backupCodesRemaining: number;
  email: string | null;
}

interface ActionResult<T = unknown> {
  ok: boolean;
  error?: string;
  data?: T;
}

/* ────────────────────── Helpers ────────────────────── */

async function requireUserOid(): Promise<{ oid: ObjectId; email: string; passwordHash?: string } | null> {
  const session = await getSession();
  const id = session?.user?._id;
  if (!id || !ObjectId.isValid(String(id))) return null;
  const oid = new ObjectId(String(id));
  const { db } = await connectToDatabase();
  const u = await db
    .collection('users')
    .findOne(
      { _id: oid },
      { projection: { email: 1, password: 1 } as any },
    );
  if (!u) return null;
  return {
    oid,
    email: String((u as any).email ?? session?.user?.email ?? ''),
    passwordHash: (u as any).password as string | undefined,
  };
}

function hashEmailCode(code: string): string {
  return createHash('sha256').update(code).digest('hex');
}

function genEmailCode(): string {
  // 6-digit zero-padded.
  return randomInt(0, 1_000_000).toString().padStart(6, '0');
}

async function deliverEmailCode(
  tenantUserId: string,
  email: string,
  code: string,
): Promise<void> {
  try {
    const result = await dispatchTransactionalEmail({
      tenantUserId,
      to: email,
      subject: 'Your SabNode verification code',
      html: `<p>Your verification code is <strong style="font-size:18px;letter-spacing:2px;">${code}</strong>.</p><p>It expires in 10 minutes.</p>`,
      body: `Your SabNode verification code is ${code}. It expires in 10 minutes.`,
      templateId: 'two-factor-code',
    });
    if (!result.ok) {
      console.error('[2fa] email dispatcher returned error:', result.error);
    }
  } catch (err) {
    // We deliberately do NOT throw — the action layer reports a generic
    // "failed to send" error to the UI; the code remains stored so the
    // user can re-trigger send.
    console.error('[2fa] failed to deliver email code:', err);
  }
}

/* ────────────────── Postgres MFA dual-write/read (Lane W) ────────────────── */

// The active 2FA configuration is mirrored into the C2 mfa_methods table as a
// single deterministic row per user, so the staged migration can read the
// secret/backup-codes from Postgres. Keyed on a stable id derived from the
// Mongo _id string (the same id carried in the JWT) so upserts are idempotent.
function activeMfaMethodId(userId: string): string {
  return `${userId}:active`;
}

/**
 * Best-effort dual-write of the user's *enabled* 2FA method to Postgres.
 * Never throws — a PG failure must never break the Mongo-backed 2FA flow.
 * `secret` is the already-encrypted TOTP secret (or null for email 2FA);
 * `backupCodes` are the bcrypt hashes; `data` carries the non-secret payload.
 */
async function pgWriteActiveMfa(input: {
  userId: string;
  method: TwoFactorMethod;
  encryptedSecret?: string | null;
  backupCodes?: string[];
  email?: string | null;
}): Promise<void> {
  if (!shouldWritePg()) return;
  try {
    await pgMfaStore.insert({
      id: activeMfaMethodId(input.userId),
      userId: input.userId,
      kind: input.method,
      secret: input.encryptedSecret ?? null,
      data: {
        enabled: true,
        method: input.method,
        backupCodes: input.backupCodes ?? [],
        email: input.email ?? null,
      },
    });
  } catch (pgErr) {
    console.error('[2fa] Postgres MFA upsert failed (non-fatal):', pgErr);
  }
}

/**
 * Best-effort removal of the user's active 2FA method row from Postgres,
 * mirroring a Mongo disable. Never throws.
 */
async function pgRemoveActiveMfa(userId: string): Promise<void> {
  if (!shouldWritePg()) return;
  try {
    await pgMfaStore.remove(activeMfaMethodId(userId));
  } catch (pgErr) {
    console.error('[2fa] Postgres MFA remove failed (non-fatal):', pgErr);
  }
}

/**
 * Best-effort update of only the backup codes in the PG MFA row (for
 * regeneration / one-use consumption). Reads the existing row to preserve the
 * secret + kind, then re-inserts (idempotent upsert). Never throws.
 */
async function pgUpdateActiveMfaBackupCodes(
  userId: string,
  backupCodes: string[],
): Promise<void> {
  if (!shouldWritePg()) return;
  try {
    const existing = await pgMfaStore.get(activeMfaMethodId(userId));
    if (!existing) return; // nothing mirrored yet — initial enable will write it
    const data = ((existing.data as any) ?? {}) as Record<string, unknown>;
    await pgMfaStore.insert({
      id: existing.id,
      userId,
      kind: existing.kind,
      secret: existing.secret,
      data: { ...data, backupCodes },
    });
  } catch (pgErr) {
    console.error('[2fa] Postgres MFA backup-code update failed (non-fatal):', pgErr);
  }
}

/**
 * Read the active 2FA method from Postgres when the read path is opted in.
 * Returns `undefined` to mean "use the Mongo fallback" (read mode off, or a
 * recoverable miss/error under pg-fallback). In strict `pg` mode a miss/error
 * resolves to `null` (authoritative "no method"), never silently falling back.
 */
async function pgReadActiveMfa(
  userId: string,
): Promise<PgMfaMethodRow | null | undefined> {
  if (!shouldReadPg()) return undefined; // mongo-only mode → caller uses Mongo
  try {
    const row = await pgMfaStore.get(activeMfaMethodId(userId));
    if (row) return row;
    // Miss: in pg-fallback we let Mongo answer; in strict pg this IS the answer.
    return pgReadAllowsFallback() ? undefined : null;
  } catch (pgErr) {
    console.error('[2fa] Postgres MFA read failed:', pgErr);
    // On error: fall back to Mongo unless strictly pg.
    if (authPgRead() === 'pg') throw pgErr;
    return undefined;
  }
}

/* ────────────────────── Status ────────────────────── */

export async function getMy2faStatus(): Promise<ActionResult<TwoFactorStatus>> {
  const ctx = await requireUserOid();
  if (!ctx) return { ok: false, error: 'Unauthorized.' };
  const { db } = await connectToDatabase();
  const u = await db.collection('users').findOne(
    { _id: ctx.oid },
    {
      projection: {
        twoFactorEnabled: 1,
        twoFactorMethod: 1,
        twoFactorBackupCodes: 1,
        email: 1,
      } as any,
    },
  );
  const backupCodes = ((u as any)?.twoFactorBackupCodes ?? []) as string[];
  return {
    ok: true,
    data: {
      enabled: Boolean((u as any)?.twoFactorEnabled),
      method: ((u as any)?.twoFactorMethod ?? null) as TwoFactorMethod | null,
      hasBackupCodes: backupCodes.length > 0,
      backupCodesRemaining: backupCodes.length,
      email: String((u as any)?.email ?? ctx.email ?? ''),
    },
  };
}

/* ────────────────────── Email ────────────────────── */

export async function enableEmail2fa(): Promise<ActionResult> {
  const ctx = await requireUserOid();
  if (!ctx) return { ok: false, error: 'Unauthorized.' };
  if (!ctx.email) return { ok: false, error: 'No email on file.' };
  const code = genEmailCode();
  const { db } = await connectToDatabase();
  await db.collection('users').updateOne(
    { _id: ctx.oid },
    {
      $set: {
        twoFactorEmailCode: hashEmailCode(code),
        twoFactorEmailCodeExpiresAt: new Date(Date.now() + EMAIL_CODE_TTL_MS),
        twoFactorPendingMethod: 'email' as TwoFactorMethod,
        updatedAt: new Date(),
      },
    },
  );
  await deliverEmailCode(ctx.oid.toString(), ctx.email, code);
  return { ok: true };
}

export async function verifyEmail2faCode(code: string): Promise<ActionResult> {
  const ctx = await requireUserOid();
  if (!ctx) return { ok: false, error: 'Unauthorized.' };
  if (!/^\d{6}$/.test(code)) return { ok: false, error: 'Invalid code.' };
  const { db } = await connectToDatabase();
  const u = await db.collection('users').findOne(
    { _id: ctx.oid },
    {
      projection: {
        twoFactorEmailCode: 1,
        twoFactorEmailCodeExpiresAt: 1,
      } as any,
    },
  );
  const stored = (u as any)?.twoFactorEmailCode as string | undefined;
  const exp = (u as any)?.twoFactorEmailCodeExpiresAt as Date | undefined;
  if (!stored || !exp) return { ok: false, error: 'Request a new code.' };
  if (exp.getTime() < Date.now()) return { ok: false, error: 'Code expired.' };
  if (stored !== hashEmailCode(code)) return { ok: false, error: 'Incorrect code.' };

  await db.collection('users').updateOne(
    { _id: ctx.oid },
    {
      $set: {
        twoFactorEnabled: true,
        twoFactorMethod: 'email' as TwoFactorMethod,
        updatedAt: new Date(),
      },
      $unset: {
        twoFactorEmailCode: '',
        twoFactorEmailCodeExpiresAt: '',
        twoFactorPendingMethod: '',
        twoFactorSecret: '',
      },
    },
  );
  // Mirror the enabled email method into Postgres (best-effort, gated).
  await pgWriteActiveMfa({
    userId: ctx.oid.toString(),
    method: 'email',
    encryptedSecret: null,
    backupCodes: [],
    email: ctx.email,
  });
  revalidatePath(PROFILE_PATH);
  return { ok: true };
}

export async function disableEmail2fa(): Promise<ActionResult> {
  const ctx = await requireUserOid();
  if (!ctx) return { ok: false, error: 'Unauthorized.' };
  const { db } = await connectToDatabase();
  await db.collection('users').updateOne(
    { _id: ctx.oid, twoFactorMethod: 'email' },
    {
      $set: { twoFactorEnabled: false, updatedAt: new Date() },
      $unset: {
        twoFactorMethod: '',
        twoFactorEmailCode: '',
        twoFactorEmailCodeExpiresAt: '',
      },
    },
  );
  // Mirror the disable into Postgres (best-effort, gated).
  await pgRemoveActiveMfa(ctx.oid.toString());
  revalidatePath(PROFILE_PATH);
  return { ok: true };
}

/* ────────────────────── Authenticator (TOTP) ────────────────────── */

interface AuthenticatorSetupPayload {
  secret: string;
  qrUrl: string;
  backupCodes: string[];
}

export async function generateAuthenticator2faSecret(): Promise<
  ActionResult<AuthenticatorSetupPayload>
> {
  const ctx = await requireUserOid();
  if (!ctx) return { ok: false, error: 'Unauthorized.' };
  const secret = generateSecret();
  const qrUrl = await generateQrUrl(secret, ctx.email || ctx.oid.toString());
  const backupCodes = generateBackupCodes(8);
  const hashedBackup = await Promise.all(
    backupCodes.map((c) => bcrypt.hash(c, BACKUP_CODE_ROUNDS)),
  );
  const { db } = await connectToDatabase();
  await db.collection('users').updateOne(
    { _id: ctx.oid },
    {
      $set: {
        // Stored encrypted while pending; promoted on successful verify.
        twoFactorPendingSecret: encryptData(secret),
        twoFactorPendingBackupCodes: hashedBackup,
        twoFactorPendingMethod: 'totp' as TwoFactorMethod,
        updatedAt: new Date(),
      },
    },
  );
  return { ok: true, data: { secret, qrUrl, backupCodes } };
}

export async function verifyAuthenticator2faSetup(
  code: string,
): Promise<ActionResult> {
  const ctx = await requireUserOid();
  if (!ctx) return { ok: false, error: 'Unauthorized.' };
  if (!/^\d{6}$/.test(code)) return { ok: false, error: 'Invalid code.' };
  const { db } = await connectToDatabase();
  const u = await db.collection('users').findOne(
    { _id: ctx.oid },
    {
      projection: {
        twoFactorPendingSecret: 1,
        twoFactorPendingBackupCodes: 1,
      } as any,
    },
  );
  const pending = (u as any)?.twoFactorPendingSecret as string | undefined;
  if (!pending) return { ok: false, error: 'Start setup again — no pending secret.' };
  let secret: string;
  try {
    secret = decryptData(pending);
  } catch {
    return { ok: false, error: 'Failed to read pending secret.' };
  }
  if (!verifyTotpCode(secret, code)) {
    return { ok: false, error: 'Incorrect code. Try again.' };
  }
  const backup = ((u as any)?.twoFactorPendingBackupCodes ?? []) as string[];
  await db.collection('users').updateOne(
    { _id: ctx.oid },
    {
      $set: {
        twoFactorEnabled: true,
        twoFactorMethod: 'totp' as TwoFactorMethod,
        twoFactorSecret: pending, // already encrypted
        twoFactorBackupCodes: backup,
        updatedAt: new Date(),
      },
      $unset: {
        twoFactorPendingSecret: '',
        twoFactorPendingBackupCodes: '',
        twoFactorPendingMethod: '',
      },
    },
  );
  // Mirror the enabled TOTP method (encrypted secret + bcrypt backup hashes)
  // into Postgres (best-effort, gated). `pending` is already encrypted.
  await pgWriteActiveMfa({
    userId: ctx.oid.toString(),
    method: 'totp',
    encryptedSecret: pending,
    backupCodes: backup,
    email: ctx.email,
  });
  revalidatePath(PROFILE_PATH);
  return { ok: true };
}

export async function regenerateBackupCodes(): Promise<ActionResult<{ codes: string[] }>> {
  const ctx = await requireUserOid();
  if (!ctx) return { ok: false, error: 'Unauthorized.' };
  const { db } = await connectToDatabase();
  const u = await db
    .collection('users')
    .findOne({ _id: ctx.oid }, { projection: { twoFactorEnabled: 1 } as any });
  if (!(u as any)?.twoFactorEnabled) {
    return { ok: false, error: '2FA must be enabled to regenerate codes.' };
  }
  const codes = generateBackupCodes(8);
  const hashed = await Promise.all(codes.map((c) => bcrypt.hash(c, BACKUP_CODE_ROUNDS)));
  await db
    .collection('users')
    .updateOne(
      { _id: ctx.oid },
      { $set: { twoFactorBackupCodes: hashed, updatedAt: new Date() } },
    );
  // Mirror the new backup-code hashes into Postgres (best-effort, gated).
  await pgUpdateActiveMfaBackupCodes(ctx.oid.toString(), hashed);
  return { ok: true, data: { codes } };
}

export async function disable2fa(password: string): Promise<ActionResult> {
  const ctx = await requireUserOid();
  if (!ctx) return { ok: false, error: 'Unauthorized.' };
  // Re-auth: the user must prove they hold the account password before
  // we drop 2FA. Users on Firebase/social-auth providers won't have a
  // password hash — they should disable 2FA via the auth provider's
  // own re-auth flow; for those we reject with a clear message.
  if (!ctx.passwordHash) {
    return {
      ok: false,
      error: 'Your account uses social sign-in. Re-authenticate via your identity provider to disable 2FA.',
    };
  }
  const ok = await comparePassword(password, ctx.passwordHash);
  if (!ok) return { ok: false, error: 'Incorrect password.' };
  const { db } = await connectToDatabase();
  await db.collection('users').updateOne(
    { _id: ctx.oid },
    {
      $set: { twoFactorEnabled: false, updatedAt: new Date() },
      $unset: {
        twoFactorMethod: '',
        twoFactorSecret: '',
        twoFactorBackupCodes: '',
        twoFactorEmailCode: '',
        twoFactorEmailCodeExpiresAt: '',
        twoFactorPendingSecret: '',
        twoFactorPendingBackupCodes: '',
        twoFactorPendingMethod: '',
      },
    },
  );
  // Mirror the disable into Postgres (best-effort, gated).
  await pgRemoveActiveMfa(ctx.oid.toString());
  revalidatePath(PROFILE_PATH);
  return { ok: true };
}

/* ────────────────────── Login-flow helpers ────────────────────── */

/**
 * Called by the existing session-creation route after the primary
 * authentication factor succeeds. Returns `requires2fa: true` if the
 * user has 2FA enabled — the caller must NOT issue the session cookie
 * in that case; the UI runs the 6-digit challenge via
 * `verifyTwoFactorChallenge` below.
 */
export async function checkRequires2fa(userId: string): Promise<{
  requires2fa: boolean;
  method?: TwoFactorMethod;
}> {
  if (!ObjectId.isValid(userId)) return { requires2fa: false };
  const { db } = await connectToDatabase();

  // Resolve enabled/method from Postgres when the read path is opted in.
  // pgRow === undefined → Mongo fallback; null → authoritative "no method".
  const pgRow = await pgReadActiveMfa(userId);
  let enabled: boolean;
  let method: TwoFactorMethod;
  let email = '';
  if (pgRow !== undefined) {
    if (pgRow === null) return { requires2fa: false }; // strict-pg: no method
    const data = ((pgRow.data as any) ?? {}) as Record<string, unknown>;
    enabled = Boolean(data.enabled);
    method = ((data.method ?? pgRow.kind ?? 'email') as TwoFactorMethod);
    email = String((data.email as string | undefined) ?? '');
    if (!enabled) return { requires2fa: false };
    // The email transient-fields read below still needs the user email; if PG
    // didn't carry it, fall through to the Mongo email lookup for delivery.
  } else {
    const u = await db.collection('users').findOne(
      { _id: new ObjectId(userId) },
      { projection: { twoFactorEnabled: 1, twoFactorMethod: 1, email: 1 } as any },
    );
    if (!(u as any)?.twoFactorEnabled) return { requires2fa: false };
    method = ((u as any)?.twoFactorMethod ?? 'email') as TwoFactorMethod;
    email = String((u as any)?.email ?? '');
  }
  // For email-based 2FA, kick off code delivery immediately so the UI's
  // verification step works without an additional "send code" round-trip.
  if (method === 'email') {
    try {
      const code = genEmailCode();
      await db.collection('users').updateOne(
        { _id: new ObjectId(userId) },
        {
          $set: {
            twoFactorChallengeCode: hashEmailCode(code),
            twoFactorChallengeExpiresAt: new Date(Date.now() + EMAIL_CODE_TTL_MS),
          },
        },
      );
      // `email` is resolved above (PG data.email or the Mongo lookup). If the
      // PG row didn't carry it, fall back to a Mongo email read for delivery.
      let deliverTo = email;
      if (!deliverTo) {
        const eu = await db.collection('users').findOne(
          { _id: new ObjectId(userId) },
          { projection: { email: 1 } as any },
        );
        deliverTo = String((eu as any)?.email ?? '');
      }
      if (deliverTo) await deliverEmailCode(userId, deliverTo, code);
    } catch (err) {
      console.error('[2fa] failed to send login challenge:', err);
    }
  }
  return { requires2fa: true, method };
}

/**
 * Verify the 6-digit (or backup) code presented during login. Returns
 * `{ ok: true }` when the caller can safely mint a session.
 */
export async function verifyTwoFactorChallenge(
  userId: string,
  code: string,
): Promise<ActionResult> {
  if (!ObjectId.isValid(userId)) return { ok: false, error: 'Invalid user.' };
  if (!code || code.length < 6) return { ok: false, error: 'Code required.' };
  const { db } = await connectToDatabase();
  // Always read the user doc from Mongo: the email-challenge transient fields
  // (twoFactorChallengeCode/ExpiresAt) live only in Mongo regardless of mode.
  const u = await db.collection('users').findOne(
    { _id: new ObjectId(userId) },
    {
      projection: {
        twoFactorEnabled: 1,
        twoFactorMethod: 1,
        twoFactorSecret: 1,
        twoFactorBackupCodes: 1,
        twoFactorChallengeCode: 1,
        twoFactorChallengeExpiresAt: 1,
      } as any,
    },
  );

  // Resolve the security material (enabled/method/secret/backup-codes) from
  // Postgres when the read path is opted in; otherwise from the Mongo doc.
  // pgRow === undefined → use Mongo; null → strict-pg "no method".
  const pgRow = await pgReadActiveMfa(userId);
  let enabled: boolean;
  let method: TwoFactorMethod;
  let encryptedSecret: string | undefined;
  let backup: string[];
  if (pgRow !== undefined) {
    if (pgRow === null) return { ok: true }; // strict-pg: no method → no challenge
    const data = ((pgRow.data as any) ?? {}) as Record<string, unknown>;
    enabled = Boolean(data.enabled);
    method = ((data.method ?? pgRow.kind ?? 'email') as TwoFactorMethod);
    encryptedSecret = (pgRow.secret as string | null) ?? undefined;
    backup = (((data.backupCodes as string[] | undefined) ?? []) as string[]);
  } else {
    enabled = Boolean((u as any)?.twoFactorEnabled);
    method = ((u as any)?.twoFactorMethod ?? 'email') as TwoFactorMethod;
    encryptedSecret = (u as any)?.twoFactorSecret as string | undefined;
    backup = ((u as any)?.twoFactorBackupCodes ?? []) as string[];
  }
  if (!enabled) return { ok: true };
  const clean = code.replace(/\s+/g, '');
  const isSixDigit = /^\d{6}$/.test(clean);

  // 1) Try the primary factor.
  if (isSixDigit) {
    if (method === 'totp') {
      const enc = encryptedSecret;
      if (enc) {
        let secret: string | null = null;
        try {
          secret = decryptData(enc);
        } catch {
          secret = null;
        }
        if (secret && verifyTotpCode(secret, clean)) {
          return { ok: true };
        }
      }
    } else if (method === 'email') {
      const stored = (u as any)?.twoFactorChallengeCode as string | undefined;
      const exp = (u as any)?.twoFactorChallengeExpiresAt as Date | undefined;
      if (stored && exp && exp.getTime() >= Date.now() && stored === hashEmailCode(clean)) {
        await db
          .collection('users')
          .updateOne(
            { _id: new ObjectId(userId) },
            {
              $unset: {
                twoFactorChallengeCode: '',
                twoFactorChallengeExpiresAt: '',
              },
            },
          );
        return { ok: true };
      }
    }
  }

  // 2) Fall back to a backup code (one-use). `backup` is resolved above from
  // PG (opted-in) or Mongo; consuming a code dual-writes the trimmed list.
  for (let i = 0; i < backup.length; i += 1) {
    const hash = backup[i]!;
    // eslint-disable-next-line no-await-in-loop
    if (await bcrypt.compare(clean, hash)) {
      const next = [...backup.slice(0, i), ...backup.slice(i + 1)];
      // Skip the Mongo write only under pg-only (!shouldWriteMongo()).
      if (shouldWriteMongo()) {
        // eslint-disable-next-line no-await-in-loop
        await db
          .collection('users')
          .updateOne(
            { _id: new ObjectId(userId) },
            { $set: { twoFactorBackupCodes: next, updatedAt: new Date() } },
          );
      }
      // Mirror the consumed code into Postgres (best-effort, gated).
      // eslint-disable-next-line no-await-in-loop
      await pgUpdateActiveMfaBackupCodes(userId, next);
      return { ok: true };
    }
  }

  return { ok: false, error: 'Invalid code.' };
}

interface LoginAttempt {
  _id: string;
  ip: string;
  userAgent: string;
  status: 'success' | 'failed' | 'pending_2fa';
  createdAt: Date;
}

export async function getRecentLoginAttempts(): Promise<ActionResult<LoginAttempt[]>> {
  const ctx = await requireUserOid();
  if (!ctx) return { ok: false, error: 'Unauthorized.' };
  const { db } = await connectToDatabase();
  const attempts = await db.collection('login_attempts')
    .find({ userId: ctx.oid })
    .sort({ createdAt: -1 })
    .limit(10)
    .toArray();
  
  return {
    ok: true,
    data: attempts.map(a => ({
      _id: a._id.toString(),
      ip: a.ip || 'Unknown',
      userAgent: a.userAgent || 'Unknown',
      status: a.status,
      createdAt: a.createdAt,
    }))
  };
}
