"use client";

/**
 * SabSMS — campaign detail (Page 8) client shell.
 *
 * Server component hands us a fully-projected `CampaignDetailBundle`;
 * this module renders the live status bar, timeline chart, funnel,
 * provider breakdown, sender rotation pie, A/B compare, per-recipient
 * drill-down (with detail drawer), webhook fire log, and the share /
 * pause / clone mutation surface.
 */

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ExternalLink,
  Layers,
  Link2,
  PauseCircle,
  PlayCircle,
  Plus,
  StopCircle,
} from "lucide-react";

import {
  ZORU_CHART_PALETTE,
  Badge,
  Button,
  Card,
  ZoruCardContent,
  ZoruCardDescription,
  ZoruCardHeader,
  ZoruCardTitle,
  ZoruChart,
  ZoruChartContainer,
  ZoruChartTooltip,
  Dialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  Input,
  Label,
  Progress,
  Table,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
} from "@/components/zoruui";

import {
  SabsmsDataTable,
  SabsmsDetailDrawer,
  SabsmsExportMenu,
  SabsmsRefreshButton,
  type SabsmsColumn,
  type SabsmsRowAction,
} from "@/components/sabsms/page-toolkit";

import {
  cancelCampaign,
  cloneCampaign,
  convertToDrip,
  createPublicShare,
  editSchedule,
  exportEventsJsonl,
  exportRecipientsCsv,
  pauseCampaign,
  resendFailures,
  resumeCampaign,
  type CampaignDetailBundle,
  type RecipientRow,
} from "./actions";

interface CampaignDetailClientProps {
  bundle: CampaignDetailBundle;
}

function statusVariant(
  status: string,
): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "running":
    case "completed":
    case "delivered":
      return "default";
    case "failed":
    case "cancelled":
      return "destructive";
    case "paused":
    case "scheduled":
    case "queued":
      return "secondary";
    default:
      return "outline";
  }
}

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function CampaignDetailClient({ bundle }: CampaignDetailClientProps) {
  const router = useRouter();
  const { detail } = bundle;
  const [busy, setBusy] = React.useState<string | null>(null);
  const [shareUrl, setShareUrl] = React.useState<string | null>(null);
  const [scheduleDialog, setScheduleDialog] = React.useState<string | null>(
    null,
  );
  const [drawerRow, setDrawerRow] = React.useState<RecipientRow | null>(null);

  const refresh = React.useCallback(() => router.refresh(), [router]);

  const runAction = React.useCallback(
    async (
      label: string,
      fn: () => Promise<{ ok: boolean; error?: string }>,
    ) => {
      setBusy(label);
      try {
        const res = await fn();
        if (!res.ok) {
          console.error(`[sabsms] ${label} failed`, res.error);
        }
        refresh();
      } finally {
        setBusy(null);
      }
    },
    [refresh],
  );

  if (!detail) {
    return (
      <ZoruCard>
        <ZoruCardHeader>
          <ZoruCardTitle>Campaign not found</ZoruCardTitle>
          <ZoruCardDescription>
            It may have been archived or moved to a different workspace.
          </ZoruCardDescription>
        </ZoruCardHeader>
        <ZoruCardContent>
          <ZoruButton variant="outline" asChild>
            <Link href="/sabsms/campaigns">Back to campaigns</Link>
          </ZoruButton>
        </ZoruCardContent>
      </ZoruCard>
    );
  }

  const sentTotal = detail.stats.sent + detail.stats.delivered;
  const progress =
    detail.audienceSize > 0
      ? Math.min(
          100,
          Math.round(
            ((sentTotal + detail.stats.failed) / detail.audienceSize) * 100,
          ),
        )
      : 0;

  const liveBadges = [
    { label: "queued", count: detail.stats.queued },
    { label: "sent", count: sentTotal },
    { label: "delivered", count: detail.stats.delivered },
    { label: "failed", count: detail.stats.failed },
  ];

  const canEditSchedule =
    detail.status !== "running" && detail.status !== "completed";

  const recipientColumns: SabsmsColumn<RecipientRow>[] = [
    {
      id: "to",
      header: "Recipient",
      render: (r) => <span className="font-mono text-xs">{r.to}</span>,
    },
    {
      id: "status",
      header: "Status",
      render: (r) => (
        <ZoruBadge variant={statusVariant(r.status)}>{r.status}</ZoruBadge>
      ),
    },
    {
      id: "provider",
      header: "Provider",
      render: (r) => <span className="text-xs">{r.provider}</span>,
    },
    {
      id: "sentAt",
      header: "Sent at",
      render: (r) => (
        <span className="text-xs text-zoru-ink-muted">
          {r.sentAt ? new Date(r.sentAt).toLocaleString() : "—"}
        </span>
      ),
    },
    {
      id: "deliveredAt",
      header: "Delivered at",
      render: (r) => (
        <span className="text-xs text-zoru-ink-muted">
          {r.deliveredAt ? new Date(r.deliveredAt).toLocaleString() : "—"}
        </span>
      ),
    },
    {
      id: "error",
      header: "Error",
      render: (r) =>
        r.errorMessage ? (
          <span className="text-xs text-rose-600" title={r.errorMessage}>
            {r.errorMessage.slice(0, 32)}
          </span>
        ) : (
          <span className="text-xs text-zoru-ink-muted">—</span>
        ),
    },
  ];

  const recipientRowActions: SabsmsRowAction<RecipientRow>[] = [
    {
      label: "Open in logs",
      icon: <ExternalLink className="h-3.5 w-3.5" />,
      onSelect: (r) => {
        window.open(
          `/sabsms/logs?campaignId=${detail.id}&to=${encodeURIComponent(r.to)}`,
          "_blank",
          "noopener",
        );
      },
    },
    {
      label: "View detail",
      icon: <Plus className="h-3.5 w-3.5" />,
      onSelect: (r) => setDrawerRow(r),
    },
  ];

  const campaignId = detail.id;

  async function downloadCsv(label: string, fn: () => Promise<{
    ok: boolean;
    csv?: string;
    error?: string;
  }>) {
    setBusy(label);
    try {
      const res = await fn();
      if (!res.ok || !res.csv) {
        console.error(`[sabsms] ${label} failed`, res.error);
        return;
      }
      const blob = new Blob([res.csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${label}-${campaignId}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4">
      {/* Header card with live status bar + primary actions */}
      <ZoruCard>
        <ZoruCardContent className="flex flex-col gap-3 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <ZoruBadge variant={statusVariant(detail.status)}>
                {detail.status}
              </ZoruBadge>
              <span className="text-sm text-zoru-ink-muted">
                {detail.scheduleKind} · {detail.senderStrategy}
              </span>
              {detail.abVariant && (
                <ZoruBadge variant="outline">A/B {detail.abVariant}</ZoruBadge>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {liveBadges.map((b) => (
                <span
                  key={b.label}
                  className="flex items-center gap-1 text-sm"
                >
                  <ZoruBadge variant={statusVariant(b.label)}>
                    {b.label}
                  </ZoruBadge>
                  <span className="font-medium text-zoru-ink">
                    {b.count.toLocaleString()}
                  </span>
                </span>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <ZoruProgress value={progress} className="h-1.5 w-48" />
              <span className="text-xs text-zoru-ink-muted">
                {progress}% of {detail.audienceSize.toLocaleString()}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <SabsmsRefreshButton onRefresh={refresh} defaultInterval={30} />
            <ZoruButton
              variant="outline"
              size="sm"
              disabled={busy === "pause"}
              onClick={() =>
                runAction("pause", () =>
                  pauseCampaign({ campaignId: detail.id }),
                )
              }
            >
              <PauseCircle className="mr-1.5 h-3.5 w-3.5" />
              Pause
            </ZoruButton>
            <ZoruButton
              variant="outline"
              size="sm"
              disabled={busy === "resume"}
              onClick={() =>
                runAction("resume", () =>
                  resumeCampaign({ campaignId: detail.id }),
                )
              }
            >
              <PlayCircle className="mr-1.5 h-3.5 w-3.5" />
              Resume
            </ZoruButton>
            <ZoruButton
              variant="destructive"
              size="sm"
              disabled={busy === "cancel"}
              onClick={() =>
                runAction("cancel", () =>
                  cancelCampaign({ campaignId: detail.id }),
                )
              }
            >
              <StopCircle className="mr-1.5 h-3.5 w-3.5" />
              Cancel
            </ZoruButton>
            <ZoruButton
              variant="outline"
              size="sm"
              disabled={!canEditSchedule}
              onClick={() => setScheduleDialog("")}
            >
              Edit schedule
            </ZoruButton>
            <ZoruButton
              variant="outline"
              size="sm"
              disabled={busy === "clone"}
              onClick={() =>
                runAction("clone", () =>
                  cloneCampaign({ campaignId: detail.id }),
                )
              }
            >
              Clone
            </ZoruButton>
            <ZoruButton
              variant="outline"
              size="sm"
              disabled={busy === "convert-drip"}
              onClick={() =>
                runAction("convert-drip", () =>
                  convertToDrip({ campaignId: detail.id }),
                )
              }
            >
              <Layers className="mr-1.5 h-3.5 w-3.5" />
              Convert to drip
            </ZoruButton>
            <ZoruButton
              variant="outline"
              size="sm"
              disabled={busy === "share"}
              onClick={async () => {
                setBusy("share");
                try {
                  const res = await createPublicShare({ campaignId: detail.id });
                  if (res.ok) setShareUrl(res.url);
                } finally {
                  setBusy(null);
                }
              }}
            >
              <Link2 className="mr-1.5 h-3.5 w-3.5" />
              Share link
            </ZoruButton>
            <SabsmsExportMenu
              filename={`sabsms-campaign-${detail.id}`}
              toCsv={async () => {
                const res = await exportRecipientsCsv({
                  campaignId: detail.id,
                });
                return res.ok ? res.csv : "";
              }}
              toJson={async () => {
                const res = await exportEventsJsonl({ campaignId: detail.id });
                return res.ok ? res.jsonl : "";
              }}
            />
            <ZoruButton
              variant="outline"
              size="sm"
              disabled={busy === "resend-failures"}
              onClick={() =>
                downloadCsv("resend-failures", () =>
                  resendFailures({ campaignId: detail.id }),
                )
              }
            >
              <AlertCircle className="mr-1.5 h-3.5 w-3.5" />
              Re-send failures CSV
            </ZoruButton>
          </div>
        </ZoruCardContent>
      </ZoruCard>

      {shareUrl && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm">
          Public share link minted —{" "}
          <code className="rounded bg-white px-1 text-xs">{shareUrl}</code>{" "}
          (TODO: <code>/sabsms/share/[token]</code> read-side route)
        </div>
      )}

      {/* Timeline chart — per-minute send velocity */}
      <ZoruCard>
        <ZoruCardHeader>
          <ZoruCardTitle>Send velocity</ZoruCardTitle>
          <ZoruCardDescription>
            Per-minute sent / delivered / failed counts (max 200 buckets).
          </ZoruCardDescription>
        </ZoruCardHeader>
        <ZoruCardContent>
          {bundle.timeline.length === 0 ? (
            <p className="py-8 text-center text-sm text-zoru-ink-muted">
              No send events yet.
            </p>
          ) : (
            <ZoruChartContainer height={240}>
              <ZoruChart.LineChart
                data={bundle.timeline}
                margin={{ top: 8, right: 16, bottom: 0, left: -16 }}
              >
                <ZoruChart.CartesianGrid
                  strokeDasharray="3 3"
                  className="stroke-zoru-line"
                />
                <ZoruChart.XAxis
                  dataKey="bucket"
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                />
                <ZoruChart.YAxis fontSize={10} tickLine={false} axisLine={false} />
                <ZoruChart.Tooltip content={<ZoruChartTooltip />} />
                <ZoruChart.Legend wrapperStyle={{ fontSize: 12 }} />
                <ZoruChart.Line
                  type="monotone"
                  dataKey="sent"
                  stroke={ZORU_CHART_PALETTE[0]}
                  strokeWidth={2}
                  dot={false}
                  name="Sent"
                />
                <ZoruChart.Line
                  type="monotone"
                  dataKey="delivered"
                  stroke={ZORU_CHART_PALETTE[1]}
                  strokeWidth={2}
                  strokeDasharray="4 3"
                  dot={false}
                  name="Delivered"
                />
                <ZoruChart.Line
                  type="monotone"
                  dataKey="failed"
                  stroke={ZORU_CHART_PALETTE[3]}
                  strokeWidth={2}
                  strokeDasharray="2 3"
                  dot={false}
                  name="Failed"
                />
              </ZoruChart.LineChart>
            </ZoruChartContainer>
          )}
        </ZoruCardContent>
      </ZoruCard>

      {/* Two-up: funnel + provider breakdown */}
      <div className="grid gap-4 lg:grid-cols-2">
        <ZoruCard>
          <ZoruCardHeader>
            <ZoruCardTitle>Funnel</ZoruCardTitle>
            <ZoruCardDescription>
              Queued → sent → delivered → clicked → converted.
            </ZoruCardDescription>
          </ZoruCardHeader>
          <ZoruCardContent>
            <ZoruChartContainer height={220}>
              <ZoruChart.BarChart
                data={bundle.funnel}
                layout="vertical"
                margin={{ top: 8, right: 16, bottom: 0, left: 16 }}
              >
                <ZoruChart.CartesianGrid
                  strokeDasharray="3 3"
                  className="stroke-zoru-line"
                />
                <ZoruChart.XAxis type="number" fontSize={10} hide />
                <ZoruChart.YAxis
                  type="category"
                  dataKey="label"
                  fontSize={10}
                  width={80}
                  tickLine={false}
                  axisLine={false}
                />
                <ZoruChart.Tooltip content={<ZoruChartTooltip />} />
                <ZoruChart.Bar
                  dataKey="count"
                  fill={ZORU_CHART_PALETTE[0]}
                  radius={[0, 4, 4, 0]}
                />
              </ZoruChart.BarChart>
            </ZoruChartContainer>
          </ZoruCardContent>
        </ZoruCard>

        <ZoruCard>
          <ZoruCardHeader>
            <ZoruCardTitle>Providers</ZoruCardTitle>
            <ZoruCardDescription>
              Volume split by carrier provider.
            </ZoruCardDescription>
          </ZoruCardHeader>
          <ZoruCardContent>
            {bundle.providers.length === 0 ? (
              <p className="py-8 text-center text-sm text-zoru-ink-muted">
                No data yet.
              </p>
            ) : (
              <ZoruChartContainer height={220}>
                <ZoruChart.BarChart
                  data={bundle.providers}
                  margin={{ top: 8, right: 16, bottom: 0, left: -16 }}
                >
                  <ZoruChart.CartesianGrid
                    strokeDasharray="3 3"
                    className="stroke-zoru-line"
                  />
                  <ZoruChart.XAxis
                    dataKey="provider"
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                  />
                  <ZoruChart.YAxis
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                  />
                  <ZoruChart.Tooltip content={<ZoruChartTooltip />} />
                  <ZoruChart.Bar
                    dataKey="count"
                    fill={ZORU_CHART_PALETTE[1]}
                    radius={[2, 2, 0, 0]}
                  />
                </ZoruChart.BarChart>
              </ZoruChartContainer>
            )}
          </ZoruCardContent>
        </ZoruCard>
      </div>

      {/* Three-up: countries + sender rotation pie + cost/margin */}
      <div className="grid gap-4 lg:grid-cols-3">
        <ZoruCard>
          <ZoruCardHeader>
            <ZoruCardTitle>By country</ZoruCardTitle>
            <ZoruCardDescription>Top destinations.</ZoruCardDescription>
          </ZoruCardHeader>
          <ZoruCardContent>
            {bundle.countries.length === 0 ? (
              <p className="py-8 text-center text-sm text-zoru-ink-muted">
                No data yet.
              </p>
            ) : (
              <ZoruChartContainer height={200}>
                <ZoruChart.BarChart
                  data={bundle.countries}
                  margin={{ top: 8, right: 16, bottom: 0, left: -16 }}
                >
                  <ZoruChart.CartesianGrid
                    strokeDasharray="3 3"
                    className="stroke-zoru-line"
                  />
                  <ZoruChart.XAxis
                    dataKey="country"
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                  />
                  <ZoruChart.YAxis
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                  />
                  <ZoruChart.Tooltip content={<ZoruChartTooltip />} />
                  <ZoruChart.Bar
                    dataKey="count"
                    fill={ZORU_CHART_PALETTE[2]}
                    radius={[2, 2, 0, 0]}
                  />
                </ZoruChart.BarChart>
              </ZoruChartContainer>
            )}
          </ZoruCardContent>
        </ZoruCard>

        <ZoruCard>
          <ZoruCardHeader>
            <ZoruCardTitle>Sender rotation</ZoruCardTitle>
            <ZoruCardDescription>
              Share of sends by originating number.
            </ZoruCardDescription>
          </ZoruCardHeader>
          <ZoruCardContent>
            {bundle.senderRotation.length === 0 ? (
              <p className="py-8 text-center text-sm text-zoru-ink-muted">
                No data yet.
              </p>
            ) : (
              <ZoruChartContainer height={200}>
                <ZoruChart.PieChart>
                  <ZoruChart.Pie
                    data={bundle.senderRotation}
                    dataKey="count"
                    nameKey="sender"
                    outerRadius={70}
                    innerRadius={32}
                  >
                    {bundle.senderRotation.map((entry, i) => (
                      <ZoruChart.Cell
                        key={entry.sender}
                        fill={
                          ZORU_CHART_PALETTE[i % ZORU_CHART_PALETTE.length]
                        }
                      />
                    ))}
                  </ZoruChart.Pie>
                  <ZoruChart.Tooltip content={<ZoruChartTooltip />} />
                </ZoruChart.PieChart>
              </ZoruChartContainer>
            )}
          </ZoruCardContent>
        </ZoruCard>

        <ZoruCard>
          <ZoruCardHeader>
            <ZoruCardTitle>Cost & margin</ZoruCardTitle>
            <ZoruCardDescription>
              Wholesale cost vs customer-facing price.
            </ZoruCardDescription>
          </ZoruCardHeader>
          <ZoruCardContent>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="text-zoru-ink-muted">Cost</div>
              <div className="text-right font-medium">
                {formatCents(bundle.costMargin.cost)}
              </div>
              <div className="text-zoru-ink-muted">Price</div>
              <div className="text-right font-medium">
                {formatCents(bundle.costMargin.price)}
              </div>
              <div className="text-zoru-ink-muted">Margin</div>
              <div className="text-right font-medium">
                {formatCents(bundle.costMargin.margin)}
              </div>
              <div className="text-zoru-ink-muted">Margin %</div>
              <div className="text-right font-medium">
                {bundle.costMargin.marginPct}%
              </div>
            </div>
          </ZoruCardContent>
        </ZoruCard>
      </div>

      {/* Reply + opt-out timelines */}
      <div className="grid gap-4 lg:grid-cols-2">
        <ZoruCard>
          <ZoruCardHeader>
            <ZoruCardTitle>Reply timeline</ZoruCardTitle>
            <ZoruCardDescription>
              Inbound messages associated with this campaign.
            </ZoruCardDescription>
          </ZoruCardHeader>
          <ZoruCardContent>
            {bundle.replies.length === 0 ? (
              <p className="py-8 text-center text-sm text-zoru-ink-muted">
                No replies yet.
              </p>
            ) : (
              <ZoruChartContainer height={160}>
                <ZoruChart.AreaChart
                  data={bundle.replies}
                  margin={{ top: 4, right: 12, bottom: 0, left: -20 }}
                >
                  <ZoruChart.CartesianGrid
                    strokeDasharray="3 3"
                    className="stroke-zoru-line"
                  />
                  <ZoruChart.XAxis
                    dataKey="bucket"
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                  />
                  <ZoruChart.YAxis
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                  />
                  <ZoruChart.Tooltip content={<ZoruChartTooltip />} />
                  <ZoruChart.Area
                    dataKey="count"
                    fill={ZORU_CHART_PALETTE[1]}
                    stroke={ZORU_CHART_PALETTE[0]}
                  />
                </ZoruChart.AreaChart>
              </ZoruChartContainer>
            )}
          </ZoruCardContent>
        </ZoruCard>

        <ZoruCard>
          <ZoruCardHeader>
            <ZoruCardTitle>Opt-out timeline</ZoruCardTitle>
            <ZoruCardDescription>
              Workspace-wide opt-out events (per-campaign filter ships
              in Phase 11 once consentLog carries campaignId).
            </ZoruCardDescription>
          </ZoruCardHeader>
          <ZoruCardContent>
            {bundle.optOuts.length === 0 ? (
              <p className="py-8 text-center text-sm text-zoru-ink-muted">
                No opt-outs yet.
              </p>
            ) : (
              <ZoruChartContainer height={160}>
                <ZoruChart.AreaChart
                  data={bundle.optOuts}
                  margin={{ top: 4, right: 12, bottom: 0, left: -20 }}
                >
                  <ZoruChart.CartesianGrid
                    strokeDasharray="3 3"
                    className="stroke-zoru-line"
                  />
                  <ZoruChart.XAxis
                    dataKey="bucket"
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                  />
                  <ZoruChart.YAxis
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                  />
                  <ZoruChart.Tooltip content={<ZoruChartTooltip />} />
                  <ZoruChart.Area
                    dataKey="count"
                    fill={ZORU_CHART_PALETTE[3]}
                    stroke={ZORU_CHART_PALETTE[3]}
                  />
                </ZoruChart.AreaChart>
              </ZoruChartContainer>
            )}
          </ZoruCardContent>
        </ZoruCard>
      </div>

      {/* Click heatmap + A/B comparison */}
      <div className="grid gap-4 lg:grid-cols-2">
        <ZoruCard>
          <ZoruCardHeader>
            <ZoruCardTitle>Click heatmap</ZoruCardTitle>
            <ZoruCardDescription>
              Per short-link clicks + unique contacts.
            </ZoruCardDescription>
          </ZoruCardHeader>
          <ZoruCardContent className="p-0">
            {bundle.clickHeat.length === 0 ? (
              <p className="px-6 py-8 text-center text-sm text-zoru-ink-muted">
                No clicks tracked yet. Wrap a URL with the SabSMS link
                shortener to populate this card.
              </p>
            ) : (
              <ZoruTable>
                <ZoruTableHeader>
                  <ZoruTableRow>
                    <ZoruTableHead>Short link</ZoruTableHead>
                    <ZoruTableHead className="text-right">Clicks</ZoruTableHead>
                    <ZoruTableHead className="text-right">Unique</ZoruTableHead>
                  </ZoruTableRow>
                </ZoruTableHeader>
                <ZoruTableBody>
                  {bundle.clickHeat.map((c) => (
                    <ZoruTableRow key={c.url}>
                      <ZoruTableCell className="font-mono text-xs">
                        {c.url}
                      </ZoruTableCell>
                      <ZoruTableCell className="text-right text-xs">
                        {c.clicks.toLocaleString()}
                      </ZoruTableCell>
                      <ZoruTableCell className="text-right text-xs">
                        {c.uniqueContacts.toLocaleString()}
                      </ZoruTableCell>
                    </ZoruTableRow>
                  ))}
                </ZoruTableBody>
              </ZoruTable>
            )}
          </ZoruCardContent>
        </ZoruCard>

        <ZoruCard>
          <ZoruCardHeader>
            <ZoruCardTitle>A/B variant comparison</ZoruCardTitle>
            <ZoruCardDescription>
              Per-variant sent / delivered counts.
            </ZoruCardDescription>
          </ZoruCardHeader>
          <ZoruCardContent className="p-0">
            {bundle.ab.variants.length === 0 ? (
              <p className="px-6 py-8 text-center text-sm text-zoru-ink-muted">
                Single-variant campaign — no A/B split.
              </p>
            ) : (
              <ZoruTable>
                <ZoruTableHeader>
                  <ZoruTableRow>
                    <ZoruTableHead>Variant</ZoruTableHead>
                    <ZoruTableHead className="text-right">Sent</ZoruTableHead>
                    <ZoruTableHead className="text-right">
                      Delivered
                    </ZoruTableHead>
                    <ZoruTableHead className="text-right">Clicked</ZoruTableHead>
                    <ZoruTableHead className="text-right">Replied</ZoruTableHead>
                  </ZoruTableRow>
                </ZoruTableHeader>
                <ZoruTableBody>
                  {bundle.ab.variants.map((v) => (
                    <ZoruTableRow key={v.label}>
                      <ZoruTableCell className="text-xs">
                        {v.label}
                      </ZoruTableCell>
                      <ZoruTableCell className="text-right text-xs">
                        {v.sent.toLocaleString()}
                      </ZoruTableCell>
                      <ZoruTableCell className="text-right text-xs">
                        {v.delivered.toLocaleString()}
                      </ZoruTableCell>
                      <ZoruTableCell className="text-right text-xs">
                        {v.clicked.toLocaleString()}
                      </ZoruTableCell>
                      <ZoruTableCell className="text-right text-xs">
                        {v.replied.toLocaleString()}
                      </ZoruTableCell>
                    </ZoruTableRow>
                  ))}
                </ZoruTableBody>
              </ZoruTable>
            )}
          </ZoruCardContent>
        </ZoruCard>
      </div>

      {/* Per-recipient drill-down table */}
      <ZoruCard>
        <ZoruCardHeader>
          <ZoruCardTitle>Recipients</ZoruCardTitle>
          <ZoruCardDescription>
            Most recent 200 recipients. Open one in logs for the full
            DLR timeline.
          </ZoruCardDescription>
        </ZoruCardHeader>
        <ZoruCardContent>
          <SabsmsDataTable
            rows={bundle.recipients}
            columns={recipientColumns}
            rowKey={(r) => r.id}
            rowActions={recipientRowActions}
            density="compact"
            emptyTitle="No messages yet"
            emptyDescription="The first send will populate this table within a few seconds."
          />
        </ZoruCardContent>
      </ZoruCard>

      {/* Webhook fire log */}
      <ZoruCard>
        <ZoruCardHeader>
          <ZoruCardTitle>Webhook fires</ZoruCardTitle>
          <ZoruCardDescription>
            Outbound webhook deliveries that referenced this campaign.
          </ZoruCardDescription>
        </ZoruCardHeader>
        <ZoruCardContent className="p-0">
          {bundle.webhookFires.length === 0 ? (
            <p className="px-6 py-8 text-center text-sm text-zoru-ink-muted">
              No webhook deliveries yet for this campaign.
            </p>
          ) : (
            <ZoruTable>
              <ZoruTableHeader>
                <ZoruTableRow>
                  <ZoruTableHead>Event</ZoruTableHead>
                  <ZoruTableHead>Status</ZoruTableHead>
                  <ZoruTableHead className="text-right">Attempts</ZoruTableHead>
                  <ZoruTableHead>Created</ZoruTableHead>
                  <ZoruTableHead>Delivered</ZoruTableHead>
                </ZoruTableRow>
              </ZoruTableHeader>
              <ZoruTableBody>
                {bundle.webhookFires.map((w) => (
                  <ZoruTableRow key={w.id}>
                    <ZoruTableCell className="text-xs">{w.event}</ZoruTableCell>
                    <ZoruTableCell>
                      <ZoruBadge variant={statusVariant(w.status)}>
                        {w.status}
                      </ZoruBadge>
                    </ZoruTableCell>
                    <ZoruTableCell className="text-right text-xs">
                      {w.attempts}
                    </ZoruTableCell>
                    <ZoruTableCell className="text-xs text-zoru-ink-muted">
                      {w.createdAt
                        ? new Date(w.createdAt).toLocaleString()
                        : "—"}
                    </ZoruTableCell>
                    <ZoruTableCell className="text-xs text-zoru-ink-muted">
                      {w.deliveredAt
                        ? new Date(w.deliveredAt).toLocaleString()
                        : "—"}
                    </ZoruTableCell>
                  </ZoruTableRow>
                ))}
              </ZoruTableBody>
            </ZoruTable>
          )}
        </ZoruCardContent>
      </ZoruCard>

      {/* Schedule edit dialog */}
      <ZoruDialog
        open={scheduleDialog !== null}
        onOpenChange={(open) => !open && setScheduleDialog(null)}
      >
        <ZoruDialogContent>
          <ZoruDialogHeader>
            <ZoruDialogTitle>Edit schedule</ZoruDialogTitle>
            <ZoruDialogDescription>
              Available while the campaign is draft / scheduled / paused.
            </ZoruDialogDescription>
          </ZoruDialogHeader>
          <div className="space-y-2">
            <ZoruLabel htmlFor="sabsms-sched">Send at (ISO-8601)</ZoruLabel>
            <ZoruInput
              id="sabsms-sched"
              type="datetime-local"
              value={scheduleDialog ?? ""}
              onChange={(e) => setScheduleDialog(e.target.value)}
              autoFocus
            />
          </div>
          <ZoruDialogFooter>
            <ZoruButton variant="outline" onClick={() => setScheduleDialog(null)}>
              Cancel
            </ZoruButton>
            <ZoruButton
              disabled={!scheduleDialog || busy === "schedule"}
              onClick={() =>
                scheduleDialog &&
                runAction("schedule", async () => {
                  const iso = new Date(scheduleDialog).toISOString();
                  const res = await editSchedule({
                    campaignId: detail.id,
                    sendAtIso: iso,
                  });
                  setScheduleDialog(null);
                  return res;
                })
              }
            >
              Save
            </ZoruButton>
          </ZoruDialogFooter>
        </ZoruDialogContent>
      </ZoruDialog>

      {/* Per-recipient detail drawer */}
      <SabsmsDetailDrawer
        open={!!drawerRow}
        onOpenChange={(open) => !open && setDrawerRow(null)}
        title={drawerRow ? drawerRow.to : "Recipient"}
        description="Per-recipient send details — click open-in-logs for the full DLR trail."
      >
        {drawerRow && (
          <div className="space-y-3 text-sm">
            <div className="flex items-center gap-2">
              <ZoruBadge variant={statusVariant(drawerRow.status)}>
                {drawerRow.status}
              </ZoruBadge>
              <span className="text-zoru-ink-muted">{drawerRow.provider}</span>
            </div>
            <dl className="grid grid-cols-2 gap-2">
              <dt className="text-zoru-ink-muted">Sent</dt>
              <dd>{drawerRow.sentAt ? new Date(drawerRow.sentAt).toLocaleString() : "—"}</dd>
              <dt className="text-zoru-ink-muted">Delivered</dt>
              <dd>
                {drawerRow.deliveredAt
                  ? new Date(drawerRow.deliveredAt).toLocaleString()
                  : "—"}
              </dd>
              <dt className="text-zoru-ink-muted">Segments</dt>
              <dd>{drawerRow.segments ?? "—"}</dd>
              <dt className="text-zoru-ink-muted">Cost</dt>
              <dd>{drawerRow.cost !== undefined ? formatCents(drawerRow.cost) : "—"}</dd>
              {drawerRow.variant && (
                <>
                  <dt className="text-zoru-ink-muted">A/B variant</dt>
                  <dd>{drawerRow.variant}</dd>
                </>
              )}
            </dl>
            {drawerRow.errorMessage && (
              <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
                {drawerRow.errorMessage}
              </div>
            )}
            <ZoruButton variant="outline" asChild>
              <Link
                href={`/sabsms/logs?campaignId=${detail.id}&to=${encodeURIComponent(drawerRow.to)}`}
              >
                <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                Open in logs
              </Link>
            </ZoruButton>
          </div>
        )}
      </SabsmsDetailDrawer>
    </div>
  );
}
