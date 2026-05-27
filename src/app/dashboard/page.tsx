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
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-zoru-ink via-zoru-ink to-zoru-ink p-8 text-white shadow-2xl">
        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-4 max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/20 px-3 py-1 text-sm font-medium backdrop-blur-md">
              <Sparkles className="h-4 w-4 text-zoru-ink-muted" />
              <span>Welcome back to your workspace</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight">
              Good to see you, {userName}!
            </h1>
            <p className="text-lg text-zoru-ink-muted font-medium">
              You're currently on the <strong className="text-white">{stats.planName || 'Free'}</strong> plan with {stats.credits} credits remaining. 
              Let's make today productive.
            </p>
          </div>
          <div className="hidden md:flex relative items-center">
            <Button size="lg" className="rounded-full bg-white text-zoru-ink hover:bg-zoru-surface-2 shadow-lg" asChild>
              <Link href="/dashboard/sabflow">
                <Zap className="mr-2 h-4 w-4" /> Go to SabFlow
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {/* Onboarding */}
      {obState?.onboarding && obState.onboarding.status !== "complete" && (
        <Card className="border-zoru-line bg-zoru-surface-2 shadow-sm">
          <CardContent className="flex items-center justify-between p-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zoru-surface-2 text-zoru-ink">
                <Rocket className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-zoru-ink">Complete your setup</h3>
                <p className="text-zoru-ink">Finish the onboarding to get the most out of SabNode.</p>
              </div>
            </div>
            <Button variant="outline" className="border-zoru-line text-zoru-ink hover:bg-zoru-surface-2 bg-white">
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
          icon={<MessageSquare className="h-5 w-5 text-zoru-ink" />}
          delta={velocity.messagesLast24h > 0 ? velocity.messagesLast24h : undefined}
          formatDelta={(d) => `+${d}`}
          period="in last 24h"
          className="border-t-4 border-t-zoru-line shadow-sm hover:shadow-md transition-all"
        />
        <StatCard 
          label="Delivery Rate"
          value={`${deliveryRate}%`}
          icon={<Activity className="h-5 w-5 text-zoru-ink" />}
          delta={stats.totalSent > 0 ? deliveryRate - 90 : undefined}
          formatDelta={() => deliveryRate >= 95 ? "Excellent" : deliveryRate >= 80 ? "Healthy" : "Improving"}
          period={stats.totalSent > 0 ? "based on recent sends" : "no sends yet"}
          className="border-t-4 border-t-zoru-line shadow-sm hover:shadow-md transition-all"
        />
        <StatCard 
          label="Total Contacts"
          value={stats.totalContacts.toLocaleString()}
          icon={<Users className="h-5 w-5 text-zoru-ink" />}
          delta={velocity.contactsLast7d > 0 ? velocity.contactsLast7d : undefined}
          formatDelta={(d) => `+${d}`}
          period="added this week"
          className="border-t-4 border-t-zoru-line shadow-sm hover:shadow-md transition-all"
        />
        <StatCard 
          label="Total Deals"
          value={stats.totalDeals.toLocaleString()}
          icon={<Briefcase className="h-5 w-5 text-zoru-ink" />}
          delta={dealsWonRate > 0 ? dealsWonRate : undefined}
          formatDelta={(d) => `${d}% won`}
          period="win rate"
          className="border-t-4 border-t-zoru-line shadow-sm hover:shadow-md transition-all"
        />
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* Recent Broadcasts */}
        <Card className="lg:col-span-2 shadow-sm border-border bg-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle className="text-xl flex items-center gap-2">
                <BarChart className="h-5 w-5 text-zoru-ink" /> Recent Broadcasts
              </CardTitle>
              <CardDescription>Your latest communication campaigns</CardDescription>
            </div>
            <Button variant="ghost" size="sm" className="text-zoru-ink hover:text-zoru-ink" asChild>
              <Link href="/dashboard/marketing">View All <ArrowRight className="ml-1 h-4 w-4" /></Link>
            </Button>
          </CardHeader>
          <CardContent>
            {recentBroadcasts && recentBroadcasts.length > 0 ? (
              <div className="space-y-4 mt-4">
                {recentBroadcasts.slice(0, 5).map((b) => (
                  <div key={b._id} className="flex items-center justify-between p-4 rounded-2xl bg-secondary/30 hover:bg-secondary/50 transition-colors border border-transparent hover:border-border/50">
                    <div className="flex items-center gap-4">
                      <div className={`flex h-10 w-10 items-center justify-center rounded-full ${b.status === 'completed' ? 'bg-zoru-surface-2 text-zoru-ink' : 'bg-zoru-surface-2 text-zoru-ink'}`}>
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
              <BellRing className="h-5 w-5 text-zoru-ink" /> Recent Activity
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
                      <AvatarFallback className="bg-gradient-to-br from-zoru-ink to-zoru-ink text-white text-xs">
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
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <div className="h-11 w-11 rounded-full bg-zoru-surface-2 text-zoru-ink flex items-center justify-center mb-3">
                  <Activity className="h-5 w-5" />
                </div>
                <h3 className="text-sm font-semibold text-foreground">All quiet — for now</h3>
                <p className="text-xs text-muted-foreground mt-1 max-w-[200px]">Activity will appear here as your team sends, books, and replies.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
