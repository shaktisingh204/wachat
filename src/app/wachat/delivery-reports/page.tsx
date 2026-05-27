'use client';

import { useEffect, useState, useTransition, useCallback } from 'react';
import { CheckCheck, CircleX, Download, Eye, Inbox, Send } from 'lucide-react';

import { useProject } from '@/context/project-context';
import { getDeliveryReport } from '@/app/actions/wachat-features.actions';
import { fmtDate } from '@/lib/utils';
import {
  WaPage,
  PageHeader,
  WaButton,
  MetricTile,
  Section,
  EmptyState,
  StatusPill,
} from '@/components/wachat-ui';
import {
  useZoruToast,
  Sheet,
  ZoruSheetContent,
  ZoruSheetDescription,
  ZoruSheetHeader,
  ZoruSheetTitle,
  Dialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
} from '@/components/zoruui';

/**
 * Wachat Delivery Reports - KPI strip + failed-message table + row detail
 * sheet + CSV export, rebuilt on wachat-ui chrome.
 */

const STAT_META = [
  { key: 'sent', label: 'Sent', icon: Send },
  { key: 'delivered', label: 'Delivered', icon: CheckCheck },
  { key: 'read', label: 'Read', icon: Eye },
  { key: 'failed', label: 'Failed', icon: CircleX },
] as const;

export default function DeliveryReportsPage() {
  const { activeProject } = useProject();
  const { toast } = useZoruToast();
  const projectId = activeProject?._id?.toString();
  const [stats, setStats] = useState<any[]>([]);
  const [failedMessages, setFailedMessages] = useState<any[]>([]);
  const [isLoading, startTransition] = useTransition();
  const [exportOpen, setExportOpen] = useState(false);
  const [detailRow, setDetailRow] = useState<any | null>(null);

  useEffect(() => {
    document.title = 'Delivery reports · Wachat';
  }, []);

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
    <WaPage>
      <PageHeader
        title="Delivery reports"
        kicker="Reports"
        description="Last 7 days of message delivery, plus failed-message debugging."
        eyebrowIcon={CheckCheck}
        actions={
          <WaButton
            variant="outline"
            size="sm"
            onClick={() => setExportOpen(true)}
            disabled={failedMessages.length === 0}
            leftIcon={Download}
          >
            Export CSV
          </WaButton>
        }
      />

      {isLoading && stats.length === 0 ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-[118px] animate-pulse rounded-2xl border border-zinc-200 bg-white" />
          ))}
        </div>
      ) : (
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {STAT_META.map((m, i) => {
            const value = statMap[m.key] ?? 0;
            const pct = total > 0 ? ((value / total) * 100).toFixed(1) : '0';
            return (
              <MetricTile
                key={m.key}
                label={m.label}
                value={value.toLocaleString()}
                icon={m.icon}
                delta={total > 0 ? { value: `${pct}%`, positive: m.key !== 'failed' } : undefined}
                delay={0.02 + i * 0.04}
              />
            );
          })}
        </div>
      )}

      <Section title="Recent failed messages" description="Past 7 days of failed deliveries." padded={false}>
        {isLoading && failedMessages.length === 0 ? (
          <div className="space-y-2 p-5">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-10 animate-pulse rounded-xl bg-zinc-50" />
            ))}
          </div>
        ) : failedMessages.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={Inbox}
              title="No failed messages"
              description="Nothing failed in the last 7 days."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[12.5px]">
              <thead>
                <tr className="border-b border-zinc-100 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                  <th className="px-5 py-2.5 text-left">Recipient</th>
                  <th className="px-5 py-2.5 text-left">Type</th>
                  <th className="px-5 py-2.5 text-left">Status</th>
                  <th className="px-5 py-2.5 text-left">Date</th>
                  <th className="px-5 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {failedMessages.map((m) => (
                  <tr key={m._id} className="hover:bg-zinc-50">
                    <td className="px-5 py-2.5 font-mono text-zinc-900">{m.recipientPhone || m.contactId || '-'}</td>
                    <td className="px-5 py-2.5 text-zinc-700">{m.type || 'text'}</td>
                    <td className="px-5 py-2.5">
                      <StatusPill tone="failed">{m.status}</StatusPill>
                    </td>
                    <td className="px-5 py-2.5 whitespace-nowrap text-zinc-500">
                      {m.timestamp ? fmtDate(m.timestamp) : '-'}
                    </td>
                    <td className="px-5 py-2.5 text-right">
                      <WaButton variant="ghost" size="sm" onClick={() => setDetailRow(m)} leftIcon={Eye}>
                        View
                      </WaButton>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Sheet
        open={!!detailRow}
        onOpenChange={(open) => {
          if (!open) setDetailRow(null);
        }}
      >
        <ZoruSheetContent side="right">
          <ZoruSheetHeader>
            <ZoruSheetTitle>Delivery detail</ZoruSheetTitle>
            <ZoruSheetDescription>Full payload for the selected message.</ZoruSheetDescription>
          </ZoruSheetHeader>
          {detailRow && (
            <div className="mt-6 space-y-3 text-[13px]">
              <DetailRow label="Recipient" value={detailRow.recipientPhone || detailRow.contactId || '-'} />
              <DetailRow label="Type" value={detailRow.type || 'text'} />
              <DetailRow label="Status" value={<StatusPill tone="failed">{detailRow.status}</StatusPill>} />
              <DetailRow
                label="Timestamp"
                value={detailRow.timestamp ? fmtDate(detailRow.timestamp) : '-'}
              />
              {detailRow.errorMessage && <DetailRow label="Error" value={detailRow.errorMessage} />}
              <div>
                <p className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-wide text-zinc-500">
                  Raw payload
                </p>
                <pre className="overflow-x-auto rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-[11.5px] leading-relaxed text-zinc-700">
                  {JSON.stringify(detailRow, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </ZoruSheetContent>
      </Sheet>

      <Dialog open={exportOpen} onOpenChange={setExportOpen}>
        <ZoruDialogContent>
          <ZoruDialogHeader>
            <ZoruDialogTitle>Export delivery report</ZoruDialogTitle>
            <ZoruDialogDescription>
              Download {failedMessages.length} failed message rows as CSV.
            </ZoruDialogDescription>
          </ZoruDialogHeader>
          <ZoruDialogFooter>
            <WaButton variant="outline" onClick={() => setExportOpen(false)}>
              Cancel
            </WaButton>
            <WaButton onClick={handleExport} leftIcon={Download}>
              Download CSV
            </WaButton>
          </ZoruDialogFooter>
        </ZoruDialogContent>
      </Dialog>
    </WaPage>
  );
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-zinc-100 pb-2 last:border-0">
      <span className="text-[10.5px] font-semibold uppercase tracking-wide text-zinc-500">{label}</span>
      <span className="text-right text-zinc-900">{value}</span>
    </div>
  );
}
