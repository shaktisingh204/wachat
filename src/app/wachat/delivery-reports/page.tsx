'use client';

import { useEffect, useMemo, useState, useTransition, useCallback } from 'react';
import {
  CheckCheck,
  CircleX,
  Clock,
  Download,
  Eye,
  Inbox,
  Lightbulb,
  Phone,
  Send,
  TrendingDown,
  AlertTriangle,
} from 'lucide-react';
import { m, useReducedMotion } from 'motion/react';

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
import { EASE_OUT } from '@/components/dashboard-ui/module-theme';
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

// Categorize failure message into a high-level reason
function categorizeFailure(m: any): { code: string; label: string; tone: 'rose' | 'amber' | 'zinc' } {
  const desc = (m.errorMessage || m.error || '').toString().toLowerCase();
  const codeRaw = m.errorCode || m.code;
  if (codeRaw) {
    const code = String(codeRaw);
    if (code.startsWith('131')) return { code, label: 'Recipient unavailable', tone: 'amber' };
    if (code.startsWith('132')) return { code, label: 'Template error', tone: 'rose' };
    if (code.startsWith('133')) return { code, label: 'Capability mismatch', tone: 'amber' };
    if (code.startsWith('134')) return { code, label: 'Throughput limited', tone: 'amber' };
    if (code.startsWith('190')) return { code, label: 'Auth expired', tone: 'rose' };
    return { code, label: 'Other', tone: 'zinc' };
  }
  if (desc.includes('rate') || desc.includes('limit'))
    return { code: 'rate', label: 'Rate-limited', tone: 'amber' };
  if (desc.includes('template'))
    return { code: 'template', label: 'Template error', tone: 'rose' };
  if (desc.includes('phone') || desc.includes('recipient'))
    return { code: 'phone', label: 'Recipient unavailable', tone: 'amber' };
  if (desc.includes('auth') || desc.includes('token'))
    return { code: 'auth', label: 'Auth expired', tone: 'rose' };
  return { code: 'unknown', label: 'Other', tone: 'zinc' };
}

export default function DeliveryReportsPage() {
  const { activeProject } = useProject();
  const { toast } = useZoruToast();
  const reduceMotion = useReducedMotion();
  const projectId = activeProject?._id?.toString();
  const [stats, setStats] = useState<any[]>([]);
  const [failedMessages, setFailedMessages] = useState<any[]>([]);
  const [isLoading, startTransition] = useTransition();
  const [exportOpen, setExportOpen] = useState(false);
  const [detailRow, setDetailRow] = useState<any | null>(null);
  const [lastSyncAt, setLastSyncAt] = useState<Date | null>(null);

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
      setLastSyncAt(new Date());
    });
  }, [projectId, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const statMap: Record<string, number> = useMemo(() => {
    const map: Record<string, number> = {};
    stats.forEach((s) => {
      map[s._id] = s.count;
    });
    return map;
  }, [stats]);

  const total = useMemo(() => stats.reduce((sum, s) => sum + (s.count || 0), 0), [stats]);

  const sentCount = statMap.sent ?? 0;
  const deliveredCount = statMap.delivered ?? 0;
  const readCount = statMap.read ?? 0;
  const failedCount = statMap.failed ?? 0;

  const deliveryRate =
    sentCount > 0 ? Math.round((deliveredCount / sentCount) * 1000) / 10 : 0;
  const failRate =
    total > 0 ? Math.round((failedCount / total) * 1000) / 10 : 0;

  // Failure breakdown by error code
  const failureTaxonomy = useMemo(() => {
    const map = new Map<string, { code: string; label: string; tone: string; count: number }>();
    failedMessages.forEach((m) => {
      const cat = categorizeFailure(m);
      const key = `${cat.code}|${cat.label}`;
      const cur = map.get(key) || { ...cat, count: 0 };
      cur.count += 1;
      map.set(key, cur);
    });
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [failedMessages]);

  // Top affected phone numbers
  const affectedPhones = useMemo(() => {
    const map = new Map<string, number>();
    failedMessages.forEach((m) => {
      const phone = m.recipientPhone || m.contactId;
      if (!phone) return;
      map.set(phone, (map.get(phone) || 0) + 1);
    });
    return Array.from(map.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5);
  }, [failedMessages]);

  // Recovery suggestions based on actual taxonomy
  const recoverySuggestions = useMemo(() => {
    const out: { label: string; suggestion: string }[] = [];
    if (failureTaxonomy.some((t) => t.label === 'Rate-limited' || t.label === 'Throughput limited')) {
      out.push({
        label: 'Throttling detected',
        suggestion: 'Pause large broadcasts and stagger sends across multiple phone numbers.',
      });
    }
    if (failureTaxonomy.some((t) => t.label === 'Template error')) {
      out.push({
        label: 'Template rejections',
        suggestion: 'Re-check variable placeholders and resubmit failing templates for approval.',
      });
    }
    if (failureTaxonomy.some((t) => t.label === 'Auth expired')) {
      out.push({
        label: 'Auth issue',
        suggestion: 'Refresh the access token via the integrations page.',
      });
    }
    if (failureTaxonomy.some((t) => t.label === 'Recipient unavailable')) {
      out.push({
        label: 'Recipient errors',
        suggestion: 'Clean your audience list; many recipients have no WhatsApp account.',
      });
    }
    if (failRate > 5) {
      out.push({
        label: `Failure rate at ${failRate}%`,
        suggestion: 'Consider lowering campaign volume until the issue is identified.',
      });
    }
    return out;
  }, [failureTaxonomy, failRate]);

  const handleExport = useCallback(() => {
    const header = ['recipient', 'type', 'status', 'date', 'error_code', 'error_message'].join(',');
    const body = failedMessages
      .map((m) =>
        [
          m.recipientPhone || m.contactId || '-',
          m.type || 'text',
          m.status,
          m.timestamp ? new Date(m.timestamp).toISOString() : '-',
          m.errorCode || '',
          (m.errorMessage || '').replace(/,/g, ';'),
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

  const taxonomyMax = Math.max(1, ...failureTaxonomy.map((t) => t.count));

  return (
    <WaPage>
      <PageHeader
        title="Delivery reports"
        kicker="Reports"
        description="Last 7 days of message delivery, plus failed-message debugging."
        eyebrowIcon={CheckCheck}
        actions={
          <>
            {lastSyncAt && (
              <span className="hidden items-center gap-1.5 text-[11px] text-zinc-500 sm:inline-flex">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Synced {Math.max(0, Math.round((Date.now() - lastSyncAt.getTime()) / 1000))}s ago
              </span>
            )}
            <WaButton
              variant="outline"
              size="sm"
              onClick={() => setExportOpen(true)}
              disabled={failedMessages.length === 0}
              leftIcon={Download}
            >
              Export CSV
            </WaButton>
          </>
        }
      />

      {isLoading && stats.length === 0 ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-[118px] animate-pulse rounded-xl border border-zinc-200 bg-white" />
          ))}
        </div>
      ) : (
        <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
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
                delay={reduceMotion ? 0 : 0.02 + i * 0.03}
              />
            );
          })}
          <MetricTile
            label="Delivery rate"
            value={`${deliveryRate}%`}
            delta={
              total > 0
                ? { value: deliveryRate >= 90 ? 'Healthy' : 'Below par', positive: deliveryRate >= 90 }
                : undefined
            }
            icon={CheckCheck}
            delay={reduceMotion ? 0 : 0.14}
          />
          <MetricTile
            label="Failure rate"
            value={`${failRate}%`}
            delta={
              total > 0
                ? { value: failRate <= 2 ? 'Healthy' : 'Watch', positive: failRate <= 2 }
                : undefined
            }
            icon={TrendingDown}
            delay={reduceMotion ? 0 : 0.16}
          />
        </div>
      )}

      {/* Recovery suggestions banner */}
      {recoverySuggestions.length > 0 && (
        <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-2">
          {recoverySuggestions.map((s, i) => (
            <m.div
              key={s.label}
              initial={{ opacity: 0, y: 6 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.3, delay: i * 0.04, ease: EASE_OUT }}
              className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50/60 px-4 py-3"
            >
              <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" strokeWidth={2.25} aria-hidden />
              <div>
                <p className="text-[12.5px] font-semibold text-amber-900">{s.label}</p>
                <p className="mt-0.5 text-[11.5px] leading-relaxed text-amber-800">{s.suggestion}</p>
              </div>
            </m.div>
          ))}
        </div>
      )}

      {/* Failure taxonomy + affected phones */}
      {failedMessages.length > 0 && (
        <div className="mb-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
          <Section title="Failure breakdown" description="Errors grouped by WhatsApp error code">
            <ul className="space-y-2">
              {failureTaxonomy.map((t) => {
                const width = (t.count / taxonomyMax) * 100;
                const color =
                  t.tone === 'rose' ? '#f43f5e' : t.tone === 'amber' ? '#f59e0b' : '#a1a1aa';
                return (
                  <li key={t.code + t.label} className="flex items-center gap-2.5">
                    <span className="w-14 font-mono text-[10.5px] tabular-nums text-zinc-500">
                      {t.code}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[12px] font-medium text-zinc-900">{t.label}</p>
                      <div className="relative mt-0.5 h-1.5 overflow-hidden rounded-full bg-zinc-100">
                        <m.div
                          initial={{ width: 0 }}
                          animate={{ width: `${width}%` }}
                          transition={{ duration: 0.4, ease: EASE_OUT }}
                          className="absolute inset-y-0 left-0 rounded-full"
                          style={{ background: color }}
                        />
                      </div>
                    </div>
                    <span className="w-8 text-right text-[12px] font-semibold tabular-nums text-zinc-900">
                      {t.count}
                    </span>
                  </li>
                );
              })}
            </ul>
          </Section>

          <Section title="Most-affected recipients" description="Phone numbers with repeated failures" padded={false}>
            {affectedPhones.length === 0 ? (
              <div className="p-6">
                <EmptyState
                  icon={Phone}
                  title="No repeats"
                  description="No phone number has multiple failures."
                />
              </div>
            ) : (
              <ul className="divide-y divide-zinc-100">
                {affectedPhones.map(([phone, count], i) => (
                  <m.li
                    key={phone}
                    initial={{ opacity: 0, x: -4 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.3, delay: i * 0.03, ease: EASE_OUT }}
                    className="flex items-center gap-3 px-4 py-2"
                  >
                    <Phone className="h-3.5 w-3.5 text-zinc-400" strokeWidth={2} aria-hidden />
                    <span className="min-w-0 flex-1 truncate font-mono text-[12.5px] text-zinc-900">
                      {phone}
                    </span>
                    <StatusPill tone="failed">{count} fails</StatusPill>
                  </m.li>
                ))}
              </ul>
            )}
          </Section>
        </div>
      )}

      <Section title="Recent failed messages" description="Past 7 days of failed deliveries." padded={false}>
        {isLoading && failedMessages.length === 0 ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-9 animate-pulse rounded-lg bg-zinc-50" />
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
                  <th className="px-4 py-2 text-left">Recipient</th>
                  <th className="px-4 py-2 text-left">Type</th>
                  <th className="px-4 py-2 text-left">Reason</th>
                  <th className="px-4 py-2 text-left">Status</th>
                  <th className="px-4 py-2 text-left">Date</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {failedMessages.map((m) => {
                  const cat = categorizeFailure(m);
                  return (
                    <tr key={m._id} className="h-9 hover:bg-zinc-50">
                      <td className="px-4 py-1.5 font-mono text-zinc-900">{m.recipientPhone || m.contactId || '-'}</td>
                      <td className="px-4 py-1.5 text-zinc-700">{m.type || 'text'}</td>
                      <td className="px-4 py-1.5 text-zinc-700">
                        <span className="inline-flex items-center gap-1.5">
                          <AlertTriangle
                            className={`h-3 w-3 ${
                              cat.tone === 'rose' ? 'text-rose-500' : 'text-amber-500'
                            }`}
                            strokeWidth={2.25}
                            aria-hidden
                          />
                          {cat.label}
                        </span>
                      </td>
                      <td className="px-4 py-1.5">
                        <StatusPill tone="failed">{m.status}</StatusPill>
                      </td>
                      <td className="px-4 py-1.5 whitespace-nowrap text-zinc-500">
                        <span className="inline-flex items-center gap-1">
                          <Clock className="h-3 w-3" strokeWidth={2} aria-hidden />
                          {m.timestamp ? fmtDate(m.timestamp) : '-'}
                        </span>
                      </td>
                      <td className="px-4 py-1.5 text-right">
                        <WaButton variant="ghost" size="sm" onClick={() => setDetailRow(m)} leftIcon={Eye}>
                          View
                        </WaButton>
                      </td>
                    </tr>
                  );
                })}
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
                label="Reason"
                value={categorizeFailure(detailRow).label}
              />
              <DetailRow
                label="Timestamp"
                value={detailRow.timestamp ? fmtDate(detailRow.timestamp) : '-'}
              />
              {detailRow.errorMessage && <DetailRow label="Error" value={detailRow.errorMessage} />}
              <div>
                <p className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-wide text-zinc-500">
                  Raw payload
                </p>
                <pre className="overflow-x-auto rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-[11.5px] leading-relaxed text-zinc-700">
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
