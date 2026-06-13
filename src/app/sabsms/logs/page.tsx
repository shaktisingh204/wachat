import { getSabsmsWorkspaceId } from "@/lib/sabsms/workspace";
import Link from "next/link";
import { ObjectId } from "mongodb";
import { FileSearch, Inbox, Eye } from "lucide-react";

import { Badge, Button, Card, CardBody, CardDescription, CardHeader, CardTitle, EmptyState, PageActions, PageDescription, PageHeader, PageHeading, PageTitle, Table, TBody, Td, Th, THead, Tr, Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle } from '@/components/sabcrm/20ui';
import { getCachedSession } from "@/lib/server-cache";
import { SABSMS_COLLECTIONS } from "@/lib/sabsms/db/collections";
import { connectToDatabase } from "@/lib/mongodb";
import type { SabsmsMessageStatus } from "@/lib/sabsms/types";

export const dynamic = "force-dynamic";

interface LogRow {
  id: string;
  direction: "outbound" | "inbound";
  from: string;
  to: string;
  body: string;
  status: SabsmsMessageStatus;
  provider: string;
  segments?: number;
  cost?: number;
  currency?: string;
  queuedAt?: string;
  sentAt?: string;
  deliveredAt?: string;
  failedAt?: string;
  errorCode?: string;
  error?: string;
  attempts?: Array<{ at?: string; error?: string; status?: string }>;
  complianceTrace?: Array<{ check: string; verdict: string; detail?: string }>;
  rescheduledUntil?: string;
  rescheduleCode?: string;
  rawJson: string;
}

const VERDICT_VARIANT: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  allow: "default",
  skipped: "secondary",
  warn: "outline",
  block: "destructive",
  reschedule: "outline",
};

const PAGE_SIZE = 50;

async function loadLogs(
  workspaceId: string,
  statusFilter: string | undefined,
  cursor: string | undefined,
  dir: "next" | "prev" | undefined,
): Promise<{ rows: LogRow[]; hasNext: boolean; hasPrev: boolean }> {
  const { db } = await connectToDatabase();
  const col = db.collection(SABSMS_COLLECTIONS.messages);
  const filter: Record<string, unknown> = { workspaceId };
  if (statusFilter) filter.status = statusFilter;

  if (cursor) {
    try {
      if (dir === "prev") {
        filter._id = { $gt: new ObjectId(cursor) };
      } else {
        filter._id = { $lt: new ObjectId(cursor) };
      }
    } catch {
      // Invalid cursor ignored
    }
  }

  const sortDir = dir === "prev" ? 1 : -1;

  const docs = await col
    .find(filter)
    .sort({ _id: sortDir })
    .limit(PAGE_SIZE + 1)
    .toArray();

  let hasNext = false;
  let hasPrev = false;

  if (dir === "prev") {
    if (docs.length > PAGE_SIZE) {
      hasPrev = true;
      docs.pop();
    }
    docs.reverse();
    hasNext = true;
  } else {
    if (docs.length > PAGE_SIZE) {
      hasNext = true;
      docs.pop();
    }
    hasPrev = !!cursor;
  }

  const rows: LogRow[] = docs.map((d: any) => ({
    id: String(d._id),
    direction: d.direction,
    from: d.from,
    to: d.to,
    body: d.body,
    status: d.status,
    provider: d.provider,
    segments: d.segmentsCount,
    cost: d.cost,
    currency: d.currency,
    queuedAt: d.queuedAt ? new Date(d.queuedAt).toISOString() : undefined,
    sentAt: d.sentAt ? new Date(d.sentAt).toISOString() : undefined,
    deliveredAt: d.deliveredAt
      ? new Date(d.deliveredAt).toISOString()
      : undefined,
    failedAt: d.failedAt ? new Date(d.failedAt).toISOString() : undefined,
    errorCode: d.errorCode,
    error: d.errorMessage,
    attempts: Array.isArray(d.attempts)
      ? d.attempts.map((a: any) => ({
          at: a?.at || a?.attemptedAt
            ? new Date(a.at ?? a.attemptedAt).toISOString()
            : undefined,
          error: a?.error ?? a?.errorMessage,
          status: a?.status != null ? String(a.status) : undefined,
        }))
      : undefined,
    complianceTrace: Array.isArray(d.complianceTrace)
      ? d.complianceTrace.map((t: any) => ({
          check: String(t?.check ?? "—"),
          verdict: String(t?.verdict ?? "—"),
          detail: t?.detail != null ? String(t.detail) : undefined,
        }))
      : undefined,
    rescheduledUntil: d.rescheduledUntil
      ? new Date(d.rescheduledUntil).toISOString()
      : undefined,
    rescheduleCode: d.rescheduleCode != null ? String(d.rescheduleCode) : undefined,
    rawJson: JSON.stringify(d, null, 2),
  }));

  return { rows, hasNext, hasPrev };
}

function statusBadge(s: SabsmsMessageStatus) {
  const variant =
    s === "delivered" || s === "sent"
      ? ("default" as const)
      : s === "failed" || s === "rejected" || s === "undelivered"
        ? ("destructive" as const)
        : ("secondary" as const);
  return <Badge variant={variant}>{s}</Badge>;
}

function formatTimestamp(iso?: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatCost(c?: number, currency: string = "USD"): string {
  if (c === undefined || c === null) return "—";
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(c / 100);
}

const FILTERS: Array<{ value: string; label: string }> = [
  { value: "", label: "All" },
  { value: "queued", label: "Queued" },
  { value: "sent", label: "Sent" },
  { value: "delivered", label: "Delivered" },
  { value: "failed", label: "Failed" },
];

export default async function SabsmsLogsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; cursor?: string; dir?: "next" | "prev" }>;
}) {
  const sp = await searchParams;
  const session = await getCachedSession();
  const workspaceId = (await getSabsmsWorkspaceId()) ?? "";
  const statusFilter = sp.status || undefined;

  const { rows, hasNext, hasPrev } = workspaceId
    ? await loadLogs(workspaceId, statusFilter, sp.cursor, sp.dir)
    : { rows: [], hasNext: false, hasPrev: false };

  const buildHref = (next: { status?: string; cursor?: string; dir?: "next" | "prev"; clearCursor?: boolean }) => {
    const params = new URLSearchParams();
    const status = next.status ?? statusFilter;
    if (status) params.set("status", status);
    
    if (!next.clearCursor) {
      if (next.cursor) {
        params.set("cursor", next.cursor);
      }
      if (next.dir) {
        params.set("dir", next.dir);
      }
    }

    const q = params.toString();
    return q ? `/sabsms/logs?${q}` : "/sabsms/logs";
  };

  return (
    <div className="space-y-6 p-6">
      <PageHeader>
        <PageHeading>
          <PageTitle>Message logs</PageTitle>
          <PageDescription>
            Every outbound and inbound message written by the engine.
          </PageDescription>
        </PageHeading>
        <PageActions>
          <Button asChild>
            <Link href="/sabsms/send">New send</Link>
          </Button>
        </PageActions>
      </PageHeader>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <div>
            <CardTitle>Recent activity</CardTitle>
            <CardDescription>
              Newest first. Click a row to copy the message id.
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            {FILTERS.map((f) => {
              const active = (statusFilter ?? "") === f.value;
              return (
                <Button
                  asChild
                  key={f.value || "all"}
                  variant={active ? "default" : "outline"}
                  size="sm"
                >
                  <Link href={buildHref({ status: f.value, clearCursor: true })}>
                    {f.label}
                  </Link>
                </Button>
              );
            })}
          </div>
        </CardHeader>
        <CardBody className="p-0">
          {rows.length === 0 ? (
            <div className="p-10">
              <EmptyState
                icon={statusFilter ? <FileSearch /> : <Inbox />}
                title={
                  statusFilter
                    ? `No messages with status "${statusFilter}"`
                    : "No messages yet"
                }
                description="Send a test from the composer — it lands here as soon as the engine enqueues it."
                action={
                  <Button asChild>
                    <Link href="/sabsms/send">Open composer</Link>
                  </Button>
                }
              />
            </div>
          ) : (
            <Table>
              <THead>
                <Tr>
                  <Th className="w-[110px]">Status</Th>
                  <Th className="w-[80px]">Dir</Th>
                  <Th className="w-[170px]">To</Th>
                  <Th>Body</Th>
                  <Th className="w-[90px]">Provider</Th>
                  <Th className="w-[60px] text-right">Seg</Th>
                  <Th className="w-[80px] text-right">Cost</Th>
                  <Th className="w-[150px]">When</Th>
                  <Th className="w-[50px]"></Th>
                </Tr>
              </THead>
              <TBody>
                {rows.map((r) => (
                  <Tr key={r.id}>
                    <Td>{statusBadge(r.status)}</Td>
                    <Td className="text-xs uppercase text-[var(--st-text)]">
                      {r.direction === "outbound" ? "→ out" : "← in"}
                    </Td>
                    <Td className="font-mono text-xs">
                      {r.direction === "outbound" ? r.to : r.from}
                    </Td>
                    <Td className="max-w-[420px] truncate text-sm text-[var(--st-text)]">
                      {r.body}
                      {(r.errorCode || r.error) && (
                        <span className="ml-2 text-xs text-[var(--st-text)]">
                          ({r.errorCode ? `${r.errorCode}: ` : ""}
                          {r.error ?? "error"})
                        </span>
                      )}
                    </Td>
                    <Td className="text-xs">
                      {r.provider}
                    </Td>
                    <Td className="text-right text-xs">
                      {r.segments ?? "—"}
                    </Td>
                    <Td className="text-right text-xs">
                      {formatCost(r.cost, r.currency)}
                    </Td>
                    <Td className="text-xs text-[var(--st-text)]">
                      {formatTimestamp(
                        r.deliveredAt || r.sentAt || r.queuedAt,
                      )}
                    </Td>
                    <Td>
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
                          <DialogHeader>
                            <DialogTitle>Message detail</DialogTitle>
                          </DialogHeader>
                          <div className="flex-1 overflow-auto mt-4 space-y-4">
                            <div className="flex flex-wrap items-center gap-2 text-xs">
                              {statusBadge(r.status)}
                              <code className="rounded bg-[var(--st-bg-muted)] px-2 py-0.5">{r.id}</code>
                              <span className="text-[var(--st-text)]">{r.provider}</span>
                              {r.segments !== undefined && (
                                <span className="text-[var(--st-text)]">
                                  {r.segments} segment{r.segments === 1 ? "" : "s"}
                                </span>
                              )}
                            </div>

                            <div className="rounded-md border border-[var(--st-border)] p-3">
                              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--st-text)]">
                                Timeline
                              </div>
                              <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs sm:grid-cols-4">
                                {(
                                  [
                                    ["Queued", r.queuedAt],
                                    ["Sent", r.sentAt],
                                    ["Delivered", r.deliveredAt],
                                    ["Failed", r.failedAt],
                                  ] as const
                                ).map(([label, iso]) => (
                                  <div key={label}>
                                    <dt className="font-medium text-[var(--st-text)]">{label}</dt>
                                    <dd className="text-[var(--st-text-secondary)]">
                                      {formatTimestamp(iso)}
                                    </dd>
                                  </div>
                                ))}
                              </dl>
                            </div>

                            {(r.errorCode || r.error) && (
                              <div className="rounded-md border border-[var(--st-border)] bg-[var(--st-bg-muted)] p-3 text-xs">
                                <div className="mb-1 font-semibold uppercase tracking-wide text-[var(--st-text)]">
                                  Error
                                </div>
                                {r.errorCode && (
                                  <div>
                                    <span className="font-medium">Code:</span>{" "}
                                    <code>{r.errorCode}</code>
                                  </div>
                                )}
                                {r.error && <div className="mt-0.5">{r.error}</div>}
                              </div>
                            )}

                            {r.attempts && r.attempts.length > 0 && (
                              <div className="rounded-md border border-[var(--st-border)] p-3 text-xs">
                                <div className="mb-2 font-semibold uppercase tracking-wide text-[var(--st-text)]">
                                  Attempts ({r.attempts.length})
                                </div>
                                <ol className="space-y-1">
                                  {r.attempts.map((a, i) => (
                                    <li key={i} className="flex flex-wrap gap-2">
                                      <span className="font-medium">#{i + 1}</span>
                                      <span>{formatTimestamp(a.at)}</span>
                                      {a.status && <span>status: {a.status}</span>}
                                      {a.error && (
                                        <span className="text-[var(--st-text-secondary)]">{a.error}</span>
                                      )}
                                    </li>
                                  ))}
                                </ol>
                              </div>
                            )}

                            {r.complianceTrace && r.complianceTrace.length > 0 && (
                              <div className="rounded-md border border-[var(--st-border)] p-3 text-xs">
                                <div className="mb-2 font-semibold uppercase tracking-wide text-[var(--st-text)]">
                                  Compliance ({r.complianceTrace.length})
                                </div>
                                <ul className="space-y-1.5">
                                  {r.complianceTrace.map((t, i) => (
                                    <li
                                      key={`${t.check}-${i}`}
                                      className="flex flex-wrap items-baseline gap-2"
                                    >
                                      <Badge
                                        variant={VERDICT_VARIANT[t.verdict] ?? "secondary"}
                                        className="uppercase text-[10px]"
                                      >
                                        {t.verdict}
                                      </Badge>
                                      <span className="font-medium text-[var(--st-text)]">
                                        {t.check}
                                      </span>
                                      {t.detail && (
                                        <span className="text-[var(--st-text-secondary)]">
                                          {t.detail}
                                        </span>
                                      )}
                                    </li>
                                  ))}
                                </ul>
                                {(r.rescheduledUntil || r.rescheduleCode) && (
                                  <div className="mt-2 border-t border-[var(--st-border)] pt-2 text-[var(--st-text-secondary)]">
                                    {r.rescheduleCode && (
                                      <div>
                                        <span className="font-medium text-[var(--st-text)]">
                                          Reschedule reason:
                                        </span>{" "}
                                        <code>{r.rescheduleCode}</code>
                                      </div>
                                    )}
                                    {r.rescheduledUntil && (
                                      <div>
                                        <span className="font-medium text-[var(--st-text)]">
                                          Rescheduled until:
                                        </span>{" "}
                                        {formatTimestamp(r.rescheduledUntil)}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            )}

                            <details>
                              <summary className="cursor-pointer text-xs font-medium text-[var(--st-text)]">
                                Raw document
                              </summary>
                              <div className="mt-2 overflow-auto bg-[var(--st-text)] p-4 rounded-md">
                                <pre className="text-xs text-white font-mono">
                                  {r.rawJson}
                                </pre>
                              </div>
                            </details>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
          )}
        </CardBody>
      </Card>

      {(hasPrev || hasNext) && (
        <div className="flex items-center justify-end text-sm text-[var(--st-text)]">
          <div className="flex gap-2">
            <Button
              asChild={hasPrev}
              variant="outline"
              size="sm"
              disabled={!hasPrev}
            >
              {hasPrev ? (
                <Link href={buildHref({ cursor: rows[0]?.id, dir: "prev" })}>
                  Previous
                </Link>
              ) : (
                <span>Previous</span>
              )}
            </Button>
            <Button
              asChild={hasNext}
              variant="outline"
              size="sm"
              disabled={!hasNext}
            >
              {hasNext ? (
                <Link href={buildHref({ cursor: rows[rows.length - 1]?.id, dir: "next" })}>Next</Link>
              ) : (
                <span>Next</span>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
