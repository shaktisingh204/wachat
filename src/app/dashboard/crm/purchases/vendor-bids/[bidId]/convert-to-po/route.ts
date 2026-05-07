/**
 * POST /dashboard/crm/purchases/vendor-bids/[bidId]/convert-to-po
 *
 * Server-side handler invoked by the "Convert to PO" form on the
 * vendor-bids list (and any future detail page). Clones the awarded
 * vendor bid into a new draft purchase order, seeds lineage from the
 * bid (and transitively from the parent RFQ), back-links the new PO
 * onto the bid, and redirects to the new PO detail page.
 *
 * Mirrors the canonical convert pattern used by
 * `convert-to-invoice/route.ts` for quotation → invoice. RBAC is
 * enforced by the surrounding Next.js BFF layout/middleware (the form
 * action is a same-origin POST, so the session cookie is sent and
 * `getSession()` gates access).
 */
import { type NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getSession } from '@/app/actions/user.actions';
import { connectToDatabase } from '@/lib/mongodb';
import { getVendorBidById } from '@/app/actions/crm-vendor-bids.actions';
import { appendLineage, buildLineageFromParent } from '@/lib/lineage';
import type { CrmRfq, LineageRef } from '@/lib/definitions';

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ bidId: string }> },
) {
    const { bidId } = await params;

    const session = await getSession();
    if (!session?.user) {
        return NextResponse.redirect(new URL('/login', request.url));
    }

    if (!bidId || !ObjectId.isValid(bidId)) {
        return NextResponse.redirect(
            new URL(
                '/dashboard/crm/purchases/vendor-bids?error=Invalid%20bid%20id',
                request.url,
            ),
        );
    }

    try {
        const bid = await getVendorBidById(bidId);
        if (!bid) {
            return NextResponse.redirect(
                new URL(
                    '/dashboard/crm/purchases/vendor-bids?error=Bid%20not%20found',
                    request.url,
                ),
            );
        }

        const { db } = await connectToDatabase();

        // Best-effort RFQ load — used only to surface a richer back-link
        // and (transitively) to ensure the new PO's lineage chain
        // already includes the RFQ via the bid's own lineage. Bids are
        // always seeded from their RFQ (see saveVendorBid), so the bid's
        // `lineage` already carries the RFQ ref.
        let parentRfq: CrmRfq | null = null;
        if (bid.rfqId) {
            try {
                parentRfq = (await db.collection<CrmRfq>('crm_rfqs').findOne({
                    _id: new ObjectId(bid.rfqId.toString()),
                    userId: new ObjectId(session.user._id),
                })) as CrmRfq | null;
            } catch {
                // non-fatal — the PO conversion can proceed without the
                // parent RFQ; lineage already includes it via the bid.
            }
        }

        const now = new Date();
        const poNumber = `PO-${Date.now().toString().slice(-6)}`;

        // Lineage seeding (crm_function_plan.md §13.5): copy the bid's
        // chain (which already carries the RFQ ref) and append the bid
        // itself as the new PO's lineage parent.
        const newLineage: LineageRef[] = buildLineageFromParent({
            kind: 'vendorBid',
            id: bid._id.toString(),
            no: parentRfq?.title || bid._id.toString(),
            status: bid.status,
            lineage: (bid.lineage as LineageRef[] | undefined) ?? undefined,
        });

        // Map bid items → PO line items. CrmVendorBid.items reference
        // catalogue items by id; CrmPurchaseOrder.lineItems wants a
        // free-text description. Use the itemId string as a stable
        // placeholder — the user can rename in the PO editor.
        const lineItems = (Array.isArray(bid.items) ? bid.items : []).map((it) => {
            const quantity = Number(it.qty) || 0;
            const rate = Number(it.rate) || 0;
            return {
                description: it.itemId ? it.itemId.toString() : '',
                quantity,
                rate,
                amount: quantity * rate,
            };
        });

        const total = lineItems.reduce((s, l) => s + l.amount, 0);

        const newPo = {
            userId: new ObjectId(session.user._id),
            vendorId: new ObjectId(bid.vendorId.toString()),
            orderNumber: poNumber,
            orderDate: now,
            currency: bid.currency || 'INR',
            lineItems,
            total,
            ...(bid.terms ? { paymentTerms: bid.terms } : {}),
            status: 'Draft' as const,
            lineage: newLineage,
            createdAt: now,
            updatedAt: now,
        };

        const insertResult = await db
            .collection('crm_purchase_orders')
            .insertOne(newPo as any);
        const newPoId = insertResult.insertedId.toString();

        // Best-effort back-link: push the new PO onto the bid's lineage.
        // Failures are non-fatal — the PO already exists.
        try {
            const updatedBidLineage = appendLineage(
                (bid.lineage as LineageRef[] | undefined) ?? undefined,
                {
                    kind: 'purchaseOrder',
                    id: newPoId,
                    no: poNumber,
                    status: 'Draft',
                    createdAt: new Date().toISOString(),
                },
            );
            await db.collection('crm_vendor_bids').updateOne(
                { _id: new ObjectId(bid._id.toString()) },
                { $set: { lineage: updatedBidLineage, updatedAt: new Date() } },
            );
        } catch {
            // Non-fatal — the conversion already succeeded.
        }

        revalidatePath('/dashboard/crm/purchases/orders');
        revalidatePath('/dashboard/crm/purchases/vendor-bids');

        // `redirect` throws internally — must run outside the try/catch
        // so its NEXT_REDIRECT signal isn't swallowed.
        redirect(`/dashboard/crm/purchases/orders/${newPoId}`);
    } catch (e: unknown) {
        // Re-throw redirect signals so Next.js can handle them.
        if (
            e &&
            typeof e === 'object' &&
            'digest' in e &&
            typeof (e as { digest?: unknown }).digest === 'string' &&
            ((e as { digest: string }).digest as string).startsWith('NEXT_REDIRECT')
        ) {
            throw e;
        }
        const msg = e instanceof Error ? e.message : 'Failed to convert bid to PO';
        return NextResponse.redirect(
            new URL(
                `/dashboard/crm/purchases/vendor-bids?error=${encodeURIComponent(msg)}`,
                request.url,
            ),
        );
    }
}
