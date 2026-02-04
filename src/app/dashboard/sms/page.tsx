import { getSmsAnalytics } from "@/app/actions/sms-analytics.actions";
import { SmsAnalyticsCharts } from "@/components/wabasimplify/sms/sms-analytics-charts";
import { Activity, CreditCard, MessageSquare, Send, Users, History, Code } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { QuickSendDialog } from "./quick-send-dialog";
import { connectToDatabase } from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { getDecodedSession } from "@/lib/auth";
import { cookies } from "next/headers";
import { SmsCampaign } from "@/lib/sms/types";

// Helper to get recent campaigns separately as analytics action focuses on stats
async function getRecentCampaigns(userId: string) {
    const { db } = await connectToDatabase();
    return db.collection<SmsCampaign>('sms_campaigns')
        .find({ userId: new ObjectId(userId) })
        .sort({ createdAt: -1 })
        .limit(5)
        .toArray();
}

export default async function SmsDashboardPage() {
    // 1. Fetch Analytics
    const { stats, daily } = await getSmsAnalytics();

    // 2. Fetch Recent Campaigns
    const cookieStore = await cookies();
    const session = await getDecodedSession(cookieStore.get('session_token')?.value || '');
    const recentCampaigns = session?.userId ? await getRecentCampaigns(session.userId) : [];

    // Fallback stats
    const safeStats = stats || { total: 0, sent: 0, delivered: 0, failed: 0, queued: 0 };
    const deliveryRate = safeStats.sent > 0 ? ((safeStats.delivered / safeStats.sent) * 100).toFixed(1) : "0";

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold tracking-tight">SMS Overview</h1>
                <div className="flex gap-2">
                    <QuickSendDialog />
                    <Button asChild variant="outline">
                        <Link href="/dashboard/sms/templates">Templates</Link>
                    </Button>
                    <Button asChild>
                        <Link href="/dashboard/sms/campaigns/new">New Campaign</Link>
                    </Button>
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Sent</CardTitle>
                        <Send className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{safeStats.sent}</div>
                        <p className="text-xs text-muted-foreground">Messages successfully sent</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Delivery Rate</CardTitle>
                        <Activity className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{deliveryRate}%</div>
                        <p className="text-xs text-muted-foreground">{safeStats.delivered} delivered</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Failed</CardTitle>
                        <MessageSquare className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{safeStats.failed}</div>
                        <p className="text-xs text-muted-foreground">Undelivered or Failed</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Estimated Cost</CardTitle>
                        <CreditCard className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">₹ {(safeStats.sent * 0.20).toFixed(2)}</div>
                        <p className="text-xs text-muted-foreground">Approx based on avg rates</p>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">

                {/* Analytics Chart */}
                <SmsAnalyticsCharts dailyData={daily} />

                {/* Quick Actions */}
                <Card className="col-span-3">
                    <CardHeader>
                        <CardTitle>Quick Actions</CardTitle>
                        <CardDescription>Common tasks</CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-4">
                        <Button variant="secondary" asChild className="w-full justify-start">
                            <Link href="/dashboard/sms/logs">
                                <History className="mr-2 h-4 w-4" /> Message Logs (OTP History)
                            </Link>
                        </Button>
                        <Button variant="secondary" asChild className="w-full justify-start">
                            <Link href="/dashboard/sms/campaigns">
                                <MessageSquare className="mr-2 h-4 w-4" /> Manage Campaigns
                            </Link>
                        </Button>
                        <Button variant="secondary" asChild className="w-full justify-start">
                            <Link href="/dashboard/sms/config">
                                <Users className="mr-2 h-4 w-4" /> Provider Config
                            </Link>
                        </Button>
                        <Button variant="outline" asChild className="w-full justify-start">
                            <Link href="/dashboard/sms/developer">
                                <Code className="mr-2 h-4 w-4" /> Developer API
                            </Link>
                        </Button>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-4 md:grid-cols-1">
                <Card>
                    <CardHeader>
                        <CardTitle>Recent Campaigns</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {recentCampaigns.length === 0 ? (
                                <p className="text-sm text-muted-foreground">No campaigns yet.</p>
                            ) : (
                                recentCampaigns.map((c: any) => (
                                    <div key={c._id.toString()} className="flex items-center border-b pb-4 last:border-0 last:pb-0">
                                        <div className="space-y-1">
                                            <p className="text-sm font-medium leading-none">{c.name}</p>
                                            <p className="text-xs text-muted-foreground">
                                                {new Date(c.createdAt).toLocaleDateString()} • {c.status}
                                            </p>
                                        </div>
                                        <div className="ml-auto font-medium text-sm">
                                            {c.stats?.sent || 0} Sent
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
