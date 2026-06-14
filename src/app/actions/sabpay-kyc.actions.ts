'use server';

import { ObjectId } from 'mongodb';
import { revalidatePath } from 'next/cache';

import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';
import {
  getKycByUser,
  missingKycRequirements,
  BUSINESS_TYPES,
  type SabpayKyc,
  type SabpayKycFileRef,
} from '@/lib/sabpay/kyc';

/* SabPay merchant onboarding / KYC actions (user-scoped). */

async function requireUserId(): Promise<string> {
  const session = await getSession();
  const id = (session?.user as { _id?: unknown } | undefined)?._id;
  if (!id || !ObjectId.isValid(String(id))) throw new Error('Unauthorized');
  return String(id);
}

async function upsertKyc(userId: string, patch: Record<string, unknown>): Promise<void> {
  const { db } = await connectToDatabase();
  const now = new Date().toISOString();
  await db.collection('sabpay_kyc').updateOne(
    { userId: new ObjectId(userId) },
    {
      $set: { ...patch, updatedAt: now },
      $setOnInsert: {
        userId: new ObjectId(userId),
        status: 'pending',
        createdAt: now,
      },
    },
    { upsert: true },
  );
}

export async function getMyKyc(): Promise<SabpayKyc | null> {
  const userId = await requireUserId();
  return getKycByUser(userId);
}

export async function saveKycBusiness(input: {
  legalName?: string;
  businessType?: string;
  registrationNumber?: string;
  taxId?: string;
  contactEmail?: string;
  contactPhone?: string;
  website?: string;
  address1?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const userId = await requireUserId();
  if (input.businessType && !BUSINESS_TYPES.includes(input.businessType as never)) {
    return { ok: false, error: 'Invalid business type.' };
  }
  const clean: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input)) {
    clean[k] = typeof v === 'string' ? v.trim() : v;
  }
  await upsertKyc(userId, clean);
  revalidatePath('/sabpay/onboarding');
  return { ok: true };
}

export async function saveKycBank(input: {
  bankAccountHolder?: string;
  bankAccountNumber?: string;
  bankIfsc?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const userId = await requireUserId();
  await upsertKyc(userId, {
    bankAccountHolder: input.bankAccountHolder?.trim(),
    bankAccountNumber: input.bankAccountNumber?.trim(),
    bankIfsc: input.bankIfsc?.trim(),
  });
  revalidatePath('/sabpay/onboarding');
  return { ok: true };
}

const DOC_SLOTS = ['docIdentity', 'docBusinessProof', 'docAddressProof', 'docBankProof'];

export async function saveKycDocument(
  slot: string,
  ref: SabpayKycFileRef | null,
): Promise<{ ok: boolean; error?: string }> {
  const userId = await requireUserId();
  if (!DOC_SLOTS.includes(slot)) return { ok: false, error: 'Invalid document slot.' };
  await upsertKyc(userId, { [slot]: ref });
  revalidatePath('/sabpay/onboarding');
  return { ok: true };
}

/**
 * Submit onboarding for activation. Validates that every required field +
 * document is present, then activates the merchant. (A real review workflow
 * would set `under_review` here and an admin would flip to `verified`; we
 * auto-activate a complete, valid submission.)
 */
export async function submitKyc(): Promise<{ ok: boolean; error?: string }> {
  const userId = await requireUserId();
  const kyc = await getKycByUser(userId);
  const missing = missingKycRequirements(kyc);
  if (missing.length) {
    return { ok: false, error: `Please complete: ${missing.join(', ')}.` };
  }
  const now = new Date().toISOString();
  const { db } = await connectToDatabase();
  await db.collection('sabpay_kyc').updateOne(
    { userId: new ObjectId(userId) },
    { $set: { status: 'verified', submittedAt: now, reviewedAt: now, updatedAt: now } },
  );
  revalidatePath('/sabpay');
  revalidatePath('/sabpay/onboarding');
  return { ok: true };
}

/**
 * Admin/manual review hook — approve or reject a merchant's KYC. (Not wired to
 * an admin UI yet; available for a reviewer workflow.)
 */
export async function reviewSabpayKyc(
  targetUserId: string,
  decision: 'verified' | 'rejected',
  reason?: string,
): Promise<{ ok: boolean; error?: string }> {
  // NOTE: caller must be an admin — gate this when wiring an admin surface.
  if (!ObjectId.isValid(targetUserId)) return { ok: false, error: 'Invalid user id.' };
  const now = new Date().toISOString();
  const { db } = await connectToDatabase();
  await db.collection('sabpay_kyc').updateOne(
    { userId: new ObjectId(targetUserId) },
    {
      $set: {
        status: decision,
        rejectionReason: decision === 'rejected' ? reason?.trim() || 'Not specified' : undefined,
        reviewedAt: now,
        updatedAt: now,
      },
    },
  );
  return { ok: true };
}
