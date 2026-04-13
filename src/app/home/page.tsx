'use client';

/**
 * /home — SabNode account dashboard, rebuilt on the Clay design system.
 *
 * Every value on this page is real data from getAccountHomeData(), which
 * aggregates across ALL projects the user owns or is an agent in. No mocks.
 */

import * as React from 'react';
import { useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { format, formatDistanceToNow } from 'date-fns';
import {
  LuSend,
  LuCheckCheck,
  LuUsers,
  LuBriefcase,
  LuBell,
  LuSparkles,
  LuTrendingUp,
  LuTrendingDown,
  LuChevronDown,
  LuPlus,
  LuEllipsis,
  LuDownload,
  LuFilter,
  LuArrowRight,
  LuAlarmClock,
  LuArrowUpRight,
  /* ── All-apps grid icons ── */
  LuMessageSquare,
  LuWorkflow,
  LuBot,
  LuMail,
  LuSmartphone,
  LuGlobe,
  LuShoppingBag,
  LuLink,
  LuQrCode,
  LuLayoutTemplate,
  LuMegaphone,
  LuEarth,
  LuCircleCheck,
  LuCircleDashed,
  LuRocket,
} from 'react-icons/lu';

import { cn } from '@/lib/utils';
import {
  getAccountHomeData,
  type AccountHomeData,
} from '@/app/actions/home.actions';
import { getSession } from '@/app/actions/user.actions';
import {
  getOnboardingState,
  type OnboardingState,
} from '@/app/actions/onboarding-flow.actions';

import {
  ClayBreadcrumbs,
  ClayButton,
  ClayCard,
  ClayNotificationCard,
  ClaySectionList,
  ClayAvatarStack,
  ClayModuleTile,
  type ClayAvatarStackItem,
} from '@/components/clay';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

/* ── helpers ────────────────────────────────────────────────────── */

function compact(n: number | null | undefined): string {
  const v = typeof n === 'number' && Number.isFinite(n) ? n : 0;
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (v >= 1_000) return (v / 1_000).toFixed(1).replace(/\.0$/, '') + 'k';
  return v.toString();
}

function curr(n: number | null | undefined, c = 'INR'): string {
  const sym = c === 'INR' ? '₹' : '$';
  const v = typeof n === 'number' && Number.isFinite(n) ? n : 0;
  if (v >= 1_000_000) return `${sym}${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${sym}${(v / 1_000).toFixed(1)}k`;
  return `${sym}${v.toLocaleString()}`;
}

function pct(n: number, d: number): number {
  if (!d) return 0;
  return Math.round((n / d) * 1000) / 10;
}

function trend(cur: number, prev: number) {
  if (!prev) return { delta: cur > 0 ? 100 : 0, up: cur >= 0 };
  const delta = ((cur - prev) / prev) * 100;
  return { delta: Math.round(delta * 10) / 10, up: delta >= 0 };
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 5) return 'Still up';
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  if (h < 21) return 'Good evening';
  return 'Good night';
}

/* ── avatar palette for overlapping project/contact bubbles ────── */

function palette(n: number): ClayAvatarStackItem[] {
  const hues = [12, 210, 150, 40, 280, 330, 190, 60, 120, 0];
  const letters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
  return Array.from({ length: n }, (_, i) => ({
    alt: letters[i % 10],
    fallback: letters[i % 10],
    hue: hues[i % hues.length],
  }));
}

/* ── skeleton ───────────────────────────────────────────────────── */

function HomeSkeleton() {
  return (
    <div className="mx-auto w-full max-w-[1320px] px-9 pt-7 pb-8">
      <div className="h-3 w-52 animate-pulse rounded-full bg-clay-bg-2" />
      <div className="mt-5 flex items-center justify-between">
        <div className="h-9 w-56 animate-pulse rounded-md bg-clay-bg-2" />
        <div className="flex gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-9 w-28 animate-pulse rounded-full bg-clay-bg-2"
            />
          ))}
        </div>
      </div>
      <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_280px]">
        <div className="h-[150px] animate-pulse rounded-[14px] bg-clay-bg-2" />
        <div className="h-[150px] animate-pulse rounded-[14px] bg-clay-bg-2" />
        <div className="flex flex-col gap-2">
          <div className="h-11 animate-pulse rounded-[12px] bg-clay-bg-2" />
          <div className="h-11 animate-pulse rounded-[12px] bg-clay-bg-2" />
          <div className="h-11 animate-pulse rounded-[12px] bg-clay-bg-2" />
        </div>
      </div>
      <div className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="h-[400px] animate-pulse rounded-clay-lg bg-clay-bg-2" />
        <div className="flex flex-col gap-4">
          <div className="h-24 animate-pulse rounded-clay-lg bg-clay-bg-2" />
          <div className="h-56 animate-pulse rounded-clay-lg bg-clay-bg-2" />
        </div>
      </div>
    </div>
  );
}

/* ── onboarding setup card ──────────────────────────────────────── */

const ONBOARDING_STEPS = [
  { key: 'profile', label: 'Tell us about you' },
  { key: 'business', label: 'Your business details' },
  { key: 'requirements', label: 'Choose your modules' },
  { key: 'plan', label: 'Pick a plan' },
] as const;

function OnboardingSetupCard({
  status,
}: {
  status: 'profile' | 'business' | 'requirements' | 'plan' | 'complete';
}) {
  const router = useRouter();
  const statusOrder = ['profile', 'business', 'requirements', 'plan', 'complete'];
  const currentIdx = statusOrder.indexOf(status);
  const completedCount = currentIdx;
  const totalSteps = ONBOARDING_STEPS.length;

  return (
    <div className="mt-6 rounded-[14px] border border-clay-border bg-clay-bg-1 p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
            <LuRocket className="h-5 w-5 text-primary" strokeWidth={2} />
          </div>
          <div>
            <h3 className="text-[15px] font-semibold text-clay-ink">
              Complete your setup
            </h3>
            <p className="mt-0.5 text-[13px] text-clay-ink-muted">
              {completedCount} of {totalSteps} steps done — finish setting up to unlock your full workspace.
            </p>
          </div>
        </div>
        <ClayButton
          variant="obsidian"
          size="md"
          trailing={<LuArrowRight className="h-3.5 w-3.5" />}
          onClick={() => router.push('/onboarding')}
        >
          Continue setup
        </ClayButton>
      </div>

      {/* Step progress */}
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {ONBOARDING_STEPS.map((step, idx) => {
          const isDone = idx < currentIdx;
          const isCurrent = idx === currentIdx;
          return (
            <div
              key={step.key}
              className={cn(
                'flex items-center gap-2 rounded-lg border px-3 py-2 text-[13px] transition',
                isDone && 'border-primary/30 bg-primary/5 text-clay-ink',
                isCurrent && 'border-primary bg-primary/10 text-clay-ink font-medium',
                !isDone && !isCurrent && 'border-clay-border text-clay-ink-muted',
              )}
            >
              {isDone ? (
                <LuCircleCheck className="h-4 w-4 shrink-0 text-primary" strokeWidth={2} />
              ) : (
                <LuCircleDashed
                  className={cn('h-4 w-4 shrink-0', isCurrent ? 'text-primary' : 'text-clay-ink-muted/50')}
                  strokeWidth={2}
                />
              )}
              {step.label}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── page ───────────────────────────────────────────────────────── */

type TimeRange = '24h' | '7d' | '30d' | 'all';

const TIME_RANGE_LABELS: Record<TimeRange, string> = {
  '24h': 'Last 24 hours',
  '7d': 'Last 7 days',
  '30d': 'Last 30 days',
  all: 'All time',
};

export default function HomePage() {
  const router = useRouter();
  const [data, setData] = useState<AccountHomeData | null>(null);
  const [userName, setUserName] = useState<string>('there');
  const [loading, startTransition] = useTransition();
  const [timeRange, setTimeRange] = useState<TimeRange>('7d');
  const [onboardingStatus, setOnboardingStatus] = useState<OnboardingState | null>(null);
  const [onboardingChecked, setOnboardingChecked] = useState(false);

  useEffect(() => {
    document.title = 'Home · SabNode';
  }, []);

  const fetchHome = React.useCallback(() => {
    startTransition(() => {
      Promise.all([getAccountHomeData(), getSession(), getOnboardingState()]).then(
        ([home, session, obState]) => {
          setData(home);
          const u: any = session?.user;
          if (u) {
            setUserName(u.name || u.email?.split('@')[0] || 'there');
          }
          setOnboardingStatus(obState.onboarding);
          setOnboardingChecked(true);
        },
      );
    });
  }, []);

  useEffect(() => {
    fetchHome();
  }, [fetchHome]);

  /**
   * handleExport — serializes the entire AccountHomeData payload to a
   * JSON file and triggers a client-side download. Works for both the
   * page-header Export button and the Performance section Export button.
   */
  const handleExport = React.useCallback(() => {
    if (!data) return;
    const payload = {
      generatedAt: new Date().toISOString(),
      timeRange,
      userName,
      ...data,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sabnode-home-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [data, timeRange, userName]);

  const derived = useMemo(() => {
    if (!data) return null;
    const { stats, velocity } = data;
    return {
      deliveryRate: pct(stats.totalDelivered, stats.totalSent),
      smsDeliveryRate: pct(stats.totalSmsDelivered, stats.totalSmsSent),
      messagesTrend: trend(velocity.messagesLast24h, velocity.messagesPrev24h),
      dealsWonRate: pct(stats.dealsWon, stats.totalDeals),
    };
  }, [data]);

  if (loading || !data) {
    return <HomeSkeleton />;
  }

  const {
    stats,
    velocity,
    recentActivity,
    unreadNotifications,
    insights,
    currency,
  } = data;

  const projectAvatars = palette(Math.min(stats.totalProjects || 1, 8));
  const leadAvatars = palette(Math.min(stats.totalLeads || 1, 8));

  /* ── notification column content ── */
  const notificationCards: Array<{
    icon: React.ReactNode;
    title: string;
    tone?: 'default' | 'obsidian';
    onClick?: () => void;
  }> = [];

  // AI insight pinned on top if any
  if (insights[0]) {
    notificationCards.push({
      icon: <LuSparkles className="h-3.5 w-3.5" strokeWidth={2} />,
      title: insights[0].length > 48 ? insights[0].slice(0, 48) + '…' : insights[0],
    });
  }
  // Real unread notifications
  unreadNotifications.slice(0, 2).forEach((n) => {
    notificationCards.push({
      icon: <LuBell className="h-3.5 w-3.5" strokeWidth={2} />,
      title: n.message.length > 48 ? n.message.slice(0, 48) + '…' : n.message,
      onClick: () => router.push('/dashboard/notifications'),
    });
  });
  // Deadline / trend card (obsidian) — only if we have something meaningful
  if (velocity.broadcastsLast7d === 0 && stats.totalCampaigns > 0) {
    notificationCards.push({
      icon: <LuAlarmClock className="h-3.5 w-3.5" strokeWidth={2} />,
      title: 'No broadcasts this week',
      tone: 'obsidian',
      onClick: () => router.push('/dashboard/broadcasts'),
    });
  } else if (velocity.messagesLast24h > 0) {
    notificationCards.push({
      icon: <LuAlarmClock className="h-3.5 w-3.5" strokeWidth={2} />,
      title: `${compact(velocity.messagesLast24h)} msgs in 24h`,
      tone: 'obsidian',
      onClick: () => router.push('/dashboard/analytics'),
    });
  }
  // Fallback placeholder if nothing queued
  while (notificationCards.length < 3) {
    notificationCards.push({
      icon: <LuSparkles className="h-3.5 w-3.5" strokeWidth={2} />,
      title:
        notificationCards.length === 0
          ? 'Welcome to SabNode'
          : notificationCards.length === 1
            ? 'Create your first broadcast'
            : 'Invite your team',
      onClick: () =>
        router.push(
          notificationCards.length === 1
            ? '/dashboard/broadcasts'
            : '/dashboard/team',
        ),
    });
  }

  /* ── quick modules list (right rail bottom) ── */
  const moduleRows = [
    {
      key: 'contacts',
      title: 'Wachat Contacts',
      meta: `${compact(stats.totalContacts)} · +${velocity.contactsLast7d} this week`,
      onClick: () => router.push('/dashboard/wachat/contacts'),
    },
    {
      key: 'flows',
      title: 'SabFlow Automations',
      meta: `${stats.activeFlows} active · ${stats.totalFlows} total`,
      onClick: () => router.push('/dashboard/sabflow'),
    },
    {
      key: 'sabchat',
      title: 'SabChat Sessions',
      meta: `${compact(stats.totalSabChatSessions)} · AI chatbot`,
      onClick: () => router.push('/dashboard/sabchat'),
    },
    {
      key: 'sms',
      title: 'SMS Campaigns',
      meta: `${compact(stats.totalSmsSent)} sent · ${derived?.smsDeliveryRate ?? 0}% delivered`,
      onClick: () => router.push('/dashboard/sms'),
    },
  ];

  return (
    <div className="mx-auto w-full max-w-[1320px] px-9 pt-7 pb-10 clay-enter">
      {/* ── Breadcrumb ── */}
      <ClayBreadcrumbs
        items={[
          { label: 'SabNode', href: '/home' },
          { label: 'Account', href: '/home' },
          { label: 'Overview' },
        ]}
      />

      {/* ── Page header ── */}
      <div className="mt-5 flex items-center justify-between gap-6">
        <div className="min-w-0">
          <h1 className="text-[30px] font-semibold tracking-[-0.015em] text-clay-ink leading-[1.1]">
            {greeting()}, {userName}
          </h1>
          <p className="mt-1.5 text-[13px] text-clay-ink-muted">
            {stats.totalProjects} project{stats.totalProjects !== 1 ? 's' : ''} ·{' '}
            {format(new Date(), 'EEEE, MMM d · HH:mm')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Plan pill → billing */}
          <ClayButton
            variant="pill"
            size="md"
            trailing={<LuChevronDown className="h-3 w-3 opacity-60" />}
            onClick={() => router.push('/dashboard/billing')}
          >
            {stats.planName || 'Free plan'}
          </ClayButton>

          {/* Export pill → download stats as JSON */}
          <ClayButton
            variant="pill"
            size="md"
            leading={<LuDownload className="h-3.5 w-3.5" strokeWidth={2} />}
            onClick={handleExport}
          >
            Export
          </ClayButton>

          {/* Filter pill → dropdown to jump into filtered views */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <ClayButton
                variant="pill"
                size="md"
                leading={<LuFilter className="h-3.5 w-3.5" strokeWidth={2} />}
              >
                Filter
              </ClayButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Filter by</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={() => router.push('/dashboard/analytics')}
              >
                <LuSend className="mr-2 h-4 w-4" /> Messages &amp; delivery
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => router.push('/dashboard/crm/sales-crm/leads')}
              >
                <LuBriefcase className="mr-2 h-4 w-4" /> CRM pipeline
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => router.push('/dashboard/sabflow')}
              >
                <LuWorkflow className="mr-2 h-4 w-4" /> Active flows
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => router.push('/dashboard/notifications')}
              >
                <LuBell className="mr-2 h-4 w-4" /> Unread notifications
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={fetchHome}>
                <LuAlarmClock className="mr-2 h-4 w-4" /> Refresh data
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* ── Onboarding pending banner ── */}
      {onboardingChecked && onboardingStatus && onboardingStatus.status !== 'complete' && (
        <OnboardingSetupCard status={onboardingStatus.status} />
      )}

      {/* ── Big cards row ── */}
      <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_280px]">
        {/* Card 1 — WhatsApp stats */}
        <BigStatCard
          title="WhatsApp"
          subtitle="Last 30 days"
          metaLeft={
            <>
              <LuSend className="h-3 w-3 opacity-75" strokeWidth={1.75} />
              {compact(stats.totalMessages)} sent
            </>
          }
          metaRight={
            <>
              <LuCheckCheck className="h-3 w-3 opacity-75" strokeWidth={1.75} />
              {derived?.deliveryRate ?? 0}% delivered
            </>
          }
          statusDot="bg-clay-green"
          statusLabel={
            derived?.messagesTrend.up
              ? `+${derived?.messagesTrend.delta ?? 0}% vs prev 24h`
              : `${derived?.messagesTrend.delta ?? 0}% vs prev 24h`
          }
          avatars={projectAvatars}
          ctaLabel="View analytics"
          onCtaClick={() => router.push('/dashboard/analytics')}
        />

        {/* Card 2 — CRM pipeline */}
        <BigStatCard
          title="CRM Pipeline"
          subtitle={`${curr(stats.pipelineValue, currency)} total value`}
          metaLeft={
            <>
              <LuBriefcase className="h-3 w-3 opacity-75" strokeWidth={1.75} />
              {stats.totalDeals} deals
            </>
          }
          metaRight={
            <>
              <LuUsers className="h-3 w-3 opacity-75" strokeWidth={1.75} />
              {compact(stats.totalLeads)} leads
            </>
          }
          statusDot={stats.dealsWon > 0 ? 'bg-clay-green' : 'bg-clay-amber'}
          statusLabel={
            stats.dealsWon > 0
              ? `${stats.dealsWon} won`
              : `${velocity.leadsLast7d} new this week`
          }
          avatars={leadAvatars}
          ctaLabel="View pipeline"
          onCtaClick={() => router.push('/dashboard/crm/sales-crm/leads')}
        />

        {/* Notifications column */}
        <div className="flex flex-col gap-2">
          {notificationCards.slice(0, 3).map((n, i) => (
            <ClayNotificationCard
              key={i}
              icon={n.icon}
              title={n.title}
              tone={n.tone}
              onClick={n.onClick}
            />
          ))}
          <button
            type="button"
            onClick={() => router.push('/dashboard/notifications')}
            className="mt-1.5 flex items-center justify-between px-2 text-[11.5px] text-clay-ink-muted hover:text-clay-ink transition-colors"
          >
            <span>See all notifications</span>
            <span className="inline-flex items-center gap-1 rounded-full bg-clay-surface-2 border border-clay-border px-1.5 py-0.5 text-[10px] text-clay-ink-muted">
              <LuBell className="h-2.5 w-2.5" strokeWidth={2} />
              {unreadNotifications.length || 'Zero'}
            </span>
          </button>
        </div>
      </div>

      {/* ── All Apps overview — one live tile per SabNode module ── */}
      <section className="mt-10">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-[22px] font-semibold tracking-tight text-clay-ink leading-none">
              All Apps
            </h2>
            <p className="mt-1.5 text-[12.5px] text-clay-ink-muted">
              Live counts across every SabNode module ·{' '}
              {compact(stats.totalActivityLogs7d)} actions this week
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <ClayButton
              variant="pill"
              size="sm"
              onClick={() => router.push('/dashboard/integrations')}
            >
              Integrations
            </ClayButton>
            <ClayButton
              variant="pill"
              size="icon"
              aria-label="More"
              onClick={() => router.push('/dashboard/settings')}
            >
              <LuEllipsis className="h-4 w-4" />
            </ClayButton>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          <ClayModuleTile
            icon={<LuSend className="h-4 w-4" strokeWidth={2} />}
            name="Wachat Broadcasts"
            primary={`${compact(stats.totalMessages)} sent`}
            secondary={`${compact(stats.totalCampaigns)} campaigns · ${derived?.deliveryRate ?? 0}% delivered`}
            href="/dashboard/broadcasts"
            accent="green"
            status={stats.totalSent > 0 ? 'ok' : 'off'}
          />
          <ClayModuleTile
            icon={<LuMessageSquare className="h-4 w-4" strokeWidth={2} />}
            name="Wachat Chat"
            primary={compact(stats.totalContacts)}
            secondary={`contacts · +${velocity.contactsLast7d} this week`}
            href="/dashboard/chat"
            accent="teal"
            status={stats.totalContacts > 0 ? 'ok' : 'off'}
          />
          <ClayModuleTile
            icon={<LuWorkflow className="h-4 w-4" strokeWidth={2} />}
            name="SabFlow"
            primary={`${stats.activeFlows}/${stats.totalFlows}`}
            secondary={`${compact(stats.totalFlowExecutions)} executions`}
            href="/dashboard/sabflow"
            accent="violet"
            status={stats.activeFlows > 0 ? 'ok' : stats.totalFlows > 0 ? 'warn' : 'off'}
          />
          <ClayModuleTile
            icon={<LuBriefcase className="h-4 w-4" strokeWidth={2} />}
            name="CRM Pipeline"
            primary={curr(stats.pipelineValue, currency)}
            secondary={`${stats.totalDeals} deals · ${compact(stats.totalLeads)} leads`}
            href="/dashboard/crm/sales-crm/leads"
            accent="orange"
            status={stats.totalDeals > 0 ? 'ok' : stats.totalLeads > 0 ? 'warn' : 'off'}
          />

          <ClayModuleTile
            icon={<LuMail className="h-4 w-4" strokeWidth={2} />}
            name="Email"
            primary={compact(stats.totalEmailCampaigns)}
            secondary={`${compact(stats.totalEmailContacts)} contacts`}
            href="/dashboard/email"
            accent="blue"
            status={stats.totalEmailCampaigns > 0 ? 'ok' : 'off'}
          />
          <ClayModuleTile
            icon={<LuSmartphone className="h-4 w-4" strokeWidth={2} />}
            name="SMS"
            primary={compact(stats.totalSmsSent)}
            secondary={`${derived?.smsDeliveryRate ?? 0}% delivered`}
            href="/dashboard/sms"
            accent="lime"
            status={stats.totalSmsSent > 0 ? 'ok' : 'off'}
          />
          <ClayModuleTile
            icon={<LuBot className="h-4 w-4" strokeWidth={2} />}
            name="SabChat"
            primary={compact(stats.totalSabChatSessions)}
            secondary="AI chatbot sessions"
            href="/dashboard/sabchat"
            accent="pink"
            status={stats.totalSabChatSessions > 0 ? 'ok' : 'off'}
          />
          <ClayModuleTile
            icon={<LuGlobe className="h-4 w-4" strokeWidth={2} />}
            name="SEO Suite"
            primary={`${stats.totalSeoProjects} ${stats.totalSeoProjects === 1 ? 'site' : 'sites'}`}
            secondary={`${compact(stats.totalSeoAudits)} audits · ${compact(stats.totalSeoKeywords)} keywords`}
            href="/dashboard/seo"
            accent="indigo"
            status={stats.totalSeoAudits > 0 ? 'ok' : stats.totalSeoProjects > 0 ? 'warn' : 'off'}
          />

          <ClayModuleTile
            icon={<LuLayoutTemplate className="h-4 w-4" strokeWidth={2} />}
            name="Templates"
            primary={compact(stats.totalTemplates)}
            secondary={`${compact(stats.totalLibraryTemplates)} in library`}
            href="/dashboard/templates"
            accent="rose"
            status={stats.totalTemplates > 0 ? 'ok' : 'off'}
          />
          <ClayModuleTile
            icon={<LuShoppingBag className="h-4 w-4" strokeWidth={2} />}
            name="E-commerce"
            primary={compact(stats.totalEcommOrders)}
            secondary={`${compact(stats.totalEcommProducts)} products`}
            href="/dashboard/shop"
            accent="amber"
            status={stats.totalEcommOrders > 0 ? 'ok' : stats.totalEcommProducts > 0 ? 'warn' : 'off'}
          />
          <ClayModuleTile
            icon={<LuLink className="h-4 w-4" strokeWidth={2} />}
            name="URL Shortener"
            primary={compact(stats.totalShortUrls)}
            secondary="short links created"
            href="/dashboard/url-shortener"
            accent="slate"
            status={stats.totalShortUrls > 0 ? 'ok' : 'off'}
          />
          <ClayModuleTile
            icon={<LuQrCode className="h-4 w-4" strokeWidth={2} />}
            name="QR Codes"
            primary={compact(stats.totalQrCodes)}
            secondary="codes generated"
            href="/dashboard/qr-code-maker"
            accent="obsidian"
            status={stats.totalQrCodes > 0 ? 'ok' : 'off'}
          />

          <ClayModuleTile
            icon={<LuMegaphone className="h-4 w-4" strokeWidth={2} />}
            name="Facebook Suite"
            primary={compact(stats.totalFacebookBroadcasts)}
            secondary={`${compact(stats.totalFacebookSubscribers)} subscribers`}
            href="/dashboard/facebook/all-projects"
            accent="blue"
            status={stats.totalFacebookBroadcasts > 0 ? 'ok' : 'off'}
          />
          <ClayModuleTile
            icon={<LuEarth className="h-4 w-4" strokeWidth={2} />}
            name="Website Builder"
            primary={compact(stats.totalSites)}
            secondary="published sites"
            href="/dashboard/website-builder"
            accent="teal"
            status={stats.totalSites > 0 ? 'ok' : 'off'}
          />
          <ClayModuleTile
            icon={<LuUsers className="h-4 w-4" strokeWidth={2} />}
            name="Team"
            primary={compact(stats.totalTeamMessages)}
            secondary={
              stats.totalPendingInvitations > 0
                ? `${stats.totalPendingInvitations} pending invites`
                : 'team messages'
            }
            href="/dashboard/team"
            accent="rose"
            status={stats.totalPendingInvitations > 0 ? 'warn' : 'ok'}
          />
          <ClayModuleTile
            icon={<LuBell className="h-4 w-4" strokeWidth={2} />}
            name="Notifications"
            primary={compact(unreadNotifications.length)}
            secondary={unreadNotifications.length > 0 ? 'unread' : 'all caught up'}
            href="/dashboard/notifications"
            accent="amber"
            status={unreadNotifications.length > 0 ? 'warn' : 'ok'}
          />
        </div>
      </section>

      {/* ── Section 2: Performance KPIs (replaces Recent Broadcasts) ── */}
      <section className="mt-10">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-[22px] font-semibold tracking-tight text-clay-ink leading-none">
              Performance
            </h2>
            <p className="mt-1.5 text-[12.5px] text-clay-ink-muted">
              Key metrics across every app in your account
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            {/* Time range radio dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <ClayButton
                  variant="pill"
                  size="md"
                  trailing={<LuChevronDown className="h-3 w-3 opacity-60" />}
                >
                  {TIME_RANGE_LABELS[timeRange]}
                </ClayButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Time range</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuRadioGroup
                  value={timeRange}
                  onValueChange={(v) => setTimeRange(v as TimeRange)}
                >
                  <DropdownMenuRadioItem value="24h">
                    Last 24 hours
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="7d">
                    Last 7 days
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="30d">
                    Last 30 days
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="all">
                    All time
                  </DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onSelect={() => router.push('/dashboard/analytics')}
                >
                  <LuArrowUpRight className="mr-2 h-4 w-4" /> Open analytics
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <ClayButton
              variant="pill"
              size="md"
              leading={<LuDownload className="h-3.5 w-3.5" strokeWidth={2} />}
              onClick={handleExport}
            >
              Export
            </ClayButton>
          </div>
        </div>

        {/* 4-col × 3-row KPI grid — 12 stats pulled from every module */}
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          <KpiStatCard
            label="Messages 24h"
            value={compact(velocity.messagesLast24h)}
            hint={`${compact(stats.totalMessages)} all time`}
            delta={derived?.messagesTrend.delta}
            up={derived?.messagesTrend.up}
            icon={<LuSend className="h-4 w-4" strokeWidth={2} />}
            accent="green"
          />
          <KpiStatCard
            label="Delivery rate"
            value={`${derived?.deliveryRate ?? 0}%`}
            hint={`${compact(stats.totalDelivered)} / ${compact(stats.totalSent)}`}
            icon={<LuCheckCheck className="h-4 w-4" strokeWidth={2} />}
            accent="teal"
          />
          <KpiStatCard
            label="Pipeline value"
            value={curr(stats.pipelineValue, currency)}
            hint={`${stats.totalDeals} open deals`}
            icon={<LuBriefcase className="h-4 w-4" strokeWidth={2} />}
            accent="orange"
          />
          <KpiStatCard
            label="Deals won"
            value={compact(stats.dealsWon)}
            hint={`${derived?.dealsWonRate ?? 0}% win rate`}
            icon={<LuTrendingUp className="h-4 w-4" strokeWidth={2} />}
            accent="amber"
          />

          <KpiStatCard
            label="New leads"
            value={compact(velocity.leadsLast7d)}
            hint={`${compact(stats.totalLeads)} total`}
            icon={<LuUsers className="h-4 w-4" strokeWidth={2} />}
            accent="violet"
          />
          <KpiStatCard
            label="Contacts"
            value={compact(stats.totalContacts)}
            hint={`+${velocity.contactsLast7d} this week`}
            icon={<LuMessageSquare className="h-4 w-4" strokeWidth={2} />}
            accent="blue"
          />
          <KpiStatCard
            label="Active flows"
            value={`${stats.activeFlows}/${stats.totalFlows}`}
            hint={`${compact(stats.totalFlowExecutions)} executions`}
            icon={<LuWorkflow className="h-4 w-4" strokeWidth={2} />}
            accent="indigo"
          />
          <KpiStatCard
            label="SabChat sessions"
            value={compact(stats.totalSabChatSessions)}
            hint="AI chatbot"
            icon={<LuBot className="h-4 w-4" strokeWidth={2} />}
            accent="pink"
          />

          <KpiStatCard
            label="SMS delivered"
            value={`${derived?.smsDeliveryRate ?? 0}%`}
            hint={`${compact(stats.totalSmsSent)} sent`}
            icon={<LuSmartphone className="h-4 w-4" strokeWidth={2} />}
            accent="lime"
          />
          <KpiStatCard
            label="Email campaigns"
            value={compact(stats.totalEmailCampaigns)}
            hint={`${compact(stats.totalEmailContacts)} contacts`}
            icon={<LuMail className="h-4 w-4" strokeWidth={2} />}
            accent="blue"
          />
          <KpiStatCard
            label="SEO audits"
            value={compact(stats.totalSeoAudits)}
            hint={`${stats.totalSeoProjects} site${stats.totalSeoProjects !== 1 ? 's' : ''}`}
            icon={<LuGlobe className="h-4 w-4" strokeWidth={2} />}
            accent="teal"
          />
          <KpiStatCard
            label="Activity 7d"
            value={compact(stats.totalActivityLogs7d)}
            hint={`${stats.totalProjects} project${stats.totalProjects !== 1 ? 's' : ''}`}
            icon={<LuSparkles className="h-4 w-4" strokeWidth={2} />}
            accent="rose"
          />
        </div>
      </section>

      {/* ── Section 3: Plan + Activity + Quick Modules ── */}
      <section className="mt-10 grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Plan & Credits */}
        <ClayCard padded={false} className="p-5">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-clay-ink-muted">
                Current Plan
              </div>
              <div className="mt-1.5 text-[18px] font-semibold text-clay-ink leading-tight">
                {stats.planName || 'Free plan'}
              </div>
              <div className="mt-1 text-[11.5px] text-clay-ink-muted leading-tight">
                {compact(stats.credits)} credits ·{' '}
                {stats.totalProjects} project
                {stats.totalProjects !== 1 ? 's' : ''}
              </div>
            </div>
            <button
              type="button"
              aria-label="Manage billing"
              onClick={() => router.push('/dashboard/billing')}
              className="flex h-7 w-7 items-center justify-center rounded-md text-clay-ink-muted hover:bg-clay-bg-2 hover:text-clay-ink transition-colors"
            >
              <LuArrowRight className="h-3.5 w-3.5" strokeWidth={2} />
            </button>
          </div>
          <ClayAvatarStack
            className="mt-4"
            size="sm"
            max={4}
            overflowTone="rose"
            items={projectAvatars}
          />
          <div className="mt-4 flex items-center gap-2">
            <ClayButton
              variant="obsidian"
              size="sm"
              onClick={() => router.push('/dashboard/billing')}
              className="flex-1 justify-center"
            >
              Manage billing
            </ClayButton>
            <ClayButton
              variant="pill"
              size="sm"
              onClick={() => router.push('/dashboard/profile')}
              className="flex-1 justify-center"
            >
              Profile
            </ClayButton>
          </div>
        </ClayCard>

        {/* Quick Modules */}
        <div>
          <div className="flex items-center justify-between pb-3">
            <h3 className="text-[15px] font-semibold text-clay-ink">
              Quick Modules
            </h3>
            <ClayButton
              variant="pill"
              size="sm"
              leading={<LuPlus className="h-3 w-3" strokeWidth={2.25} />}
              onClick={() => router.push('/dashboard/integrations')}
            >
              Add app
            </ClayButton>
          </div>
          <ClaySectionList items={moduleRows} />
        </div>

        {/* Recent activity */}
        <ClayCard padded={false} className="p-5">
          <div className="flex items-center justify-between">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-clay-ink-muted">
              Recent Activity
            </div>
            {recentActivity.length > 0 ? (
              <span className="text-[10.5px] text-clay-ink-fade">
                {recentActivity.length} events
              </span>
            ) : null}
          </div>
          {recentActivity.length === 0 ? (
            <div className="mt-4 flex flex-col items-center gap-2 py-4 text-center">
              <LuSparkles
                className="h-5 w-5 text-clay-ink-fade"
                strokeWidth={1.75}
              />
              <div className="text-[12px] text-clay-ink-muted">
                No activity yet
              </div>
            </div>
          ) : (
            <ul className="mt-3 space-y-3">
              {recentActivity.slice(0, 5).map((a) => (
                <li key={a._id} className="flex gap-2.5 text-[12px]">
                  <span className="mt-[6px] h-1.5 w-1.5 shrink-0 rounded-full bg-clay-rose" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-clay-ink leading-tight">
                      <span className="font-semibold">{a.userName}</span>{' '}
                      <span className="text-clay-ink-muted">
                        {a.action.replace(/_/g, ' ').toLowerCase()}
                      </span>
                    </div>
                    <div className="mt-0.5 text-[10.5px] text-clay-ink-fade">
                      {formatDistanceToNow(new Date(a.createdAt), {
                        addSuffix: true,
                      })}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </ClayCard>
      </section>

      {/* bottom spacer */}
      <div className="h-6" />
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   Helper components — kept local to /home because they're not yet
   shared across routes. Promote to src/components/clay/ if reused.
   ════════════════════════════════════════════════════════════════ */

/** Big reference-style card used for the two top KPIs (WhatsApp + CRM). */
function BigStatCard({
  title,
  subtitle,
  metaLeft,
  metaRight,
  statusDot,
  statusLabel,
  avatars,
  ctaLabel,
  onCtaClick,
}: {
  title: string;
  subtitle: string;
  metaLeft: React.ReactNode;
  metaRight: React.ReactNode;
  statusDot: string;
  statusLabel: string;
  avatars: ClayAvatarStackItem[];
  ctaLabel: string;
  onCtaClick: () => void;
}) {
  return (
    <ClayCard
      variant="default"
      padded={false}
      className="rounded-[14px] p-4 min-w-[260px]"
    >
      {/* meta row */}
      <div className="flex items-center gap-2.5 text-[11px] text-clay-ink-muted whitespace-nowrap">
        <span className="inline-flex items-center gap-1">{metaLeft}</span>
        <span className="text-clay-ink-fade">·</span>
        <span className="inline-flex items-center gap-1">{metaRight}</span>
        <span className="text-clay-ink-fade">·</span>
        <span className="inline-flex items-center gap-1 text-clay-ink-muted">
          <span className={cn('h-1.5 w-1.5 rounded-full', statusDot)} />
          {statusLabel}
        </span>
      </div>

      {/* title */}
      <div className="mt-2.5">
        <h3 className="text-[18px] font-semibold tracking-[-0.01em] text-clay-ink leading-[1.1]">
          {title}
        </h3>
        <p className="mt-0.5 text-[12px] text-clay-ink-muted leading-tight">
          {subtitle}
        </p>
      </div>

      {/* footer — avatars + CTA */}
      <div className="mt-3.5 flex items-center justify-between gap-3">
        <ClayAvatarStack
          items={avatars}
          max={4}
          size="md"
          overflowTone="rose"
        />
        <ClayButton
          variant="obsidian"
          size="sm"
          onClick={onCtaClick}
          trailing={<span aria-hidden className="ml-0.5">→</span>}
        >
          {ctaLabel}
        </ClayButton>
      </div>
    </ClayCard>
  );
}

/**
 * KpiStatCard — medium-sized KPI tile used on the /home Performance grid.
 * Larger than ClayModuleTile (more breathing room, larger number, optional
 * trend badge) but shares the same visual language.
 */
type KpiAccent =
  | 'rose'
  | 'green'
  | 'teal'
  | 'violet'
  | 'blue'
  | 'orange'
  | 'amber'
  | 'pink'
  | 'indigo'
  | 'lime'
  | 'slate';

const kpiAccentClass: Record<KpiAccent, string> = {
  rose:   'bg-clay-rose-soft text-clay-rose-ink',
  green:  'bg-[#DCFCE7] text-[#166534]',
  teal:   'bg-[#CCFBF1] text-[#115E59]',
  violet: 'bg-[#EEE8FF] text-[#5B21B6]',
  blue:   'bg-[#DBEAFE] text-[#1E40AF]',
  orange: 'bg-[#FFEDD5] text-[#9A3412]',
  amber:  'bg-[#FEF3C7] text-[#92400E]',
  pink:   'bg-[#FCE7F3] text-[#9D174D]',
  indigo: 'bg-[#E0E7FF] text-[#3730A3]',
  lime:   'bg-[#ECFCCB] text-[#3F6212]',
  slate:  'bg-[#F1F5F9] text-[#334155]',
};

function KpiStatCard({
  label,
  value,
  hint,
  delta,
  up,
  icon,
  accent = 'rose',
}: {
  label: string;
  value: string;
  hint?: string;
  delta?: number;
  up?: boolean;
  icon?: React.ReactNode;
  accent?: KpiAccent;
}) {
  return (
    <div className="rounded-[14px] border border-clay-border bg-clay-surface p-4 transition-[border-color,box-shadow] hover:border-clay-border-strong hover:shadow-clay-card">
      <div className="flex items-start justify-between">
        {icon ? (
          <span
            className={cn(
              'flex h-8 w-8 items-center justify-center rounded-[10px]',
              kpiAccentClass[accent],
            )}
          >
            <span className="flex h-4 w-4 items-center justify-center">
              {icon}
            </span>
          </span>
        ) : (
          <span className="h-8 w-8" />
        )}
        {delta !== undefined ? (
          <span
            className={cn(
              'inline-flex items-center gap-0.5 rounded-full px-2 py-1 text-[10px] font-semibold leading-none',
              up
                ? 'bg-clay-green-soft text-clay-green'
                : 'bg-clay-red-soft text-clay-red',
            )}
          >
            {up ? (
              <LuTrendingUp className="h-2.5 w-2.5" strokeWidth={2.5} />
            ) : (
              <LuTrendingDown className="h-2.5 w-2.5" strokeWidth={2.5} />
            )}
            {Math.abs(delta)}%
          </span>
        ) : null}
      </div>
      <div className="mt-3.5 text-[11.5px] font-medium text-clay-ink-muted leading-none">
        {label}
      </div>
      <div className="mt-1.5 text-[22px] font-semibold tracking-[-0.01em] text-clay-ink leading-none">
        {value}
      </div>
      {hint ? (
        <div className="mt-1 text-[11px] text-clay-ink-muted leading-tight truncate">
          {hint}
        </div>
      ) : null}
    </div>
  );
}
