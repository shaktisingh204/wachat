'use client';

/**
 * Wachat Delivery Reports — ZoruUI rebuild.
 *
 * KPI strip + per-message delivery table with row-detail sheet
 * + export-CSV dialog. Greyscale only.
 */

import * as React from 'react';
import { useEffect, useState, useTransition, useCallback } from 'react';
import {
  CheckCheck,
  CircleX,
  Download,
  Eye,
  Inbox,
  Send,
} from 'lucide-react';

import { useProject } from '@/context/project-context';
import { useToast } from '@/hooks/use-toast';
import { getDeliveryReport } from '@/app/actions/wachat-features.actions';

import {
  ZoruBadge,
  ZoruBreadcrumb,
  ZoruBreadcrumbItem,
  ZoruBreadcrumbLink,
  ZoruBreadcrumbList,
  ZoruBreadcrumbPage,
  ZoruBreadcrumbSeparator,
  ZoruButton,
  ZoruCard,
  ZoruCardContent,
  ZoruCardHeader,
  ZoruCardTitle,
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
  ZoruStatCard,
  ZoruTable,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
} from '@/components/zoruui';

const STAT_META = [
  { key: 'sent', label: 'Sent', icon: Send },
  { key: 'delivered', label: 'Delivered', icon: CheckCheck },
  { key: 'read', label: 'Read', icon: Eye },
  { key: 'failed', label: 'Failed', icon: CircleX },
] as const;

export default function DeliveryReportsPage() {
  const { activeProject } = useProject();
  const { toast } = useToast();
  const projectId = activeProject?._id?.toString();
  const [stats, setStats] = useState<any[]>([]);
  const [failedMessages, setFailedMessages] = useState<any[]>([]);
  const [isLoading, startTransition] = useTransition();
  const [exportOpen, setExportOpen] = useState(false);
  const [detailRow, setDetailRow] = useState<any | null>(null);

  const fetchData = useCallback(() => {
    if (!projectId) return;
    startTransition(async () => {
      const res = await getDeliveryReport(projectId, 7);
      if (res.error) {
        toast({ title: 'Error', description: res.error, variant: 'destructive' });
        return;
      }
      setStats(res.stats ?? []);
      setFailedMessages(res.failedMessages ?? []);
    });
  }, [projectId, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const statMap: Record<string, number> = {};
  let total = 0;
  for (const s of stats) {
    statMap[s._id] = s.count;
    total += s.count;
  }

  const handleExport = useCallback(() => {
    const header = ['recipient', 'type', 'status', 'date'].join(',');
    const body = failedMessages
      .map((m) =>
        [
          m.recipientPhone || m.contactId || '-',
          m.type || 'text',
          m.status,
          m.timestamp ? new Date(m.timestamp).toISOString() : '-',
        ].join(','),
      )
      .join('\n');
    const csv = `${header}\n${body}`;
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `delivery-report-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setExportOpen(false);
  }, [failedMessages]);

  return (
    <div className="flex min-h-full flex-col gap-6">
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
            <ZoruBreadcrumbPage>Delivery Reports</ZoruBreadcrumbPage>
          </ZoruBreadcrumbItem>
        </ZoruBreadcrumbList>
      </ZoruBreadcrumb>

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[30px] font-semibold tracking-[-0.015em] text-zoru-ink leading-[1.1]">
            Delivery Reports
          </h1>
          <p className="mt-1.5 text-[13px] text-zoru-ink-muted">
            View message delivery status breakdown and failed message details.
          </p>
        </div>
        <ZoruButton
          variant="outline"
          size="sm"
          onClick={() => setExportOpen(true)}
          disabled={failedMessages.length === 0}
        >
          <Download /> Export CSV
        </ZoruButton>
      </div>

      {isLoading && stats.length === 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <ZoruSkeleton key={i} className="h-[120px]" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STAT_META.map((m) => {
            const value = statMap[m.key] ?? 0;
            const pct = total > 0 ? ((value / total) * 100).toFixed(1) : '0';
            return (
              <ZoruStatCard
                key={m.key}
                label={m.label}
                value={value.toLocaleString()}
                icon={<m.icon />}
                period={`${pct}% of total`}
              />
            );
          })}
        </div>
      )}

      <ZoruCard>
        <ZoruCardHeader>
          <ZoruCardTitle>Recent Failed Messages</ZoruCardTitle>
        </ZoruCardHeader>
        <ZoruCardContent>
          {isLoading && failedMessages.length === 0 ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <ZoruSkeleton key={i} className="h-10" />
              ))}
            </div>
          ) : failedMessages.length === 0 ? (
            <ZoruEmptyState
              icon={<Inbox />}
              title="No failed messages"
              description="Nothing failed in the last 7 days."
            />
          ) : (
            <ZoruTable>
              <ZoruTableHeader>
                <ZoruTableRow className="hover:bg-transparent">
                  <ZoruTableHead>Recipient</ZoruTableHead>
                  <ZoruTableHead>Type</ZoruTableHead>
                  <ZoruTableHead>Status</ZoruTableHead>
                  <ZoruTableHead>Date</ZoruTableHead>
                  <ZoruTableHead className="w-[1%]" />
                </ZoruTableRow>
              </ZoruTableHeader>
              <ZoruTableBody>
                {failedMessages.map((m) => (
                  <ZoruTableRow key={m._id}>
                    <ZoruTableCell className="font-mono text-[13px]">
                      {m.recipientPhone || m.contactId || '-'}
                    </ZoruTableCell>
                    <ZoruTableCell>{m.type || 'text'}</ZoruTableCell>
                    <ZoruTableCell>
                      <ZoruBadge variant="danger">{m.status}</ZoruBadge>
                    </ZoruTableCell>
                    <ZoruTableCell className="whitespace-nowrap text-zoru-ink-muted">
                      {m.timestamp ? new Date(m.timestamp).toLocaleString() : '-'}
                    </ZoruTableCell>
                    <ZoruTableCell>
                      <ZoruButton
                        variant="ghost"
                        size="sm"
                        onClick={() => setDetailRow(m)}
                      >
                        <Eye /> View
                      </ZoruButton>
                    </ZoruTableCell>
                  </ZoruTableRow>
                ))}
              </ZoruTableBody>
            </ZoruTable>
          )}
        </ZoruCardContent>
      </ZoruCard>

      {/* View delivery detail sheet */}
      <ZoruSheet
        open={!!detailRow}
        onOpenChange={(open) => {
          if (!open) setDetailRow(null);
        }}
      >
        <ZoruSheetContent side="right">
          <ZoruSheetHeader>
            <ZoruSheetTitle>Delivery Detail</ZoruSheetTitle>
            <ZoruSheetDescription>
              Full delivery payload for the selected message.
            </ZoruSheetDescription>
          </ZoruSheetHeader>
          {detailRow && (
            <div className="mt-6 space-y-3 text-sm">
              <DetailRow label="Recipient" value={detailRow.recipientPhone || detailRow.contactId || '-'} />
              <DetailRow label="Type" value={detailRow.type || 'text'} />
              <DetailRow
                label="Status"
                value={<ZoruBadge variant="danger">{detailRow.status}</ZoruBadge>}
              />
              <DetailRow
                label="Timestamp"
                value={
                  detailRow.timestamp
                    ? new Date(detailRow.timestamp).toLocaleString()
                    : '-'
                }
              />
              {detailRow.errorMessage && (
                <DetailRow label="Error" value={detailRow.errorMessage} />
              )}
              <div>
                <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-zoru-ink-subtle">
                  Raw payload
                </p>
                <pre className="overflow-x-auto rounded-[var(--zoru-radius-sm)] border border-zoru-line bg-zoru-surface p-3 text-[11.5px] leading-relaxed text-zoru-ink-muted">
                  {JSON.stringify(detailRow, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </ZoruSheetContent>
      </ZoruSheet>

      {/* Export CSV dialog */}
      <ZoruDialog open={exportOpen} onOpenChange={setExportOpen}>
        <ZoruDialogContent>
          <ZoruDialogHeader>
            <ZoruDialogTitle>Export delivery report</ZoruDialogTitle>
            <ZoruDialogDescription>
              Download {failedMessages.length} failed message rows as CSV.
            </ZoruDialogDescription>
          </ZoruDialogHeader>
          <ZoruDialogFooter>
            <ZoruButton variant="ghost" onClick={() => setExportOpen(false)}>
              Cancel
            </ZoruButton>
            <ZoruButton onClick={handleExport}>
              <Download /> Download CSV
            </ZoruButton>
          </ZoruDialogFooter>
        </ZoruDialogContent>
      </ZoruDialog>

      <div className="h-6" />
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-zoru-line pb-2 last:border-0">
      <span className="text-xs font-medium uppercase tracking-wide text-zoru-ink-subtle">
        {label}
      </span>
      <span className="text-right text-zoru-ink">{value}</span>
    </div>
  );
}
