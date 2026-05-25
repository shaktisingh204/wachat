"use client";

/**
 * SabSMS — number detail right pane (page 26).
 *
 * Composes the 20 page-unique features for the number-detail screen:
 * health/volume/cost charts, send + inbound history tables, per-country
 * + per-template aggregators, override forms, release + port-out
 * actions, audit drawer, and a mini composer to send from this number.
 *
 * Server actions live in `./actions.ts`; pure aggregators in
 * `./helpers.ts`. This component is "use client" because the charts
 * and the various toggles need state, but every mutation round-trips
 * through `"use server"`.
 */

import * as React from "react";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowUpRight,
  History,
  Loader2,
  PhoneOff,
  Send,
  ShieldCheck,
  Webhook,
} from "lucide-react";

import {
  ZORU_CHART_PALETTE,
  Alert,
  ZoruAlertDescription,
  ZoruAlertDialog,
  ZoruAlertDialogAction,
  ZoruAlertDialogCancel,
  ZoruAlertDialogContent,
  ZoruAlertDialogDescription,
  ZoruAlertDialogFooter,
  ZoruAlertDialogHeader,
  ZoruAlertDialogTitle,
  ZoruAlertTitle,
  Badge,
  Button,
  Card,
  ZoruCardContent,
  ZoruCardDescription,
  ZoruCardHeader,
  ZoruCardTitle,
  Checkbox,
  ZoruChart,
  ZoruChartContainer,
  ZoruChartTooltip,
  Input,
  Label,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  Separator,
  Textarea,
  useZoruToast,
} from "@/components/zoruui";

import {
  SabsmsDataTable,
  SabsmsDetailDrawer,
  SabsmsExportMenu,
  SabsmsFilterBar,
  SabsmsKbdHint,
  SabsmsRefreshButton,
  rowsToCsv,
  type SabsmsColumn,
  type SabsmsFacet,
} from "@/components/sabsms/page-toolkit";

import {
  releaseNumber,
  requestPortOut,
  saveNumberOverrides,
  testSendFromNumber,
  type NumberDetailView,
} from "./actions";
import type {
  NumberWebhooks,
  QuietHoursConfig,
  SendHistoryRow,
  ThrottleConfig,
} from "./helpers";

interface Props {
  detail: NumberDetailView;
}

export function NumberDetailClient({ detail }: Props) {
  const { toast } = useZoruToast();
  const router = useRouter();

  // ─── Override form state ────────────────────────────────────────────────
  const [throttle, setThrottle] = React.useState<ThrottleConfig>(detail.throttle);
  const [quietHours, setQuietHours] = React.useState<QuietHoursConfig>(
    detail.quietHours,
  );
  const [webhooks, setWebhooks] = React.useState<NumberWebhooks>(detail.webhooks);
  const [senderIdAlpha, setSenderIdAlpha] = React.useState(
    detail.senderIdAlpha ?? "",
  );
  const [poolId, setPoolId] = React.useState(detail.poolId ?? "default");
  const [savePending, startSave] = useTransition();

  // ─── Action state ───────────────────────────────────────────────────────
  const [releaseOpen, setReleaseOpen] = React.useState(false);
  const [portOutOpen, setPortOutOpen] = React.useState(false);
  const [auditOpen, setAuditOpen] = React.useState(false);
  const [graceHours, setGraceHours] = React.useState(48);
  const [portTarget, setPortTarget] = React.useState({
    newCarrier: "",
    contactEmail: "",
  });
  const [actionPending, startAction] = useTransition();

  // ─── Mini composer state ────────────────────────────────────────────────
  const [composerTo, setComposerTo] = React.useState("");
  const [composerBody, setComposerBody] = React.useState(
    "This is a test send from your SabSMS number.",
  );
  const [composerPending, startComposer] = useTransition();

  function persistOverrides() {
    startSave(async () => {
      const res = await saveNumberOverrides({
        numberId: detail.id,
        throttle,
        quietHours,
        webhooks,
        senderIdAlpha: senderIdAlpha.trim() ? senderIdAlpha.trim() : null,
        poolId,
      });
      if (!res.ok) {
        toast({
          title: "Save failed",
          description: res.error,
          variant: "destructive",
        });
      } else {
        toast({ title: "Overrides saved" });
      }
    });
  }

  function doRelease() {
    startAction(async () => {
      const res = await releaseNumber({
        numberId: detail.id,
        graceHours,
      });
      if (!res.ok) {
        toast({
          title: "Release failed",
          description: res.error,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Release scheduled",
          description: `${graceHours}h grace — number will be released after that window.`,
        });
        setReleaseOpen(false);
      }
    });
  }

  function doPortOut() {
    startAction(async () => {
      const res = await requestPortOut({
        numberId: detail.id,
        ...portTarget,
      });
      if (!res.ok) {
        toast({
          title: "Port-out failed",
          description: res.error,
          variant: "destructive",
        });
      } else {
        toast({ title: "Port-out request filed (stub)" });
        setPortOutOpen(false);
      }
    });
  }

  function doTestSend() {
    startComposer(async () => {
      const res = await testSendFromNumber({
        numberId: detail.id,
        toE164: composerTo,
        body: composerBody,
      });
      if (!res.ok) {
        toast({
          title: "Test send failed",
          description: res.error,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Test queued",
          description: `Message id: ${res.messageId || "(engine disabled)"}`,
        });
      }
    });
  }

  // ─── Send / inbound history table column defs ───────────────────────────
  const historyColumns: SabsmsColumn<SendHistoryRow>[] = [
    {
      id: "createdAt",
      header: "When",
      render: (r) => (
        <span className="font-mono text-xs">
          {new Date(r.createdAt).toLocaleString()}
        </span>
      ),
      width: "180px",
    },
    {
      id: "to",
      header: "Counterpart",
      render: (r) => <span className="font-mono text-xs">{r.to}</span>,
    },
    {
      id: "status",
      header: "Status",
      render: (r) => (
        <Badge variant={r.status === "delivered" ? "default" : "secondary"}>
          {r.status}
        </Badge>
      ),
      width: "120px",
    },
    {
      id: "segments",
      header: "Segs",
      render: (r) => <span className="text-xs">{r.segments ?? "—"}</span>,
      width: "60px",
      align: "right",
    },
    {
      id: "cost",
      header: "Cost",
      render: (r) => (
        <span className="font-mono text-xs">${r.cost.toFixed(4)}</span>
      ),
      width: "80px",
      align: "right",
    },
    {
      id: "body",
      header: "Body",
      render: (r) => <span className="text-xs">{r.body.slice(0, 80)}</span>,
    },
  ];

  const historyFacets: SabsmsFacet[] = [
    {
      key: "status",
      label: "Status",
      options: [
        { value: "delivered", label: "Delivered" },
        { value: "failed", label: "Failed" },
        { value: "queued", label: "Queued" },
        { value: "sent", label: "Sent" },
        { value: "undelivered", label: "Undelivered" },
      ],
      multi: true,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Top action row — refresh + export + kbd hint */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="default">{detail.provider}</Badge>
          <Badge variant="secondary">{detail.country}</Badge>
          <Badge variant="secondary">{detail.type}</Badge>
          <Badge
            variant={detail.status === "active" ? "default" : "secondary"}
          >
            {detail.status}
          </Badge>
          <span className="font-mono text-sm">{detail.e164}</span>
        </div>
        <div className="flex items-center gap-2">
          <SabsmsRefreshButton
            defaultInterval={60}
            onRefresh={() => router.refresh()}
          />
          <SabsmsExportMenu
            filename={`sabsms-number-${detail.e164}`}
            toCsv={async () =>
              rowsToCsv(
                detail.sendHistory as unknown as Array<Record<string, unknown>>,
                [
                  { key: "createdAt", header: "When" },
                  { key: "to", header: "To" },
                  { key: "status", header: "Status" },
                  { key: "segments", header: "Segments" },
                  { key: "cost", header: "Cost" },
                  { key: "body", header: "Body" },
                ],
              )
            }
          />
          <Button
            variant="outline"
            onClick={() => setAuditOpen(true)}
            aria-label="Open audit log"
          >
            <History className="h-4 w-4" />
            <span className="ml-2">Audit</span>
          </Button>
          <SabsmsKbdHint
            shortcuts={[
              { keys: ["r"], description: "Reload" },
              { keys: ["e"], description: "Export CSV" },
              { keys: ["?"], description: "Toggle shortcuts" },
            ]}
          />
        </div>
      </div>
      
      {/* Predictive billing alerting */}
      {detail.projectedUsageCost > 50 && (
        <Alert variant="default" className="border-amber-200 bg-amber-50/50">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <ZoruAlertTitle className="text-amber-800">High projected volume cost</ZoruAlertTitle>
          <ZoruAlertDescription className="text-amber-700">
            Based on the last 30 days of traffic, this number is projected to incur an additional{" "}
            <span className="font-semibold">${detail.projectedUsageCost.toFixed(2)}</span> in usage charges this month.
          </ZoruAlertDescription>
        </Alert>
      )}

      {/* Compliance + capabilities banner */}
      <Card>
        <ZoruCardHeader>
          <ZoruCardTitle>Compliance and capabilities</ZoruCardTitle>
          <ZoruCardDescription>
            Carrier readiness + the workspace registration state for this
            number.
          </ZoruCardDescription>
        </ZoruCardHeader>
        <ZoruCardContent>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <Badge
              variant={
                detail.compliance.tendlc === "registered"
                  ? "default"
                  : detail.compliance.tendlc === "n/a"
                    ? "secondary"
                    : "secondary"
              }
            >
              10DLC: {detail.compliance.tendlc}
            </Badge>
            <Badge
              variant={
                detail.compliance.dlt === "registered"
                  ? "default"
                  : detail.compliance.dlt === "n/a"
                    ? "secondary"
                    : "secondary"
              }
            >
              DLT: {detail.compliance.dlt}
            </Badge>
            <Badge
              variant={
                detail.compliance.consentLog === "ok" ? "default" : "secondary"
              }
            >
              Consent log: {detail.compliance.consentLog}
            </Badge>
            {(["sms", "mms", "rcs", "voice"] as const)
              .filter((c) => detail.capabilities[c])
              .map((c) => (
                <Badge key={c} variant="secondary" className="uppercase">
                  {c}
                </Badge>
              ))}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
            <Stat label="Carrier (HLR)" value={detail.carrier.operator} sub="stub" />
            <Stat label="Line type" value={detail.carrier.lineType} />
            <Stat
              label="Monthly cost"
              value={`$${(detail.monthlyCost / 100).toFixed(2)}`}
            />
            <Stat
              label="Provisioned"
              value={new Date(detail.createdAt).toLocaleDateString()}
            />
          </div>
        </ZoruCardContent>
      </Card>

      {/* Charts row */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <ZoruCardHeader>
            <ZoruCardTitle>Health (30d)</ZoruCardTitle>
            <ZoruCardDescription>DLR + complaint rate.</ZoruCardDescription>
          </ZoruCardHeader>
          <ZoruCardContent>
            <ZoruChartContainer height={220}>
              <ZoruChart.LineChart data={detail.health}>
                <ZoruChart.CartesianGrid
                  strokeDasharray="3 3"
                  className="stroke-zoru-line"
                />
                <ZoruChart.XAxis dataKey="date" fontSize={10} />
                <ZoruChart.YAxis fontSize={10} unit="%" />
                <ZoruChart.Tooltip content={<ZoruChartTooltip />} />
                <ZoruChart.Legend wrapperStyle={{ fontSize: 11 }} />
                <ZoruChart.Line
                  type="monotone"
                  dataKey="dlrRate"
                  stroke={ZORU_CHART_PALETTE[1]}
                  strokeWidth={2}
                  dot={false}
                  name="DLR %"
                />
                <ZoruChart.Line
                  type="monotone"
                  dataKey="complaintRate"
                  stroke={ZORU_CHART_PALETTE[3]}
                  strokeWidth={2}
                  dot={false}
                  name="Complaint %"
                />
              </ZoruChart.LineChart>
            </ZoruChartContainer>
          </ZoruCardContent>
        </Card>
        <Card>
          <ZoruCardHeader>
            <ZoruCardTitle>Volume (30d)</ZoruCardTitle>
            <ZoruCardDescription>
              Sent / delivered / failed per day.
            </ZoruCardDescription>
          </ZoruCardHeader>
          <ZoruCardContent>
            <ZoruChartContainer height={220}>
              <ZoruChart.LineChart data={detail.volume}>
                <ZoruChart.CartesianGrid
                  strokeDasharray="3 3"
                  className="stroke-zoru-line"
                />
                <ZoruChart.XAxis dataKey="date" fontSize={10} />
                <ZoruChart.YAxis fontSize={10} />
                <ZoruChart.Tooltip content={<ZoruChartTooltip />} />
                <ZoruChart.Legend wrapperStyle={{ fontSize: 11 }} />
                <ZoruChart.Line
                  type="monotone"
                  dataKey="sent"
                  stroke={ZORU_CHART_PALETTE[0]}
                  strokeWidth={2}
                  dot={false}
                />
                <ZoruChart.Line
                  type="monotone"
                  dataKey="delivered"
                  stroke={ZORU_CHART_PALETTE[1]}
                  strokeWidth={2}
                  dot={false}
                />
                <ZoruChart.Line
                  type="monotone"
                  dataKey="failed"
                  stroke={ZORU_CHART_PALETTE[3]}
                  strokeWidth={2}
                  dot={false}
                />
              </ZoruChart.LineChart>
            </ZoruChartContainer>
          </ZoruCardContent>
        </Card>
        <Card>
          <ZoruCardHeader>
            <ZoruCardTitle>Cost (30d)</ZoruCardTitle>
            <ZoruCardDescription>USD per day, this number.</ZoruCardDescription>
          </ZoruCardHeader>
          <ZoruCardContent>
            <ZoruChartContainer height={220}>
              <ZoruChart.LineChart data={detail.cost}>
                <ZoruChart.CartesianGrid
                  strokeDasharray="3 3"
                  className="stroke-zoru-line"
                />
                <ZoruChart.XAxis dataKey="date" fontSize={10} />
                <ZoruChart.YAxis fontSize={10} unit="$" />
                <ZoruChart.Tooltip content={<ZoruChartTooltip />} />
                <ZoruChart.Legend wrapperStyle={{ fontSize: 11 }} />
                <ZoruChart.Line
                  type="monotone"
                  dataKey="cost"
                  stroke={ZORU_CHART_PALETTE[2]}
                  strokeWidth={2}
                  dot={false}
                  name="Cost"
                />
                <ZoruChart.Line
                  type="monotone"
                  dataKey="revenue"
                  stroke={ZORU_CHART_PALETTE[0]}
                  strokeWidth={2}
                  dot={false}
                  name="Revenue"
                />
              </ZoruChart.LineChart>
            </ZoruChartContainer>
          </ZoruCardContent>
        </Card>
      </div>

      {/* Deliverability & Bounces charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <ZoruCardHeader>
            <ZoruCardTitle>Deliverability (30d)</ZoruCardTitle>
            <ZoruCardDescription>Percentage of messages successfully delivered.</ZoruCardDescription>
          </ZoruCardHeader>
          <ZoruCardContent>
            <ZoruChartContainer height={220}>
              <ZoruChart.LineChart data={detail.health}>
                <ZoruChart.CartesianGrid
                  strokeDasharray="3 3"
                  className="stroke-zoru-line"
                />
                <ZoruChart.XAxis dataKey="date" fontSize={10} />
                <ZoruChart.YAxis fontSize={10} unit="%" />
                <ZoruChart.Tooltip content={<ZoruChartTooltip />} />
                <ZoruChart.Legend wrapperStyle={{ fontSize: 11 }} />
                <ZoruChart.Line
                  type="monotone"
                  dataKey="dlrRate"
                  stroke={ZORU_CHART_PALETTE[1]}
                  strokeWidth={2}
                  dot={false}
                  name="Deliverability %"
                />
              </ZoruChart.LineChart>
            </ZoruChartContainer>
          </ZoruCardContent>
        </Card>
        <Card>
          <ZoruCardHeader>
            <ZoruCardTitle>Bounce Rate (30d)</ZoruCardTitle>
            <ZoruCardDescription>Percentage of messages that failed to deliver.</ZoruCardDescription>
          </ZoruCardHeader>
          <ZoruCardContent>
            <ZoruChartContainer height={220}>
              <ZoruChart.LineChart data={detail.health}>
                <ZoruChart.CartesianGrid
                  strokeDasharray="3 3"
                  className="stroke-zoru-line"
                />
                <ZoruChart.XAxis dataKey="date" fontSize={10} />
                <ZoruChart.YAxis fontSize={10} unit="%" />
                <ZoruChart.Tooltip content={<ZoruChartTooltip />} />
                <ZoruChart.Legend wrapperStyle={{ fontSize: 11 }} />
                <ZoruChart.Line
                  type="monotone"
                  dataKey="complaintRate"
                  stroke={ZORU_CHART_PALETTE[3]}
                  strokeWidth={2}
                  dot={false}
                  name="Bounce Rate %"
                />
              </ZoruChart.LineChart>
            </ZoruChartContainer>
          </ZoruCardContent>
        </Card>
      </div>

      {/* Per-country + per-template aggregators */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <ZoruCardHeader>
            <ZoruCardTitle>Per-country deliverability</ZoruCardTitle>
            <ZoruCardDescription>
              Top destinations sent from this number.
            </ZoruCardDescription>
          </ZoruCardHeader>
          <ZoruCardContent className="p-0">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500">
                <tr>
                  <th className="px-3 py-2 text-left">Country</th>
                  <th className="px-3 py-2 text-right">Sent</th>
                  <th className="px-3 py-2 text-right">Delivered</th>
                  <th className="px-3 py-2 text-right">DLR %</th>
                </tr>
              </thead>
              <tbody>
                {detail.countries.length === 0 ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-3 py-8 text-center text-xs text-slate-500"
                    >
                      No traffic in the last 30 days.
                    </td>
                  </tr>
                ) : (
                  detail.countries.slice(0, 15).map((c) => (
                    <tr key={c.country}>
                      <td className="px-3 py-2 font-mono text-xs">{c.country}</td>
                      <td className="px-3 py-2 text-right text-xs">{c.sent}</td>
                      <td className="px-3 py-2 text-right text-xs">
                        {c.delivered}
                      </td>
                      <td className="px-3 py-2 text-right text-xs">
                        <Badge
                          variant={c.deliveryRate >= 95 ? "default" : "secondary"}
                        >
                          {c.deliveryRate}%
                        </Badge>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </ZoruCardContent>
        </Card>
        <Card>
          <ZoruCardHeader>
            <ZoruCardTitle>Per-template performance</ZoruCardTitle>
            <ZoruCardDescription>
              Top templates by send volume from this number.
            </ZoruCardDescription>
          </ZoruCardHeader>
          <ZoruCardContent className="p-0">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500">
                <tr>
                  <th className="px-3 py-2 text-left">Template</th>
                  <th className="px-3 py-2 text-right">Sent</th>
                  <th className="px-3 py-2 text-right">Delivered</th>
                  <th className="px-3 py-2 text-right">Replied</th>
                </tr>
              </thead>
              <tbody>
                {detail.templatePerformance.length === 0 ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-3 py-8 text-center text-xs text-slate-500"
                    >
                      No template traffic yet.
                    </td>
                  </tr>
                ) : (
                  detail.templatePerformance.slice(0, 15).map((t) => (
                    <tr key={t.templateId}>
                      <td className="px-3 py-2 text-xs">{t.templateName}</td>
                      <td className="px-3 py-2 text-right text-xs">{t.sent}</td>
                      <td className="px-3 py-2 text-right text-xs">
                        {t.delivered}
                      </td>
                      <td className="px-3 py-2 text-right text-xs">{t.replied}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </ZoruCardContent>
        </Card>
      </div>

      {/* Campaign + pool assignment */}
      <Card>
        <ZoruCardHeader>
          <ZoruCardTitle>Assignments</ZoruCardTitle>
          <ZoruCardDescription>
            Where this number is being used.
          </ZoruCardDescription>
        </ZoruCardHeader>
        <ZoruCardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Campaigns
              </div>
              <ul className="mt-2 space-y-1 text-sm">
                {detail.campaigns.length === 0 ? (
                  <li className="text-slate-500">
                    Not assigned to any campaigns.
                  </li>
                ) : (
                  detail.campaigns.map((c) => (
                    <li key={c.id} className="flex items-center gap-2">
                      <ArrowUpRight className="h-3.5 w-3.5 text-slate-400" />
                      <a
                        href={`/sabsms/campaigns/${c.id}`}
                        className="hover:underline"
                      >
                        {c.name}
                      </a>
                    </li>
                  ))
                )}
              </ul>
            </div>
            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Sender pool
              </div>
              <Select value={poolId} onValueChange={setPoolId}>
                <ZoruSelectTrigger className="mt-2">
                  <ZoruSelectValue />
                </ZoruSelectTrigger>
                <ZoruSelectContent>
                  {detail.pools.map((p) => (
                    <ZoruSelectItem key={p.id} value={p.id}>
                      {p.name}
                    </ZoruSelectItem>
                  ))}
                </ZoruSelectContent>
              </Select>
            </div>
          </div>
        </ZoruCardContent>
      </Card>

      {/* Override config */}
      <Card>
        <ZoruCardHeader>
          <ZoruCardTitle>Per-number overrides</ZoruCardTitle>
          <ZoruCardDescription>
            Throttle, quiet hours, webhooks, sender id. Saves to{" "}
            <code className="rounded bg-slate-100 px-1 text-xs">
              sabsms_numbers
            </code>
            .
          </ZoruCardDescription>
        </ZoruCardHeader>
        <ZoruCardContent className="space-y-5">
          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Throttle
            </div>
            <div className="mt-2 grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="rps">Per second</Label>
                <Input
                  id="rps"
                  type="number"
                  min={1}
                  value={throttle.perSecond}
                  onChange={(e) =>
                    setThrottle((t) => ({
                      ...t,
                      perSecond: Math.max(1, Number(e.target.value) || 1),
                    }))
                  }
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="rpm">Per minute</Label>
                <Input
                  id="rpm"
                  type="number"
                  min={1}
                  value={throttle.perMinute}
                  onChange={(e) =>
                    setThrottle((t) => ({
                      ...t,
                      perMinute: Math.max(1, Number(e.target.value) || 1),
                    }))
                  }
                />
              </div>
            </div>
          </div>

          <Separator />

          <div>
            <div className="flex items-center justify-between">
              <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Quiet hours
              </div>
              <label className="flex items-center gap-2 text-xs">
                <Checkbox
                  checked={quietHours.enabled}
                  onCheckedChange={(v) =>
                    setQuietHours((q) => ({ ...q, enabled: Boolean(v) }))
                  }
                />
                Enabled
              </label>
            </div>
            <div className="mt-2 grid gap-3 md:grid-cols-3">
              <div className="space-y-1">
                <Label htmlFor="tz">Timezone</Label>
                <Input
                  id="tz"
                  value={quietHours.timezone}
                  onChange={(e) =>
                    setQuietHours((q) => ({ ...q, timezone: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="qh-start">Start hour</Label>
                <Input
                  id="qh-start"
                  type="number"
                  min={0}
                  max={23}
                  value={quietHours.startHour}
                  onChange={(e) =>
                    setQuietHours((q) => ({
                      ...q,
                      startHour: Math.min(
                        23,
                        Math.max(0, Number(e.target.value) || 0),
                      ),
                    }))
                  }
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="qh-end">End hour</Label>
                <Input
                  id="qh-end"
                  type="number"
                  min={0}
                  max={23}
                  value={quietHours.endHour}
                  onChange={(e) =>
                    setQuietHours((q) => ({
                      ...q,
                      endHour: Math.min(
                        23,
                        Math.max(0, Number(e.target.value) || 0),
                      ),
                    }))
                  }
                />
              </div>
            </div>
          </div>

          <Separator />

          <div>
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-500">
              <Webhook className="h-3.5 w-3.5" /> Webhooks
            </div>
            <div className="mt-2 grid gap-3 md:grid-cols-3">
              <div className="space-y-1">
                <Label htmlFor="hook-in">Inbound URL</Label>
                <Input
                  id="hook-in"
                  value={webhooks.inboundUrl ?? ""}
                  onChange={(e) =>
                    setWebhooks((w) => ({ ...w, inboundUrl: e.target.value }))
                  }
                  placeholder="https://…"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="hook-dlr">DLR URL</Label>
                <Input
                  id="hook-dlr"
                  value={webhooks.dlrUrl ?? ""}
                  onChange={(e) =>
                    setWebhooks((w) => ({ ...w, dlrUrl: e.target.value }))
                  }
                  placeholder="https://…"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="hook-voice">Voice URL (Phase 7)</Label>
                <Input
                  id="hook-voice"
                  value={webhooks.voiceUrl ?? ""}
                  onChange={(e) =>
                    setWebhooks((w) => ({ ...w, voiceUrl: e.target.value }))
                  }
                  placeholder="https://… (stub)"
                />
              </div>
            </div>
          </div>

          {detail.type === "alphanumeric" && (
            <>
              <Separator />
              <div className="space-y-1">
                <Label htmlFor="alpha">Sender ID (alpha override)</Label>
                <Input
                  id="alpha"
                  value={senderIdAlpha}
                  onChange={(e) => setSenderIdAlpha(e.target.value)}
                  placeholder="e.g. SABSMS"
                  maxLength={11}
                />
                <p className="text-xs text-slate-500">
                  Per-country support varies; for unsupported routes the engine
                  falls back to the workspace default.
                </p>
              </div>
            </>
          )}

          <div className="flex justify-end">
            <Button onClick={persistOverrides} disabled={savePending}>
              {savePending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : null}
              <span className={savePending ? "ml-2" : undefined}>
                Save overrides
              </span>
            </Button>
          </div>
        </ZoruCardContent>
      </Card>

      {/* Send + inbound history */}
      <Card>
        <ZoruCardHeader>
          <ZoruCardTitle>History</ZoruCardTitle>
          <ZoruCardDescription>
            Last 200 outbound + inbound messages for this number.
          </ZoruCardDescription>
        </ZoruCardHeader>
        <ZoruCardContent className="space-y-4">
          <SabsmsFilterBar
            searchPlaceholder="Search history"
            facets={historyFacets}
            sortOptions={[
              { value: "newest", label: "Newest" },
              { value: "oldest", label: "Oldest" },
            ]}
            defaultSort="newest"
          />
          <div className="space-y-2">
            <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Outbound
            </div>
            <SabsmsDataTable<SendHistoryRow>
              rows={detail.sendHistory}
              columns={historyColumns}
              rowKey={(r) => r.id}
              density="compact"
              emptyTitle="No outbound messages"
              emptyDescription="Nothing sent from this number in the last 30 days."
            />
          </div>
          <div className="space-y-2">
            <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Inbound
            </div>
            <SabsmsDataTable<SendHistoryRow>
              rows={detail.inboundHistory}
              columns={historyColumns}
              rowKey={(r) => r.id}
              density="compact"
              emptyTitle="No inbound messages"
              emptyDescription="No replies received on this number yet."
            />
          </div>
        </ZoruCardContent>
      </Card>

      {/* Mini composer */}
      <Card>
        <ZoruCardHeader>
          <ZoruCardTitle>Test send from this number</ZoruCardTitle>
          <ZoruCardDescription>
            Sends through the SabSMS engine using this number as the
            <span className="font-mono"> from </span>address.
          </ZoruCardDescription>
        </ZoruCardHeader>
        <ZoruCardContent>
          <div className="grid gap-3 md:grid-cols-3">
            <div className="space-y-1">
              <Label htmlFor="composer-to">To (E.164)</Label>
              <Input
                id="composer-to"
                value={composerTo}
                onChange={(e) => setComposerTo(e.target.value)}
                placeholder="+15555550100"
              />
            </div>
            <div className="space-y-1 md:col-span-2">
              <Label htmlFor="composer-body">Body</Label>
              <Textarea
                id="composer-body"
                rows={2}
                value={composerBody}
                onChange={(e) => setComposerBody(e.target.value)}
              />
            </div>
          </div>
          <div className="mt-3 flex justify-end">
            <Button onClick={doTestSend} disabled={composerPending}>
              {composerPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              <span className="ml-2">Send test</span>
            </Button>
          </div>
        </ZoruCardContent>
      </Card>

      {/* Danger zone */}
      <Card>
        <ZoruCardHeader>
          <ZoruCardTitle>Danger zone</ZoruCardTitle>
          <ZoruCardDescription>
            Release the number or move it to another carrier. Both go
            through audit.
          </ZoruCardDescription>
        </ZoruCardHeader>
        <ZoruCardContent>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => setReleaseOpen(true)}
            >
              <PhoneOff className="h-4 w-4" />
              <span className="ml-2">Release with grace</span>
            </Button>
            <Button
              variant="outline"
              onClick={() => setPortOutOpen(true)}
            >
              <ShieldCheck className="h-4 w-4" />
              <span className="ml-2">Port-out (stub)</span>
            </Button>
          </div>
          <Alert className="mt-3" variant="info">
            <AlertTriangle aria-hidden />
            <ZoruAlertTitle>Heads-up</ZoruAlertTitle>
            <ZoruAlertDescription>
              Release transitions status to{" "}
              <span className="font-mono">releasing</span> immediately and
              schedules the final release after the grace window. Port-out
              files a stub audit entry — the engine doesn{`’`}t support
              carrier ports yet.
            </ZoruAlertDescription>
          </Alert>
        </ZoruCardContent>
      </Card>

      {/* Release confirmation */}
      <ZoruAlertDialog open={releaseOpen} onOpenChange={setReleaseOpen}>
        <ZoruAlertDialogContent>
          <ZoruAlertDialogHeader>
            <ZoruAlertDialogTitle>Release this number?</ZoruAlertDialogTitle>
            <ZoruAlertDialogDescription>
              After the grace window, the number will be released back to{" "}
              {detail.provider}. Inbound traffic will be lost.
            </ZoruAlertDialogDescription>
          </ZoruAlertDialogHeader>
          <div className="space-y-1 py-2">
            <Label htmlFor="grace">Grace period (hours)</Label>
            <Input
              id="grace"
              type="number"
              min={0}
              max={720}
              value={graceHours}
              onChange={(e) =>
                setGraceHours(
                  Math.max(0, Math.min(720, Number(e.target.value) || 0)),
                )
              }
            />
          </div>
          <ZoruAlertDialogFooter>
            <ZoruAlertDialogCancel disabled={actionPending}>
              Cancel
            </ZoruAlertDialogCancel>
            <ZoruAlertDialogAction
              onClick={doRelease}
              disabled={actionPending}
            >
              {actionPending ? "Releasing…" : "Release"}
            </ZoruAlertDialogAction>
          </ZoruAlertDialogFooter>
        </ZoruAlertDialogContent>
      </ZoruAlertDialog>

      {/* Port-out dialog */}
      <ZoruAlertDialog open={portOutOpen} onOpenChange={setPortOutOpen}>
        <ZoruAlertDialogContent>
          <ZoruAlertDialogHeader>
            <ZoruAlertDialogTitle>Request port-out</ZoruAlertDialogTitle>
            <ZoruAlertDialogDescription>
              Files a stub request for carrier support. The engine
              doesn{`’`}t support automated port-outs yet (Phase 7+).
            </ZoruAlertDialogDescription>
          </ZoruAlertDialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label htmlFor="port-carrier">Target carrier</Label>
              <Input
                id="port-carrier"
                value={portTarget.newCarrier}
                onChange={(e) =>
                  setPortTarget((p) => ({ ...p, newCarrier: e.target.value }))
                }
                placeholder="e.g. Telnyx"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="port-email">Contact email</Label>
              <Input
                id="port-email"
                type="email"
                value={portTarget.contactEmail}
                onChange={(e) =>
                  setPortTarget((p) => ({
                    ...p,
                    contactEmail: e.target.value,
                  }))
                }
                placeholder="ops@yourcorp.com"
              />
            </div>
          </div>
          <ZoruAlertDialogFooter>
            <ZoruAlertDialogCancel disabled={actionPending}>
              Cancel
            </ZoruAlertDialogCancel>
            <ZoruAlertDialogAction
              onClick={doPortOut}
              disabled={actionPending}
            >
              {actionPending ? "Filing…" : "File request"}
            </ZoruAlertDialogAction>
          </ZoruAlertDialogFooter>
        </ZoruAlertDialogContent>
      </ZoruAlertDialog>

      {/* Audit drawer */}
      <SabsmsDetailDrawer
        open={auditOpen}
        onOpenChange={setAuditOpen}
        title="Audit log"
        description={`Last ${detail.audit.length} entries scoped to ${detail.e164}.`}
      >
        {detail.audit.length === 0 ? (
          <p className="text-sm text-slate-500">
            No audit entries yet for this number.
          </p>
        ) : (
          <ul className="space-y-3">
            {detail.audit.map((a, i) => (
              <li
                key={`${a.action}-${i}`}
                className="rounded-md border border-slate-200 bg-white p-3"
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium">{a.action}</span>
                  <span className="font-mono text-slate-500">
                    {new Date(a.createdAt).toLocaleString()}
                  </span>
                </div>
                <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-words text-[11px] text-slate-600">
                  {JSON.stringify(a.detail, null, 2)}
                </pre>
              </li>
            ))}
          </ul>
        )}
      </SabsmsDetailDrawer>
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
}: {
  label: string;
  value: React.ReactNode;
  sub?: string;
}) {
  return (
    <div className="rounded-md border border-slate-200 bg-white p-3">
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-sm font-medium">{value}</div>
      {sub && <div className="text-[10px] text-slate-400">{sub}</div>}
    </div>
  );
}
