'use server';

/**
 * Public proposal actions — back `/share/proposal/[hash]`.
 *
 * Mirrors `public-estimate.actions.ts` shape so the page renders the
 * same accept / decline UI. Collections:
 *   crm_proposals       — read by publicHash, status transitions
 *   crm_proposal_signs  — signature record on accept
 */

import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { connectToDatabase } from '@/lib/mongodb';
import { isValidPublicHash } from '@/lib/public-hash';

type PublicProposalView = {
  _id: string;
  title: string;
  validTill: string | null;
  currency: string;
  status: string;
  total: number;
  body?: string;
  signature?: {
    signedByName: string;
    signedAt: string;
    signatureDataUrl: string;
  } | null;
  declineReason?: string | null;
} | null;

type PublicActionResult =
  | { success: true; message?: string }
  | { success: false; error: string };

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

export async function getPublicProposal(hash: string): Promise<PublicProposalView> {
  if (!isValidPublicHash(hash)) return null;
  try {
    const { db } = await connectToDatabase();
    const proposal = await db.collection('crm_proposals').findOne({ publicHash: hash });
    if (!proposal) return null;

    let signature: {
      signedByName: string;
      signedAt: string;
      signatureDataUrl: string;
    } | null = null;
    if (proposal.status === 'accepted') {
      const sig = await db
        .collection('crm_proposal_signs')
        .findOne({ proposalId: proposal._id }, { sort: { signedAt: -1 } });
      if (sig) {
        signature = {
          signedByName: (sig.signedByName as string) || '',
          signedAt: sig.signedAt ? new Date(sig.signedAt).toISOString() : '',
          signatureDataUrl: (sig.signatureDataUrl as string) || '',
        };
      }
    }

    return {
      _id: proposal._id.toString(),
      title: (proposal.title as string) || (proposal.proposalNumber as string) || '',
      validTill: proposal.validTill
        ? new Date(proposal.validTill).toISOString()
        : proposal.validUntil
          ? new Date(proposal.validUntil).toISOString()
          : null,
      currency: (proposal.currency as string) || 'USD',
      status: (proposal.status as string) || 'waiting',
      total: Number(proposal.total ?? 0),
      body: (proposal.body as string) || (proposal.description as string) || '',
      signature,
      declineReason: (proposal.declineReason as string) || null,
    };
  } catch (e) {
    console.error('[getPublicProposal] failed:', e);
    return null;
  }
}

export async function acceptProposal(
  hash: string,
  signatureDataUrl: string,
  signedByName: string,
): Promise<PublicActionResult> {
  if (!isValidPublicHash(hash)) return { success: false, error: 'Invalid link.' };
  if (!signedByName?.trim()) return { success: false, error: 'Please enter your full name.' };
  if (!signatureDataUrl?.startsWith('data:image/')) {
    return { success: false, error: 'Please draw your signature before accepting.' };
  }
  try {
    const { db } = await connectToDatabase();
    const proposal = await db.collection('crm_proposals').findOne({ publicHash: hash });
    if (!proposal) return { success: false, error: 'Proposal not found.' };
    if (proposal.status && proposal.status !== 'waiting') {
      return { success: false, error: `This proposal is already ${proposal.status}.` };
    }

    const meta = await clientMeta();
    const now = new Date();

    await db.collection('crm_proposal_signs').insertOne({
      proposalId: proposal._id,
      userId: proposal.userId,
      signedByName: signedByName.trim().slice(0, 200),
      signatureDataUrl,
      signedAt: now,
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    await db.collection('crm_proposals').updateOne(
      { _id: proposal._id },
      { $set: { status: 'accepted', acceptedAt: now, updatedAt: now } },
    );

    revalidatePath(`/share/proposal/${hash}`);
    return { success: true, message: 'Proposal accepted.' };
  } catch (e) {
    console.error('[acceptProposal] failed:', e);
    return { success: false, error: 'Could not accept proposal.' };
  }
}

export async function declineProposal(
  hash: string,
  reason: string,
): Promise<PublicActionResult> {
  if (!isValidPublicHash(hash)) return { success: false, error: 'Invalid link.' };
  try {
    const { db } = await connectToDatabase();
    const result = await db.collection('crm_proposals').updateOne(
      { publicHash: hash, status: { $in: ['waiting', null, undefined] } },
      {
        $set: {
          status: 'declined',
          declineReason: (reason || '').slice(0, 2000),
          declinedAt: new Date(),
          updatedAt: new Date(),
        },
      },
    );
    if (result.matchedCount === 0) {
      return { success: false, error: 'Proposal is no longer pending.' };
    }
    revalidatePath(`/share/proposal/${hash}`);
    return { success: true, message: 'Proposal declined.' };
  } catch (e) {
    console.error('[declineProposal] failed:', e);
    return { success: false, error: 'Could not decline proposal.' };
  }
}

// ---------------------------------------------------------------------
// Detail loader for PDF rendering.
// ---------------------------------------------------------------------

type PublicProposalDetailItem = {
  name?: string;
  description?: string;
  hsnCode?: string;
  quantity: number;
  rate: number;
  total: number;
};

type PublicProposalDetailCompany = {
  name?: string;
  address?: string;
  email?: string;
  phone?: string;
  taxId?: string;
  logoUrl?: string | null;
};

type PublicProposalDetailRecipient = {
  name?: string;
  email?: string;
  phone?: string;
  address?: string;
  company?: string;
};

type PublicProposalDetail = {
  ok: true;
  proposal: {
    _id: string;
    proposalNumber: string;
    title: string;
    proposalDate: string | null;
    validTill: string | null;
    currency: string;
    status: string;
    description: string;
    note?: string;
    subtotal?: number;
    tax?: number;
    total: number;
    signed: boolean;
    signature: {
      signedByName: string;
      signedAt: string;
      signatureDataUrl: string;
    } | null;
  };
  company: PublicProposalDetailCompany;
  deal: PublicProposalDetailRecipient;
  items: PublicProposalDetailItem[];
};

type PublicProposalDetailResult = PublicProposalDetail | { ok: false; error: string };

export async function getPublicProposalWithDetails(
  hash: string,
): Promise<PublicProposalDetailResult> {
  if (!isValidPublicHash(hash)) return { ok: false, error: 'Invalid link.' };
  try {
    const { db } = await connectToDatabase();
    const { ObjectId } = await import('mongodb');
    const proposal = await db.collection('crm_proposals').findOne({ publicHash: hash });
    if (!proposal) return { ok: false, error: 'Proposal not found.' };

    let company: PublicProposalDetailCompany = {};
    if (proposal.userId) {
      try {
        const settings = await db
          .collection('crm_settings')
          .findOne({ userId: proposal.userId });
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

    // Deal — proposals are typically linked to a deal which references
    // an account/contact. Best-effort: fall back to whatever's stored
    // directly on the proposal.
    let deal: PublicProposalDetailRecipient = {};
    const dealRef = proposal.dealId || proposal.accountId || proposal.contactId;
    if (dealRef) {
      try {
        const id = typeof dealRef === 'string' ? new ObjectId(dealRef) : dealRef;
        const dealDoc =
          (await db.collection('crm_deals').findOne({ _id: id })) ||
          (await db.collection('crm_accounts').findOne({ _id: id })) ||
          (await db.collection('crm_contacts').findOne({ _id: id }));
        if (dealDoc) {
          deal = {
            name:
              (dealDoc.name as string) ||
              (dealDoc.accountName as string) ||
              `${(dealDoc.firstName as string) || ''} ${(dealDoc.lastName as string) || ''}`.trim(),
            email: (dealDoc.email as string) || '',
            phone: (dealDoc.phone as string) || '',
            address: (dealDoc.address as string) || (dealDoc.billingAddress as string) || '',
            company: (dealDoc.company as string) || (dealDoc.accountName as string) || '',
          };
        }
      } catch {
        /* non-fatal */
      }
    }
    if (!deal.name) {
      deal = {
        name: (proposal.clientName as string) || (proposal.toName as string) || '',
        email: (proposal.clientEmail as string) || (proposal.toEmail as string) || '',
        address: (proposal.clientAddress as string) || '',
      };
    }

    let signature: {
      signedByName: string;
      signedAt: string;
      signatureDataUrl: string;
    } | null = null;
    if (proposal.status === 'accepted') {
      const sig = await db
        .collection('crm_proposal_signs')
        .findOne({ proposalId: proposal._id }, { sort: { signedAt: -1 } });
      if (sig) {
        signature = {
          signedByName: (sig.signedByName as string) || '',
          signedAt: sig.signedAt ? new Date(sig.signedAt as Date).toISOString() : '',
          signatureDataUrl: (sig.signatureDataUrl as string) || '',
        };
      }
    }

    const items: PublicProposalDetailItem[] = Array.isArray(proposal.lineItems)
      ? (proposal.lineItems as Array<Record<string, unknown>>).map((li) => ({
          name: (li.name as string) || (li.description as string) || '',
          description: (li.description as string) || '',
          hsnCode: (li.hsnCode as string) || (li.hsn as string) || '',
          quantity: Number(li.quantity ?? li.qty ?? 0),
          rate: Number(li.rate ?? li.unitPrice ?? 0),
          total: Number(
            li.total ??
              li.amount ??
              Number(li.quantity ?? li.qty ?? 0) * Number(li.rate ?? li.unitPrice ?? 0),
          ),
        }))
      : [];

    return {
      ok: true,
      proposal: {
        _id: proposal._id.toString(),
        proposalNumber:
          (proposal.proposalNumber as string) || (proposal.proposalNo as string) || '',
        title: (proposal.title as string) || '',
        proposalDate: proposal.proposalDate
          ? new Date(proposal.proposalDate as Date).toISOString()
          : proposal.createdAt
            ? new Date(proposal.createdAt as Date).toISOString()
            : null,
        validTill: proposal.validTill
          ? new Date(proposal.validTill as Date).toISOString()
          : proposal.validUntil
            ? new Date(proposal.validUntil as Date).toISOString()
            : null,
        currency: (proposal.currency as string) || 'USD',
        status: (proposal.status as string) || 'waiting',
        description:
          (proposal.description as string) ||
          (proposal.body as string) ||
          '',
        note: (proposal.note as string) || (proposal.notes as string) || undefined,
        subtotal:
          proposal.subtotal != null ? Number(proposal.subtotal) : undefined,
        tax: proposal.tax != null ? Number(proposal.tax) : undefined,
        total: Number(proposal.total ?? 0),
        signed: !!signature,
        signature,
      },
      company,
      deal,
      items,
    };
  } catch (e) {
    console.error('[getPublicProposalWithDetails] failed:', e);
    return { ok: false, error: 'Could not load proposal.' };
  }
}
