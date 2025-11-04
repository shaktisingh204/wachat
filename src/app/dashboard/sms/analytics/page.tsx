

'use client';

import { useEffect, useState, useMemo, useTransition } from 'react';
import { getSmsCampaigns } from '@/app/actions/sms.actions';
import type { WithId, SmsCampaign } from '@/lib/definitions';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { BarChart, Users, Send, CheckCircle, XCircle, TrendingUp } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { useSession } from 'next-auth/react';
import { getSession } from '@/app/actions/index.ts';

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

export default function SmsAnalyticsPage() {
    const [campaigns, setCampaigns] = useState<WithId<SmsCampaign>[]>([]);
    const [isLoading, startLoading] = useTransition();

    useEffect(() => {
        startLoading(async () => {
            const data = await getSmsCampaigns();
            setCampaigns(data);
        });
    }, []);
    
    const stats = useMemo(() => {
        const totalCampaigns = campaigns.length;
        const totalSent = campaigns.reduce((sum, c) => sum + (c.successCount || 0), 0);
        const totalFailed = campaigns.reduce((sum, c) => sum + (c.failedCount || 0), 0);
        const totalRecipients = campaigns.reduce((sum, c) => sum + (c.recipientCount || 0), 0);
        const deliveryRate = totalSent > 0 ? ((totalSent / (totalSent + totalFailed)) * 100).toFixed(1) : 0;
        
        return { totalCampaigns, totalSent, totalFailed, deliveryRate, totalRecipients };
    }, [campaigns]);

    if (isLoading) {
        return <AnalyticsPageSkeleton />;
    }

    return (
        <div className="flex flex-col gap-8">
            <div>
                <h1 className="text-3xl font-bold font-headline flex items-center gap-3"><BarChart /> SMS Analytics</h1>
                <p className="text-muted-foreground">Analyze the performance of your SMS campaigns.</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <StatCard title="Total Campaigns" value={stats.totalCampaigns} icon={Send} />
                <StatCard title="Total Messages Sent" value={stats.totalSent.toLocaleString()} icon={CheckCircle} />
                <StatCard title="Total Failed" value={stats.totalFailed.toLocaleString()} icon={XCircle} />
                <StatCard title="Delivery Rate" value={`${stats.deliveryRate}%`} icon={TrendingUp} />
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Campaign Performance</CardTitle>
                    <CardDescription>Detailed metrics for each SMS campaign you've sent.</CardDescription>
                </CardHeader>
                <CardContent>
                     <div className="border rounded-md">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Campaign</TableHead>
                                    <TableHead>Sent At</TableHead>
                                    <TableHead>Recipients</TableHead>
                                    <TableHead>Successful</TableHead>
                                    <TableHead>Failed</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {campaigns.length > 0 ? (
                                    campaigns.map(campaign => (
                                        <TableRow key={campaign._id.toString()}>
                                            <TableCell>
                                                <p className="font-medium">{campaign.name}</p>
                                            </TableCell>
                                            <TableCell>{formatDistanceToNow(new Date(campaign.sentAt), { addSuffix: true })}</TableCell>
                                            <TableCell>{campaign.recipientCount.toLocaleString()}</TableCell>
                                            <TableCell className="text-green-600">{campaign.successCount.toLocaleString()}</TableCell>
                                            <TableCell className="text-destructive">{campaign.failedCount.toLocaleString()}</TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={5} className="h-24 text-center">No campaign data to display.</TableCell>
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

    