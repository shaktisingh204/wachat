"use client";

import * as React from "react";
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Inbox,
  MailCheck,
  MousePointerClick,
  Send,
  ShieldAlert,
  Users,
  UserMinus,
  XCircle,
} from "lucide-react";

import {
  Badge,
  Card,
  CardBody,
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyState,
  PageDescription,
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  TBody,
  THead,
  Table,
  Td,
  Th,
  Tr,
} from "@/components/sabcrm/20ui";
import { CountUp, FadeUp } from "@/components/sabmail/motion";
import type {
  SabmailAnalyticsKpis,
  SabmailDeliverabilityStats,
  SabmailRecentCampaign,
} from "./actions";
import "@/components/sabmail/motion/sabmail-motion.css";

type IconType = React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;

interface KpiTile {
  key: string;
  label: string;
  value: number;
  icon: IconType;
  tone: "default" | "ok" | "err";
}

const TONE_COLOR: Record<KpiTile["tone"], string> = {
  default: "var(--st-accent)",
  ok: "var(--st-status-ok,#16a34a)",
  err: "var(--st-status-err,#dc2626)",
};

/** Map a campaign status to a Badge variant. */
function statusVariant(
  status: string,
): "default" | "outline" | "secondary" | "destructive" {
  const s = status.toLowerCase();
  if (s === "sent" || s === "completed" || s === "delivered") return "default";
  if (s === "failed" || s === "cancelled" || s === "canceled") return "destructive";
  if (s === "sending" || s === "scheduled" || s === "queued") return "secondary";
  return "outline";
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** Render a 0..1 rate as a one-decimal percent string. */
function pct(rate: number): string {
  const v = Number.isFinite(rate) ? rate * 100 : 0;
  return `${v.toFixed(1)}%`;
}

/** Format a UTC `YYYY-MM-DD` day key as a short axis label. */
function dayLabel(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return date;
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

const OK = "var(--st-status-ok,#16a34a)";
const ERR = "var(--st-status-err,#dc2626)";
const ACCENT = "var(--st-accent)";

interface DeliverabilityTile {
  key: string;
  label: string;
  /** Pre-formatted display value (CountUp animates the raw number behind it). */
  raw: number;
  icon: IconType;
  color: string;
  /** When set the number renders as a percent of this 0..1 rate. */
  asPercent?: boolean;
}

/**
 * Compact 14-day stacked bar sparkline — pure inline SVG, no chart lib.
 * Delivered (green) + bounce (red) stacked per day; opens overlaid as a
 * thin accent cap so engagement is visible without a second axis.
 */
function DeliverabilitySparkline({
  series,
}: {
  series: SabmailDeliverabilityStats["series"];
}) {
  const max = Math.max(
    1,
    ...series.map((d) => d.delivered + d.bounce),
  );
  const W = 100;
  const H = 36;
  const n = series.length || 1;
  const gap = 1.4;
  const barW = Math.max(1.5, (W - gap * (n - 1)) / n);

  return (
    <div className="flex flex-col gap-2">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-24 w-full"
        preserveAspectRatio="none"
        role="img"
        aria-label="Delivered and bounced email per day, last 14 days"
      >
        {series.map((d, i) => {
          const x = i * (barW + gap);
          const totalH = ((d.delivered + d.bounce) / max) * H;
          const delH = ((d.delivered) / max) * H;
          const bncH = ((d.bounce) / max) * H;
          const openH = Math.min(delH, ((d.open) / max) * H);
          return (
            <g key={d.date}>
              {/* track */}
              <rect
                x={x}
                y={0}
                width={barW}
                height={H}
                rx={0.8}
                fill="var(--st-bg-muted)"
              />
              {/* bounce (top) */}
              {bncH > 0 ? (
                <rect
                  x={x}
                  y={H - totalH}
                  width={barW}
                  height={bncH}
                  rx={0.8}
                  fill={ERR}
                  opacity={0.85}
                />
              ) : null}
              {/* delivered */}
              {delH > 0 ? (
                <rect
                  x={x}
                  y={H - delH}
                  width={barW}
                  height={delH}
                  rx={0.8}
                  fill={OK}
                  opacity={0.85}
                />
              ) : null}
              {/* opens cap */}
              {openH > 0 ? (
                <rect
                  x={x}
                  y={H - openH}
                  width={barW}
                  height={Math.max(0.6, openH * 0.18)}
                  fill={ACCENT}
                />
              ) : null}
            </g>
          );
        })}
      </svg>
      <div className="flex items-center justify-between text-[10px] text-[var(--st-text-secondary)]">
        <span>{series.length ? dayLabel(series[0].date) : ""}</span>
        <span className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-sm" style={{ background: OK }} />
            Delivered
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-sm" style={{ background: ERR }} />
            Bounce
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-sm" style={{ background: ACCENT }} />
            Open
          </span>
        </span>
        <span>
          {series.length ? dayLabel(series[series.length - 1].date) : ""}
        </span>
      </div>
    </div>
  );
}

export function SabmailAnalyticsClient({
  kpis,
  recentCampaigns,
  deliverability,
  loadError,
}: {
  kpis: SabmailAnalyticsKpis;
  recentCampaigns: SabmailRecentCampaign[];
  deliverability: SabmailDeliverabilityStats;
  loadError: string | null;
}) {
  const tiles: KpiTile[] = [
    { key: "sent", label: "Total sent", value: kpis.sent, icon: Send, tone: "ok" },
    { key: "failed", label: "Total failed", value: kpis.failed, icon: XCircle, tone: "err" },
    { key: "campaigns", label: "Campaigns", value: kpis.campaigns, icon: BarChart3, tone: "default" },
    { key: "contacts", label: "Contacts", value: kpis.contacts, icon: Users, tone: "default" },
    { key: "accounts", label: "Mailboxes", value: kpis.accounts, icon: CheckCircle2, tone: "default" },
  ];

  const hasAnyData =
    kpis.campaigns > 0 ||
    kpis.sent > 0 ||
    kpis.failed > 0 ||
    kpis.contacts > 0 ||
    kpis.accounts > 0;

  const d = deliverability.overall;
  const deliverabilityTiles: DeliverabilityTile[] = [
    { key: "delivered", label: "Delivered", raw: d.counts.delivered, icon: MailCheck, color: OK },
    { key: "openRate", label: "Open rate", raw: d.rates.openRate, icon: Inbox, color: ACCENT, asPercent: true },
    { key: "clickRate", label: "Click rate", raw: d.rates.clickRate, icon: MousePointerClick, color: ACCENT, asPercent: true },
    { key: "bounceRate", label: "Bounce rate", raw: d.rates.bounceRate, icon: XCircle, color: ERR, asPercent: true },
    { key: "complaintRate", label: "Complaint rate", raw: d.rates.complaintRate, icon: ShieldAlert, color: ERR, asPercent: true },
    { key: "unsub", label: "Unsubscribes", raw: d.counts.unsubscribe, icon: UserMinus, color: "var(--st-text)" },
  ];

  return (
    <div className="sabmail-canvas min-h-full p-4 sm:p-6">
      <div className="sabmail-motion mx-auto w-full max-w-6xl">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold text-[var(--st-text)]">Analytics</h1>
          <p className="mt-1 max-w-2xl text-sm text-[var(--st-text-secondary)]">
            A read-only snapshot of this workspace — campaign volume, delivery
            outcomes, contacts, and connected mailboxes.
          </p>
        </div>

        {loadError ? (
        <div
          className="mt-6 flex items-start gap-2 rounded-md border px-3 py-2.5 text-sm"
          style={{
            borderColor: "var(--st-status-err,#dc2626)",
            color: "var(--st-status-err,#dc2626)",
            background: "var(--st-bg-muted)",
          }}
          role="alert"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>Could not load analytics: {loadError}</span>
        </div>
      ) : null}

      {/* KPI tiles */}
      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {tiles.map((t, idx) => {
          const Icon = t.icon;
          return (
            <Card
              key={t.key}
              className="sabmail-stagger-item flex flex-col gap-3 p-4"
              style={{ ["--i" as string]: idx } as React.CSSProperties}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-[var(--st-text-secondary)]">
                  {t.label}
                </span>
                <span
                  className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-[var(--st-bg-muted)]"
                  style={{ color: TONE_COLOR[t.tone] }}
                >
                  <Icon className="h-4 w-4" aria-hidden />
                </span>
              </div>
              <div
                className="text-2xl font-semibold tabular-nums"
                style={{ color: t.tone === "default" ? "var(--st-text)" : TONE_COLOR[t.tone] }}
              >
                <CountUp value={t.value} />
              </div>
            </Card>
          );
        })}
      </div>

      {/* Recent campaigns */}
      <div className="mt-6">
        <Card
          className="sabmail-stagger-item"
          style={{ ["--i" as string]: tiles.length } as React.CSSProperties}
        >
          <CardHeader>
            <CardTitle>Recent campaigns</CardTitle>
            <CardDescription>
              Latest sends with their delivery split.
            </CardDescription>
          </CardHeader>
          <CardBody>
            {recentCampaigns.length === 0 ? (
              <EmptyState
                icon={<BarChart3 aria-hidden />}
                title={hasAnyData ? "No campaigns yet" : "Nothing to report yet"}
                description={
                  hasAnyData
                    ? "Once you send a campaign it will appear here with delivery stats."
                    : "Connect a mailbox, add contacts, and send a campaign to populate this dashboard."
                }
              />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <THead>
                    <Tr>
                      <Th>Campaign</Th>
                      <Th>Status</Th>
                      <Th>Delivered / Failed</Th>
                      <Th>Created</Th>
                    </Tr>
                  </THead>
                  <TBody>
                    {recentCampaigns.map((c) => {
                      const total = c.sent + c.failed;
                      const sentPct = total > 0 ? (c.sent / total) * 100 : 0;
                      const failedPct = total > 0 ? (c.failed / total) * 100 : 0;
                      return (
                        <Tr key={c.id}>
                          <Td>
                            <span className="font-medium text-[var(--st-text)]">
                              {c.name}
                            </span>
                          </Td>
                          <Td>
                            <Badge variant={statusVariant(c.status)} className="capitalize">
                              {c.status}
                            </Badge>
                          </Td>
                          <Td>
                            <div className="flex min-w-[180px] flex-col gap-1.5">
                              <div className="flex items-center justify-between text-xs text-[var(--st-text-secondary)]">
                                <span style={{ color: "var(--st-status-ok,#16a34a)" }}>
                                  {c.sent.toLocaleString()} sent
                                </span>
                                <span style={{ color: "var(--st-status-err,#dc2626)" }}>
                                  {c.failed.toLocaleString()} failed
                                </span>
                              </div>
                              <div
                                className="flex h-2 w-full overflow-hidden rounded-full"
                                style={{ background: "var(--st-bg-muted)" }}
                                role="img"
                                aria-label={`${c.sent} delivered, ${c.failed} failed`}
                              >
                                <span
                                  className="h-full"
                                  style={{
                                    width: `${sentPct}%`,
                                    background: "var(--st-status-ok,#16a34a)",
                                  }}
                                />
                                <span
                                  className="h-full"
                                  style={{
                                    width: `${failedPct}%`,
                                    background: "var(--st-status-err,#dc2626)",
                                  }}
                                />
                              </div>
                            </div>
                          </Td>
                          <Td>
                            <span className="text-sm text-[var(--st-text-secondary)]">
                              {formatDate(c.createdAt)}
                            </span>
                          </Td>
                        </Tr>
                      );
                    })}
                  </TBody>
                </Table>
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      {/* ── Deliverability ──────────────────────────────────────────── */}
      <div className="mt-10">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-[var(--st-text)]">
              Deliverability
            </h2>
            <p className="mt-0.5 text-sm text-[var(--st-text-secondary)]">
              Live event stream from your sending providers — delivered, opens,
              clicks, bounces, complaints and unsubscribes.
            </p>
          </div>
          {deliverability.hasEvents ? (
            <Badge variant="secondary" className="shrink-0 tabular-nums">
              {deliverability.last30d.total.toLocaleString()} events · 30d
            </Badge>
          ) : null}
        </div>

        {!deliverability.hasEvents ? (
          <Card className="mt-4">
            <CardBody>
              <FadeUp>
                <EmptyState
                  icon={<MailCheck aria-hidden />}
                  title="No deliverability events yet"
                  description="Once your email provider posts delivery, open and bounce events to the SabMail webhook, this dashboard fills in automatically."
                />
              </FadeUp>
            </CardBody>
          </Card>
        ) : (
          <>
            {/* KPI row */}
            <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
              {deliverabilityTiles.map((t, idx) => {
                const Icon = t.icon;
                return (
                  <Card
                    key={t.key}
                    className="sabmail-stagger-item flex flex-col gap-3 p-4"
                    style={{ ["--i" as string]: idx } as React.CSSProperties}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-[var(--st-text-secondary)]">
                        {t.label}
                      </span>
                      <span
                        className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-[var(--st-bg-muted)]"
                        style={{ color: t.color }}
                      >
                        <Icon className="h-4 w-4" aria-hidden />
                      </span>
                    </div>
                    <div
                      className="text-2xl font-semibold tabular-nums"
                      style={{ color: t.color }}
                    >
                      {t.asPercent ? (
                        <CountUp value={t.raw * 100} format={(n) => `${n}%`} />
                      ) : (
                        <CountUp value={t.raw} />
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>

            {/* Sparkline + per-campaign table */}
            <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-5">
              <Card
                className="sabmail-stagger-item lg:col-span-2"
                style={{ ["--i" as string]: deliverabilityTiles.length } as React.CSSProperties}
              >
                <CardHeader>
                  <CardTitle>Last 14 days</CardTitle>
                  <CardDescription>
                    Delivered vs bounced volume per day, with opens overlaid.
                  </CardDescription>
                </CardHeader>
                <CardBody>
                  <DeliverabilitySparkline series={deliverability.series} />
                  <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                    <div>
                      <div className="text-xs text-[var(--st-text-secondary)]">
                        Delivery
                      </div>
                      <div
                        className="text-sm font-semibold tabular-nums"
                        style={{ color: OK }}
                      >
                        {pct(deliverability.overall.rates.deliveryRate)}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-[var(--st-text-secondary)]">
                        Open
                      </div>
                      <div
                        className="text-sm font-semibold tabular-nums"
                        style={{ color: ACCENT }}
                      >
                        {pct(deliverability.overall.rates.openRate)}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-[var(--st-text-secondary)]">
                        Click
                      </div>
                      <div
                        className="text-sm font-semibold tabular-nums"
                        style={{ color: ACCENT }}
                      >
                        {pct(deliverability.overall.rates.clickRate)}
                      </div>
                    </div>
                  </div>
                </CardBody>
              </Card>

              <Card
                className="sabmail-stagger-item lg:col-span-3"
                style={{ ["--i" as string]: deliverabilityTiles.length + 1 } as React.CSSProperties}
              >
                <CardHeader>
                  <CardTitle>Top campaigns</CardTitle>
                  <CardDescription>
                    Engagement by campaign, ranked by delivered volume.
                  </CardDescription>
                </CardHeader>
                <CardBody>
                  {deliverability.topCampaigns.length === 0 ? (
                    <EmptyState
                      icon={<BarChart3 aria-hidden />}
                      title="No per-campaign events yet"
                      description="Campaign-tagged events will break down here as your sends are tracked."
                    />
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <THead>
                          <Tr>
                            <Th>Campaign</Th>
                            <Th>Delivered</Th>
                            <Th>Open rate</Th>
                            <Th>Click rate</Th>
                            <Th>Bounces</Th>
                          </Tr>
                        </THead>
                        <TBody>
                          {deliverability.topCampaigns.map((c) => (
                            <Tr key={c.campaignId}>
                              <Td>
                                <span className="font-medium text-[var(--st-text)]">
                                  {c.name}
                                </span>
                              </Td>
                              <Td>
                                <span className="tabular-nums text-[var(--st-text)]">
                                  {c.delivered.toLocaleString()}
                                </span>
                              </Td>
                              <Td>
                                <span className="tabular-nums" style={{ color: ACCENT }}>
                                  {pct(c.openRate)}
                                </span>
                              </Td>
                              <Td>
                                <span className="tabular-nums" style={{ color: ACCENT }}>
                                  {pct(c.clickRate)}
                                </span>
                              </Td>
                              <Td>
                                <span className="tabular-nums" style={{ color: c.bounce > 0 ? ERR : "var(--st-text-secondary)" }}>
                                  {c.bounce.toLocaleString()}
                                </span>
                              </Td>
                            </Tr>
                          ))}
                        </TBody>
                      </Table>
                    </div>
                  )}
                </CardBody>
              </Card>
            </div>
          </>
        )}
        </div>
      </div>
    </div>
  );
}
