"use client";

import * as React from "react";
import { Inbox, RefreshCw, RotateCcw } from "lucide-react";

import {
  Badge,
  Button,
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyState,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Table,
  TBody,
  Td,
  Th,
  THead,
  Tr,
  useToast,
} from "@/components/sabcrm/20ui";

import { loadDeliveries, replayDelivery, type WebhookDeliveryRow } from "./actions";

/**
 * Real `sabsms_webhook_deliveries` rows — status, attempts, last HTTP
 * code, next retry, and a replay button that re-enqueues through the
 * production dispatcher. Shared by /sabsms/webhooks and
 * /sabsms/webhooks/log.
 */
export function DeliveriesPanel({
  webhookId,
  limit = 100,
}: {
  webhookId?: string;
  limit?: number;
}) {
  const { toast } = useToast();
  const [rows, setRows] = React.useState<WebhookDeliveryRow[] | null>(null);
  const [status, setStatus] = React.useState<string>("all");
  const [loading, setLoading] = React.useState(false);
  const [replayingId, setReplayingId] = React.useState<string | null>(null);
  const [expandedId, setExpandedId] = React.useState<string | null>(null);

  const fetchRows = React.useCallback(async () => {
    setLoading(true);
    const res = await loadDeliveries({
      webhookId,
      status: status === "all" ? undefined : status,
      limit,
    });
    if (res.ok) setRows(res.rows);
    else toast({ title: "Could not load deliveries", description: res.error, tone: "danger" });
    setLoading(false);
  }, [webhookId, status, limit, toast]);

  React.useEffect(() => {
    fetchRows();
  }, [fetchRows]);

  async function handleReplay(row: WebhookDeliveryRow) {
    setReplayingId(row.id);
    const res = await replayDelivery(row.id);
    setReplayingId(null);
    if (res.ok) {
      toast.success("Delivery re-enqueued and attempted");
      fetchRows();
    } else {
      toast({ title: "Replay failed", description: res.error, tone: "danger" });
    }
  }

  const statusTone = (s: WebhookDeliveryRow["status"]) =>
    s === "delivered" ? "success" : s === "failed" ? "danger" : "warning";

  return (
    <Card padding="none">
      <CardHeader className="border-b border-[var(--st-border)] px-5 py-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base font-semibold">Deliveries</CardTitle>
            <CardDescription className="mt-1 text-xs">
              Every webhook POST with its attempts and retry state. Failed deliveries retry on a
              30s → 5m → 1h → 6h backoff before going terminal.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger aria-label="Filter by status" className="h-8 w-[140px] text-xs">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="delivered">Delivered</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" iconLeft={RefreshCw} onClick={fetchRows} disabled={loading}>
              Refresh
            </Button>
          </div>
        </div>
      </CardHeader>

      {!rows || rows.length === 0 ? (
        <div className="p-8">
          <EmptyState
            icon={Inbox}
            title={loading ? "Loading deliveries…" : "No deliveries yet"}
            description="Webhook POSTs appear here as events fire (or use Test fire on an endpoint)."
          />
        </div>
      ) : (
        <div className="overflow-x-auto">
          <Table density="compact">
            <THead>
              <Tr>
                <Th>When</Th>
                <Th>Event</Th>
                <Th>Endpoint</Th>
                <Th>Status</Th>
                <Th>Attempts</Th>
                <Th>Last code</Th>
                <Th>Next retry</Th>
                <Th aria-label="Actions" />
              </Tr>
            </THead>
            <TBody>
              {rows.map((row) => (
                <React.Fragment key={row.id}>
                  <Tr
                    className="cursor-pointer"
                    onClick={() => setExpandedId(expandedId === row.id ? null : row.id)}
                  >
                    <Td className="font-mono text-xs text-[var(--st-text-secondary)]">
                      {new Date(row.createdAt).toLocaleString()}
                    </Td>
                    <Td className="font-mono text-xs font-medium text-[var(--st-text)]">{row.event}</Td>
                    <Td className="max-w-[260px] truncate text-xs text-[var(--st-text)]">{row.url}</Td>
                    <Td>
                      <Badge tone={statusTone(row.status)} dot>
                        {row.status}
                      </Badge>
                    </Td>
                    <Td className="text-xs text-[var(--st-text)]">{row.attempts}</Td>
                    <Td className="font-mono text-xs text-[var(--st-text)]">
                      {row.lastStatusCode ?? (row.lastError ? "ERR" : "—")}
                    </Td>
                    <Td className="text-xs text-[var(--st-text-secondary)]">
                      {row.nextAttemptAt ? new Date(row.nextAttemptAt).toLocaleTimeString() : "—"}
                    </Td>
                    <Td>
                      <Button
                        variant="ghost"
                        size="sm"
                        iconLeft={RotateCcw}
                        loading={replayingId === row.id}
                        disabled={replayingId === row.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleReplay(row);
                        }}
                      >
                        Replay
                      </Button>
                    </Td>
                  </Tr>
                  {expandedId === row.id && (
                    <Tr>
                      <Td colSpan={8} className="bg-[var(--st-bg-secondary)]">
                        <div className="space-y-2 p-3">
                          {row.lastError && (
                            <p className="text-xs text-[var(--st-text)]">
                              <span className="font-semibold">Last error:</span> {row.lastError}
                            </p>
                          )}
                          <pre className="max-h-64 overflow-auto rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg)] p-3 font-mono text-[11px] leading-relaxed text-[var(--st-text-secondary)]">
                            {row.payloadPreview}
                          </pre>
                        </div>
                      </Td>
                    </Tr>
                  )}
                </React.Fragment>
              ))}
            </TBody>
          </Table>
        </div>
      )}
    </Card>
  );
}
