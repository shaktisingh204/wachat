'use server';

/**
 * CRM Expense (= Bill) server actions.
 *
 * **Dual implementation:**
 *  - When `USE_RUST_CRM === 'true'`, mutations delegate to
 *    `/v1/crm/bills` on the Rust BFF via
 *    `src/lib/rust-client/crm-bills.ts`.
 *  - Otherwise (default), the legacy direct-Mongo path runs against
 *    `crm_expenses`.
 *
 * Export shapes are identical across both paths so the pages at
 * `/dashboard/crm/purchases/expenses/**` keep working without changes.
 */

import { revalidatePath } from 'next/cache';
import { ObjectId, type WithId } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/index.ts';
import type { CrmExpense, LineageKind, LineageRef } from '@/lib/definitions';
import { getErrorMessage } from '@/lib/utils';
import { buildLineageFromParent, appendLineage } from '@/lib/lineage';
import { writeAuditEntry } from '@/lib/audit-log';
import { requirePermission } from '@/lib/rbac-server';
import { crmBillsApi, type CrmBillDoc } from '@/lib/rust-client/crm-bills';
import { RustApiError } from '@/lib/rust-client/fetcher';
import { recordRustFallback } from '@/lib/observability/rust-fallback-counter';

function useRustCrm(): boolean {
    return process.env.USE_RUST_CRM === 'true';
}

/**
 * Map a Rust Bill DTO into the loose Record shape the legacy expense
 * callers expect. Most fields are pass-through; we surface a couple of
 * common legacy aliases so the existing pages don't have to branch.
 */
function rustDocToLegacy(doc: CrmBillDoc): WithId<Record<string, unknown>> {
    const serialized = JSON.parse(JSON.stringify(doc)) as Record<string, unknown>;
    // legacy shape used `amount` + `expenseDate` + `referenceNumber`
    if (typeof serialized.billDate === 'string' && !serialized.expenseDate) {
        serialized.expenseDate = serialized.billDate;
    }
    if (
        serialized.totals &&
        typeof (serialized.totals as any).total === 'number' &&
        serialized.amount == null
    ) {
        serialized.amount = (serialized.totals as any).total;
    }
    if (typeof serialized.vendorInvoiceNo === 'string' && !serialized.referenceNumber) {
        serialized.referenceNumber = serialized.vendorInvoiceNo;
    }
    return serialized as WithId<Record<string, unknown>>;
}

export async function getExpenses(
    page: number = 1,
    limit: number = 20,
    query?: string
): Promise<{ expenses: WithId<CrmExpense>[], total: number }> {
    const session = await getSession();
    if (!session?.user) return { expenses: [], total: 0 };

    try {
        const { db } = await connectToDatabase();
        const userObjectId = new ObjectId(session.user._id);

        const filter: any = { userId: userObjectId };

        const skip = (page - 1) * limit;

        const [expenses, total] = await Promise.all([
            db.collection('crm_expenses')
                .find(filter)
                .sort({ expenseDate: -1 })
                .skip(skip)
                .limit(limit)
                .toArray(),
            db.collection('crm_expenses').countDocuments(filter)
        ]);

        return {
            expenses: JSON.parse(JSON.stringify(expenses)),
            total
        };
    } catch (e: any) {
        console.error("Failed to fetch CRM expenses:", e);
        return { expenses: [], total: 0 };
    }
}

export async function saveExpense(prevState: any, formData: FormData): Promise<{ message?: string; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: 'Access denied' };

    const guard = await requirePermission('crm_bill', 'create');
    if (!guard.ok) return { error: guard.error };

    if (useRustCrm()) {
        try {
            const vendorId = (formData.get('vendorId') as string | null) || '';
            const expenseAccount = (formData.get('expenseAccount') as string | null) || '';
            const amountRaw = (formData.get('amount') as string | null) || '';
            const currency = (formData.get('currency') as string | null) || 'INR';
            const expenseDateRaw = (formData.get('expenseDate') as string | null) || '';
            const description = (formData.get('description') as string | null) || '';
            const referenceNumber = (formData.get('referenceNumber') as string | null) || '';

            if (!vendorId || vendorId === 'none' || !ObjectId.isValid(vendorId)) {
                return { error: 'Vendor is required.' };
            }
            if (!amountRaw || !expenseDateRaw) {
                return { error: 'Amount and date are required.' };
            }

            const amount = parseFloat(amountRaw);
            if (!isFinite(amount)) {
                return { error: 'Invalid amount.' };
            }

            const billDateIso = new Date(expenseDateRaw).toISOString();
            const fromKindRaw = (formData.get('fromKind') as string | null) || undefined;
            const fromId = (formData.get('fromId') as string | null) || undefined;

            const created = await crmBillsApi.create({
                billDate: billDateIso,
                vendorId,
                currency,
                items: [],
                expenseLines: [
                    {
                        accountId: expenseAccount || undefined,
                        description: description || undefined,
                        amount,
                    },
                ],
                totals: { subTotal: amount, total: amount },
                notes: description || undefined,
                vendorInvoiceNo: referenceNumber || undefined,
                ...(fromKindRaw === 'purchaseOrder' || fromKindRaw === 'grn'
                    ? { fromKind: fromKindRaw, fromId }
                    : {}),
            });

            const id = String(created._id ?? '');
            try {
                await writeAuditEntry({
                    tenantUserId: String(session.user._id),
                    actorId: String(session.user._id),
                    action: 'create',
                    entityKind: 'bill',
                    entityId: id,
                });
            } catch {
                /* non-fatal */
            }
            revalidatePath('/dashboard/crm/purchases/expenses');
            return { message: 'Expense saved successfully.' };
        } catch (e) {
            console.error('[saveExpense] rust path failed; falling back:', e);
            recordRustFallback({ entity: 'expense', op: 'create', errorCode: e instanceof RustApiError ? e.code : undefined, status: e instanceof RustApiError ? e.status : undefined });
            // fall through to legacy
        }
    }

    try {
        const { db } = await connectToDatabase();
        const userObjectId = new ObjectId(session.user._id);

        const expenseData: Omit<CrmExpense, '_id' | 'createdAt' | 'updatedAt'> = {
            userId: userObjectId,
            expenseAccount: formData.get('expenseAccount') as string,
            amount: parseFloat(formData.get('amount') as string),
            currency: formData.get('currency') as string,
            expenseDate: new Date(formData.get('expenseDate') as string),
            description: formData.get('description') as string,
            referenceNumber: formData.get('referenceNumber') as string,
            isBillable: formData.get('isBillable') === 'on',
        };

        const vendorId = formData.get('vendorId') as string;
        if (vendorId && vendorId !== 'none') {
            expenseData.vendorId = new ObjectId(vendorId);
        }

        const customerId = formData.get('customerId') as string;
        if (customerId && customerId !== 'none') {
            expenseData.customerId = new ObjectId(customerId);
        }

        if (!expenseData.expenseAccount || !expenseData.amount || !expenseData.expenseDate) {
            return { error: 'Expense account, amount, and date are required.' };
        }

        // Lineage seeding (crm_function_plan.md §13.5/§15 Phase 2). The form
        // may optionally pass `fromKind` + `fromId` when a bill / expense is
        // created in the context of a purchase parent (PO or GRN). Both
        // fields are optional, so existing flows keep working unchanged.
        let lineage: LineageRef[] | undefined;
        const fromKind = (formData.get('fromKind') as string | null) || null;
        const fromId = (formData.get('fromId') as string | null) || null;
        const ALLOWED_PARENT_KINDS: LineageKind[] = ['purchaseOrder', 'grn'];
        if (fromKind && fromId && ALLOWED_PARENT_KINDS.includes(fromKind as LineageKind) && ObjectId.isValid(fromId)) {
            const parentCollection: Record<string, string> = {
                purchaseOrder: 'crm_purchase_orders',
                grn: 'crm_grns',
            };
            const parentNoField: Record<string, string> = {
                purchaseOrder: 'orderNumber',
                grn: 'grnNumber',
            };
            const coll = parentCollection[fromKind];
            try {
                const parent = await db.collection(coll).findOne({
                    _id: new ObjectId(fromId),
                    userId: userObjectId,
                });
                if (parent) {
                    lineage = buildLineageFromParent({
                        kind: fromKind as LineageKind,
                        id: parent._id.toString(),
                        no: (parent[parentNoField[fromKind]] as string | undefined) || undefined,
                        status: (parent.status as string | undefined) || undefined,
                        lineage: (parent.lineage as LineageRef[] | undefined) ?? undefined,
                    });
                }
            } catch {
                // ignore lineage seed failures — bill still saves
            }
        }

        const insertResult = await db.collection('crm_expenses').insertOne({
            ...expenseData,
            ...(lineage ? { lineage } : {}),
            createdAt: new Date(),
            updatedAt: new Date()
        } as any);

        // Best-effort back-link onto the parent doc.
        if (lineage && fromKind && fromId) {
            try {
                const parentCollection: Record<string, string> = {
                    purchaseOrder: 'crm_purchase_orders',
                    grn: 'crm_grns',
                };
                const coll = parentCollection[fromKind];
                const parent = await db.collection(coll).findOne({ _id: new ObjectId(fromId) });
                const updatedParentLineage = appendLineage(parent?.lineage as LineageRef[] | undefined, {
                    kind: 'bill',
                    id: insertResult.insertedId.toString(),
                    no: expenseData.referenceNumber || undefined,
                    createdAt: new Date().toISOString(),
                });
                await db.collection(coll).updateOne(
                    { _id: new ObjectId(fromId) },
                    { $set: { lineage: updatedParentLineage, updatedAt: new Date() } },
                );
            } catch {
                // non-fatal
            }
        }

        try {
            await writeAuditEntry({
                tenantUserId: String(session.user._id),
                actorId: String(session.user._id),
                action: 'create',
                entityKind: 'bill',
                entityId: insertResult.insertedId.toString(),
            });
        } catch {
            /* non-fatal */
        }

        revalidatePath('/dashboard/crm/purchases/expenses');
        return { message: 'Expense saved successfully.' };
    } catch (e) {
        return { error: getErrorMessage(e) };
    }
}

export async function getExpenseById(expenseId: string): Promise<WithId<CrmExpense> | null> {
    const session = await getSession();
    if (!session?.user) return null;
    if (!expenseId) return null;

    if (useRustCrm()) {
        try {
            const doc = await crmBillsApi.getById(expenseId);
            return doc ? (rustDocToLegacy(doc) as unknown as WithId<CrmExpense>) : null;
        } catch (e) {
            if (e instanceof RustApiError && e.status === 404) return null;
            console.error('[getExpenseById] rust path failed; falling back:', e);
            recordRustFallback({ entity: 'expense', op: 'get', errorCode: e instanceof RustApiError ? e.code : undefined, status: e instanceof RustApiError ? e.status : undefined });
            // fall through
        }
    }

    if (!ObjectId.isValid(expenseId)) return null;

    try {
        const { db } = await connectToDatabase();
        const expense = await db.collection('crm_expenses').findOne({
            _id: new ObjectId(expenseId),
            userId: new ObjectId(session.user._id),
        });
        if (!expense) return null;
        return JSON.parse(JSON.stringify(expense));
    } catch (e) {
        console.error('Failed to fetch expense by id:', e);
        return null;
    }
}

export async function deleteExpense(expenseId: string): Promise<{ success: boolean; error?: string }> {
    if (!expenseId) return { success: false, error: 'Invalid ID.' };

    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Access denied.' };

    const guard = await requirePermission('crm_bill', 'delete');
    if (!guard.ok) return { success: false, error: guard.error };

    if (useRustCrm()) {
        try {
            await crmBillsApi.delete(expenseId);
            try {
                await writeAuditEntry({
                    tenantUserId: String(session.user._id),
                    actorId: String(session.user._id),
                    action: 'delete',
                    entityKind: 'bill',
                    entityId: expenseId,
                });
            } catch {
                /* non-fatal */
            }
            revalidatePath('/dashboard/crm/purchases/expenses');
            return { success: true };
        } catch (e) {
            console.error('[deleteExpense] rust path failed; falling back:', e);
            recordRustFallback({ entity: 'expense', op: 'delete', errorCode: e instanceof RustApiError ? e.code : undefined, status: e instanceof RustApiError ? e.status : undefined });
            // fall through
        }
    }

    if (!ObjectId.isValid(expenseId)) return { success: false, error: 'Invalid ID.' };

    try {
        const { db } = await connectToDatabase();
        const result = await db.collection('crm_expenses').deleteOne({
            _id: new ObjectId(expenseId),
            userId: new ObjectId(session.user._id)
        });

        if (result.deletedCount === 0) {
            return { success: false, error: 'Expense not found or permission denied.' };
        }

        try {
            await writeAuditEntry({
                tenantUserId: String(session.user._id),
                actorId: String(session.user._id),
                action: 'delete',
                entityKind: 'bill',
                entityId: expenseId,
            });
        } catch {
            /* non-fatal */
        }

        revalidatePath('/dashboard/crm/purchases/expenses');
        return { success: true };
    } catch (e) {
        return { success: false, error: getErrorMessage(e) };
    }
}
