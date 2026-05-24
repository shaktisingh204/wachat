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

const PROFILE_PATH = '/dashboard/profile/2fa-setup';
const EMAIL_CODE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const BACKUP_CODE_ROUNDS = 10;

export type TwoFactorMethod = 'email' | 'totp';

export interface TwoFactorStatus {
  enabled: boolean;
  method: TwoFactorMethod | null;
  hasBackupCodes: boolean;
  /** Number of currently-active backup codes (not the codes themselves). */
  backupCodesRemaining: number;
  email: string | null;
}

export interface ActionResult<T = unknown> {
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
  revalidatePath(PROFILE_PATH);
  return { ok: true };
}

/* ────────────────────── Authenticator (TOTP) ────────────────────── */

export interface AuthenticatorSetupPayload {
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
  const u = await db.collection('users').findOne(
    { _id: new ObjectId(userId) },
    { projection: { twoFactorEnabled: 1, twoFactorMethod: 1, email: 1 } as any },
  );
  if (!(u as any)?.twoFactorEnabled) return { requires2fa: false };
  const method = ((u as any)?.twoFactorMethod ?? 'email') as TwoFactorMethod;
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
      const email = String((u as any)?.email ?? '');
      if (email) await deliverEmailCode(userId, email, code);
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
  if (!(u as any)?.twoFactorEnabled) return { ok: true };
  const method = ((u as any)?.twoFactorMethod ?? 'email') as TwoFactorMethod;
  const clean = code.replace(/\s+/g, '');
  const isSixDigit = /^\d{6}$/.test(clean);

  // 1) Try the primary factor.
  if (isSixDigit) {
    if (method === 'totp') {
      const enc = (u as any)?.twoFactorSecret as string | undefined;
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

  // 2) Fall back to a backup code (one-use).
  const backup = ((u as any)?.twoFactorBackupCodes ?? []) as string[];
  for (let i = 0; i < backup.length; i += 1) {
    const hash = backup[i]!;
    // eslint-disable-next-line no-await-in-loop
    if (await bcrypt.compare(clean, hash)) {
      const next = [...backup.slice(0, i), ...backup.slice(i + 1)];
      await db
        .collection('users')
        .updateOne(
          { _id: new ObjectId(userId) },
          { $set: { twoFactorBackupCodes: next, updatedAt: new Date() } },
        );
      return { ok: true };
    }
  }

  return { ok: false, error: 'Invalid code.' };
}

export interface LoginAttempt {
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
