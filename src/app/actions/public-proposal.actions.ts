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

export type PublicProposalView = {
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

export type PublicActionResult =
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
