export const dynamic = "force-dynamic";

import React from "react";
import Link from "next/link";
import { getAccountHomeData } from "@/app/actions/home.actions";
import { getSession } from "@/app/actions/user.actions";
import { getOnboardingState } from "@/app/actions/onboarding-flow.actions";

import {
  Button,
  Badge,
  StatCard,
  EmptyState,
} from "@/components/sabcrm/20ui/zoru";
import {
  MessageSquare,
  Users,
  Briefcase,
  Zap,
  Activity,
  ArrowRight,
  ArrowUpRight,
  Rocket,
  Megaphone,
  TrendingUp,
  Inbox,
  Globe2,
  Layers,
  Database,
  Workflow,
  Mail,
} from "lucide-react";
import { HomeMotionShell } from "./_components/home-motion-shell";

export const metadata = {
  title: "Dashboard · SabNode",
};

const QUICK_LAUNCH: Array<{
  name: string;
  href: string;
  dot: string;
  ring: string;
  hint: string;
}> = [
  { name: "Wachat", href: "/dashboard/wachat", dot: "bg-emerald-500", ring: "ring-emerald-200", hint: "WhatsApp Business" },
  { name: "SabFlow", href: "/dashboard/sabflow", dot: "bg-sky-500", ring: "ring-sky-200", hint: "Automations" },
  { name: "CRM", href: "/dashboard/crm", dot: "bg-violet-500", ring: "ring-violet-200", hint: "Leads + Deals" },
  { name: "SEO", href: "/dashboard/seo", dot: "bg-amber-500", ring: "ring-amber-200", hint: "Audits + Keywords" },
  { name: "HRM", href: "/dashboard/hrm", dot: "bg-rose-500", ring: "ring-rose-200", hint: "People Ops" },
  { name: "Email", href: "/dashboard/email", dot: "bg-indigo-500", ring: "ring-indigo-200", hint: "Campaigns" },
  { name: "SabChat", href: "/dashboard/sabchat", dot: "bg-cyan-500", ring: "ring-cyan-200", hint: "Live Chat" },
  { name: "Sites", href: "/dashboard/website-builder", dot: "bg-fuchsia-500", ring: "ring-fuchsia-200", hint: "Web Builder" },
];

function broadcastBadgeTone(status: string): "green" | "amber" | "red" | "neutral" {
  const s = status.toLowerCase();
  if (s === "completed" || s === "sent" || s === "delivered") return "green";
  if (s === "scheduled" || s === "queued" || s === "processing") return "amber";
  if (s === "failed" || s === "cancelled") return "red";
  return "neutral";
}

export default async function HomePage() {
  const [data, session, obState] = await Promise.all([
    getAccountHomeData(),
    getSession(),
    getOnboardingState(),
  ]);

  const u = session?.user as { name?: string; email?: string } | undefined;
  const userName = u?.name || u?.email?.split("@")[0] || "there";

  const { stats, velocity, recentBroadcasts, recentActivity } = data;
  const pct = (n: number, d: number) => (d ? Math.round((n / d) * 100) : 0);

  const deliveryRate = pct(stats.totalDelivered, stats.totalSent);
  const dealsWonRate = pct(stats.dealsWon, stats.totalDeals);
  const messageDelta =
    velocity.messagesPrev24h > 0
      ? Math.round(((velocity.messagesLast24h - velocity.messagesPrev24h) / velocity.messagesPrev24h) * 100)
      : undefined;

  const onboarding = obState?.onboarding;
  const onboardingPct =
    onboarding && onboarding.status !== "complete"
      ? Math.max(0, Math.min(100, Number((onboarding as { progress?: number }).progress ?? 0)))
      : 0;

  return (
    <HomeMotionShell>
      <div className="mx-auto w-full max-w-[1400px] px-6 pt-6 pb-12 space-y-4">
        {/* Hero ribbon - slim, flat surface with soft inner border */}
        <section
          aria-label="Welcome"
          className="rounded-2xl border border-zinc-200 bg-white px-5 py-4 shadow-[0_1px_0_0_rgb(0_0_0_/_0.02)]"
        >
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <span className="inline-flex h-2 w-2 rounded-full bg-emerald-500" aria-hidden />
              <div className="min-w-0">
                <h1 className="truncate text-lg font-semibold tracking-tight text-[var(--st-text)]">
                  Good to see you, {userName}
                </h1>
                <p className="mt-0.5 text-xs text-zinc-500">
                  Here is what is moving across your workspace today.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="neutral" className="rounded-full px-2.5 py-0.5 text-[11px] font-medium">
                {stats.planName || "Free"} plan
              </Badge>
              <Badge tone="obsidian" className="rounded-full px-2.5 py-0.5 text-[11px] font-medium">
                {stats.credits.toLocaleString()} credits
              </Badge>
              <Button
                size="sm"
                className="h-8 rounded-full px-3 text-[12px] font-medium active:scale-[0.97]"
                asChild
              >
                <Link href="/dashboard/sabflow">
                  <Zap className="mr-1.5 h-3.5 w-3.5" /> Open SabFlow
                </Link>
              </Button>
            </div>
          </div>
        </section>

        {/* Onboarding strip */}
        {onboarding && onboarding.status !== "complete" && (
          <section
            aria-label="Onboarding"
            className="rounded-2xl border border-amber-200 bg-amber-50/60 px-5 py-4"
          >
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-amber-600 ring-1 ring-amber-200">
                  <Rocket className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-zinc-900">Finish your setup</p>
                  <p className="mt-0.5 text-xs text-zinc-600">
                    A few steps left before SabNode is fully tuned for you.
                  </p>
                </div>
              </div>
              <div className="flex w-full items-center gap-3 md:w-72">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-amber-100">
                  <div
                    className="h-full rounded-full bg-amber-500 transition-transform"
                    style={{ width: `${onboardingPct || 12}%` }}
                  />
                </div>
                <span className="font-mono text-[11px] text-amber-700">{onboardingPct || 12}%</span>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 rounded-full px-3 text-[12px] active:scale-[0.97]"
                  asChild
                >
                  <Link href="/dashboard/onboarding">Continue</Link>
                </Button>
              </div>
            </div>
          </section>
        )}

        {/* KPI strip - 6 tiles */}
        <section aria-label="KPIs" className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          <StatCard
            label="Messages"
            value={stats.totalMessages.toLocaleString()}
            icon={<MessageSquare />}
            delta={messageDelta}
            period="last 24h vs prior"
          />
          <StatCard
            label="Delivery"
            value={`${deliveryRate}%`}
            icon={<Activity />}
            period={stats.totalSent > 0 ? `${stats.totalSent.toLocaleString()} sent` : "no sends yet"}
          />
          <StatCard
            label="Contacts"
            value={stats.totalContacts.toLocaleString()}
            icon={<Users />}
            delta={velocity.contactsLast7d > 0 ? velocity.contactsLast7d : undefined}
            formatDelta={(d) => `+${d}`}
            period="added 7d"
          />
          <StatCard
            label="Deals"
            value={stats.totalDeals.toLocaleString()}
            icon={<Briefcase />}
            delta={dealsWonRate > 0 ? dealsWonRate : undefined}
            formatDelta={(d) => `${d}% won`}
            period="win rate"
          />
          <StatCard
            label="Active Flows"
            value={stats.activeFlows.toLocaleString()}
            icon={<Workflow />}
            period={`${stats.totalFlows.toLocaleString()} total`}
          />
          <StatCard
            label="Pipeline"
            value={`${data.currency} ${stats.pipelineValue.toLocaleString()}`}
            icon={<TrendingUp />}
            period={`${stats.totalLeads.toLocaleString()} leads`}
          />
        </section>

        {/* Quick launch */}
        <section
          aria-label="Quick launch"
          className="rounded-2xl border border-zinc-200 bg-white px-4 py-3"
        >
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold tracking-tight text-zinc-900">Quick launch</h2>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-0.5 text-[11px] font-medium text-zinc-500 hover:text-zinc-900"
            >
              All modules <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-8">
            {QUICK_LAUNCH.map((m) => (
              <Link
                key={m.name}
                href={m.href}
                className="group rounded-xl border border-zinc-200 bg-white px-3 py-2.5 transition-colors hover:border-zinc-300 active:scale-[0.97]"
              >
                <div className="flex items-center gap-2">
                  <span
                    aria-hidden
                    className={`inline-flex h-2 w-2 rounded-full ${m.dot} ring-2 ${m.ring} ring-offset-1 ring-offset-white`}
                  />
                  <span className="text-[13px] font-semibold text-zinc-900">{m.name}</span>
                </div>
                <p className="mt-1 text-[11px] text-zinc-500">{m.hint}</p>
              </Link>
            ))}
          </div>
        </section>

        {/* Two-column main grid */}
        <section className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          {/* Recent broadcasts - spans 2 */}
          <div className="rounded-2xl border border-zinc-200 bg-white lg:col-span-2">
            <header className="flex items-center justify-between border-b border-zinc-100 px-4 py-3">
              <div>
                <h2 className="text-sm font-semibold tracking-tight text-zinc-900">Recent broadcasts</h2>
                <p className="mt-0.5 text-[11px] text-zinc-500">Latest sends across your channels</p>
              </div>
              <Link
                href="/dashboard/sabcampaigns"
                className="inline-flex items-center gap-0.5 rounded-md px-2 py-1 text-[11px] font-medium text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900"
              >
                View all <ArrowRight className="h-3 w-3" />
              </Link>
            </header>
            <div>
              {recentBroadcasts.length === 0 ? (
                <div className="p-4">
                  <EmptyState
                    compact
                    icon={<Megaphone />}
                    title="No broadcasts yet"
                    description="Create your first campaign to reach your audience."
                    action={
                      <Button
                        size="sm"
                        className="h-8 rounded-full px-3 text-[12px] active:scale-[0.97]"
                        asChild
                      >
                        <Link href="/dashboard/sabcampaigns">Create broadcast</Link>
                      </Button>
                    }
                  />
                </div>
              ) : (
                <ul className="divide-y divide-zinc-100">
                  {recentBroadcasts.slice(0, 6).map((b) => {
                    const successRate = pct(b.successCount, b.totalContacts);
                    const trendingUp = successRate >= 80;
                    return (
                      <li
                        key={b._id}
                        className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-zinc-50/60"
                      >
                        <span
                          aria-hidden
                          className={`inline-flex h-1.5 w-1.5 shrink-0 rounded-full ${
                            trendingUp ? "bg-emerald-500" : "bg-zinc-300"
                          }`}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13px] font-medium text-zinc-900">{b.name}</p>
                          <div className="mt-0.5 flex items-center gap-2 text-[11px] text-zinc-500">
                            <Badge
                              tone={broadcastBadgeTone(b.status)}
                              className="rounded-full px-1.5 py-0 text-[10px] uppercase tracking-wide"
                            >
                              {b.status}
                            </Badge>
                            <span>{new Date(b.createdAt).toLocaleDateString()}</span>
                            {b.projectName && (
                              <>
                                <span aria-hidden>·</span>
                                <span className="truncate">{b.projectName}</span>
                              </>
                            )}
                          </div>
                        </div>
                        <div className="hidden shrink-0 text-right sm:block">
                          <p className="font-mono text-[12px] font-medium text-zinc-900">
                            {b.successCount.toLocaleString()}
                            <span className="text-zinc-400"> / {b.totalContacts.toLocaleString()}</span>
                          </p>
                          <p
                            className={`inline-flex items-center gap-0.5 text-[11px] ${
                              trendingUp ? "text-emerald-600" : "text-zinc-500"
                            }`}
                          >
                            <ArrowUpRight className="h-3 w-3" /> {successRate}%
                          </p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>

          {/* Recent activity */}
          <div className="rounded-2xl border border-zinc-200 bg-white">
            <header className="flex items-center justify-between border-b border-zinc-100 px-4 py-3">
              <div>
                <h2 className="text-sm font-semibold tracking-tight text-zinc-900">Activity</h2>
                <p className="mt-0.5 text-[11px] text-zinc-500">Your team in real time</p>
              </div>
              <Link
                href="/dashboard/crm/activity"
                className="inline-flex items-center gap-0.5 rounded-md px-2 py-1 text-[11px] font-medium text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900"
              >
                Feed <ArrowRight className="h-3 w-3" />
              </Link>
            </header>
            {recentActivity.length === 0 ? (
              <div className="p-4">
                <EmptyState
                  compact
                  icon={<Inbox />}
                  title="All quiet for now"
                  description="Activity will appear here as your team works."
                />
              </div>
            ) : (
              <ol className="relative px-4 py-3">
                <span
                  aria-hidden
                  className="absolute left-[26px] top-4 bottom-4 w-px bg-zinc-100"
                />
                {recentActivity.slice(0, 6).map((a) => {
                  const monogram = a.userName.substring(0, 2).toUpperCase();
                  return (
                    <li key={a._id} className="relative flex items-start gap-3 py-2">
                      <span className="relative z-10 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-[10px] font-semibold text-white ring-4 ring-white">
                        {monogram}
                      </span>
                      <div className="min-w-0 flex-1 pt-1">
                        <p className="text-[13px] leading-tight text-zinc-900">
                          <span className="font-semibold">{a.userName}</span>{" "}
                          <span className="text-zinc-600">{a.action}</span>
                        </p>
                        <p className="mt-0.5 text-[11px] text-zinc-400">
                          {new Date(a.createdAt).toLocaleString()}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </div>
        </section>

        {/* Bottom utility row */}
        <section className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-zinc-200 bg-white px-4 py-3">
            <div className="flex items-center gap-2 text-zinc-500">
              <Database className="h-3.5 w-3.5" />
              <span className="text-[11px] font-medium uppercase tracking-wide">Library</span>
            </div>
            <p className="mt-1 font-mono text-xl font-semibold text-zinc-900">
              {stats.totalLibraryTemplates.toLocaleString()}
            </p>
            <p className="mt-0.5 text-[11px] text-zinc-500">templates available</p>
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-white px-4 py-3">
            <div className="flex items-center gap-2 text-zinc-500">
              <Globe2 className="h-3.5 w-3.5" />
              <span className="text-[11px] font-medium uppercase tracking-wide">SEO Projects</span>
            </div>
            <p className="mt-1 font-mono text-xl font-semibold text-zinc-900">
              {stats.totalSeoProjects.toLocaleString()}
            </p>
            <p className="mt-0.5 text-[11px] text-zinc-500">
              {stats.totalSeoAudits.toLocaleString()} audits run
            </p>
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-white px-4 py-3">
            <div className="flex items-center gap-2 text-zinc-500">
              <Mail className="h-3.5 w-3.5" />
              <span className="text-[11px] font-medium uppercase tracking-wide">Email</span>
            </div>
            <p className="mt-1 font-mono text-xl font-semibold text-zinc-900">
              {stats.totalEmailCampaigns.toLocaleString()}
            </p>
            <p className="mt-0.5 text-[11px] text-zinc-500">
              {stats.totalEmailContacts.toLocaleString()} contacts
            </p>
          </div>
        </section>
      </div>
    </HomeMotionShell>
  );
}
