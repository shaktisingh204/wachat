

'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Trophy, DollarSign, Handshake } from 'lucide-react';
import { getCrmDashboardStats } from '@/app/actions/crm.actions';
import { useEffect, useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import {
    RecentDealsCard,
    UpcomingTasksCard,
    PipelineBreakdownCard,
    RecentContactsCard,
    InvoiceSummaryCard
} from './_components/crm-dashboard-components';

const StatCard = ({ title, value, icon: Icon, description }: { title: string, value: string | number, icon: React.ElementType, description?: string }) => (
    <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{title}</CardTitle>
            <Icon className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
            <div className="text-2xl font-bold">{value}</div>
            {description && <p className="text-xs text-muted-foreground">{description}</p>}
        </CardContent>
    </Card>
);

export default function CrmDashboardPage() {
    const [stats, setStats] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        setIsLoading(true);
        getCrmDashboardStats().then(data => {
            setStats(data);
            setIsLoading(false);
        });
    }, []);

    if (isLoading || !stats) {
        return (
            <div className="flex flex-col gap-8 p-4 md:p-6 lg:p-8">
                <div>
                    <Skeleton className="h-8 w-1/3" />
                    <Skeleton className="h-4 w-2/3 mt-2" />
                </div>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <Skeleton className="h-28 w-full" />
                    <Skeleton className="h-28 w-full" />
                    <Skeleton className="h-28 w-full" />
                    <Skeleton className="h-28 w-full" />
                </div>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    <Skeleton className="h-64 w-full md:col-span-2" />
                    <Skeleton className="h-64 w-full" />
                </div>
            </div>
        )
    }

    return (
        <div className="flex flex-col gap-8 p-4 md:p-6 lg:p-8">
            <div>
                <h1 className="text-3xl font-bold font-headline">CRM Dashboard</h1>
                <p className="text-muted-foreground">An overview of your customer relationships, leads, and deals.</p>
            </div>

            {/* Top Row: Key Stats */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <StatCard
                    title="Total Contacts"
                    value={stats.counts?.contacts?.toLocaleString() ?? 0}
                    icon={Users}
                />
                <StatCard
                    title="Total Deals"
                    value={stats.counts?.deals?.toLocaleString() ?? 0}
                    icon={Handshake}
                />
                <StatCard
                    title="Deals Won"
                    value={stats.counts?.dealsWon?.toLocaleString() ?? 0}
                    icon={Trophy}
                />
                <StatCard
                    title="Pipeline Revenue"
                    value={new Intl.NumberFormat('en-US', { style: 'currency', currency: stats.currency || 'USD' }).format(stats.counts?.pipelineValue ?? 0)}
                    icon={DollarSign}
                />
            </div>

            {/* Middle Row: Pipeline & Invoices */}
            <div className="grid gap-4 md:grid-cols-1 lg:grid-cols-3">
                <PipelineBreakdownCard stages={stats.pipelineStages} currency={stats.currency} />
                <InvoiceSummaryCard stats={stats.invoiceStats} currency={stats.currency} />
            </div>

            {/* Bottom Row: Recent Activity */}
            <div className="grid gap-4 md:grid-cols-1 lg:grid-cols-4">
                <RecentDealsCard deals={stats.recentDeals} currency={stats.currency} />
                <div className="space-y-4 lg:col-span-2 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4">
                    <UpcomingTasksCard tasks={stats.upcomingTasks} />
                    <RecentContactsCard contacts={stats.recentContacts} />
                </div>
            </div>
        </div>
    );
}
