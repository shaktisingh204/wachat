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

// ---------------------------------------------------------------------
// Detail loader for PDF rendering.
// ---------------------------------------------------------------------

export type PublicContractDetailCompany = {
  name?: string;
  address?: string;
  email?: string;
  phone?: string;
  taxId?: string;
  logoUrl?: string | null;
};

export type PublicContractDetailClient = {
  name?: string;
  email?: string;
  phone?: string;
  address?: string;
};

export type PublicContractDetailSignature = {
  fullName: string;
  signedAt: string;
  signatureDataUrl: string;
  place: string;
} | null;

export type PublicContractDetail = {
  ok: true;
  contract: {
    _id: string;
    contractName: string;
    contractNumber?: string;
    contractDate: string | null;
    startDate: string | null;
    endDate: string | null;
    amount?: number;
    currency: string;
    partyFirst?: string;
    partySecond?: string;
    contractDetail: string;
    signed: boolean;
  };
  company: PublicContractDetailCompany;
  client: PublicContractDetailClient;
  signature: {
    company: PublicContractDetailSignature;
    client: PublicContractDetailSignature;
  };
};

export type PublicContractDetailResult = PublicContractDetail | { ok: false; error: string };

export async function getPublicContractWithDetails(
  hash: string,
): Promise<PublicContractDetailResult> {
  if (!isValidPublicHash(hash)) return { ok: false, error: 'Invalid link.' };
  try {
    const { db } = await connectToDatabase();
    const { ObjectId } = await import('mongodb');
    const contract = await db.collection('crm_contracts').findOne({ publicHash: hash });
    if (!contract) return { ok: false, error: 'Contract not found.' };

    let company: PublicContractDetailCompany = {};
    if (contract.userId) {
      try {
        const settings = await db
          .collection('crm_settings')
          .findOne({ userId: contract.userId });
        if (settings) {
          company = {
            name: (settings.companyName as string) || '',
            address: (settings.companyAddress as string) || '',
            email: (settings.companyEmail as string) || '',
            phone: (settings.companyPhone as string) || '',
            taxId: (settings.gstin as string) || '',
            logoUrl: (settings.companyLogo as string) || (settings.logoUrl as string) || null,
          };
        }
      } catch {
        /* non-fatal */
      }
    }

    let client: PublicContractDetailClient = {};
    const clientRef = contract.accountId || contract.contactId || contract.clientId;
    if (clientRef) {
      try {
        const id = typeof clientRef === 'string' ? new ObjectId(clientRef) : clientRef;
        const cdoc =
          (await db.collection('crm_accounts').findOne({ _id: id })) ||
          (await db.collection('crm_contacts').findOne({ _id: id }));
        if (cdoc) {
          client = {
            name:
              (cdoc.name as string) ||
              (cdoc.accountName as string) ||
              `${(cdoc.firstName as string) || ''} ${(cdoc.lastName as string) || ''}`.trim(),
            email: (cdoc.email as string) || '',
            phone: (cdoc.phone as string) || '',
            address: (cdoc.address as string) || (cdoc.billingAddress as string) || '',
          };
        }
      } catch {
        /* non-fatal */
      }
    }

    // Look for both a company signature (signedByCompany) and the
    // client signature in contract_signs.
    let clientSig: PublicContractDetailSignature = null;
    let companySig: PublicContractDetailSignature = null;
    try {
      const sigs = await db
        .collection('contract_signs')
        .find({ contractId: contract._id })
        .sort({ signedAt: -1 })
        .toArray();
      for (const sig of sigs) {
        const shape: PublicContractDetailSignature = {
          fullName: (sig.fullName as string) || '',
          signedAt: sig.signedAt ? new Date(sig.signedAt as Date).toISOString() : '',
          signatureDataUrl: (sig.signatureDataUrl as string) || '',
          place: (sig.place as string) || '',
        };
        if (sig.party === 'company' && !companySig) companySig = shape;
        else if (!clientSig) clientSig = shape;
      }
    } catch {
      /* non-fatal */
    }

    return {
      ok: true,
      contract: {
        _id: contract._id.toString(),
        contractName:
          (contract.name as string) ||
          (contract.subject as string) ||
          (contract.contract_name as string) ||
          '',
        contractNumber:
          (contract.contractNumber as string) || (contract.contract_number as string) || undefined,
        contractDate: contract.contractDate
          ? new Date(contract.contractDate as Date).toISOString()
          : contract.createdAt
            ? new Date(contract.createdAt as Date).toISOString()
            : null,
        startDate: contract.startDate
          ? new Date(contract.startDate as Date).toISOString()
          : null,
        endDate: contract.endDate ? new Date(contract.endDate as Date).toISOString() : null,
        amount: contract.amount != null ? Number(contract.amount) : undefined,
        currency: (contract.currency as string) || 'USD',
        partyFirst:
          (contract.partyFirst as string) || (contract.first_party as string) || undefined,
        partySecond:
          (contract.partySecond as string) || (contract.second_party as string) || undefined,
        contractDetail:
          (contract.contract_detail as string) ||
          (contract.contractDetail as string) ||
          (contract.body as string) ||
          '',
        signed: !!contract.signed,
      },
      company,
      client,
      signature: { company: companySig, client: clientSig },
    };
  } catch (e) {
    console.error('[getPublicContractWithDetails] failed:', e);
    return { ok: false, error: 'Could not load contract.' };
  }
}
