'use server';

import { revalidatePath } from 'next/cache';
import { type Db, ObjectId, type WithId, Filter } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';
import type { CrmVoucherEntry, BankStatement, BankStatementTransaction } from '@/lib/definitions';
import { getErrorMessage } from '@/lib/utils';
import { requirePermission } from '@/lib/rbac-server';
import { recordRustFallback } from '@/lib/observability/rust-fallback-counter';
import { crmReconciliationApi } from '@/lib/rust-client/crm-reconciliation';
import { RustApiError } from '@/lib/rust-client/fetcher';
import Papa from 'papaparse';

function useRustCrm(): boolean {
    return process.env.USE_RUST_CRM === 'true';
}

export async function importBankStatement(file: File): Promise<{ statementEntries?: any[], error?: string }> {
    try {
        const text = await file.text();
        const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });

        // This is a naive parser. In a real app, you'd have mappers for different bank formats.
        const transactions = parsed.data.map((row: any, index) => {
            const date = new Date(row['Date'] || row['Transaction Date']);
            const description = row['Description'] || row['Narration'];
            const debit = parseFloat(row['Debit'] || row['Withdrawal'] || '0');
            const credit = parseFloat(row['Credit'] || row['Deposit'] || '0');
            const amount = credit > 0 ? credit : -debit;

            if (isNaN(date.getTime()) || !description || isNaN(amount)) {
                console.warn(`Skipping invalid row ${index + 2}:`, row);
                return null;
            }

            return {
                _id: `stmt-${date.toISOString()}-${index}`, // Temporary unique ID
                date,
                description,
                amount,
            };
        }).filter(Boolean);

        return { statementEntries: transactions };
    } catch (e) {
        return { error: getErrorMessage(e) };
    }
}

export async function getReconciliationData(accountId: string, startDate: Date, endDate: Date): Promise<{ entries?: any[], error?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: "Access denied" };

    try {
        const { db } = await connectToDatabase();
        const accountObjectId = new ObjectId(accountId);

        const voucherEntries = await db.collection<CrmVoucherEntry>('crm_voucher_entries').find({
            userId: new ObjectId(session.user._id),
            date: { $gte: startDate, $lte: endDate },
            $or: [
                { 'debitEntries.accountId': accountObjectId },
                { 'creditEntries.accountId': accountObjectId },
            ],
        }).toArray();

        const bookEntries = voucherEntries.flatMap(entry => {
            const debits = entry.debitEntries
                .filter(d => d.accountId.equals(accountObjectId))
                .map(d => ({ _id: entry._id.toString() + '-dr', date: entry.date, description: entry.note || `Voucher ${entry.voucherNumber}`, type: 'debit', amount: d.amount }));

            const credits = entry.creditEntries
                .filter(c => c.accountId.equals(accountObjectId))
                .map(c => ({ _id: entry._id.toString() + '-cr', date: entry.date, description: entry.note || `Voucher ${entry.voucherNumber}`, type: 'credit', amount: c.amount }));

            return [...debits, ...credits];
        });

        return { entries: bookEntries };

    } catch (e) {
        return { error: getErrorMessage(e) };
    }
}

export async function saveReconciliation(
    accountId: string,
    statementId: string, // In a real app we might store the statement file reference or hash
    matchedBookEntryIds: string[],
    matchedStatementEntryIds: string[]
): Promise<{ success: boolean, error?: string }> {
    const session = await getSession();
    if (!session?.user) return { success: false, error: "Access denied" };
    const guard = await requirePermission('crm_banking_reconciliation', 'create');
    if (!guard.ok) return { success: false, error: guard.error };

    try {
        const { db } = await connectToDatabase();

        // 1. Create a Reconciliation Record
        const reconciliationRecord = {
            userId: new ObjectId(session.user._id),
            accountId: new ObjectId(accountId),
            statementId: statementId || 'manual_import', // simplified
            reconciledDate: new Date(),
            matchedBookEntriesCount: matchedBookEntryIds.length,
            matchedStatementEntriesCount: matchedStatementEntryIds.length,
            matchedBookEntryIds, // Store IDs for reference
            status: 'Completed'
        };

        await db.collection('crm_reconciliations').insertOne(reconciliationRecord);

        // 2. Mark Book Entries as Reconciled (Optional but good for production)
        // This prevents them from appearing in future reconciliations if we filter them out
        // For now, we won't modify the voucher entries directly to avoid complex side effects, 
        // but we'll store the reconciliation record which is sufficient for audit.

        revalidatePath('/dashboard/crm/banking/reconciliation');
        return { success: true };
    } catch (e) {
        return { success: false, error: getErrorMessage(e) };
    }
}

/**
 * Fetch a single reconciliation document scoped to the current user.
 *
 * Mirrors the canonical loader shape used elsewhere in the CRM. When
 * `USE_RUST_CRM=true`, the Rust BFF at `/v1/crm/reconciliations/:id` is
 * consulted first and the Mongo path is used as fallback on any error.
 */
export async function getReconciliationById(
    reconciliationId: string,
): Promise<WithId<Record<string, unknown>> | null> {
    const session = await getSession();
    if (!session?.user) return null;
    if (!ObjectId.isValid(reconciliationId)) return null;

    if (useRustCrm()) {
        try {
            const doc = await crmReconciliationApi.getById(reconciliationId);
            return JSON.parse(JSON.stringify(doc));
        } catch (e) {
            console.error('[getReconciliationById] rust path failed; falling back:', e);
            recordRustFallback({
                entity: 'reconciliation',
                op: 'get',
                errorCode: e instanceof RustApiError ? e.code : undefined,
                status: e instanceof RustApiError ? e.status : undefined,
            });
        }
    }

    try {
        const { db } = await connectToDatabase();
        const doc = await db.collection('crm_reconciliations').findOne({
            _id: new ObjectId(reconciliationId),
            userId: new ObjectId(session.user._id),
        });
        if (!doc) return null;
        return JSON.parse(JSON.stringify(doc));
    } catch (e) {
        console.error('Failed to fetch reconciliation by id:', e);
        return null;
    }
}

/* ─── Legacy-name wrapper used by the ReconciliationForm UI ─────────── */

/**
 * `useActionState`-compatible wrapper used by
 * `<ReconciliationForm />`. Persists a full reconciliation document
 * directly to `crm_reconciliations` (the row-level shape the form
 * captures — account, period, balances, statement file, notes, status).
 *
 * Distinct from `saveReconciliation`, which takes pre-computed matched
 * id arrays and is used by the matcher UI.
 */
export async function saveReconciliationRecord(
    _prevState: { message?: string; error?: string; id?: string } | undefined,
    formData: FormData,
): Promise<{ message?: string; error?: string; id?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: 'Access denied' };

    const reconciliationId =
        (formData.get('reconciliationId') as string | null) || undefined;
    const isEditing = !!reconciliationId;

    const guard = await requirePermission(
        'crm_banking_reconciliation',
        isEditing ? 'edit' : 'create',
    );
    if (!guard.ok) return { error: guard.error };

    const accountIdRaw = (formData.get('accountId') as string | null) || '';
    if (!ObjectId.isValid(accountIdRaw)) {
        return { error: 'A valid account id is required.' };
    }

    const periodStart = formData.get('periodStart') as string | null;
    const periodEnd = formData.get('periodEnd') as string | null;
    if (!periodStart || !periodEnd) {
        return { error: 'Period start and end are required.' };
    }

    const openingBalance = Number(formData.get('openingBalance') ?? 0);
    const closingBalance = Number(formData.get('closingBalance') ?? 0);
    const matchedCount = Number(formData.get('matchedCount') ?? 0);
    const unmatchedCount = Number(formData.get('unmatchedCount') ?? 0);
    const status = (formData.get('status') as string | null) || 'in_progress';
    const statementUrl =
        (formData.get('statementUrl') as string | null) || null;
    const notes = (formData.get('notes') as string | null) || '';

    try {
        const { db } = await connectToDatabase();
        const userId = new ObjectId(session.user._id);
        const accountId = new ObjectId(accountIdRaw);
        const now = new Date();

        const doc: Record<string, unknown> = {
            userId,
            accountId,
            periodStart: new Date(periodStart),
            periodEnd: new Date(periodEnd),
            openingBalance: Number.isFinite(openingBalance) ? openingBalance : 0,
            closingBalance: Number.isFinite(closingBalance) ? closingBalance : 0,
            matchedCount: Number.isFinite(matchedCount) ? matchedCount : 0,
            unmatchedCount: Number.isFinite(unmatchedCount) ? unmatchedCount : 0,
            status,
            statementUrl,
            notes,
            updatedAt: now,
        };

        if (isEditing && ObjectId.isValid(reconciliationId)) {
            await db.collection('crm_reconciliations').updateOne(
                { _id: new ObjectId(reconciliationId), userId },
                { $set: doc },
            );
            revalidatePath('/dashboard/crm/banking/reconciliation');
            return {
                message: 'Reconciliation updated.',
                id: reconciliationId,
            };
        }

        doc.createdAt = now;
        const result = await db
            .collection('crm_reconciliations')
            .insertOne(doc as any);
        revalidatePath('/dashboard/crm/banking/reconciliation');
        return {
            message: 'Reconciliation created.',
            id: result.insertedId.toString(),
        };
    } catch (e) {
        return { error: getErrorMessage(e) };
    }
}
