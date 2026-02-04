
'use server';

import { connectToDatabase } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { getDecodedSession } from '@/lib/auth';
import { cookies } from 'next/headers';

export async function getSmsAnalytics() {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session_token')?.value;
    const session = await getDecodedSession(sessionToken || '');

    if (!session?.userId) return { stats: null, daily: [] };
    const userId = new ObjectId(session.userId);

    const { db } = await connectToDatabase();

    // 1. Overall Stats
    const stats = await db.collection('sms_logs').aggregate([
        { $match: { userId } },
        {
            $group: {
                _id: null,
                total: { $sum: 1 },
                sent: { $sum: { $cond: [{ $eq: ["$status", "SENT"] }, 1, 0] } },
                delivered: { $sum: { $cond: [{ $eq: ["$status", "DELIVERED"] }, 1, 0] } },
                failed: { $sum: { $cond: [{ $in: ["$status", ["FAILED", "UNDELIVERED"]] }, 1, 0] } },
                queued: { $sum: { $cond: [{ $eq: ["$status", "QUEUED"] }, 1, 0] } }
            }
        }
    ]).toArray();

    // 2. Daily Volume (Last 7 Days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const daily = await db.collection('sms_logs').aggregate([
        {
            $match: {
                userId,
                createdAt: { $gte: sevenDaysAgo }
            }
        },
        {
            $group: {
                _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
                count: { $sum: 1 },
                failed: { $sum: { $cond: [{ $in: ["$status", ["FAILED", "UNDELIVERED"]] }, 1, 0] } }
            }
        },
        { $sort: { _id: 1 } }
    ]).toArray();

    return {
        stats: stats[0] || { total: 0, sent: 0, delivered: 0, failed: 0, queued: 0 },
        daily: daily.map(d => ({ date: d._id, count: d.count, failed: d.failed }))
    };
}
