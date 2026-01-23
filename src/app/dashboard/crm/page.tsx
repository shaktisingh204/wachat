

'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Users, UserPlus, Trophy, DollarSign, Handshake, LoaderCircle } from 'lucide-react';
import { getCrmDashboardStats } from '@/app/actions/crm.actions';
import { useEffect, useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';

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
            </div>
        )
    }

    return (
        <div className="flex flex-col gap-8 p-4 md:p-6 lg:p-8">
            <div>
                <h1 className="text-3xl font-bold font-headline">CRM Dashboard</h1>
                <p className="text-muted-foreground">An overview of your customer relationships, leads, and deals.</p>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <StatCard title="Total Contacts" value={stats.contactCount.toLocaleString()} icon={Users} />
                <StatCard title="Total Deals" value={stats.dealCount.toLocaleString()} icon={Handshake}/>
                <StatCard title="Deals Won" value={stats.dealsWon.toLocaleString()} icon={Trophy} />
                <StatCard title="Pipeline Revenue" value={new Intl.NumberFormat('en-US', { style: 'currency', currency: stats.currency || 'USD' }).format(stats.pipelineValue)} icon={DollarSign} />
            </div>
            
            <Card>
                <CardHeader>
                    <CardTitle>Coming Soon</CardTitle>
                    <CardDescription>
                        More detailed reports, deal pipelines, and contact management features are on their way to the CRM Suite!
                    </CardDescription>
                </CardHeader>
            </Card>
        </div>
    );
}
