'use server';

import { revalidatePath } from 'next/cache';
import { ObjectId, type WithId, type Filter } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { hashPassword } from '@/lib/auth';
import { getSession } from '@/app/actions/user.actions';
import { getErrorMessage } from '@/lib/utils';

/**
 * Client Signup actions — public signup endpoint + admin approval queue.
 *
 * Storage:
 *   users          { role: 'client', status: 'pending'|'active'|'rejected', adminApproval, signupAt, rejectReason }
 *   client_details { userId, companyName, contactName, mobile, country, website, agreedToTermsAt }
 *   signup_settings (singleton — { allowClientSignup, requireAdminApproval, termsLink, termsText })
 */

export type ClientSignupInput = {
  company_name: string;
  contact_name: string;
  email: string;
  password: string;
  mobile: string;
  country: string;
  website?: string;
  agree_to_terms: boolean;
};

export type PendingSignupRow = {
  _id: string;
  name: string;
  email: string;
  company: string;
  signedUpAt: string;
  daysPending: number;
};

export type SignupSettings = {
  allowClientSignup: boolean;
  requireAdminApproval: boolean;
  termsLink: string;
  termsText: string;
};

const SIGNUP_SETTINGS_KEY = 'signup_settings';

async function getSignupSettings(): Promise<SignupSettings> {
  const { db } = await connectToDatabase();
  const doc = await db.collection('settings').findOne({ key: SIGNUP_SETTINGS_KEY });
  const v = (doc?.value as Partial<SignupSettings> | undefined) ?? {};
  return {
    allowClientSignup: v.allowClientSignup ?? true,
    requireAdminApproval: v.requireAdminApproval ?? true,
    termsLink: v.termsLink ?? '/terms',
    termsText: v.termsText ?? 'I agree to the Terms of Service and Privacy Policy.',
  };
}

async function requireAdmin() {
  const session = await getSession();
  if (!session?.user) throw new Error('Not authenticated.');
  const role = (session.user as { role?: string }).role;
  if (role !== 'admin') throw new Error('Admin privileges required.');
  return session;
}

/**
 * PUBLIC — no auth required. Creates a `users` row with role='client',
 * status='pending', adminApproval=false. Also creates the matching
 * `client_details` row.
 */
export async function submitClientSignup(
  data: ClientSignupInput,
): Promise<{ ok?: boolean; error?: string }> {
  try {
    if (!data?.email || !data.password || !data.contact_name || !data.company_name) {
      return { error: 'Missing required fields.' };
    }
    if (!data.agree_to_terms) {
      return { error: 'You must agree to the Terms before signing up.' };
    }
    const settings = await getSignupSettings();
    if (!settings.allowClientSignup) {
      return { error: 'Client signup is currently disabled.' };
    }

    const { db } = await connectToDatabase();
    const email = data.email.trim().toLowerCase();
    const existing = await db.collection('users').findOne({ email });
    if (existing) return { error: 'An account with this email already exists.' };

    const hashed = await hashPassword(data.password);
    const now = new Date();
    const userDoc: Record<string, unknown> = {
      name: data.contact_name.trim(),
      email,
      password: hashed,
      role: 'client',
      status: settings.requireAdminApproval ? 'pending' : 'active',
      adminApproval: !settings.requireAdminApproval,
      signupAt: now,
      createdAt: now,
    };

    const userInsert = await db.collection('users').insertOne(userDoc);
    await db.collection('client_details').insertOne({
      userId: userInsert.insertedId,
      companyName: data.company_name.trim(),
      contactName: data.contact_name.trim(),
      mobile: data.mobile.trim(),
      country: data.country.trim(),
      website: data.website?.trim() || null,
      agreedToTermsAt: now,
      createdAt: now,
    });

    // TODO: send welcome / "awaiting approval" email
    console.log('[client-signup] TODO: send signup-received email', { email });

    return { ok: true };
  } catch (e: unknown) {
    return { error: getErrorMessage(e) };
  }
}

export async function getPendingSignups(): Promise<{
  rows: PendingSignupRow[];
  kpis: { totalPending: number; oldestDays: number };
}> {
  await requireAdmin();
  const { db } = await connectToDatabase();
  const filter: Filter<Record<string, unknown>> = { status: 'pending', role: 'client' };
  const users = await db
    .collection('users')
    .find(filter)
    .project({ name: 1, email: 1, signupAt: 1, createdAt: 1 })
    .sort({ signupAt: 1 })
    .toArray();

  if (users.length === 0) return { rows: [], kpis: { totalPending: 0, oldestDays: 0 } };

  const userIds = users.map((u) => u._id);
  const details = await db
    .collection('client_details')
    .find({ userId: { $in: userIds } })
    .toArray();
  const byUser = new Map(details.map((d) => [String(d.userId), d]));

  const now = Date.now();
  let oldestMs = 0;
  const rows: PendingSignupRow[] = users.map((u) => {
    const signedAt = (u.signupAt as Date | undefined) ?? (u.createdAt as Date | undefined) ?? new Date(now);
    const ms = signedAt instanceof Date ? signedAt.getTime() : new Date(signedAt).getTime();
    const ageMs = now - ms;
    if (ageMs > oldestMs) oldestMs = ageMs;
    const d = byUser.get(String(u._id));
    return {
      _id: String(u._id),
      name: (u.name as string) ?? '',
      email: (u.email as string) ?? '',
      company: ((d?.companyName as string | undefined) ?? '') as string,
      signedUpAt: signedAt instanceof Date ? signedAt.toISOString() : String(signedAt),
      daysPending: Math.floor(ageMs / (1000 * 60 * 60 * 24)),
    };
  });

  return {
    rows,
    kpis: {
      totalPending: rows.length,
      oldestDays: Math.floor(oldestMs / (1000 * 60 * 60 * 24)),
    },
  };
}

export async function approveSignup(userId: string): Promise<{ ok?: boolean; error?: string }> {
  try {
    await requireAdmin();
    if (!ObjectId.isValid(userId)) return { error: 'Invalid user id.' };
    const { db } = await connectToDatabase();
    const user = await db.collection('users').findOne({ _id: new ObjectId(userId) });
    if (!user) return { error: 'User not found.' };

    await db.collection('users').updateOne(
      { _id: new ObjectId(userId) },
      {
        $set: {
          status: 'active',
          adminApproval: true,
          approvedAt: new Date(),
          rejectReason: null,
        },
      },
    );

    // TODO: send welcome email to user
    console.log('[client-signup] TODO: send welcome email', {
      email: user.email,
      userId,
    });

    revalidatePath('/dashboard/crm/team/pending-approvals');
    return { ok: true };
  } catch (e: unknown) {
    return { error: getErrorMessage(e) };
  }
}

export async function rejectSignup(
  userId: string,
  reason: string,
): Promise<{ ok?: boolean; error?: string }> {
  try {
    await requireAdmin();
    if (!ObjectId.isValid(userId)) return { error: 'Invalid user id.' };
    const { db } = await connectToDatabase();
    const user = await db.collection('users').findOne({ _id: new ObjectId(userId) });
    if (!user) return { error: 'User not found.' };

    // NOTE: rejected users are kept for 30 days for audit, then auto-deleted
    // by the periodic cleanup cron — see src/lib/cron/jobs for retention logic.
    await db.collection('users').updateOne(
      { _id: new ObjectId(userId) },
      {
        $set: {
          status: 'rejected',
          adminApproval: false,
          rejectReason: reason || 'No reason provided.',
          rejectedAt: new Date(),
        },
      },
    );

    // TODO: send rejection email to user
    console.log('[client-signup] TODO: send rejection email', {
      email: user.email,
      reason,
    });

    revalidatePath('/dashboard/crm/team/pending-approvals');
    return { ok: true };
  } catch (e: unknown) {
    return { error: getErrorMessage(e) };
  }
}

export async function bulkApprove(
  ids: string[],
): Promise<{ ok?: boolean; count?: number; error?: string }> {
  try {
    await requireAdmin();
    const validIds = (ids ?? []).filter(ObjectId.isValid).map((id) => new ObjectId(id));
    if (validIds.length === 0) return { error: 'No valid ids provided.' };
    const { db } = await connectToDatabase();
    const res = await db.collection('users').updateMany(
      { _id: { $in: validIds } },
      {
        $set: {
          status: 'active',
          adminApproval: true,
          approvedAt: new Date(),
          rejectReason: null,
        },
      },
    );
    console.log('[client-signup] TODO: send bulk welcome emails', {
      count: res.modifiedCount,
    });
    revalidatePath('/dashboard/crm/team/pending-approvals');
    return { ok: true, count: res.modifiedCount };
  } catch (e: unknown) {
    return { error: getErrorMessage(e) };
  }
}

export async function bulkReject(
  ids: string[],
  reason: string,
): Promise<{ ok?: boolean; count?: number; error?: string }> {
  try {
    await requireAdmin();
    const validIds = (ids ?? []).filter(ObjectId.isValid).map((id) => new ObjectId(id));
    if (validIds.length === 0) return { error: 'No valid ids provided.' };
    const { db } = await connectToDatabase();
    const res = await db.collection('users').updateMany(
      { _id: { $in: validIds } },
      {
        $set: {
          status: 'rejected',
          adminApproval: false,
          rejectReason: reason || 'No reason provided.',
          rejectedAt: new Date(),
        },
      },
    );
    console.log('[client-signup] TODO: send bulk rejection emails', {
      count: res.modifiedCount,
      reason,
    });
    revalidatePath('/dashboard/crm/team/pending-approvals');
    return { ok: true, count: res.modifiedCount };
  } catch (e: unknown) {
    return { error: getErrorMessage(e) };
  }
}

export async function getPublicSignupSettings(): Promise<SignupSettings> {
  return getSignupSettings();
}

export async function getSignupSettingsForAdmin(): Promise<SignupSettings> {
  await requireAdmin();
  return getSignupSettings();
}

export async function saveSignupSettings(
  next: SignupSettings,
): Promise<{ ok?: boolean; error?: string }> {
  try {
    await requireAdmin();
    const { db } = await connectToDatabase();
    await db.collection('settings').updateOne(
      { key: SIGNUP_SETTINGS_KEY },
      {
        $set: {
          key: SIGNUP_SETTINGS_KEY,
          value: {
            allowClientSignup: Boolean(next.allowClientSignup),
            requireAdminApproval: Boolean(next.requireAdminApproval),
            termsLink: next.termsLink || '/terms',
            termsText: next.termsText || '',
          },
          updatedAt: new Date(),
        },
      },
      { upsert: true },
    );
    revalidatePath('/dashboard/crm/settings/sign-up-settings');
    return { ok: true };
  } catch (e: unknown) {
    return { error: getErrorMessage(e) };
  }
}
