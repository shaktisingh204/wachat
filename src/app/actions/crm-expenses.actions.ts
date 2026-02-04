'use server';

import { revalidatePath } from 'next/cache';
import { type Db, ObjectId, type WithId, Filter } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/index.ts';
import type { CrmExpense } from '@/lib/definitions';
import { getErrorMessage } from '@/lib/utils';

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

        const filter: Filter<CrmExpense> = { userId: userObjectId };

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

        await db.collection('crm_expenses').insertOne({
            ...expenseData,
            createdAt: new Date(),
            updatedAt: new Date()
        } as any);

        revalidatePath('/dashboard/crm/purchases/expenses');
        return { message: 'Expense saved successfully.' };
    } catch (e) {
        return { error: getErrorMessage(e) };
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
