import Link from "next/link";

import {
  ZoruBadge,
  ZoruButton,
  ZoruCard,
  ZoruCardContent,
  ZoruCardDescription,
  ZoruCardHeader,
  ZoruCardTitle,
  ZoruEmptyState,
  ZoruPageActions,
  ZoruPageDescription,
  ZoruPageHeader,
  ZoruPageHeading,
  ZoruPageTitle,
  ZoruTable,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
} from "@/components/zoruui";
import { getCachedSession } from "@/lib/server-cache";
import { SABSMS_COLLECTIONS } from "@/lib/sabsms/db/collections";
import { connectToDatabase } from "@/lib/mongodb";
import type { SabsmsMessageStatus } from "@/lib/sabsms/types";
import { FileSearch, Inbox } from "lucide-react";

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
  queuedAt?: string;
  sentAt?: string;
  deliveredAt?: string;
  error?: string;
}

const PAGE_SIZE = 50;

async function loadLogs(
  workspaceId: string,
  statusFilter: string | undefined,
  page: number,
): Promise<{ rows: LogRow[]; total: number }> {
  const { db } = await connectToDatabase();
  const col = db.collection(SABSMS_COLLECTIONS.messages);
  const filter: Record<string, unknown> = { workspaceId };
  if (statusFilter) filter.status = statusFilter;

  const [docs, total] = await Promise.all([
    col
      .find(filter)
      .sort({ createdAt: -1 })
      .skip(page * PAGE_SIZE)
      .limit(PAGE_SIZE)
      .toArray(),
    col.countDocuments(filter),
  ]);

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
    queuedAt: d.queuedAt ? new Date(d.queuedAt).toISOString() : undefined,
    sentAt: d.sentAt ? new Date(d.sentAt).toISOString() : undefined,
    deliveredAt: d.deliveredAt
      ? new Date(d.deliveredAt).toISOString()
      : undefined,
    error: d.errorMessage,
  }));

  return { rows, total };
}

function statusBadge(s: SabsmsMessageStatus) {
  const variant =
    s === "delivered" || s === "sent"
      ? ("default" as const)
      : s === "failed" || s === "rejected" || s === "undelivered"
        ? ("destructive" as const)
        : ("secondary" as const);
  return <ZoruBadge variant={variant}>{s}</ZoruBadge>;
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

function formatCost(c?: number): string {
  if (c === undefined || c === null) return "—";
  return `$${(c / 100).toFixed(4)}`;
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
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const session = await getCachedSession();
  const workspaceId = String((session?.user as any)?._id ?? "");
  const statusFilter = sp.status || undefined;
  const page = Math.max(0, parseInt(sp.page ?? "0", 10) || 0);

  const { rows, total } = workspaceId
    ? await loadLogs(workspaceId, statusFilter, page)
    : { rows: [], total: 0 };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const buildHref = (next: { status?: string; page?: number }) => {
    const params = new URLSearchParams();
    const status = next.status ?? statusFilter;
    if (status) params.set("status", status);
    const p = next.page ?? page;
    if (p > 0) params.set("page", String(p));
    const q = params.toString();
    return q ? `/sabsms/logs?${q}` : "/sabsms/logs";
  };

  return (
    <div className="space-y-6 p-6">
      <ZoruPageHeader>
        <ZoruPageHeading>
          <ZoruPageTitle>Message logs</ZoruPageTitle>
          <ZoruPageDescription>
            Every outbound and inbound message written by the engine.
            {total > 0 && (
              <>
                {" "}
                <span className="text-slate-500">
                  · {total.toLocaleString()} total
                </span>
              </>
            )}
          </ZoruPageDescription>
        </ZoruPageHeading>
        <ZoruPageActions>
          <ZoruButton asChild>
            <Link href="/sabsms/send">New send</Link>
          </ZoruButton>
        </ZoruPageActions>
      </ZoruPageHeader>

      <ZoruCard>
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
                <ZoruButton
                  asChild
                  key={f.value || "all"}
                  variant={active ? "default" : "outline"}
                  size="sm"
                >
                  <Link href={buildHref({ status: f.value, page: 0 })}>
                    {f.label}
                  </Link>
                </ZoruButton>
              );
            })}
          </div>
        </ZoruCardHeader>
        <ZoruCardContent className="p-0">
          {rows.length === 0 ? (
            <div className="p-10">
              <ZoruEmptyState
                icon={statusFilter ? <FileSearch /> : <Inbox />}
                title={
                  statusFilter
                    ? `No messages with status "${statusFilter}"`
                    : "No messages yet"
                }
                description="Send a test from the composer — it lands here as soon as the engine enqueues it."
                action={
                  <ZoruButton asChild>
                    <Link href="/sabsms/send">Open composer</Link>
                  </ZoruButton>
                }
              />
            </div>
          ) : (
            <ZoruTable>
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
                </ZoruTableRow>
              </ZoruTableHeader>
              <ZoruTableBody>
                {rows.map((r) => (
                  <ZoruTableRow key={r.id}>
                    <ZoruTableCell>{statusBadge(r.status)}</ZoruTableCell>
                    <ZoruTableCell className="text-xs uppercase text-slate-500">
                      {r.direction === "outbound" ? "→ out" : "← in"}
                    </ZoruTableCell>
                    <ZoruTableCell className="font-mono text-xs">
                      {r.direction === "outbound" ? r.to : r.from}
                    </ZoruTableCell>
                    <ZoruTableCell className="max-w-[420px] truncate text-sm text-slate-700">
                      {r.body}
                      {r.error && (
                        <span className="ml-2 text-xs text-rose-600">
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
                      {formatCost(r.cost)}
                    </ZoruTableCell>
                    <ZoruTableCell className="text-xs text-slate-500">
                      {formatTimestamp(
                        r.deliveredAt || r.sentAt || r.queuedAt,
                      )}
                    </ZoruTableCell>
                  </ZoruTableRow>
                ))}
              </ZoruTableBody>
            </ZoruTable>
          )}
        </ZoruCardContent>
      </ZoruCard>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-slate-600">
          <span>
            Page {page + 1} of {totalPages}
          </span>
          <div className="flex gap-2">
            <ZoruButton
              asChild
              variant="outline"
              size="sm"
              disabled={page === 0}
            >
              <Link href={buildHref({ page: Math.max(0, page - 1) })}>
                Previous
              </Link>
            </ZoruButton>
            <ZoruButton
              asChild
              variant="outline"
              size="sm"
              disabled={page + 1 >= totalPages}
            >
              <Link href={buildHref({ page: page + 1 })}>Next</Link>
            </ZoruButton>
          </div>
        </div>
      )}
    </div>
  );
}
