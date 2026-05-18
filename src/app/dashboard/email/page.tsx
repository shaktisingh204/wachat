'use client';

import {
  ZoruButton,
  ZoruCard,
  ZoruCardHeader,
  ZoruCardTitle,
  ZoruCardDescription,
  ZoruCardContent,
  ZoruCardFooter,
  ZoruSkeleton,
  ZoruPageHeader,
  ZoruPageHeading,
  ZoruPageTitle,
  ZoruPageDescription,
} from '@/components/zoruui';
import {
  Suspense,
  useState,
  useEffect } from 'react';
import { EmailAccountList } from '@/components/wabasimplify/email-account-list';
import { PlusCircle,
  Activity,
  TrendingUp,
  BarChart3,
  Send,
  Users,
  Mail } from 'lucide-react';
import Link from 'next/link';
import { getEmailSettings,
  getEmailCampaigns,
  getEmailStats } from '@/app/actions/email.actions';
import type { WithId,
  EmailSettings,
  EmailCampaign } from '@/lib/definitions';
import { EmailSuiteLayout } from '@/components/wabasimplify/email-suite-layout';
import { useSearchParams } from 'next/navigation';
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
                const currentAccount = settingsData.find(s => s._id.toString() === accountId);
                const fromEmail = currentAccount?.fromEmail;

                const campaigns = await getEmailCampaigns(fromEmail);
                setRecentCampaigns(campaigns.slice(0, 5));

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
                    <ZoruSkeleton className="h-32" />
                    <ZoruSkeleton className="h-32" />
                    <ZoruSkeleton className="h-32" />
                </div>
                <ZoruSkeleton className="h-96" />
            </div>
        );
    }

    if (!accountId) {
        return <EmailAccountList accounts={allSettings} />;
    }

    return (
        <div className="flex flex-col gap-8">
            <ZoruPageHeader>
                <ZoruPageHeading>
                    <ZoruPageTitle>
                        <span className="inline-flex items-center gap-3">
                            <BarChart3 className="h-7 w-7" /> Overview
                        </span>
                    </ZoruPageTitle>
                    <ZoruPageDescription>Performance summary for this account.</ZoruPageDescription>
                </ZoruPageHeading>
            </ZoruPageHeader>

            <div className="grid md:grid-cols-3 gap-6">
                <ZoruCard className="p-0">
                    <ZoruCardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <ZoruCardTitle className="text-sm">Total Emails Sent</ZoruCardTitle>
                        <Send className="h-4 w-4 text-zoru-ink-muted" />
                    </ZoruCardHeader>
                    <ZoruCardContent>
                        <div className="text-2xl text-zoru-ink">{stats.sent.toLocaleString()}</div>
                        <p className="text-xs text-zoru-ink-muted">+20.1% from last month</p>
                    </ZoruCardContent>
                </ZoruCard>
                <ZoruCard className="p-0">
                    <ZoruCardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <ZoruCardTitle className="text-sm">Open Rate</ZoruCardTitle>
                        <Activity className="h-4 w-4 text-zoru-ink-muted" />
                    </ZoruCardHeader>
                    <ZoruCardContent>
                        <div className="text-2xl text-zoru-ink">45%</div>
                        <p className="text-xs text-zoru-ink-muted">+4% from last month</p>
                    </ZoruCardContent>
                </ZoruCard>
                <ZoruCard className="p-0">
                    <ZoruCardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <ZoruCardTitle className="text-sm">Click Rate</ZoruCardTitle>
                        <TrendingUp className="h-4 w-4 text-zoru-ink-muted" />
                    </ZoruCardHeader>
                    <ZoruCardContent>
                        <div className="text-2xl text-zoru-ink">12%</div>
                        <p className="text-xs text-zoru-ink-muted">-1% from last month</p>
                    </ZoruCardContent>
                </ZoruCard>
            </div>

            <div className="grid md:grid-cols-2 gap-8">
                <ZoruCard className="md:col-span-1 p-0">
                    <ZoruCardHeader>
                        <ZoruCardTitle>Recent Campaigns</ZoruCardTitle>
                        <ZoruCardDescription>Your latest email activity.</ZoruCardDescription>
                    </ZoruCardHeader>
                    <ZoruCardContent>
                        <div className="space-y-4">
                            {recentCampaigns.length > 0 ? recentCampaigns.map(c => (
                                <div key={c._id.toString()} className="flex items-center justify-between border-b border-zoru-line pb-4 last:border-0 last:pb-0">
                                    <div>
                                        <p className="truncate max-w-[200px] text-zoru-ink">{c.name}</p>
                                        <p className="text-xs text-zoru-ink-muted">{c.status}</p>
                                    </div>
                                    <div className="text-sm text-zoru-ink-muted">
                                        {c.sentAt ? formatDistanceToNow(new Date(c.sentAt), { addSuffix: true }) : 'Scheduled'}
                                    </div>
                                </div>
                            )) : (
                                <div className="text-center py-8 text-zoru-ink-muted">No recent campaigns.</div>
                            )}
                        </div>
                    </ZoruCardContent>
                    <ZoruCardFooter>
                        <ZoruButton asChild variant="outline" className="w-full">
                            <Link href="/dashboard/email/campaigns">View All Campaigns</Link>
                        </ZoruButton>
                    </ZoruCardFooter>
                </ZoruCard>

                <ZoruCard className="md:col-span-1 p-0">
                    <ZoruCardHeader>
                        <ZoruCardTitle>Quick Actions</ZoruCardTitle>
                        <ZoruCardDescription>Common tasks for this account.</ZoruCardDescription>
                    </ZoruCardHeader>
                    <ZoruCardContent className="grid gap-4">
                        <ZoruButton asChild className="w-full justify-start" variant="outline">
                            <Link href="/dashboard/email/campaigns"><PlusCircle className="h-4 w-4" /> Create New Campaign</Link>
                        </ZoruButton>
                        <ZoruButton asChild className="w-full justify-start" variant="outline">
                            <Link href="/dashboard/email/contacts"><Users className="h-4 w-4" /> Import Contacts</Link>
                        </ZoruButton>
                        <ZoruButton asChild className="w-full justify-start" variant="outline">
                            <Link href="/dashboard/email/inbox"><Mail className="h-4 w-4" /> Check Inbox</Link>
                        </ZoruButton>
                    </ZoruCardContent>
                </ZoruCard>
            </div>
        </div>
    );
}

export default function EmailDashboardPage() {
    return (
        <EmailSuiteLayout>
            <Suspense fallback={<ZoruSkeleton className="h-full w-full" />}>
                <OverviewContent />
            </Suspense>
        </EmailSuiteLayout>
    );
}
