"use client";

import {
  ZoruBadge,
  ZoruBreadcrumb,
  ZoruBreadcrumbItem,
  ZoruBreadcrumbLink,
  ZoruBreadcrumbList,
  ZoruBreadcrumbPage,
  ZoruBreadcrumbSeparator,
  ZoruButton,
  ZoruCard,
  ZoruCardContent,
  ZoruCardDescription,
  ZoruCardHeader,
  ZoruCardTitle,
  ZoruPopover,
  ZoruPopoverContent,
  ZoruPopoverTrigger,
  ZoruSkeleton,
  ZoruTooltip,
  ZoruTooltipContent,
  ZoruTooltipProvider,
  ZoruTooltipTrigger,
  cn,
} from '@/components/zoruui';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  Circle,
  ListChecks,
  MessageSquarePlus,
  Megaphone,
  Phone,
  PlusCircle,
  QrCode,
  Send,
  ShieldAlert,
  Smartphone,
  TimerReset,
  Users,
  Zap,
  } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

/**
 * Overview (Phase 1) — client surface for `/sabwa`.
 *
 * The server component (`page.tsx`) pre-fetches everything that's safe to
 * fetch with what we know server-side (sessions, plan limits). Everything
 * that depends on which session the user has *selected* in the
 * SessionSwitcher (analytics, scheduled queue, audit feed) is the
 * client's job — it knows the active sessionId via `useSabwaSession()` and
 * subscribes to live status changes through `useSabwaStream`.
 *
 * Rebuilt on ZoruUI primitives. The session-switcher popover, KPI grid,
 * ban-risk gauge, quick actions and plan-usage rows now use Zoru tokens
 * (`text-zoru-ink`, `bg-zoru-surface`, `text-zoru-success`, etc.) and
 * the neutral `--zoru-radius` / `--zoru-radius-lg` design language.
 *
 * Source of truth: SABWA_PLAN.md § 6 page 1.
 */

import * as React from "react";
import Link from "next/link";

import {
  getAnalytics,
  getSessionStatus,
  listAuditEntries,
  listScheduled,
  type SabwaAnalyticsPayload,
  type SabwaAuditEntryRow,
  type SabwaSessionStatusInfo,
} from "@/app/actions/sabwa.actions";
import type {
  SabwaScheduled,
  SabwaSessionStatus,
} from "@/lib/sabwa/types";
import { useSabwaStream } from "@/lib/sabwa/use-sabwa-stream";
import type { SabwaPlanLimits } from "@/lib/sabwa/plan-limits";

import { StatusBadge } from "./status-badge";

// ─── Types passed from the server shell ────────────────────────────────────

export interface OverviewSessionSummary {
  sessionId: string;
  projectId: string;
  phoneE164?: string;
  pushName?: string;
  profilePicUrl?: string;
  label?: string;
  status: SabwaSessionStatus;
  rateLimitProfile?: string;
  warmupEnabled?: boolean;
  hasTemplates?: boolean;
  hasAutoReply?: boolean;
  hasSentScheduled?: boolean;
}

export interface OverviewBootstrap {
  projectId: string | null;
  /** All paired sessions for the project (may be empty). */
  sessions: OverviewSessionSummary[];
  /** The session whose KPIs we render on first paint. */
  initialSessionId: string | null;
  /** Plan caps for the usage card. */
  planLimits: SabwaPlanLimits;
  planName: string;
}

interface AsyncShape<T> {
  data: T | null;
  loading: boolean;
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function formatQuota(value: number | "unlimited" | "custom"): string {
  if (value === "unlimited") return "Unlimited";
  if (value === "custom") return "Custom";
  return value.toLocaleString();
}

function quotaToNumber(value: number | "unlimited" | "custom"): number | null {
  if (typeof value === "number") return value;
  return null;
}

function maskedPhone(phoneE164?: string): string {
  if (!phoneE164) return "—";
  // Show first 3 + last 2 digits, mask middle.
  const trimmed = phoneE164.replace(/\s+/g, "");
  if (trimmed.length <= 5) return trimmed;
  return `${trimmed.slice(0, 3)} •••• ${trimmed.slice(-2)}`;
}

function safeDate(value: string | Date | undefined | null): Date | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isFinite(d.getTime()) ? d : null;
}

function bandFromScore(score: number): {
  label: string;
  tone: "healthy" | "caution" | "elevated" | "critical";
  className: string;
} {
  if (score < 25)
    return {
      label: "Healthy",
      tone: "healthy",
      className: "text-zoru-success",
    };
  if (score < 50)
    return {
      label: "Caution",
      tone: "caution",
      className: "text-zoru-warning",
    };
  if (score < 75)
    return {
      label: "Elevated",
      tone: "elevated",
      className: "text-zoru-warning",
    };
  return {
    label: "Critical",
    tone: "critical",
    className: "text-zoru-danger",
  };
}

// ─── Breadcrumb ────────────────────────────────────────────────────────────

function OverviewBreadcrumb() {
  return (
    <ZoruBreadcrumb>
      <ZoruBreadcrumbList>
        <ZoruBreadcrumbItem>
          <ZoruBreadcrumbLink href="/dashboard">SabNode</ZoruBreadcrumbLink>
        </ZoruBreadcrumbItem>
        <ZoruBreadcrumbSeparator />
        <ZoruBreadcrumbItem>
          <ZoruBreadcrumbLink href="/sabwa">SabWa</ZoruBreadcrumbLink>
        </ZoruBreadcrumbItem>
        <ZoruBreadcrumbSeparator />
        <ZoruBreadcrumbItem>
          <ZoruBreadcrumbPage>Overview</ZoruBreadcrumbPage>
        </ZoruBreadcrumbItem>
      </ZoruBreadcrumbList>
    </ZoruBreadcrumb>
  );
}

// ─── Disconnected hero (no sessions at all) ────────────────────────────────

function DisconnectedHero() {
  return (
    <ZoruCard className="overflow-hidden border-zoru-line bg-zoru-surface">
      <ZoruCardContent className="flex flex-col gap-6 p-6 md:flex-row md:items-center md:gap-8 md:p-8">
        <div
          aria-hidden
          className="flex h-20 w-20 flex-none items-center justify-center rounded-[var(--zoru-radius-lg)] border border-zoru-line bg-zoru-bg text-zoru-ink"
        >
          <QrCode className="h-10 w-10" />
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <h1 className="text-xl font-semibold tracking-tight text-zoru-ink md:text-2xl">
            Connect your personal WhatsApp in 30 seconds
          </h1>
          <p className="text-sm text-zoru-ink-muted">
            Scan a QR with the WhatsApp app on your phone and SabNode will
            mirror your chats, groups and broadcasts here. By connecting, you
            agree to follow WhatsApp&apos;s terms of service — unsolicited bulk
            messaging is the leading cause of account bans, so SabWa
            ships with anti-ban defaults you can tune later.
          </p>
        </div>
        <div className="flex flex-col gap-2 md:flex-none">
          <ZoruButton asChild size="lg" className="gap-2">
            <Link href="/sabwa/connect">
              <QrCode className="h-4 w-4" />
              Connect WhatsApp
            </Link>
          </ZoruButton>
          <ZoruButton asChild variant="outline" size="sm">
            <Link href="/sabwa/settings/rate-limits">Read ban-risk guide</Link>
          </ZoruButton>
        </div>
      </ZoruCardContent>
    </ZoruCard>
  );
}

// ─── Active session header card ────────────────────────────────────────────

function SessionHeaderCard({
  active,
  sessions,
  liveStatus,
  onSwitch,
}: {
  active: OverviewSessionSummary;
  sessions: OverviewSessionSummary[];
  liveStatus: SabwaSessionStatus | "pairing" | "syncing" | "ready" | null;
  onSwitch: (sessionId: string) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const displayStatus = liveStatus ?? active.status;

  const initials = (active.pushName ?? active.label ?? "?")
    .split(/\s+/)
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <ZoruCard>
      <ZoruCardContent className="flex flex-col gap-4 p-4 md:flex-row md:items-center md:gap-6 md:p-6">
        <div className="flex min-w-0 flex-1 items-center gap-4">
          <div
            aria-hidden
            className="relative h-14 w-14 flex-none overflow-hidden rounded-full bg-zoru-surface-2 text-zoru-ink"
          >
            {active.profilePicUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={active.profilePicUrl}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="flex h-full w-full items-center justify-center text-base font-semibold">
                {initials || <Smartphone className="h-6 w-6" />}
              </span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-lg font-semibold tracking-tight text-zoru-ink md:text-xl">
                {active.pushName || active.label || "Linked WhatsApp"}
              </h1>
              <StatusBadge status={displayStatus} size="sm" />
            </div>
            <p className="mt-0.5 truncate text-sm text-zoru-ink-muted">
              {active.phoneE164 ?? maskedPhone(active.phoneE164)}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ZoruPopover open={open} onOpenChange={setOpen}>
            <ZoruPopoverTrigger asChild>
              <ZoruButton
                variant="outline"
                size="sm"
                disabled={sessions.length < 2}
                className="gap-2"
              >
                <Smartphone className="h-4 w-4" />
                Switch session
              </ZoruButton>
            </ZoruPopoverTrigger>
            <ZoruPopoverContent align="end" className="w-72 p-2">
              <p className="px-2 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-wider text-zoru-ink-muted">
                Paired sessions
              </p>
              <ul className="flex flex-col gap-0.5">
                {sessions.map((s) => {
                  const isActive = s.sessionId === active.sessionId;
                  return (
                    <li key={s.sessionId}>
                      <button
                        type="button"
                        onClick={() => {
                          onSwitch(s.sessionId);
                          setOpen(false);
                        }}
                        className={cn(
                          "flex w-full items-center justify-between gap-2 rounded-[var(--zoru-radius)] px-2 py-2 text-left text-sm text-zoru-ink hover:bg-zoru-surface-2",
                          isActive && "bg-zoru-surface-2",
                        )}
                      >
                        <span className="flex min-w-0 flex-col leading-tight">
                          <span className="truncate text-xs font-medium text-zoru-ink">
                            {s.pushName || s.label || "Linked WhatsApp"}
                          </span>
                          <span className="truncate text-[11px] text-zoru-ink-muted">
                            {s.phoneE164 ?? maskedPhone(s.phoneE164)}
                          </span>
                        </span>
                        <StatusBadge status={s.status} size="sm" />
                      </button>
                    </li>
                  );
                })}
              </ul>
              <div className="my-2 h-px bg-zoru-line" aria-hidden />
              <ZoruButton
                asChild
                variant="ghost"
                size="sm"
                className="w-full justify-start gap-2"
              >
                <Link href="/sabwa/connect">
                  <PlusCircle className="h-4 w-4" />
                  <span className="text-sm">Connect another number</span>
                </Link>
              </ZoruButton>
            </ZoruPopoverContent>
          </ZoruPopover>
          <ZoruButton asChild variant="ghost" size="sm" className="gap-2">
            <Link href="/sabwa/devices">
              Manage devices
              <ArrowRight className="h-4 w-4" />
            </Link>
          </ZoruButton>
        </div>
      </ZoruCardContent>
    </ZoruCard>
  );
}

// ─── KPI cards ─────────────────────────────────────────────────────────────

function Sparkline({
  series,
  className,
}: {
  series: ReadonlyArray<{ in: number; out: number; date?: string }>;
  className?: string;
}) {
  // Combined in+out series, normalised to a 60×20 viewBox.
  const points = series.length
    ? series.map((d) => d.in + d.out)
    : [0, 0, 0, 0, 0, 0, 0];
  const max = Math.max(1, ...points);
  const step = points.length > 1 ? 60 / (points.length - 1) : 0;
  const path = points
    .map((v, i) => {
      const x = i * step;
      const y = 20 - (v / max) * 18 - 1;
      return `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");

  return (
    <svg
      viewBox="0 0 60 20"
      preserveAspectRatio="none"
      className={cn("h-6 w-20", className)}
      aria-hidden
    >
      <path
        d={path}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function KpiCardShell({
  icon: Icon,
  label,
  href,
  children,
  className,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  href?: string;
  children: React.ReactNode;
  className?: string;
}) {
  const body = (
    <ZoruCard
      className={cn(
        "h-full transition-shadow",
        href && "cursor-pointer hover:shadow-[var(--zoru-shadow-md)]",
        className,
      )}
    >
      <ZoruCardContent className="flex h-full flex-col gap-3 p-4">
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-2 text-xs font-medium text-zoru-ink-muted">
            <Icon className="h-3.5 w-3.5" />
            {label}
          </span>
          {href ? (
            <ArrowRight
              className="h-3.5 w-3.5 text-zoru-ink-muted"
              aria-hidden
            />
          ) : null}
        </div>
        {children}
      </ZoruCardContent>
    </ZoruCard>
  );

  if (href) {
    return (
      <Link
        href={href}
        aria-label={label}
        className="block rounded-[var(--zoru-radius-lg)] focus:outline-none focus-visible:ring-2 focus-visible:ring-zoru-ink focus-visible:ring-offset-2"
      >
        {body}
      </Link>
    );
  }
  return body;
}

function KpiRow({
  analytics,
  scheduled,
  activeGroups,
  loading,
}: {
  analytics: SabwaAnalyticsPayload | null;
  scheduled: { pendingCount: number; nextFireAt: Date | null } | null;
  activeGroups: { total: number; last24h: number } | null;
  loading: boolean;
}) {
  const todayIn = analytics?.kpis.todayIn ?? 0;
  const todayOut = analytics?.kpis.todayOut ?? 0;
  const responseSec = analytics
    ? Math.round(analytics.kpis.medianResponseMs / 1000)
    : 0;

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <KpiCardShell icon={Send} label="Today's messages" href="/sabwa/analytics">
        {loading ? (
          <ZoruSkeleton className="h-8 w-24" />
        ) : (
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-2xl font-semibold tabular-nums leading-none text-zoru-ink">
                {todayOut.toLocaleString()}
                <span className="ml-1 text-sm font-normal text-zoru-ink-muted">
                  out
                </span>
              </p>
              <p className="mt-1 text-xs text-zoru-ink-muted tabular-nums">
                {todayIn.toLocaleString()} in
              </p>
            </div>
            <Sparkline
              series={analytics?.messagesByDay ?? []}
              className="text-zoru-ink"
            />
          </div>
        )}
      </KpiCardShell>

      <KpiCardShell
        icon={CalendarClock}
        label="Scheduled queue"
        href="/sabwa/scheduler/queue"
      >
        {loading ? (
          <ZoruSkeleton className="h-8 w-20" />
        ) : (
          <div>
            <p className="text-2xl font-semibold tabular-nums leading-none text-zoru-ink">
              {scheduled?.pendingCount.toLocaleString() ?? 0}
            </p>
            <p className="mt-1 truncate text-xs text-zoru-ink-muted">
              {scheduled?.nextFireAt
                ? `Next: ${formatDistanceToNow(scheduled.nextFireAt, {
                    addSuffix: true,
                  })}`
                : "Nothing pending"}
            </p>
          </div>
        )}
      </KpiCardShell>

      <KpiCardShell icon={Users} label="Active groups" href="/sabwa/groups">
        {loading ? (
          <ZoruSkeleton className="h-8 w-20" />
        ) : (
          <div>
            <p className="text-2xl font-semibold tabular-nums leading-none text-zoru-ink">
              {(activeGroups?.total ?? 0).toLocaleString()}
            </p>
            <p className="mt-1 text-xs text-zoru-ink-muted tabular-nums">
              {(activeGroups?.last24h ?? 0).toLocaleString()} active in 24h
            </p>
          </div>
        )}
      </KpiCardShell>

      <KpiCardShell
        icon={TimerReset}
        label="Response time"
        href="/sabwa/analytics"
      >
        {loading ? (
          <ZoruSkeleton className="h-8 w-20" />
        ) : (
          <div>
            <p className="text-2xl font-semibold tabular-nums leading-none text-zoru-ink">
              {responseSec ? `${responseSec}s` : "—"}
            </p>
            <p className="mt-1 text-xs text-zoru-ink-muted">
              Median, last 7 days
            </p>
          </div>
        )}
      </KpiCardShell>
    </div>
  );
}

// ─── Ban-risk gauge ────────────────────────────────────────────────────────

function BanRiskGauge({
  score,
  reasons,
  loading,
}: {
  score: number;
  reasons: string[];
  loading: boolean;
}) {
  const clamped = Math.max(0, Math.min(100, Math.round(score)));
  const band = bandFromScore(clamped);

  // Semicircular gauge — half-circle path with stroke-dasharray.
  // Arc length ~157 for r=50 → πr.
  const r = 50;
  const circumference = Math.PI * r;
  const fraction = clamped / 100;
  const dashOffset = circumference * (1 - fraction);

  return (
    <ZoruCard>
      <ZoruCardHeader className="pb-2">
        <div className="flex flex-wrap items-center gap-2">
          <ZoruCardTitle className="text-base font-semibold">
            Ban-risk score
          </ZoruCardTitle>
          <ZoruBadge variant="outline" className={cn("text-[10px]", band.className)}>
            <ShieldAlert className="mr-1 h-3 w-3" />
            {band.label}
          </ZoruBadge>
        </div>
        <ZoruCardDescription>
          Computed from velocity, delivery failures, and recipient signals.
        </ZoruCardDescription>
      </ZoruCardHeader>
      <ZoruCardContent>
        <div className="grid grid-cols-1 items-center gap-4 sm:grid-cols-[auto_1fr]">
          {loading ? (
            <ZoruSkeleton className="h-[80px] w-[160px]" />
          ) : (
            <div className="relative h-[80px] w-[160px]" aria-hidden>
              <svg viewBox="0 0 120 70" className="h-full w-full">
                {/* Track */}
                <path
                  d="M10,60 A50,50 0 0 1 110,60"
                  fill="none"
                  stroke="currentColor"
                  strokeOpacity={0.12}
                  strokeWidth={10}
                  strokeLinecap="round"
                />
                {/* Filled arc */}
                <path
                  d="M10,60 A50,50 0 0 1 110,60"
                  fill="none"
                  className={band.className}
                  stroke="currentColor"
                  strokeWidth={10}
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  strokeDashoffset={dashOffset}
                />
              </svg>
              <div className="absolute inset-x-0 bottom-1 flex flex-col items-center">
                <span
                  className={cn(
                    "text-2xl font-semibold tabular-nums leading-none",
                    band.className,
                  )}
                >
                  {clamped}
                </span>
                <span className="text-[10px] uppercase tracking-wider text-zoru-ink-muted">
                  / 100
                </span>
              </div>
            </div>
          )}
          <div className="min-w-0 space-y-2">
            <p className="text-xs font-medium uppercase tracking-wider text-zoru-ink-muted">
              Top risk reasons
            </p>
            {loading ? (
              <div className="space-y-1.5">
                <ZoruSkeleton className="h-3 w-3/4" />
                <ZoruSkeleton className="h-3 w-2/3" />
                <ZoruSkeleton className="h-3 w-1/2" />
              </div>
            ) : reasons.length === 0 ? (
              <p className="text-sm text-zoru-ink-muted">
                No risk signals in the last 24 hours.
              </p>
            ) : (
              <ul className="space-y-1 text-sm">
                {reasons.slice(0, 3).map((r) => (
                  <li
                    key={r}
                    className="flex items-start gap-2 text-zoru-ink-muted"
                  >
                    <Circle
                      className="mt-1.5 h-1.5 w-1.5 flex-none fill-current"
                      aria-hidden
                    />
                    <span>{r}</span>
                  </li>
                ))}
              </ul>
            )}
            <ZoruButton asChild variant="link" size="sm" className="h-auto px-0">
              <Link href="/sabwa/settings/rate-limits">Review settings</Link>
            </ZoruButton>
          </div>
        </div>
      </ZoruCardContent>
    </ZoruCard>
  );
}

// ─── Quick actions ─────────────────────────────────────────────────────────

function QuickActions({
  onSchedule,
}: {
  onSchedule: () => void;
}) {
  const items: Array<{
    label: string;
    href?: string;
    onClick?: () => void;
    icon: React.ComponentType<{ className?: string }>;
  }> = [
    { label: "New chat", href: "/sabwa/inbox", icon: MessageSquarePlus },
    { label: "Schedule message", onClick: onSchedule, icon: CalendarClock },
    { label: "Send broadcast", href: "/sabwa/broadcasts", icon: Megaphone },
    { label: "Start bulk campaign", href: "/sabwa/bulk", icon: Zap },
    { label: "Connect another number", href: "/sabwa/connect", icon: PlusCircle },
  ];

  return (
    <ZoruCard>
      <ZoruCardHeader className="pb-2">
        <ZoruCardTitle className="text-base font-semibold">Quick actions</ZoruCardTitle>
        <ZoruCardDescription>
          The five things you&apos;ll do most often, one tap away.
        </ZoruCardDescription>
      </ZoruCardHeader>
      <ZoruCardContent>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {items.map(({ label, href, onClick, icon: Icon }) => {
            const inner = (
              <>
                <Icon className="h-5 w-5" />
                <span className="text-xs font-medium leading-tight">
                  {label}
                </span>
              </>
            );
            const className =
              "flex h-auto flex-col items-center justify-center gap-2 rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-bg p-3 text-center text-zoru-ink transition-colors hover:border-zoru-line-strong hover:bg-zoru-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zoru-ink focus-visible:ring-offset-2";
            if (href) {
              return (
                <Link key={label} href={href} className={className}>
                  {inner}
                </Link>
              );
            }
            return (
              <button
                key={label}
                type="button"
                onClick={onClick}
                className={className}
              >
                {inner}
              </button>
            );
          })}
        </div>
      </ZoruCardContent>
    </ZoruCard>
  );
}

// ─── Recent activity feed ──────────────────────────────────────────────────

function targetHrefForAction(action: string): string {
  if (action.startsWith("session.")) return "/sabwa/devices";
  if (action.startsWith("scheduled.")) return "/sabwa/scheduler/queue";
  if (action.startsWith("broadcast.")) return "/sabwa/broadcasts";
  if (action.startsWith("template.")) return "/sabwa/templates";
  if (action.startsWith("auto_reply.")) return "/sabwa/auto-reply";
  if (action.startsWith("contact.")) return "/sabwa/contacts";
  if (action.startsWith("group.")) return "/sabwa/groups";
  if (action.startsWith("message.")) return "/sabwa/inbox";
  return "/sabwa/audit";
}

function RecentActivity({
  entries,
  loading,
}: {
  entries: SabwaAuditEntryRow[];
  loading: boolean;
}) {
  return (
    <ZoruCard>
      <ZoruCardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
        <div>
          <ZoruCardTitle className="text-base font-semibold">
            Recent activity
          </ZoruCardTitle>
          <ZoruCardDescription>
            Latest 10 events touching this session.
          </ZoruCardDescription>
        </div>
        <ZoruButton asChild variant="ghost" size="sm" className="gap-1">
          <Link href="/sabwa/audit">
            See all
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </ZoruButton>
      </ZoruCardHeader>
      <ZoruCardContent>
        {loading ? (
          <ul className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <li key={i} className="flex items-center gap-3">
                <ZoruSkeleton className="h-2 w-2 rounded-full" />
                <ZoruSkeleton className="h-3 flex-1" />
                <ZoruSkeleton className="h-3 w-16" />
              </li>
            ))}
          </ul>
        ) : entries.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <Activity
              className="h-8 w-8 text-zoru-ink-muted"
              aria-hidden
            />
            <p className="text-sm font-medium text-zoru-ink">No activity yet</p>
            <p className="text-xs text-zoru-ink-muted">
              Send a message or schedule something — it&apos;ll show up here.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-zoru-line">
            {entries.slice(0, 10).map((e) => {
              const id = e.id ?? `${e.action}-${String(e.ts)}`;
              const when = safeDate(e.ts);
              const actor = e.actorEmail ?? "Someone";
              const href = targetHrefForAction(e.action);
              return (
                <li key={id}>
                  <Link
                    href={href}
                    className="-mx-2 flex items-center gap-3 rounded-[var(--zoru-radius)] px-2 py-2 text-sm text-zoru-ink hover:bg-zoru-surface-2"
                  >
                    <span
                      aria-hidden
                      className="h-2 w-2 flex-none rounded-full bg-zoru-ink"
                    />
                    <span className="min-w-0 flex-1 truncate">
                      <span className="font-medium">{actor}</span>{" "}
                      <span className="text-zoru-ink-muted">{e.action}</span>
                      {e.target ? (
                        <span className="text-zoru-ink-muted">
                          {" "}
                          · {e.target}
                        </span>
                      ) : null}
                    </span>
                    <time
                      dateTime={when?.toISOString() ?? ""}
                      className="flex-none text-xs text-zoru-ink-muted tabular-nums"
                    >
                      {when
                        ? formatDistanceToNow(when, { addSuffix: true })
                        : ""}
                    </time>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </ZoruCardContent>
    </ZoruCard>
  );
}

// ─── Onboarding checklist ──────────────────────────────────────────────────

interface ChecklistItem {
  label: string;
  done: boolean;
  href: string;
}

function OnboardingChecklist({ items }: { items: ChecklistItem[] }) {
  const allDone = items.every((i) => i.done);
  if (allDone) return null;
  const completed = items.filter((i) => i.done).length;

  return (
    <ZoruCard>
      <ZoruCardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <div>
            <ZoruCardTitle className="text-base font-semibold">
              Get the most out of SabWa
            </ZoruCardTitle>
            <ZoruCardDescription>
              {completed} of {items.length} steps complete.
            </ZoruCardDescription>
          </div>
          <ListChecks className="h-5 w-5 text-zoru-ink-muted" aria-hidden />
        </div>
      </ZoruCardHeader>
      <ZoruCardContent>
        <ul className="space-y-1">
          {items.map(({ label, done, href }) => (
            <li key={label}>
              <Link
                href={href}
                className={cn(
                  "-mx-2 flex items-center gap-2 rounded-[var(--zoru-radius)] px-2 py-1.5 text-sm text-zoru-ink hover:bg-zoru-surface-2",
                  done && "text-zoru-ink-muted",
                )}
              >
                {done ? (
                  <CheckCircle2
                    className="h-4 w-4 flex-none text-zoru-success"
                    aria-hidden
                  />
                ) : (
                  <Circle
                    className="h-4 w-4 flex-none text-zoru-ink-muted"
                    aria-hidden
                  />
                )}
                <span className={cn(done && "line-through")}>{label}</span>
              </Link>
            </li>
          ))}
        </ul>
      </ZoruCardContent>
    </ZoruCard>
  );
}

// ─── Plan usage card ───────────────────────────────────────────────────────

function PlanUsageCard({
  planName,
  limits,
  sessionsUsed,
  todaySends,
  scheduledPending,
}: {
  planName: string;
  limits: SabwaPlanLimits;
  sessionsUsed: number;
  todaySends: number;
  scheduledPending: number;
}) {
  const rows: Array<{
    label: string;
    used: number;
    cap: number | "unlimited" | "custom";
  }> = [
    { label: "Sessions paired", used: sessionsUsed, cap: limits.sessions },
    { label: "Sends today", used: todaySends, cap: limits.dailySend },
    {
      label: "Scheduled pending",
      used: scheduledPending,
      cap: limits.scheduler.maxPending,
    },
  ];

  return (
    <ZoruCard>
      <ZoruCardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <div>
            <ZoruCardTitle className="text-base font-semibold">
              Plan usage
            </ZoruCardTitle>
            <ZoruCardDescription>
              Current period under the{" "}
              <span className="capitalize">{planName || "free"}</span> plan.
            </ZoruCardDescription>
          </div>
          <ZoruButton asChild variant="outline" size="sm">
            <Link href="/dashboard/billing">Upgrade</Link>
          </ZoruButton>
        </div>
      </ZoruCardHeader>
      <ZoruCardContent>
        <ZoruTooltipProvider delayDuration={200}>
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {rows.map(({ label, used, cap }) => {
              const capNum = quotaToNumber(cap);
              const percent =
                capNum && capNum > 0
                  ? Math.min(100, Math.round((used / capNum) * 100))
                  : 0;
              const danger = percent >= 85;
              const warn = percent >= 60 && percent < 85;
              return (
                <li key={label} className="space-y-1.5">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-xs font-medium text-zoru-ink-muted">
                      {label}
                    </span>
                    <ZoruTooltip>
                      <ZoruTooltipTrigger asChild>
                        <span className="text-xs tabular-nums text-zoru-ink">
                          {used.toLocaleString()}{" "}
                          <span className="text-zoru-ink-muted">
                            / {formatQuota(cap)}
                          </span>
                        </span>
                      </ZoruTooltipTrigger>
                      <ZoruTooltipContent side="top">
                        {capNum
                          ? `${percent}% of cap`
                          : "No static cap on your plan"}
                      </ZoruTooltipContent>
                    </ZoruTooltip>
                  </div>
                  <div
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={capNum ?? 0}
                    aria-valuenow={used}
                    className="h-1.5 w-full overflow-hidden rounded-full bg-zoru-surface-2"
                  >
                    {capNum ? (
                      <div
                        className={cn(
                          "h-full rounded-full transition-all",
                          danger
                            ? "bg-zoru-danger"
                            : warn
                              ? "bg-zoru-warning"
                              : "bg-zoru-ink",
                        )}
                        style={{ width: `${percent}%` }}
                      />
                    ) : (
                      <div className="h-full w-full bg-zoru-ink/40" />
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </ZoruTooltipProvider>
      </ZoruCardContent>
    </ZoruCard>
  );
}

// ─── Schedule dialog stub (placeholder until real one is wired) ────────────

function ScheduleDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
}) {
  // The full schedule editor lives at `/sabwa/scheduler` (see SABWA_PLAN.md
  // § 6 page 13). The Overview's "Schedule message" CTA just navigates
  // there for now — once the modal component lands at
  // `/sabwa/scheduler/_components/schedule-dialog` this stub will be
  // swapped for the real one.
  React.useEffect(() => {
    if (!open) return;
    onOpenChange(false);
    if (typeof window !== "undefined") {
      window.location.href = "/sabwa/scheduler";
    }
  }, [open, onOpenChange]);
  return null;
}

// ─── Main client component ─────────────────────────────────────────────────

export function OverviewClient({ bootstrap }: { bootstrap: OverviewBootstrap }) {
  const { sessions, initialSessionId, planLimits, planName } = bootstrap;

  // Hooks must run unconditionally — even when there are no sessions we still
  // declare them so the hook order stays stable across renders.
  const [activeId, setActiveId] = React.useState<string>(
    initialSessionId ?? sessions[0]?.sessionId ?? "",
  );
  const [scheduleOpen, setScheduleOpen] = React.useState(false);

  const active = React.useMemo(
    () => sessions.find((s) => s.sessionId === activeId) ?? sessions[0] ?? null,
    [sessions, activeId],
  );

  // Live status stream for the currently selected session.
  // The stream connection status (`open`/`closed`/...) is wire-level; the
  // *session* status lives on each `lastEvent` of kind `status`. We
  // capture it via a refining cast so the StatusBadge gets a typed value.
  const stream = useSabwaStream(activeId || null, {
    enabled: Boolean(activeId),
  });
  const liveStatus: SabwaSessionStatus | "pairing" | "syncing" | "ready" | null =
    (() => {
      if (stream.lastEvent?.kind !== "status") return null;
      const raw = String(stream.lastEvent.status ?? "");
      const known: ReadonlyArray<
        SabwaSessionStatus | "pairing" | "syncing" | "ready"
      > = [
        "pending",
        "connected",
        "logged_out",
        "banned",
        "error",
        "pairing",
        "syncing",
        "ready",
      ];
      return (known as readonly string[]).includes(raw)
        ? (raw as SabwaSessionStatus | "pairing" | "syncing" | "ready")
        : null;
    })();

  // Async client data — analytics, scheduled queue, audit feed, session status.
  const [analytics, setAnalytics] = React.useState<AsyncShape<SabwaAnalyticsPayload>>(
    { data: null, loading: true },
  );
  const [scheduled, setScheduled] = React.useState<
    AsyncShape<{ pendingCount: number; nextFireAt: Date | null }>
  >({ data: null, loading: true });
  const [audit, setAudit] = React.useState<AsyncShape<SabwaAuditEntryRow[]>>({
    data: null,
    loading: true,
  });
  const [statusInfo, setStatusInfo] = React.useState<AsyncShape<SabwaSessionStatusInfo>>(
    { data: null, loading: true },
  );

  React.useEffect(() => {
    if (!activeId) {
      setAnalytics({ data: null, loading: false });
      setScheduled({ data: null, loading: false });
      setAudit({ data: [], loading: false });
      setStatusInfo({ data: null, loading: false });
      return;
    }
    let cancelled = false;
    setAnalytics({ data: null, loading: true });
    setScheduled({ data: null, loading: true });
    setAudit({ data: null, loading: true });
    setStatusInfo({ data: null, loading: true });

    // Independent fetches — kick off in parallel so the dashboard renders as
    // each card resolves rather than waiting for the slowest.
    void (async () => {
      try {
        const result = await getAnalytics({ sessionId: activeId, range: "7d" });
        if (cancelled) return;
        if (result.ok) {
          setAnalytics({ data: result.analytics, loading: false });
        } else {
          setAnalytics({ data: null, loading: false });
        }
      } catch {
        if (!cancelled) setAnalytics({ data: null, loading: false });
      }
    })();

    void (async () => {
      try {
        const result = await listScheduled({
          sessionId: activeId,
          status: "pending",
          limit: 50,
        });
        if (cancelled) return;
        if (result.ok) {
          const items = (result.items ?? []) as SabwaScheduled[];
          const nextFireAt = items
            .map((s) =>
              s.scheduledFor instanceof Date
                ? s.scheduledFor
                : new Date(s.scheduledFor),
            )
            .filter((d) => Number.isFinite(d.getTime()))
            .sort((a, b) => a.getTime() - b.getTime())[0] ?? null;
          setScheduled({
            data: { pendingCount: items.length, nextFireAt },
            loading: false,
          });
        } else {
          setScheduled({ data: null, loading: false });
        }
      } catch {
        if (!cancelled) setScheduled({ data: null, loading: false });
      }
    })();

    void (async () => {
      try {
        const result = await listAuditEntries({
          sessionId: activeId,
          limit: 10,
        });
        if (cancelled) return;
        if (result.ok) {
          setAudit({
            data: result.entries ?? [],
            loading: false,
          });
        } else {
          setAudit({ data: null, loading: false });
        }
      } catch {
        if (!cancelled) setAudit({ data: [], loading: false });
      }
    })();

    void (async () => {
      try {
        const result = await getSessionStatus(activeId);
        if (cancelled) return;
        if (result.ok) {
          setStatusInfo({ data: result.session, loading: false });
        } else {
          setStatusInfo({ data: null, loading: false });
        }
      } catch {
        if (!cancelled) setStatusInfo({ data: null, loading: false });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeId]);

  // Onboarding checklist — purely client-side derivation.
  const checklist: ChecklistItem[] = React.useMemo(
    () => [
      {
        label: "Connect first WhatsApp account",
        done: sessions.some((s) => s.status === "connected"),
        href: "/sabwa/connect",
      },
      {
        label: "Set a rate-limit profile",
        done: Boolean(active?.rateLimitProfile),
        href: "/sabwa/settings/rate-limits",
      },
      {
        label: "Configure auto-reply for off-hours",
        done: Boolean(active?.hasAutoReply),
        href: "/sabwa/auto-reply",
      },
      {
        label: "Send your first scheduled message",
        done: Boolean(active?.hasSentScheduled),
        href: "/sabwa/scheduler",
      },
      {
        label: "Create your first template",
        done: Boolean(active?.hasTemplates),
        href: "/sabwa/templates",
      },
    ],
    [sessions, active],
  );

  const todaySends = analytics.data?.kpis.todayOut ?? 0;
  const banScore =
    statusInfo.data?.banRiskScore ?? analytics.data?.kpis.banRiskScore ?? 0;
  const banReasons = statusInfo.data?.banRiskReasons ?? [];

  // Empty state — no sessions paired yet. Rendered after hooks so the hook
  // call order stays stable across renders.
  if (sessions.length === 0 || !active) {
    return (
      <div className="mx-auto w-full max-w-[1180px] space-y-6 px-6 pt-6 pb-10">
        <OverviewBreadcrumb />
        <DisconnectedHero />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1180px] space-y-6 px-6 pt-6 pb-10">
      <OverviewBreadcrumb />

      <SessionHeaderCard
        active={active}
        sessions={sessions}
        liveStatus={liveStatus}
        onSwitch={setActiveId}
      />

      <KpiRow
        analytics={analytics.data}
        scheduled={scheduled.data}
        activeGroups={null}
        loading={analytics.loading || scheduled.loading}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <BanRiskGauge
          score={banScore}
          reasons={banReasons}
          loading={statusInfo.loading}
        />
        <QuickActions onSchedule={() => setScheduleOpen(true)} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <RecentActivity entries={audit.data ?? []} loading={audit.loading} />
        </div>
        <OnboardingChecklist items={checklist} />
      </div>

      <PlanUsageCard
        planName={planName}
        limits={planLimits}
        sessionsUsed={sessions.length}
        todaySends={todaySends}
        scheduledPending={scheduled.data?.pendingCount ?? 0}
      />

      <ScheduleDialog open={scheduleOpen} onOpenChange={setScheduleOpen} />

      {/* Hidden marker so unused-import linters don't complain about Phone — */}
      {/* it's reserved for the Calls quick-action when that page lands. */}
      <span className="hidden" aria-hidden>
        <Phone className="h-0 w-0" />
        <AlertTriangle className="h-0 w-0" />
      </span>
    </div>
  );
}

export default OverviewClient;
