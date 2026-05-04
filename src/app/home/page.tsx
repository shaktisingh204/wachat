"use client";

/**
 * /home — SabNode account dashboard, rebuilt in ZoruUI.
 *
 * Same real data as before (getAccountHomeData), no mocks. Pure neutral
 * palette — module tiles, stat cards, and notifications all sit on the
 * zoru surface tokens. No rainbow accents.
 */

import * as React from "react";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { format, formatDistanceToNow } from "date-fns";
import {
  AlarmClock,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Bell,
  Bot,
  Briefcase,
  ChevronDown,
  CircleCheck,
  CircleDashed,
  Download,
  Earth,
  Filter,
  Globe,
  LayoutTemplate,
  Link as LinkIcon,
  Mail,
  Megaphone,
  MessageSquare,
  MoreHorizontal,
  Plus,
  QrCode,
  Rocket,
  Send,
  ShoppingBag,
  Smartphone,
  Sparkles,
  Users,
  Workflow,
} from "lucide-react";

import {
  getAccountHomeData,
  type AccountHomeData,
} from "@/app/actions/home.actions";
import { getSession } from "@/app/actions/user.actions";
import {
  getOnboardingState,
  type OnboardingState,
} from "@/app/actions/onboarding-flow.actions";

import {
  ZoruBreadcrumb,
  ZoruBreadcrumbItem,
  ZoruBreadcrumbLink,
  ZoruBreadcrumbList,
  ZoruBreadcrumbPage,
  ZoruBreadcrumbSeparator,
  ZoruButton,
  ZoruCard,
  ZoruDropdownMenu,
  ZoruDropdownMenuContent,
  ZoruDropdownMenuItem,
  ZoruDropdownMenuLabel,
  ZoruDropdownMenuRadioGroup,
  ZoruDropdownMenuRadioItem,
  ZoruDropdownMenuSeparator,
  ZoruDropdownMenuTrigger,
  ZoruSkeleton,
  cn,
} from "@/components/zoruui";

/* ── helpers ─────────────────────────────────────────────────────── */

function compact(n: number | null | undefined): string {
  const v = typeof n === "number" && Number.isFinite(n) ? n : 0;
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (v >= 1_000) return (v / 1_000).toFixed(1).replace(/\.0$/, "") + "k";
  return v.toString();
}

function curr(n: number | null | undefined, c = "INR"): string {
  const sym = c === "INR" ? "₹" : "$";
  const v = typeof n === "number" && Number.isFinite(n) ? n : 0;
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
  if (h < 5) return "Still up";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  if (h < 21) return "Good evening";
  return "Good night";
}

/* ── skeleton ────────────────────────────────────────────────────── */

function HomeSkeleton() {
  return (
    <div className="mx-auto w-full max-w-[1320px] px-6 pt-6 pb-10">
      <ZoruSkeleton className="h-3 w-52" />
      <div className="mt-5 flex items-center justify-between">
        <ZoruSkeleton className="h-9 w-56" />
        <div className="flex gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <ZoruSkeleton key={i} className="h-9 w-28 rounded-full" />
          ))}
        </div>
      </div>
      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_280px]">
        <ZoruSkeleton className="h-[150px]" />
        <ZoruSkeleton className="h-[150px]" />
        <div className="flex flex-col gap-2">
          <ZoruSkeleton className="h-11" />
          <ZoruSkeleton className="h-11" />
          <ZoruSkeleton className="h-11" />
        </div>
      </div>
      <div className="mt-10">
        <ZoruSkeleton className="h-5 w-32" />
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <ZoruSkeleton key={i} className="h-24" />
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── onboarding banner ───────────────────────────────────────────── */

const ONBOARDING_STEPS = [
  { key: "profile", label: "Tell us about you" },
  { key: "business", label: "Your business details" },
  { key: "requirements", label: "Choose your modules" },
  { key: "plan", label: "Pick a plan" },
] as const;

function OnboardingSetupCard({
  status,
}: {
  status: "profile" | "business" | "requirements" | "plan" | "complete";
}) {
  const router = useRouter();
  const statusOrder = ["profile", "business", "requirements", "plan", "complete"];
  const currentIdx = statusOrder.indexOf(status);
  const completedCount = currentIdx;
  const totalSteps = ONBOARDING_STEPS.length;

  return (
    <div className="mt-6 rounded-[var(--zoru-radius-lg)] border border-zoru-line bg-zoru-bg p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-zoru-surface-2 text-zoru-ink">
            <Rocket className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-[15px] text-zoru-ink">Complete your setup</h3>
            <p className="mt-0.5 text-[13px] text-zoru-ink-muted">
              {completedCount} of {totalSteps} steps done — finish setting up to
              unlock your full workspace.
            </p>
          </div>
        </div>
        <ZoruButton onClick={() => router.push("/onboarding")}>
          Continue setup <ArrowRight />
        </ZoruButton>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {ONBOARDING_STEPS.map((step, idx) => {
          const isDone = idx < currentIdx;
          const isCurrent = idx === currentIdx;
          return (
            <div
              key={step.key}
              className={cn(
                "flex items-center gap-2 rounded-[var(--zoru-radius)] border px-3 py-2 text-[13px]",
                isDone && "border-zoru-line-strong bg-zoru-surface text-zoru-ink",
                isCurrent &&
                  "border-zoru-ink bg-zoru-surface-2 text-zoru-ink",
                !isDone &&
                  !isCurrent &&
                  "border-zoru-line text-zoru-ink-muted",
              )}
            >
              {isDone ? (
                <CircleCheck className="h-4 w-4 shrink-0 text-zoru-ink" />
              ) : (
                <CircleDashed
                  className={cn(
                    "h-4 w-4 shrink-0",
                    isCurrent ? "text-zoru-ink" : "text-zoru-ink-subtle",
                  )}
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

/* ── page ────────────────────────────────────────────────────────── */

type TimeRange = "24h" | "7d" | "30d" | "all";

const TIME_RANGE_LABELS: Record<TimeRange, string> = {
  "24h": "Last 24 hours",
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  all: "All time",
};

export default function HomePage() {
  const router = useRouter();
  const [data, setData] = useState<AccountHomeData | null>(null);
  const [userName, setUserName] = useState<string>("there");
  const [loading, startTransition] = useTransition();
  const [timeRange, setTimeRange] = useState<TimeRange>("7d");
  const [onboardingStatus, setOnboardingStatus] = useState<OnboardingState | null>(null);
  const [onboardingChecked, setOnboardingChecked] = useState(false);

  useEffect(() => {
    document.title = "Home · SabNode";
  }, []);

  const fetchHome = React.useCallback(() => {
    startTransition(() => {
      Promise.all([
        getAccountHomeData(),
        getSession(),
        getOnboardingState(),
      ]).then(([home, session, obState]) => {
        setData(home);
        const u: any = session?.user;
        if (u) setUserName(u.name || u.email?.split("@")[0] || "there");
        setOnboardingStatus(obState.onboarding);
        setOnboardingChecked(true);
      });
    });
  }, []);

  useEffect(() => {
    fetchHome();
  }, [fetchHome]);

  const handleExport = React.useCallback(() => {
    if (!data) return;
    const payload = {
      generatedAt: new Date().toISOString(),
      timeRange,
      userName,
      ...data,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
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

  /* ── notification column content ── */
  type NoteCard = {
    icon: React.ReactNode;
    title: string;
    tone?: "default" | "inverted";
    onClick?: () => void;
  };
  const notificationCards: NoteCard[] = [];

  if (insights[0]) {
    notificationCards.push({
      icon: <Sparkles className="h-3.5 w-3.5" />,
      title: insights[0].length > 48 ? insights[0].slice(0, 48) + "…" : insights[0],
    });
  }
  unreadNotifications.slice(0, 2).forEach((n) => {
    notificationCards.push({
      icon: <Bell className="h-3.5 w-3.5" />,
      title: n.message.length > 48 ? n.message.slice(0, 48) + "…" : n.message,
      onClick: () => router.push("/dashboard/notifications"),
    });
  });
  if (velocity.broadcastsLast7d === 0 && stats.totalCampaigns > 0) {
    notificationCards.push({
      icon: <AlarmClock className="h-3.5 w-3.5" />,
      title: "No broadcasts this week",
      tone: "inverted",
      onClick: () => router.push("/dashboard/broadcasts"),
    });
  } else if (velocity.messagesLast24h > 0) {
    notificationCards.push({
      icon: <AlarmClock className="h-3.5 w-3.5" />,
      title: `${compact(velocity.messagesLast24h)} msgs in 24h`,
      tone: "inverted",
      onClick: () => router.push("/dashboard/analytics"),
    });
  }
  while (notificationCards.length < 3) {
    notificationCards.push({
      icon: <Sparkles className="h-3.5 w-3.5" />,
      title:
        notificationCards.length === 0
          ? "Welcome to SabNode"
          : notificationCards.length === 1
            ? "Create your first broadcast"
            : "Invite your team",
      onClick: () =>
        router.push(
          notificationCards.length === 1
            ? "/dashboard/broadcasts"
            : "/dashboard/team",
        ),
    });
  }

  const moduleRows = [
    {
      key: "contacts",
      title: "Wachat Contacts",
      meta: `${compact(stats.totalContacts)} · +${velocity.contactsLast7d} this week`,
      onClick: () => router.push("/dashboard/wachat/contacts"),
    },
    {
      key: "flows",
      title: "SabFlow Automations",
      meta: `${stats.activeFlows} active · ${stats.totalFlows} total`,
      onClick: () => router.push("/dashboard/sabflow"),
    },
    {
      key: "sabchat",
      title: "SabChat Sessions",
      meta: `${compact(stats.totalSabChatSessions)} · AI chatbot`,
      onClick: () => router.push("/dashboard/sabchat"),
    },
    {
      key: "sms",
      title: "SMS Campaigns",
      meta: `${compact(stats.totalSmsSent)} sent · ${derived?.smsDeliveryRate ?? 0}% delivered`,
      onClick: () => router.push("/dashboard/sms"),
    },
  ];

  const projectInitials = Array.from({
    length: Math.min(stats.totalProjects || 1, 5),
  }).map((_, i) => String.fromCharCode(65 + i));

  return (
    <div className="mx-auto w-full max-w-[1320px] px-6 pt-6 pb-10">
      {/* ── Breadcrumb ── */}
      <ZoruBreadcrumb>
        <ZoruBreadcrumbList>
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/home">SabNode</ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/home">Account</ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbPage>Overview</ZoruBreadcrumbPage>
          </ZoruBreadcrumbItem>
        </ZoruBreadcrumbList>
      </ZoruBreadcrumb>

      {/* ── Page header ── */}
      <div className="mt-5 flex items-end justify-between gap-6">
        <div className="min-w-0">
          <h1 className="text-[30px] tracking-[-0.015em] text-zoru-ink leading-[1.1]">
            {greeting()}, {userName}
          </h1>
          <p className="mt-1.5 text-[13px] text-zoru-ink-muted">
            {stats.totalProjects} project{stats.totalProjects !== 1 ? "s" : ""}{" "}
            · {format(new Date(), "EEEE, MMM d · HH:mm")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ZoruButton
            variant="outline"
            size="sm"
            onClick={() => router.push("/dashboard/billing")}
          >
            {stats.planName || "Free plan"}
            <ChevronDown className="opacity-60" />
          </ZoruButton>
          <ZoruButton variant="outline" size="sm" onClick={handleExport}>
            <Download /> Export
          </ZoruButton>
          <ZoruDropdownMenu>
            <ZoruDropdownMenuTrigger asChild>
              <ZoruButton variant="outline" size="sm">
                <Filter /> Filter
              </ZoruButton>
            </ZoruDropdownMenuTrigger>
            <ZoruDropdownMenuContent align="end" className="w-56">
              <ZoruDropdownMenuLabel>Filter by</ZoruDropdownMenuLabel>
              <ZoruDropdownMenuItem
                onSelect={() => router.push("/dashboard/analytics")}
              >
                <Send /> Messages &amp; delivery
              </ZoruDropdownMenuItem>
              <ZoruDropdownMenuItem
                onSelect={() => router.push("/dashboard/crm/sales-crm/leads")}
              >
                <Briefcase /> CRM pipeline
              </ZoruDropdownMenuItem>
              <ZoruDropdownMenuItem
                onSelect={() => router.push("/dashboard/sabflow")}
              >
                <Workflow /> Active flows
              </ZoruDropdownMenuItem>
              <ZoruDropdownMenuItem
                onSelect={() => router.push("/dashboard/notifications")}
              >
                <Bell /> Unread notifications
              </ZoruDropdownMenuItem>
              <ZoruDropdownMenuSeparator />
              <ZoruDropdownMenuItem onSelect={fetchHome}>
                <AlarmClock /> Refresh data
              </ZoruDropdownMenuItem>
            </ZoruDropdownMenuContent>
          </ZoruDropdownMenu>
        </div>
      </div>

      {/* ── Onboarding pending banner ── */}
      {onboardingChecked &&
        onboardingStatus &&
        onboardingStatus.status !== "complete" && (
          <OnboardingSetupCard status={onboardingStatus.status} />
        )}

      {/* ── Big cards row ── */}
      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_280px]">
        <BigStatCard
          title="WhatsApp"
          subtitle="Last 30 days"
          metaLeft={
            <>
              <Send className="h-3 w-3" />
              {compact(stats.totalMessages)} sent
            </>
          }
          metaRight={
            <>
              <CircleCheck className="h-3 w-3" />
              {derived?.deliveryRate ?? 0}% delivered
            </>
          }
          statusLabel={
            derived?.messagesTrend.up
              ? `+${derived?.messagesTrend.delta ?? 0}% vs prev 24h`
              : `${derived?.messagesTrend.delta ?? 0}% vs prev 24h`
          }
          statusOk
          tokens={projectInitials}
          ctaLabel="View analytics"
          onCtaClick={() => router.push("/dashboard/analytics")}
        />

        <BigStatCard
          title="CRM Pipeline"
          subtitle={`${curr(stats.pipelineValue, currency)} total value`}
          metaLeft={
            <>
              <Briefcase className="h-3 w-3" />
              {stats.totalDeals} deals
            </>
          }
          metaRight={
            <>
              <Users className="h-3 w-3" />
              {compact(stats.totalLeads)} leads
            </>
          }
          statusLabel={
            stats.dealsWon > 0
              ? `${stats.dealsWon} won`
              : `${velocity.leadsLast7d} new this week`
          }
          statusOk={stats.dealsWon > 0}
          tokens={["L1", "L2", "L3", "L4", "L5"]}
          ctaLabel="View pipeline"
          onCtaClick={() => router.push("/dashboard/crm/sales-crm/leads")}
        />

        <div className="flex flex-col gap-2">
          {notificationCards.slice(0, 3).map((n, i) => (
            <NotificationCard
              key={i}
              icon={n.icon}
              title={n.title}
              inverted={n.tone === "inverted"}
              onClick={n.onClick}
            />
          ))}
          <button
            type="button"
            onClick={() => router.push("/dashboard/notifications")}
            className="mt-1.5 flex items-center justify-between px-2 text-[11.5px] text-zoru-ink-muted transition-colors hover:text-zoru-ink"
          >
            <span>See all notifications</span>
            <span className="inline-flex items-center gap-1 rounded-full border border-zoru-line bg-zoru-surface px-1.5 py-0.5 text-[10px]">
              <Bell className="h-2.5 w-2.5" />
              {unreadNotifications.length || "Zero"}
            </span>
          </button>
        </div>
      </div>

      {/* ── All Apps overview ── */}
      <section className="mt-10">
        <div className="flex items-end justify-between">
          <div>
            <h2 className="text-[22px] tracking-tight text-zoru-ink leading-none">
              All Apps
            </h2>
            <p className="mt-1.5 text-[12.5px] text-zoru-ink-muted">
              Live counts across every SabNode module ·{" "}
              {compact(stats.totalActivityLogs7d)} actions this week
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <ZoruButton
              variant="outline"
              size="sm"
              onClick={() => router.push("/dashboard/integrations")}
            >
              Integrations
            </ZoruButton>
            <ZoruButton
              variant="outline"
              size="icon-sm"
              aria-label="More"
              onClick={() => router.push("/dashboard/settings")}
            >
              <MoreHorizontal />
            </ZoruButton>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          <ModuleTile
            icon={<Send />}
            name="Wachat Broadcasts"
            primary={`${compact(stats.totalMessages)} sent`}
            secondary={`${compact(stats.totalCampaigns)} campaigns · ${derived?.deliveryRate ?? 0}% delivered`}
            href="/dashboard/broadcasts"
            status={stats.totalSent > 0 ? "ok" : "off"}
          />
          <ModuleTile
            icon={<MessageSquare />}
            name="Wachat Chat"
            primary={compact(stats.totalContacts)}
            secondary={`contacts · +${velocity.contactsLast7d} this week`}
            href="/dashboard/chat"
            status={stats.totalContacts > 0 ? "ok" : "off"}
          />
          <ModuleTile
            icon={<Workflow />}
            name="SabFlow"
            primary={`${stats.activeFlows}/${stats.totalFlows}`}
            secondary={`${compact(stats.totalFlowExecutions)} executions`}
            href="/dashboard/sabflow"
            status={
              stats.activeFlows > 0
                ? "ok"
                : stats.totalFlows > 0
                  ? "warn"
                  : "off"
            }
          />
          <ModuleTile
            icon={<Briefcase />}
            name="CRM Pipeline"
            primary={curr(stats.pipelineValue, currency)}
            secondary={`${stats.totalDeals} deals · ${compact(stats.totalLeads)} leads`}
            href="/dashboard/crm/sales-crm/leads"
            status={
              stats.totalDeals > 0
                ? "ok"
                : stats.totalLeads > 0
                  ? "warn"
                  : "off"
            }
          />

          <ModuleTile
            icon={<Mail />}
            name="Email"
            primary={compact(stats.totalEmailCampaigns)}
            secondary={`${compact(stats.totalEmailContacts)} contacts`}
            href="/dashboard/email"
            status={stats.totalEmailCampaigns > 0 ? "ok" : "off"}
          />
          <ModuleTile
            icon={<Smartphone />}
            name="SMS"
            primary={compact(stats.totalSmsSent)}
            secondary={`${derived?.smsDeliveryRate ?? 0}% delivered`}
            href="/dashboard/sms"
            status={stats.totalSmsSent > 0 ? "ok" : "off"}
          />
          <ModuleTile
            icon={<Bot />}
            name="SabChat"
            primary={compact(stats.totalSabChatSessions)}
            secondary="AI chatbot sessions"
            href="/dashboard/sabchat"
            status={stats.totalSabChatSessions > 0 ? "ok" : "off"}
          />
          <ModuleTile
            icon={<Globe />}
            name="SEO Suite"
            primary={`${stats.totalSeoProjects} ${stats.totalSeoProjects === 1 ? "site" : "sites"}`}
            secondary={`${compact(stats.totalSeoAudits)} audits · ${compact(stats.totalSeoKeywords)} keywords`}
            href="/dashboard/seo"
            status={
              stats.totalSeoAudits > 0
                ? "ok"
                : stats.totalSeoProjects > 0
                  ? "warn"
                  : "off"
            }
          />

          <ModuleTile
            icon={<LayoutTemplate />}
            name="Templates"
            primary={compact(stats.totalTemplates)}
            secondary={`${compact(stats.totalLibraryTemplates)} in library`}
            href="/dashboard/templates"
            status={stats.totalTemplates > 0 ? "ok" : "off"}
          />
          <ModuleTile
            icon={<ShoppingBag />}
            name="E-commerce"
            primary={compact(stats.totalEcommOrders)}
            secondary={`${compact(stats.totalEcommProducts)} products`}
            href="/dashboard/shop"
            status={
              stats.totalEcommOrders > 0
                ? "ok"
                : stats.totalEcommProducts > 0
                  ? "warn"
                  : "off"
            }
          />
          <ModuleTile
            icon={<LinkIcon />}
            name="URL Shortener"
            primary={compact(stats.totalShortUrls)}
            secondary="short links created"
            href="/dashboard/url-shortener"
            status={stats.totalShortUrls > 0 ? "ok" : "off"}
          />
          <ModuleTile
            icon={<QrCode />}
            name="QR Codes"
            primary={compact(stats.totalQrCodes)}
            secondary="codes generated"
            href="/dashboard/qr-code-maker"
            status={stats.totalQrCodes > 0 ? "ok" : "off"}
          />

          <ModuleTile
            icon={<Megaphone />}
            name="Facebook Suite"
            primary={compact(stats.totalFacebookBroadcasts)}
            secondary={`${compact(stats.totalFacebookSubscribers)} subscribers`}
            href="/dashboard/facebook/all-projects"
            status={stats.totalFacebookBroadcasts > 0 ? "ok" : "off"}
          />
          <ModuleTile
            icon={<Earth />}
            name="Website Builder"
            primary={compact(stats.totalSites)}
            secondary="published sites"
            href="/dashboard/website-builder"
            status={stats.totalSites > 0 ? "ok" : "off"}
          />
          <ModuleTile
            icon={<Users />}
            name="Team"
            primary={compact(stats.totalTeamMessages)}
            secondary={
              stats.totalPendingInvitations > 0
                ? `${stats.totalPendingInvitations} pending invites`
                : "team messages"
            }
            href="/dashboard/team"
            status={stats.totalPendingInvitations > 0 ? "warn" : "ok"}
          />
          <ModuleTile
            icon={<Bell />}
            name="Notifications"
            primary={compact(unreadNotifications.length)}
            secondary={
              unreadNotifications.length > 0 ? "unread" : "all caught up"
            }
            href="/dashboard/notifications"
            status={unreadNotifications.length > 0 ? "warn" : "ok"}
          />
        </div>
      </section>

      {/* ── Performance KPIs ── */}
      <section className="mt-10">
        <div className="flex items-end justify-between">
          <div>
            <h2 className="text-[22px] tracking-tight text-zoru-ink leading-none">
              Performance
            </h2>
            <p className="mt-1.5 text-[12.5px] text-zoru-ink-muted">
              Key metrics across every app in your account
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <ZoruDropdownMenu>
              <ZoruDropdownMenuTrigger asChild>
                <ZoruButton variant="outline" size="sm">
                  {TIME_RANGE_LABELS[timeRange]}
                  <ChevronDown className="opacity-60" />
                </ZoruButton>
              </ZoruDropdownMenuTrigger>
              <ZoruDropdownMenuContent align="end">
                <ZoruDropdownMenuLabel>Time range</ZoruDropdownMenuLabel>
                <ZoruDropdownMenuRadioGroup
                  value={timeRange}
                  onValueChange={(v) => setTimeRange(v as TimeRange)}
                >
                  <ZoruDropdownMenuRadioItem value="24h">
                    Last 24 hours
                  </ZoruDropdownMenuRadioItem>
                  <ZoruDropdownMenuRadioItem value="7d">
                    Last 7 days
                  </ZoruDropdownMenuRadioItem>
                  <ZoruDropdownMenuRadioItem value="30d">
                    Last 30 days
                  </ZoruDropdownMenuRadioItem>
                  <ZoruDropdownMenuRadioItem value="all">
                    All time
                  </ZoruDropdownMenuRadioItem>
                </ZoruDropdownMenuRadioGroup>
                <ZoruDropdownMenuSeparator />
                <ZoruDropdownMenuItem
                  onSelect={() => router.push("/dashboard/analytics")}
                >
                  <ArrowUpRight /> Open analytics
                </ZoruDropdownMenuItem>
              </ZoruDropdownMenuContent>
            </ZoruDropdownMenu>

            <ZoruButton variant="outline" size="sm" onClick={handleExport}>
              <Download /> Export
            </ZoruButton>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          <KpiTile
            label="Messages 24h"
            value={compact(velocity.messagesLast24h)}
            hint={`${compact(stats.totalMessages)} all time`}
            delta={derived?.messagesTrend.delta}
            up={derived?.messagesTrend.up}
            icon={<Send />}
          />
          <KpiTile
            label="Delivery rate"
            value={`${derived?.deliveryRate ?? 0}%`}
            hint={`${compact(stats.totalDelivered)} / ${compact(stats.totalSent)}`}
            icon={<CircleCheck />}
          />
          <KpiTile
            label="Pipeline value"
            value={curr(stats.pipelineValue, currency)}
            hint={`${stats.totalDeals} open deals`}
            icon={<Briefcase />}
          />
          <KpiTile
            label="Deals won"
            value={compact(stats.dealsWon)}
            hint={`${derived?.dealsWonRate ?? 0}% conversion`}
            icon={<CircleCheck />}
          />

          <KpiTile
            label="New leads"
            value={compact(velocity.leadsLast7d)}
            hint={`${compact(stats.totalLeads)} total`}
            icon={<Users />}
          />
          <KpiTile
            label="Contacts"
            value={compact(stats.totalContacts)}
            hint={`+${velocity.contactsLast7d} this week`}
            icon={<MessageSquare />}
          />
          <KpiTile
            label="Active flows"
            value={`${stats.activeFlows}/${stats.totalFlows}`}
            hint={`${compact(stats.totalFlowExecutions)} executions`}
            icon={<Workflow />}
          />
          <KpiTile
            label="SabChat sessions"
            value={compact(stats.totalSabChatSessions)}
            hint="AI chatbot"
            icon={<Bot />}
          />

          <KpiTile
            label="SMS delivered"
            value={`${derived?.smsDeliveryRate ?? 0}%`}
            hint={`${compact(stats.totalSmsSent)} sent`}
            icon={<Smartphone />}
          />
          <KpiTile
            label="Email campaigns"
            value={compact(stats.totalEmailCampaigns)}
            hint={`${compact(stats.totalEmailContacts)} contacts`}
            icon={<Mail />}
          />
          <KpiTile
            label="SEO audits"
            value={compact(stats.totalSeoAudits)}
            hint={`${stats.totalSeoProjects} site${stats.totalSeoProjects !== 1 ? "s" : ""}`}
            icon={<Globe />}
          />
          <KpiTile
            label="Activity 7d"
            value={compact(stats.totalActivityLogs7d)}
            hint={`${stats.totalProjects} project${stats.totalProjects !== 1 ? "s" : ""}`}
            icon={<Sparkles />}
          />
        </div>
      </section>

      {/* ── Plan + Quick Modules + Recent Activity ── */}
      <section className="mt-10 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <ZoruCard className="p-5">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="text-[11px] uppercase tracking-wide text-zoru-ink-muted">
                Current Plan
              </div>
              <div className="mt-1.5 text-[18px] text-zoru-ink leading-tight">
                {stats.planName || "Free plan"}
              </div>
              <div className="mt-1 text-[11.5px] text-zoru-ink-muted leading-tight">
                {compact(stats.credits)} credits ·{" "}
                {stats.totalProjects} project
                {stats.totalProjects !== 1 ? "s" : ""}
              </div>
            </div>
            <button
              type="button"
              aria-label="Manage billing"
              onClick={() => router.push("/dashboard/billing")}
              className="flex h-7 w-7 items-center justify-center rounded-[var(--zoru-radius-sm)] text-zoru-ink-muted transition-colors hover:bg-zoru-surface-2 hover:text-zoru-ink"
            >
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
          <InitialsStack initials={projectInitials} className="mt-4" />
          <div className="mt-4 flex items-center gap-2">
            <ZoruButton
              size="sm"
              className="flex-1"
              onClick={() => router.push("/dashboard/billing")}
            >
              Manage billing
            </ZoruButton>
            <ZoruButton
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => router.push("/dashboard/profile")}
            >
              Profile
            </ZoruButton>
          </div>
        </ZoruCard>

        <div>
          <div className="flex items-center justify-between pb-3">
            <h3 className="text-[15px] text-zoru-ink">Quick Modules</h3>
            <ZoruButton
              variant="outline"
              size="sm"
              onClick={() => router.push("/dashboard/integrations")}
            >
              <Plus /> Add app
            </ZoruButton>
          </div>
          <ZoruCard className="divide-y divide-zoru-line p-0">
            {moduleRows.map((row) => (
              <button
                key={row.key}
                type="button"
                onClick={row.onClick}
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-zoru-surface focus-visible:outline-none"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm text-zoru-ink">{row.title}</p>
                  <p className="mt-0.5 truncate text-[11.5px] text-zoru-ink-muted">
                    {row.meta}
                  </p>
                </div>
                <ArrowRight className="h-3.5 w-3.5 shrink-0 text-zoru-ink-subtle" />
              </button>
            ))}
          </ZoruCard>
        </div>

        <ZoruCard className="p-5">
          <div className="flex items-center justify-between">
            <div className="text-[11px] uppercase tracking-wide text-zoru-ink-muted">
              Recent Activity
            </div>
            {recentActivity.length > 0 ? (
              <span className="text-[10.5px] text-zoru-ink-subtle">
                {recentActivity.length} events
              </span>
            ) : null}
          </div>
          {recentActivity.length === 0 ? (
            <div className="mt-4 flex flex-col items-center gap-2 py-4 text-center">
              <Sparkles className="h-5 w-5 text-zoru-ink-subtle" />
              <div className="text-[12px] text-zoru-ink-muted">
                No activity yet
              </div>
            </div>
          ) : (
            <ul className="mt-3 space-y-3">
              {recentActivity.slice(0, 5).map((a) => (
                <li key={a._id} className="flex gap-2.5 text-[12px]">
                  <span className="mt-[6px] h-1.5 w-1.5 shrink-0 rounded-full bg-zoru-ink" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-zoru-ink leading-tight">
                      <span>{a.userName}</span>{" "}
                      <span className="text-zoru-ink-muted">
                        {a.action.replace(/_/g, " ").toLowerCase()}
                      </span>
                    </div>
                    <div className="mt-0.5 text-[10.5px] text-zoru-ink-subtle">
                      {formatDistanceToNow(new Date(a.createdAt), {
                        addSuffix: true,
                      })}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </ZoruCard>
      </section>

      <div className="h-6" />
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════
   Local helper components — neutral, zoru-only.
   ════════════════════════════════════════════════════════════════════ */

function BigStatCard({
  title,
  subtitle,
  metaLeft,
  metaRight,
  statusLabel,
  statusOk,
  tokens,
  ctaLabel,
  onCtaClick,
}: {
  title: string;
  subtitle: string;
  metaLeft: React.ReactNode;
  metaRight: React.ReactNode;
  statusLabel: string;
  statusOk?: boolean;
  tokens: string[];
  ctaLabel: string;
  onCtaClick: () => void;
}) {
  return (
    <ZoruCard className="min-w-[260px] p-4">
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] text-zoru-ink-muted">
        <span className="inline-flex items-center gap-1">{metaLeft}</span>
        <span className="text-zoru-ink-subtle">·</span>
        <span className="inline-flex items-center gap-1">{metaRight}</span>
        <span className="text-zoru-ink-subtle">·</span>
        <span className="inline-flex items-center gap-1">
          <span
            className={cn(
              "h-1.5 w-1.5 rounded-full",
              statusOk ? "bg-zoru-success" : "bg-zoru-ink-muted",
            )}
          />
          {statusLabel}
        </span>
      </div>

      <div className="mt-2.5">
        <h3 className="text-[18px] tracking-[-0.01em] text-zoru-ink leading-[1.1]">
          {title}
        </h3>
        <p className="mt-0.5 text-[12px] text-zoru-ink-muted leading-tight">
          {subtitle}
        </p>
      </div>

      <div className="mt-3.5 flex items-center justify-between gap-3">
        <InitialsStack initials={tokens} />
        <ZoruButton size="sm" onClick={onCtaClick}>
          {ctaLabel} <ArrowRight />
        </ZoruButton>
      </div>
    </ZoruCard>
  );
}

function NotificationCard({
  icon,
  title,
  inverted,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  inverted?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2 rounded-[var(--zoru-radius)] border px-3 py-2.5 text-left transition-colors",
        inverted
          ? "border-zoru-ink bg-zoru-ink text-zoru-on-primary hover:bg-zoru-ink/90"
          : "border-zoru-line bg-zoru-bg text-zoru-ink hover:bg-zoru-surface",
        "focus-visible:outline-none",
      )}
    >
      <span
        className={cn(
          "flex h-6 w-6 shrink-0 items-center justify-center rounded-full",
          inverted
            ? "bg-zoru-on-primary/15 text-zoru-on-primary"
            : "bg-zoru-surface-2 text-zoru-ink-muted",
        )}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1 truncate text-[12.5px]">{title}</span>
      <ArrowRight
        className={cn(
          "h-3 w-3 shrink-0",
          inverted ? "text-zoru-on-primary/70" : "text-zoru-ink-subtle",
        )}
      />
    </button>
  );
}

function ModuleTile({
  icon,
  name,
  primary,
  secondary,
  href,
  status = "ok",
}: {
  icon: React.ReactNode;
  name: string;
  primary: string;
  secondary: string;
  href: string;
  status?: "ok" | "warn" | "off";
}) {
  const router = useRouter();
  const dotClass =
    status === "ok"
      ? "bg-zoru-success"
      : status === "warn"
        ? "bg-zoru-warning"
        : "bg-zoru-ink-subtle";

  return (
    <button
      type="button"
      onClick={() => router.push(href)}
      className="group flex flex-col gap-3 rounded-[var(--zoru-radius-lg)] border border-zoru-line bg-zoru-bg p-4 text-left transition-shadow hover:shadow-[var(--zoru-shadow-md)] focus-visible:outline-none"
    >
      <div className="flex items-center justify-between">
        <span className="flex h-8 w-8 items-center justify-center rounded-[var(--zoru-radius-sm)] bg-zoru-surface-2 text-zoru-ink [&_svg]:size-4">
          {icon}
        </span>
        <span className="inline-flex items-center gap-1 text-[10.5px] text-zoru-ink-muted">
          <span className={cn("h-1.5 w-1.5 rounded-full", dotClass)} />
          {status === "ok" ? "Live" : status === "warn" ? "Pending" : "Idle"}
        </span>
      </div>
      <div className="flex flex-col gap-0.5">
        <p className="text-[11.5px] uppercase tracking-wide text-zoru-ink-subtle">
          {name}
        </p>
        <p className="text-[18px] tracking-tight text-zoru-ink leading-none">
          {primary}
        </p>
        <p className="mt-0.5 truncate text-[11.5px] text-zoru-ink-muted">
          {secondary}
        </p>
      </div>
    </button>
  );
}

function KpiTile({
  label,
  value,
  hint,
  delta,
  up,
  icon,
}: {
  label: string;
  value: string;
  hint?: string;
  delta?: number;
  up?: boolean;
  icon?: React.ReactNode;
}) {
  return (
    <div className="rounded-[var(--zoru-radius-lg)] border border-zoru-line bg-zoru-bg p-4 transition-shadow hover:shadow-[var(--zoru-shadow-sm)]">
      <div className="flex items-start justify-between">
        {icon ? (
          <span className="flex h-8 w-8 items-center justify-center rounded-[var(--zoru-radius-sm)] bg-zoru-surface-2 text-zoru-ink [&_svg]:size-4">
            {icon}
          </span>
        ) : (
          <span className="h-8 w-8" />
        )}
        {delta !== undefined ? (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 rounded-full border px-2 py-1 text-[10px] leading-none",
              up
                ? "border-zoru-success/40 bg-zoru-success/5 text-zoru-success"
                : "border-zoru-danger/40 bg-zoru-danger/5 text-zoru-danger",
            )}
          >
            {up ? (
              <ArrowUpRight className="h-2.5 w-2.5" />
            ) : (
              <ArrowDownRight className="h-2.5 w-2.5" />
            )}
            {Math.abs(delta)}%
          </span>
        ) : null}
      </div>
      <div className="mt-3.5 text-[11.5px] text-zoru-ink-muted leading-none">
        {label}
      </div>
      <div className="mt-1.5 text-[22px] tracking-[-0.01em] text-zoru-ink leading-none">
        {value}
      </div>
      {hint ? (
        <div className="mt-1 truncate text-[11px] text-zoru-ink-muted leading-tight">
          {hint}
        </div>
      ) : null}
    </div>
  );
}

function InitialsStack({
  initials,
  className,
}: {
  initials: string[];
  className?: string;
}) {
  if (initials.length === 0) return null;
  const visible = initials.slice(0, 4);
  const overflow = initials.length - visible.length;
  return (
    <div className={cn("flex items-center -space-x-2", className)}>
      {visible.map((s, i) => (
        <span
          key={`${s}-${i}`}
          className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-zoru-bg bg-zoru-surface-2 text-[10px] text-zoru-ink"
        >
          {s}
        </span>
      ))}
      {overflow > 0 && (
        <span className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-zoru-bg bg-zoru-ink text-[10px] text-zoru-on-primary">
          +{overflow}
        </span>
      )}
    </div>
  );
}

