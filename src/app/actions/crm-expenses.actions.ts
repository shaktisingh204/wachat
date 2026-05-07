'use server';

import { revalidatePath } from 'next/cache';
import { type Db, ObjectId, type WithId, Filter } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/index.ts';
import type { CrmExpense, LineageKind, LineageRef } from '@/lib/definitions';
import { getErrorMessage } from '@/lib/utils';
import { buildLineageFromParent, appendLineage } from '@/lib/lineage';

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

        revalidatePath('/dashboard/crm/purchases/expenses');
        return { message: 'Expense saved successfully.' };
    } catch (e) {
        return { error: getErrorMessage(e) };
    }
}

export async function getExpenseById(expenseId: string): Promise<WithId<CrmExpense> | null> {
    const session = await getSession();
    if (!session?.user) return null;
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
    if (!ObjectId.isValid(expenseId)) return { success: false, error: 'Invalid ID.' };

    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Access denied.' };

    try {
        const { db } = await connectToDatabase();
        const result = await db.collection('crm_expenses').deleteOne({
            _id: new ObjectId(expenseId),
            userId: new ObjectId(session.user._id)
        });

        if (result.deletedCount === 0) {
            return { success: false, error: 'Expense not found or permission denied.' };
        }

        revalidatePath('/dashboard/crm/purchases/expenses');
        return { success: true };
    } catch (e) {
        return { success: false, error: getErrorMessage(e) };
    }
}
