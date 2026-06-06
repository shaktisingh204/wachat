export const dynamic = "force-dynamic";

import React from "react";
import Link from "next/link";
import { getAccountHomeData } from "@/app/actions/home.actions";
import { getSession } from "@/app/actions/user.actions";
import { getOnboardingState } from "@/app/actions/onboarding-flow.actions";

import {
  Badge,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  EmptyState,
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  PageDescription,
  PageActions,
  type BadgeTone,
} from "@/components/sabcrm/20ui";
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
  Database,
  Workflow,
  Mail,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
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

function broadcastBadgeTone(status: string): BadgeTone {
  const s = status.toLowerCase();
  if (s === "completed" || s === "sent" || s === "delivered") return "success";
  if (s === "scheduled" || s === "queued" || s === "processing") return "warning";
  if (s === "failed" || s === "cancelled") return "danger";
  return "neutral";
}

type KpiTile = {
  label: string;
  value: string;
  icon: LucideIcon;
  period: string;
  delta?: { text: string; tone: "up" | "neutral" };
};

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
  const onboardingFill = onboardingPct || 12;

  const kpis: KpiTile[] = [
    {
      label: "Messages",
      value: stats.totalMessages.toLocaleString(),
      icon: MessageSquare,
      period: "last 24h vs prior",
      delta:
        messageDelta !== undefined
          ? { text: `${messageDelta >= 0 ? "+" : ""}${messageDelta}%`, tone: messageDelta >= 0 ? "up" : "neutral" }
          : undefined,
    },
    {
      label: "Delivery",
      value: `${deliveryRate}%`,
      icon: Activity,
      period: stats.totalSent > 0 ? `${stats.totalSent.toLocaleString()} sent` : "no sends yet",
    },
    {
      label: "Contacts",
      value: stats.totalContacts.toLocaleString(),
      icon: Users,
      period: "added 7d",
      delta: velocity.contactsLast7d > 0 ? { text: `+${velocity.contactsLast7d}`, tone: "up" } : undefined,
    },
    {
      label: "Deals",
      value: stats.totalDeals.toLocaleString(),
      icon: Briefcase,
      period: "win rate",
      delta: dealsWonRate > 0 ? { text: `${dealsWonRate}% won`, tone: "up" } : undefined,
    },
    {
      label: "Active Flows",
      value: stats.activeFlows.toLocaleString(),
      icon: Workflow,
      period: `${stats.totalFlows.toLocaleString()} total`,
    },
    {
      label: "Pipeline",
      value: `${data.currency} ${stats.pipelineValue.toLocaleString()}`,
      icon: TrendingUp,
      period: `${stats.totalLeads.toLocaleString()} leads`,
    },
  ];

  return (
    <HomeMotionShell>
      <div className="ui20 mx-auto w-full max-w-[1400px] px-6 pt-6 pb-12 space-y-4">
        {/* Hero ribbon */}
        <Card variant="outlined" padding="md" aria-label="Welcome">
          <PageHeader bordered={false} compact>
            <PageHeaderHeading>
              <div className="flex items-center gap-2.5">
                <span className="inline-flex h-2 w-2 rounded-full bg-emerald-500" aria-hidden="true" />
                <PageTitle>Good to see you, {userName}</PageTitle>
              </div>
              <PageDescription>
                Here is what is moving across your workspace today.
              </PageDescription>
            </PageHeaderHeading>
            <PageActions>
              <Badge tone="neutral">{stats.planName || "Free"} plan</Badge>
              <Badge tone="neutral" kind="solid">
                {stats.credits.toLocaleString()} credits
              </Badge>
              <Link href="/dashboard/sabflow" className="u-btn u-btn--primary u-btn--sm">
                <Zap size={13} aria-hidden="true" />
                <span className="u-btn__label">Open SabFlow</span>
              </Link>
            </PageActions>
          </PageHeader>
        </Card>

        {/* Onboarding strip */}
        {onboarding && onboarding.status !== "complete" && (
          <Card variant="outlined" padding="md" aria-label="Onboarding">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <span
                  className="flex h-9 w-9 items-center justify-center rounded-[var(--st-radius)] bg-[var(--st-bg-secondary)] text-[var(--st-warn)]"
                  aria-hidden="true"
                >
                  <Rocket size={16} />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[var(--st-text)]">Finish your setup</p>
                  <p className="mt-0.5 text-xs text-[var(--st-text-secondary)]">
                    A few steps left before SabNode is fully tuned for you.
                  </p>
                </div>
              </div>
              <div className="flex w-full items-center gap-3 md:w-72">
                <div
                  className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--st-bg-secondary)]"
                  role="progressbar"
                  aria-label="Onboarding progress"
                  aria-valuenow={onboardingFill}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <div
                    className="h-full rounded-full bg-[var(--st-warn)]"
                    style={{ width: `${onboardingFill}%` }}
                  />
                </div>
                <span className="font-mono text-[11px] text-[var(--st-warn)]">{onboardingFill}%</span>
                <Link href="/dashboard/onboarding" className="u-btn u-btn--outline u-btn--sm">
                  <span className="u-btn__label">Continue</span>
                </Link>
              </div>
            </div>
          </Card>
        )}

        {/* KPI strip - 6 tiles */}
        <section aria-label="KPIs" className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          {kpis.map((k) => {
            const Icon = k.icon;
            return (
              <Card key={k.label} variant="outlined" padding="md">
                <div className="flex items-center gap-2 text-[var(--st-text-secondary)]">
                  <Icon size={15} aria-hidden="true" />
                  <span className="text-[11px] font-medium uppercase tracking-wide">{k.label}</span>
                </div>
                <p className="mt-1.5 text-xl font-semibold tracking-tight text-[var(--st-text)]">
                  {k.value}
                </p>
                <div className="mt-1 flex items-center gap-2">
                  {k.delta && (
                    <span
                      className={`text-[11px] font-medium ${
                        k.delta.tone === "up" ? "text-[var(--st-status-ok)]" : "text-[var(--st-text-tertiary)]"
                      }`}
                    >
                      {k.delta.text}
                    </span>
                  )}
                  <span className="text-[11px] text-[var(--st-text-tertiary)]">{k.period}</span>
                </div>
              </Card>
            );
          })}
        </section>

        {/* Quick launch */}
        <Card variant="outlined" padding="md" aria-label="Quick launch">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold tracking-tight text-[var(--st-text)]">Quick launch</h2>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-0.5 text-[11px] font-medium text-[var(--st-text-secondary)] hover:text-[var(--st-text)]"
            >
              All modules <ArrowRight size={12} aria-hidden="true" />
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-8">
            {QUICK_LAUNCH.map((m) => (
              <Link
                key={m.name}
                href={m.href}
                className="group rounded-[var(--st-radius)] border border-[var(--st-border)] px-3 py-2.5 transition-colors hover:border-[var(--st-border-strong)] active:scale-[0.97]"
              >
                <div className="flex items-center gap-2">
                  <span
                    aria-hidden="true"
                    className={`inline-flex h-2 w-2 rounded-full ${m.dot} ring-2 ${m.ring} ring-offset-1`}
                  />
                  <span className="text-[13px] font-semibold text-[var(--st-text)]">{m.name}</span>
                </div>
                <p className="mt-1 text-[11px] text-[var(--st-text-secondary)]">{m.hint}</p>
              </Link>
            ))}
          </div>
        </Card>

        {/* Two-column main grid */}
        <section className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          {/* Recent broadcasts - spans 2 */}
          <Card variant="outlined" padding="none" className="lg:col-span-2">
            <CardHeader className="flex items-center justify-between gap-2">
              <div>
                <CardTitle>Recent broadcasts</CardTitle>
                <CardDescription>Latest sends across your channels</CardDescription>
              </div>
              <Link
                href="/dashboard/sabcampaigns"
                className="inline-flex items-center gap-0.5 rounded-[var(--st-radius)] px-2 py-1 text-[11px] font-medium text-[var(--st-text-secondary)] hover:bg-[var(--st-bg-secondary)] hover:text-[var(--st-text)]"
              >
                View all <ArrowRight size={12} aria-hidden="true" />
              </Link>
            </CardHeader>
            <div>
              {recentBroadcasts.length === 0 ? (
                <div className="p-4">
                  <EmptyState
                    size="sm"
                    icon={Megaphone}
                    title="No broadcasts yet"
                    description="Create your first campaign to reach your audience."
                    action={
                      <Link href="/dashboard/sabcampaigns" className="u-btn u-btn--primary u-btn--sm">
                        <span className="u-btn__label">Create broadcast</span>
                      </Link>
                    }
                  />
                </div>
              ) : (
                <ul className="divide-y divide-[var(--st-border)]">
                  {recentBroadcasts.slice(0, 6).map((b) => {
                    const successRate = pct(b.successCount, b.totalContacts);
                    const trendingUp = successRate >= 80;
                    return (
                      <li
                        key={b._id}
                        className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-[var(--st-bg-secondary)]"
                      >
                        <span
                          aria-hidden="true"
                          className={`inline-flex h-1.5 w-1.5 shrink-0 rounded-full ${
                            trendingUp ? "bg-emerald-500" : "bg-[var(--st-text-tertiary)]"
                          }`}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13px] font-medium text-[var(--st-text)]">{b.name}</p>
                          <div className="mt-0.5 flex items-center gap-2 text-[11px] text-[var(--st-text-secondary)]">
                            <Badge tone={broadcastBadgeTone(b.status)} className="uppercase tracking-wide">
                              {b.status}
                            </Badge>
                            <span>{new Date(b.createdAt).toLocaleDateString()}</span>
                            {b.projectName && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span className="truncate">{b.projectName}</span>
                              </>
                            )}
                          </div>
                        </div>
                        <div className="hidden shrink-0 text-right sm:block">
                          <p className="font-mono text-[12px] font-medium text-[var(--st-text)]">
                            {b.successCount.toLocaleString()}
                            <span className="text-[var(--st-text-tertiary)]"> / {b.totalContacts.toLocaleString()}</span>
                          </p>
                          <p
                            className={`inline-flex items-center gap-0.5 text-[11px] ${
                              trendingUp ? "text-[var(--st-status-ok)]" : "text-[var(--st-text-secondary)]"
                            }`}
                          >
                            <ArrowUpRight size={12} aria-hidden="true" /> {successRate}%
                          </p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </Card>

          {/* Recent activity */}
          <Card variant="outlined" padding="none">
            <CardHeader className="flex items-center justify-between gap-2">
              <div>
                <CardTitle>Activity</CardTitle>
                <CardDescription>Your team in real time</CardDescription>
              </div>
              <Link
                href="/dashboard/crm/activity"
                className="inline-flex items-center gap-0.5 rounded-[var(--st-radius)] px-2 py-1 text-[11px] font-medium text-[var(--st-text-secondary)] hover:bg-[var(--st-bg-secondary)] hover:text-[var(--st-text)]"
              >
                Feed <ArrowRight size={12} aria-hidden="true" />
              </Link>
            </CardHeader>
            {recentActivity.length === 0 ? (
              <div className="p-4">
                <EmptyState
                  size="sm"
                  icon={Inbox}
                  title="All quiet for now"
                  description="Activity will appear here as your team works."
                />
              </div>
            ) : (
              <ol className="relative px-4 py-3">
                <span
                  aria-hidden="true"
                  className="absolute left-[26px] top-4 bottom-4 w-px bg-[var(--st-border)]"
                />
                {recentActivity.slice(0, 6).map((a) => {
                  const monogram = a.userName.substring(0, 2).toUpperCase();
                  return (
                    <li key={a._id} className="relative flex items-start gap-3 py-2">
                      <span className="relative z-10 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--st-text)] text-[10px] font-semibold text-[var(--st-bg)] ring-4 ring-[var(--st-bg)]">
                        {monogram}
                      </span>
                      <div className="min-w-0 flex-1 pt-1">
                        <p className="text-[13px] leading-tight text-[var(--st-text)]">
                          <span className="font-semibold">{a.userName}</span>{" "}
                          <span className="text-[var(--st-text-secondary)]">{a.action}</span>
                        </p>
                        <p className="mt-0.5 text-[11px] text-[var(--st-text-tertiary)]">
                          {new Date(a.createdAt).toLocaleString()}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </Card>
        </section>

        {/* Bottom utility row */}
        <section className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <Card variant="outlined" padding="md">
            <div className="flex items-center gap-2 text-[var(--st-text-secondary)]">
              <Database size={14} aria-hidden="true" />
              <span className="text-[11px] font-medium uppercase tracking-wide">Library</span>
            </div>
            <p className="mt-1 font-mono text-xl font-semibold text-[var(--st-text)]">
              {stats.totalLibraryTemplates.toLocaleString()}
            </p>
            <p className="mt-0.5 text-[11px] text-[var(--st-text-secondary)]">templates available</p>
          </Card>
          <Card variant="outlined" padding="md">
            <div className="flex items-center gap-2 text-[var(--st-text-secondary)]">
              <Globe2 size={14} aria-hidden="true" />
              <span className="text-[11px] font-medium uppercase tracking-wide">SEO Projects</span>
            </div>
            <p className="mt-1 font-mono text-xl font-semibold text-[var(--st-text)]">
              {stats.totalSeoProjects.toLocaleString()}
            </p>
            <p className="mt-0.5 text-[11px] text-[var(--st-text-secondary)]">
              {stats.totalSeoAudits.toLocaleString()} audits run
            </p>
          </Card>
          <Card variant="outlined" padding="md">
            <div className="flex items-center gap-2 text-[var(--st-text-secondary)]">
              <Mail size={14} aria-hidden="true" />
              <span className="text-[11px] font-medium uppercase tracking-wide">Email</span>
            </div>
            <p className="mt-1 font-mono text-xl font-semibold text-[var(--st-text)]">
              {stats.totalEmailCampaigns.toLocaleString()}
            </p>
            <p className="mt-0.5 text-[11px] text-[var(--st-text-secondary)]">
              {stats.totalEmailContacts.toLocaleString()} contacts
            </p>
          </Card>
        </section>
      </div>
    </HomeMotionShell>
  );
}
