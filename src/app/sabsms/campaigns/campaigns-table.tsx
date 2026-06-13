"use client";

/**
 * SabSMS campaigns — interactive list table.
 *
 * Lives on the client because every row carries quick actions (pause,
 * resume, cancel, duplicate, test send, archive, …) backed by server
 * actions, and because the filter bar + saved views + refresh button
 * are all client-only primitives. The server passes a fully-projected
 * `CampaignRow[]` so this component never touches Mongo directly.
 */

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Activity,
  Archive,
  Copy,
  Layers,
  PauseCircle,
  PlayCircle,
  Send,
  Sigma,
  StopCircle,
  Tag,
  Trash2,
} from "lucide-react";

import { CHART_PALETTE, Badge, Button, Card, CardBody, CardDescription, CardHeader, CardTitle, Recharts, ChartContainer, ChartTooltip, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Input, Label, Progress, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, StatCard } from '@/components/sabcrm/20ui';

import {
  SabsmsDataTable,
  SabsmsExportMenu,
  SabsmsFilterBar,
  SabsmsRefreshButton,
  SabsmsSavedViews,
  rowsToCsv,
  type SabsmsBulkAction,
  type SabsmsColumn,
  type SabsmsFacet,
  type SabsmsRowAction,
} from "@/components/sabsms/page-toolkit";

import {
  archiveCampaign,
  addCampaignTag,
  cancelCampaign,
  compareCampaigns,
  convertCampaignToDrip,
  convertCampaignToTemplate,
  duplicateCampaign,
  launchCampaignAction,
  pauseCampaign,
  resumeCampaign,
  testSendFromCampaign,
  type CampaignComparison,
  type CampaignRow,
  type VolumePoint,
} from "./actions";
import {
  formatCents,
  formatEta,
  rollupCampaigns,
  type CampaignRollup,
} from "./helpers";

interface CampaignsTableProps {
  rows: CampaignRow[];
  total: number;
  chartSeries: VolumePoint[];
  creators: { value: string; label: string }[];
  templates: { value: string; label: string }[];
  rollup: CampaignRollup;
}

const STATUS_OPTIONS: { value: CampaignRow["status"]; label: string }[] = [
  { value: "draft", label: "Draft" },
  { value: "scheduled", label: "Scheduled" },
  { value: "running", label: "Running" },
  { value: "paused", label: "Paused" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
  { value: "failed", label: "Failed" },
];

function statusVariant(
  status: CampaignRow["status"],
): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "running":
    case "completed":
      return "default";
    case "failed":
    case "cancelled":
      return "destructive";
    case "paused":
    case "scheduled":
      return "secondary";
    default:
      return "outline";
  }
}

export function CampaignsTable({
  rows,
  total,
  chartSeries,
  creators,
  templates,
  rollup,
}: CampaignsTableProps) {
  const router = useRouter();
  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);
  const [busy, setBusy] = React.useState<string | null>(null);

  const [tagDialog, setTagDialog] = React.useState<{
    campaignId: string;
    tag: string;
  } | null>(null);
  const [testDialog, setTestDialog] = React.useState<{
    campaignId: string;
    to: string;
  } | null>(null);
  const [comparison, setComparison] = React.useState<CampaignComparison | null>(
    null,
  );
  const [compareError, setCompareError] = React.useState<string | null>(null);

  const refresh = React.useCallback(() => {
    router.refresh();
  }, [router]);

  async function runAction(
    label: string,
    fn: () => Promise<{ ok: boolean; error?: string }>,
  ) {
    setBusy(label);
    try {
      const res = await fn();
      if (!res.ok) {
        // Surfaced via console for now; SonnerToast hookup is a
        // future polish item.
        console.error(`[sabsms] ${label} failed`, res.error);
      }
      refresh();
    } finally {
      setBusy(null);
    }
  }

  async function compareSelected() {
    if (selectedIds.length !== 2) {
      setCompareError("Pick exactly two campaigns to compare.");
      return;
    }
    setCompareError(null);
    setBusy("compare");
    try {
      const res = await compareCampaigns({
        aId: selectedIds[0],
        bId: selectedIds[1],
      });
      if (res.ok) setComparison(res.comparison);
      else setCompareError(res.error);
    } finally {
      setBusy(null);
    }
  }

  const facets: SabsmsFacet[] = [
    {
      key: "status",
      label: "Status",
      multi: true,
      options: STATUS_OPTIONS,
    },
    {
      key: "createdBy",
      label: "Created by",
      multi: true,
      options: creators,
    },
    {
      key: "template",
      label: "Template",
      multi: true,
      options: templates,
    },
  ];

  const columns: SabsmsColumn<CampaignRow>[] = [
    {
      id: "name",
      header: "Name",
      width: "220px",
      render: (row) => (
        <div className="flex flex-col">
          <Link
            href={`/sabsms/campaigns/${row.id}`}
            className="text-sm font-medium text-[var(--st-text)] hover:underline"
          >
            {row.name}
          </Link>
          <span className="text-xs text-[var(--st-text-secondary)]">
            {row.templateName ?? row.templateId}
          </span>
        </div>
      ),
    },
    {
      id: "status",
      header: "Status",
      render: (row) => (
        <Badge variant={statusVariant(row.status)}>{row.status}</Badge>
      ),
    },
    {
      id: "audience",
      header: "Audience",
      align: "right",
      render: (row) => (
        <span className="text-xs">{row.audienceSize.toLocaleString()}</span>
      ),
    },
    {
      id: "velocity",
      header: "Velocity",
      align: "right",
      render: (row) => (
        <span className="text-xs">
          {row.velocity > 0 ? `${row.velocity.toFixed(1)}/s` : "—"}
        </span>
      ),
    },
    {
      id: "progress",
      header: "Progress",
      width: "160px",
      render: (row) => (
        <div className="flex flex-col gap-1">
          <Progress value={row.progressPct} className="h-1.5" />
          <span className="text-[10px] text-[var(--st-text-secondary)]">
            {row.progressPct}% · ETA {formatEta(row.estimatedFinishAt)}
          </span>
        </div>
      ),
    },
    {
      id: "ctr",
      header: "CTR",
      align: "right",
      render: (row) => <span className="text-xs">{row.ctr}%</span>,
    },
    {
      id: "reply",
      header: "Reply",
      align: "right",
      render: (row) => <span className="text-xs">{row.replyRate}%</span>,
    },
    {
      id: "optout",
      header: "Opt-out",
      align: "right",
      render: (row) => <span className="text-xs">{row.optOutRate}%</span>,
    },
    {
      id: "cost",
      header: "Cost",
      align: "right",
      render: (row) => (
        <div className="flex flex-col text-right">
          <span className="text-xs">{formatCents(row.costSoFar)}</span>
          <span className="text-[10px] text-[var(--st-text-secondary)]">
            of {formatCents(row.costForecast)}
          </span>
        </div>
      ),
    },
    {
      id: "tags",
      header: "Tags",
      render: (row) =>
        row.tags.length === 0 ? (
          <span className="text-xs text-[var(--st-text-secondary)]">—</span>
        ) : (
          <div className="flex flex-wrap gap-1">
            {row.tags.slice(0, 3).map((t) => (
              <Badge key={t} variant="outline" className="text-[10px]">
                {t}
              </Badge>
            ))}
          </div>
        ),
    },
    {
      id: "liveTail",
      header: "Live tail",
      render: (row) =>
        row.status === "running" ? (
          // TODO: replace this placeholder with a real SSE channel — the
          // Rust engine will expose `/v1/campaigns/:id/events` once
          // Phase 11 lands; until then the badge just hints that the
          // tail-stream is wired but not yet plumbed through.
          <Badge variant="secondary" className="gap-1">
            <Activity className="h-3 w-3" />
            tail
          </Badge>
        ) : (
          <span className="text-xs text-[var(--st-text-secondary)]">—</span>
        ),
    },
    {
      id: "createdAt",
      header: "Created",
      render: (row) => (
        <span className="text-xs text-[var(--st-text-secondary)]">
          {new Date(row.createdAt).toLocaleDateString()}
        </span>
      ),
    },
  ];

  const rowActions: SabsmsRowAction<CampaignRow>[] = [
    {
      label: "Launch",
      icon: <PlayCircle className="h-3.5 w-3.5" />,
      onSelect: (row) =>
        runAction("launch", () =>
          launchCampaignAction({ campaignId: row.id }),
        ),
    },
    {
      label: "Pause",
      icon: <PauseCircle className="h-3.5 w-3.5" />,
      onSelect: (row) =>
        runAction("pause", () => pauseCampaign({ campaignId: row.id })),
    },
    {
      label: "Resume",
      icon: <PlayCircle className="h-3.5 w-3.5" />,
      onSelect: (row) =>
        runAction("resume", () => resumeCampaign({ campaignId: row.id })),
    },
    {
      label: "Cancel",
      icon: <StopCircle className="h-3.5 w-3.5" />,
      destructive: true,
      onSelect: (row) =>
        runAction("cancel", () => cancelCampaign({ campaignId: row.id })),
    },
    {
      label: "Duplicate",
      icon: <Copy className="h-3.5 w-3.5" />,
      onSelect: (row) =>
        runAction("duplicate", () => duplicateCampaign({ campaignId: row.id })),
    },
    {
      label: "Test send",
      icon: <Send className="h-3.5 w-3.5" />,
      onSelect: (row) => setTestDialog({ campaignId: row.id, to: "" }),
    },
    {
      label: "Convert to drip",
      icon: <Layers className="h-3.5 w-3.5" />,
      onSelect: (row) =>
        runAction("convert-drip", () =>
          convertCampaignToDrip({ campaignId: row.id }),
        ),
    },
    {
      label: "Convert to template",
      icon: <Sigma className="h-3.5 w-3.5" />,
      onSelect: (row) =>
        runAction("convert-template", () =>
          convertCampaignToTemplate({ campaignId: row.id }),
        ),
    },
    {
      label: "Add tag",
      icon: <Tag className="h-3.5 w-3.5" />,
      onSelect: (row) => setTagDialog({ campaignId: row.id, tag: "" }),
    },
    {
      label: "Archive",
      icon: <Archive className="h-3.5 w-3.5" />,
      destructive: true,
      onSelect: (row) =>
        runAction("archive", () => archiveCampaign({ campaignId: row.id })),
    },
  ];

  const bulkActions: SabsmsBulkAction<CampaignRow>[] = [
    {
      label: "Pause all",
      icon: <PauseCircle className="h-3.5 w-3.5" />,
      onSelect: async (rs) => {
        for (const r of rs) await pauseCampaign({ campaignId: r.id });
        refresh();
      },
    },
    {
      label: "Resume all",
      icon: <PlayCircle className="h-3.5 w-3.5" />,
      onSelect: async (rs) => {
        for (const r of rs) await resumeCampaign({ campaignId: r.id });
        refresh();
      },
    },
    {
      label: "Compare two",
      icon: <Sigma className="h-3.5 w-3.5" />,
      onSelect: () => compareSelected(),
    },
    {
      label: "Archive all",
      icon: <Trash2 className="h-3.5 w-3.5" />,
      destructive: true,
      onSelect: async (rs) => {
        for (const r of rs) await archiveCampaign({ campaignId: r.id });
        refresh();
      },
    },
  ];

  const csvRows = rows.map((r) => ({
    id: r.id,
    name: r.name,
    status: r.status,
    audience: r.audienceSize,
    sent: r.stats.sent + r.stats.delivered + r.stats.failed,
    delivered: r.stats.delivered,
    failed: r.stats.failed,
    ctr: r.ctr,
    replyRate: r.replyRate,
    optOutRate: r.optOutRate,
    cost: r.costSoFar,
    createdAt: r.createdAt,
  }));

  async function exportCsv() {
    return rowsToCsv(csvRows, [
      { key: "id", header: "id" },
      { key: "name", header: "name" },
      { key: "status", header: "status" },
      { key: "audience", header: "audience" },
      { key: "sent", header: "sent" },
      { key: "delivered", header: "delivered" },
      { key: "failed", header: "failed" },
      { key: "ctr", header: "ctr" },
      { key: "replyRate", header: "replyRate" },
      { key: "optOutRate", header: "optOutRate" },
      { key: "cost", header: "cost_cents" },
      { key: "createdAt", header: "createdAt" },
    ]);
  }

  async function exportJsonl() {
    return rows.map((r) => JSON.stringify(r)).join("\n");
  }

  return (
    <div className="space-y-4">
      {/* Roll-up totals card row — feature §B.2 #19 */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Campaigns" value={rollup.total.toLocaleString()} />
        <StatCard label="Running" value={rollup.running.toLocaleString()} />
        <StatCard
          label="Scheduled"
          value={rollup.scheduled.toLocaleString()}
        />
        <StatCard
          label="Completed"
          value={rollup.completed.toLocaleString()}
        />
        <StatCard
          label="Audience"
          value={rollup.audience.toLocaleString()}
        />
        <StatCard
          label="Delivered"
          value={rollup.delivered.toLocaleString()}
        />
      </div>

      {/* Inline filter chart — feature §B.2 #20 */}
      {chartSeries.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Created over time</CardTitle>
            <CardDescription>
              Campaigns created per day in the current filter window
              (max 30 buckets).
            </CardDescription>
          </CardHeader>
          <CardBody>
            <ChartContainer config={{ count: { label: "Campaigns", color: CHART_PALETTE[0] } }} style={{ height: 140 }}>
              <Recharts.BarChart
                data={chartSeries}
                margin={{ top: 4, right: 12, bottom: 0, left: -20 }}
              >
                <Recharts.CartesianGrid
                  strokeDasharray="3 3"
                  className="stroke-[var(--st-border)]"
                />
                <Recharts.XAxis
                  dataKey="date"
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
                <Recharts.Bar
                  dataKey="count"
                  fill={CHART_PALETTE[0]}
                  radius={[2, 2, 0, 0]}
                />
              </Recharts.BarChart>
            </ChartContainer>
          </CardBody>
        </Card>
      )}

      <SabsmsFilterBar
        searchPlaceholder="Search campaigns by name…"
        facets={facets}
        dateRangeKey={{ from: "from", to: "to" }}
        sortOptions={[
          { value: "newest", label: "Newest first" },
          { value: "oldest", label: "Oldest first" },
          { value: "name_asc", label: "Name A→Z" },
          { value: "name_desc", label: "Name Z→A" },
          { value: "audience_desc", label: "Largest audience" },
          { value: "velocity_desc", label: "Highest velocity" },
        ]}
        defaultSort="newest"
        trailing={
          <>
            <SabsmsSavedViews scope="campaigns" />
            <SabsmsRefreshButton onRefresh={refresh} defaultInterval={30} />
            <SabsmsExportMenu
              toCsv={exportCsv}
              toJson={exportJsonl}
              filename="sabsms-campaigns"
            />
          </>
        }
      />

      {compareError && (
        <div className="rounded-md border border-[var(--st-border)] bg-[var(--st-bg-muted)] px-3 py-2 text-sm text-[var(--st-text)]">
          {compareError}
        </div>
      )}

      <SabsmsDataTable
        rows={rows}
        total={total}
        columns={columns}
        rowKey={(r) => r.id}
        selectable
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
        bulkActions={bulkActions}
        rowActions={rowActions}
        emptyTitle="No campaigns yet"
        emptyDescription="Launch your first campaign to see send velocity, delivery, and CTR here."
        emptyAction={{ label: "New campaign", href: "/sabsms/campaigns/new" }}
      />

      {/* Compare result — inline card driven by the bulk action */}
      {comparison && (
        <Card>
          <CardHeader>
            <CardTitle>Compare</CardTitle>
            <CardDescription>
              {comparison.a.name} <span className="text-[var(--st-text-secondary)]">vs</span>{" "}
              {comparison.b.name}
            </CardDescription>
          </CardHeader>
          <CardBody>
            <div className="grid grid-cols-3 gap-2 text-sm">
              <div className="text-xs font-medium text-[var(--st-text-tertiary)]">Metric</div>
              <div className="text-xs font-medium text-[var(--st-text-tertiary)] text-right">A</div>
              <div className="text-xs font-medium text-[var(--st-text-tertiary)] text-right">B</div>
              {comparison.stats.map((s) => (
                <React.Fragment key={s.metric}>
                  <div>{s.metric}</div>
                  <div className="text-right">{s.a.toLocaleString()}</div>
                  <div className="text-right">{s.b.toLocaleString()}</div>
                </React.Fragment>
              ))}
            </div>
            <div className="mt-3 flex justify-end">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setComparison(null)}
              >
                Close
              </Button>
            </div>
          </CardBody>
        </Card>
      )}

      {/* Tag dialog — feature §B.2 #18 */}
      <Dialog
        open={!!tagDialog}
        onOpenChange={(open) => !open && setTagDialog(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add tag</DialogTitle>
            <DialogDescription>
              Tags help group related campaigns in saved views.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="sabsms-tag">Tag</Label>
            <Input
              id="sabsms-tag"
              value={tagDialog?.tag ?? ""}
              onChange={(e) =>
                setTagDialog((d) => (d ? { ...d, tag: e.target.value } : d))
              }
              placeholder="q1-promo"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTagDialog(null)}>
              Cancel
            </Button>
            <Button
              disabled={!tagDialog?.tag.trim() || busy === "tag"}
              onClick={() =>
                tagDialog &&
                runAction("tag", async () => {
                  const res = await addCampaignTag({
                    campaignId: tagDialog.campaignId,
                    tag: tagDialog.tag,
                  });
                  setTagDialog(null);
                  return res;
                })
              }
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Test send dialog — feature §B.2 #14 */}
      <Dialog
        open={!!testDialog}
        onOpenChange={(open) => !open && setTestDialog(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Test send</DialogTitle>
            <DialogDescription>
              Sends one message via the campaign&apos;s template to the
              number you pick — bypassing the audience.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="sabsms-test-to">Recipient (E.164)</Label>
            <Input
              id="sabsms-test-to"
              value={testDialog?.to ?? ""}
              onChange={(e) =>
                setTestDialog((d) => (d ? { ...d, to: e.target.value } : d))
              }
              placeholder="+15550001234"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTestDialog(null)}>
              Cancel
            </Button>
            <Button
              disabled={!testDialog?.to.trim() || busy === "test-send"}
              onClick={() =>
                testDialog &&
                runAction("test-send", async () => {
                  const res = await testSendFromCampaign({
                    campaignId: testDialog.campaignId,
                    to: testDialog.to,
                  });
                  setTestDialog(null);
                  return res;
                })
              }
            >
              Send
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/**
 * Public wrapper used by the page-level server component. Kept thin so
 * the page can pre-compute the rollup once on the server.
 */
export function CampaignsTableWithRollup(props: Omit<CampaignsTableProps, "rollup">) {
  const rollup = React.useMemo(() => rollupCampaigns(props.rows), [props.rows]);
  return <CampaignsTable {...props} rollup={rollup} />;
}

