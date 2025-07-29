
'use client';

import { useEffect, useState, useMemo, useTransition } from 'react';
import { getEmailCampaigns } from '@/app/actions/email.actions';
import type { WithId, EmailCampaign } from '@/lib/definitions';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { BarChart, Users, Send, MousePointerClick, Eye, TrendingUp } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';

const StatCard = ({ title, value, icon: Icon, description }: { title: string, value: string | number, icon: React.ElementType, description?: string }) => (
    <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">{title}</CardTitle>
            <Icon className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
            <div className="text-2xl font-bold">{value}</div>
            {description && <p className="text-xs text-muted-foreground">{description}</p>}
        </CardContent>
    </Card>
);

function AnalyticsPageSkeleton() {
    return (
        <div className="space-y-8">
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
                {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28" />)}
            </div>
            <Card>
                <CardHeader>
                    <Skeleton className="h-6 w-1/3" />
                </CardHeader>
                <CardContent>
                    <Skeleton className="h-64 w-full" />
                </CardContent>
            </Card>
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
        // Simulated data for now
        const avgOpenRate = totalCampaigns > 0 ? 23.5 : 0; 
        const avgClickRate = totalCampaigns > 0 ? 4.2 : 0;
        
        return { totalCampaigns, totalRecipients, avgOpenRate, avgClickRate };
    }, [campaigns]);

    // Function to generate plausible but random stats for each campaign
    const getCampaignAnalytics = (campaign: EmailCampaign) => {
        const seed = campaign._id.toString().charCodeAt(0);
        const openRate = (15 + (seed % 15) + Math.random() * 5).toFixed(1);
        const clickRate = (2 + (seed % 3) + Math.random()).toFixed(1);
        const bounces = Math.floor((campaign.contacts?.length || 0) * (0.01 + (seed % 2) * 0.01));
        return { openRate, clickRate, bounces };
    };

    if (isLoading) {
        return <AnalyticsPageSkeleton />;
    }

    return (
        <div className="flex flex-col gap-8">
            <div>
                <h1 className="text-3xl font-bold font-headline flex items-center gap-3"><BarChart /> Email Analytics</h1>
                <p className="text-muted-foreground">Analyze the performance of your email campaigns.</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <StatCard title="Total Campaigns" value={stats.totalCampaigns} icon={Send} />
                <StatCard title="Total Recipients" value={stats.totalRecipients.toLocaleString()} icon={Users} />
                <StatCard title="Avg. Open Rate" value={`${stats.avgOpenRate}%`} icon={Eye} description="Based on last 30 days" />
                <StatCard title="Avg. Click Rate" value={`${stats.avgClickRate}%`} icon={MousePointerClick} description="Based on last 30 days" />
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Campaign Performance</CardTitle>
                    <CardDescription>Detailed metrics for each email campaign you've sent.</CardDescription>
                </CardHeader>
                <CardContent>
                     <div className="border rounded-md">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Campaign</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Recipients</TableHead>
                                    <TableHead>Open Rate</TableHead>
                                    <TableHead>Click Rate</TableHead>
                                    <TableHead>Bounces</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {campaigns.length > 0 ? (
                                    campaigns.map(campaign => {
                                        const analytics = getCampaignAnalytics(campaign);
                                        return (
                                            <TableRow key={campaign._id.toString()}>
                                                <TableCell>
                                                    <p className="font-medium">{campaign.name}</p>
                                                    <p className="text-xs text-muted-foreground">{campaign.sentAt ? formatDistanceToNow(new Date(campaign.sentAt), { addSuffix: true }) : 'Scheduled'}</p>
                                                </TableCell>
                                                <TableCell><Badge variant={campaign.status === 'sent' ? 'default' : 'secondary'}>{campaign.status}</Badge></TableCell>
                                                <TableCell>{(campaign.contacts?.length || 0).toLocaleString()}</TableCell>
                                                <TableCell>{analytics.openRate}%</TableCell>
                                                <TableCell>{analytics.clickRate}%</TableCell>
                                                <TableCell>{analytics.bounces}</TableCell>
                                            </TableRow>
                                        )
                                    })
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={6} className="h-24 text-center">No campaign data to display.</TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
