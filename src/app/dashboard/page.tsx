export const dynamic = 'force-dynamic';

import { getAccountHomeData } from '@/app/actions/home.actions';
import { getSession } from '@/app/actions/user.actions';
import { DashboardHome } from './dashboard-home';

export const metadata = {
    title: 'Dashboard · SabNode',
};

export default async function HomePage() {
    const [data, session] = await Promise.all([getAccountHomeData(), getSession()]);

    const u = session?.user as { name?: string; email?: string } | undefined;
    const userName = u?.name?.trim() || u?.email?.split('@')[0] || 'there';

    const { stats, velocity, recentBroadcasts, recentActivity } = data;

    return (
        <DashboardHome
            userName={userName}
            stats={{
                planName: stats.planName,
                credits: stats.credits,
                totalContacts: stats.totalContacts,
                totalDeals: stats.totalDeals,
                dealsWon: stats.dealsWon,
                totalSent: stats.totalSent,
                totalDelivered: stats.totalDelivered,
                totalFlows: stats.totalFlows,
                activeFlows: stats.activeFlows,
                totalLeads: stats.totalLeads,
                pipelineValue: stats.pipelineValue,
                totalSabChatSessions: stats.totalSabChatSessions,
                totalCampaigns: stats.totalCampaigns,
            }}
            velocity={velocity}
            recentBroadcasts={recentBroadcasts.map((b: any) => ({
                id: String(b.id ?? b._id ?? Math.random()),
                name: String(b.name ?? 'Untitled'),
                status: String(b.status ?? 'queued'),
                sent: Number(b.sent ?? 0),
                delivered: Number(b.delivered ?? 0),
                createdAt: String(b.createdAt ?? new Date().toISOString()),
            }))}
            recentActivity={recentActivity.map((a: any) => ({
                id: String(a.id ?? a._id ?? Math.random()),
                type: String(a.type ?? a.kind ?? 'event'),
                title: String(a.title ?? a.message ?? 'Event'),
                createdAt: String(a.createdAt ?? a.at ?? new Date().toISOString()),
            }))}
        />
    );
}
