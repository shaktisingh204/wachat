'use server';

import { cookies } from 'next/headers';
import { ObjectId } from 'mongodb';

import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';
import {
  hashPassword,
  createSessionToken,
  isHostedAuthConfigured,
  getFirebaseAuthUserByEmail,
  setFirebaseAuthUserPassword,
} from '@/lib/auth';
import { sessionCookieOptions } from '@/lib/cookies';
import { resetHostedMailboxPasswordForWorkspace } from '@/lib/sabmail/hosted-core';
import { getOrInitSabAdminSettings, resolveMailWorkspaceId } from '@/lib/sabadmin/tenant';
import { getSabAdminCollections } from '@/lib/sabadmin/db/collections';

const SESSION_DURATION_S = 7 * 24 * 60 * 60;

/**
 * First-login forced password change. A provisioned employee signs in with the
 * admin-issued temporary password, is held on /set-password by the proxy, and
 * sets a real password here. We update the Firebase login + Mongo hash, keep the
 * mailbox credential in sync (single credential, UPN model), clear the
 * `mustChangePassword` flag, and re-mint the session JWT so the proxy stops
 * redirecting.
 */
export async function submitFirstLoginPassword(
  newPassword: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await getSession();
  const u = session?.user as { _id?: unknown; email?: unknown; name?: unknown; isApproved?: unknown } | undefined;
  if (!u?._id || !ObjectId.isValid(String(u._id))) {
    return { ok: false, error: 'Not signed in.' };
  }
  const userId = String(u._id);
  const email = String(u.email ?? '');

  const pw = (newPassword || '').trim();
  if (pw.length < 8) return { ok: false, error: 'Use at least 8 characters.' };
  if (!/[a-z]/i.test(pw) || !/[0-9]/.test(pw)) {
    return { ok: false, error: 'Include at least one letter and one number.' };
  }

  const { db } = await connectToDatabase();
  const userDoc = await db
    .collection('users')
    .findOne({ _id: new ObjectId(userId) }, { projection: { firebaseUid: 1, email: 1 } });
  const fbUid = (userDoc as { firebaseUid?: string } | null)?.firebaseUid;

  // 1) Firebase login password.
  try {
    if (isHostedAuthConfigured()) {
      if (fbUid) {
        await setFirebaseAuthUserPassword(fbUid, pw);
      } else {
        const fb = await getFirebaseAuthUserByEmail(email).catch(() => null);
        if (fb) await setFirebaseAuthUserPassword(fb.uid, pw);
      }
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Could not update password.' };
  }

  // 2) Mongo hash + clear the flag.
  await db.collection('users').updateOne(
    { _id: new ObjectId(userId) },
    { $set: { password: await hashPassword(pw), mustChangePassword: false, updatedAt: new Date() } },
  );

  // 3) Best-effort: keep the mailbox credential in sync (single credential).
  try {
    const { cols } = await getSabAdminCollections();
    const prov = await cols.provisions.findOne({ userId });
    if (prov?.mailboxAccountId) {
      const settings = await getOrInitSabAdminSettings(prov.ownerUserId);
      const ws = await resolveMailWorkspaceId(prov.ownerUserId, settings);
      if (ws) await resetHostedMailboxPasswordForWorkspace(ws, prov.mailboxAccountId, pw);
    }
  } catch {
    /* best-effort — login already updated */
  }

  // 4) Re-mint the session WITHOUT the flag so the proxy stops redirecting.
  const token = await createSessionToken({
    userId,
    email,
    name: (u.name as string) ?? undefined,
    isApproved: (u.isApproved as boolean) ?? false,
    mustChangePassword: false,
  } as never);
  const store = await cookies();
  store.set('session', token, sessionCookieOptions(SESSION_DURATION_S));

  return { ok: true };
}
