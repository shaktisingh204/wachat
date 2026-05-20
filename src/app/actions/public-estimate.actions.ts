'use server';

/**
 * Public estimate actions — back `/share/estimate/[hash]`.
 *
 * Collections:
 *   crm_estimates       — read by publicHash, status transitions
 *   accept_estimates    — signature record on accept
 *   crm_invoices        — auto-created on accept (status='Unpaid',
 *                         lineage reference to the source estimate)
 */

import { ObjectId } from 'mongodb';
import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { connectToDatabase } from '@/lib/mongodb';
import { generatePublicHash, isValidPublicHash } from '@/lib/public-hash';

export type PublicEstimateView = {
  _id: string;
  estimateNumber: string;
  validTill: string | null;
  currency: string;
  status: string;
  total: number;
  notes?: string;
  lineItems: Array<{
    description?: string;
    quantity: number;
    rate: number;
    total: number;
  }>;
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

export async function getPublicEstimate(hash: string): Promise<PublicEstimateView> {
  if (!isValidPublicHash(hash)) return null;
  try {
    const { db } = await connectToDatabase();
    const estimate = await db.collection('crm_estimates').findOne({ publicHash: hash });
    if (!estimate) return null;

    let signature: PublicEstimateView extends infer T ? T : never = null;
    if (estimate.status === 'accepted') {
      const sig = await db
        .collection('accept_estimates')
        .findOne({ estimateId: estimate._id }, { sort: { signedAt: -1 } });
      if (sig) {
        signature = {
          signedByName: (sig.signedByName as string) || '',
          signedAt: sig.signedAt ? new Date(sig.signedAt).toISOString() : '',
          signatureDataUrl: (sig.signatureDataUrl as string) || '',
        } as never;
      }
    }

    return {
      _id: estimate._id.toString(),
      estimateNumber:
        (estimate.estimateNumber as string) || (estimate.estimateNo as string) || '',
      validTill: estimate.validTill
        ? new Date(estimate.validTill).toISOString()
        : estimate.validUntil
          ? new Date(estimate.validUntil).toISOString()
          : null,
      currency: (estimate.currency as string) || 'USD',
      status: (estimate.status as string) || 'waiting',
      total: Number(estimate.total ?? 0),
      notes: estimate.notes as string | undefined,
      lineItems: Array.isArray(estimate.lineItems)
        ? estimate.lineItems.map((li: Record<string, unknown>) => ({
            description: (li.description as string) || (li.name as string),
            quantity: Number(li.quantity ?? li.qty ?? 0),
            rate: Number(li.rate ?? 0),
            total: Number(li.total ?? Number(li.quantity ?? 0) * Number(li.rate ?? 0)),
          }))
        : [],
      signature: signature ?? null,
      declineReason: (estimate.declineReason as string) || null,
    };
  } catch (e) {
    console.error('[getPublicEstimate] failed:', e);
    return null;
  }
}

export async function acceptEstimate(
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
    const estimate = await db.collection('crm_estimates').findOne({ publicHash: hash });
    if (!estimate) return { success: false, error: 'Estimate not found.' };
    if (estimate.status && estimate.status !== 'waiting') {
      return { success: false, error: `This estimate is already ${estimate.status}.` };
    }

    const meta = await clientMeta();
    const now = new Date();

    await db.collection('accept_estimates').insertOne({
      estimateId: estimate._id,
      userId: estimate.userId,
      signedByName: signedByName.trim().slice(0, 200),
      signatureDataUrl,
      signedAt: now,
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    await db.collection('crm_estimates').updateOne(
      { _id: estimate._id },
      { $set: { status: 'accepted', acceptedAt: now, updatedAt: now } },
    );

    // Auto-create invoice. We mirror essential estimate fields so the
    // generated invoice is usable from /dashboard immediately. A
    // lineage ref is set so the invoice tracks back to the estimate.
    try {
      await db.collection('crm_invoices').insertOne({
        userId: estimate.userId,
        accountId: estimate.accountId,
        invoiceNumber: `INV-${Date.now().toString().slice(-6)}`,
        invoiceDate: now,
        currency: estimate.currency || 'USD',
        lineItems: estimate.lineItems || [],
        subtotal: Number(estimate.subtotal ?? estimate.total ?? 0),
        total: Number(estimate.total ?? 0),
        notes: estimate.notes || '',
        status: 'Unpaid',
        publicHash: generatePublicHash(),
        lineage: [
          {
            kind: 'estimate',
            id: estimate._id.toString(),
            no: (estimate.estimateNumber as string) || '',
            status: 'accepted',
          },
        ],
        sourceEstimateId: estimate._id,
        createdAt: now,
        updatedAt: now,
      });
    } catch (e) {
      console.error('[acceptEstimate] invoice auto-create failed (non-fatal):', e);
    }

    revalidatePath(`/share/estimate/${hash}`);
    return { success: true, message: 'Estimate accepted. An invoice has been generated.' };
  } catch (e) {
    console.error('[acceptEstimate] failed:', e);
    return { success: false, error: 'Could not accept estimate.' };
  }
}

export async function declineEstimate(
  hash: string,
  reason: string,
): Promise<PublicActionResult> {
  if (!isValidPublicHash(hash)) return { success: false, error: 'Invalid link.' };
  try {
    const { db } = await connectToDatabase();
    const result = await db.collection('crm_estimates').updateOne(
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
      return { success: false, error: 'Estimate is no longer pending.' };
    }
    revalidatePath(`/share/estimate/${hash}`);
    return { success: true, message: 'Estimate declined.' };
  } catch (e) {
    console.error('[declineEstimate] failed:', e);
    return { success: false, error: 'Could not decline estimate.' };
  }
}

// silence unused-id warning at compile
void ObjectId;
