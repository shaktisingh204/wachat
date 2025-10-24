
'use client';

import { useEffect, useState, useTransition } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from "@/components/ui/card";
import { Send, Users, MessageSquare, Settings, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useProject } from '@/context/project-context';
import { getSmsCampaigns, getSmsContacts } from '@/app/actions/sms.actions';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const StatCard = ({ title, value, icon: Icon }: { title: string, value: string | number, icon: React.ElementType }) => (
    <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">{title}</CardTitle>
            <Icon className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
            <div className="text-2xl font-bold">{typeof value === 'number' ? value.toLocaleString() : value}</div>
        </CardContent>
    </Card>
);

function PageSkeleton() {
    return (
        <div className="space-y-8">
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
                {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28" />)}
            </div>
            <Skeleton className="h-48" />
        </div>
    );
}

export default function SmsDashboardPage() {
    const { activeProjectId } = useProject();
    const [stats, setStats] = useState({ campaigns: 0, contacts: 0, messagesSent: 0 });
    const [isLoading, startTransition] = useTransition();

    useEffect(() => {
        if (activeProjectId) {
            startTransition(async () => {
                const [campaignsData, contactsData] = await Promise.all([
                    getSmsCampaigns(activeProjectId),
                    getSmsContacts(activeProjectId)
                ]);
                const totalMessages = campaignsData.reduce((sum, c) => sum + (c.successCount || 0), 0);
                setStats({
                    campaigns: campaignsData.length,
                    contacts: contactsData.length,
                    messagesSent: totalMessages
                });
            });
        }
    }, [activeProjectId]);

    if (isLoading) {
        return <PageSkeleton />;
    }

    if (!activeProjectId) {
        return (
            <Alert variant="destructive" className="max-w-xl mx-auto">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>No Project Selected</AlertTitle>
                <AlertDescription>Please select a project to view the SMS dashboard.</AlertDescription>
            </Alert>
        );
    }
    
    return (
        <div className="space-y-8">
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
                 <StatCard title="Campaigns Sent" value={stats.campaigns} icon={Send} />
                 <StatCard title="Total Contacts" value={stats.contacts} icon={Users} />
                 <StatCard title="Messages Sent" value={stats.messagesSent} icon={MessageSquare} />
            </div>
            <Card className="text-center py-12">
                <CardHeader>
                    <CardTitle>Welcome to the SMS Suite!</CardTitle>
                </CardHeader>
                 <CardContent>
                    <p className="text-muted-foreground mb-4">You haven't configured an SMS provider yet. Get started by setting one up.</p>
                    <Button asChild>
                        <Link href="/dashboard/sms/settings">
                            <Settings className="mr-2 h-4 w-4" />
                            Go to SMS Settings
                        </Link>
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
}
