import Link from "next/link";
import { ObjectId } from "mongodb";
import { FileSearch, Inbox, Eye } from "lucide-react";

import {
  Badge,
  Button,
  Card,
  ZoruCardContent,
  ZoruCardDescription,
  ZoruCardHeader,
  ZoruCardTitle,
  EmptyState,
  ZoruPageActions,
  ZoruPageDescription,
  PageHeader,
  ZoruPageHeading,
  ZoruPageTitle,
  Table,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
  Dialog,
  ZoruDialogTrigger,
  ZoruDialogContent,
  ZoruDialogHeader,
  ZoruDialogTitle,
} from "@/components/zoruui";
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
  error?: string;
  rawJson: string;
}

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
    error: d.errorMessage,
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
  const workspaceId = String((session?.user as any)?._id ?? "");
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
        <ZoruPageHeading>
          <ZoruPageTitle>Message logs</ZoruPageTitle>
          <ZoruPageDescription>
            Every outbound and inbound message written by the engine.
          </ZoruPageDescription>
        </ZoruPageHeading>
        <ZoruPageActions>
          <Button asChild>
            <Link href="/sabsms/send">New send</Link>
          </Button>
        </ZoruPageActions>
      </PageHeader>

      <Card>
        <ZoruCardHeader className="flex flex-row items-center justify-between gap-3">
          <div>
            <ZoruCardTitle>Recent activity</ZoruCardTitle>
            <ZoruCardDescription>
              Newest first. Click a row to copy the message id.
            </ZoruCardDescription>
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
        </ZoruCardHeader>
        <ZoruCardContent className="p-0">
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
              <ZoruTableHeader>
                <ZoruTableRow>
                  <ZoruTableHead className="w-[110px]">Status</ZoruTableHead>
                  <ZoruTableHead className="w-[80px]">Dir</ZoruTableHead>
                  <ZoruTableHead className="w-[170px]">To</ZoruTableHead>
                  <ZoruTableHead>Body</ZoruTableHead>
                  <ZoruTableHead className="w-[90px]">Provider</ZoruTableHead>
                  <ZoruTableHead className="w-[60px] text-right">Seg</ZoruTableHead>
                  <ZoruTableHead className="w-[80px] text-right">Cost</ZoruTableHead>
                  <ZoruTableHead className="w-[150px]">When</ZoruTableHead>
                  <ZoruTableHead className="w-[50px]"></ZoruTableHead>
                </ZoruTableRow>
              </ZoruTableHeader>
              <ZoruTableBody>
                {rows.map((r) => (
                  <ZoruTableRow key={r.id}>
                    <ZoruTableCell>{statusBadge(r.status)}</ZoruTableCell>
                    <ZoruTableCell className="text-xs uppercase text-[var(--st-text)]">
                      {r.direction === "outbound" ? "→ out" : "← in"}
                    </ZoruTableCell>
                    <ZoruTableCell className="font-mono text-xs">
                      {r.direction === "outbound" ? r.to : r.from}
                    </ZoruTableCell>
                    <ZoruTableCell className="max-w-[420px] truncate text-sm text-[var(--st-text)]">
                      {r.body}
                      {r.error && (
                        <span className="ml-2 text-xs text-[var(--st-text)]">
                          ({r.error})
                        </span>
                      )}
                    </ZoruTableCell>
                    <ZoruTableCell className="text-xs">
                      {r.provider}
                    </ZoruTableCell>
                    <ZoruTableCell className="text-right text-xs">
                      {r.segments ?? "—"}
                    </ZoruTableCell>
                    <ZoruTableCell className="text-right text-xs">
                      {formatCost(r.cost, r.currency)}
                    </ZoruTableCell>
                    <ZoruTableCell className="text-xs text-[var(--st-text)]">
                      {formatTimestamp(
                        r.deliveredAt || r.sentAt || r.queuedAt,
                      )}
                    </ZoruTableCell>
                    <ZoruTableCell>
                      <Dialog>
                        <ZoruDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </ZoruDialogTrigger>
                        <ZoruDialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
                          <ZoruDialogHeader>
                            <ZoruDialogTitle>Message Payload</ZoruDialogTitle>
                          </ZoruDialogHeader>
                          <div className="flex-1 overflow-auto bg-[var(--st-text)] p-4 rounded-md mt-4">
                            <pre className="text-xs text-white font-mono">
                              {r.rawJson}
                            </pre>
                          </div>
                        </ZoruDialogContent>
                      </Dialog>
                    </ZoruTableCell>
                  </ZoruTableRow>
                ))}
              </ZoruTableBody>
            </Table>
          )}
        </ZoruCardContent>
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
