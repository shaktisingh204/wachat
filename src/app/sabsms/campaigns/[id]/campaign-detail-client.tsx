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

import { CHART_PALETTE, Badge, Button, Card, CardBody, CardDescription, CardHeader, CardTitle, Recharts, ChartContainer, ChartTooltip, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Input, Label, Progress, Table, TBody, Td, Th, THead, Tr } from '@/components/sabcrm/20ui';

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
      <Card>
        <CardHeader>
          <CardTitle>Campaign not found</CardTitle>
          <CardDescription>
            It may have been archived or moved to a different workspace.
          </CardDescription>
        </CardHeader>
        <CardBody>
          <Button variant="outline" asChild>
            <Link href="/sabsms/campaigns">Back to campaigns</Link>
          </Button>
        </CardBody>
      </Card>
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
        <Badge variant={statusVariant(r.status)}>{r.status}</Badge>
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
        <span className="text-xs text-[var(--st-text-secondary)]">
          {r.sentAt ? new Date(r.sentAt).toLocaleString() : "—"}
        </span>
      ),
    },
    {
      id: "deliveredAt",
      header: "Delivered at",
      render: (r) => (
        <span className="text-xs text-[var(--st-text-secondary)]">
          {r.deliveredAt ? new Date(r.deliveredAt).toLocaleString() : "—"}
        </span>
      ),
    },
    {
      id: "error",
      header: "Error",
      render: (r) =>
        r.errorMessage ? (
          <span className="text-xs text-[var(--st-text)]" title={r.errorMessage}>
            {r.errorMessage.slice(0, 32)}
          </span>
        ) : (
          <span className="text-xs text-[var(--st-text-secondary)]">—</span>
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
      <Card>
        <CardBody className="flex flex-col gap-3 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <Badge variant={statusVariant(detail.status)}>
                {detail.status}
              </Badge>
              <span className="text-sm text-[var(--st-text-secondary)]">
                {detail.scheduleKind} · {detail.senderStrategy}
              </span>
              {detail.abVariant && (
                <Badge variant="outline">A/B {detail.abVariant}</Badge>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {liveBadges.map((b) => (
                <span
                  key={b.label}
                  className="flex items-center gap-1 text-sm"
                >
                  <Badge variant={statusVariant(b.label)}>
                    {b.label}
                  </Badge>
                  <span className="font-medium text-[var(--st-text)]">
                    {b.count.toLocaleString()}
                  </span>
                </span>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <Progress value={progress} className="h-1.5 w-48" />
              <span className="text-xs text-[var(--st-text-secondary)]">
                {progress}% of {detail.audienceSize.toLocaleString()}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <SabsmsRefreshButton onRefresh={refresh} defaultInterval={30} />
            <Button
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
            </Button>
            <Button
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
            </Button>
            <Button
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
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!canEditSchedule}
              onClick={() => setScheduleDialog("")}
            >
              Edit schedule
            </Button>
            <Button
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
            </Button>
            <Button
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
            </Button>
            <Button
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
            </Button>
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
            <Button
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
            </Button>
          </div>
        </CardBody>
      </Card>

      {shareUrl && (
        <div className="rounded-md border border-[var(--st-border)] bg-[var(--st-bg-muted)] px-3 py-2 text-sm">
          Public share link minted —{" "}
          <code className="rounded bg-white px-1 text-xs">{shareUrl}</code>{" "}
          (TODO: <code>/sabsms/share/[token]</code> read-side route)
        </div>
      )}

      {/* Timeline chart — per-minute send velocity */}
      <Card>
        <CardHeader>
          <CardTitle>Send velocity</CardTitle>
          <CardDescription>
            Per-minute sent / delivered / failed counts (max 200 buckets).
          </CardDescription>
        </CardHeader>
        <CardBody>
          {bundle.timeline.length === 0 ? (
            <p className="py-8 text-center text-sm text-[var(--st-text-secondary)]">
              No send events yet.
            </p>
          ) : (
            <ChartContainer
              config={{
                sent: { label: "Sent", color: CHART_PALETTE[0] },
                delivered: { label: "Delivered", color: CHART_PALETTE[1] },
                failed: { label: "Failed", color: CHART_PALETTE[3] },
              }}
              style={{ height: 240 }}
            >
              <Recharts.LineChart
                data={bundle.timeline}
                margin={{ top: 8, right: 16, bottom: 0, left: -16 }}
              >
                <Recharts.CartesianGrid
                  strokeDasharray="3 3"
                  className="stroke-[var(--st-border)]"
                />
                <Recharts.XAxis
                  dataKey="bucket"
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                />
                <Recharts.YAxis fontSize={10} tickLine={false} axisLine={false} />
                <Recharts.Tooltip content={<ChartTooltip />} />
                <Recharts.Legend wrapperStyle={{ fontSize: 12 }} />
                <Recharts.Line
                  type="monotone"
                  dataKey="sent"
                  stroke={CHART_PALETTE[0]}
                  strokeWidth={2}
                  dot={false}
                  name="Sent"
                />
                <Recharts.Line
                  type="monotone"
                  dataKey="delivered"
                  stroke={CHART_PALETTE[1]}
                  strokeWidth={2}
                  strokeDasharray="4 3"
                  dot={false}
                  name="Delivered"
                />
                <Recharts.Line
                  type="monotone"
                  dataKey="failed"
                  stroke={CHART_PALETTE[3]}
                  strokeWidth={2}
                  strokeDasharray="2 3"
                  dot={false}
                  name="Failed"
                />
              </Recharts.LineChart>
            </ChartContainer>
          )}
        </CardBody>
      </Card>

      {/* Two-up: funnel + provider breakdown */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Funnel</CardTitle>
            <CardDescription>
              Queued → sent → delivered → clicked → converted.
            </CardDescription>
          </CardHeader>
          <CardBody>
            <ChartContainer
              config={{ count: { label: "Count", color: CHART_PALETTE[0] } }}
              style={{ height: 220 }}
            >
              <Recharts.BarChart
                data={bundle.funnel}
                layout="vertical"
                margin={{ top: 8, right: 16, bottom: 0, left: 16 }}
              >
                <Recharts.CartesianGrid
                  strokeDasharray="3 3"
                  className="stroke-[var(--st-border)]"
                />
                <Recharts.XAxis type="number" fontSize={10} hide />
                <Recharts.YAxis
                  type="category"
                  dataKey="label"
                  fontSize={10}
                  width={80}
                  tickLine={false}
                  axisLine={false}
                />
                <Recharts.Tooltip content={<ChartTooltip />} />
                <Recharts.Bar
                  dataKey="count"
                  fill={CHART_PALETTE[0]}
                  radius={[0, 4, 4, 0]}
                />
              </Recharts.BarChart>
            </ChartContainer>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Providers</CardTitle>
            <CardDescription>
              Volume split by carrier provider.
            </CardDescription>
          </CardHeader>
          <CardBody>
            {bundle.providers.length === 0 ? (
              <p className="py-8 text-center text-sm text-[var(--st-text-secondary)]">
                No data yet.
              </p>
            ) : (
              <ChartContainer
                config={{ count: { label: "Volume", color: CHART_PALETTE[1] } }}
                style={{ height: 220 }}
              >
                <Recharts.BarChart
                  data={bundle.providers}
                  margin={{ top: 8, right: 16, bottom: 0, left: -16 }}
                >
                  <Recharts.CartesianGrid
                    strokeDasharray="3 3"
                    className="stroke-[var(--st-border)]"
                  />
                  <Recharts.XAxis
                    dataKey="provider"
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Recharts.YAxis
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Recharts.Tooltip content={<ChartTooltip />} />
                  <Recharts.Bar
                    dataKey="count"
                    fill={CHART_PALETTE[1]}
                    radius={[2, 2, 0, 0]}
                  />
                </Recharts.BarChart>
              </ChartContainer>
            )}
          </CardBody>
        </Card>
      </div>

      {/* Three-up: countries + sender rotation pie + cost/margin */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>By country</CardTitle>
            <CardDescription>Top destinations.</CardDescription>
          </CardHeader>
          <CardBody>
            {bundle.countries.length === 0 ? (
              <p className="py-8 text-center text-sm text-[var(--st-text-secondary)]">
                No data yet.
              </p>
            ) : (
              <ChartContainer
                config={{ count: { label: "Count", color: CHART_PALETTE[2] } }}
                style={{ height: 200 }}
              >
                <Recharts.BarChart
                  data={bundle.countries}
                  margin={{ top: 8, right: 16, bottom: 0, left: -16 }}
                >
                  <Recharts.CartesianGrid
                    strokeDasharray="3 3"
                    className="stroke-[var(--st-border)]"
                  />
                  <Recharts.XAxis
                    dataKey="country"
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Recharts.YAxis
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Recharts.Tooltip content={<ChartTooltip />} />
                  <Recharts.Bar
                    dataKey="count"
                    fill={CHART_PALETTE[2]}
                    radius={[2, 2, 0, 0]}
                  />
                </Recharts.BarChart>
              </ChartContainer>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Sender rotation</CardTitle>
            <CardDescription>
              Share of sends by originating number.
            </CardDescription>
          </CardHeader>
          <CardBody>
            {bundle.senderRotation.length === 0 ? (
              <p className="py-8 text-center text-sm text-[var(--st-text-secondary)]">
                No data yet.
              </p>
            ) : (
              <ChartContainer
                config={{ count: { label: "Sends" } }}
                style={{ height: 200 }}
              >
                <Recharts.PieChart>
                  <Recharts.Pie
                    data={bundle.senderRotation}
                    dataKey="count"
                    nameKey="sender"
                    outerRadius={70}
                    innerRadius={32}
                  >
                    {bundle.senderRotation.map((entry, i) => (
                      <Recharts.Cell
                        key={entry.sender}
                        fill={
                          CHART_PALETTE[i % CHART_PALETTE.length]
                        }
                      />
                    ))}
                  </Recharts.Pie>
                  <Recharts.Tooltip content={<ChartTooltip />} />
                </Recharts.PieChart>
              </ChartContainer>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Cost & margin</CardTitle>
            <CardDescription>
              Wholesale cost vs customer-facing price.
            </CardDescription>
          </CardHeader>
          <CardBody>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="text-[var(--st-text-secondary)]">Cost</div>
              <div className="text-right font-medium">
                {formatCents(bundle.costMargin.cost)}
              </div>
              <div className="text-[var(--st-text-secondary)]">Price</div>
              <div className="text-right font-medium">
                {formatCents(bundle.costMargin.price)}
              </div>
              <div className="text-[var(--st-text-secondary)]">Margin</div>
              <div className="text-right font-medium">
                {formatCents(bundle.costMargin.margin)}
              </div>
              <div className="text-[var(--st-text-secondary)]">Margin %</div>
              <div className="text-right font-medium">
                {bundle.costMargin.marginPct}%
              </div>
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Reply + opt-out timelines */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Reply timeline</CardTitle>
            <CardDescription>
              Inbound messages associated with this campaign.
            </CardDescription>
          </CardHeader>
          <CardBody>
            {bundle.replies.length === 0 ? (
              <p className="py-8 text-center text-sm text-[var(--st-text-secondary)]">
                No replies yet.
              </p>
            ) : (
              <ChartContainer
                config={{ count: { label: "Replies", color: CHART_PALETTE[0] } }}
                style={{ height: 160 }}
              >
                <Recharts.AreaChart
                  data={bundle.replies}
                  margin={{ top: 4, right: 12, bottom: 0, left: -20 }}
                >
                  <Recharts.CartesianGrid
                    strokeDasharray="3 3"
                    className="stroke-[var(--st-border)]"
                  />
                  <Recharts.XAxis
                    dataKey="bucket"
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Recharts.YAxis
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                  />
                  <Recharts.Tooltip content={<ChartTooltip />} />
                  <Recharts.Area
                    dataKey="count"
                    fill={CHART_PALETTE[1]}
                    stroke={CHART_PALETTE[0]}
                  />
                </Recharts.AreaChart>
              </ChartContainer>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Opt-out timeline</CardTitle>
            <CardDescription>
              Workspace-wide opt-out events (per-campaign filter ships
              in Phase 11 once consentLog carries campaignId).
            </CardDescription>
          </CardHeader>
          <CardBody>
            {bundle.optOuts.length === 0 ? (
              <p className="py-8 text-center text-sm text-[var(--st-text-secondary)]">
                No opt-outs yet.
              </p>
            ) : (
              <ChartContainer
                config={{ count: { label: "Opt-outs", color: CHART_PALETTE[3] } }}
                style={{ height: 160 }}
              >
                <Recharts.AreaChart
                  data={bundle.optOuts}
                  margin={{ top: 4, right: 12, bottom: 0, left: -20 }}
                >
                  <Recharts.CartesianGrid
                    strokeDasharray="3 3"
                    className="stroke-[var(--st-border)]"
                  />
                  <Recharts.XAxis
                    dataKey="bucket"
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Recharts.YAxis
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                  />
                  <Recharts.Tooltip content={<ChartTooltip />} />
                  <Recharts.Area
                    dataKey="count"
                    fill={CHART_PALETTE[3]}
                    stroke={CHART_PALETTE[3]}
                  />
                </Recharts.AreaChart>
              </ChartContainer>
            )}
          </CardBody>
        </Card>
      </div>

      {/* Click heatmap + A/B comparison */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Click heatmap</CardTitle>
            <CardDescription>
              Per short-link clicks + unique contacts.
            </CardDescription>
          </CardHeader>
          <CardBody className="p-0">
            {bundle.clickHeat.length === 0 ? (
              <p className="px-6 py-8 text-center text-sm text-[var(--st-text-secondary)]">
                No clicks tracked yet. Wrap a URL with the SabSMS link
                shortener to populate this card.
              </p>
            ) : (
              <Table>
                <THead>
                  <Tr>
                    <Th>Short link</Th>
                    <Th className="text-right">Clicks</Th>
                    <Th className="text-right">Unique</Th>
                  </Tr>
                </THead>
                <TBody>
                  {bundle.clickHeat.map((c) => (
                    <Tr key={c.url}>
                      <Td className="font-mono text-xs">
                        {c.url}
                      </Td>
                      <Td className="text-right text-xs">
                        {c.clicks.toLocaleString()}
                      </Td>
                      <Td className="text-right text-xs">
                        {c.uniqueContacts.toLocaleString()}
                      </Td>
                    </Tr>
                  ))}
                </TBody>
              </Table>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>A/B variant comparison</CardTitle>
            <CardDescription>
              Per-variant sent / delivered counts.
            </CardDescription>
          </CardHeader>
          <CardBody className="p-0">
            {bundle.ab.variants.length === 0 ? (
              <p className="px-6 py-8 text-center text-sm text-[var(--st-text-secondary)]">
                Single-variant campaign — no A/B split.
              </p>
            ) : (
              <Table>
                <THead>
                  <Tr>
                    <Th>Variant</Th>
                    <Th className="text-right">Sent</Th>
                    <Th className="text-right">
                      Delivered
                    </Th>
                    <Th className="text-right">Clicked</Th>
                    <Th className="text-right">Replied</Th>
                  </Tr>
                </THead>
                <TBody>
                  {bundle.ab.variants.map((v) => (
                    <Tr key={v.label}>
                      <Td className="text-xs">
                        {v.label}
                      </Td>
                      <Td className="text-right text-xs">
                        {v.sent.toLocaleString()}
                      </Td>
                      <Td className="text-right text-xs">
                        {v.delivered.toLocaleString()}
                      </Td>
                      <Td className="text-right text-xs">
                        {v.clicked.toLocaleString()}
                      </Td>
                      <Td className="text-right text-xs">
                        {v.replied.toLocaleString()}
                      </Td>
                    </Tr>
                  ))}
                </TBody>
              </Table>
            )}
          </CardBody>
        </Card>
      </div>

      {/* Per-recipient drill-down table */}
      <Card>
        <CardHeader>
          <CardTitle>Recipients</CardTitle>
          <CardDescription>
            Most recent 200 recipients. Open one in logs for the full
            DLR timeline.
          </CardDescription>
        </CardHeader>
        <CardBody>
          <SabsmsDataTable
            rows={bundle.recipients}
            columns={recipientColumns}
            rowKey={(r) => r.id}
            rowActions={recipientRowActions}
            density="compact"
            emptyTitle="No messages yet"
            emptyDescription="The first send will populate this table within a few seconds."
          />
        </CardBody>
      </Card>

      {/* Webhook fire log */}
      <Card>
        <CardHeader>
          <CardTitle>Webhook fires</CardTitle>
          <CardDescription>
            Outbound webhook deliveries that referenced this campaign.
          </CardDescription>
        </CardHeader>
        <CardBody className="p-0">
          {bundle.webhookFires.length === 0 ? (
            <p className="px-6 py-8 text-center text-sm text-[var(--st-text-secondary)]">
              No webhook deliveries yet for this campaign.
            </p>
          ) : (
            <Table>
              <THead>
                <Tr>
                  <Th>Event</Th>
                  <Th>Status</Th>
                  <Th className="text-right">Attempts</Th>
                  <Th>Created</Th>
                  <Th>Delivered</Th>
                </Tr>
              </THead>
              <TBody>
                {bundle.webhookFires.map((w) => (
                  <Tr key={w.id}>
                    <Td className="text-xs">{w.event}</Td>
                    <Td>
                      <Badge variant={statusVariant(w.status)}>
                        {w.status}
                      </Badge>
                    </Td>
                    <Td className="text-right text-xs">
                      {w.attempts}
                    </Td>
                    <Td className="text-xs text-[var(--st-text-secondary)]">
                      {w.createdAt
                        ? new Date(w.createdAt).toLocaleString()
                        : "—"}
                    </Td>
                    <Td className="text-xs text-[var(--st-text-secondary)]">
                      {w.deliveredAt
                        ? new Date(w.deliveredAt).toLocaleString()
                        : "—"}
                    </Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
          )}
        </CardBody>
      </Card>

      {/* Schedule edit dialog */}
      <Dialog
        open={scheduleDialog !== null}
        onOpenChange={(open) => !open && setScheduleDialog(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit schedule</DialogTitle>
            <DialogDescription>
              Available while the campaign is draft / scheduled / paused.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="sabsms-sched">Send at (ISO-8601)</Label>
            <Input
              id="sabsms-sched"
              type="datetime-local"
              value={scheduleDialog ?? ""}
              onChange={(e) => setScheduleDialog(e.target.value)}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setScheduleDialog(null)}>
              Cancel
            </Button>
            <Button
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
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
              <Badge variant={statusVariant(drawerRow.status)}>
                {drawerRow.status}
              </Badge>
              <span className="text-[var(--st-text-secondary)]">{drawerRow.provider}</span>
            </div>
            <dl className="grid grid-cols-2 gap-2">
              <dt className="text-[var(--st-text-secondary)]">Sent</dt>
              <dd>{drawerRow.sentAt ? new Date(drawerRow.sentAt).toLocaleString() : "—"}</dd>
              <dt className="text-[var(--st-text-secondary)]">Delivered</dt>
              <dd>
                {drawerRow.deliveredAt
                  ? new Date(drawerRow.deliveredAt).toLocaleString()
                  : "—"}
              </dd>
              <dt className="text-[var(--st-text-secondary)]">Segments</dt>
              <dd>{drawerRow.segments ?? "—"}</dd>
              <dt className="text-[var(--st-text-secondary)]">Cost</dt>
              <dd>{drawerRow.cost !== undefined ? formatCents(drawerRow.cost) : "—"}</dd>
              {drawerRow.variant && (
                <>
                  <dt className="text-[var(--st-text-secondary)]">A/B variant</dt>
                  <dd>{drawerRow.variant}</dd>
                </>
              )}
            </dl>
            {drawerRow.errorMessage && (
              <div className="rounded-md border border-[var(--st-border)] bg-[var(--st-bg-muted)] px-3 py-2 text-xs text-[var(--st-text)]">
                {drawerRow.errorMessage}
              </div>
            )}
            <Button variant="outline" asChild>
              <Link
                href={`/sabsms/logs?campaignId=${detail.id}&to=${encodeURIComponent(drawerRow.to)}`}
              >
                <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                Open in logs
              </Link>
            </Button>
          </div>
        )}
      </SabsmsDetailDrawer>
    </div>
  );
}
