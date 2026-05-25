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
  invoiceHash?: string | null;
} | null;

export type PublicActionResult =
  | { success: true; message?: string; invoiceHash?: string }
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

    let signature: {
      signedByName: string;
      signedAt: string;
      signatureDataUrl: string;
    } | null = null;
    let invoiceHash: string | null = null;
    if (estimate.status === 'accepted') {
      const invoice = await db.collection('crm_invoices').findOne(
        { sourceEstimateId: estimate._id },
        { sort: { createdAt: -1 } }
      );
      if (invoice && invoice.publicHash) {
        invoiceHash = invoice.publicHash;
      }
      const sig = await db
        .collection('accept_estimates')
        .findOne({ estimateId: estimate._id }, { sort: { signedAt: -1 } });
      if (sig) {
        signature = {
          signedByName: (sig.signedByName as string) || '',
          signedAt: sig.signedAt ? new Date(sig.signedAt).toISOString() : '',
          signatureDataUrl: (sig.signatureDataUrl as string) || '',
        };
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
      signature,
      declineReason: (estimate.declineReason as string) || null,
      invoiceHash,
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
    let invoiceHash: string | undefined = undefined;
    try {
      invoiceHash = generatePublicHash();
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
        publicHash: invoiceHash,
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
    return { success: true, message: 'Estimate accepted. An invoice has been generated.', invoiceHash };
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

// ---------------------------------------------------------------------
// Detail loader for PDF rendering.
// ---------------------------------------------------------------------

export type PublicEstimateDetailItem = {
  name?: string;
  description?: string;
  hsnCode?: string;
  quantity: number;
  rate: number;
  total: number;
};

export type PublicEstimateDetailCompany = {
  name?: string;
  address?: string;
  email?: string;
  phone?: string;
  taxId?: string;
  logoUrl?: string | null;
};

export type PublicEstimateDetailClient = {
  name?: string;
  email?: string;
  phone?: string;
  address?: string;
  taxId?: string;
};

export type PublicEstimateDetail = {
  ok: true;
  estimate: {
    _id: string;
    estimateNumber: string;
    estimateDate: string | null;
    validTill: string | null;
    currency: string;
    status: string;
    subtotal: number;
    tax?: number;
    discount?: number;
    total: number;
    notes?: string;
    termsAndConditions?: string[];
    signed: boolean;
    signature: {
      signedByName: string;
      signedAt: string;
      signatureDataUrl: string;
    } | null;
  };
  company: PublicEstimateDetailCompany;
  client: PublicEstimateDetailClient;
  items: PublicEstimateDetailItem[];
};

export type PublicEstimateDetailResult = PublicEstimateDetail | { ok: false; error: string };

export async function getPublicEstimateWithDetails(
  hash: string,
): Promise<PublicEstimateDetailResult> {
  if (!isValidPublicHash(hash)) return { ok: false, error: 'Invalid link.' };
  try {
    const { db } = await connectToDatabase();
    const { ObjectId } = await import('mongodb');
    const estimate = await db.collection('crm_estimates').findOne({ publicHash: hash });
    if (!estimate) return { ok: false, error: 'Estimate not found.' };

    let company: PublicEstimateDetailCompany = {};
    if (estimate.userId) {
      try {
        const settings = await db
          .collection('crm_settings')
          .findOne({ userId: estimate.userId });
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

    let client: PublicEstimateDetailClient = {};
    if (estimate.accountId) {
      try {
        const accountId =
          typeof estimate.accountId === 'string'
            ? new ObjectId(estimate.accountId)
            : estimate.accountId;
        const account = await db.collection('crm_accounts').findOne({ _id: accountId });
        if (account) {
          client = {
            name: (account.name as string) || (account.accountName as string) || '',
            email: (account.email as string) || '',
            phone: (account.phone as string) || '',
            address: (account.billingAddress as string) || (account.address as string) || '',
            taxId: (account.gstin as string) || (account.taxId as string) || '',
          };
        }
      } catch {
        /* non-fatal */
      }
    }

    let signature: {
      signedByName: string;
      signedAt: string;
      signatureDataUrl: string;
    } | null = null;
    if (estimate.status === 'accepted') {
      const sig = await db
        .collection('accept_estimates')
        .findOne({ estimateId: estimate._id }, { sort: { signedAt: -1 } });
      if (sig) {
        signature = {
          signedByName: (sig.signedByName as string) || '',
          signedAt: sig.signedAt ? new Date(sig.signedAt as Date).toISOString() : '',
          signatureDataUrl: (sig.signatureDataUrl as string) || '',
        };
      }
    }

    const items: PublicEstimateDetailItem[] = Array.isArray(estimate.lineItems)
      ? (estimate.lineItems as Array<Record<string, unknown>>).map((li) => ({
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
      estimate: {
        _id: estimate._id.toString(),
        estimateNumber:
          (estimate.estimateNumber as string) || (estimate.estimateNo as string) || '',
        estimateDate: estimate.estimateDate
          ? new Date(estimate.estimateDate as Date).toISOString()
          : estimate.createdAt
            ? new Date(estimate.createdAt as Date).toISOString()
            : null,
        validTill: estimate.validTill
          ? new Date(estimate.validTill as Date).toISOString()
          : estimate.validUntil
            ? new Date(estimate.validUntil as Date).toISOString()
            : null,
        currency: (estimate.currency as string) || 'USD',
        status: (estimate.status as string) || 'waiting',
        subtotal: Number(estimate.subtotal ?? estimate.subTotal ?? estimate.total ?? 0),
        tax: estimate.tax != null ? Number(estimate.tax) : undefined,
        discount: estimate.discount != null ? Number(estimate.discount) : undefined,
        total: Number(estimate.total ?? 0),
        notes: (estimate.notes as string) || undefined,
        termsAndConditions: Array.isArray(estimate.termsAndConditions)
          ? (estimate.termsAndConditions as string[])
          : undefined,
        signed: !!signature,
        signature,
      },
      company,
      client,
      items,
    };
  } catch (e) {
    console.error('[getPublicEstimateWithDetails] failed:', e);
    return { ok: false, error: 'Could not load estimate.' };
  }
}

