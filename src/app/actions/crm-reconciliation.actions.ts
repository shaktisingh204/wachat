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
import { randomUUID } from 'crypto';

function useRustCrm(): boolean {
    return process.env.USE_RUST_CRM === 'true';
}

interface CsvMapping {
    dateCol: string;
    descCol: string;
    debitCol: string;
    creditCol: string;
}

export async function importBankStatement(file: File, mapping?: CsvMapping): Promise<{ statementEntries?: any[], error?: string, columns?: string[] }> {
    try {
        const text = await file.text();
        const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });
        
        if (!parsed.data || parsed.data.length === 0) {
            return { error: 'Empty CSV' };
        }
        
        const columns = parsed.meta.fields || Object.keys(parsed.data[0] as object);

        if (!mapping) {
            return { columns };
        }

        const transactions = parsed.data.map((row: any, index) => {
            const dateStr = row[mapping.dateCol];
            const date = new Date(dateStr);
            const description = row[mapping.descCol];
            const debitStr = row[mapping.debitCol]?.toString().replace(/,/g, '');
            const creditStr = row[mapping.creditCol]?.toString().replace(/,/g, '');
            const debit = parseFloat(debitStr || '0');
            const credit = parseFloat(creditStr || '0');
            const amount = credit > 0 ? credit : -debit;

            if (isNaN(date.getTime()) || !description || isNaN(amount)) {
                return null;
            }

            return {
                _id: `stmt-${date.toISOString()}-${index}`,
                date,
                description,
                amount,
            };
        }).filter(Boolean);

        return { statementEntries: transactions, columns };
    } catch (e) {
        return { error: getErrorMessage(e) };
    }
}

export async function fetchPlaidTransactions(accountId: string, startDate: Date, endDate: Date): Promise<{ statementEntries?: any[], error?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: "Access denied" };
    try {
        // Mock Plaid / Bank API integration for automatic transaction fetching
        const entries = [
            { _id: `plaid-${Date.now()}-1`, date: startDate, description: 'Stripe Payout', amount: 450.00 },
            { _id: `plaid-${Date.now()}-2`, date: new Date(startDate.getTime() + 86400000), description: 'AWS Cloud', amount: -120.50 },
            { _id: `plaid-${Date.now()}-3`, date: new Date(startDate.getTime() + 86400000 * 2), description: 'Client Payment EUR (FX Adjusted)', amount: 1250.00, originalCurrency: 'EUR', fxRate: 1.1 },
            { _id: `plaid-${Date.now()}-4`, date: new Date(startDate.getTime() + 86400000 * 3), description: 'Wire Transfer Fees', amount: -15.00 },
        ];
        return { statementEntries: entries };
    } catch (e) {
        return { error: getErrorMessage(e) };
    }
}

export async function createFxAdjustmentEntry(accountId: string, baseAmount: number, foreignAmount: number, currency: string) {
    const session = await getSession();
    if (!session?.user) return { error: "Access denied" };
    try {
        const { db } = await connectToDatabase();
        const diff = baseAmount - foreignAmount;
        const entry: CrmVoucherEntry = {
            _id: new ObjectId(),
            userId: new ObjectId(session.user._id),
            voucherType: 'journal',
            voucherNumber: `FX-${Date.now()}`,
            date: new Date(),
            debitEntries: diff < 0 ? [{ accountId: new ObjectId(accountId), amount: Math.abs(diff) }] : [],
            creditEntries: diff > 0 ? [{ accountId: new ObjectId(accountId), amount: diff }] : [],
            note: `Multi-currency FX Adjustment (${currency})`,
            createdAt: new Date(),
            updatedAt: new Date(),
        };
        await db.collection('crm_voucher_entries').insertOne(entry as any);
        return { success: true, diff, entryId: entry._id.toString() };
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

        // 2. Clear draft if it exists
        await db.collection('crm_reconciliation_drafts').deleteOne({
             userId: new ObjectId(session.user._id),
             accountId: new ObjectId(accountId)
        });

        // 3. Mark Book Entries as Reconciled (Optional but good for production)
        // This prevents them from appearing in future reconciliations if we filter them out
        // For now, we won't modify the voucher entries directly to avoid complex side effects, 
        // but we'll store the reconciliation record which is sufficient for audit.

        revalidatePath('/dashboard/crm/banking/reconciliation');
        return { success: true };
    } catch (e) {
        return { success: false, error: getErrorMessage(e) };
    }
}

export async function saveReconciliationDraft(
    accountId: string,
    matchedBookEntries: string[],
    matchedStatementEntries: string[],
    statementEntries: any[]
): Promise<{ success: boolean, error?: string }> {
    const session = await getSession();
    if (!session?.user) return { success: false, error: "Access denied" };

    try {
        const { db } = await connectToDatabase();
        await db.collection('crm_reconciliation_drafts').updateOne(
            { userId: new ObjectId(session.user._id), accountId: new ObjectId(accountId) },
            { 
                $set: { 
                    matchedBookEntries, 
                    matchedStatementEntries,
                    statementEntries,
                    updatedAt: new Date()
                } 
            },
            { upsert: true }
        );
        return { success: true };
    } catch (e) {
        return { success: false, error: getErrorMessage(e) };
    }
}

export async function loadReconciliationDraft(accountId: string): Promise<{ data?: any, error?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: "Access denied" };

    try {
        const { db } = await connectToDatabase();
        const draft = await db.collection('crm_reconciliation_drafts').findOne({
             userId: new ObjectId(session.user._id),
             accountId: new ObjectId(accountId)
        });
        return { data: draft };
    } catch (e) {
        return { error: getErrorMessage(e) };
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

/* ─── KPIs (used by reconciliation list page) ───────────────────────── */

interface CrmReconciliationKpis {
  reconciled: number;
  unreconciled: number;
  lastReconciledDate: string | null;
  totalDifference: number;
}

export async function getCrmReconciliationKpis(): Promise<CrmReconciliationKpis> {
  const empty: CrmReconciliationKpis = {
    reconciled: 0,
    unreconciled: 0,
    lastReconciledDate: null,
    totalDifference: 0,
  };

  const session = await getSession();
  if (!session?.user) return empty;

  try {
    const { db } = await connectToDatabase();
    const userId = new ObjectId(session.user._id);

    const [reconciled, unreconciled, lastDoc, diffAgg] = await Promise.all([
      db.collection('crm_reconciliations').countDocuments({
        userId,
        status: { $in: ['Completed', 'completed'] },
      }),
      db.collection('crm_reconciliations').countDocuments({
        userId,
        status: { $nin: ['Completed', 'completed'] },
      }),
      db
        .collection('crm_reconciliations')
        .findOne(
          { userId, status: { $in: ['Completed', 'completed'] } },
          { sort: { reconciledDate: -1 }, projection: { reconciledDate: 1 } },
        ),
      db
        .collection('crm_reconciliations')
        .aggregate([
          { $match: { userId } },
          {
            $group: {
              _id: null,
              diff: {
                $sum: { $subtract: ['$closingBalance', '$openingBalance'] },
              },
            },
          },
        ])
        .toArray(),
    ]);

    return {
      reconciled,
      unreconciled,
      lastReconciledDate:
        lastDoc?.reconciledDate
          ? new Date(lastDoc.reconciledDate as Date).toISOString()
          : null,
      totalDifference:
        (diffAgg[0] as { diff?: number } | undefined)?.diff ?? 0,
    };
  } catch (e) {
    console.error('[getCrmReconciliationKpis] failed:', e);
    return empty;
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
