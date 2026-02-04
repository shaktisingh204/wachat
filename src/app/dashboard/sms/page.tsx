import { getDecodedSession } from "@/lib/auth";
import { connectToDatabase } from "@/lib/mongodb";
import { cookies } from "next/headers";
import { SmsCampaign } from "@/lib/sms/types";
import { Activity, CreditCard, MessageSquare, Send, Users } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { Button } from "@/components/ui/button";

async function getStats(userId: string) {
    const { db } = await connectToDatabase();
    // Aggregation for quick stats
    const totalSent = await db.collection('sms_logs').countDocuments({ userId: new ObjectId(userId), status: 'SENT' });
    const totalDelivered = await db.collection('sms_logs').countDocuments({ userId: new ObjectId(userId), status: 'DELIVERED' });
    const campaignsCount = await db.collection('sms_campaigns').countDocuments({ userId: new ObjectId(userId) });
    const recentCampaigns = await db.collection<SmsCampaign>('sms_campaigns')
        .find({ userId: new ObjectId(userId) })
        .sort({ createdAt: -1 })
        .limit(5)
        .toArray();

    return { totalSent, totalDelivered, campaignsCount, recentCampaigns };
}

export default async function SmsDashboardPage() {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session_token')?.value;
    const session = await getDecodedSession(sessionToken || '');
    // if (!session) return redirect('/auth/login'); // handled by middleware usually

    const stats = session?.userId ? await getStats(session.userId) : { totalSent: 0, totalDelivered: 0, campaignsCount: 0, recentCampaigns: [] };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold tracking-tight">SMS Overview</h1>
                <div className="flex gap-2">
                    <Button asChild variant="outline">
                        <Link href="/dashboard/sms/templates">Manage Templates</Link>
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
                        <div className="text-2xl font-bold">{stats.totalSent}</div>
                        <p className="text-xs text-muted-foreground">Messages sent via all providers</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Delivery Rate</CardTitle>
                        <Activity className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {stats.totalSent > 0 ? ((stats.totalDelivered / stats.totalSent) * 100).toFixed(1) : 0}%
                        </div>
                        <p className="text-xs text-muted-foreground">{stats.totalDelivered} delivered successfully</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Campaigns</CardTitle>
                        <MessageSquare className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.campaignsCount}</div>
                        <p className="text-xs text-muted-foreground">Total campaigns created</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Estimated Cost</CardTitle>
                        <CreditCard className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">₹ {(stats.totalSent * 0.20).toFixed(2)}</div>
                        <p className="text-xs text-muted-foreground">Approx based on avg rates</p>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                <Card className="col-span-4">
                    <CardHeader>
                        <CardTitle>Recent Campaigns</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-8">
                            {stats.recentCampaigns.length === 0 ? (
                                <p className="text-sm text-muted-foreground">No campaigns yet.</p>
                            ) : (
                                stats.recentCampaigns.map((c: any) => (
                                    <div key={c._id} className="flex items-center">
                                        <div className="space-y-1">
                                            <p className="text-sm font-medium leading-none">{c.name}</p>
                                            <p className="text-xs text-muted-foreground">
                                                {new Date(c.createdAt).toLocaleDateString()} • {c.status}
                                            </p>
                                        </div>
                                        <div className="ml-auto font-medium">
                                            {c.stats?.sent || 0} Sent
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </CardContent>
                </Card>
                <Card className="col-span-3">
                    <CardHeader>
                        <CardTitle>Quick Actions</CardTitle>
                        <CardDescription>Common tasks</CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-4">
                        <Button variant="secondary" asChild className="w-full justify-start">
                            <Link href="/dashboard/sms/config">
                                <Users className="mr-2 h-4 w-4" /> Provider Configuration
                            </Link>
                        </Button>
                        <Button variant="secondary" asChild className="w-full justify-start">
                            <Link href="/dashboard/sms/templates">
                                <MessageSquare className="mr-2 h-4 w-4" /> DLT Templates
                            </Link>
                        </Button>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

// Helper to ensure ObjectId import
import { ObjectId } from "mongodb";
