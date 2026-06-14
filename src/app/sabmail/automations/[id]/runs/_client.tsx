"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Activity,
  CheckCircle2,
  Clock,
  Mail,
  Route,
  Split,
  TriangleAlert,
  X,
} from "lucide-react";

import {
  Badge,
  Button,
  EmptyState,
  Table,
  TBody,
  THead,
  Td,
  Th,
  Tr,
} from "@/components/sabcrm/20ui";

/** Subset of the 20ui Badge variant union we map run statuses onto. */
type RunBadgeVariant = "info" | "success" | "destructive" | "outline";

import type {
  SabmailJourneyRunHistoryRow,
  SabmailJourneyRunRow,
  SabmailJourneyRunStats,
} from "../../runs-actions";
import "@/components/sabmail/motion/sabmail-motion.css";

/* ──────────────────────────────────────────────────────────────────────
 * SabMail — per-run journey analytics surface (native 20ui).
 *
 * Renders the rich `history[]` the journey engine captures per enrolled
 * person but never exposed: a KPI row (active / completed / failed / total),
 * a runs table (person · status · current step · next run · enrolled-at ·
 * history count), and a click-through side detail showing the full timeline
 * as `.sabmail-listrow` rows. Everything themes through `--st-*` tokens so it
 * works in both light + dark.
 * ──────────────────────────────────────────────────────────────────── */

const STATUS_META: Record<
  SabmailJourneyRunRow["status"],
  { label: string; variant: RunBadgeVariant }
> = {
  active: { label: "Active", variant: "info" },
  completed: { label: "Completed", variant: "success" },
  failed: { label: "Failed", variant: "destructive" },
};

/** Icon + accent per history action verb (drives the timeline rail dot). */
const ACTION_META: Record<
  string,
  { icon: React.ComponentType<{ className?: string }>; tone: string }
> = {
  enrolled: { icon: Route, tone: "var(--st-text-secondary)" },
  sent: { icon: Mail, tone: "var(--st-primary, #6366f1)" },
  waited: { icon: Clock, tone: "var(--st-warning, #d97706)" },
  branched: { icon: Split, tone: "var(--st-info, #2563eb)" },
  skipped: { icon: Split, tone: "var(--st-text-secondary)" },
  completed: { icon: CheckCircle2, tone: "var(--st-success, #16a34a)" },
  failed: { icon: TriangleAlert, tone: "var(--st-danger, #dc2626)" },
};

function actionMeta(action: string) {
  return ACTION_META[action] ?? { icon: Activity, tone: "var(--st-text-secondary)" };
}

/** Best-effort relative + absolute timestamp formatting (locale, no deps). */
function formatWhen(iso: string | null): { rel: string; abs: string } {
  if (!iso) return { rel: "—", abs: "" };
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { rel: "—", abs: iso };
  const abs = d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  const diff = Date.now() - d.getTime();
  const future = diff < 0;
  const mins = Math.round(Math.abs(diff) / 60_000);
  let rel: string;
  if (mins < 1) rel = "just now";
  else if (mins < 60) rel = `${mins}m`;
  else if (mins < 1440) rel = `${Math.round(mins / 60)}h`;
  else rel = `${Math.round(mins / 1440)}d`;
  if (mins >= 1) rel = future ? `in ${rel}` : `${rel} ago`;
  return { rel, abs };
}

/* ── KPI tile ─────────────────────────────────────────────────────────── */

function Kpi({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  tone?: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-[var(--st-border)] bg-[var(--st-bg)] px-4 py-3">
      <span
        className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[var(--st-bg-muted)]"
        style={{ color: tone ?? "var(--st-text-secondary)" }}
      >
        <Icon className="h-4 w-4" aria-hidden />
      </span>
      <div className="min-w-0">
        <div className="text-xl font-semibold leading-none text-[var(--st-text)] tabular-nums">
          {value.toLocaleString()}
        </div>
        <div className="mt-1 truncate text-xs text-[var(--st-text-secondary)]">{label}</div>
      </div>
    </div>
  );
}

/* ── timeline (detail rail) ───────────────────────────────────────────── */

function Timeline({ entries }: { entries: SabmailJourneyRunHistoryRow[] }) {
  if (entries.length === 0) {
    return (
      <p className="px-1 py-6 text-center text-sm text-[var(--st-text-secondary)]">
        No history recorded for this run yet.
      </p>
    );
  }
  return (
    <ol className="sabmail-motion flex flex-col gap-1.5">
      {entries.map((entry, idx) => {
        const meta = actionMeta(entry.action);
        const Icon = meta.icon;
        const when = formatWhen(entry.at);
        return (
          <li
            key={`${entry.at}-${idx}`}
            className="sabmail-stagger-item sabmail-listrow flex items-start gap-3 rounded-lg border border-[var(--st-border)] px-3 py-2.5"
            style={{ ["--i" as string]: idx } as React.CSSProperties}
          >
            <span
              className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[var(--st-bg-muted)]"
              style={{ color: meta.tone }}
            >
              <Icon className="h-3.5 w-3.5" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="text-sm font-medium capitalize text-[var(--st-text)]">
                  {entry.action || entry.type}
                </span>
                <time
                  className="shrink-0 text-xs text-[var(--st-text-secondary)] tabular-nums"
                  title={when.abs}
                >
                  {when.abs || when.rel}
                </time>
              </div>
              <div className="mt-0.5 truncate text-xs text-[var(--st-text-secondary)]">
                {entry.type}
                {entry.nodeId ? ` · ${entry.nodeId}` : ""}
              </div>
              {entry.detail ? (
                <div className="mt-1 break-words rounded-md bg-[var(--st-bg-muted)] px-2 py-1 text-xs text-[var(--st-text-secondary)]">
                  {entry.detail}
                </div>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/* ── main surface ─────────────────────────────────────────────────────── */

export function SabmailJourneyRunsClient({
  journeyId,
  journeyName,
  journeyEnabled,
  stats,
  runs,
}: {
  journeyId: string;
  journeyName: string;
  journeyEnabled: boolean;
  stats: SabmailJourneyRunStats;
  runs: SabmailJourneyRunRow[];
}) {
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const selected = React.useMemo(
    () => runs.find((r) => r.id === selectedId) ?? null,
    [runs, selectedId],
  );

  return (
    <div className="sabmail-canvas min-h-full p-4 sm:p-6">
      <div className="mx-auto w-full max-w-6xl">
        {/* ── pane header ── */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" iconLeft={ArrowLeft} asChild>
                <Link href={`/sabmail/automations/${journeyId}`}>Back to editor</Link>
              </Button>
            </div>
            <h1 className="mt-2 text-xl font-semibold text-[var(--st-text)]">Runs</h1>
            <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-[var(--st-text-secondary)]">
              <span className="truncate font-medium text-[var(--st-text)]">{journeyName}</span>
              <Badge variant={journeyEnabled ? "success" : "outline"}>
                {journeyEnabled ? "Enabled" : "Disabled"}
              </Badge>
              <span>Per-person enrolment history for this automation.</span>
            </p>
          </div>
        </div>

        {/* ── KPI row ── */}
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Kpi label="Active" value={stats.active} icon={Activity} tone="var(--st-info, #2563eb)" />
          <Kpi
            label="Completed"
            value={stats.completed}
            icon={CheckCircle2}
            tone="var(--st-success, #16a34a)"
          />
          <Kpi
            label="Failed"
            value={stats.failed}
            icon={TriangleAlert}
            tone="var(--st-danger, #dc2626)"
          />
          <Kpi label="Total enrolled" value={stats.total} icon={Route} />
        </div>

        {/* ── body: table + optional detail rail ── */}
        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="min-w-0 overflow-hidden rounded-xl border border-[var(--st-border)] bg-[var(--st-bg)]">
            {runs.length === 0 ? (
              <div className="p-6">
                <EmptyState
                  icon={<Route aria-hidden />}
                  title="No runs yet"
                  description={
                    journeyEnabled
                      ? "When people are enrolled into this automation, each run will appear here with its full step history."
                      : "This automation is disabled, so no one is being enrolled. Enable it to start collecting runs."
                  }
                />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <THead>
                    <Tr>
                      <Th>Person</Th>
                      <Th>Status</Th>
                      <Th>Current step</Th>
                      <Th>Next run</Th>
                      <Th>Enrolled</Th>
                      <Th align="right">History</Th>
                    </Tr>
                  </THead>
                  <TBody>
                    {runs.map((run) => {
                      const meta = STATUS_META[run.status];
                      const next = formatWhen(run.nextRunAt);
                      const enrolled = formatWhen(run.createdAt);
                      const isSelected = run.id === selectedId;
                      return (
                        <Tr
                          key={run.id}
                          selected={isSelected}
                          role="button"
                          tabIndex={0}
                          style={{ cursor: "pointer" }}
                          onClick={() => setSelectedId((cur) => (cur === run.id ? null : run.id))}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              setSelectedId((cur) => (cur === run.id ? null : run.id));
                            }
                          }}
                        >
                          <Td>
                            <span className="block max-w-[220px] truncate font-medium text-[var(--st-text)]">
                              {run.personEmail || "—"}
                            </span>
                          </Td>
                          <Td>
                            <Badge variant={meta.variant}>{meta.label}</Badge>
                          </Td>
                          <Td>
                            <span className="block max-w-[160px] truncate text-[var(--st-text-secondary)]">
                              {run.currentNodeId ?? "—"}
                            </span>
                          </Td>
                          <Td>
                            <span
                              className="text-[var(--st-text-secondary)] tabular-nums"
                              title={next.abs}
                            >
                              {run.nextRunAt ? next.rel : "—"}
                            </span>
                          </Td>
                          <Td>
                            <span
                              className="text-[var(--st-text-secondary)] tabular-nums"
                              title={enrolled.abs}
                            >
                              {enrolled.rel}
                            </span>
                          </Td>
                          <Td align="right">
                            <span className="inline-flex items-center gap-1.5 text-[var(--st-text-secondary)]">
                              <Activity className="h-3.5 w-3.5" aria-hidden />
                              <span className="tabular-nums">{run.history.count}</span>
                            </span>
                          </Td>
                        </Tr>
                      );
                    })}
                  </TBody>
                </Table>
              </div>
            )}
          </div>

          {/* ── detail rail (timeline for the selected run) ── */}
          {selected ? (
            <aside className="sabmail-motion h-fit rounded-xl border border-[var(--st-border)] bg-[var(--st-bg)] p-4 lg:sticky lg:top-6">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-xs uppercase tracking-wide text-[var(--st-text-secondary)]">
                    Run history
                  </div>
                  <div className="mt-1 truncate text-sm font-semibold text-[var(--st-text)]">
                    {selected.personEmail || "—"}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <Badge variant={STATUS_META[selected.status].variant}>
                      {STATUS_META[selected.status].label}
                    </Badge>
                    <span className="text-xs text-[var(--st-text-secondary)]">
                      {selected.history.count} step
                      {selected.history.count === 1 ? "" : "s"}
                    </span>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  iconLeft={X}
                  aria-label="Close run history"
                  onClick={() => setSelectedId(null)}
                />
              </div>

              <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 border-y border-[var(--st-border)] py-3 text-xs">
                <div className="min-w-0">
                  <dt className="text-[var(--st-text-secondary)]">Current step</dt>
                  <dd className="mt-0.5 truncate text-[var(--st-text)]">
                    {selected.currentNodeId ?? "—"}
                  </dd>
                </div>
                <div className="min-w-0">
                  <dt className="text-[var(--st-text-secondary)]">Next run</dt>
                  <dd className="mt-0.5 truncate text-[var(--st-text)]">
                    {selected.nextRunAt ? formatWhen(selected.nextRunAt).abs : "—"}
                  </dd>
                </div>
                <div className="min-w-0">
                  <dt className="text-[var(--st-text-secondary)]">Enrolled</dt>
                  <dd className="mt-0.5 truncate text-[var(--st-text)]">
                    {formatWhen(selected.createdAt).abs}
                  </dd>
                </div>
                <div className="min-w-0">
                  <dt className="text-[var(--st-text-secondary)]">Last activity</dt>
                  <dd className="mt-0.5 truncate text-[var(--st-text)]">
                    {formatWhen(selected.updatedAt).abs}
                  </dd>
                </div>
              </dl>

              <div className="mt-3 max-h-[60vh] overflow-y-auto pr-1">
                <Timeline entries={selected.timeline} />
              </div>
            </aside>
          ) : runs.length > 0 ? (
            <aside className="hidden h-fit rounded-xl border border-dashed border-[var(--st-border)] bg-[var(--st-bg)] p-6 text-center lg:sticky lg:top-6 lg:block">
              <span className="mx-auto grid h-10 w-10 place-items-center rounded-full bg-[var(--st-bg-muted)] text-[var(--st-text-secondary)]">
                <Activity className="h-5 w-5" aria-hidden />
              </span>
              <p className="mt-3 text-sm font-medium text-[var(--st-text)]">Select a run</p>
              <p className="mt-1 text-xs text-[var(--st-text-secondary)]">
                Pick a row to see its full step-by-step history.
              </p>
            </aside>
          ) : null}
        </div>
      </div>
    </div>
  );
}
