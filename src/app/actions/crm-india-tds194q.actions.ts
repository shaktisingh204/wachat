'use server';

/**
 * CRM India — TDS u/s 194Q tracker server actions (§6.10).
 *
 * Thin wrappers over `src/lib/india-tax/tds-194q.ts`. RBAC-gated on
 * `crm_tds` (existing key — §194Q is just another section).
 */

import { revalidatePath } from 'next/cache';

import { getSession } from '@/app/actions/user.actions';
import { requirePermission } from '@/lib/rbac-server';
import {
    evaluateTds194qApplicability,
    recordTds194qDeduction,
    trackVendorPurchases,
    type Tds194qApplicability,
    type VendorTrackerResult,
} from '@/lib/india-tax/tds-194q';

type Tds194qStatusResult =
    | { ok: true; data: Tds194qApplicability }
    | { ok: false; error: string };

export async function getTds194qStatus(
    financialYear: string,
): Promise<Tds194qStatusResult> {
    const session = await getSession();
    if (!session?.user) return { ok: false, error: 'Access denied.' };

    const guard = await requirePermission('crm_tds', 'view');
    if (!guard.ok) return { ok: false, error: guard.error };

    try {
        const data = await evaluateTds194qApplicability(
            String(session.user._id),
            financialYear,
        );
        return { ok: true, data };
    } catch (e) {
        const msg = e instanceof Error ? e.message : 'Failed to evaluate §194Q applicability.';
        return { ok: false, error: msg };
    }
}

type Tds194qVendorTrackerResult =
    | { ok: true; data: VendorTrackerResult }
    | { ok: false; error: string };

export async function getTds194qVendorTracker(
    financialYear: string,
): Promise<Tds194qVendorTrackerResult> {
    const session = await getSession();
    if (!session?.user) return { ok: false, error: 'Access denied.' };

    const guard = await requirePermission('crm_tds', 'view');
    if (!guard.ok) return { ok: false, error: guard.error };

    try {
        const data = await trackVendorPurchases(
            String(session.user._id),
            financialYear,
        );
        return { ok: true, data };
    } catch (e) {
        const msg = e instanceof Error ? e.message : 'Failed to load vendor tracker.';
        return { ok: false, error: msg };
    }
}

type MarkTds194qDeductedResult =
    | { ok: true; id: string }
    | { ok: false; error: string };

export async function markTds194qDeducted(
    billId: string,
    amount: number,
): Promise<MarkTds194qDeductedResult> {
    const session = await getSession();
    if (!session?.user) return { ok: false, error: 'Access denied.' };

    const guard = await requirePermission('crm_tds', 'create');
    if (!guard.ok) return { ok: false, error: guard.error };

    try {
        const res = await recordTds194qDeduction(
            String(session.user._id),
            billId,
            amount,
        );
        revalidatePath('/dashboard/crm/tax/tds-194q');
        return { ok: true, id: res.id };
    } catch (e) {
        const msg = e instanceof Error ? e.message : 'Failed to record §194Q deduction.';
        return { ok: false, error: msg };
    }
}
