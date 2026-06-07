"use client";

/**
 * SabSMS - number detail right pane (page 26).
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
  PhoneOff,
  Send,
  ShieldCheck,
  Webhook,
} from "lucide-react";

import {
  CHART_PALETTE,
  Alert,
  AlertDescription,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertTitle,
  Badge,
  Button,
  Card,
  CardBody,
  CardDescription,
  CardHeader,
  CardTitle,
  Checkbox,
  Recharts,
  ChartContainer,
  ChartTooltip,
  EmptyState,
  Field,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Separator,
  StatCard,
  TBody,
  THead,
  Table,
  Td,
  Textarea,
  Th,
  Tr,
  useToast,
} from "@/components/sabcrm/20ui";

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
  const { toast } = useToast();
  const router = useRouter();

  // --- Override form state -------------------------------------------------
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

  // --- Action state --------------------------------------------------------
  const [releaseOpen, setReleaseOpen] = React.useState(false);
  const [portOutOpen, setPortOutOpen] = React.useState(false);
  const [auditOpen, setAuditOpen] = React.useState(false);
  const [graceHours, setGraceHours] = React.useState(48);
  const [portTarget, setPortTarget] = React.useState({
    newCarrier: "",
    contactEmail: "",
  });
  const [actionPending, startAction] = useTransition();

  // --- Mini composer state -------------------------------------------------
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
          tone: "danger",
        });
      } else {
        toast({ title: "Overrides saved", tone: "success" });
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
          tone: "danger",
        });
      } else {
        toast({
          title: "Release scheduled",
          description: `${graceHours}h grace, number will be released after that window.`,
          tone: "success",
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
          tone: "danger",
        });
      } else {
        toast({ title: "Port-out request filed (stub)", tone: "success" });
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
          tone: "danger",
        });
      } else {
        toast({
          title: "Test queued",
          description: `Message id: ${res.messageId || "(engine disabled)"}`,
          tone: "success",
        });
      }
    });
  }

  // --- Send / inbound history table column defs ----------------------------
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
        <Badge variant={r.status === "delivered" ? "success" : "secondary"}>
          {r.status}
        </Badge>
      ),
      width: "120px",
    },
    {
      id: "segments",
      header: "Segs",
      render: (r) => <span className="text-xs">{r.segments ?? "-"}</span>,
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
      {/* Top action row - refresh + export + kbd hint */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="accent">{detail.provider}</Badge>
          <Badge variant="secondary">{detail.country}</Badge>
          <Badge variant="secondary">{detail.type}</Badge>
          <Badge variant={detail.status === "active" ? "success" : "secondary"}>
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
            iconLeft={History}
            onClick={() => setAuditOpen(true)}
          >
            Audit
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
        <Alert tone="warning" title="High projected volume cost">
          Based on the last 30 days of traffic, this number is projected to
          incur an additional{" "}
          <span className="font-semibold">
            ${detail.projectedUsageCost.toFixed(2)}
          </span>{" "}
          in usage charges this month.
        </Alert>
      )}

      {/* Compliance + capabilities banner */}
      <Card>
        <CardHeader>
          <CardTitle>Compliance and capabilities</CardTitle>
          <CardDescription>
            Carrier readiness + the workspace registration state for this
            number.
          </CardDescription>
        </CardHeader>
        <CardBody>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <Badge
              variant={
                detail.compliance.tendlc === "registered"
                  ? "success"
                  : "secondary"
              }
            >
              10DLC: {detail.compliance.tendlc}
            </Badge>
            <Badge
              variant={
                detail.compliance.dlt === "registered" ? "success" : "secondary"
              }
            >
              DLT: {detail.compliance.dlt}
            </Badge>
            <Badge
              variant={
                detail.compliance.consentLog === "ok" ? "success" : "secondary"
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
          <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatCard label="Carrier (HLR)" value={detail.carrier.operator} />
            <StatCard label="Line type" value={detail.carrier.lineType} />
            <StatCard
              label="Monthly cost"
              value={`$${(detail.monthlyCost / 100).toFixed(2)}`}
            />
            <StatCard
              label="Provisioned"
              value={new Date(detail.createdAt).toLocaleDateString()}
            />
          </div>
        </CardBody>
      </Card>

      {/* Charts row */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Health (30d)</CardTitle>
            <CardDescription>DLR + complaint rate.</CardDescription>
          </CardHeader>
          <CardBody>
            <ChartContainer height={220}>
              <Recharts.LineChart data={detail.health}>
                <Recharts.CartesianGrid
                  strokeDasharray="3 3"
                  className="stroke-[var(--st-border)]"
                />
                <Recharts.XAxis dataKey="date" fontSize={10} />
                <Recharts.YAxis fontSize={10} unit="%" />
                <Recharts.Tooltip content={<ChartTooltip />} />
                <Recharts.Legend wrapperStyle={{ fontSize: 11 }} />
                <Recharts.Line
                  type="monotone"
                  dataKey="dlrRate"
                  stroke={CHART_PALETTE[1]}
                  strokeWidth={2}
                  dot={false}
                  name="DLR %"
                />
                <Recharts.Line
                  type="monotone"
                  dataKey="complaintRate"
                  stroke={CHART_PALETTE[3]}
                  strokeWidth={2}
                  dot={false}
                  name="Complaint %"
                />
              </Recharts.LineChart>
            </ChartContainer>
          </CardBody>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Volume (30d)</CardTitle>
            <CardDescription>
              Sent / delivered / failed per day.
            </CardDescription>
          </CardHeader>
          <CardBody>
            <ChartContainer height={220}>
              <Recharts.LineChart data={detail.volume}>
                <Recharts.CartesianGrid
                  strokeDasharray="3 3"
                  className="stroke-[var(--st-border)]"
                />
                <Recharts.XAxis dataKey="date" fontSize={10} />
                <Recharts.YAxis fontSize={10} />
                <Recharts.Tooltip content={<ChartTooltip />} />
                <Recharts.Legend wrapperStyle={{ fontSize: 11 }} />
                <Recharts.Line
                  type="monotone"
                  dataKey="sent"
                  stroke={CHART_PALETTE[0]}
                  strokeWidth={2}
                  dot={false}
                />
                <Recharts.Line
                  type="monotone"
                  dataKey="delivered"
                  stroke={CHART_PALETTE[1]}
                  strokeWidth={2}
                  dot={false}
                />
                <Recharts.Line
                  type="monotone"
                  dataKey="failed"
                  stroke={CHART_PALETTE[3]}
                  strokeWidth={2}
                  dot={false}
                />
              </Recharts.LineChart>
            </ChartContainer>
          </CardBody>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Cost (30d)</CardTitle>
            <CardDescription>USD per day, this number.</CardDescription>
          </CardHeader>
          <CardBody>
            <ChartContainer height={220}>
              <Recharts.LineChart data={detail.cost}>
                <Recharts.CartesianGrid
                  strokeDasharray="3 3"
                  className="stroke-[var(--st-border)]"
                />
                <Recharts.XAxis dataKey="date" fontSize={10} />
                <Recharts.YAxis fontSize={10} unit="$" />
                <Recharts.Tooltip content={<ChartTooltip />} />
                <Recharts.Legend wrapperStyle={{ fontSize: 11 }} />
                <Recharts.Line
                  type="monotone"
                  dataKey="cost"
                  stroke={CHART_PALETTE[2]}
                  strokeWidth={2}
                  dot={false}
                  name="Cost"
                />
                <Recharts.Line
                  type="monotone"
                  dataKey="revenue"
                  stroke={CHART_PALETTE[0]}
                  strokeWidth={2}
                  dot={false}
                  name="Revenue"
                />
              </Recharts.LineChart>
            </ChartContainer>
          </CardBody>
        </Card>
      </div>

      {/* Deliverability & Bounces charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Deliverability (30d)</CardTitle>
            <CardDescription>
              Percentage of messages successfully delivered.
            </CardDescription>
          </CardHeader>
          <CardBody>
            <ChartContainer height={220}>
              <Recharts.LineChart data={detail.health}>
                <Recharts.CartesianGrid
                  strokeDasharray="3 3"
                  className="stroke-[var(--st-border)]"
                />
                <Recharts.XAxis dataKey="date" fontSize={10} />
                <Recharts.YAxis fontSize={10} unit="%" />
                <Recharts.Tooltip content={<ChartTooltip />} />
                <Recharts.Legend wrapperStyle={{ fontSize: 11 }} />
                <Recharts.Line
                  type="monotone"
                  dataKey="dlrRate"
                  stroke={CHART_PALETTE[1]}
                  strokeWidth={2}
                  dot={false}
                  name="Deliverability %"
                />
              </Recharts.LineChart>
            </ChartContainer>
          </CardBody>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Bounce Rate (30d)</CardTitle>
            <CardDescription>
              Percentage of messages that failed to deliver.
            </CardDescription>
          </CardHeader>
          <CardBody>
            <ChartContainer height={220}>
              <Recharts.LineChart data={detail.health}>
                <Recharts.CartesianGrid
                  strokeDasharray="3 3"
                  className="stroke-[var(--st-border)]"
                />
                <Recharts.XAxis dataKey="date" fontSize={10} />
                <Recharts.YAxis fontSize={10} unit="%" />
                <Recharts.Tooltip content={<ChartTooltip />} />
                <Recharts.Legend wrapperStyle={{ fontSize: 11 }} />
                <Recharts.Line
                  type="monotone"
                  dataKey="complaintRate"
                  stroke={CHART_PALETTE[3]}
                  strokeWidth={2}
                  dot={false}
                  name="Bounce Rate %"
                />
              </Recharts.LineChart>
            </ChartContainer>
          </CardBody>
        </Card>
      </div>

      {/* Per-country + per-template aggregators */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Per-country deliverability</CardTitle>
            <CardDescription>
              Top destinations sent from this number.
            </CardDescription>
          </CardHeader>
          <CardBody padding="none">
            {detail.countries.length === 0 ? (
              <EmptyState
                title="No traffic"
                description="No traffic in the last 30 days."
                size="sm"
              />
            ) : (
              <Table density="compact">
                <THead>
                  <Tr>
                    <Th>Country</Th>
                    <Th align="right">Sent</Th>
                    <Th align="right">Delivered</Th>
                    <Th align="right">DLR %</Th>
                  </Tr>
                </THead>
                <TBody>
                  {detail.countries.slice(0, 15).map((c) => (
                    <Tr key={c.country}>
                      <Td>
                        <span className="font-mono text-xs">{c.country}</span>
                      </Td>
                      <Td align="right">
                        <span className="text-xs">{c.sent}</span>
                      </Td>
                      <Td align="right">
                        <span className="text-xs">{c.delivered}</span>
                      </Td>
                      <Td align="right">
                        <Badge
                          variant={c.deliveryRate >= 95 ? "success" : "secondary"}
                        >
                          {c.deliveryRate}%
                        </Badge>
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
            <CardTitle>Per-template performance</CardTitle>
            <CardDescription>
              Top templates by send volume from this number.
            </CardDescription>
          </CardHeader>
          <CardBody padding="none">
            {detail.templatePerformance.length === 0 ? (
              <EmptyState
                title="No template traffic"
                description="No template traffic yet."
                size="sm"
              />
            ) : (
              <Table density="compact">
                <THead>
                  <Tr>
                    <Th>Template</Th>
                    <Th align="right">Sent</Th>
                    <Th align="right">Delivered</Th>
                    <Th align="right">Replied</Th>
                  </Tr>
                </THead>
                <TBody>
                  {detail.templatePerformance.slice(0, 15).map((t) => (
                    <Tr key={t.templateId}>
                      <Td>
                        <span className="text-xs">{t.templateName}</span>
                      </Td>
                      <Td align="right">
                        <span className="text-xs">{t.sent}</span>
                      </Td>
                      <Td align="right">
                        <span className="text-xs">{t.delivered}</span>
                      </Td>
                      <Td align="right">
                        <span className="text-xs">{t.replied}</span>
                      </Td>
                    </Tr>
                  ))}
                </TBody>
              </Table>
            )}
          </CardBody>
        </Card>
      </div>

      {/* Campaign + pool assignment */}
      <Card>
        <CardHeader>
          <CardTitle>Assignments</CardTitle>
          <CardDescription>Where this number is being used.</CardDescription>
        </CardHeader>
        <CardBody>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-[var(--st-text-secondary)]">
                Campaigns
              </div>
              <ul className="mt-2 space-y-1 text-sm">
                {detail.campaigns.length === 0 ? (
                  <li className="text-[var(--st-text-secondary)]">
                    Not assigned to any campaigns.
                  </li>
                ) : (
                  detail.campaigns.map((c) => (
                    <li key={c.id} className="flex items-center gap-2">
                      <ArrowUpRight
                        className="h-3.5 w-3.5 text-[var(--st-text-secondary)]"
                        aria-hidden
                      />
                      <a
                        href={`/sabsms/campaigns/${c.id}`}
                        className="text-[var(--st-text)] hover:underline"
                      >
                        {c.name}
                      </a>
                    </li>
                  ))
                )}
              </ul>
            </div>
            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-[var(--st-text-secondary)]">
                Sender pool
              </div>
              <Select value={poolId} onValueChange={setPoolId}>
                <SelectTrigger className="mt-2" aria-label="Sender pool">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {detail.pools.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Override config */}
      <Card>
        <CardHeader>
          <CardTitle>Per-number overrides</CardTitle>
          <CardDescription>
            Throttle, quiet hours, webhooks, sender id. Saves to{" "}
            <code className="rounded bg-[var(--st-bg-muted)] px-1 text-xs">
              sabsms_numbers
            </code>
            .
          </CardDescription>
        </CardHeader>
        <CardBody className="space-y-5">
          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-[var(--st-text-secondary)]">
              Throttle
            </div>
            <div className="mt-2 grid gap-3 md:grid-cols-2">
              <Field label="Per second">
                <Input
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
              </Field>
              <Field label="Per minute">
                <Input
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
              </Field>
            </div>
          </div>

          <Separator />

          <div>
            <div className="flex items-center justify-between">
              <div className="text-xs font-medium uppercase tracking-wide text-[var(--st-text-secondary)]">
                Quiet hours
              </div>
              <Checkbox
                label="Enabled"
                checked={quietHours.enabled}
                onChange={(e) =>
                  setQuietHours((q) => ({
                    ...q,
                    enabled: e.target.checked,
                  }))
                }
              />
            </div>
            <div className="mt-2 grid gap-3 md:grid-cols-3">
              <Field label="Timezone">
                <Input
                  value={quietHours.timezone}
                  onChange={(e) =>
                    setQuietHours((q) => ({ ...q, timezone: e.target.value }))
                  }
                />
              </Field>
              <Field label="Start hour">
                <Input
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
              </Field>
              <Field label="End hour">
                <Input
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
              </Field>
            </div>
          </div>

          <Separator />

          <div>
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-[var(--st-text-secondary)]">
              <Webhook className="h-3.5 w-3.5" aria-hidden /> Webhooks
            </div>
            <div className="mt-2 grid gap-3 md:grid-cols-3">
              <Field label="Inbound URL">
                <Input
                  value={webhooks.inboundUrl ?? ""}
                  onChange={(e) =>
                    setWebhooks((w) => ({ ...w, inboundUrl: e.target.value }))
                  }
                  placeholder="https://..."
                />
              </Field>
              <Field label="DLR URL">
                <Input
                  value={webhooks.dlrUrl ?? ""}
                  onChange={(e) =>
                    setWebhooks((w) => ({ ...w, dlrUrl: e.target.value }))
                  }
                  placeholder="https://..."
                />
              </Field>
              <Field label="Voice URL (Phase 7)">
                <Input
                  value={webhooks.voiceUrl ?? ""}
                  onChange={(e) =>
                    setWebhooks((w) => ({ ...w, voiceUrl: e.target.value }))
                  }
                  placeholder="https://... (stub)"
                />
              </Field>
            </div>
          </div>

          {detail.type === "alphanumeric" && (
            <>
              <Separator />
              <Field
                label="Sender ID (alpha override)"
                help="Per-country support varies; for unsupported routes the engine falls back to the workspace default."
              >
                <Input
                  value={senderIdAlpha}
                  onChange={(e) => setSenderIdAlpha(e.target.value)}
                  placeholder="e.g. SABSMS"
                  maxLength={11}
                />
              </Field>
            </>
          )}

          <div className="flex justify-end">
            <Button onClick={persistOverrides} loading={savePending}>
              Save overrides
            </Button>
          </div>
        </CardBody>
      </Card>

      {/* Send + inbound history */}
      <Card>
        <CardHeader>
          <CardTitle>History</CardTitle>
          <CardDescription>
            Last 200 outbound + inbound messages for this number.
          </CardDescription>
        </CardHeader>
        <CardBody className="space-y-4">
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
            <div className="text-xs font-medium uppercase tracking-wide text-[var(--st-text-secondary)]">
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
            <div className="text-xs font-medium uppercase tracking-wide text-[var(--st-text-secondary)]">
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
        </CardBody>
      </Card>

      {/* Mini composer */}
      <Card>
        <CardHeader>
          <CardTitle>Test send from this number</CardTitle>
          <CardDescription>
            Sends through the SabSMS engine using this number as the
            <span className="font-mono"> from </span>address.
          </CardDescription>
        </CardHeader>
        <CardBody>
          <div className="grid gap-3 md:grid-cols-3">
            <Field label="To (E.164)">
              <Input
                value={composerTo}
                onChange={(e) => setComposerTo(e.target.value)}
                placeholder="+15555550100"
              />
            </Field>
            <Field label="Body" className="md:col-span-2">
              <Textarea
                rows={2}
                value={composerBody}
                onChange={(e) => setComposerBody(e.target.value)}
              />
            </Field>
          </div>
          <div className="mt-3 flex justify-end">
            <Button onClick={doTestSend} loading={composerPending} iconLeft={Send}>
              Send test
            </Button>
          </div>
        </CardBody>
      </Card>

      {/* Danger zone */}
      <Card>
        <CardHeader>
          <CardTitle>Danger zone</CardTitle>
          <CardDescription>
            Release the number or move it to another carrier. Both go through
            audit.
          </CardDescription>
        </CardHeader>
        <CardBody>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              iconLeft={PhoneOff}
              onClick={() => setReleaseOpen(true)}
            >
              Release with grace
            </Button>
            <Button
              variant="outline"
              iconLeft={ShieldCheck}
              onClick={() => setPortOutOpen(true)}
            >
              Port-out (stub)
            </Button>
          </div>
          <Alert className="mt-3" tone="info" title="Heads-up">
            Release transitions status to{" "}
            <span className="font-mono">releasing</span> immediately and
            schedules the final release after the grace window. Port-out files a
            stub audit entry, the engine does not support carrier ports yet.
          </Alert>
        </CardBody>
      </Card>

      {/* Release confirmation */}
      <AlertDialog open={releaseOpen} onOpenChange={setReleaseOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Release this number?</AlertDialogTitle>
            <AlertDialogDescription>
              After the grace window, the number will be released back to{" "}
              {detail.provider}. Inbound traffic will be lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-2">
            <Field label="Grace period (hours)">
              <Input
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
            </Field>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={doRelease} disabled={actionPending}>
              {actionPending ? "Releasing..." : "Release"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Port-out dialog */}
      <AlertDialog open={portOutOpen} onOpenChange={setPortOutOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Request port-out</AlertDialogTitle>
            <AlertDialogDescription>
              Files a stub request for carrier support. The engine does not
              support automated port-outs yet (Phase 7+).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-3 py-2">
            <Field label="Target carrier">
              <Input
                value={portTarget.newCarrier}
                onChange={(e) =>
                  setPortTarget((p) => ({ ...p, newCarrier: e.target.value }))
                }
                placeholder="e.g. Telnyx"
              />
            </Field>
            <Field label="Contact email">
              <Input
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
            </Field>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={doPortOut} disabled={actionPending}>
              {actionPending ? "Filing..." : "File request"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Audit drawer */}
      <SabsmsDetailDrawer
        open={auditOpen}
        onOpenChange={setAuditOpen}
        title="Audit log"
        description={`Last ${detail.audit.length} entries scoped to ${detail.e164}.`}
      >
        {detail.audit.length === 0 ? (
          <p className="text-sm text-[var(--st-text-secondary)]">
            No audit entries yet for this number.
          </p>
        ) : (
          <ul className="space-y-3">
            {detail.audit.map((a, i) => (
              <li
                key={`${a.action}-${i}`}
                className="rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-3"
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-[var(--st-text)]">
                    {a.action}
                  </span>
                  <span className="font-mono text-[var(--st-text-secondary)]">
                    {new Date(a.createdAt).toLocaleString()}
                  </span>
                </div>
                <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-words text-[11px] text-[var(--st-text-secondary)]">
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
