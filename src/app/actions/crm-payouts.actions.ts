'use server';

/**
 * CRM Payout server actions.
 *
 * **Dual implementation:**
 *  - When `USE_RUST_CRM === 'true'`, reads and the create path delegate
 *    to the Rust BFF (`/v1/crm/payouts`) via
 *    `src/lib/rust-client/crm-payouts.ts`.
 *  - Otherwise (default), the legacy direct-Mongo path runs.
 *
 * Export shapes are identical across both paths so existing pages keep
 * working without changes.
 *
 * Note: `savePayout` currently only handles creates (no edit form in the
 * legacy UI). The Rust `update` endpoint is available for when an edit
 * flow is added later.
 */

import { revalidatePath } from 'next/cache';
import { type Db, ObjectId, type WithId, Filter } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';
import type { CrmPayout, LineageKind, LineageRef } from '@/lib/definitions';
import { getErrorMessage } from '@/lib/utils';
import { appendLineage, buildLineageFromParent } from '@/lib/lineage';
import { writeAuditEntry } from '@/lib/audit-log';
import { requirePermission } from '@/lib/rbac-server';
import { crmPayoutsApi } from '@/lib/rust-client/crm-payouts';
import { RustApiError } from '@/lib/rust-client/fetcher';
import { recordRustFallback } from '@/lib/observability/rust-fallback-counter';

function useRustCrm(): boolean {
    return process.env.USE_RUST_CRM === 'true';
}

export async function getPayoutById(payoutId: string): Promise<WithId<CrmPayout> | null> {
    const session = await getSession();
    if (!session?.user) return null;

    if (useRustCrm()) {
        try {
            const doc = await crmPayoutsApi.getById(payoutId);
            return doc ? (JSON.parse(JSON.stringify(doc)) as WithId<CrmPayout>) : null;
        } catch (e) {
            console.error('[getPayoutById] rust path failed; falling back:', e);
            recordRustFallback({
                entity: 'payout',
                op: 'get',
                errorCode: e instanceof RustApiError ? e.code : undefined,
                status: e instanceof RustApiError ? e.status : undefined,
            });
            // fall through
        }
    }

    if (!ObjectId.isValid(payoutId)) return null;
    try {
        const { db } = await connectToDatabase();
        const payout = await db.collection<CrmPayout>('crm_payouts').findOne({
            _id: new ObjectId(payoutId),
            userId: new ObjectId(session.user._id),
        });
        if (!payout) return null;
        return JSON.parse(JSON.stringify(payout));
    } catch (e) {
        console.error('Failed to fetch payout by id:', e);
        return null;
    }
}

export async function getPayouts(
    page: number = 1,
    limit: number = 20,
    query?: string
): Promise<{ payouts: WithId<CrmPayout>[], total: number }> {
    const session = await getSession();
    if (!session?.user) return { payouts: [], total: 0 };

    if (useRustCrm()) {
        try {
            const docs = await crmPayoutsApi.list({ page: page - 1, limit, q: query });
            return {
                payouts: JSON.parse(JSON.stringify(docs)) as WithId<CrmPayout>[],
                total: docs.length,
            };
        } catch (e) {
            console.error('[getPayouts] rust path failed; falling back:', e);
            recordRustFallback({
                entity: 'payout',
                op: 'list',
                errorCode: e instanceof RustApiError ? e.code : undefined,
                status: e instanceof RustApiError ? e.status : undefined,
            });
            // fall through
        }
    }

    try {
        const { db } = await connectToDatabase();
        const userObjectId = new ObjectId(session.user._id);

        const filter: any = { userId: userObjectId };

        const skip = (page - 1) * limit;

        const [payouts, total] = await Promise.all([
            db.collection<CrmPayout>('crm_payouts')
                .find(filter as any)
                .sort({ paymentDate: -1 })
                .skip(skip)
                .limit(limit)
                .toArray(),
            db.collection('crm_payouts').countDocuments(filter as any)
        ]);

        return {
            payouts: JSON.parse(JSON.stringify(payouts)),
            total
        };
    } catch (e: any) {
        console.error("Failed to fetch CRM payouts:", e);
        return { payouts: [], total: 0 };
    }
}

export async function savePayout(prevState: any, formData: FormData): Promise<{ message?: string; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: 'Access denied' };

    const guard = await requirePermission('crm_payout', 'create');
    if (!guard.ok) return { error: guard.error };

    if (useRustCrm()) {
        try {
            const vendorIdRaw = formData.get('vendorId') as string | null;
            const amount = parseFloat(formData.get('amount') as string);
            const paymentDate = formData.get('paymentDate') as string | null;

            if (!vendorIdRaw || !amount || !paymentDate) {
                throw new Error('missing required fields');
            }

            await crmPayoutsApi.create({
                paymentNo: (formData.get('referenceNumber') as string | null) || '',
                date: paymentDate,
                vendorId: vendorIdRaw,
                mode: ((formData.get('paymentMode') as string | null) || 'neft') as any,
                bankAccountId: (formData.get('bankAccountId') as string | null) || '',
                amount,
                currency: (formData.get('currency') as string | null) || 'INR',
                txnId: (formData.get('referenceNumber') as string | null) || undefined,
                notes: (formData.get('notes') as string | null) || undefined,
                fromKind: ((formData.get('fromKind') as string | null) === 'bill'
                    ? 'bill'
                    : undefined),
                fromId: (formData.get('fromId') as string | null) || undefined,
            });

            revalidatePath('/dashboard/crm/purchases/payouts');
            return { message: 'Payout recorded successfully.' };
        } catch (e) {
            console.error('[savePayout] rust path failed; falling back:', e);
            recordRustFallback({
                entity: 'payout',
                op: 'create',
                errorCode: e instanceof RustApiError ? e.code : undefined,
                status: e instanceof RustApiError ? e.status : undefined,
            });
            // fall through
        }
    }

    try {
        const { db } = await connectToDatabase();
        const userObjectId = new ObjectId(session.user._id);

        const payoutData: Omit<CrmPayout, '_id' | 'createdAt' | 'updatedAt'> = {
            userId: userObjectId,
            vendorId: new ObjectId(formData.get('vendorId') as string),
            amount: parseFloat(formData.get('amount') as string),
            currency: formData.get('currency') as string,
            paymentDate: new Date(formData.get('paymentDate') as string),
            paymentMode: formData.get('paymentMode') as CrmPayout['paymentMode'],
            referenceNumber: formData.get('referenceNumber') as string,
            notes: formData.get('notes') as string,
        };

        if (!payoutData.vendorId || !payoutData.amount || !payoutData.paymentDate) {
            return { error: 'Vendor, amount, and date are required.' };
        }

        // Lineage seeding (crm_function_plan.md §13.5). The form may
        // optionally pass `fromKind` + `fromId` when a payout is
        // created in the context of a parent doc — for payouts the
        // canonical parent is a Bill (which currently lives in the
        // `crm_expenses` collection until the dedicated `crm_bills`
        // collection lands). Multi-bill settlements via an `apply_to`
        // list are NOT cross-linked here: lineage points at a single
        // primary parent — explicit `fromKind`/`fromId` if provided,
        // else the first id in the optional `appliedBills` array.
        let lineage: LineageRef[] | undefined;
        let resolvedFromKind: LineageKind | null = null;
        let resolvedFromId: string | null = null;

        const rawFromKind = (formData.get('fromKind') as string | null) || null;
        const rawFromId = (formData.get('fromId') as string | null) || null;
        const ALLOWED_PARENT_KINDS: LineageKind[] = ['bill'];

        if (
            rawFromKind &&
            rawFromId &&
            ALLOWED_PARENT_KINDS.includes(rawFromKind as LineageKind) &&
            ObjectId.isValid(rawFromId)
        ) {
            resolvedFromKind = rawFromKind as LineageKind;
            resolvedFromId = rawFromId;
        } else {
            // Fallback: first id in optional appliedBills[] form field.
            const appliedBillsRaw = (formData.get('appliedBills') as string | null) || null;
            if (appliedBillsRaw) {
                try {
                    const parsed = JSON.parse(appliedBillsRaw);
                    if (Array.isArray(parsed) && parsed.length > 0) {
                        const firstId =
                            typeof parsed[0] === 'string'
                                ? parsed[0]
                                : (parsed[0]?.billId as string | undefined);
                        if (firstId && ObjectId.isValid(firstId)) {
                            resolvedFromKind = 'bill';
                            resolvedFromId = firstId;
                        }
                    }
                } catch {
                    // ignore malformed JSON
                }
            }
        }

        // Bills currently live in `crm_expenses`; `referenceNumber` is
        // the closest to a human-friendly bill number on that shape.
        const parentCollection: Record<string, string> = {
            bill: 'crm_expenses',
        };
        const parentNoField: Record<string, string> = {
            bill: 'referenceNumber',
        };

        if (resolvedFromKind && resolvedFromId) {
            const coll = parentCollection[resolvedFromKind];
            try {
                const parent = await db.collection(coll).findOne({
                    _id: new ObjectId(resolvedFromId),
                    userId: userObjectId,
                });
                if (parent) {
                    lineage = buildLineageFromParent({
                        kind: resolvedFromKind,
                        id: parent._id.toString(),
                        no: (parent[parentNoField[resolvedFromKind]] as string | undefined) || undefined,
                        status: (parent.status as string | undefined) || undefined,
                        lineage: (parent.lineage as LineageRef[] | undefined) ?? undefined,
                    });
                }
            } catch {
                // ignore lineage seed failures — payout still saves
            }
        }

        const insertResult = await db.collection('crm_payouts').insertOne({
            ...payoutData,
            ...(lineage ? { lineage } : {}),
            createdAt: new Date(),
            updatedAt: new Date()
        } as any);

        // Best-effort back-link onto the primary parent doc.
        if (lineage && resolvedFromKind && resolvedFromId) {
            try {
                const coll = parentCollection[resolvedFromKind];
                const parent = await db.collection(coll).findOne({ _id: new ObjectId(resolvedFromId) });
                const updatedParentLineage = appendLineage(parent?.lineage as LineageRef[] | undefined, {
                    kind: 'payout',
                    id: insertResult.insertedId.toString(),
                    no: payoutData.referenceNumber,
                    status: undefined,
                    createdAt: new Date().toISOString(),
                });
                await db.collection(coll).updateOne(
                    { _id: new ObjectId(resolvedFromId) },
                    { $set: { lineage: updatedParentLineage, updatedAt: new Date() } },
                );
            } catch {
                // non-fatal
            }
        }

        revalidatePath('/dashboard/crm/purchases/payouts');
        return { message: 'Payout recorded successfully.' };
    } catch (e) {
        return { error: getErrorMessage(e) };
    }
}

export async function deletePayout(payoutId: string): Promise<{ success: boolean; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Access denied.' };

    const guard = await requirePermission('crm_payout', 'delete');
    if (!guard.ok) return { success: false, error: guard.error };

    if (!payoutId) return { success: false, error: 'Invalid ID.' };

    if (useRustCrm()) {
        try {
            await crmPayoutsApi.delete(payoutId);
            revalidatePath('/dashboard/crm/purchases/payouts');
            return { success: true };
        } catch (e) {
            console.error('[deletePayout] rust path failed; falling back:', e);
            recordRustFallback({
                entity: 'payout',
                op: 'delete',
                errorCode: e instanceof RustApiError ? e.code : undefined,
                status: e instanceof RustApiError ? e.status : undefined,
            });
            // fall through
        }
    }

    if (!ObjectId.isValid(payoutId)) return { success: false, error: 'Invalid ID.' };

    try {
        const { db } = await connectToDatabase();
        const result = await db.collection('crm_payouts').deleteOne({
            _id: new ObjectId(payoutId),
            userId: new ObjectId(session.user._id)
        });

        if (result.deletedCount === 0) {
            return { success: false, error: 'Payout not found or permission denied.' };
        }

        revalidatePath('/dashboard/crm/purchases/payouts');
        return { success: true };
    } catch (e) {
        return { success: false, error: getErrorMessage(e) };
    }
}
