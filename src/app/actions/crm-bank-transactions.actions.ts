'use server';

/**
 * CRM Bank Transactions — Mongo-only server actions.
 *
 * Backs the `crm_bank_transactions` collection (separate from the legacy
 * `crm_bank_transactions_ext` used by worksuite payments). Records are
 * typically auto-created by CSV statement import OR cross-posted from a
 * voucher entry. The `/new` page is intentionally absent; rows are
 * appended via {@link importBankTransactionsCsv}.
 *
 * Shape:
 *   account_id, transaction_date, amount, type (debit/credit),
 *   description, reference_number, balance_after, category,
 *   voucher_entry_id, status (pending/cleared/reconciled/archived).
 */

import { revalidatePath } from 'next/cache';
import { ObjectId, type Filter, type WithId } from 'mongodb';

import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';
import { coerceFiniteMoney } from '@/lib/crm/number-safety';
import { getErrorMessage } from '@/lib/utils';
import { writeAuditEntry } from '@/lib/audit-log';
import { requirePermission } from '@/lib/rbac-server';
import { recordRustFallback } from '@/lib/observability/rust-fallback-counter';
import {
    crmBankTransactionsApi,
    type CrmBankTransactionCreateInput,
    type CrmBankTransactionUpdateInput,
    type CrmBankTransactionDoc,
} from '@/lib/rust-client/crm-bank-transactions';
import { RustApiError } from '@/lib/rust-client/fetcher';

function useRustCrm(): boolean {
    return process.env.USE_RUST_CRM === 'true';
}

/* ─── Types ──────────────────────────────────────────────────────────── */

type CrmBankTransactionType = 'debit' | 'credit';

type CrmBankTransactionStatus =
    | 'pending'
    | 'cleared'
    | 'reconciled'
    | 'archived';

interface CrmBankTransaction {
    _id: ObjectId;
    userId: ObjectId;
    accountId: ObjectId;
    transactionDate: Date;
    amount: number;
    type: CrmBankTransactionType;
    description?: string;
    referenceNumber?: string;
    balanceAfter?: number;
    category?: string;
    /** Optional link to the voucher entry that produced this row. */
    voucherEntryId?: ObjectId;
    status: CrmBankTransactionStatus;
    /** Sab-file URL for the source statement (CSV/PDF). Optional. */
    sourceFileUrl?: string;
    createdAt: Date;
    updatedAt: Date;
}

interface CrmBankTransactionRow {
    _id: string;
    accountId: string;
    accountName?: string;
    transactionDate: string;
    amount: number;
    type: CrmBankTransactionType;
    description?: string;
    referenceNumber?: string;
    balanceAfter?: number;
    category?: string;
    voucherEntryId?: string;
    status: CrmBankTransactionStatus;
    sourceFileUrl?: string;
    createdAt: string;
    updatedAt: string;
}

interface CrmBankTransactionFilters {
    accountId?: string;
    status?: CrmBankTransactionStatus | 'all';
    type?: CrmBankTransactionType | 'all';
    category?: string;
    /** ISO date (inclusive). */
    from?: string;
    /** ISO date (inclusive). */
    to?: string;
    /** Free-text search over description + reference_number. */
    q?: string;
    limit?: number;
}

/* ─── Helpers ────────────────────────────────────────────────────────── */

const COLL = 'crm_bank_transactions';

const VALID_TYPES: ReadonlySet<CrmBankTransactionType> = new Set([
    'debit',
    'credit',
]);

const VALID_STATUSES: ReadonlySet<CrmBankTransactionStatus> = new Set([
    'pending',
    'cleared',
    'reconciled',
    'archived',
]);

function asString(v: FormDataEntryValue | null): string | undefined {
    if (v == null) return undefined;
    const s = String(v).trim();
    return s.length > 0 ? s : undefined;
}

function rowFromDoc(
    doc: WithId<CrmBankTransaction>,
    accountName?: string,
): CrmBankTransactionRow {
    return {
        _id: doc._id.toString(),
        accountId: doc.accountId.toString(),
        accountName,
        transactionDate: new Date(doc.transactionDate).toISOString(),
        amount: doc.amount,
        type: doc.type,
        description: doc.description,
        referenceNumber: doc.referenceNumber,
        balanceAfter: doc.balanceAfter,
        category: doc.category,
        voucherEntryId: doc.voucherEntryId?.toString(),
        status: doc.status,
        sourceFileUrl: doc.sourceFileUrl,
        createdAt: new Date(doc.createdAt).toISOString(),
        updatedAt: new Date(doc.updatedAt).toISOString(),
    };
}

function rowFromRustDoc(
    doc: CrmBankTransactionDoc,
    accountName?: string,
): CrmBankTransactionRow {
    return {
        _id: String(doc._id),
        accountId: String(doc.accountId),
        accountName,
        transactionDate: doc.transactionDate
            ? new Date(doc.transactionDate).toISOString()
            : new Date(0).toISOString(),
        amount: doc.amount ?? 0,
        type: doc.type,
        description: doc.description,
        referenceNumber: doc.referenceNumber,
        balanceAfter: doc.balanceAfter,
        category: doc.category,
        voucherEntryId: doc.voucherEntryId,
        status: doc.status,
        sourceFileUrl: doc.sourceFileUrl,
        createdAt: doc.createdAt
            ? new Date(doc.createdAt).toISOString()
            : new Date(0).toISOString(),
        updatedAt: doc.updatedAt
            ? new Date(doc.updatedAt).toISOString()
            : new Date(0).toISOString(),
    };
}

/* ─── Reads ──────────────────────────────────────────────────────────── */

export async function getCrmBankTransactions(
    filters?: CrmBankTransactionFilters,
): Promise<{ items: CrmBankTransactionRow[]; total: number }> {
    const empty = { items: [] as CrmBankTransactionRow[], total: 0 };

    const session = await getSession();
    if (!session?.user) return empty;

    const guard = await requirePermission('crm_bank_transaction', 'view');
    if (!guard.ok) return empty;

    if (useRustCrm()) {
        try {
            const res = await crmBankTransactionsApi.list({
                q: filters?.q,
                status:
                    filters?.status && filters.status !== 'all'
                        ? filters.status
                        : undefined,
                type:
                    filters?.type && filters.type !== 'all'
                        ? filters.type
                        : undefined,
                accountId: filters?.accountId,
                category: filters?.category,
                from: filters?.from,
                to: filters?.to,
                limit: filters?.limit,
            });
            const items = (res.items ?? []).map((d) => rowFromRustDoc(d));

            // Hydrate account names in a single round-trip (Rust list
            // doesn't denormalise this for us).
            try {
                const { db } = await connectToDatabase();
                const userId = new ObjectId(session.user._id);
                const accountIds = Array.from(
                    new Set(items.map((it) => it.accountId).filter(ObjectId.isValid)),
                ).map((id) => new ObjectId(id));
                if (accountIds.length > 0) {
                    const accounts = await db
                        .collection<{ _id: ObjectId; accountName: string }>(
                            'crm_payment_accounts',
                        )
                        .find({ _id: { $in: accountIds }, userId })
                        .project<{ _id: ObjectId; accountName: string }>({
                            accountName: 1,
                        })
                        .toArray();
                    const nameById = new Map<string, string>();
                    for (const a of accounts) {
                        nameById.set(a._id.toString(), a.accountName);
                    }
                    for (const it of items) {
                        it.accountName = nameById.get(it.accountId);
                    }
                }
            } catch {
                /* non-fatal — name hydration is a UX nicety */
            }

            return { items, total: items.length };
        } catch (e) {
            console.error('[getCrmBankTransactions] rust path failed; falling back:', e);
            recordRustFallback({
                entity: 'bank_transaction',
                op: 'list',
                errorCode: e instanceof RustApiError ? e.code : undefined,
                status: e instanceof RustApiError ? e.status : undefined,
            });
        }
    }

    try {
        const { db } = await connectToDatabase();
        const userId = new ObjectId(session.user._id);

        const query: Filter<CrmBankTransaction> = { userId };

        if (filters?.accountId && ObjectId.isValid(filters.accountId)) {
            query.accountId = new ObjectId(filters.accountId);
        }
        if (filters?.status && filters.status !== 'all') {
            query.status = filters.status;
        }
        if (filters?.type && filters.type !== 'all') {
            query.type = filters.type;
        }
        if (filters?.category) {
            query.category = filters.category;
        }
        if (filters?.from || filters?.to) {
            const range: Record<string, Date> = {};
            if (filters.from) {
                const d = new Date(filters.from);
                if (!Number.isNaN(d.getTime())) range.$gte = d;
            }
            if (filters.to) {
                const d = new Date(filters.to);
                if (!Number.isNaN(d.getTime())) range.$lte = d;
            }
            if (Object.keys(range).length > 0) {
                query.transactionDate = range as Filter<CrmBankTransaction>['transactionDate'];
            }
        }
        if (filters?.q) {
            const safe = filters.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const rx = new RegExp(safe, 'i');
            (query as Filter<CrmBankTransaction>).$or = [
                { description: rx },
                { referenceNumber: rx },
            ];
        }

        const limit = Math.min(Math.max(filters?.limit ?? 200, 1), 1000);

        const cursor = db
            .collection<CrmBankTransaction>(COLL)
            .find(query)
            .sort({ transactionDate: -1, _id: -1 })
            .limit(limit);

        const [docs, total] = await Promise.all([
            cursor.toArray(),
            db.collection<CrmBankTransaction>(COLL).countDocuments(query),
        ]);

        // Hydrate account names in a single round-trip.
        const accountIds = Array.from(
            new Set(docs.map((d) => d.accountId.toString())),
        ).map((id) => new ObjectId(id));
        const nameById = new Map<string, string>();
        if (accountIds.length > 0) {
            const accounts = await db
                .collection<{ _id: ObjectId; accountName: string }>(
                    'crm_payment_accounts',
                )
                .find({ _id: { $in: accountIds }, userId })
                .project<{ _id: ObjectId; accountName: string }>({ accountName: 1 })
                .toArray();
            for (const a of accounts) {
                nameById.set(a._id.toString(), a.accountName);
            }
        }

        return {
            items: docs.map((d) => rowFromDoc(d, nameById.get(d.accountId.toString()))),
            total,
        };
    } catch (e) {
        console.error('[getCrmBankTransactions] failed:', e);
        return empty;
    }
}

export async function getCrmBankTransactionById(
    id: string,
): Promise<CrmBankTransactionRow | null> {
    const session = await getSession();
    if (!session?.user || !ObjectId.isValid(id)) return null;

    const guard = await requirePermission('crm_bank_transaction', 'view');
    if (!guard.ok) return null;

    if (useRustCrm()) {
        try {
            const doc = await crmBankTransactionsApi.getById(id);
            const row = rowFromRustDoc(doc);
            // Hydrate account name (best-effort).
            try {
                const { db } = await connectToDatabase();
                const userId = new ObjectId(session.user._id);
                if (row.accountId && ObjectId.isValid(row.accountId)) {
                    const account = await db
                        .collection<{ _id: ObjectId; accountName: string }>(
                            'crm_payment_accounts',
                        )
                        .findOne({
                            _id: new ObjectId(row.accountId),
                            userId,
                        });
                    if (account?.accountName) {
                        row.accountName = account.accountName;
                    }
                }
            } catch {
                /* non-fatal */
            }
            return row;
        } catch (e) {
            console.error('[getCrmBankTransactionById] rust path failed; falling back:', e);
            recordRustFallback({
                entity: 'bank_transaction',
                op: 'get',
                errorCode: e instanceof RustApiError ? e.code : undefined,
                status: e instanceof RustApiError ? e.status : undefined,
            });
        }
    }

    try {
        const { db } = await connectToDatabase();
        const userId = new ObjectId(session.user._id);
        const doc = await db.collection<CrmBankTransaction>(COLL).findOne({
            _id: new ObjectId(id),
            userId,
        });
        if (!doc) return null;
        const account = await db
            .collection<{ _id: ObjectId; accountName: string }>('crm_payment_accounts')
            .findOne({ _id: doc.accountId, userId });
        return rowFromDoc(doc, account?.accountName);
    } catch (e) {
        console.error('[getCrmBankTransactionById] failed:', e);
        return null;
    }
}

/* ─── Writes ─────────────────────────────────────────────────────────── */

interface RawTransactionInput {
    accountId: string;
    transactionDate: string | Date;
    amount: number | string;
    type: string;
    description?: string;
    referenceNumber?: string;
    balanceAfter?: number | string;
    category?: string;
    voucherEntryId?: string;
    status?: string;
    sourceFileUrl?: string;
}

function normaliseRow(
    row: RawTransactionInput,
    userId: ObjectId,
    now: Date,
): Omit<CrmBankTransaction, '_id'> | null {
    if (!row.accountId || !ObjectId.isValid(row.accountId)) return null;
    const d =
        row.transactionDate instanceof Date
            ? row.transactionDate
            : new Date(row.transactionDate);
    if (Number.isNaN(d.getTime())) return null;
    const amount = coerceFiniteMoney(String(row.amount ?? '0'));
    const type: CrmBankTransactionType = VALID_TYPES.has(
        row.type as CrmBankTransactionType,
    )
        ? (row.type as CrmBankTransactionType)
        : amount < 0
          ? 'debit'
          : 'credit';
    const status: CrmBankTransactionStatus = VALID_STATUSES.has(
        row.status as CrmBankTransactionStatus,
    )
        ? (row.status as CrmBankTransactionStatus)
        : 'pending';
    const balanceAfter =
        row.balanceAfter == null || row.balanceAfter === ''
            ? undefined
            : coerceFiniteMoney(String(row.balanceAfter));

    return {
        userId,
        accountId: new ObjectId(row.accountId),
        transactionDate: d,
        amount: Math.abs(amount),
        type,
        description: row.description?.trim() || undefined,
        referenceNumber: row.referenceNumber?.trim() || undefined,
        balanceAfter,
        category: row.category?.trim() || undefined,
        voucherEntryId:
            row.voucherEntryId && ObjectId.isValid(row.voucherEntryId)
                ? new ObjectId(row.voucherEntryId)
                : undefined,
        status,
        sourceFileUrl: row.sourceFileUrl?.trim() || undefined,
        createdAt: now,
        updatedAt: now,
    };
}

/**
 * Create or update a single bank transaction (used by the `/new` and
 * `/[id]/edit` pages). When `id` is in the FormData (hidden input), this
 * PATCHes; otherwise it inserts. Per project policy, attachment URLs come
 * from SabFiles only — there is no free-text URL paste.
 */
export async function saveBankTransaction(
    _prev: { message?: string; error?: string; id?: string } | undefined,
    formData: FormData,
): Promise<{ message?: string; error?: string; id?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: 'Access denied.' };

    const id = asString(formData.get('id'));
    const isEditing = !!id;

    const guard = await requirePermission(
        'crm_bank_transaction',
        isEditing ? 'edit' : 'create',
    );
    if (!guard.ok) return { error: guard.error };

    const accountId = asString(formData.get('accountId'));
    if (!accountId || !ObjectId.isValid(accountId)) {
        return { error: 'Account is required.' };
    }
    const transactionDateRaw = asString(formData.get('transactionDate'));
    if (!transactionDateRaw) return { error: 'Transaction date is required.' };
    const transactionDate = new Date(transactionDateRaw);
    if (Number.isNaN(transactionDate.getTime())) {
        return { error: 'Transaction date is invalid.' };
    }

    const amountStr = asString(formData.get('amount'));
    if (!amountStr) return { error: 'Amount is required.' };
    const amount = coerceFiniteMoney(amountStr);
    if (!Number.isFinite(amount) || amount <= 0) {
        return { error: 'Amount must be a positive number.' };
    }

    const typeRaw = asString(formData.get('type')) ?? 'debit';
    if (!VALID_TYPES.has(typeRaw as CrmBankTransactionType)) {
        return { error: 'Type must be debit or credit.' };
    }
    const type = typeRaw as CrmBankTransactionType;

    const statusRaw = asString(formData.get('status')) ?? 'pending';
    if (!VALID_STATUSES.has(statusRaw as CrmBankTransactionStatus)) {
        return { error: 'Invalid status.' };
    }
    const status = statusRaw as CrmBankTransactionStatus;

    const description = asString(formData.get('description'));
    const referenceNumber = asString(formData.get('referenceNumber'));
    const category = asString(formData.get('category'));
    const balanceAfterStr = asString(formData.get('balanceAfter'));
    const balanceAfter =
        balanceAfterStr == null ? undefined : coerceFiniteMoney(balanceAfterStr);
    const sourceFileUrl = asString(formData.get('sourceFileUrl'));

    if (useRustCrm()) {
        try {
            if (isEditing) {
                if (!ObjectId.isValid(id!)) return { error: 'Invalid transaction id.' };
                const patch: CrmBankTransactionUpdateInput = {
                    accountId,
                    transactionDate: transactionDate.toISOString(),
                    amount,
                    type,
                    status,
                };
                if (description !== undefined) patch.description = description;
                if (referenceNumber !== undefined) patch.referenceNumber = referenceNumber;
                if (category !== undefined) patch.category = category;
                if (balanceAfter !== undefined && Number.isFinite(balanceAfter)) {
                    patch.balanceAfter = balanceAfter;
                }
                if (sourceFileUrl !== undefined) patch.sourceFileUrl = sourceFileUrl;

                await crmBankTransactionsApi.update(id!, patch);

                await writeAuditEntry({
                    tenantUserId: session.user._id,
                    action: 'update',
                    entityKind: 'bank_transaction',
                    entityId: id!,
                });
                revalidatePath('/dashboard/crm/banking/bank-transactions');
                revalidatePath(`/dashboard/crm/banking/bank-transactions/${id}`);
                return { message: 'Transaction updated.', id: id! };
            }

            const input: CrmBankTransactionCreateInput = {
                accountId,
                transactionDate: transactionDate.toISOString(),
                amount,
                type,
                status,
            };
            if (description) input.description = description;
            if (referenceNumber) input.referenceNumber = referenceNumber;
            if (category) input.category = category;
            if (balanceAfter !== undefined && Number.isFinite(balanceAfter)) {
                input.balanceAfter = balanceAfter;
            }
            if (sourceFileUrl) input.sourceFileUrl = sourceFileUrl;

            const created = await crmBankTransactionsApi.create(input);

            await writeAuditEntry({
                tenantUserId: session.user._id,
                action: 'create',
                entityKind: 'bank_transaction',
                entityId: created.id,
            });
            revalidatePath('/dashboard/crm/banking/bank-transactions');
            revalidatePath('/dashboard/crm/banking');
            return { message: 'Transaction created.', id: created.id };
        } catch (e) {
            console.error('[saveBankTransaction] rust path failed; falling back:', e);
            recordRustFallback({
                entity: 'bank_transaction',
                op: isEditing ? 'update' : 'create',
                errorCode: e instanceof RustApiError ? e.code : undefined,
                status: e instanceof RustApiError ? e.status : undefined,
            });
        }
    }

    try {
        const { db } = await connectToDatabase();
        const userId = new ObjectId(session.user._id);
        const now = new Date();

        if (isEditing) {
            if (!ObjectId.isValid(id!)) return { error: 'Invalid transaction id.' };
            const patch: Partial<CrmBankTransaction> = {
                accountId: new ObjectId(accountId),
                transactionDate,
                amount,
                type,
                status,
                description: description,
                referenceNumber: referenceNumber,
                category: category,
                balanceAfter,
                sourceFileUrl: sourceFileUrl,
                updatedAt: now,
            };
            const r = await db
                .collection<CrmBankTransaction>(COLL)
                .updateOne({ _id: new ObjectId(id!), userId }, { $set: patch });
            if (r.matchedCount === 0) {
                return { error: 'Transaction not found.' };
            }
            await writeAuditEntry({
                tenantUserId: session.user._id,
                action: 'update',
                entityKind: 'bank_transaction',
                entityId: id!,
            });
            revalidatePath('/dashboard/crm/banking/bank-transactions');
            revalidatePath(`/dashboard/crm/banking/bank-transactions/${id}`);
            return { message: 'Transaction updated.', id: id! };
        }

        const doc: Omit<CrmBankTransaction, '_id'> = {
            userId,
            accountId: new ObjectId(accountId),
            transactionDate,
            amount,
            type,
            description,
            referenceNumber,
            balanceAfter,
            category,
            status,
            sourceFileUrl,
            createdAt: now,
            updatedAt: now,
        };
        const r = await db
            .collection<CrmBankTransaction>(COLL)
            .insertOne(doc as CrmBankTransaction);
        await writeAuditEntry({
            tenantUserId: session.user._id,
            action: 'create',
            entityKind: 'bank_transaction',
            entityId: r.insertedId.toString(),
        });
        revalidatePath('/dashboard/crm/banking/bank-transactions');
        revalidatePath('/dashboard/crm/banking');
        return {
            message: 'Transaction created.',
            id: r.insertedId.toString(),
        };
    } catch (e) {
        return { error: getErrorMessage(e) };
    }
}

export async function importBankTransactionsCsv(
    accountId: string,
    rows: RawTransactionInput[],
    sourceFileUrl?: string,
): Promise<{ success: boolean; inserted?: number; skipped?: number; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Access denied.' };

    const guard = await requirePermission('crm_bank_transaction', 'create');
    if (!guard.ok) return { success: false, error: guard.error };

    if (!accountId || !ObjectId.isValid(accountId)) {
        return { success: false, error: 'Account id is required.' };
    }
    if (!Array.isArray(rows) || rows.length === 0) {
        return { success: false, error: 'No rows to import.' };
    }

    try {
        const { db } = await connectToDatabase();
        const userId = new ObjectId(session.user._id);
        const now = new Date();

        const docs: Omit<CrmBankTransaction, '_id'>[] = [];
        let skipped = 0;
        for (const r of rows) {
            const doc = normaliseRow(
                { ...r, accountId, sourceFileUrl: r.sourceFileUrl ?? sourceFileUrl },
                userId,
                now,
            );
            if (doc) docs.push(doc);
            else skipped += 1;
        }
        if (docs.length === 0) {
            return { success: false, error: 'No valid rows after parsing.', skipped };
        }

        const result = await db
            .collection<CrmBankTransaction>(COLL)
            .insertMany(docs as CrmBankTransaction[]);

        await writeAuditEntry({
            tenantUserId: session.user._id,
            action: 'create',
            entityKind: 'bank_transaction',
            entityId: accountId,
            reason: `csv_import:${result.insertedCount}`,
        });

        revalidatePath('/dashboard/crm/banking/bank-transactions');
        revalidatePath('/dashboard/crm/banking');
        return { success: true, inserted: result.insertedCount, skipped };
    } catch (e) {
        return { success: false, error: getErrorMessage(e) };
    }
}

export async function setBankTransactionStatus(
    id: string,
    next: CrmBankTransactionStatus,
): Promise<{ success: boolean; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Access denied.' };
    if (!ObjectId.isValid(id)) {
        return { success: false, error: 'Invalid transaction id.' };
    }
    if (!VALID_STATUSES.has(next)) {
        return { success: false, error: 'Invalid status.' };
    }

    const guard = await requirePermission('crm_bank_transaction', 'edit');
    if (!guard.ok) return { success: false, error: guard.error };

    try {
        const { db } = await connectToDatabase();
        const userId = new ObjectId(session.user._id);
        const r = await db.collection<CrmBankTransaction>(COLL).updateOne(
            { _id: new ObjectId(id), userId },
            { $set: { status: next, updatedAt: new Date() } },
        );
        if (r.matchedCount === 0) {
            return { success: false, error: 'Transaction not found.' };
        }
        await writeAuditEntry({
            tenantUserId: session.user._id,
            action: next === 'archived' ? 'archive' : 'update',
            entityKind: 'bank_transaction',
            entityId: id,
            reason: `status:${next}`,
        });
        revalidatePath('/dashboard/crm/banking/bank-transactions');
        revalidatePath(`/dashboard/crm/banking/bank-transactions/${id}`);
        return { success: true };
    } catch (e) {
        return { success: false, error: getErrorMessage(e) };
    }
}

export async function deleteBankTransaction(
    id: string,
): Promise<{ success: boolean; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Access denied.' };
    if (!ObjectId.isValid(id)) {
        return { success: false, error: 'Invalid transaction id.' };
    }

    const guard = await requirePermission('crm_bank_transaction', 'delete');
    if (!guard.ok) return { success: false, error: guard.error };

    if (useRustCrm()) {
        try {
            await crmBankTransactionsApi.delete(id);
            await writeAuditEntry({
                tenantUserId: session.user._id,
                action: 'delete',
                entityKind: 'bank_transaction',
                entityId: id,
            });
            revalidatePath('/dashboard/crm/banking/bank-transactions');
            revalidatePath('/dashboard/crm/banking');
            return { success: true };
        } catch (e) {
            console.error('[deleteBankTransaction] rust path failed; falling back:', e);
            recordRustFallback({
                entity: 'bank_transaction',
                op: 'delete',
                errorCode: e instanceof RustApiError ? e.code : undefined,
                status: e instanceof RustApiError ? e.status : undefined,
            });
        }
    }

    try {
        const { db } = await connectToDatabase();
        const userId = new ObjectId(session.user._id);
        const r = await db
            .collection<CrmBankTransaction>(COLL)
            .deleteOne({ _id: new ObjectId(id), userId });
        if (r.deletedCount === 0) {
            return { success: false, error: 'Transaction not found.' };
        }
        await writeAuditEntry({
            tenantUserId: session.user._id,
            action: 'delete',
            entityKind: 'bank_transaction',
            entityId: id,
        });
        revalidatePath('/dashboard/crm/banking/bank-transactions');
        revalidatePath('/dashboard/crm/banking');
        return { success: true };
    } catch (e) {
        return { success: false, error: getErrorMessage(e) };
    }
}

export async function bulkUpdateBankTransactions(
    ids: string[],
    op: 'archive' | 'reconcile' | 'clear' | 'delete',
): Promise<{ success: boolean; updated?: number; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Access denied.' };

    const guard = await requirePermission(
        'crm_bank_transaction',
        op === 'delete' ? 'delete' : 'edit',
    );
    if (!guard.ok) return { success: false, error: guard.error };

    const oids = ids.filter(ObjectId.isValid).map((id) => new ObjectId(id));
    if (oids.length === 0) return { success: false, error: 'No valid IDs supplied.' };

    try {
        const { db } = await connectToDatabase();
        const filter = {
            _id: { $in: oids },
            userId: new ObjectId(session.user._id),
        };

        let updated = 0;
        if (op === 'delete') {
            const r = await db.collection(COLL).deleteMany(filter);
            updated = r.deletedCount ?? 0;
        } else {
            const next: CrmBankTransactionStatus =
                op === 'archive' ? 'archived' : op === 'reconcile' ? 'reconciled' : 'cleared';
            const r = await db
                .collection(COLL)
                .updateMany(filter, { $set: { status: next, updatedAt: new Date() } });
            updated = r.modifiedCount ?? 0;
        }

        for (const id of ids) {
            await writeAuditEntry({
                tenantUserId: session.user._id,
                action: op === 'delete' ? 'delete' : op === 'archive' ? 'archive' : 'update',
                entityKind: 'bank_transaction',
                entityId: id,
                reason: `bulk:${op}`,
            });
        }
        revalidatePath('/dashboard/crm/banking/bank-transactions');
        revalidatePath('/dashboard/crm/banking');
        return { success: true, updated };
    } catch (e) {
        return { success: false, error: getErrorMessage(e) };
    }
}

/* ─── KPIs (used by bank-transactions list page) ─────────────────────── */

interface CrmBankTransactionListKpis {
  total: number;
  totalCredits: number;
  totalDebits: number;
  unreconciled: number;
  creditSum: number;
  debitSum: number;
}

export async function getCrmBankTransactionListKpis(): Promise<CrmBankTransactionListKpis> {
  const empty: CrmBankTransactionListKpis = {
    total: 0,
    totalCredits: 0,
    totalDebits: 0,
    unreconciled: 0,
    creditSum: 0,
    debitSum: 0,
  };

  const session = await getSession();
  if (!session?.user) return empty;

  const guard = await requirePermission('crm_bank_transaction', 'view');
  if (!guard.ok) return empty;

  try {
    const { db } = await connectToDatabase();
    const userId = new ObjectId(session.user._id);

    const [total, totalCredits, totalDebits, unreconciled, creditAgg, debitAgg] =
      await Promise.all([
        db.collection(COLL).countDocuments({ userId }),
        db.collection(COLL).countDocuments({ userId, type: 'credit' }),
        db.collection(COLL).countDocuments({ userId, type: 'debit' }),
        db.collection(COLL).countDocuments({
          userId,
          status: { $in: ['pending', 'cleared'] },
        }),
        db
          .collection(COLL)
          .aggregate([
            { $match: { userId, type: 'credit' } },
            { $group: { _id: null, sum: { $sum: '$amount' } } },
          ])
          .toArray(),
        db
          .collection(COLL)
          .aggregate([
            { $match: { userId, type: 'debit' } },
            { $group: { _id: null, sum: { $sum: '$amount' } } },
          ])
          .toArray(),
      ]);

    return {
      total,
      totalCredits,
      totalDebits,
      unreconciled,
      creditSum: (creditAgg[0] as { sum?: number } | undefined)?.sum ?? 0,
      debitSum: (debitAgg[0] as { sum?: number } | undefined)?.sum ?? 0,
    };
  } catch (e) {
    console.error('[getCrmBankTransactionListKpis] failed:', e);
    return empty;
  }
}

/* ─── KPIs (used by banking landing dashboard) ───────────────────────── */

interface CrmBankingDashboardKpis {
    totalAccounts: number;
    activeAccounts: number;
    bankAccounts: number;
    employeeAccounts: number;
    totalBalance: number;
    currency: string;
    pendingTransactions: number;
    reconciledTransactions: number;
    archivedTransactions: number;
    transactionsLast30: number;
}

export async function getCrmBankingDashboardKpis(): Promise<CrmBankingDashboardKpis> {
    const empty: CrmBankingDashboardKpis = {
        totalAccounts: 0,
        activeAccounts: 0,
        bankAccounts: 0,
        employeeAccounts: 0,
        totalBalance: 0,
        currency: 'INR',
        pendingTransactions: 0,
        reconciledTransactions: 0,
        archivedTransactions: 0,
        transactionsLast30: 0,
    };

    const session = await getSession();
    if (!session?.user) return empty;

    try {
        const { db } = await connectToDatabase();
        const userId = new ObjectId(session.user._id);

        const accounts = await db
            .collection<{
                accountType: 'bank' | 'cash' | 'employee' | 'wallet' | 'other';
                status: 'active' | 'inactive';
                openingBalance: number;
                currency: string;
            }>('crm_payment_accounts')
            .find({ userId })
            .project<{
                accountType: 'bank' | 'cash' | 'employee' | 'wallet' | 'other';
                status: 'active' | 'inactive';
                openingBalance: number;
                currency: string;
            }>({ accountType: 1, status: 1, openingBalance: 1, currency: 1 })
            .toArray();

        let totalBalance = 0;
        const currencyTally = new Map<string, number>();
        let active = 0;
        let bank = 0;
        let employee = 0;

        for (const a of accounts) {
            if (a.status === 'active') active += 1;
            if (a.accountType === 'bank') bank += 1;
            if (a.accountType === 'employee') employee += 1;
            totalBalance += a.openingBalance ?? 0;
            currencyTally.set(
                a.currency,
                (currencyTally.get(a.currency) ?? 0) + (a.openingBalance ?? 0),
            );
        }
        let currency = 'INR';
        let max = -Infinity;
        for (const [c, v] of currencyTally.entries()) {
            if (Math.abs(v) > max) {
                max = Math.abs(v);
                currency = c;
            }
        }

        const since = new Date();
        since.setDate(since.getDate() - 30);

        const [pending, reconciled, archived, last30] = await Promise.all([
            db.collection(COLL).countDocuments({ userId, status: 'pending' }),
            db.collection(COLL).countDocuments({ userId, status: 'reconciled' }),
            db.collection(COLL).countDocuments({ userId, status: 'archived' }),
            db.collection(COLL).countDocuments({
                userId,
                transactionDate: { $gte: since },
            }),
        ]);

        return {
            totalAccounts: accounts.length,
            activeAccounts: active,
            bankAccounts: bank,
            employeeAccounts: employee,
            totalBalance,
            currency,
            pendingTransactions: pending,
            reconciledTransactions: reconciled,
            archivedTransactions: archived,
            transactionsLast30: last30,
        };
    } catch (e) {
        console.error('[getCrmBankingDashboardKpis] failed:', e);
        return empty;
    }
}
