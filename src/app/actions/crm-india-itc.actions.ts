'use server';

/**
 * CRM India — ITC ledger + GSTR-2B reconciliation server actions
 * (§6.10). Thin wrappers over `src/lib/india-tax/itc-ledger.ts` —
 * adds session + RBAC gating.
 *
 * Gated on `crm_gst` (new in §6.10a). Until the §6.10a permission
 * registration ships, owner roles still pass via the open-by-default
 * policy in `rbac.ts`.
 */

import { revalidatePath } from 'next/cache';
import { ObjectId } from 'mongodb';

import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';
import { requirePermission } from '@/lib/rbac-server';
import { writeAuditEntry } from '@/lib/audit-log';
import {
    computeBookItc,
    reconcileItcWithGstr2b,
    type BookItcResult,
    type ItcReconciliationError,
    type ItcReconciliationResult,
} from '@/lib/india-tax/itc-ledger';

type GetBookItcResult =
    | { ok: true; data: BookItcResult }
    | { ok: false; error: string };

export async function getBookItc(period: string): Promise<GetBookItcResult> {
    const session = await getSession();
    if (!session?.user) return { ok: false, error: 'Access denied.' };

    const guard = await requirePermission('crm_gst', 'view');
    if (!guard.ok) return { ok: false, error: guard.error };

    try {
        const data = await computeBookItc(String(session.user._id), period);
        return { ok: true, data };
    } catch (e) {
        const msg = e instanceof Error ? e.message : 'Failed to compute book ITC.';
        return { ok: false, error: msg };
    }
}

type GetItcReconciliationResult =
    | { ok: true; data: ItcReconciliationResult }
    | { ok: false; error: string; needsImport?: boolean };

export async function getItcReconciliation(
    period: string,
): Promise<GetItcReconciliationResult> {
    const session = await getSession();
    if (!session?.user) return { ok: false, error: 'Access denied.' };

    const guard = await requirePermission('crm_gst', 'view');
    if (!guard.ok) return { ok: false, error: guard.error };

    try {
        const res = await reconcileItcWithGstr2b(
            String(session.user._id),
            period,
        );
        if ((res as ItcReconciliationError).error === 'gstr2b_import_required') {
            return {
                ok: false,
                error: 'No GSTR-2B has been imported for this period yet.',
                needsImport: true,
            };
        }
        return { ok: true, data: res as ItcReconciliationResult };
    } catch (e) {
        const msg = e instanceof Error ? e.message : 'Failed to reconcile ITC.';
        return { ok: false, error: msg };
    }
}

/* ─── Bulk reconcile ─────────────────────────────────────────────── */

interface BulkReconcileInput {
    /** Pairs of (supplierGstin, invoiceNumber) to move from onlyInBooks → matched. */
    invoices: Array<{ supplierGstin: string | null; invoiceNumber: string }>;
    period: string;
}

type BulkReconcileResult =
    | { ok: true; reconciled: number }
    | { ok: false; error: string };

/**
 * Marks `crm_bills` rows as "manually reconciled" for the given period by
 * stamping `itcManuallyReconciled: true` + `itcReconciledPeriod` on each
 * matching bill. This lets the UI collapse them into the Matched section on
 * the next reload without touching GSTR-2B data.
 */
export async function bulkReconcileMismatched(
    input: BulkReconcileInput,
): Promise<BulkReconcileResult> {
    const session = await getSession();
    if (!session?.user) return { ok: false, error: 'Access denied.' };

    const guard = await requirePermission('crm_gst', 'edit');
    if (!guard.ok) return { ok: false, error: guard.error };

    if (!input.invoices.length) return { ok: true, reconciled: 0 };

    try {
        const tenantUserId = String(session.user._id);
        const { db } = await connectToDatabase();

        // Build per-invoice filter clauses
        const orClauses = input.invoices.map((inv) => ({
            userId: new ObjectId(tenantUserId),
            ...(inv.supplierGstin
                ? { vendorGstin: { $regex: new RegExp(`^${inv.supplierGstin}$`, 'i') } }
                : {}),
            $or: [
                { vendorInvoiceNo: inv.invoiceNumber },
                { billNo: inv.invoiceNumber },
            ],
        }));

        const result = await db.collection('crm_bills').updateMany(
            { $or: orClauses },
            {
                $set: {
                    itcManuallyReconciled: true,
                    itcReconciledPeriod: input.period,
                    itcReconciledAt: new Date(),
                    updatedAt: new Date(),
                },
            },
        );

        try {
            await writeAuditEntry({
                tenantUserId,
                action: 'update',
                entityKind: 'itc_reconciliation',
                entityId: input.period,
                reason: `Bulk manual reconcile: ${result.modifiedCount} bills for period ${input.period}`,
            });
        } catch {
            /* non-fatal */
        }

        revalidatePath('/dashboard/crm/tax/itc');
        return { ok: true, reconciled: result.modifiedCount };
    } catch (e) {
        const msg = e instanceof Error ? e.message : 'Bulk reconcile failed.';
        return { ok: false, error: msg };
    }
}
