'use server';

import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';
import { ObjectId } from 'mongodb';
import { revalidatePath } from 'next/cache';
import { getErrorMessage } from '@/lib/utils';
import { writeAuditEntry } from '@/lib/audit-log';

export async function getPaginatedVoucherBooks(searchParams: any) {
    const session = await getSession();
    if (!session?.user) return { rows: [], totalCount: 0 };

    const { db } = await connectToDatabase();
    const userId = new ObjectId(session.user._id);

    const match: any = { userId };
    
    if (searchParams.search) {
        match.name = { $regex: searchParams.search, $options: 'i' };
    }
    if (searchParams.type && searchParams.type !== 'all') {
        match.type = searchParams.type;
    }
    if (searchParams.status === 'active') {
        match.isActive = { $ne: false };
    }
    if (searchParams.status === 'inactive') {
        match.isActive = false;
    }
    if (searchParams.defaultOnly === 'yes') {
        match.isDefault = true;
    }
    if (searchParams.defaultOnly === 'no') {
        match.isDefault = { $ne: true };
    }
    if (searchParams.approval === 'yes') {
        match.approvalRequired = true;
    }
    if (searchParams.approval === 'no') {
        match.approvalRequired = { $ne: true };
    }

    const page = parseInt(searchParams.page) || 1;
    const limit = parseInt(searchParams.limit) || 10;
    const skip = (page - 1) * limit;

    const pipeline = [
        { $match: match },
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
        { $facet: {
            data: [{ $skip: skip }, { $limit: limit }],
            totalCount: [{ $count: "count" }]
        }}
    ];

    const result = await db.collection('crm_voucher_books').aggregate(pipeline).toArray();
    
    const rows = result[0]?.data || [];
    const totalCount = result[0]?.totalCount[0]?.count || 0;

    return { rows: JSON.parse(JSON.stringify(rows)), totalCount };
}

export async function getPendingVouchers() {
    const session = await getSession();
    if (!session?.user) return [];

    const { db } = await connectToDatabase();
    const userId = new ObjectId(session.user._id);

    // Assuming pending entries have approvalStatus: 'pending'
    const pending = await db.collection('crm_voucher_entries').aggregate([
        { $match: { userId, approvalStatus: 'pending' } },
        { $lookup: {
            from: 'crm_voucher_books',
            localField: 'voucherBookId',
            foreignField: '_id',
            as: 'book'
        }},
        { $unwind: { path: '$book', preserveNullAndEmptyArrays: true } }
    ]).toArray();

    return JSON.parse(JSON.stringify(pending));
}

export async function bulkApproveVouchers(ids: string[]) {
    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Access denied' };
    
    try {
        const { db } = await connectToDatabase();
        const userId = new ObjectId(session.user._id);

        const oids = ids.map(id => new ObjectId(id));
        
        await db.collection('crm_voucher_entries').updateMany(
            { _id: { $in: oids }, userId },
            { $set: { approvalStatus: 'approved', updatedAt: new Date() } }
        );
        
        for (const id of ids) {
            await writeAuditEntry({
                tenantUserId: session.user._id,
                action: 'update',
                entityKind: 'voucher_entry',
                entityId: id,
                reason: 'bulk approve',
            });
        }
        
        revalidatePath('/dashboard/crm/accounting/vouchers');
        return { success: true };
    } catch (e) {
        return { success: false, error: getErrorMessage(e) };
    }
}
