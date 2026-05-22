"use client";

import * as React from "react";

import {
  Badge,
  Button,
  Card,
  ZoruCardContent,
  ZoruCardHeader,
  ZoruCardTitle,
  Progress,
  Table,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
} from "@/components/zoruui";
import {
  SabsmsDetailDrawer,
  SabsmsExportMenu,
  SabsmsRefreshButton,
  rowsToCsv,
} from "@/components/sabsms/page-toolkit";

import {
  getQuickSendStatus,
  reattemptFailures,
  setQuickSendStatus,
  type QuickSendRowResult,
  type QuickSendRunDoc,
} from "./actions";

import type { SabsmsMessageCategory } from "@/lib/sabsms/types";

export interface QuickSendProgressProps {
  runId: string;
  body: string;
  category: SabsmsMessageCategory;
  senderNumberId?: string;
  throttlePerSecond: number;
  onClose: () => void;
}

function statusBadgeVariant(
  s: QuickSendRowResult["status"],
): "default" | "destructive" | "secondary" {
  if (s === "queued" || s === "dry_run") return "default";
  if (s === "failed") return "destructive";
  return "secondary";
}

const POLL_MS = 2000;

export function QuickSendProgressDashboard({
  runId,
  body,
  category,
  senderNumberId,
  throttlePerSecond,
  onClose,
}: QuickSendProgressProps) {
  const [run, setRun] = React.useState<QuickSendRunDoc | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState<null | "pause" | "resume" | "cancel" | "retry">(null);
  const [drawerRow, setDrawerRow] = React.useState<QuickSendRowResult | null>(null);

  const fetchStatus = React.useCallback(async () => {
    const res = await getQuickSendStatus(runId);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setError(null);
    setRun(res.run);
  }, [runId]);

  // Initial fetch + 2s poll until terminal.
  React.useEffect(() => {
    void fetchStatus();
    const handle = window.setInterval(() => {
      void fetchStatus();
    }, POLL_MS);
    return () => window.clearInterval(handle);
  }, [fetchStatus]);

  const terminal =
    run?.status === "completed" || run?.status === "cancelled";

  const processed = run
    ? run.queued + run.skipped + run.failed
    : 0;
  const pct = run && run.total > 0 ? (processed / run.total) * 100 : 0;

  async function handlePause() {
    setBusy("pause");
    await setQuickSendStatus(runId, "paused");
    await fetchStatus();
    setBusy(null);
  }
  async function handleResume() {
    setBusy("resume");
    await setQuickSendStatus(runId, "running");
    await fetchStatus();
    setBusy(null);
  }
  async function handleCancel() {
    setBusy("cancel");
    await setQuickSendStatus(runId, "cancelled");
    await fetchStatus();
    setBusy(null);
  }
  async function handleReattempt() {
    setBusy("retry");
    const res = await reattemptFailures({
      runId,
      body,
      category,
      senderNumberId,
      throttlePerSecond,
    });
    setBusy(null);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    // Caller decides what to do — for now we just note the new id.
    setError(`Re-attempt queued (runId ${res.runId})`);
  }

  async function exportFailuresCsv(): Promise<string> {
    if (!run) return "";
    const failures = run.results.filter((r) => r.status === "failed");
    return rowsToCsv(
      failures.map((f) => ({
        line: f.sourceLine,
        phone: f.phone,
        status: f.status,
        error: f.error ?? "",
      })),
      [
        { key: "line", header: "source_line" },
        { key: "phone", header: "phone" },
        { key: "status", header: "status" },
        { key: "error", header: "error" },
      ],
    );
  }

  return (
    <Card>
      <ZoruCardHeader className="flex flex-row items-start justify-between gap-3">
        <div className="space-y-1">
          <ZoruCardTitle>Run progress</ZoruCardTitle>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
            <code className="rounded bg-slate-100 px-2 py-0.5">{runId}</code>
            {run && (
              <Badge variant={terminal ? "secondary" : "default"}>
                {run.status}
              </Badge>
            )}
            {run?.dryRun && <Badge variant="secondary">dry-run</Badge>}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SabsmsRefreshButton onRefresh={fetchStatus} defaultInterval={10} />
          <SabsmsExportMenu
            toCsv={exportFailuresCsv}
            filename={`sabsms-quick-send-failures-${runId}`}
          />
          <Button variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </ZoruCardHeader>
      <ZoruCardContent className="space-y-4">
        {error && (
          <p className="rounded border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
            {error}
          </p>
        )}

        <div>
          <Progress value={pct} />
          <div className="mt-2 flex flex-wrap gap-4 text-xs text-slate-600">
            <span>
              {processed} / {run?.total ?? 0} processed
            </span>
            <span>queued: {run?.queued ?? 0}</span>
            <span>skipped: {run?.skipped ?? 0}</span>
            <span className="text-rose-600">failed: {run?.failed ?? 0}</span>
            <span>throttle: {run?.throttlePerSecond ?? 0}/s</span>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {run?.status === "running" && (
            <Button
              variant="outline"
              size="sm"
              onClick={handlePause}
              disabled={busy !== null}
            >
              Pause
            </Button>
          )}
          {run?.status === "paused" && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleResume}
              disabled={busy !== null}
            >
              Resume
            </Button>
          )}
          {!terminal && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleCancel}
              disabled={busy !== null}
            >
              Cancel
            </Button>
          )}
          {terminal && (run?.failed ?? 0) > 0 && (
            <Button
              size="sm"
              onClick={handleReattempt}
              disabled={busy !== null}
            >
              Re-attempt failures
            </Button>
          )}
        </div>

        <div className="overflow-hidden rounded border border-slate-200">
          <Table>
            <ZoruTableHeader>
              <ZoruTableRow>
                <ZoruTableHead className="w-16">Line</ZoruTableHead>
                <ZoruTableHead>Phone</ZoruTableHead>
                <ZoruTableHead>Status</ZoruTableHead>
                <ZoruTableHead>Detail</ZoruTableHead>
              </ZoruTableRow>
            </ZoruTableHeader>
            <ZoruTableBody>
              {(run?.results ?? []).slice(-50).reverse().map((r, idx) => (
                <ZoruTableRow key={`${r.sourceLine}-${r.phone}-${idx}`}>
                  <ZoruTableCell className="font-mono text-xs">
                    {r.sourceLine}
                  </ZoruTableCell>
                  <ZoruTableCell className="font-mono text-xs">
                    {r.phone}
                  </ZoruTableCell>
                  <ZoruTableCell>
                    <Badge variant={statusBadgeVariant(r.status)}>
                      {r.status}
                    </Badge>
                  </ZoruTableCell>
                  <ZoruTableCell className="max-w-[320px] truncate text-xs text-slate-600">
                    {r.status === "failed" ? (
                      <button
                        type="button"
                        className="text-rose-700 underline"
                        onClick={() => setDrawerRow(r)}
                      >
                        {r.error ?? "view"}
                      </button>
                    ) : (
                      r.messageId ?? ""
                    )}
                  </ZoruTableCell>
                </ZoruTableRow>
              ))}
              {!run?.results.length && (
                <ZoruTableRow>
                  <ZoruTableCell
                    colSpan={4}
                    className="py-8 text-center text-sm text-slate-500"
                  >
                    Waiting for the first row to land…
                  </ZoruTableCell>
                </ZoruTableRow>
              )}
            </ZoruTableBody>
          </Table>
        </div>

        <SabsmsDetailDrawer
          open={drawerRow !== null}
          onOpenChange={(o) => !o && setDrawerRow(null)}
          title="Row failure detail"
          description={drawerRow?.phone}
        >
          {drawerRow && (
            <div className="space-y-3 text-sm">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Source line
                </div>
                <div className="font-mono">{drawerRow.sourceLine}</div>
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Phone
                </div>
                <div className="font-mono">{drawerRow.phone}</div>
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Status
                </div>
                <Badge variant="destructive">{drawerRow.status}</Badge>
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Error
                </div>
                <pre className="overflow-x-auto rounded bg-slate-50 p-2 text-xs">
                  {drawerRow.error ?? "(none)"}
                </pre>
              </div>
            </div>
          )}
        </SabsmsDetailDrawer>
      </ZoruCardContent>
    </Card>
  );
}
