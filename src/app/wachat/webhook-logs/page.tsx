'use client';
import { fmtDate } from "@/lib/utils";

import {
  Badge,
  Button,
  DataTable,
  type DataTableColumn,
  Modal,
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  EmptyState,
  Skeleton,
  useToast,
  Field,
  Input,
} from '@/components/sabcrm/20ui';
import {
  useEffect,
  useState,
  useTransition,
  useCallback,
  useMemo,
} from 'react';
import { Eye,
  RefreshCw,
  RotateCcw,
  Webhook } from 'lucide-react';

import { useProject } from '@/context/project-context';
import { getWebhookLogs, replayWebhookLog } from '@/app/actions/wachat-features.actions';
import { WachatPage } from '@/app/wachat/_components/wachat-page';

/**
 * Wachat Webhook Logs — 20ui migration.
 * Data table of deliveries + view-payload drawer + retry-delivery modal.
 */

import * as React from 'react';

type WebhookLog = {
  _id: string;
  receivedAt?: string;
  event?: string;
  type?: string;
  status?: string;
  payload?: unknown;
  body?: unknown;
};

export default function WebhookLogsPage() {
  const { activeProject } = useProject();
  const { toast } = useToast();
  const projectId = activeProject?._id?.toString();

  const [logs, setLogs] = useState<WebhookLog[]>([]);
  const [previewLog, setPreviewLog] = useState<WebhookLog | null>(null);
  const [retryLog, setRetryLog] = useState<WebhookLog | null>(null);
  const [isLoading, startLoading] = useTransition();
  const [isRetrying, startRetrying] = useTransition();
  const [searchQuery, setSearchQuery] = useState('');

  const filteredLogs = useMemo(() => {
    if (!searchQuery.trim()) return logs;
    const lower = searchQuery.toLowerCase();
    return logs.filter((l) => {
      if ((l.event || l.type || '').toLowerCase().includes(lower)) return true;
      if (l.payload && JSON.stringify(l.payload).toLowerCase().includes(lower)) return true;
      if (l.body && JSON.stringify(l.body).toLowerCase().includes(lower)) return true;
      return false;
    });
  }, [logs, searchQuery]);

  const fetchLogs = useCallback(
    (pid: string) => {
      startLoading(async () => {
        const res = await getWebhookLogs(pid);
        if (res.error) {
          toast({
            title: 'Error',
            description: res.error,
            tone: 'danger',
          });
        } else {
          setLogs((res.logs as WebhookLog[]) || []);
        }
      });
    },
    [toast],
  );

  useEffect(() => {
    if (projectId) fetchLogs(projectId);
  }, [projectId, fetchLogs]);

  const columns = React.useMemo<DataTableColumn<WebhookLog>[]>(
    () => [
      {
        key: 'timestamp',
        header: 'Timestamp',
        sortable: true,
        sortValue: (row) => row.receivedAt ?? '',
        render: (row) => {
          const t = row.receivedAt;
          return (
            <span className="font-mono text-[12.5px] tabular-nums text-[var(--st-text-secondary)]">
              {t ? fmtDate(t) : '--'}
            </span>
          );
        },
      },
      {
        key: 'event',
        header: 'Event',
        sortable: true,
        sortValue: (row) => row.event || row.type || 'webhook',
        render: (row) => (
          <span className="text-[13px] text-[var(--st-text)]">
            {row.event || row.type || 'webhook'}
          </span>
        ),
      },
      {
        key: 'status',
        header: 'Status',
        render: (row) => {
          const s = (row.status || 'received').toLowerCase();
          const tone: 'success' | 'danger' | 'neutral' =
            s === 'success'
              ? 'success'
              : s === 'failed' || s === 'error'
                ? 'danger'
                : 'neutral';
          return <Badge tone={tone}>{s}</Badge>;
        },
      },
      {
        key: 'actions',
        header: '',
        align: 'right',
        render: (row) => (
          <div className="flex items-center justify-end gap-1">
            <Button
              size="sm"
              variant="ghost"
              iconLeft={Eye}
              onClick={() => setPreviewLog(row)}
            >
              View
            </Button>
            <Button
              size="sm"
              variant="ghost"
              iconLeft={RotateCcw}
              onClick={() => setRetryLog(row)}
            >
              Retry
            </Button>
          </div>
        ),
      },
    ],
    [],
  );

  const previewPayload =
    previewLog?.payload ?? previewLog?.body ?? {};

  return (
    <WachatPage
      breadcrumb={[
        { label: 'SabNode', href: '/dashboard' },
        { label: 'WaChat', href: '/wachat' },
        { label: 'Webhook logs' },
      ]}
      title="Webhook logs"
      description="View incoming and outgoing webhook event logs."
      width="wide"
      actions={
        <Button
          size="sm"
          variant="outline"
          iconLeft={RefreshCw}
          loading={isLoading}
          onClick={() => projectId && fetchLogs(projectId)}
        >
          Refresh
        </Button>
      }
    >
      {isLoading && logs.length === 0 ? (
        <div className="flex flex-col gap-2">
          <Skeleton height={36} />
          <Skeleton height={36} />
          <Skeleton height={36} />
          <Skeleton height={36} />
        </div>
      ) : logs.length === 0 ? (
        <EmptyState
          icon={Webhook}
          title="No webhook logs found"
          description="Once Meta starts sending events to your endpoint, they'll appear here."
        />
      ) : (
        <div className="flex flex-col gap-3">
          <Field className="max-w-sm" label="Search">
            <Input
              placeholder="Search events and payloads…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </Field>
          <DataTable<WebhookLog>
            columns={columns}
            rows={filteredLogs}
            getRowId={(row) => row._id}
            empty={
              <EmptyState
                size="sm"
                icon={Webhook}
                title="No deliveries match"
              />
            }
          />
        </div>
      )}

      {/* ── View payload drawer ── */}
      <Drawer
        open={!!previewLog}
        onOpenChange={(o) => !o && setPreviewLog(null)}
      >
        <DrawerContent side="right" className="w-full sm:max-w-xl flex flex-col">
          <DrawerHeader>
            <DrawerTitle>
              {previewLog?.event || previewLog?.type || 'Webhook event'}
            </DrawerTitle>
            <DrawerDescription>
              {previewLog?.receivedAt
                ? fmtDate(previewLog.receivedAt)
                : 'Full payload'}
            </DrawerDescription>
          </DrawerHeader>
          <div className="mt-4 flex-1 overflow-auto">
            <pre className="p-4 font-mono text-[12px] rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] text-[var(--st-text)]">
              {JSON.stringify(previewPayload, null, 2)}
            </pre>
          </div>
        </DrawerContent>
      </Drawer>

      {/* ── Retry delivery modal ── */}
      <Modal
        open={!!retryLog}
        onClose={() => setRetryLog(null)}
        title="Retry delivery?"
        description={
          <>
            We&apos;ll re-send {retryLog?.event || 'this event'} to your
            endpoint. Existing logs are kept untouched.
          </>
        }
        footer={
          <>
            <Button variant="ghost" onClick={() => setRetryLog(null)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              iconLeft={RotateCcw}
              loading={isRetrying}
              onClick={() => {
                if (!projectId || !retryLog) return;
                startRetrying(async () => {
                  const payload = retryLog.payload ?? retryLog.body;
                  const res = await replayWebhookLog(projectId, payload);
                  if (res.error) {
                    toast({ title: 'Error', description: res.error, tone: 'danger' });
                  } else {
                    toast({ title: 'Retry queued', description: res.message || 'The event will be re-delivered shortly.', tone: 'success' });
                    setRetryLog(null);
                  }
                });
              }}
            >
              Retry
            </Button>
          </>
        }
      />
    </WachatPage>
  );
}
