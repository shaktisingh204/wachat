'use server';

import { connectToDatabase } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { getSession } from '@/app/actions/user.actions';

export type AccountHomeData = {
    stats: {
        totalMessages: number;
        totalSent: number;
        totalDelivered: number;
        totalRead: number;
        totalFailed: number;
        totalCampaigns: number;
        totalContacts: number;
        totalFlows: number;
        activeFlows: number;
        totalLeads: number;
        totalDeals: number;
        dealsWon: number;
        pipelineValue: number;
        totalSabChatSessions: number;
        totalSmsSent: number;
        totalSmsDelivered: number;
        credits: number;
        planName: string | null;
        totalProjects: number;
        /* ── Cross-app counts (for the /home "All Apps" grid) ── */
        totalTemplates: number;
        totalEmailCampaigns: number;
        totalEmailContacts: number;
        totalFlowExecutions: number;
        totalSeoProjects: number;
        totalSeoAudits: number;
        totalSeoKeywords: number;
        totalShortUrls: number;
        totalQrCodes: number;
        totalEcommOrders: number;
        totalEcommProducts: number;
        totalSites: number;
        totalTeamMessages: number;
        totalPendingInvitations: number;
        totalFacebookBroadcasts: number;
        totalFacebookSubscribers: number;
        totalLibraryTemplates: number;
        totalActivityLogs7d: number;
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
        projectName: string;
    }>;
    recentActivity: Array<{
        _id: string;
        action: string;
        createdAt: string;
        userName: string;
    }>;
    pipelineStages: Array<{ stage: string; count: number; value: number }>;
    unreadNotifications: Array<{
        _id: string;
        message: string;
        eventType: string;
        createdAt: string;
    }>;
    insights: string[];
    currency: string;
};

const EMPTY: AccountHomeData = {
    stats: {
        totalMessages: 0, totalSent: 0, totalDelivered: 0, totalRead: 0,
        totalFailed: 0, totalCampaigns: 0, totalContacts: 0, totalFlows: 0,
        activeFlows: 0, totalLeads: 0, totalDeals: 0, dealsWon: 0,
        pipelineValue: 0, totalSabChatSessions: 0, totalSmsSent: 0,
        totalSmsDelivered: 0, credits: 0, planName: null, totalProjects: 0,
        totalTemplates: 0, totalEmailCampaigns: 0, totalEmailContacts: 0,
        totalFlowExecutions: 0, totalSeoProjects: 0, totalSeoAudits: 0,
        totalSeoKeywords: 0, totalShortUrls: 0, totalQrCodes: 0,
        totalEcommOrders: 0, totalEcommProducts: 0, totalSites: 0,
        totalTeamMessages: 0, totalPendingInvitations: 0,
        totalFacebookBroadcasts: 0, totalFacebookSubscribers: 0,
        totalLibraryTemplates: 0, totalActivityLogs7d: 0,
    },
    velocity: { messagesLast24h: 0, messagesPrev24h: 0, broadcastsLast7d: 0, contactsLast7d: 0, leadsLast7d: 0 },
    chart30d: [],
    recentBroadcasts: [],
    recentActivity: [],
    pipelineStages: [],
    unreadNotifications: [],
    insights: [],
    currency: 'INR',
};

function fmtDate(d: Date) { return d.toISOString().slice(0, 10); }

export async function getAccountHomeData(): Promise<AccountHomeData> {
    try {
        const session = await getSession();
        if (!session?.user) return EMPTY;

        const { db } = await connectToDatabase();
        const uid = new ObjectId(session.user._id);

        // ── 1. Get all project IDs this user owns or is an agent in ──────────
        const userProjects = await db.collection('projects')
            .aggregate([
                { $match: { $or: [{ userId: uid }, { 'agents.userId': uid }] } },
                {
                    $lookup: {
                        from: 'plans',
                        localField: 'planId',
                        foreignField: '_id',
                        as: 'plan',
                    }
                },
                { $unwind: { path: '$plan', preserveNullAndEmptyArrays: true } },
            ])
            .toArray();

        const projectIds = userProjects.map((p: any) => p._id);
        const totalProjects = projectIds.length;
        // Sum credits and pick plan name from first owned project
        const ownedProject = userProjects.find((p: any) => p.userId?.toString() === uid.toString());
        const credits = userProjects.reduce((s: number, p: any) => s + (p.credits || 0), 0);
        const planName = ownedProject?.plan?.name || null;
        const currency = ownedProject?.plan?.currency || session.user?.plan?.currency || 'INR';

        if (projectIds.length === 0) {
            return { ...EMPTY, stats: { ...EMPTY.stats, planName, credits, totalProjects } };
        }

        const pFilter = { $in: projectIds };
        /**
         * Ownership filter for user-scoped or project-scoped collections.
         * Some newer modules (email, seo, shortlinks, ecomm, qr) historically
         * store only `userId`; others added `projectId` later. Match either
         * so no real data is missed regardless of which era wrote it.
         */
        const ownFilter: any = {
            $or: [{ projectId: pFilter }, { userId: uid }],
        };

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
        const smsLogs = db.collection('sms_logs');
        const sabchatSessions = db.collection('sabchat_sessions');
        const notifications = db.collection('notifications');
        const activityLogs = db.collection('activity_logs');
        /* ── extra cross-app collections ── */
        const templates = db.collection('templates');
        const libraryTemplates = db.collection('library_templates');
        const emailCampaigns = db.collection('email_campaigns');
        const emailContacts = db.collection('email_contacts');
        const flowExecutions = db.collection('sabflow_executions');
        const seoProjects = db.collection('seo_projects');
        const seoAudits = db.collection('seo_audits');
        const seoKeywords = db.collection('seo_keywords');
        const shortUrls = db.collection('short_urls');
        const qrCodes = db.collection('qr_codes');
        const ecommOrders = db.collection('ecomm_orders');
        const ecommProducts = db.collection('ecomm_products');
        const sites = db.collection('sites');
        const teamMessages = db.collection('team_messages');
        const invitations = db.collection('invitations');
        const fbBroadcasts = db.collection('facebook_broadcasts');
        const fbSubscribers = db.collection('facebook_subscribers');

        const [
            totalMessages, totalSent, totalDelivered, totalRead, totalFailed,
            totalCampaigns, totalContacts, totalFlows, activeFlows,
            totalLeads, dealsRaw,
            totalSabChatSessions,
            messagesLast24h, messagesPrev24h, broadcastsLast7d, contactsLast7d, leadsLast7d,
            smsStats,
            chartRaw, recentBroadcastsRaw, recentActivityRaw, unreadNotificationsRaw,
            /* ── extras ── */
            totalTemplates, totalLibraryTemplates,
            totalEmailCampaigns, totalEmailContacts,
            totalFlowExecutions,
            totalSeoProjects, totalSeoAudits, totalSeoKeywords,
            totalShortUrls, totalQrCodes,
            totalEcommOrders, totalEcommProducts, totalSites,
            totalTeamMessages, totalPendingInvitations,
            totalFacebookBroadcasts, totalFacebookSubscribers,
            totalActivityLogs7d,
        ] = await Promise.all([
            outgoing.countDocuments({ projectId: pFilter }),
            outgoing.countDocuments({ projectId: pFilter, status: { $in: ['sent', 'delivered', 'read'] } }),
            outgoing.countDocuments({ projectId: pFilter, status: { $in: ['delivered', 'read'] } }),
            outgoing.countDocuments({ projectId: pFilter, status: 'read' }),
            outgoing.countDocuments({ projectId: pFilter, status: 'failed' }),
            broadcasts.countDocuments({ projectId: pFilter }),
            contacts.countDocuments({ projectId: pFilter }),
            flows.countDocuments({ projectId: pFilter }),
            flows.countDocuments({ projectId: pFilter, status: { $in: ['active', 'enabled', 'published'] } }),
            crmLeads.countDocuments({ $or: [{ projectId: pFilter }, { userId: uid }] }).catch(() => 0),
            crmDeals.find({ $or: [{ projectId: pFilter }, { userId: uid }] }).toArray().catch(() => []),
            sabchatSessions.countDocuments({ projectId: pFilter }).catch(() => 0),
            outgoing.countDocuments({ projectId: pFilter, createdAt: { $gte: t24 } }),
            outgoing.countDocuments({ projectId: pFilter, createdAt: { $gte: t48, $lt: t24 } }),
            broadcasts.countDocuments({ projectId: pFilter, createdAt: { $gte: t7d } }),
            contacts.countDocuments({ projectId: pFilter, createdAt: { $gte: t7d } }).catch(() => 0),
            crmLeads.countDocuments({ $or: [{ projectId: pFilter }, { userId: uid }], createdAt: { $gte: t7d } }).catch(() => 0),

            // SMS — user-scoped
            smsLogs.aggregate([
                { $match: { userId: uid } },
                { $group: { _id: null, sent: { $sum: { $cond: [{ $eq: ['$status', 'SENT'] }, 1, 0] } }, delivered: { $sum: { $cond: [{ $eq: ['$status', 'DELIVERED'] }, 1, 0] } } } },
            ]).next().catch(() => null),

            // 30-day chart
            outgoing.aggregate([
                { $match: { projectId: pFilter, createdAt: { $gte: t30d } } },
                { $project: { date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, status: 1 } },
                { $group: { _id: '$date', sent: { $sum: { $cond: [{ $in: ['$status', ['sent', 'delivered', 'read']] }, 1, 0] } }, delivered: { $sum: { $cond: [{ $in: ['$status', ['delivered', 'read']] }, 1, 0] } }, read: { $sum: { $cond: [{ $eq: ['$status', 'read'] }, 1, 0] } }, failed: { $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] } } } },
                { $sort: { _id: 1 } },
            ]).toArray(),

            // Recent broadcasts (with project name)
            broadcasts.aggregate([
                { $match: { projectId: pFilter } },
                { $sort: { createdAt: -1 } },
                { $limit: 6 },
                { $lookup: { from: 'projects', localField: 'projectId', foreignField: '_id', as: 'project' } },
                { $unwind: { path: '$project', preserveNullAndEmptyArrays: true } },
            ]).toArray(),

            // Recent activity
            activityLogs.aggregate([
                { $match: { projectId: pFilter } },
                { $sort: { createdAt: -1 } },
                { $limit: 10 },
                { $lookup: { from: 'users', localField: 'userId', foreignField: '_id', as: 'user' } },
                { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
            ]).toArray(),

            // Unread notifications
            notifications.find({ projectId: pFilter, isRead: { $ne: true } })
                .sort({ createdAt: -1 }).limit(5).toArray(),

            /* ═══════════════════════════════════════════════════════════
             * Cross-app counts — every call wraps in .catch(() => 0) so a
             * missing collection, bad index, or permission error degrades
             * gracefully to zero instead of blowing up the whole page.
             * ══════════════════════════════════════════════════════════ */
            templates.countDocuments({ projectId: pFilter }).catch(() => 0),
            libraryTemplates.countDocuments({}).catch(() => 0),

            emailCampaigns.countDocuments(ownFilter).catch(() => 0),
            emailContacts.countDocuments(ownFilter).catch(() => 0),

            flowExecutions.countDocuments({ projectId: pFilter }).catch(() => 0),

            seoProjects.countDocuments({ userId: uid }).catch(() => 0),
            seoAudits.countDocuments({ userId: uid }).catch(() => 0),
            seoKeywords.countDocuments({ userId: uid }).catch(() => 0),

            shortUrls.countDocuments({ userId: uid }).catch(() => 0),
            qrCodes.countDocuments({ userId: uid }).catch(() => 0),

            ecommOrders.countDocuments(ownFilter).catch(() => 0),
            ecommProducts.countDocuments(ownFilter).catch(() => 0),
            sites.countDocuments({ userId: uid }).catch(() => 0),

            teamMessages.countDocuments({ projectId: pFilter }).catch(() => 0),
            invitations
                .countDocuments({
                    $or: [{ invitedBy: uid }, { projectId: pFilter }],
                    status: 'pending',
                })
                .catch(() => 0),

            fbBroadcasts.countDocuments({ projectId: pFilter }).catch(() => 0),
            fbSubscribers.countDocuments({ projectId: pFilter }).catch(() => 0),

            activityLogs
                .countDocuments({ projectId: pFilter, createdAt: { $gte: t7d } })
                .catch(() => 0),
        ]);

        // Derive CRM deals stats
        const totalDeals = (dealsRaw as any[]).length;
        const dealsWon = (dealsRaw as any[]).filter((d: any) => d.stage === 'Won').length;
        const pipelineValue = (dealsRaw as any[]).reduce((s: number, d: any) => s + (d.value || 0), 0);

        // Pipeline stages
        const stageMap = new Map<string, { count: number; value: number }>();
        for (const d of dealsRaw as any[]) {
            const cur = stageMap.get(d.stage) || { count: 0, value: 0 };
            stageMap.set(d.stage, { count: cur.count + 1, value: cur.value + (d.value || 0) });
        }
        const pipelineStages = Array.from(stageMap.entries())
            .map(([stage, data]) => ({ stage, ...data }))
            .sort((a, b) => b.value - a.value);

        // Build 30-day chart filling gaps
        const chartMap = new Map<string, any>(chartRaw.map((r: any) => [r._id, r]));
        const chart30d: AccountHomeData['chart30d'] = [];
        for (let i = 29; i >= 0; i--) {
            const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
            const key = fmtDate(d);
            const r = chartMap.get(key);
            chart30d.push({ date: key, sent: r?.sent ?? 0, delivered: r?.delivered ?? 0, read: r?.read ?? 0, failed: r?.failed ?? 0 });
        }

        const recentBroadcasts = (recentBroadcastsRaw as any[]).map((b: any) => ({
            _id: b._id.toString(),
            name: b.fileName || b.name || 'Untitled',
            templateName: b.templateName,
            status: b.status || 'unknown',
            createdAt: (b.createdAt instanceof Date ? b.createdAt : new Date(b.createdAt)).toISOString(),
            successCount: b.successCount || 0,
            errorCount: b.errorCount || 0,
            totalContacts: b.contactCount || b.totalContacts || 0,
            projectName: b.project?.name || '',
        }));

        const recentActivity = (recentActivityRaw as any[]).map((a: any) => ({
            _id: a._id.toString(),
            action: a.action || 'unknown',
            createdAt: (a.createdAt instanceof Date ? a.createdAt : new Date(a.createdAt || Date.now())).toISOString(),
            userName: a.user?.name || a.user?.email || 'System',
        }));

        const unreadNotifications = (unreadNotificationsRaw as any[]).map((n: any) => ({
            _id: n._id.toString(),
            message: n.message || n.title || '',
            eventType: n.eventType || 'info',
            createdAt: (n.createdAt instanceof Date ? n.createdAt : new Date(n.createdAt || Date.now())).toISOString(),
        }));

        // Insights
        const insights: string[] = [];
        if (totalProjects === 0) insights.push('Create your first project to start using SabNode.');
        if (totalCampaigns === 0) insights.push('No broadcasts sent yet. Launch your first campaign to reach your contacts.');
        if (totalContacts === 0) insights.push('No contacts yet. Import a CSV or add them from Wachat.');
        if (totalSent > 0) {
            const dr = (totalDelivered / totalSent) * 100;
            if (dr < 70) insights.push(`Delivery rate is ${dr.toFixed(1)}%. Review failed sends and template quality.`);
            else if (dr > 95) insights.push(`Excellent delivery rate: ${dr.toFixed(1)}%. Your templates are performing well.`);
        }
        if (totalFlows > 0 && activeFlows === 0) insights.push(`You have ${totalFlows} flow(s) but none are active. Publish one to automate replies.`);
        if (totalLeads > 0 && totalDeals === 0) insights.push(`${totalLeads} leads captured but no deals created yet. Move them into your pipeline.`);
        if (broadcastsLast7d === 0 && totalCampaigns > 0) insights.push('No broadcasts sent in the last 7 days. Keep your audience engaged.');

        return {
            stats: {
                totalMessages, totalSent, totalDelivered, totalRead, totalFailed,
                totalCampaigns, totalContacts, totalFlows, activeFlows,
                totalLeads, totalDeals, dealsWon, pipelineValue,
                totalSabChatSessions,
                totalSmsSent: (smsStats as any)?.sent ?? 0,
                totalSmsDelivered: (smsStats as any)?.delivered ?? 0,
                credits, planName, totalProjects,
                totalTemplates, totalLibraryTemplates,
                totalEmailCampaigns, totalEmailContacts,
                totalFlowExecutions,
                totalSeoProjects, totalSeoAudits, totalSeoKeywords,
                totalShortUrls, totalQrCodes,
                totalEcommOrders, totalEcommProducts, totalSites,
                totalTeamMessages, totalPendingInvitations,
                totalFacebookBroadcasts, totalFacebookSubscribers,
                totalActivityLogs7d,
            },
            velocity: { messagesLast24h, messagesPrev24h, broadcastsLast7d, contactsLast7d, leadsLast7d },
            chart30d,
            recentBroadcasts,
            recentActivity,
            pipelineStages,
            unreadNotifications,
            insights,
            currency,
        };
    } catch (err) {
        console.error('getAccountHomeData failed:', err);
        return EMPTY;
    }
}
