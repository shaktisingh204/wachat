'use server';

import { connectToDatabase } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { getSession } from '@/app/actions/user.actions';

export type CommandCenterData = {
    stats: {
        totalMessages: number;
        totalSent: number;
        totalFailed: number;
        totalDelivered: number;
        totalRead: number;
        totalCampaigns: number;
        totalContacts: number;
        totalFlows: number;
        activeFlows: number;
        totalLeads: number;
        totalDeals: number;
        totalSabChatSessions: number;
        credits: number;
        planName: string | null;
    };
    velocity: {
        messagesLast24h: number;
        messagesPrev24h: number;
        broadcastsLast7d: number;
        contactsLast7d: number;
        leadsLast7d: number;
    };
    chart30d: Array<{ date: string; sent: number; delivered: number; read: number; failed: number }>;
    recentBroadcasts: Array<{
        _id: string;
        name: string;
        templateName?: string;
        status: string;
        createdAt: string;
        successCount: number;
        errorCount: number;
        totalContacts: number;
    }>;
    recentActivity: Array<{
        _id: string;
        action: string;
        details: any;
        createdAt: string;
        userName: string;
    }>;
    unreadNotifications: Array<{
        _id: string;
        message: string;
        eventType: string;
        isRead: boolean;
        createdAt: string;
    }>;
    insights: string[];
    project: {
        _id: string;
        name: string;
        createdAt: string;
    } | null;
};

const EMPTY: CommandCenterData = {
    stats: {
        totalMessages: 0,
        totalSent: 0,
        totalFailed: 0,
        totalDelivered: 0,
        totalRead: 0,
        totalCampaigns: 0,
        totalContacts: 0,
        totalFlows: 0,
        activeFlows: 0,
        totalLeads: 0,
        totalDeals: 0,
        totalSabChatSessions: 0,
        credits: 0,
        planName: null,
    },
    velocity: {
        messagesLast24h: 0,
        messagesPrev24h: 0,
        broadcastsLast7d: 0,
        contactsLast7d: 0,
        leadsLast7d: 0,
    },
    chart30d: [],
    recentBroadcasts: [],
    recentActivity: [],
    unreadNotifications: [],
    insights: [],
    project: null,
};

function fmtDate(d: Date) {
    return d.toISOString().slice(0, 10);
}

export async function getCommandCenterData(projectId: string): Promise<CommandCenterData> {
    if (!projectId || !ObjectId.isValid(projectId)) return EMPTY;

    try {
        const session = await getSession();
        if (!session?.user) return EMPTY;

        const { db } = await connectToDatabase();
        const pid = new ObjectId(projectId);

        const now = new Date();
        const t24 = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const t48 = new Date(now.getTime() - 48 * 60 * 60 * 1000);
        const t7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const t30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        t30d.setHours(0, 0, 0, 0);

        const outgoing = db.collection('outgoing_messages');
        const broadcasts = db.collection('broadcasts');
        const contacts = db.collection('contacts');
        const flows = db.collection('flows');
        const crmLeads = db.collection('crm_leads');
        const crmDeals = db.collection('crm_deals');
        const sabchatSessions = db.collection('sabchat_sessions');
        const notifications = db.collection('notifications');
        const activityLogs = db.collection('activity_logs');
        const projects = db.collection('projects');

        const [
            totalMessages,
            totalSent,
            totalDelivered,
            totalRead,
            totalFailed,
            totalCampaigns,
            totalContacts,
            totalFlowsCount,
            activeFlowsCount,
            totalLeads,
            totalDeals,
            totalSabChatSessions,
            messagesLast24h,
            messagesPrev24h,
            broadcastsLast7d,
            contactsLast7d,
            leadsLast7d,
            chartRaw,
            recentBroadcastsRaw,
            recentActivityRaw,
            unreadNotificationsRaw,
            projectDoc,
        ] = await Promise.all([
            outgoing.countDocuments({ projectId: pid }),
            outgoing.countDocuments({ projectId: pid, status: { $in: ['sent', 'delivered', 'read'] } }),
            outgoing.countDocuments({ projectId: pid, status: { $in: ['delivered', 'read'] } }),
            outgoing.countDocuments({ projectId: pid, status: 'read' }),
            outgoing.countDocuments({ projectId: pid, status: 'failed' }),
            broadcasts.countDocuments({ projectId: pid }),
            contacts.countDocuments({ projectId: pid }),
            flows.countDocuments({ projectId: pid }),
            flows.countDocuments({ projectId: pid, status: { $in: ['active', 'enabled', 'published'] } }),
            crmLeads.countDocuments({ projectId: pid }).catch(() => 0),
            crmDeals.countDocuments({ projectId: pid }).catch(() => 0),
            sabchatSessions.countDocuments({ projectId: pid }).catch(() => 0),
            outgoing.countDocuments({ projectId: pid, createdAt: { $gte: t24 } }),
            outgoing.countDocuments({ projectId: pid, createdAt: { $gte: t48, $lt: t24 } }),
            broadcasts.countDocuments({ projectId: pid, createdAt: { $gte: t7d } }),
            contacts.countDocuments({ projectId: pid, createdAt: { $gte: t7d } }).catch(() => 0),
            crmLeads.countDocuments({ projectId: pid, createdAt: { $gte: t7d } }).catch(() => 0),

            outgoing.aggregate([
                { $match: { projectId: pid, createdAt: { $gte: t30d } } },
                {
                    $project: {
                        date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
                        status: 1,
                    },
                },
                {
                    $group: {
                        _id: '$date',
                        sent: { $sum: { $cond: [{ $in: ['$status', ['sent', 'delivered', 'read']] }, 1, 0] } },
                        delivered: { $sum: { $cond: [{ $in: ['$status', ['delivered', 'read']] }, 1, 0] } },
                        read: { $sum: { $cond: [{ $eq: ['$status', 'read'] }, 1, 0] } },
                        failed: { $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] } },
                    },
                },
                { $sort: { _id: 1 } },
            ]).toArray(),

            broadcasts
                .find({ projectId: pid })
                .sort({ createdAt: -1 })
                .limit(5)
                .toArray(),

            activityLogs
                .aggregate([
                    { $match: { projectId: pid } },
                    { $sort: { createdAt: -1 } },
                    { $limit: 8 },
                    {
                        $lookup: {
                            from: 'users',
                            localField: 'userId',
                            foreignField: '_id',
                            as: 'user',
                        },
                    },
                    { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
                ])
                .toArray(),

            notifications
                .find({ projectId: pid, isRead: { $ne: true } })
                .sort({ createdAt: -1 })
                .limit(5)
                .toArray(),

            projects.aggregate([
                { $match: { _id: pid } },
                {
                    $lookup: {
                        from: 'plans',
                        localField: 'planId',
                        foreignField: '_id',
                        as: 'plan',
                    },
                },
                { $unwind: { path: '$plan', preserveNullAndEmptyArrays: true } },
                { $limit: 1 },
            ]).next(),
        ]);

        const chartMap = new Map<string, any>(chartRaw.map((r: any) => [r._id, r]));
        const chart30d: CommandCenterData['chart30d'] = [];
        for (let i = 29; i >= 0; i--) {
            const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
            const key = fmtDate(d);
            const r = chartMap.get(key);
            chart30d.push({
                date: key,
                sent: r?.sent ?? 0,
                delivered: r?.delivered ?? 0,
                read: r?.read ?? 0,
                failed: r?.failed ?? 0,
            });
        }

        const recentBroadcasts = recentBroadcastsRaw.map((b: any) => ({
            _id: b._id.toString(),
            name: b.fileName || b.name || 'Untitled Broadcast',
            templateName: b.templateName,
            status: b.status || 'unknown',
            createdAt: (b.createdAt instanceof Date ? b.createdAt : new Date(b.createdAt)).toISOString(),
            successCount: b.successCount || 0,
            errorCount: b.errorCount || 0,
            totalContacts: b.contactCount || b.totalContacts || 0,
        }));

        const recentActivity = recentActivityRaw.map((a: any) => ({
            _id: a._id.toString(),
            action: a.action || 'unknown',
            details: a.details || {},
            createdAt: (a.createdAt instanceof Date ? a.createdAt : new Date(a.createdAt || Date.now())).toISOString(),
            userName: a.user?.name || a.user?.email || 'System',
        }));

        const unreadNotifications = unreadNotificationsRaw.map((n: any) => ({
            _id: n._id.toString(),
            message: n.message || n.title || '',
            eventType: n.eventType || 'info',
            isRead: !!n.isRead,
            createdAt: (n.createdAt instanceof Date ? n.createdAt : new Date(n.createdAt || Date.now())).toISOString(),
        }));

        // Generate insights
        const insights: string[] = [];
        if (totalCampaigns === 0) {
            insights.push('You have not sent any broadcasts yet. Start your first campaign to reach your contacts.');
        }
        if (totalContacts === 0) {
            insights.push('No contacts yet. Import a CSV or add contacts from the Wachat contacts page.');
        }
        if (totalSent > 0) {
            const deliveryRate = (totalDelivered / totalSent) * 100;
            if (deliveryRate < 70) {
                insights.push(`Delivery rate is ${deliveryRate.toFixed(1)}%. Review failed sends and template quality.`);
            } else if (deliveryRate > 95) {
                insights.push(`Excellent delivery rate: ${deliveryRate.toFixed(1)}%. Your templates are healthy.`);
            }
        }
        if (messagesLast24h > messagesPrev24h * 2 && messagesPrev24h > 0) {
            insights.push(`Message volume doubled in the last 24h (${messagesLast24h} vs ${messagesPrev24h}).`);
        }
        if (totalFlowsCount > 0 && activeFlowsCount === 0) {
            insights.push(`You have ${totalFlowsCount} flow(s) but none are active. Publish one to automate replies.`);
        }
        if (totalLeads > 0 && totalDeals === 0) {
            insights.push(`${totalLeads} lead(s) captured but no deals created. Move qualified leads into the pipeline.`);
        }
        if (broadcastsLast7d === 0 && totalCampaigns > 0) {
            insights.push('No broadcasts sent in the last 7 days. Keep your audience engaged with a fresh campaign.');
        }

        const planName = projectDoc?.plan?.name || null;
        const credits = projectDoc?.credits || 0;

        return {
            stats: {
                totalMessages,
                totalSent,
                totalFailed,
                totalDelivered,
                totalRead,
                totalCampaigns,
                totalContacts,
                totalFlows: totalFlowsCount,
                activeFlows: activeFlowsCount,
                totalLeads,
                totalDeals,
                totalSabChatSessions,
                credits,
                planName,
            },
            velocity: {
                messagesLast24h,
                messagesPrev24h,
                broadcastsLast7d,
                contactsLast7d,
                leadsLast7d,
            },
            chart30d,
            recentBroadcasts,
            recentActivity,
            unreadNotifications,
            insights,
            project: projectDoc
                ? {
                      _id: projectDoc._id.toString(),
                      name: projectDoc.name || 'Project',
                      createdAt: (projectDoc.createdAt instanceof Date
                          ? projectDoc.createdAt
                          : new Date(projectDoc.createdAt || Date.now())).toISOString(),
                  }
                : null,
        };
    } catch (error) {
        console.error('getCommandCenterData failed:', error);
        return EMPTY;
    }
}
