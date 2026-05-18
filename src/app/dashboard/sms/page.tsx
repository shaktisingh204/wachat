import {
  ZoruCard,
  ZoruCardContent,
  ZoruCardDescription,
  ZoruCardHeader,
  ZoruCardTitle,
  ZoruButton,
  ZoruPageHeader,
  ZoruPageHeading,
  ZoruPageTitle,
} from '@/components/zoruui';
import {
  getSmsAnalytics } from "@/app/actions/sms-analytics.actions";
import { SmsAnalyticsCharts } from "@/components/wabasimplify/sms/sms-analytics-charts";
import { Activity,
  CreditCard,
  MessageSquare,
  Send,
  Users,
  History,
  Code } from "lucide-react";
import Link from "next/link";
import { QuickSendDialog } from "./quick-send-dialog";
import { connectToDatabase } from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { getDecodedSession } from "@/lib/auth";
import { cookies } from "next/headers";
import { SmsCampaign } from "@/lib/sms/types";

async function getRecentCampaigns(userId: string) {
    const { db } = await connectToDatabase();
    return db.collection<SmsCampaign>('sms_campaigns')
        .find({ userId: new ObjectId(userId) })
        .sort({ createdAt: -1 })
        .limit(5)
        .toArray();
}

export default async function SmsDashboardPage() {
    const { stats, daily } = await getSmsAnalytics();

    const cookieStore = await cookies();
    const session = await getDecodedSession(cookieStore.get('session_token')?.value || '');
    const recentCampaigns = session?.userId ? await getRecentCampaigns(session.userId) : [];

    const safeStats = stats || { total: 0, sent: 0, delivered: 0, failed: 0, queued: 0 };
    const deliveryRate = safeStats.sent > 0 ? ((safeStats.delivered / safeStats.sent) * 100).toFixed(1) : "0";

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <ZoruPageHeader>
                    <ZoruPageHeading>
                        <ZoruPageTitle>SMS Overview</ZoruPageTitle>
                    </ZoruPageHeading>
                </ZoruPageHeader>
                <div className="flex gap-2">
                    <QuickSendDialog />
                    <ZoruButton asChild variant="outline">
                        <Link href="/dashboard/sms/templates">Templates</Link>
                    </ZoruButton>
                    <ZoruButton asChild>
                        <Link href="/dashboard/sms/campaigns/new">New Campaign</Link>
                    </ZoruButton>
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <ZoruCard className="p-0">
                    <ZoruCardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <ZoruCardTitle className="text-sm">Total Sent</ZoruCardTitle>
                        <Send className="h-4 w-4 text-zoru-ink-muted" />
                    </ZoruCardHeader>
                    <ZoruCardContent>
                        <div className="text-2xl text-zoru-ink">{safeStats.sent}</div>
                        <p className="text-xs text-zoru-ink-muted">Messages successfully sent</p>
                    </ZoruCardContent>
                </ZoruCard>
                <ZoruCard className="p-0">
                    <ZoruCardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <ZoruCardTitle className="text-sm">Delivery Rate</ZoruCardTitle>
                        <Activity className="h-4 w-4 text-zoru-ink-muted" />
                    </ZoruCardHeader>
                    <ZoruCardContent>
                        <div className="text-2xl text-zoru-ink">{deliveryRate}%</div>
                        <p className="text-xs text-zoru-ink-muted">{safeStats.delivered} delivered</p>
                    </ZoruCardContent>
                </ZoruCard>
                <ZoruCard className="p-0">
                    <ZoruCardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <ZoruCardTitle className="text-sm">Total Failed</ZoruCardTitle>
                        <MessageSquare className="h-4 w-4 text-zoru-ink-muted" />
                    </ZoruCardHeader>
                    <ZoruCardContent>
                        <div className="text-2xl text-zoru-ink">{safeStats.failed}</div>
                        <p className="text-xs text-zoru-ink-muted">Undelivered or Failed</p>
                    </ZoruCardContent>
                </ZoruCard>
                <ZoruCard className="p-0">
                    <ZoruCardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <ZoruCardTitle className="text-sm">Estimated Cost</ZoruCardTitle>
                        <CreditCard className="h-4 w-4 text-zoru-ink-muted" />
                    </ZoruCardHeader>
                    <ZoruCardContent>
                        <div className="text-2xl text-zoru-ink">₹ {(safeStats.sent * 0.20).toFixed(2)}</div>
                        <p className="text-xs text-zoru-ink-muted">Approx based on avg rates</p>
                    </ZoruCardContent>
                </ZoruCard>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                <SmsAnalyticsCharts dailyData={daily} />

                <ZoruCard className="col-span-3 p-0">
                    <ZoruCardHeader>
                        <ZoruCardTitle>Quick Actions</ZoruCardTitle>
                        <ZoruCardDescription>Common tasks</ZoruCardDescription>
                    </ZoruCardHeader>
                    <ZoruCardContent className="grid gap-4">
                        <ZoruButton variant="outline" asChild className="w-full justify-start">
                            <Link href="/dashboard/sms/logs">
                                <History className="h-4 w-4" /> Message Logs (OTP History)
                            </Link>
                        </ZoruButton>
                        <ZoruButton variant="outline" asChild className="w-full justify-start">
                            <Link href="/dashboard/sms/campaigns">
                                <MessageSquare className="h-4 w-4" /> Manage Campaigns
                            </Link>
                        </ZoruButton>
                        <ZoruButton variant="outline" asChild className="w-full justify-start">
                            <Link href="/dashboard/sms/config">
                                <Users className="h-4 w-4" /> Provider Config
                            </Link>
                        </ZoruButton>
                        <ZoruButton variant="outline" asChild className="w-full justify-start">
                            <Link href="/dashboard/sms/developer">
                                <Code className="h-4 w-4" /> Developer API
                            </Link>
                        </ZoruButton>
                    </ZoruCardContent>
                </ZoruCard>
            </div>

            <div className="grid gap-4 md:grid-cols-1">
                <ZoruCard className="p-0">
                    <ZoruCardHeader>
                        <ZoruCardTitle>Recent Campaigns</ZoruCardTitle>
                    </ZoruCardHeader>
                    <ZoruCardContent>
                        <div className="space-y-4">
                            {recentCampaigns.length === 0 ? (
                                <p className="text-sm text-zoru-ink-muted">No campaigns yet.</p>
                            ) : (
                                recentCampaigns.map((c: any) => (
                                    <div key={c._id.toString()} className="flex items-center border-b border-zoru-line pb-4 last:border-0 last:pb-0">
                                        <div className="space-y-1">
                                            <p className="text-sm leading-none text-zoru-ink">{c.name}</p>
                                            <p className="text-xs text-zoru-ink-muted">
                                                {new Date(c.createdAt).toLocaleDateString()} • {c.status}
                                            </p>
                                        </div>
                                        <div className="ml-auto text-sm text-zoru-ink">
                                            {c.stats?.sent || 0} Sent
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </ZoruCardContent>
                </ZoruCard>
            </div>
        </div>
    );
}
