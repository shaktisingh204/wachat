'use server';

import { revalidatePath } from 'next/cache';
import { type Db, ObjectId, type WithId, Filter } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';
import type { CrmVoucherBook, CrmVoucherEntry } from '@/lib/definitions';
import { getErrorMessage } from '@/lib/utils';
import { writeAuditEntry } from '@/lib/audit-log';
import { recordRustFallback } from '@/lib/observability/rust-fallback-counter';
import { crmVoucherBooksApi } from '@/lib/rust-client/crm-vouchers';
import { crmVoucherEntriesApi } from '@/lib/rust-client/crm-voucher-entries';
import { RustApiError } from '@/lib/rust-client/fetcher';

function useRustCrm(): boolean {
    return process.env.USE_RUST_CRM === 'true';
}

export async function getVoucherBooks(): Promise<WithId<CrmVoucherBook>[]> {
    const session = await getSession();
    if (!session?.user) return [];

    try {
        const { db } = await connectToDatabase();
        const userId = new ObjectId(session.user._id);
        // Enrich with entry counts + last entry date for KPI strip + columns.
        const books = await db.collection<CrmVoucherBook>('crm_voucher_books').aggregate([
            { $match: { userId } },
            { $sort: { createdAt: -1 } },
            {
                $lookup: {
                    from: 'crm_voucher_entries',
                    let: { bid: '$_id' },
                    pipeline: [
                        { $match: { $expr: { $eq: ['$voucherBookId', '$$bid'] } } },
                        { $group: { _id: null, count: { $sum: 1 }, lastDate: { $max: '$date' } } },
                    ],
                    as: '_stats',
                },
            },
            {
                $addFields: {
                    entryCount: { $ifNull: [{ $arrayElemAt: ['$_stats.count', 0] }, 0] },
                    lastEntryDate: { $arrayElemAt: ['$_stats.lastDate', 0] },
                },
            },
            { $project: { _stats: 0 } },
        ]).toArray();
        return JSON.parse(JSON.stringify(books));
    } catch (e) {
        console.error("Failed to fetch CRM Voucher Books:", e);
        return [];
    }
}

export async function getVoucherBookById(bookId: string): Promise<WithId<CrmVoucherBook> | null> {
    const session = await getSession();
    if (!session?.user || !ObjectId.isValid(bookId)) return null;

    if (useRustCrm()) {
        try {
            const doc = await crmVoucherBooksApi.getById(bookId);
            return JSON.parse(JSON.stringify(doc));
        } catch (e) {
            console.error('[getVoucherBookById] rust path failed; falling back:', e);
            recordRustFallback({
                entity: 'voucher_book',
                op: 'get',
                errorCode: e instanceof RustApiError ? e.code : undefined,
                status: e instanceof RustApiError ? e.status : undefined,
            });
        }
    }

    try {
        const { db } = await connectToDatabase();
        const book = await db.collection<CrmVoucherBook>('crm_voucher_books').findOne({
            _id: new ObjectId(bookId),
            userId: new ObjectId(session.user._id),
        });
        return book ? JSON.parse(JSON.stringify(book)) : null;
    } catch (e) {
        console.error('Failed to fetch voucher book by ID:', e);
        return null;
    }
}

export async function getVoucherEntryById(id: string): Promise<WithId<CrmVoucherEntry> | null> {
    const session = await getSession();
    if (!session?.user || !ObjectId.isValid(id)) return null;

    if (useRustCrm()) {
        try {
            const doc = await crmVoucherEntriesApi.getById(id);
            return JSON.parse(JSON.stringify(doc));
        } catch (e) {
            console.error('[getVoucherEntryById] rust path failed; falling back:', e);
            recordRustFallback({
                entity: 'voucher_entry',
                op: 'get',
                errorCode: e instanceof RustApiError ? e.code : undefined,
                status: e instanceof RustApiError ? e.status : undefined,
            });
        }
    }

    try {
        const { db } = await connectToDatabase();
        const entry = await db.collection<CrmVoucherEntry>('crm_voucher_entries').findOne({
            _id: new ObjectId(id),
            userId: new ObjectId(session.user._id),
        });
        return entry ? JSON.parse(JSON.stringify(entry)) : null;
    } catch (e) {
        console.error('Failed to fetch voucher entry by ID:', e);
        return null;
    }
}

export async function getVoucherEntriesByBook(bookId: string, limit = 50): Promise<WithId<CrmVoucherEntry>[]> {
    const session = await getSession();
    if (!session?.user || !ObjectId.isValid(bookId)) return [];
    try {
        const { db } = await connectToDatabase();
        const entries = await db.collection<CrmVoucherEntry>('crm_voucher_entries')
            .find({
                userId: new ObjectId(session.user._id),
                voucherBookId: new ObjectId(bookId),
            })
            .sort({ date: -1, createdAt: -1 })
            .limit(limit)
            .toArray();
        return JSON.parse(JSON.stringify(entries));
    } catch (e) {
        console.error('Failed to fetch voucher entries for book:', e);
        return [];
    }
}

export async function saveVoucherBook(prevState: any, formData: FormData): Promise<{ message?: string; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: "Access denied" };

    const bookId = (formData.get('voucherBookId') as string | null) || (formData.get('bookId') as string | null);
    const isEditing = !!bookId && ObjectId.isValid(bookId);

    try {
        const name = (formData.get('voucherBookName') as string) || (formData.get('name') as string);
        const type = (formData.get('voucherBookType') as CrmVoucherBook['type']) || (formData.get('type') as CrmVoucherBook['type']);
        const isDefault = formData.get('isDefault') === 'on' || formData.get('isDefault') === 'true';
        const prefix = formData.get('prefix') as string | null;
        const suffix = formData.get('suffix') as string | null;
        const startingNumberStr = formData.get('startingNumber') as string | null;
        const paddingStr = formData.get('padding') as string | null;
        const resetFrequency = formData.get('resetFrequency') as string | null;
        const approvalRequired = formData.get('approvalRequired') === 'on' || formData.get('approvalRequired') === 'true';
        const isActive = formData.get('isActive') !== null
            ? (formData.get('isActive') === 'on' || formData.get('isActive') === 'true')
            : true;

        if (!name || !type) {
            return { error: 'Name and type are required.' };
        }

        const bookData: any = {
            userId: new ObjectId(session.user._id),
            name,
            type,
            isDefault,
            prefix: prefix || undefined,
            suffix: suffix || undefined,
            startingNumber: startingNumberStr ? Math.max(0, parseInt(startingNumberStr, 10) || 0) : undefined,
            padding: paddingStr ? Math.max(0, parseInt(paddingStr, 10) || 0) : undefined,
            resetFrequency: (resetFrequency as 'none' | 'yearly' | 'monthly' | null) || 'none',
            approvalRequired,
            isActive,
            updatedAt: new Date(),
        };

        const { db } = await connectToDatabase();

        // If this book is being set as default, ensure no other book of the same type stays default.
        if (isDefault) {
            await db.collection('crm_voucher_books').updateMany(
                { userId: bookData.userId, type, ...(isEditing ? { _id: { $ne: new ObjectId(bookId!) } } : {}) },
                { $set: { isDefault: false } },
            );
        }

        let savedId: string;
        if (isEditing) {
            await db.collection('crm_voucher_books').updateOne(
                { _id: new ObjectId(bookId!), userId: bookData.userId },
                { $set: bookData },
            );
            savedId = bookId!;
        } else {
            const result = await db.collection('crm_voucher_books').insertOne({
                ...bookData,
                createdAt: new Date(),
            } as CrmVoucherBook);
            savedId = result.insertedId.toString();
        }

        await writeAuditEntry({
            tenantUserId: session.user._id,
            action: isEditing ? 'update' : 'create',
            entityKind: 'voucher_book',
            entityId: savedId,
            reason: name,
        });

        revalidatePath('/dashboard/crm/accounting/vouchers');
        revalidatePath(`/dashboard/crm/accounting/vouchers/${savedId}`);
        return { message: 'Voucher Book saved successfully.' };

    } catch (e) {
        return { error: getErrorMessage(e) };
    }
}

export async function deleteVoucherBook(bookId: string): Promise<{ success: boolean; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Access denied' };
    if (!bookId || !ObjectId.isValid(bookId)) return { success: false, error: 'Invalid Book ID' };

    try {
        const { db } = await connectToDatabase();
        const usage = await db.collection('crm_voucher_entries').countDocuments({
            userId: new ObjectId(session.user._id),
            voucherBookId: new ObjectId(bookId),
        });
        if (usage > 0) {
            return { success: false, error: `Cannot delete — this book has ${usage} voucher entries. Archive it instead.` };
        }
        await db.collection('crm_voucher_books').deleteOne({
            _id: new ObjectId(bookId),
            userId: new ObjectId(session.user._id),
        });
        await writeAuditEntry({
            tenantUserId: session.user._id,
            action: 'delete',
            entityKind: 'voucher_book',
            entityId: bookId,
        });
        revalidatePath('/dashboard/crm/accounting/vouchers');
        return { success: true };
    } catch (e) {
        return { success: false, error: getErrorMessage(e) };
    }
}

export async function bulkUpdateVoucherBooks(
    ids: string[],
    op: 'archive' | 'activate' | 'delete'
): Promise<{ success: boolean; updated?: number; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Access denied' };
    const oids = ids.filter(ObjectId.isValid).map((id) => new ObjectId(id));
    if (oids.length === 0) return { success: false, error: 'No valid IDs supplied' };
    try {
        const { db } = await connectToDatabase();
        const filter = { _id: { $in: oids }, userId: new ObjectId(session.user._id) };
        let updated = 0;
        if (op === 'delete') {
            // Block deletion of books with entries — same guard as deleteVoucherBook.
            const usedIds = (await db
                .collection('crm_voucher_entries')
                .aggregate([
                    { $match: { userId: filter.userId, voucherBookId: { $in: oids } } },
                    { $group: { _id: '$voucherBookId' } },
                ])
                .toArray()).map((r) => (r._id as ObjectId).toString());
            const deletable = oids.filter((id) => !usedIds.includes(id.toString()));
            if (deletable.length === 0) {
                return { success: false, error: 'All selected books have entries; cannot delete.' };
            }
            const r = await db.collection('crm_voucher_books').deleteMany({ ...filter, _id: { $in: deletable } });
            updated = r.deletedCount ?? 0;
        } else {
            const r = await db
                .collection('crm_voucher_books')
                .updateMany(filter, { $set: { isActive: op === 'activate' } });
            updated = r.modifiedCount ?? 0;
        }
        for (const id of ids) {
            await writeAuditEntry({
                tenantUserId: session.user._id,
                action: op === 'delete' ? 'delete' : op === 'archive' ? 'archive' : 'restore',
                entityKind: 'voucher_book',
                entityId: id,
                reason: 'bulk',
            });
        }
        revalidatePath('/dashboard/crm/accounting/vouchers');
        return { success: true, updated };
    } catch (e) {
        return { success: false, error: getErrorMessage(e) };
    }
}

export async function saveVoucherEntry(prevState: any, formData: FormData): Promise<{ message?: string; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: 'Access denied' };

    try {
        const debitEntries = JSON.parse(formData.get('debitEntries') as string || '[]');
        const creditEntries = JSON.parse(formData.get('creditEntries') as string || '[]');

        const totalDebit = debitEntries.reduce((sum: number, item: any) => sum + Number(item.amount), 0);
        const totalCredit = creditEntries.reduce((sum: number, item: any) => sum + Number(item.amount), 0);

        if (Math.abs(totalDebit - totalCredit) > 0.01) { // Use a small tolerance for floating point
            return { error: 'Debit and Credit totals must match.' };
        }

        const entryData: Omit<CrmVoucherEntry, '_id' | 'createdAt'> = {
            userId: new ObjectId(session.user._id),
            voucherBookId: new ObjectId(formData.get('voucherBookId') as string), // Assuming this will be passed
            voucherNumber: formData.get('voucherNumber') as string,
            date: new Date(formData.get('date') as string),
            note: formData.get('note') as string,
            debitEntries: debitEntries.map((e: any) => ({ ...e, accountId: new ObjectId(e.accountId) })),
            creditEntries: creditEntries.map((e: any) => ({ ...e, accountId: new ObjectId(e.accountId) })),
            totalDebit,
            totalCredit
        };

        if (!entryData.voucherBookId || !entryData.voucherNumber || !entryData.date) {
            return { error: 'Voucher book, number, and date are required.' };
        }

        const { db } = await connectToDatabase();
        await db.collection('crm_voucher_entries').insertOne({ ...entryData, createdAt: new Date() } as CrmVoucherEntry);

        revalidatePath('/dashboard/crm/accounting/vouchers');
        return { message: 'Voucher entry created successfully.' };

    } catch (e) {
        return { error: getErrorMessage(e) };
    }
}
