/**
 * POST /dashboard/crm/sales/quotations/[quotationId]/convert-to-invoice
 *
 * Server-side handler invoked by the "Convert to Invoice" form on the
 * Quotation detail page. Clones the quotation into a new draft invoice,
 * seeds lineage from the parent quotation, back-links the new invoice
 * onto the quotation, flips the parent quotation's status to
 * `converted`, then redirects to the invoices list.
 *
 * Mirrors the canonical convert pattern used by
 * `convertInvoiceToCreditNote` in `crm-services.actions.ts`.
 */
import { type NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getSession } from '@/app/actions/user.actions';
import { connectToDatabase } from '@/lib/mongodb';
import { getQuotationById } from '@/app/actions/crm-quotations.actions';
import { appendLineage, buildLineageFromParent } from '@/lib/lineage';
import type { LineageRef } from '@/lib/definitions';

export async function POST(
    _request: NextRequest,
    { params }: { params: Promise<{ quotationId: string }> },
) {
    const { quotationId } = await params;

    const session = await getSession();
    if (!session?.user) {
        return NextResponse.redirect(new URL('/login', _request.url));
    }

    if (!quotationId || !ObjectId.isValid(quotationId)) {
        return NextResponse.json({ error: 'Invalid quotation id' }, { status: 400 });
    }

    const quotation = await getQuotationById(quotationId);
    if (!quotation) {
        return NextResponse.json({ error: 'Quotation not found' }, { status: 404 });
    }

    const { db } = await connectToDatabase();

    // Invoice numbering: no shared `generateInvoiceNumber` helper exists
    // in `crm-invoices.actions.ts`; the manual `saveInvoice` flow takes
    // the number from the form. Fall back to the same timestamp pattern
    // already used by the deal→invoice converter in
    // `worksuite/conversions.actions.ts` so converted invoices stay
    // consistent with sibling auto-conversions.
    // TODO: replace with a per-user sequential helper (e.g.
    // `getNextInvoiceNumber`) once one exists, mirroring quotations'
    // `getNextQuotationNumber`.
    const invoiceNumber = `INV-${Date.now().toString().slice(-6)}`;

    const now = new Date();
    const dueDate = new Date(now);
    dueDate.setDate(dueDate.getDate() + 30);

    // Lineage seeding (crm_function_plan.md §13.5): copy the parent
    // chain and append the quotation itself as the new invoice's
    // lineage.
    const newLineage = buildLineageFromParent({
        kind: 'quotation',
        id: quotation._id.toString(),
        no: quotation.quotationNumber || undefined,
        status: quotation.status || undefined,
        lineage: (quotation.lineage as LineageRef[] | undefined) ?? undefined,
    });

    const newInvoice = {
        userId: new ObjectId(session.user._id),
        accountId: quotation.accountId
            ? new ObjectId(quotation.accountId.toString())
            : null,
        invoiceNumber,
        invoiceDate: now,
        dueDate,
        currency: quotation.currency || 'INR',
        lineItems: Array.isArray(quotation.lineItems) ? quotation.lineItems : [],
        subtotal: typeof quotation.subtotal === 'number' ? quotation.subtotal : 0,
        total: typeof quotation.total === 'number' ? quotation.total : 0,
        notes: quotation.notes || '',
        termsAndConditions: Array.isArray(quotation.termsAndConditions)
            ? quotation.termsAndConditions
            : [],
        status: 'Draft' as const,
        lineage: newLineage,
        createdAt: now,
        updatedAt: now,
        sourceQuotationId: new ObjectId(quotation._id.toString()),
    };

    const insertResult = await db.collection('crm_invoices').insertOne(newInvoice as any);
    const newInvoiceId = insertResult.insertedId.toString();

    // Best-effort back-link: push the new invoice onto the quotation's
    // lineage and flip the quotation's status to `converted`. Failures
    // here are non-fatal — the invoice already exists and the user
    // should land on it. `appendLineage` dedupes by `(kind, id)`.
    try {
        const updatedQuotationLineage = appendLineage(
            (quotation.lineage as LineageRef[] | undefined) ?? undefined,
            {
                kind: 'invoice',
                id: newInvoiceId,
                no: invoiceNumber,
                status: 'Draft',
                createdAt: new Date().toISOString(),
            },
        );
        await db.collection('crm_quotations').updateOne(
            { _id: new ObjectId(quotation._id.toString()) },
            {
                $set: {
                    lineage: updatedQuotationLineage,
                    status: 'converted',
                    updatedAt: new Date(),
                },
            },
        );
    } catch {
        // Non-fatal — the conversion already succeeded.
    }

    revalidatePath('/dashboard/crm/sales/invoices');
    revalidatePath('/dashboard/crm/sales/quotations');
    revalidatePath(`/dashboard/crm/sales/quotations/${quotationId}`);

    // No invoice edit/detail subroute exists yet — list page is the
    // safe fallback per the spec. `redirect` throws internally and is
    // the canonical App Router redirect from a route handler.
    redirect('/dashboard/crm/sales/invoices');
}
