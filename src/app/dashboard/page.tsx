export const dynamic = "force-dynamic";

import React from "react";
import Link from "next/link";
import { getAccountHomeData } from "@/app/actions/home.actions";
import { getSession } from "@/app/actions/user.actions";
import { getOnboardingState } from "@/app/actions/onboarding-flow.actions";

import { 
  Card, CardContent, CardHeader, CardTitle, CardDescription,
  Button,
  Badge,
  StatCard,
  Separator,
  Avatar, AvatarFallback
} from "@/components/zoruui";
import { 
  Rocket, 
  MessageSquare, 
  Users, 
  Briefcase, 
  Zap, 
  Activity,
  ArrowRight,
  Sparkles,
  BarChart,
  BellRing
} from "lucide-react";

export const metadata = {
  title: "Dashboard · SabNode"
};

export default async function HomePage() {
  const [data, session, obState] = await Promise.all([
    getAccountHomeData(),
    getSession(),
    getOnboardingState(),
  ]);

  const u = session?.user as any;
  const userName = u?.name || u?.email?.split("@")[0] || "there";

  const { stats, velocity, recentBroadcasts, recentActivity } = data;
  const pct = (n: number, d: number) => (d ? Math.round((n / d) * 100) : 0);
  
  const deliveryRate = pct(stats.totalDelivered, stats.totalSent);
  const dealsWonRate = pct(stats.dealsWon, stats.totalDeals);

  return (
    <div className="mx-auto w-full max-w-[1400px] px-6 pt-8 pb-16 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Hero Section */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600 via-purple-600 to-fuchsia-600 p-8 text-white shadow-2xl">
        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-4 max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/20 px-3 py-1 text-sm font-medium backdrop-blur-md">
              <Sparkles className="h-4 w-4 text-yellow-300" />
              <span>Welcome back to your workspace</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight">
              Good to see you, {userName}!
            </h1>
            <p className="text-lg text-indigo-100 font-medium">
              You're currently on the <strong className="text-white">{stats.planName || 'Free'}</strong> plan with {stats.credits} credits remaining. 
              Let's make today productive.
            </p>
          </div>
          <div className="hidden md:block relative">
            <div className="h-32 w-32 rounded-full bg-white/10 blur-3xl absolute -top-10 -right-10 pointer-events-none"></div>
            <div className="h-40 w-40 rounded-full bg-fuchsia-400/20 blur-3xl absolute -bottom-10 right-20 pointer-events-none"></div>
            <Button size="lg" className="rounded-full bg-white text-indigo-600 hover:bg-indigo-50 shadow-lg relative z-20" asChild>
              <Link href="/dashboard/sabflow">
                <Zap className="mr-2 h-4 w-4" /> Go to SabFlow
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {/* Onboarding */}
      {obState?.onboarding && obState.onboarding.status !== "complete" && (
        <Card className="border-amber-200 bg-amber-50/50 shadow-sm">
          <CardContent className="flex items-center justify-between p-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-600">
                <Rocket className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-amber-900">Complete your setup</h3>
                <p className="text-amber-700">Finish the onboarding to get the most out of SabNode.</p>
              </div>
            </div>
            <Button variant="outline" className="border-amber-300 text-amber-700 hover:bg-amber-100 bg-white">
              Continue
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Primary KPI Grid */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard 
          label="Total Messages"
          value={stats.totalMessages.toLocaleString()}
          icon={<MessageSquare className="h-5 w-5 text-blue-500" />}
          delta={velocity.messagesLast24h > 0 ? velocity.messagesLast24h : undefined}
          formatDelta={(d) => `+${d}`}
          period="in last 24h"
          className="border-t-4 border-t-blue-500 shadow-sm hover:shadow-md transition-all"
        />
        <StatCard 
          label="Delivery Rate"
          value={`${deliveryRate}%`}
          icon={<Activity className="h-5 w-5 text-emerald-500" />}
          delta={deliveryRate - 90} // Dummy delta just for UI visual if needed, or omit
          formatDelta={() => deliveryRate >= 95 ? "Excellent" : "Needs attention"}
          period="based on recent sends"
          className="border-t-4 border-t-emerald-500 shadow-sm hover:shadow-md transition-all"
        />
        <StatCard 
          label="Total Contacts"
          value={stats.totalContacts.toLocaleString()}
          icon={<Users className="h-5 w-5 text-purple-500" />}
          delta={velocity.contactsLast7d > 0 ? velocity.contactsLast7d : undefined}
          formatDelta={(d) => `+${d}`}
          period="added this week"
          className="border-t-4 border-t-purple-500 shadow-sm hover:shadow-md transition-all"
        />
        <StatCard 
          label="Total Deals"
          value={stats.totalDeals.toLocaleString()}
          icon={<Briefcase className="h-5 w-5 text-amber-500" />}
          delta={dealsWonRate > 0 ? dealsWonRate : undefined}
          formatDelta={(d) => `${d}% won`}
          period="win rate"
          className="border-t-4 border-t-amber-500 shadow-sm hover:shadow-md transition-all"
        />
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* Recent Broadcasts */}
        <Card className="lg:col-span-2 shadow-sm border-border bg-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle className="text-xl flex items-center gap-2">
                <BarChart className="h-5 w-5 text-indigo-500" /> Recent Broadcasts
              </CardTitle>
              <CardDescription>Your latest communication campaigns</CardDescription>
            </div>
            <Button variant="ghost" size="sm" className="text-indigo-600 hover:text-indigo-700" asChild>
              <Link href="/dashboard/marketing">View All <ArrowRight className="ml-1 h-4 w-4" /></Link>
            </Button>
          </CardHeader>
          <CardContent>
            {recentBroadcasts && recentBroadcasts.length > 0 ? (
              <div className="space-y-4 mt-4">
                {recentBroadcasts.slice(0, 5).map((b) => (
                  <div key={b._id} className="flex items-center justify-between p-4 rounded-2xl bg-secondary/30 hover:bg-secondary/50 transition-colors border border-transparent hover:border-border/50">
                    <div className="flex items-center gap-4">
                      <div className={`flex h-10 w-10 items-center justify-center rounded-full ${b.status === 'completed' ? 'bg-emerald-100 text-emerald-600' : 'bg-blue-100 text-blue-600'}`}>
                        <Zap className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="font-semibold text-sm">{b.name}</p>
                        <div className="flex items-center text-xs text-muted-foreground mt-1 gap-2">
                          <Badge variant="outline" className="text-[10px] uppercase font-bold tracking-wider">{b.status}</Badge>
                          <span>•</span>
                          <span>{new Date(b.createdAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">{b.successCount} delivered</p>
                      <p className="text-xs text-muted-foreground">{b.totalContacts} total</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center border-2 border-dashed border-border rounded-2xl mt-4">
                <div className="h-12 w-12 rounded-full bg-secondary flex items-center justify-center mb-4">
                  <Rocket className="h-6 w-6 text-muted-foreground" />
                </div>
                <h3 className="font-semibold">No broadcasts yet</h3>
                <p className="text-sm text-muted-foreground mt-1 max-w-sm">Create your first broadcast to engage with your audience.</p>
                <Button className="mt-4" asChild>
                  <Link href="/dashboard/marketing">Create Broadcast</Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card className="shadow-sm border-border bg-card">
          <CardHeader>
            <CardTitle className="text-xl flex items-center gap-2">
              <BellRing className="h-5 w-5 text-rose-500" /> Recent Activity
            </CardTitle>
            <CardDescription>What's happening in your workspace</CardDescription>
          </CardHeader>
          <CardContent>
            {recentActivity && recentActivity.length > 0 ? (
              <div className="space-y-6 mt-4">
                {recentActivity.slice(0, 5).map((activity, i) => (
                  <div key={activity._id} className="relative flex gap-4">
                    {i !== recentActivity.slice(0, 5).length - 1 && (
                      <Separator orientation="vertical" className="absolute left-4 top-10 h-full -translate-x-1/2" />
                    )}
                    <Avatar className="h-8 w-8 border-2 border-background shadow-sm ring-1 ring-border">
                      <AvatarFallback className="bg-gradient-to-br from-rose-400 to-orange-400 text-white text-xs">
                        {activity.userName.substring(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col pt-1">
                      <p className="text-sm font-medium">
                        <span className="font-semibold">{activity.userName}</span> {activity.action}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {new Date(activity.createdAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
                <Activity className="h-8 w-8 mb-2 opacity-50" />
                <p className="text-sm">No recent activity found.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
