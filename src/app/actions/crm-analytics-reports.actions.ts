'use server';

import { getSession } from '@/app/actions/user.actions';
import { connectToDatabase } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

export interface ScheduleReportPayload {
    emails: string[];
    frequency: 'daily' | 'weekly' | 'monthly';
    format: 'pdf' | 'png' | 'csv';
}

export async function scheduleAnalyticsReport(payload: ScheduleReportPayload) {
    const session = await getSession();
    if (!session?.user?._id) throw new Error('Unauthorized');

    const { db } = await connectToDatabase();
    
    await db.collection('crm_scheduled_reports').insertOne({
        tenantId: new ObjectId(session.user._id as string),
        module: 'analytics',
        emails: payload.emails,
        frequency: payload.frequency,
        format: payload.format,
        createdAt: new Date(),
        nextRunAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // next day by default
        status: 'active'
    });

    return { success: true };
}
