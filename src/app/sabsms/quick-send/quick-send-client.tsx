"use client";

import * as React from "react";
import Link from "next/link";

import {
  ZoruAlertDialog,
  ZoruAlertDialogAction,
  ZoruAlertDialogCancel,
  ZoruAlertDialogContent,
  ZoruAlertDialogDescription,
  ZoruAlertDialogFooter,
  ZoruAlertDialogHeader,
  ZoruAlertDialogTitle,
  Badge,
  Button,
  Card,
  ZoruCardContent,
  ZoruCardDescription,
  ZoruCardHeader,
  ZoruCardTitle,
  Checkbox,
  Input,
  ZoruKbd,
  Label,
  RadioGroup,
  ZoruRadioGroupItem,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  Separator,
  Switch,
  Table,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
  Textarea,
} from "@/components/zoruui";
import { SabsmsKbdHint } from "@/components/sabsms/page-toolkit";

import type {
  SabsmsMessageCategory,
} from "@/lib/sabsms/types";

import {
  interpolateBody,
  parseRecipientList,
  segmentCount,
  type ParseResult,
} from "./parse";
import {
  launchQuickSend,
  quickSendTestRow,
  type SenderNumberOption,
} from "./actions";
import { QuickSendProgressDashboard } from "./progress-dashboard";

const CATEGORY_OPTIONS: {
  value: SabsmsMessageCategory;
  label: string;
  hint: string;
}[] = [
  { value: "transactional", label: "Transactional", hint: "Receipts, account updates" },
  { value: "otp", label: "OTP", hint: "One-time codes" },
  { value: "marketing", label: "Marketing", hint: "Requires explicit opt-in" },
  { value: "alert", label: "Alert", hint: "Critical notifications" },
  { value: "service", label: "Service", hint: "General service messages" },
];

const PASTE_PLACEHOLDER = [
  "Newline-separated:",
  "+15551234567",
  "+447911123456",
  "",
  "Or comma-separated on one line:",
  "+15551234567, +447911123456",
  "",
  "Or TSV/CSV with a header row:",
  "phone\tfirst_name\torder_id",
  "+15551234567\tAlice\tORD-1",
].join("\n");

// Indicative wholesale price per segment in cents — used purely for the
// cost-confirmation modal and per-row preview. The engine is the source
// of truth at send time.
const ESTIMATED_PRICE_PER_SEGMENT_CENTS = 0.75;

// Coarse quiet-hours flag: a row is "in quiet hours" if the country's
// rough offset puts the current wall-clock outside 09:00-20:00. This is
// a UX hint, not a compliance gate — the engine does the real check.
const COUNTRY_OFFSETS: Record<string, number> = {
  "1": -5, // US/Canada → ET as a stand-in
  "44": 0,
  "91": 5.5,
  "33": 1,
  "49": 1,
  "61": 10,
  "81": 9,
  "86": 8,
};

function inQuietHours(phone: string): boolean {
  if (!phone.startsWith("+")) return false;
  // Match the longest known country code prefix (1-3 digits).
  for (const cc of Object.keys(COUNTRY_OFFSETS).sort(
    (a, b) => b.length - a.length,
  )) {
    if (phone.startsWith(`+${cc}`)) {
      const offset = COUNTRY_OFFSETS[cc];
      const utc = new Date();
      const localHours =
        (utc.getUTCHours() + offset + 24) % 24;
      return localHours < 9 || localHours >= 20;
    }
  }
  return false;
}

export interface QuickSendClientProps {
  workspaceId: string;
  senderNumbers: SenderNumberOption[];
}

type LaunchState =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "running"; runId: string }
  | { kind: "error"; message: string };

export function QuickSendClient({
  workspaceId,
  senderNumbers,
}: QuickSendClientProps) {
  const [paste, setPaste] = React.useState("");
  const [body, setBody] = React.useState("");
  const [category, setCategory] = React.useState<SabsmsMessageCategory>("transactional");
  const [marketingAttested, setMarketingAttested] = React.useState(false);
  const [senderNumberId, setSenderNumberId] = React.useState<string>("");
  const [throttle, setThrottle] = React.useState(5);
  const [dryRun, setDryRun] = React.useState(false);
  const [skipSuppressed, setSkipSuppressed] = React.useState(true);
  const [skipSentToday, setSkipSentToday] = React.useState(false);

  const [tendlcCampaignId, setTendlcCampaignId] = React.useState("");
  const [dltTemplateId, setDltTemplateId] = React.useState("");
  const [testVarsStr, setTestVarsStr] = React.useState("");

  const [costConfirmOpen, setCostConfirmOpen] = React.useState(false);
  const [launchState, setLaunchState] = React.useState<LaunchState>({ kind: "idle" });

  const [testTo, setTestTo] = React.useState("");
  const [testResult, setTestResult] = React.useState<string | null>(null);

  const parsed: ParseResult = React.useMemo(
    () => parseRecipientList(paste),
    [paste],
  );

  const previewRows = React.useMemo(
    () =>
      parsed.rows.slice(0, 25).map((r) => ({
        ...r,
        rendered: interpolateBody(body, r.vars),
        seg: segmentCount(interpolateBody(body, r.vars)),
        quiet: inQuietHours(r.phone),
      })),
    [parsed.rows, body],
  );

  const totalSegments = React.useMemo(
    () =>
      parsed.rows.reduce(
        (acc, r) => acc + segmentCount(interpolateBody(body, r.vars)).segments,
        0,
      ),
    [parsed.rows, body],
  );

  const totalCostCents = totalSegments * ESTIMATED_PRICE_PER_SEGMENT_CENTS;
  const totalCostDollars = totalCostCents / 100;

  const needsCostConfirm =
    totalCostDollars > 5 || totalSegments > 100;

  const activeSender = senderNumberId ? senderNumbers.find((n) => n.id === senderNumberId) : null;
  const requires10DLC = activeSender?.country === "US" || (!activeSender && parsed.rows.some((r) => r.phone.startsWith("+1")));
  const requiresDLT = activeSender?.country === "IN" || (!activeSender && parsed.rows.some((r) => r.phone.startsWith("+91")));

  const canLaunch =
    parsed.rows.length > 0 &&
    body.trim().length > 0 &&
    launchState.kind !== "submitting" &&
    launchState.kind !== "running" &&
    (category !== "marketing" || marketingAttested) &&
    (!requires10DLC || tendlcCampaignId.trim().length > 0) &&
    (!requiresDLT || dltTemplateId.trim().length > 0);

  const launchLabel =
    launchState.kind === "submitting"
      ? "Launching…"
      : dryRun
        ? `Dry-run ${parsed.rows.length}`
        : `Launch send to ${parsed.rows.length}`;

  async function doLaunch() {
    setLaunchState({ kind: "submitting" });
    const res = await launchQuickSend({
      rows: parsed.rows,
      body,
      category,
      senderNumberId: senderNumberId || undefined,
      throttlePerSecond: throttle,
      dryRun,
      skipSuppressed,
      skipSentToday,
      marketingAttested,
      tendlcCampaignId,
      dltTemplateId,
    });
    if (!res.ok) {
      setLaunchState({ kind: "error", message: res.error });
      return;
    }
    setLaunchState({ kind: "running", runId: res.runId });
  }

  async function handleLaunchClick() {
    if (!canLaunch) return;
    if (needsCostConfirm && !dryRun) {
      setCostConfirmOpen(true);
      return;
    }
    await doLaunch();
  }

  async function handleTestSend() {
    const target = testTo || parsed.rows[0]?.phone;
    if (!target) {
      setTestResult("Pick a recipient (test field or paste at least one row).");
      return;
    }
    
    let manualVars = {};
    if (testVarsStr.trim()) {
      try {
        manualVars = JSON.parse(testVarsStr);
      } catch {
        setTestResult("Test failed: Test variables must be valid JSON.");
        return;
      }
    }
    const sampleVars = testVarsStr.trim() ? manualVars : (parsed.rows[0]?.vars ?? {});

    const res = await quickSendTestRow({
      to: target,
      body: interpolateBody(body, sampleVars),
      category,
    });
    if (!res.ok) {
      setTestResult(`Test failed: ${res.error}`);
      return;
    }
    setTestResult(`Test queued — ${res.id} (${res.status})`);
  }

  // Cmd/Ctrl+Enter to launch.
  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        if (canLaunch) {
          void handleLaunchClick();
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canLaunch, needsCostConfirm, dryRun]);

  if (launchState.kind === "running") {
    return (
      <QuickSendProgressDashboard
        runId={launchState.runId}
        body={body}
        category={category}
        senderNumberId={senderNumberId || undefined}
        throttlePerSecond={throttle}
        onClose={() => setLaunchState({ kind: "idle" })}
      />
    );
  }

  const saveAsCampaignHref =
    parsed.rows.length > 0
      ? `/sabsms/campaigns/new?prefillFromQuickSend=1&category=${encodeURIComponent(category)}`
      : "/sabsms/campaigns/new";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SabsmsKbdHint
          shortcuts={[
            { keys: ["⌘", "↵"], description: "Launch send" },
            { keys: ["?"], description: "Open shortcut list" },
          ]}
        />
        <div className="flex items-center gap-2 text-xs text-zoru-ink">
          <span>Workspace:</span>
          <code className="rounded bg-zoru-surface-2 px-2 py-0.5">{workspaceId}</code>
        </div>
      </div>

      <Card>
        <ZoruCardHeader>
          <ZoruCardTitle>Recipients</ZoruCardTitle>
          <ZoruCardDescription>
            Paste E.164 numbers (newline / comma) or a TSV/CSV with a
            `phone` header to bind variables. Phones are normalised and
            deduped on the fly.
          </ZoruCardDescription>
        </ZoruCardHeader>
        <ZoruCardContent className="space-y-4">
          <Textarea
            id="quick-send-paste"
            rows={8}
            value={paste}
            onChange={(e) => setPaste(e.target.value)}
            placeholder={PASTE_PLACEHOLDER}
            className="font-mono text-xs"
          />
          <div className="flex flex-wrap gap-3 text-xs text-zoru-ink">
            <Badge variant="default">{parsed.rows.length} valid</Badge>
            {parsed.errors.length > 0 && (
              <Badge variant="destructive">
                {parsed.errors.length} problem
                {parsed.errors.length === 1 ? "" : "s"}
              </Badge>
            )}
            {parsed.variableColumns && (
              <Badge variant="secondary">
                vars: {parsed.variableColumns.join(", ")}
              </Badge>
            )}
          </div>
          {parsed.errors.length > 0 && (
            <details className="rounded border border-zoru-line bg-zoru-surface-2 p-3 text-xs text-zoru-ink">
              <summary className="cursor-pointer font-medium">
                {parsed.errors.length} parse issue
                {parsed.errors.length === 1 ? "" : "s"} (click to expand)
              </summary>
              <ul className="mt-2 space-y-1">
                {parsed.errors.slice(0, 50).map((e, i) => (
                  <li key={i}>
                    Line {e.line} — {e.kind}: {e.message}
                  </li>
                ))}
                {parsed.errors.length > 50 && (
                  <li className="text-zoru-ink">
                    …and {parsed.errors.length - 50} more
                  </li>
                )}
              </ul>
            </details>
          )}
        </ZoruCardContent>
      </Card>

      <Card>
        <ZoruCardHeader>
          <ZoruCardTitle>Message</ZoruCardTitle>
          <ZoruCardDescription>
            Use <code>{`{{variable}}`}</code> placeholders to interpolate
            paste-row columns. The preview below renders one row per
            recipient.
          </ZoruCardDescription>
        </ZoruCardHeader>
        <ZoruCardContent className="space-y-4">
          <Textarea
            id="quick-send-body"
            rows={4}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Hi {{first_name}}, your order {{order_id}} is on its way."
          />
          <div className="flex flex-wrap items-center gap-3 text-xs text-zoru-ink">
            <span>{body.length} chars</span>
            <span>·</span>
            <span>{segmentCount(body).encoding}</span>
            <span>·</span>
            <span>
              {totalSegments} total segment{totalSegments === 1 ? "" : "s"}
            </span>
            <span>·</span>
            <span>est. ${totalCostDollars.toFixed(2)}</span>
          </div>
        </ZoruCardContent>
      </Card>

      <Card>
        <ZoruCardHeader>
          <ZoruCardTitle>Compliance</ZoruCardTitle>
          <ZoruCardDescription>
            Pick the message category. Marketing requires explicit TCPA
            attestation before launch.
          </ZoruCardDescription>
        </ZoruCardHeader>
        <ZoruCardContent className="space-y-4">
          <RadioGroup
            value={category}
            onValueChange={(v) => setCategory(v as SabsmsMessageCategory)}
            className="grid gap-2 md:grid-cols-5"
          >
            {CATEGORY_OPTIONS.map((c) => (
              <Label
                key={c.value}
                htmlFor={`category-${c.value}`}
                className="flex cursor-pointer items-start gap-2 rounded border border-zoru-line p-3"
              >
                <ZoruRadioGroupItem id={`category-${c.value}`} value={c.value} />
                <span>
                  <span className="block font-medium">{c.label}</span>
                  <span className="block text-[11px] text-zoru-ink">
                    {c.hint}
                  </span>
                </span>
              </Label>
            ))}
          </RadioGroup>

          {category === "marketing" && (
            <label className="flex items-start gap-2 rounded border border-zoru-line bg-zoru-surface-2 p-3 text-sm text-zoru-ink">
              <Checkbox
                checked={marketingAttested}
                onCheckedChange={(v) => setMarketingAttested(v === true)}
              />
              <span>
                I attest every recipient on this list has given prior
                express written consent to receive marketing SMS, per the
                TCPA (US) and equivalent local rules.
              </span>
            </label>
          )}

          {requires10DLC && (
            <div className="space-y-2 rounded border border-zoru-line p-3">
              <Label htmlFor="tendlc-campaign-id" className="text-sm font-medium">10DLC Campaign ID (US requirement)</Label>
              <Input
                id="tendlc-campaign-id"
                value={tendlcCampaignId}
                onChange={(e) => setTendlcCampaignId(e.target.value)}
                placeholder="CXXXXXXXXXXXXX"
              />
              <p className="text-[11px] text-zoru-ink">
                Required for US outbound messages to comply with carrier A2P rules.
              </p>
            </div>
          )}

          {requiresDLT && (
            <div className="space-y-2 rounded border border-zoru-line p-3">
              <Label htmlFor="dlt-template-id" className="text-sm font-medium">DLT Template ID (India requirement)</Label>
              <Input
                id="dlt-template-id"
                value={dltTemplateId}
                onChange={(e) => setDltTemplateId(e.target.value)}
                placeholder="1000XXXXXXXXXXXXXXXXX"
              />
              <p className="text-[11px] text-zoru-ink">
                Required by TRAI for commercial messaging in India.
              </p>
            </div>
          )}
        </ZoruCardContent>
      </Card>

      <Card>
        <ZoruCardHeader>
          <ZoruCardTitle>Send options</ZoruCardTitle>
          <ZoruCardDescription>
            Throttle, sender pool, and pre-flight skip filters.
          </ZoruCardDescription>
        </ZoruCardHeader>
        <ZoruCardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="quick-send-throttle">
                Throttle — {throttle} msg/sec
              </Label>
              <Input
                id="quick-send-throttle"
                type="range"
                min={1}
                max={50}
                value={throttle}
                onChange={(e) => setThrottle(Number(e.target.value))}
              />
              <p className="text-xs text-zoru-ink">
                Caps the engine enqueue rate. Range 1-50/sec.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="quick-send-sender">Sender pool</Label>
              <Select
                value={senderNumberId || "default"}
                onValueChange={(v) =>
                  setSenderNumberId(v === "default" ? "" : v)
                }
              >
                <ZoruSelectTrigger id="quick-send-sender">
                  <ZoruSelectValue />
                </ZoruSelectTrigger>
                <ZoruSelectContent>
                  <ZoruSelectItem value="default">
                    Workspace default
                  </ZoruSelectItem>
                  {senderNumbers.map((n) => (
                    <ZoruSelectItem key={n.id} value={n.id}>
                      {n.e164} ({n.country})
                    </ZoruSelectItem>
                  ))}
                </ZoruSelectContent>
              </Select>
              {senderNumbers.length === 0 && (
                <p className="text-xs text-zoru-ink">
                  No active numbers yet — falls back to the engine
                  default sender.
                </p>
              )}
            </div>
          </div>

          <Separator />

          <div className="grid gap-3 md:grid-cols-3">
            <label className="flex items-center justify-between rounded border border-zoru-line p-3 text-sm">
              <span>
                <span className="block font-medium">Dry-run preview</span>
                <span className="block text-xs text-zoru-ink">
                  No real sends — writes a dry-run audit entry only.
                </span>
              </span>
              <Switch checked={dryRun} onCheckedChange={setDryRun} />
            </label>

            <label className="flex items-center justify-between rounded border border-zoru-line p-3 text-sm">
              <span>
                <span className="block font-medium">Skip suppressed</span>
                <span className="block text-xs text-zoru-ink">
                  Check sabsms_suppressions per row.
                </span>
              </span>
              <Switch
                checked={skipSuppressed}
                onCheckedChange={setSkipSuppressed}
              />
            </label>

            <label className="flex items-center justify-between rounded border border-zoru-line p-3 text-sm">
              <span>
                <span className="block font-medium">Skip if sent today</span>
                <span className="block text-xs text-zoru-ink">
                  Re-checks last 24h of sabsms_messages.
                </span>
              </span>
              <Switch
                checked={skipSentToday}
                onCheckedChange={setSkipSentToday}
              />
            </label>
          </div>
        </ZoruCardContent>
      </Card>

      <Card>
        <ZoruCardHeader>
          <ZoruCardTitle>Per-row preview</ZoruCardTitle>
          <ZoruCardDescription>
            Shows the first 25 rendered rows. Quiet-hours flagged per
            country code.
          </ZoruCardDescription>
        </ZoruCardHeader>
        <ZoruCardContent>
          <div className="overflow-hidden rounded border border-zoru-line">
            <Table>
              <ZoruTableHeader>
                <ZoruTableRow>
                  <ZoruTableHead>Phone</ZoruTableHead>
                  <ZoruTableHead>Rendered body</ZoruTableHead>
                  <ZoruTableHead className="w-24">Segments</ZoruTableHead>
                  <ZoruTableHead className="w-32">Flags</ZoruTableHead>
                </ZoruTableRow>
              </ZoruTableHeader>
              <ZoruTableBody>
                {previewRows.map((row) => (
                  <ZoruTableRow key={`${row.sourceLine}-${row.phone}`}>
                    <ZoruTableCell className="font-mono text-xs">
                      {row.phone}
                    </ZoruTableCell>
                    <ZoruTableCell className="max-w-[420px] truncate text-xs">
                      {row.rendered}
                    </ZoruTableCell>
                    <ZoruTableCell className="font-mono text-xs">
                      {row.seg.segments} ({row.seg.encoding})
                    </ZoruTableCell>
                    <ZoruTableCell>
                      {row.quiet && (
                        <Badge variant="secondary">quiet hours</Badge>
                      )}
                    </ZoruTableCell>
                  </ZoruTableRow>
                ))}
                {previewRows.length === 0 && (
                  <ZoruTableRow>
                    <ZoruTableCell
                      colSpan={4}
                      className="py-8 text-center text-sm text-zoru-ink"
                    >
                      Paste at least one phone to see the preview.
                    </ZoruTableCell>
                  </ZoruTableRow>
                )}
              </ZoruTableBody>
            </Table>
          </div>
          {parsed.rows.length > 25 && (
            <p className="mt-2 text-xs text-zoru-ink">
              Showing 25 of {parsed.rows.length} rows.
            </p>
          )}
        </ZoruCardContent>
      </Card>

      <Card>
        <ZoruCardHeader>
          <ZoruCardTitle>Test send</ZoruCardTitle>
          <ZoruCardDescription>
            Drop one real message to a single recipient before the bulk
            run.
          </ZoruCardDescription>
        </ZoruCardHeader>
        <ZoruCardContent className="space-y-3">
          <div className="flex flex-wrap items-end gap-3">
            <div className="grow space-y-1">
              <Label htmlFor="quick-send-test-to">
                Test recipient (E.164, blank = first paste row)
              </Label>
              <Input
                id="quick-send-test-to"
                value={testTo}
                onChange={(e) => setTestTo(e.target.value)}
                placeholder="+15551234567"
              />
            </div>
            <div className="grow space-y-1">
              <Label htmlFor="quick-send-test-vars">
                Test variables (JSON, optional)
              </Label>
              <Input
                id="quick-send-test-vars"
                value={testVarsStr}
                onChange={(e) => setTestVarsStr(e.target.value)}
                placeholder='{"first_name": "Alice"}'
              />
            </div>
            <Button
              variant="outline"
              onClick={handleTestSend}
              disabled={!body.trim()}
            >
              Send test
            </Button>
          </div>
          {testResult && (
            <p className="rounded border border-zoru-line bg-zoru-surface-2 p-2 text-xs">
              {testResult}
            </p>
          )}
        </ZoruCardContent>
      </Card>

      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={handleLaunchClick} disabled={!canLaunch}>
          {launchLabel} <ZoruKbd className="ml-2">⌘ ↵</ZoruKbd>
        </Button>
        <Button variant="outline" asChild>
          <Link href={saveAsCampaignHref}>Save as campaign instead</Link>
        </Button>
        {launchState.kind === "error" && (
          <span className="rounded border border-zoru-line bg-zoru-surface-2 px-3 py-1 text-sm text-zoru-ink">
            {launchState.message}
          </span>
        )}
      </div>

      <ZoruAlertDialog open={costConfirmOpen} onOpenChange={setCostConfirmOpen}>
        <ZoruAlertDialogContent>
          <ZoruAlertDialogHeader>
            <ZoruAlertDialogTitle>Confirm spend</ZoruAlertDialogTitle>
            <ZoruAlertDialogDescription>
              This run is estimated at{" "}
              <strong>${totalCostDollars.toFixed(2)}</strong> across{" "}
              <strong>{totalSegments}</strong> segment
              {totalSegments === 1 ? "" : "s"} to{" "}
              <strong>{parsed.rows.length}</strong> recipient
              {parsed.rows.length === 1 ? "" : "s"}. The engine charges
              the final cost — this estimate uses a fixed wholesale rate.
            </ZoruAlertDialogDescription>
          </ZoruAlertDialogHeader>
          <ZoruAlertDialogFooter>
            <ZoruAlertDialogCancel>Cancel</ZoruAlertDialogCancel>
            <ZoruAlertDialogAction
              onClick={() => {
                setCostConfirmOpen(false);
                void doLaunch();
              }}
            >
              Confirm and launch
            </ZoruAlertDialogAction>
          </ZoruAlertDialogFooter>
        </ZoruAlertDialogContent>
      </ZoruAlertDialog>
    </div>
  );
}
