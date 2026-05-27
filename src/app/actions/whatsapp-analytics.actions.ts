'use server';

/**
 * WhatsApp analytics server actions.
 *
 * Each function below is a thin shim over `rustClient.wachatAnalytics.*`.
 * The contract (return-type shape) is preserved exactly so existing callers
 * — analytics dashboard pages, broadcast UIs, etc. — keep working without
 * changes. Errors from the Rust BFF are caught and reshaped into the
 * `{ error?: string }` envelope every legacy caller already handles.
 */

import { getErrorMessage } from '@/lib/utils';

// --- CONVERSATION ANALYTICS ---

type ConversationAnalyticsGranularity = 'HALF_HOUR' | 'DAILY' | 'MONTHLY';

type ConversationAnalyticsResult = {
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
    try {
        const { rustClient } = await import('@/lib/rust-client');
        const out = await rustClient.wachatAnalytics.conversationAnalytics(projectId, {
            startTimestamp,
            endTimestamp,
            granularity,
            phoneNumbers,
            countries,
            conversationCategories,
            conversationTypes,
            dimensions,
        });
        // Cast via unknown — Rust returns generic record-shaped points; the
        // caller-facing typed shape is a subset of fields Meta actually emits.
        const data_points = (out.dataPoints ?? []) as unknown as ConversationAnalyticsResult['data'] extends infer D
            ? D extends { data_points: infer P } ? P : never
            : never;
        return { data: { data_points } };
    } catch (e: unknown) {
        return { error: getErrorMessage(e) };
    }
}

// --- TEMPLATE ANALYTICS ---

type TemplateAnalyticsResult = {
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
    try {
        const { rustClient } = await import('@/lib/rust-client');
        const out = await rustClient.wachatAnalytics.templateAnalytics(projectId, {
            startTimestamp,
            endTimestamp,
            templateIds,
            granularity,
        });
        const data_points = (out.dataPoints ?? []) as unknown as TemplateAnalyticsResult['data'] extends infer D
            ? D extends { data_points: infer P } ? P : never
            : never;
        return { data: { data_points } };
    } catch (e: unknown) {
        return { error: getErrorMessage(e) };
    }
}

// --- MESSAGING LIMIT TIER ---

export async function getMessagingLimitTier(
    projectId: string,
    phoneNumberId: string
): Promise<{ tier?: string; error?: string }> {
    try {
        const { rustClient } = await import('@/lib/rust-client');
        const out = await rustClient.wachatAnalytics.messagingLimitTier(projectId, phoneNumberId);
        return { tier: out.tier };
    } catch (e: unknown) {
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
    try {
        const { rustClient } = await import('@/lib/rust-client');
        const out = await rustClient.wachatAnalytics.localMessageAnalytics(projectId, {
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString(),
        });
        return {
            totalSent: out.totalSent,
            totalDelivered: out.totalDelivered,
            totalRead: out.totalRead,
            totalFailed: out.totalFailed,
            totalIncoming: out.totalIncoming,
            dailyBreakdown: out.dailyBreakdown,
        };
    } catch (e: unknown) {
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
    try {
        const { rustClient } = await import('@/lib/rust-client');
        const out = await rustClient.wachatAnalytics.broadcastAnalytics(projectId, {
            startDate: startDate?.toISOString(),
            endDate: endDate?.toISOString(),
        });
        return {
            totalBroadcasts: out.totalBroadcasts,
            totalContacts: out.totalContacts,
            totalSuccess: out.totalSuccess,
            totalFailed: out.totalFailed,
            broadcasts: out.broadcasts.map((b) => ({
                name: b.name,
                templateName: b.templateName,
                contactCount: b.contactCount,
                successCount: b.successCount,
                failedCount: b.failedCount,
                status: b.status,
                // Server returns ISO-8601 strings; legacy callers expect Date.
                createdAt: b.createdAt ? new Date(b.createdAt) : new Date(0),
            })),
        };
    } catch (e: unknown) {
        return {
            totalBroadcasts: 0, totalContacts: 0, totalSuccess: 0, totalFailed: 0,
            broadcasts: [], error: getErrorMessage(e),
        };
    }
}
