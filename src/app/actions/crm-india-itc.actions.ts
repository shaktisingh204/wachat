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

import { getSession } from '@/app/actions/user.actions';
import { requirePermission } from '@/lib/rbac-server';
import {
    computeBookItc,
    reconcileItcWithGstr2b,
    type BookItcResult,
    type ItcReconciliationError,
    type ItcReconciliationResult,
} from '@/lib/india-tax/itc-ledger';

export type GetBookItcResult =
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

export type GetItcReconciliationResult =
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
