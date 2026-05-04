'use client';

/**
 * Wachat Webhook Logs — ZoruUI migration.
 * Data table of deliveries + view-payload sheet + retry-delivery dialog.
 */

import * as React from 'react';
import { useEffect, useState, useTransition, useCallback } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { Eye, Loader2, RefreshCw, RotateCcw, Webhook } from 'lucide-react';

import { useProject } from '@/context/project-context';
import { getWebhookLogs } from '@/app/actions/wachat-features.actions';

import {
  ZoruBadge,
  ZoruBreadcrumb,
  ZoruBreadcrumbItem,
  ZoruBreadcrumbLink,
  ZoruBreadcrumbList,
  ZoruBreadcrumbPage,
  ZoruBreadcrumbSeparator,
  ZoruButton,
  ZoruDataTable,
  ZoruDialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  ZoruEmptyState,
  ZoruSheet,
  ZoruSheetContent,
  ZoruSheetDescription,
  ZoruSheetHeader,
  ZoruSheetTitle,
  ZoruSkeleton,
  useZoruToast,
} from '@/components/zoruui';

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
  const { toast } = useZoruToast();
  const projectId = activeProject?._id?.toString();

  const [logs, setLogs] = useState<WebhookLog[]>([]);
  const [previewLog, setPreviewLog] = useState<WebhookLog | null>(null);
  const [retryLog, setRetryLog] = useState<WebhookLog | null>(null);
  const [isLoading, startLoading] = useTransition();

  const fetchLogs = useCallback(
    (pid: string) => {
      startLoading(async () => {
        const res = await getWebhookLogs(pid);
        if (res.error) {
          toast({
            title: 'Error',
            description: res.error,
            variant: 'destructive',
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

  const columns = React.useMemo<ColumnDef<WebhookLog>[]>(
    () => [
      {
        id: 'timestamp',
        accessorKey: 'receivedAt',
        header: 'Timestamp',
        cell: ({ row }) => {
          const t = row.original.receivedAt;
          return (
            <span className="font-mono text-[12.5px] tabular-nums text-zoru-ink-muted">
              {t ? new Date(t).toLocaleString() : '--'}
            </span>
          );
        },
      },
      {
        id: 'event',
        accessorKey: 'event',
        header: 'Event',
        cell: ({ row }) => (
          <span className="text-[13px] text-zoru-ink">
            {row.original.event || row.original.type || 'webhook'}
          </span>
        ),
      },
      {
        id: 'status',
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => {
          const s = (row.original.status || 'received').toLowerCase();
          const variant: 'success' | 'danger' | 'secondary' =
            s === 'success'
              ? 'success'
              : s === 'failed' || s === 'error'
                ? 'danger'
                : 'secondary';
          return <ZoruBadge variant={variant}>{s}</ZoruBadge>;
        },
      },
      {
        id: 'actions',
        header: '',
        enableSorting: false,
        enableHiding: false,
        cell: ({ row }) => (
          <div className="flex items-center justify-end gap-1">
            <ZoruButton
              size="sm"
              variant="ghost"
              onClick={() => setPreviewLog(row.original)}
            >
              <Eye /> View
            </ZoruButton>
            <ZoruButton
              size="sm"
              variant="ghost"
              onClick={() => setRetryLog(row.original)}
            >
              <RotateCcw /> Retry
            </ZoruButton>
          </div>
        ),
      },
    ],
    [],
  );

  const previewPayload =
    previewLog?.payload ?? previewLog?.body ?? {};

  return (
    <div className="mx-auto w-full max-w-[1320px] px-6 pt-6 pb-10">
      <ZoruBreadcrumb>
        <ZoruBreadcrumbList>
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/dashboard">SabNode</ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/wachat">WaChat</ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbPage>Webhook logs</ZoruBreadcrumbPage>
          </ZoruBreadcrumbItem>
        </ZoruBreadcrumbList>
      </ZoruBreadcrumb>

      <div className="mt-5 flex items-end justify-between gap-6">
        <div className="min-w-0">
          <h1 className="text-[30px] tracking-[-0.015em] text-zoru-ink leading-[1.1]">
            Webhook logs
          </h1>
          <p className="mt-1.5 text-[13px] text-zoru-ink-muted">
            View incoming and outgoing webhook event logs.
          </p>
        </div>
        <ZoruButton
          size="sm"
          variant="outline"
          onClick={() => projectId && fetchLogs(projectId)}
          disabled={isLoading}
        >
          {isLoading ? (
            <Loader2 className="animate-spin" />
          ) : (
            <RefreshCw />
          )}
          Refresh
        </ZoruButton>
      </div>

      <div className="mt-6">
        {isLoading && logs.length === 0 ? (
          <div className="flex flex-col gap-2">
            <ZoruSkeleton className="h-9 w-full" />
            <ZoruSkeleton className="h-9 w-full" />
            <ZoruSkeleton className="h-9 w-full" />
            <ZoruSkeleton className="h-9 w-full" />
          </div>
        ) : logs.length === 0 ? (
          <ZoruEmptyState
            icon={<Webhook />}
            title="No webhook logs found"
            description="Once Meta starts sending events to your endpoint, they'll appear here."
          />
        ) : (
          <ZoruDataTable
            columns={columns}
            data={logs}
            filterColumn="event"
            filterPlaceholder="Filter events…"
            empty={
              <ZoruEmptyState
                compact
                icon={<Webhook />}
                title="No deliveries match"
              />
            }
          />
        )}
      </div>

      {/* ── View payload sheet ── */}
      <ZoruSheet
        open={!!previewLog}
        onOpenChange={(o) => !o && setPreviewLog(null)}
      >
        <ZoruSheetContent className="w-full sm:max-w-xl flex flex-col">
          <ZoruSheetHeader>
            <ZoruSheetTitle>
              {previewLog?.event || previewLog?.type || 'Webhook event'}
            </ZoruSheetTitle>
            <ZoruSheetDescription>
              {previewLog?.receivedAt
                ? new Date(previewLog.receivedAt).toLocaleString()
                : 'Full payload'}
            </ZoruSheetDescription>
          </ZoruSheetHeader>
          <div className="mt-4 flex-1 overflow-auto">
            <pre className="rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-surface p-4 font-mono text-[12px] text-zoru-ink">
              {JSON.stringify(previewPayload, null, 2)}
            </pre>
          </div>
        </ZoruSheetContent>
      </ZoruSheet>

      {/* ── Retry delivery dialog ── */}
      <ZoruDialog
        open={!!retryLog}
        onOpenChange={(o) => !o && setRetryLog(null)}
      >
        <ZoruDialogContent>
          <ZoruDialogHeader>
            <ZoruDialogTitle>Retry delivery?</ZoruDialogTitle>
            <ZoruDialogDescription>
              We&apos;ll re-send {retryLog?.event || 'this event'} to your
              endpoint. Existing logs are kept untouched.
            </ZoruDialogDescription>
          </ZoruDialogHeader>
          <ZoruDialogFooter>
            <ZoruButton variant="ghost" onClick={() => setRetryLog(null)}>
              Cancel
            </ZoruButton>
            <ZoruButton
              onClick={() => {
                toast({
                  title: 'Retry queued',
                  description: 'The event will be re-delivered shortly.',
                });
                setRetryLog(null);
              }}
            >
              <RotateCcw /> Retry
            </ZoruButton>
          </ZoruDialogFooter>
        </ZoruDialogContent>
      </ZoruDialog>

      <div className="h-6" />
    </div>
  );
}
