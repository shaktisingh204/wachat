'use client';

/**
 * SabCRM — Webhook delivery log (`/dashboard/settings/crm/webhook-deliveries`).
 *
 * The audit/observability surface for the signed-webhooks vertical. Lists every
 * outbound delivery attempt for the active project (newest first) with its
 * event, target URL, lifecycle status, HTTP response code, attempt count and
 * the next scheduled retry. Operators can:
 *
 *   - filter by lifecycle status (pending / delivered / failed),
 *   - "Retry now" a single delivery (one extra attempt, fired immediately),
 *   - inspect the last error / response of a row in a detail Sheet.
 *
 * Pure 20ui. Auth/RBAC/project are enforced by `../../layout.tsx`; every action
 * independently re-runs the full gate (reads → `view`, retry → `edit`).
 * Degrades to loading / empty / error and never crashes when the engine is
 * unreachable.
 */

import * as React from 'react';
import {
  RefreshCw,
  Webhook as WebhookIcon,
  CheckCircle2,
  XCircle,
  Clock,
  RotateCw,
  Filter,
} from 'lucide-react';

import {
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  PageDescription,
  PageActions,
  Button,
  Card,
  Badge,
  Alert,
  EmptyState,
  Skeleton,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  Table,
  THead,
  TBody,
  Tr,
  Th,
  Td,
  useToast,
} from '@/components/sabcrm/20ui';
import { renderIcon } from '@/components/sabcrm/20ui/_icon';
import { useProject } from '@/context/project-context';
import {
  listWebhookDeliveriesTw,
  retryWebhookDeliveryTw,
} from '@/app/actions/sabcrm-webhooks-delivery.actions';

// ---------------------------------------------------------------------------
// Local wire shapes (no server-only import)
// ---------------------------------------------------------------------------

type DeliveryStatus = 'pending' | 'delivered' | 'failed';

interface DeliveryRow {
  _id: string;
  webhookId: string;
  url: string;
  event: string;
  deliveryId: string;
  deliveryStatus: DeliveryStatus;
  attempt: number;
  maxAttempts: number;
  responseCode: number | null;
  responseBody?: string;
  error?: string;
  lastAttemptAt?: string;
  nextRetryAt?: string | null;
  createdAt: string;
}

type StatusFilter = 'all' | DeliveryStatus;

const STATUS_META: Record<
  DeliveryStatus,
  { label: string; tone: 'success' | 'danger' | 'warning'; icon: typeof Clock }
> = {
  delivered: { label: 'Delivered', tone: 'success', icon: CheckCircle2 },
  failed: { label: 'Failed', tone: 'danger', icon: XCircle },
  pending: { label: 'Pending', tone: 'warning', icon: Clock },
};

function fmtTime(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString();
}

function fmtCode(code: number | null): string {
  return code === null ? '—' : String(code);
}

export default function WebhookDeliveriesPage(): React.ReactElement {
  const { activeProjectId, isLoadingProject } = useProject();
  const { toast } = useToast();

  const [rows, setRows] = React.useState<DeliveryRow[]>([]);
  const [status, setStatus] = React.useState<StatusFilter>('all');
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [retrying, setRetrying] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    if (!activeProjectId) return;
    setLoading(true);
    setError(null);
    const res = await listWebhookDeliveriesTw(
      { status: status === 'all' ? undefined : status, limit: 200 },
      activeProjectId,
    );
    if (res.ok) setRows(res.data as DeliveryRow[]);
    else setError(res.error);
    setLoading(false);
  }, [activeProjectId, status]);

  React.useEffect(() => {
    if (!activeProjectId) return;
    let alive = true;
    (async () => {
      setLoading(true);
      setError(null);
      const res = await listWebhookDeliveriesTw(
        { status: status === 'all' ? undefined : status, limit: 200 },
        activeProjectId,
      );
      if (!alive) return;
      if (res.ok) setRows(res.data as DeliveryRow[]);
      else setError(res.error);
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [activeProjectId, status]);

  async function retry(row: DeliveryRow): Promise<void> {
    if (!activeProjectId) return;
    setRetrying(row._id);
    const res = await retryWebhookDeliveryTw(row._id, activeProjectId);
    setRetrying(null);
    if (!res.ok) {
      toast({ title: 'Retry failed', description: res.error, tone: 'danger' });
      return;
    }
    const outcome = res.data;
    toast({
      title: outcome.success ? 'Delivered' : outcome.willRetry ? 'Retrying' : 'Still failing',
      description: outcome.success
        ? `Delivered on attempt ${outcome.attempt}.`
        : outcome.willRetry
          ? `Attempt ${outcome.attempt} failed — re-scheduled.`
          : `Attempt ${outcome.attempt} failed (HTTP ${String(outcome.status ?? 'error')}).`,
      tone: outcome.success ? 'success' : 'warning',
    });
    await load();
  }

  const counts = React.useMemo(() => {
    const c = { pending: 0, delivered: 0, failed: 0 };
    for (const r of rows) c[r.deliveryStatus] += 1;
    return c;
  }, [rows]);

  return (
    <>
      <PageHeader>
        <PageHeaderHeading>
          <PageTitle>Webhook deliveries</PageTitle>
          <PageDescription>
            Every signed outbound delivery, its HTTP outcome and retry schedule.
            Signatures use HMAC-SHA-256 with a timestamp in the{' '}
            <code>X-SabNode-Signature</code> header.
          </PageDescription>
        </PageHeaderHeading>
        <PageActions>
          <Button variant="secondary" iconLeft={RefreshCw} onClick={load} disabled={loading}>
            Refresh
          </Button>
        </PageActions>
      </PageHeader>

      {error && (
        <Alert tone="danger" className="mb-[var(--st-space-3)]">
          {error}
        </Alert>
      )}

      {/* Summary + filter */}
      <div className="mb-[var(--st-space-3)] flex flex-wrap items-center justify-between gap-[var(--st-space-3)]">
        <div className="flex flex-wrap items-center gap-[var(--st-space-2)]">
          <Badge tone="success" kind="soft">
            {counts.delivered} delivered
          </Badge>
          <Badge tone="warning" kind="soft">
            {counts.pending} pending
          </Badge>
          <Badge tone="danger" kind="soft">
            {counts.failed} failed
          </Badge>
        </div>
        <div className="flex items-center gap-[var(--st-space-2)]">
          {renderFilterIcon()}
          <Select value={status} onValueChange={(v) => setStatus(v as StatusFilter)}>
            <SelectTrigger aria-label="Filter by status" className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="delivered">Delivered</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {loading || isLoadingProject ? (
        <div className="flex flex-col gap-[var(--st-space-2)]">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : rows.length === 0 ? (
        <Card className="p-[var(--st-space-5)]">
          <EmptyState
            icon={WebhookIcon}
            title="No deliveries yet"
            description="Outbound webhook deliveries will appear here once a subscribed CRM event fires. Configure subscriptions under Webhooks."
          />
        </Card>
      ) : (
        <Card className="overflow-hidden p-0">
          <Table>
            <THead>
              <Tr>
                <Th>Status</Th>
                <Th>Event</Th>
                <Th>Endpoint</Th>
                <Th>Code</Th>
                <Th>Attempts</Th>
                <Th>Last attempt</Th>
                <Th>Next retry</Th>
                <Th className="text-right">Actions</Th>
              </Tr>
            </THead>
            <TBody>
              {rows.map((row) => {
                const meta = STATUS_META[row.deliveryStatus];
                return (
                  <Tr key={row._id}>
                    <Td>
                      <Badge tone={meta.tone} kind="soft">
                        <span className="inline-flex items-center gap-1">
                          {renderIcon(meta.icon, { size: 12, 'aria-hidden': true })}
                          {meta.label}
                        </span>
                      </Badge>
                    </Td>
                    <Td>
                      <span className="text-[13px] font-medium text-[var(--st-text)]">
                        {row.event}
                      </span>
                    </Td>
                    <Td>
                      <span
                        className="block max-w-[260px] truncate text-[12px] text-[var(--st-text-secondary)]"
                        title={row.url}
                      >
                        {row.url}
                      </span>
                    </Td>
                    <Td>
                      <span
                        className={
                          row.responseCode !== null &&
                          row.responseCode >= 200 &&
                          row.responseCode < 300
                            ? 'text-[var(--st-success, #16a34a)]'
                            : row.responseCode !== null
                              ? 'text-[var(--st-danger, #dc2626)]'
                              : 'text-[var(--st-text-secondary)]'
                        }
                      >
                        {fmtCode(row.responseCode)}
                      </span>
                    </Td>
                    <Td>
                      {row.attempt}/{row.maxAttempts}
                    </Td>
                    <Td>
                      <span className="text-[12px] text-[var(--st-text-secondary)]">
                        {fmtTime(row.lastAttemptAt)}
                      </span>
                    </Td>
                    <Td>
                      <span className="text-[12px] text-[var(--st-text-secondary)]">
                        {row.deliveryStatus === 'pending'
                          ? fmtTime(row.nextRetryAt)
                          : '—'}
                      </span>
                    </Td>
                    <Td className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        iconLeft={RotateCw}
                        onClick={() => retry(row)}
                        loading={retrying === row._id}
                        disabled={retrying === row._id}
                      >
                        Retry
                      </Button>
                    </Td>
                  </Tr>
                );
              })}
            </TBody>
          </Table>
        </Card>
      )}

      {/* Surface the most recent error inline so operators don't need a modal. */}
      {!loading &&
        rows.some((r) => r.deliveryStatus === 'failed' && r.error) && (
          <div className="mt-[var(--st-space-3)] flex flex-col gap-[var(--st-space-1)]">
            <span className="text-[12px] font-semibold text-[var(--st-text)]">
              Recent failures
            </span>
            {rows
              .filter((r) => r.deliveryStatus === 'failed' && r.error)
              .slice(0, 5)
              .map((r) => (
                <div
                  key={`err-${r._id}`}
                  className="rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] px-[var(--st-space-3)] py-[var(--st-space-2)] text-[12px] text-[var(--st-text-secondary)]"
                >
                  <span className="font-medium text-[var(--st-text)]">{r.event}</span>{' '}
                  → {r.url}
                  <span className="block truncate text-[var(--st-danger, #dc2626)]" title={r.error}>
                    {r.error}
                  </span>
                </div>
              ))}
          </div>
        )}
    </>
  );
}

/** Small helper to render the filter glyph via the 20ui icon convention. */
function renderFilterIcon(): React.ReactElement {
  return <Filter size={14} className="text-[var(--st-text-secondary)]" aria-hidden />;
}
