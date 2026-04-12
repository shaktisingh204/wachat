

'use server';

import axios from 'axios';
import { getProjectById } from './project.actions';
import { getErrorMessage } from '@/lib/utils';

const API_VERSION = 'v23.0';

// --- CONVERSATION ANALYTICS ---

export type ConversationAnalyticsGranularity = 'HALF_HOUR' | 'DAILY' | 'MONTHLY';

export type ConversationAnalyticsResult = {
    data?: {
        data_points: Array<{
            start: number;
            end: number;
            sent: number;
            delivered: number;
            conversation: number;
            conversation_type?: string;
            conversation_category?: string;
            country?: string;
            phone?: string;
            cost?: number;
        }>;
    };
    error?: string;
};

export async function getConversationAnalytics(
    projectId: string,
    startTimestamp: number,
    endTimestamp: number,
    granularity: ConversationAnalyticsGranularity = 'DAILY',
    phoneNumbers?: string[],
    countries?: string[],
    conversationCategories?: string[],
    conversationTypes?: string[],
    dimensions?: string[]
): Promise<ConversationAnalyticsResult> {
    const project = await getProjectById(projectId);
    if (!project || !project.wabaId || !project.accessToken) {
        return { error: 'Project not found or WABA not configured.' };
    }

    try {
        // Build analytics query string
        let analyticsQuery = `conversation_analytics.start(${startTimestamp}).end(${endTimestamp}).granularity(${granularity})`;

        if (phoneNumbers && phoneNumbers.length > 0) {
            analyticsQuery += `.phone_numbers([${phoneNumbers.map(p => `"${p}"`).join(',')}])`;
        }

        if (countries && countries.length > 0) {
            analyticsQuery += `.country_codes([${countries.map(c => `"${c}"`).join(',')}])`;
        }

        if (conversationCategories && conversationCategories.length > 0) {
            analyticsQuery += `.conversation_categories([${conversationCategories.map(c => `"${c}"`).join(',')}])`;
        }

        if (conversationTypes && conversationTypes.length > 0) {
            analyticsQuery += `.conversation_types([${conversationTypes.map(t => `"${t}"`).join(',')}])`;
        }

        if (dimensions && dimensions.length > 0) {
            analyticsQuery += `.dimensions([${dimensions.map(d => `"${d}"`).join(',')}])`;
        }

        const response = await axios.get(
            `https://graph.facebook.com/${API_VERSION}/${project.wabaId}`,
            {
                params: {
                    fields: analyticsQuery,
                    access_token: project.accessToken,
                },
            }
        );

        return {
            data: response.data.conversation_analytics || response.data.analytics,
        };
    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}


// --- TEMPLATE ANALYTICS ---

export type TemplateAnalyticsResult = {
    data?: {
        data_points: Array<{
            template_id: string;
            start: number;
            end: number;
            sent: number;
            delivered: number;
            read: number;
            clicked?: number;
        }>;
    };
    error?: string;
};

export async function getTemplateAnalytics(
    projectId: string,
    startTimestamp: number,
    endTimestamp: number,
    templateIds?: string[],
    granularity: ConversationAnalyticsGranularity = 'DAILY'
): Promise<TemplateAnalyticsResult> {
    const project = await getProjectById(projectId);
    if (!project || !project.wabaId || !project.accessToken) {
        return { error: 'Project not found or WABA not configured.' };
    }

    try {
        let analyticsQuery = `template_analytics.start(${startTimestamp}).end(${endTimestamp}).granularity(${granularity})`;

        if (templateIds && templateIds.length > 0) {
            analyticsQuery += `.template_ids([${templateIds.map(id => `"${id}"`).join(',')}])`;
        }

        const response = await axios.get(
            `https://graph.facebook.com/${API_VERSION}/${project.wabaId}`,
            {
                params: {
                    fields: analyticsQuery,
                    access_token: project.accessToken,
                },
            }
        );

        return {
            data: response.data.template_analytics,
        };
    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}


// --- MESSAGING LIMIT TIER ---

export async function getMessagingLimitTier(
    projectId: string,
    phoneNumberId: string
): Promise<{ tier?: string; error?: string }> {
    const project = await getProjectById(projectId);
    if (!project || !project.accessToken) {
        return { error: 'Project not found or access token is missing.' };
    }

    try {
        const response = await axios.get(
            `https://graph.facebook.com/${API_VERSION}/${phoneNumberId}`,
            {
                params: {
                    fields: 'messaging_limit_tier',
                    access_token: project.accessToken,
                },
            }
        );

        return { tier: response.data.messaging_limit_tier };
    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}


// --- LOCAL ANALYTICS (from MongoDB) ---

export async function getLocalMessageAnalytics(
    projectId: string,
    startDate: Date,
    endDate: Date
): Promise<{
    totalSent: number;
    totalDelivered: number;
    totalRead: number;
    totalFailed: number;
    totalIncoming: number;
    dailyBreakdown: Array<{
        date: string;
        sent: number;
        delivered: number;
        read: number;
        failed: number;
        incoming: number;
    }>;
    error?: string;
}> {
    const project = await getProjectById(projectId);
    if (!project) {
        return { totalSent: 0, totalDelivered: 0, totalRead: 0, totalFailed: 0, totalIncoming: 0, dailyBreakdown: [], error: 'Project not found.' };
    }

    try {
        const { connectToDatabase } = await import('@/lib/mongodb');
        const { ObjectId } = await import('mongodb');
        const { db } = await connectToDatabase();

        const projectObjectId = new ObjectId(projectId);

        // Aggregate outgoing messages
        const outgoingStats = await db.collection('outgoing_messages').aggregate([
            {
                $match: {
                    projectId: projectObjectId,
                    messageTimestamp: { $gte: startDate, $lte: endDate },
                },
            },
            {
                $group: {
                    _id: {
                        date: { $dateToString: { format: '%Y-%m-%d', date: '$messageTimestamp' } },
                        status: '$status',
                    },
                    count: { $sum: 1 },
                },
            },
        ]).toArray();

        // Aggregate incoming messages
        const incomingStats = await db.collection('incoming_messages').aggregate([
            {
                $match: {
                    projectId: projectObjectId,
                    messageTimestamp: { $gte: startDate, $lte: endDate },
                },
            },
            {
                $group: {
                    _id: { $dateToString: { format: '%Y-%m-%d', date: '$messageTimestamp' } },
                    count: { $sum: 1 },
                },
            },
        ]).toArray();

        // Build daily breakdown
        const dailyMap: Record<string, { sent: number; delivered: number; read: number; failed: number; incoming: number }> = {};

        for (const stat of outgoingStats) {
            const date = stat._id.date;
            if (!dailyMap[date]) dailyMap[date] = { sent: 0, delivered: 0, read: 0, failed: 0, incoming: 0 };

            switch (stat._id.status) {
                case 'sent':
                    dailyMap[date].sent += stat.count;
                    break;
                case 'delivered':
                    dailyMap[date].delivered += stat.count;
                    break;
                case 'read':
                    dailyMap[date].read += stat.count;
                    break;
                case 'failed':
                    dailyMap[date].failed += stat.count;
                    break;
            }
        }

        for (const stat of incomingStats) {
            const date = stat._id;
            if (!dailyMap[date]) dailyMap[date] = { sent: 0, delivered: 0, read: 0, failed: 0, incoming: 0 };
            dailyMap[date].incoming += stat.count;
        }

        const dailyBreakdown = Object.entries(dailyMap)
            .map(([date, stats]) => ({ date, ...stats }))
            .sort((a, b) => a.date.localeCompare(b.date));

        const totals = dailyBreakdown.reduce(
            (acc, day) => ({
                totalSent: acc.totalSent + day.sent,
                totalDelivered: acc.totalDelivered + day.delivered,
                totalRead: acc.totalRead + day.read,
                totalFailed: acc.totalFailed + day.failed,
                totalIncoming: acc.totalIncoming + day.incoming,
            }),
            { totalSent: 0, totalDelivered: 0, totalRead: 0, totalFailed: 0, totalIncoming: 0 }
        );

        return { ...totals, dailyBreakdown };
    } catch (e: any) {
        return {
            totalSent: 0, totalDelivered: 0, totalRead: 0, totalFailed: 0, totalIncoming: 0,
            dailyBreakdown: [], error: getErrorMessage(e),
        };
    }
}

export async function getBroadcastAnalytics(
    projectId: string,
    startDate?: Date,
    endDate?: Date
): Promise<{
    totalBroadcasts: number;
    totalContacts: number;
    totalSuccess: number;
    totalFailed: number;
    broadcasts: Array<{
        name: string;
        templateName: string;
        contactCount: number;
        successCount: number;
        failedCount: number;
        status: string;
        createdAt: Date;
    }>;
    error?: string;
}> {
    const project = await getProjectById(projectId);
    if (!project) {
        return { totalBroadcasts: 0, totalContacts: 0, totalSuccess: 0, totalFailed: 0, broadcasts: [], error: 'Project not found.' };
    }

    try {
        const { connectToDatabase } = await import('@/lib/mongodb');
        const { ObjectId } = await import('mongodb');
        const { db } = await connectToDatabase();

        const filter: any = { projectId: new ObjectId(projectId) };
        if (startDate || endDate) {
            filter.createdAt = {};
            if (startDate) filter.createdAt.$gte = startDate;
            if (endDate) filter.createdAt.$lte = endDate;
        }

        const broadcasts = await db.collection('broadcasts')
            .find(filter)
            .sort({ createdAt: -1 })
            .limit(100)
            .toArray();

        const totals = broadcasts.reduce(
            (acc, b) => ({
                totalContacts: acc.totalContacts + (b.contactCount || 0),
                totalSuccess: acc.totalSuccess + (b.successCount || 0),
                totalFailed: acc.totalFailed + (b.failedCount || 0),
            }),
            { totalContacts: 0, totalSuccess: 0, totalFailed: 0 }
        );

        return {
            totalBroadcasts: broadcasts.length,
            ...totals,
            broadcasts: broadcasts.map(b => ({
                name: b.name,
                templateName: b.templateName,
                contactCount: b.contactCount || 0,
                successCount: b.successCount || 0,
                failedCount: b.failedCount || 0,
                status: b.status,
                createdAt: b.createdAt,
            })),
        };
    } catch (e: any) {
        return {
            totalBroadcasts: 0, totalContacts: 0, totalSuccess: 0, totalFailed: 0,
            broadcasts: [], error: getErrorMessage(e),
        };
    }
}
