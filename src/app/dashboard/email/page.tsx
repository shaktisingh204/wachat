'use client';

import { Suspense, useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from "@/components/ui/card";
import { EmailAccountList } from '@/components/wabasimplify/email-account-list';
import { PlusCircle, Activity, TrendingUp, BarChart3, AlertCircle, Send, Users, Mail } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { getEmailSettings, getEmailCampaigns, getEmailStats } from '@/app/actions/email.actions';
import type { WithId, EmailSettings, EmailCampaign } from '@/lib/definitions';
import { Skeleton } from '@/components/ui/skeleton';
import { EmailSuiteLayout } from '@/components/wabasimplify/email-suite-layout';
import { useSearchParams } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';

function OverviewContent() {
    const searchParams = useSearchParams();
    const accountId = searchParams.get('accountId');
    const [allSettings, setAllSettings] = useState<WithId<EmailSettings>[]>([]);
    const [recentCampaigns, setRecentCampaigns] = useState<WithId<EmailCampaign>[]>([]);
    const [stats, setStats] = useState({ sent: 0, opened: 0, clicks: 0 });
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            const settingsData = await getEmailSettings();
            setAllSettings(settingsData);

            if (accountId) {
                // If accountId is present, find the account email to filter campaigns
                const currentAccount = settingsData.find(s => s._id.toString() === accountId);
                const fromEmail = currentAccount?.fromEmail;

                // Fetch campaigns (filtered by fromEmail if available)
                const campaigns = await getEmailCampaigns(fromEmail);
                setRecentCampaigns(campaigns.slice(0, 5));

                // Fetch real stats
                const realStats = await getEmailStats(accountId);
                setStats(realStats);
            }

            setIsLoading(false);
        };
        fetchData();
    }, [accountId]);

    if (isLoading) {
        return (
            <div className="space-y-6">
                <div className="grid grid-cols-3 gap-6">
                    <Skeleton className="h-32" />
                    <Skeleton className="h-32" />
                    <Skeleton className="h-32" />
                </div>
                <Skeleton className="h-96" />
            </div>
        );
    }

    if (!accountId) {
        return <EmailAccountList accounts={allSettings} />;
    }

    return (
        <div className="flex flex-col gap-8">
            <div>
                <h1 className="text-3xl font-bold font-headline flex items-center gap-3"><BarChart3 className="h-8 w-8" /> Overview</h1>
                <p className="text-muted-foreground">Performance summary for this account.</p>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Emails Sent</CardTitle>
                        <Send className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.sent.toLocaleString()}</div>
                        <p className="text-xs text-muted-foreground">+20.1% from last month</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Open Rate</CardTitle>
                        <Activity className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">45%</div>
                        <p className="text-xs text-muted-foreground">+4% from last month</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Click Rate</CardTitle>
                        <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">12%</div>
                        <p className="text-xs text-muted-foreground">-1% from last month</p>
                    </CardContent>
                </Card>
            </div>

            <div className="grid md:grid-cols-2 gap-8">
                <Card className="md:col-span-1">
                    <CardHeader>
                        <CardTitle>Recent Campaigns</CardTitle>
                        <CardDescription>Your latest email activity.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {recentCampaigns.length > 0 ? recentCampaigns.map(c => (
                                <div key={c._id.toString()} className="flex items-center justify-between border-b pb-4 last:border-0 last:pb-0">
                                    <div>
                                        <p className="font-medium truncate max-w-[200px]">{c.name}</p>
                                        <p className="text-xs text-muted-foreground">{c.status}</p>
                                    </div>
                                    <div className="text-sm text-muted-foreground">
                                        {c.sentAt ? formatDistanceToNow(new Date(c.sentAt), { addSuffix: true }) : 'Scheduled'}
                                    </div>
                                </div>
                            )) : (
                                <div className="text-center py-8 text-muted-foreground">No recent campaigns.</div>
                            )}
                        </div>
                    </CardContent>
                    <CardFooter>
                        <Button asChild variant="outline" className="w-full">
                            <Link href="/dashboard/email/campaigns">View All Campaigns</Link>
                        </Button>
                    </CardFooter>
                </Card>

                <Card className="md:col-span-1">
                    <CardHeader>
                        <CardTitle>Quick Actions</CardTitle>
                        <CardDescription>Common tasks for this account.</CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-4">
                        <Button asChild className="w-full justify-start" variant="secondary">
                            <Link href="/dashboard/email/campaigns"><PlusCircle className="mr-2 h-4 w-4" /> Create New Campaign</Link>
                        </Button>
                        <Button asChild className="w-full justify-start" variant="secondary">
                            <Link href="/dashboard/email/contacts"><Users className="mr-2 h-4 w-4" /> Import Contacts</Link>
                        </Button>
                        <Button asChild className="w-full justify-start" variant="secondary">
                            <Link href="/dashboard/email/inbox"><Mail className="mr-2 h-4 w-4" /> Check Inbox</Link>
                        </Button>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

export default function EmailDashboardPage() {
    return (
        <EmailSuiteLayout>
            <Suspense fallback={<Skeleton className="h-full w-full" />}>
                <OverviewContent />
            </Suspense>
        </EmailSuiteLayout>
    );
}
