'use client';
import { fmtDate } from "@/lib/utils";

import {
  useToast,
  Badge,
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardBody,
  Modal,
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  EmptyState,
  Skeleton,
  StatCard,
  Table,
  THead,
  TBody,
  Th,
  Td,
  Tr,
} from '@/components/sabcrm/20ui';
import {
  useEffect,
  useState,
  useTransition,
  useCallback } from 'react';
import {
  CheckCheck,
  CircleX,
  Download,
  Eye,
  Inbox,
  Send,
  } from 'lucide-react';

import { useProject } from '@/context/project-context';
import { getDeliveryReport } from '@/app/actions/wachat-features.actions';
import { WachatPage } from '@/app/wachat/_components/wachat-page';

/**
 * Wachat Delivery Reports — 20ui rebuild.
 *
 * KPI strip + per-message delivery table with row-detail drawer
 * + export-CSV modal.
 */

import * as React from 'react';

function cx(...a: Array<string | false | null | undefined>) {
  return a.filter(Boolean).join(' ');
}

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
        toast({ title: 'Error', description: res.error, tone: 'danger' });
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
    <WachatPage
      breadcrumb={[
        { label: 'SabNode', href: '/dashboard' },
        { label: 'WaChat', href: '/wachat' },
        { label: 'Delivery Reports' },
      ]}
      title="Delivery Reports"
      description="View message delivery status breakdown and failed message details."
      width="wide"
      actions={
        <Button
          variant="outline"
          size="sm"
          iconLeft={Download}
          onClick={() => setExportOpen(true)}
          disabled={failedMessages.length === 0}
        >
          Export CSV
        </Button>
      }
    >
      <div className="flex flex-col gap-6">
        {isLoading && stats.length === 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} height={120} radius="var(--st-radius-lg)" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {STAT_META.map((m) => {
              const value = statMap[m.key] ?? 0;
              const pct = total > 0 ? ((value / total) * 100).toFixed(1) : '0';
              return (
                <StatCard
                  key={m.key}
                  label={m.label}
                  value={value.toLocaleString()}
                  icon={m.icon}
                  delta={{ value: `${pct}% of total`, tone: 'neutral' }}
                />
              );
            })}
          </div>
        )}

        <Card padding="none">
          <CardHeader>
            <CardTitle>Recent Failed Messages</CardTitle>
          </CardHeader>
          <CardBody>
            {isLoading && failedMessages.length === 0 ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} height={40} />
                ))}
              </div>
            ) : failedMessages.length === 0 ? (
              <EmptyState
                icon={Inbox}
                title="No failed messages"
                description="Nothing failed in the last 7 days."
              />
            ) : (
              <Table>
                <THead>
                  <Tr>
                    <Th>Recipient</Th>
                    <Th>Type</Th>
                    <Th>Status</Th>
                    <Th>Date</Th>
                    <Th width="1%" />
                  </Tr>
                </THead>
                <TBody>
                  {failedMessages.map((m) => (
                    <Tr key={m._id}>
                      <Td className="font-mono text-[13px]">
                        {m.recipientPhone || m.contactId || '-'}
                      </Td>
                      <Td>{m.type || 'text'}</Td>
                      <Td>
                        <Badge tone="danger">{m.status}</Badge>
                      </Td>
                      <Td
                        className="whitespace-nowrap [color:var(--st-text-secondary)]"
                      >
                        {m.timestamp ? fmtDate(m.timestamp) : '-'}
                      </Td>
                      <Td>
                        <Button
                          variant="ghost"
                          size="sm"
                          iconLeft={Eye}
                          onClick={() => setDetailRow(m)}
                        >
                          View
                        </Button>
                      </Td>
                    </Tr>
                  ))}
                </TBody>
              </Table>
            )}
          </CardBody>
        </Card>
      </div>

      {/* View delivery detail drawer */}
      <Drawer
        open={!!detailRow}
        onOpenChange={(open) => {
          if (!open) setDetailRow(null);
        }}
      >
        <DrawerContent side="right">
          <DrawerHeader>
            <DrawerTitle>Delivery Detail</DrawerTitle>
            <DrawerDescription>
              Full delivery payload for the selected message.
            </DrawerDescription>
          </DrawerHeader>
          {detailRow && (
            <div className="mt-6 space-y-3 text-sm">
              <DetailRow label="Recipient" value={detailRow.recipientPhone || detailRow.contactId || '-'} />
              <DetailRow label="Type" value={detailRow.type || 'text'} />
              <DetailRow
                label="Status"
                value={<Badge tone="danger">{detailRow.status}</Badge>}
              />
              <DetailRow
                label="Timestamp"
                value={
                  detailRow.timestamp
                    ? fmtDate(detailRow.timestamp)
                    : '-'
                }
              />
              {detailRow.errorMessage && (
                <DetailRow label="Error" value={detailRow.errorMessage} />
              )}
              <div>
                <p
                  className="mb-1.5 text-xs font-medium uppercase tracking-wide [color:var(--st-text-tertiary)]"
                >
                  Raw payload
                </p>
                <pre
                  className="overflow-x-auto rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-3 text-[11.5px] leading-relaxed [color:var(--st-text-secondary)]"
                >
                  {JSON.stringify(detailRow, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </DrawerContent>
      </Drawer>

      {/* Export CSV modal */}
      <Modal
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        title="Export delivery report"
        description={`Download ${failedMessages.length} failed message rows as CSV.`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setExportOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" iconLeft={Download} onClick={handleExport}>
              Download CSV
            </Button>
          </>
        }
      />
    </WachatPage>
  );
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div
      className="flex items-start justify-between gap-4 border-b border-[var(--st-border)] pb-2 last:border-0"
    >
      <span
        className="text-xs font-medium uppercase tracking-wide [color:var(--st-text-tertiary)]"
      >
        {label}
      </span>
      <span className="text-right [color:var(--st-text)]">
        {value}
      </span>
    </div>
  );
}
