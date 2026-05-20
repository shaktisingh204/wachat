'use server';

/**
 * Public contract actions — back `/share/contract/[hash]`.
 *
 * Collections:
 *   crm_contracts       — read by publicHash, set signed=true on sign
 *   contract_signs      — full signature record (name, email, place, signature)
 */

import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { connectToDatabase } from '@/lib/mongodb';
import { isValidPublicHash } from '@/lib/public-hash';

export type PublicContractView = {
  _id: string;
  name: string;
  partyFirst?: string;
  partySecond?: string;
  amount?: number;
  currency: string;
  startDate: string | null;
  endDate: string | null;
  contractDetail: string;
  signed: boolean;
  signedBy?: {
    fullName: string;
    email: string;
    place: string;
    signedAt: string;
    signatureDataUrl: string;
  } | null;
} | null;

export type PublicActionResult =
  | { success: true; message?: string }
  | { success: false; error: string };

export type SignContractData = {
  fullName: string;
  email: string;
  place: string;
  signatureDataUrl: string;
};

async function clientMeta(): Promise<{ ip: string | null; userAgent: string | null }> {
  try {
    const h = await headers();
    const ip = h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip') || null;
    const userAgent = h.get('user-agent') || null;
    return { ip, userAgent };
  } catch {
    return { ip: null, userAgent: null };
  }
}

export async function getPublicContract(hash: string): Promise<PublicContractView> {
  if (!isValidPublicHash(hash)) return null;
  try {
    const { db } = await connectToDatabase();
    const contract = await db.collection('crm_contracts').findOne({ publicHash: hash });
    if (!contract) return null;

    let signedBy: {
      fullName: string;
      email: string;
      place: string;
      signedAt: string;
      signatureDataUrl: string;
    } | null = null;
    if (contract.signed) {
      const sig = await db
        .collection('contract_signs')
        .findOne({ contractId: contract._id }, { sort: { signedAt: -1 } });
      if (sig) {
        signedBy = {
          fullName: (sig.fullName as string) || '',
          email: (sig.email as string) || '',
          place: (sig.place as string) || '',
          signedAt: sig.signedAt ? new Date(sig.signedAt).toISOString() : '',
          signatureDataUrl: (sig.signatureDataUrl as string) || '',
        };
      }
    }

    return {
      _id: contract._id.toString(),
      name: (contract.name as string) || (contract.subject as string) || '',
      partyFirst: (contract.partyFirst as string) || (contract.first_party as string),
      partySecond: (contract.partySecond as string) || (contract.second_party as string),
      amount: contract.amount != null ? Number(contract.amount) : undefined,
      currency: (contract.currency as string) || 'USD',
      startDate: contract.startDate ? new Date(contract.startDate).toISOString() : null,
      endDate: contract.endDate ? new Date(contract.endDate).toISOString() : null,
      contractDetail:
        (contract.contract_detail as string) ||
        (contract.contractDetail as string) ||
        (contract.body as string) ||
        '',
      signed: Boolean(contract.signed),
      signedBy,
    };
  } catch (e) {
    console.error('[getPublicContract] failed:', e);
    return null;
  }
}

export async function signContract(
  hash: string,
  data: SignContractData,
): Promise<PublicActionResult> {
  if (!isValidPublicHash(hash)) return { success: false, error: 'Invalid link.' };
  if (!data.fullName?.trim()) return { success: false, error: 'Full name is required.' };
  if (!data.email?.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
    return { success: false, error: 'Enter a valid email address.' };
  }
  if (!data.place?.trim()) return { success: false, error: 'Place is required.' };
  if (!data.signatureDataUrl?.startsWith('data:image/')) {
    return { success: false, error: 'Please draw your signature before signing.' };
  }
  try {
    const { db } = await connectToDatabase();
    const contract = await db.collection('crm_contracts').findOne({ publicHash: hash });
    if (!contract) return { success: false, error: 'Contract not found.' };
    if (contract.signed) return { success: false, error: 'This contract is already signed.' };

    const meta = await clientMeta();
    const now = new Date();

    await db.collection('contract_signs').insertOne({
      contractId: contract._id,
      userId: contract.userId,
      fullName: data.fullName.trim().slice(0, 200),
      email: data.email.trim().slice(0, 200),
      place: data.place.trim().slice(0, 200),
      signatureDataUrl: data.signatureDataUrl,
      signedAt: now,
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    await db.collection('crm_contracts').updateOne(
      { _id: contract._id },
      {
        $set: {
          signed: true,
          signedAt: now,
          signedBy: data.fullName.trim(),
          signedEmail: data.email.trim(),
          updatedAt: now,
        },
      },
    );

    revalidatePath(`/share/contract/${hash}`);
    return { success: true, message: 'Contract signed.' };
  } catch (e) {
    console.error('[signContract] failed:', e);
    return { success: false, error: 'Could not sign contract.' };
  }
}
