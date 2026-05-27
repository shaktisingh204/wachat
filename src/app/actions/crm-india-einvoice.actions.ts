'use server';

/**
 * CRM India e-invoice (IRN) server actions (§6.10).
 *
 * Generates / cancels / reads the IRN block on a `crm_invoices` doc via
 * the pluggable adapter in `src/lib/india-tax/e-invoice-providers.ts`.
 *
 * Provider selection:
 *   1. Read the tenant's selected `eInvoiceProvider` from
 *      `crm_india_tax_credentials`. Default → `internal`.
 *   2. Resolve decrypted creds via `getTenantIrpCredentials`. If `null`,
 *      we still call the provider — `InternalProvider` ignores creds;
 *      external providers throw "not configured" which we surface to the UI.
 *
 * Gated `requirePermission('crm_invoice', 'edit')` for mutating ops,
 * `'view'` for reads. Audit-logged via `writeAuditEntry`.
 *
 * IRN is NEVER auto-generated on invoice save — only via these actions.
 */

import { revalidatePath } from 'next/cache';
import { ObjectId } from 'mongodb';

import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';
import { writeAuditEntry } from '@/lib/audit-log';
import { requirePermission } from '@/lib/rbac-server';
import { getErrorMessage } from '@/lib/utils';
import {
    getEInvoiceProvider,
    type EInvoiceRequest,
    type EInvoiceResponse,
} from '@/lib/india-tax/e-invoice-providers';
import {
    getTenantIrpCredentials,
    getTenantProviderIds,
} from '@/lib/india-tax/credentials';

// ──────────────────────────────────────────────────────────────────
// Persisted shape (sub-doc on `crm_invoices.eInvoice`)
// ──────────────────────────────────────────────────────────────────

interface InvoiceEInvoiceBlock {
    irn: string;
    ackNo: string;
    ackDate: string;
    qrCodeData: string;
    signedInvoice: string;
    status: 'success' | 'failed';
    provider: string;
    generatedAt: Date;
    cancelled?: boolean;
    cancelReason?: string;
    cancelledAt?: Date;
    /** Trimmed copy of the raw provider response (for debugging). */
    rawResponse?: unknown;
}

// ──────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────

function ok<T>(data: T): { ok: true; data: T } {
    return { ok: true, data };
}
function fail(error: string): { ok: false; error: string } {
    return { ok: false, error };
}

async function loadInvoice(tenantUserId: string, invoiceId: string) {
    if (!ObjectId.isValid(invoiceId)) return null;
    const { db } = await connectToDatabase();
    const doc = await db.collection('crm_invoices').findOne({
        _id: new ObjectId(invoiceId),
        userId: new ObjectId(tenantUserId),
    });
    return doc;
}

function buildEInvoiceRequest(invoiceDoc: any, sellerGstin: string): EInvoiceRequest {
    return {
        invoiceId: String(invoiceDoc._id),
        sellerGstin,
        buyerGstin: invoiceDoc?.billing?.gstin || invoiceDoc?.buyerGstin || undefined,
        invoiceNumber: String(invoiceDoc.invoiceNumber ?? ''),
        invoiceDate:
            invoiceDoc.invoiceDate instanceof Date
                ? invoiceDoc.invoiceDate.toISOString().slice(0, 10)
                : String(invoiceDoc.invoiceDate ?? ''),
        totalValue: Number(invoiceDoc.total ?? 0),
        currency: invoiceDoc.currency || 'INR',
        raw: {
            lineItems: invoiceDoc.lineItems ?? [],
            subtotal: invoiceDoc.subtotal,
            notes: invoiceDoc.notes,
        },
    };
}

// ──────────────────────────────────────────────────────────────────
// Public actions
// ──────────────────────────────────────────────────────────────────

export async function generateIrn(
    invoiceId: string,
): Promise<
    | { ok: true; data: InvoiceEInvoiceBlock }
    | { ok: false; error: string }
> {
    const session = await getSession();
    if (!session?.user) return fail('Authentication required.');

    const guard = await requirePermission('crm_invoice', 'edit');
    if (!guard.ok) return fail(guard.error);

    try {
        const tenantUserId = String(session.user._id);
        const invoice = await loadInvoice(tenantUserId, invoiceId);
        if (!invoice) return fail('Invoice not found.');
        if (invoice.eInvoice?.irn && invoice.eInvoice?.cancelled !== true) {
            return fail('IRN already generated for this invoice.');
        }

        const providerIds = await getTenantProviderIds(tenantUserId);
        const credentials = await getTenantIrpCredentials(tenantUserId);
        const sellerGstin = credentials?.gstin || invoice?.seller?.gstin || '';
        if (!sellerGstin) return fail('Seller GSTIN is not configured.');

        const provider = getEInvoiceProvider(providerIds.eInvoice);
        const req = buildEInvoiceRequest(invoice, sellerGstin);

        let resp: EInvoiceResponse;
        try {
            resp = await provider.generate(req, credentials);
        } catch (e: any) {
            return fail(getErrorMessage(e));
        }

        const block: InvoiceEInvoiceBlock = {
            irn: resp.irn,
            ackNo: resp.ackNo,
            ackDate: resp.ackDate,
            qrCodeData: resp.qrCodeData,
            signedInvoice: resp.signedInvoice,
            status: resp.status,
            provider: provider.id,
            generatedAt: new Date(),
            rawResponse: resp.rawResponse,
        };

        const { db } = await connectToDatabase();
        await db.collection('crm_invoices').updateOne(
            { _id: new ObjectId(invoiceId), userId: new ObjectId(tenantUserId) },
            { $set: { eInvoice: block, updatedAt: new Date() } },
        );

        await writeAuditEntry({
            tenantUserId,
            action: 'send',
            entityKind: 'invoice',
            entityId: invoiceId,
            reason: `IRN generated via ${provider.id}`,
            diff: { eInvoice: { before: invoice.eInvoice ?? null, after: { irn: block.irn, ackNo: block.ackNo } } },
        });

        revalidatePath(`/dashboard/crm/sales/invoices/${invoiceId}`);
        revalidatePath(`/dashboard/crm/sales/invoices/${invoiceId}/e-invoice`);
        return ok(block);
    } catch (e: any) {
        console.error('[generateIrn] failed:', e);
        return fail(getErrorMessage(e));
    }
}

export async function cancelIrn(
    invoiceId: string,
    reason: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
    const session = await getSession();
    if (!session?.user) return fail('Authentication required.');

    const guard = await requirePermission('crm_invoice', 'edit');
    if (!guard.ok) return fail(guard.error);

    try {
        const tenantUserId = String(session.user._id);
        const invoice = await loadInvoice(tenantUserId, invoiceId);
        if (!invoice) return fail('Invoice not found.');
        if (!invoice.eInvoice?.irn) return fail('No IRN to cancel.');
        if (invoice.eInvoice?.cancelled) return fail('IRN is already cancelled.');

        const providerIds = await getTenantProviderIds(tenantUserId);
        const credentials = await getTenantIrpCredentials(tenantUserId);
        const provider = getEInvoiceProvider(invoice.eInvoice.provider || providerIds.eInvoice);

        try {
            const r = await provider.cancel(invoice.eInvoice.irn, reason, credentials);
            if (!r.ok) return fail(r.error || 'Cancel failed at provider.');
        } catch (e: any) {
            return fail(getErrorMessage(e));
        }

        const { db } = await connectToDatabase();
        const cancelledAt = new Date();
        await db.collection('crm_invoices').updateOne(
            { _id: new ObjectId(invoiceId), userId: new ObjectId(tenantUserId) },
            {
                $set: {
                    'eInvoice.cancelled': true,
                    'eInvoice.cancelReason': reason,
                    'eInvoice.cancelledAt': cancelledAt,
                    updatedAt: new Date(),
                },
            },
        );

        await writeAuditEntry({
            tenantUserId,
            action: 'void',
            entityKind: 'invoice',
            entityId: invoiceId,
            reason: `IRN cancelled: ${reason}`,
        });

        revalidatePath(`/dashboard/crm/sales/invoices/${invoiceId}`);
        revalidatePath(`/dashboard/crm/sales/invoices/${invoiceId}/e-invoice`);
        return { ok: true };
    } catch (e: any) {
        console.error('[cancelIrn] failed:', e);
        return fail(getErrorMessage(e));
    }
}

export async function getEInvoiceForInvoice(
    invoiceId: string,
): Promise<InvoiceEInvoiceBlock | null> {
    const session = await getSession();
    if (!session?.user) return null;

    const guard = await requirePermission('crm_invoice', 'view');
    if (!guard.ok) return null;

    try {
        const tenantUserId = String(session.user._id);
        const invoice = await loadInvoice(tenantUserId, invoiceId);
        if (!invoice) return null;
        const block = invoice.eInvoice as InvoiceEInvoiceBlock | undefined;
        return block ? JSON.parse(JSON.stringify(block)) : null;
    } catch (e) {
        console.error('[getEInvoiceForInvoice] failed:', e);
        return null;
    }
}
