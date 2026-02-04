'use server';

import { connectToDatabase } from "@/lib/mongodb";
import { getDecodedSession } from "@/lib/auth";
import { cookies } from "next/headers";
import { ObjectId } from "mongodb";
import { SmsLog } from "@/lib/sms/types";

export interface GetSmsLogsParams {
    page?: number;
    limit?: number;
    status?: string;
    search?: string; // Search by phone number
}

export async function getSmsLogs({ page = 1, limit = 20, status, search }: GetSmsLogsParams) {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session_token')?.value;
    const session = await getDecodedSession(sessionToken || '');
    if (!session?.userId) return { logs: [], total: 0, totalPages: 0 };

    const { db } = await connectToDatabase();

    const query: any = { userId: new ObjectId(session.userId) };

    if (status && status !== 'ALL') {
        query.status = status;
    }

    if (search) {
        query.to = { $regex: search, $options: 'i' };
    }

    const skip = (page - 1) * limit;

    const [logs, total] = await Promise.all([
        db.collection<SmsLog>('sms_logs')
            .find(query)
            .sort({ sentAt: -1, createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .toArray(),
        db.collection('sms_logs').countDocuments(query)
    ]);

    // Serialize ObjectIds
    const serializedLogs = logs.map(log => ({
        ...log,
        _id: log._id.toString(),
        userId: log.userId.toString(),
        campaignId: log.campaignId?.toString(),
        sentAt: log.sentAt?.toISOString(),
        createdAt: log.createdAt?.toISOString(),
        updatedAt: log.updatedAt?.toISOString(),
    }));

    return {
        logs: serializedLogs,
        total,
        totalPages: Math.ceil(total / limit),
        currentPage: page
    };
}
