'use server';

/**
 * CRM Recurring Expenses — Mongo-backed server actions.
 *
 * No Rust crate yet; this module owns the `crm_recurring_expenses`
 * collection directly. Fields:
 *   name, vendor_id, expense_category_id, amount, currency, frequency,
 *   start_date, end_date, next_run_at, last_run_at, total_runs,
 *   account_id, notes, status.
 */

import { revalidatePath } from 'next/cache';
import { ObjectId } from 'mongodb';

import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';
import { requirePermission } from '@/lib/rbac-server';
import { getErrorMessage } from '@/lib/utils';

/* ─── Types ──────────────────────────────────────────────────────────── */

type RecurringExpenseFrequency = 'daily' | 'weekly' | 'monthly' | 'yearly';
type RecurringExpenseStatus = 'active' | 'paused' | 'completed' | 'cancelled';

interface RecurringExpenseDoc {
    _id: string;
    name: string;
    vendor_id?: string;
    expense_category_id?: string;
    amount: number;
    currency: string;
    frequency: RecurringExpenseFrequency;
    start_date?: string;
    end_date?: string;
    next_run_at?: string;
    last_run_at?: string;
    total_runs?: number;
    account_id?: string;
    notes?: string;
    status: RecurringExpenseStatus;
    createdAt?: string;
    updatedAt?: string;
}

const VALID_FREQUENCIES: ReadonlySet<RecurringExpenseFrequency> = new Set([
    'daily', 'weekly', 'monthly', 'yearly',
]);
const VALID_STATUSES: ReadonlySet<RecurringExpenseStatus> = new Set([
    'active', 'paused', 'completed', 'cancelled',
]);

/* ─── Helpers ────────────────────────────────────────────────────────── */

function asString(v: FormDataEntryValue | null): string | undefined {
    if (v == null) return undefined;
    const s = String(v).trim();
    return s.length > 0 ? s : undefined;
}

function asNumber(v: FormDataEntryValue | null): number | undefined {
    const s = asString(v);
    if (!s) return undefined;
    const n = Number(s);
    return Number.isFinite(n) ? n : undefined;
}

function asDate(v: FormDataEntryValue | null): Date | undefined {
    const s = asString(v);
    if (!s) return undefined;
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? undefined : d;
}

/* ─── Reads ──────────────────────────────────────────────────────────── */

export async function getRecurringExpenses(): Promise<RecurringExpenseDoc[]> {
    const session = await getSession();
    if (!session?.user) return [];

    const guard = await requirePermission('crm_expense', 'view');
    if (!guard.ok) return [];

    try {
        const { db } = await connectToDatabase();
        const userObjectId = new ObjectId(session.user._id);
        const rows = await db
            .collection('crm_recurring_expenses')
            .find({ userId: userObjectId })
            .sort({ createdAt: -1 })
            .toArray();
        return JSON.parse(JSON.stringify(rows)) as RecurringExpenseDoc[];
    } catch (e) {
        console.error('[getRecurringExpenses] failed:', e);
        return [];
    }
}

export async function getRecurringExpenseById(
    id: string,
): Promise<RecurringExpenseDoc | null> {
    const session = await getSession();
    if (!session?.user) return null;
    if (!id || !ObjectId.isValid(id)) return null;

    const guard = await requirePermission('crm_expense', 'view');
    if (!guard.ok) return null;

    try {
        const { db } = await connectToDatabase();
        const doc = await db.collection('crm_recurring_expenses').findOne({
            _id: new ObjectId(id),
            userId: new ObjectId(session.user._id),
        });
        if (!doc) return null;
        return JSON.parse(JSON.stringify(doc)) as RecurringExpenseDoc;
    } catch (e) {
        console.error('[getRecurringExpenseById] failed:', e);
        return null;
    }
}

/* ─── Writes ─────────────────────────────────────────────────────────── */

export async function saveRecurringExpense(
    _prev: { message?: string; error?: string; id?: string } | undefined,
    formData: FormData,
): Promise<{ message?: string; error?: string; id?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: 'Access denied.' };

    const recurringId = asString(formData.get('recurringId'));
    const isEditing = !!recurringId;

    const guard = await requirePermission(
        'crm_expense',
        isEditing ? 'edit' : 'create',
    );
    if (!guard.ok) return { error: guard.error };

    const name = asString(formData.get('name'));
    if (!name) return { error: 'Name is required.' };

    const amount = asNumber(formData.get('amount'));
    if (amount == null || amount <= 0) {
        return { error: 'Amount must be greater than 0.' };
    }

    const frequencyRaw = asString(formData.get('frequency')) ?? 'monthly';
    const frequency: RecurringExpenseFrequency = VALID_FREQUENCIES.has(
        frequencyRaw as RecurringExpenseFrequency,
    )
        ? (frequencyRaw as RecurringExpenseFrequency)
        : 'monthly';

    const statusRaw = asString(formData.get('status')) ?? 'active';
    const status: RecurringExpenseStatus = VALID_STATUSES.has(
        statusRaw as RecurringExpenseStatus,
    )
        ? (statusRaw as RecurringExpenseStatus)
        : 'active';

    const setDoc: Record<string, unknown> = {
        name,
        amount,
        currency: asString(formData.get('currency')) ?? 'INR',
        frequency,
        status,
        ...(asString(formData.get('vendor_id'))
            ? { vendor_id: asString(formData.get('vendor_id')) }
            : {}),
        ...(asString(formData.get('expense_category_id'))
            ? { expense_category_id: asString(formData.get('expense_category_id')) }
            : {}),
        ...(asDate(formData.get('start_date'))
            ? { start_date: asDate(formData.get('start_date')) }
            : {}),
        ...(asDate(formData.get('end_date'))
            ? { end_date: asDate(formData.get('end_date')) }
            : {}),
        ...(asDate(formData.get('next_run_at'))
            ? { next_run_at: asDate(formData.get('next_run_at')) }
            : {}),
        ...(asString(formData.get('account_id'))
            ? { account_id: asString(formData.get('account_id')) }
            : {}),
        ...(asString(formData.get('notes'))
            ? { notes: asString(formData.get('notes')) }
            : {}),
        updatedAt: new Date(),
    };

    try {
        const { db } = await connectToDatabase();
        const userObjectId = new ObjectId(session.user._id);

        if (isEditing) {
            if (!ObjectId.isValid(recurringId!)) {
                return { error: 'Invalid id.' };
            }
            const result = await db.collection('crm_recurring_expenses').updateOne(
                { _id: new ObjectId(recurringId!), userId: userObjectId },
                { $set: setDoc },
            );
            if (result.matchedCount === 0) {
                return { error: 'Recurring expense not found.' };
            }
            revalidatePath('/dashboard/crm/purchases/recurring-expenses');
            revalidatePath(`/dashboard/crm/purchases/recurring-expenses/${recurringId}`);
            return { message: 'Recurring expense updated.', id: recurringId };
        }

        const insertDoc = {
            ...setDoc,
            userId: userObjectId,
            total_runs: 0,
            createdAt: new Date(),
        };
        const result = await db
            .collection('crm_recurring_expenses')
            .insertOne(insertDoc);
        revalidatePath('/dashboard/crm/purchases/recurring-expenses');
        return {
            message: 'Recurring expense created.',
            id: result.insertedId.toString(),
        };
    } catch (e) {
        return { error: `Failed to save: ${getErrorMessage(e)}` };
    }
}

export async function deleteRecurringExpense(
    id: string,
): Promise<{ success: boolean; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Access denied.' };
    if (!id || !ObjectId.isValid(id)) {
        return { success: false, error: 'Invalid id.' };
    }

    const guard = await requirePermission('crm_expense', 'delete');
    if (!guard.ok) return { success: false, error: guard.error };

    try {
        const { db } = await connectToDatabase();
        const result = await db.collection('crm_recurring_expenses').deleteOne({
            _id: new ObjectId(id),
            userId: new ObjectId(session.user._id),
        });
        if (result.deletedCount === 0) {
            return { success: false, error: 'Recurring expense not found.' };
        }
        revalidatePath('/dashboard/crm/purchases/recurring-expenses');
        return { success: true };
    } catch (e) {
        return { success: false, error: getErrorMessage(e) };
    }
}
