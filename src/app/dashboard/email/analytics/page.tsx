'use client';

import {
  ZoruCard,
  ZoruCardContent,
  ZoruCardHeader,
  ZoruCardTitle,
  ZoruCardDescription,
  ZoruTable,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
  ZoruBadge,
  ZoruSkeleton,
  ZoruPageHeader,
  ZoruPageHeading,
  ZoruPageTitle,
  ZoruPageDescription,
} from '@/components/zoruui';
import {
  useEffect,
  useState,
  useMemo,
  useTransition } from 'react';
import { getEmailCampaigns } from '@/app/actions/email.actions';
import type { WithId,
  EmailCampaign } from '@/lib/definitions';
import { BarChart,
  Users,
  Send,
  MousePointerClick,
  Eye } from 'lucide-react';
import { format,
  formatDistanceToNow } from 'date-fns';

const StatCard = ({ title, value, icon: Icon, description }: { title: string, value: string | number, icon: React.ElementType, description?: string }) => (
    <ZoruCard className="p-0">
        <ZoruCardHeader className="flex flex-row items-center justify-between pb-2">
            <ZoruCardTitle className="text-sm">{title}</ZoruCardTitle>
            <Icon className="h-4 w-4 text-zoru-ink-muted" />
        </ZoruCardHeader>
        <ZoruCardContent>
            <div className="text-2xl text-zoru-ink">{value}</div>
            {description && <p className="text-xs text-zoru-ink-muted">{description}</p>}
        </ZoruCardContent>
    </ZoruCard>
);

function AnalyticsPageSkeleton() {
    return (
        <div className="space-y-8">
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
                {[...Array(4)].map((_, i) => <ZoruSkeleton key={i} className="h-28" />)}
            </div>
            <ZoruCard className="p-0">
                <ZoruCardHeader>
                    <ZoruSkeleton className="h-6 w-1/3" />
                </ZoruCardHeader>
                <ZoruCardContent>
                    <ZoruSkeleton className="h-64 w-full" />
                </ZoruCardContent>
            </ZoruCard>
        </div>
    );
}

export default function EmailAnalyticsPage() {
    const [campaigns, setCampaigns] = useState<WithId<EmailCampaign>[]>([]);
    const [isLoading, startLoading] = useTransition();

    useEffect(() => {
        startLoading(async () => {
            const data = await getEmailCampaigns();
            setCampaigns(data);
        });
    }, []);

    const stats = useMemo(() => {
        const totalCampaigns = campaigns.length;
        const totalRecipients = campaigns.reduce((sum, c) => sum + (c.contacts?.length || 0), 0);

        let totalOpens = 0;
        let totalClicks = 0;
        let totalBounces = 0;
        let totalSent = 0;

        for (const c of campaigns) {
            const sent = c.contacts?.length || 0;
            totalSent += sent;
            totalOpens += (c as any).openCount || 0;
            totalClicks += (c as any).clickCount || 0;
            totalBounces += (c as any).bounceCount || 0;
        }

        const avgOpenRate = totalSent > 0 ? Number(((totalOpens / totalSent) * 100).toFixed(1)) : 0;
        const avgClickRate = totalSent > 0 ? Number(((totalClicks / totalSent) * 100).toFixed(1)) : 0;

        return { totalCampaigns, totalRecipients, avgOpenRate, avgClickRate };
    }, [campaigns]);

    const getCampaignAnalytics = (campaign: EmailCampaign) => {
        const sent = campaign.contacts?.length || 0;
        const opens = (campaign as any).openCount || 0;
        const clicks = (campaign as any).clickCount || 0;
        const bounces = (campaign as any).bounceCount || 0;
        const openRate = sent > 0 ? ((opens / sent) * 100).toFixed(1) : '0.0';
        const clickRate = sent > 0 ? ((clicks / sent) * 100).toFixed(1) : '0.0';
        return { openRate, clickRate, bounces };
    };

    if (isLoading) {
        return <AnalyticsPageSkeleton />;
    }

    return (
        <div className="flex flex-col gap-8">
            <ZoruPageHeader>
                <ZoruPageHeading>
                    <ZoruPageTitle>
                        <span className="inline-flex items-center gap-3">
                            <BarChart className="h-7 w-7" /> Email Analytics
                        </span>
                    </ZoruPageTitle>
                    <ZoruPageDescription>Analyze the performance of your email campaigns.</ZoruPageDescription>
                </ZoruPageHeading>
            </ZoruPageHeader>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <StatCard title="Total Campaigns" value={stats.totalCampaigns} icon={Send} />
                <StatCard title="Total Recipients" value={stats.totalRecipients.toLocaleString()} icon={Users} />
                <StatCard title="Avg. Open Rate" value={`${stats.avgOpenRate}%`} icon={Eye} description="Based on last 30 days" />
                <StatCard title="Avg. Click Rate" value={`${stats.avgClickRate}%`} icon={MousePointerClick} description="Based on last 30 days" />
            </div>

            <ZoruCard className="p-0">
                <ZoruCardHeader>
                    <ZoruCardTitle>Campaign Performance</ZoruCardTitle>
                    <ZoruCardDescription>Detailed metrics for each email campaign you've sent.</ZoruCardDescription>
                </ZoruCardHeader>
                <ZoruCardContent>
                    <div className="border border-zoru-line rounded-md">
                        <ZoruTable>
                            <ZoruTableHeader>
                                <ZoruTableRow>
                                    <ZoruTableHead>Campaign</ZoruTableHead>
                                    <ZoruTableHead>Status</ZoruTableHead>
                                    <ZoruTableHead>Recipients</ZoruTableHead>
                                    <ZoruTableHead>Open Rate</ZoruTableHead>
                                    <ZoruTableHead>Click Rate</ZoruTableHead>
                                    <ZoruTableHead>Bounces</ZoruTableHead>
                                </ZoruTableRow>
                            </ZoruTableHeader>
                            <ZoruTableBody>
                                {campaigns.length > 0 ? (
                                    campaigns.map(campaign => {
                                        const analytics = getCampaignAnalytics(campaign);
                                        return (
                                            <ZoruTableRow key={campaign._id.toString()}>
                                                <ZoruTableCell>
                                                    <p className="text-zoru-ink">{campaign.name}</p>
                                                    <p className="text-xs text-zoru-ink-muted">{campaign.sentAt ? formatDistanceToNow(new Date(campaign.sentAt), { addSuffix: true }) : 'Scheduled'}</p>
                                                </ZoruTableCell>
                                                <ZoruTableCell><ZoruBadge variant={campaign.status === 'sent' ? 'success' : 'ghost'}>{campaign.status}</ZoruBadge></ZoruTableCell>
                                                <ZoruTableCell>{(campaign.contacts?.length || 0).toLocaleString()}</ZoruTableCell>
                                                <ZoruTableCell>{analytics.openRate}%</ZoruTableCell>
                                                <ZoruTableCell>{analytics.clickRate}%</ZoruTableCell>
                                                <ZoruTableCell>{analytics.bounces}</ZoruTableCell>
                                            </ZoruTableRow>
                                        )
                                    })
                                ) : (
                                    <ZoruTableRow>
                                        <ZoruTableCell colSpan={6} className="h-24 text-center">No campaign data to display.</ZoruTableCell>
                                    </ZoruTableRow>
                                )}
                            </ZoruTableBody>
                        </ZoruTable>
                    </div>
                </ZoruCardContent>
            </ZoruCard>
        </div>
    );
}
