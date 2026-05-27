'use client';

import { useEffect, useMemo, useState, useTransition, useCallback } from 'react';
import {
  BarChart3,
  Loader2,
  RefreshCw,
  Send,
  CircleCheck,
  Eye,
  CircleX,
  Info,
} from 'lucide-react';

import { useProject } from '@/context/project-context';
import { getTemplateAnalytics } from '@/app/actions/wachat-features.actions';
import { fmtDate } from '@/lib/utils';
import {
  WaPage,
  PageHeader,
  WaButton,
  MetricTile,
  Section,
  EmptyState,
} from '@/components/wachat-ui';
import {
  useZoruToast,
  ZoruChart,
  ZoruChartContainer,
  ZoruChartTooltip,
  ZoruSelect,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
} from '@/components/zoruui';

/**
 * Wachat Template Analytics - delivery and read metrics per template,
 * rebuilt on wachat-ui chrome.
 */

type AnalyticsRow = {
  _id?: string;
  sent?: number;
  delivered?: number;
  read?: number;
  failed?: number;
};

function rateClass(rate: number): string {
  if (rate >= 80) return 'text-emerald-600';
  if (rate >= 50) return 'text-amber-600';
  return 'text-rose-600';
}

function pct(num: number, den: number): number {
  if (!den) return 0;
  return Math.round((num / den) * 1000) / 10;
}

export default function TemplateAnalyticsPage() {
  const { activeProject } = useProject();
  const { toast } = useZoruToast();
  const projectId = activeProject?._id?.toString();

  const [analytics, setAnalytics] = useState<AnalyticsRow[]>([]);
  const [lastSynced, setLastSynced] = useState<Date | null>(null);
  const [abTestTemplate1, setAbTestTemplate1] = useState<string>('');
  const [abTestTemplate2, setAbTestTemplate2] = useState<string>('');
  const [isLoading, startLoading] = useTransition();

  useEffect(() => {
    document.title = 'Template analytics · Wachat';
  }, []);

  const fetchAnalytics = useCallback(
    (pid: string, showToast = false) => {
      startLoading(async () => {
        const res = await getTemplateAnalytics(pid);
        if (res.error) {
          toast({ title: 'Error', description: res.error, variant: 'destructive' });
        } else {
          setAnalytics(res.analytics || []);
          setLastSynced(new Date());
          if (showToast) {
            toast({ title: 'Refreshed', description: 'Analytics data updated.' });
          }
        }
      });
    },
    [toast],
  );

  useEffect(() => {
    if (projectId) fetchAnalytics(projectId);
  }, [projectId, fetchAnalytics]);

  const totals = useMemo(() => {
    const totalSent = analytics.reduce((s, a) => s + (a.sent || 0), 0);
    const totalDelivered = analytics.reduce((s, a) => s + (a.delivered || 0), 0);
    const totalRead = analytics.reduce((s, a) => s + (a.read || 0), 0);
    const totalFailed = analytics.reduce((s, a) => s + (a.failed || 0), 0);
    return { totalSent, totalDelivered, totalRead, totalFailed };
  }, [analytics]);

  const chartData = useMemo(
    () =>
      analytics.slice(0, 10).map((row) => ({
        name: (row._id || 'Unknown').slice(0, 18),
        Sent: row.sent || 0,
        Delivered: row.delivered || 0,
        Read: row.read || 0,
      })),
    [analytics],
  );

  const abTestData = useMemo(() => {
    if (!abTestTemplate1 || !abTestTemplate2) return [];
    const t1 = analytics.find((a) => a._id === abTestTemplate1);
    const t2 = analytics.find((a) => a._id === abTestTemplate2);
    return [
      {
        name: t1?._id || abTestTemplate1,
        Sent: t1?.sent || 0,
        Delivered: t1?.delivered || 0,
        Read: t1?.read || 0,
      },
      {
        name: t2?._id || abTestTemplate2,
        Sent: t2?.sent || 0,
        Delivered: t2?.delivered || 0,
        Read: t2?.read || 0,
      },
    ];
  }, [analytics, abTestTemplate1, abTestTemplate2]);

  return (
    <WaPage>
      <PageHeader
        title="Template analytics"
        kicker="Templates"
        description="Track delivery, read, and failure rates for your WhatsApp message templates."
        eyebrowIcon={BarChart3}
        actions={
          <>
            {lastSynced && (
              <span className="text-[11.5px] text-zinc-500">Last synced {fmtDate(lastSynced)}</span>
            )}
            <WaButton
              variant="outline"
              size="sm"
              onClick={() => projectId && fetchAnalytics(projectId, true)}
              disabled={!projectId || isLoading}
              leftIcon={RefreshCw}
            >
              {isLoading ? 'Refreshing' : 'Refresh'}
            </WaButton>
          </>
        }
      />

      <div className="mb-6 flex items-start gap-3 rounded-2xl border border-zinc-200 bg-white px-4 py-3">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-zinc-400" strokeWidth={2} />
        <div>
          <p className="text-[13px] font-medium text-zinc-900">Data sync delay</p>
          <p className="mt-0.5 text-[12px] text-zinc-500">
            Template analytics depend on Meta webhook delivery and may lag. Refresh for the latest counts.
          </p>
        </div>
      </div>

      {/* KPI strip */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MetricTile label="Total sent" value={totals.totalSent.toLocaleString()} icon={Send} delay={0.02} />
        <MetricTile label="Delivered" value={totals.totalDelivered.toLocaleString()} icon={CircleCheck} delay={0.06} />
        <MetricTile label="Read" value={totals.totalRead.toLocaleString()} icon={Eye} delay={0.1} />
        <MetricTile label="Failed" value={totals.totalFailed.toLocaleString()} icon={CircleX} delay={0.14} />
      </div>

      {/* Engagement chart */}
      <div className="mb-6">
        <Section title="Engagement by template" description="Top 10 templates by send volume.">
          {isLoading && analytics.length === 0 ? (
            <div className="h-[280px] animate-pulse rounded-xl bg-zinc-50" />
          ) : chartData.length === 0 ? (
            <EmptyState
              icon={BarChart3}
              title="No engagement data"
              description="Send template messages to begin collecting metrics."
            />
          ) : (
            <ZoruChartContainer height={280}>
              <ZoruChart.BarChart data={chartData}>
                <ZoruChart.CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
                <ZoruChart.XAxis dataKey="name" stroke="#71717a" fontSize={11} tickLine={false} axisLine={false} />
                <ZoruChart.YAxis stroke="#71717a" fontSize={11} tickLine={false} axisLine={false} />
                <ZoruChart.Tooltip content={(props: any) => <ZoruChartTooltip {...props} />} cursor={{ fill: '#f4f4f5' }} />
                <ZoruChart.Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
                <ZoruChart.Bar dataKey="Sent" fill="#10b981" radius={[6, 6, 0, 0]} />
                <ZoruChart.Bar dataKey="Delivered" fill="#0ea5e9" radius={[6, 6, 0, 0]} />
                <ZoruChart.Bar dataKey="Read" fill="#a16207" radius={[6, 6, 0, 0]} />
              </ZoruChart.BarChart>
            </ZoruChartContainer>
          )}
        </Section>
      </div>

      {/* A/B Testing */}
      <div className="mb-6">
        <Section title="A/B testing comparison" description="Compare performance between two templates.">
          <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label className="text-[12.5px] font-medium text-zinc-700">Template A</label>
              <ZoruSelect value={abTestTemplate1} onValueChange={setAbTestTemplate1}>
                <ZoruSelectTrigger>
                  <ZoruSelectValue placeholder="Select first template" />
                </ZoruSelectTrigger>
                <ZoruSelectContent>
                  {analytics.map((a) => (
                    <ZoruSelectItem key={a._id} value={a._id || ''}>
                      {a._id}
                    </ZoruSelectItem>
                  ))}
                </ZoruSelectContent>
              </ZoruSelect>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[12.5px] font-medium text-zinc-700">Template B</label>
              <ZoruSelect value={abTestTemplate2} onValueChange={setAbTestTemplate2}>
                <ZoruSelectTrigger>
                  <ZoruSelectValue placeholder="Select second template" />
                </ZoruSelectTrigger>
                <ZoruSelectContent>
                  {analytics.map((a) => (
                    <ZoruSelectItem key={a._id} value={a._id || ''}>
                      {a._id}
                    </ZoruSelectItem>
                  ))}
                </ZoruSelectContent>
              </ZoruSelect>
            </div>
          </div>

          {abTestTemplate1 && abTestTemplate2 ? (
            <ZoruChartContainer height={280}>
              <ZoruChart.BarChart data={abTestData}>
                <ZoruChart.CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
                <ZoruChart.XAxis dataKey="name" stroke="#71717a" fontSize={11} tickLine={false} axisLine={false} />
                <ZoruChart.YAxis stroke="#71717a" fontSize={11} tickLine={false} axisLine={false} />
                <ZoruChart.Tooltip content={(props: any) => <ZoruChartTooltip {...props} />} cursor={{ fill: '#f4f4f5' }} />
                <ZoruChart.Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
                <ZoruChart.Bar dataKey="Sent" fill="#10b981" radius={[6, 6, 0, 0]} />
                <ZoruChart.Bar dataKey="Delivered" fill="#0ea5e9" radius={[6, 6, 0, 0]} />
                <ZoruChart.Bar dataKey="Read" fill="#a16207" radius={[6, 6, 0, 0]} />
              </ZoruChart.BarChart>
            </ZoruChartContainer>
          ) : (
            <div className="flex h-[200px] items-center justify-center rounded-2xl border border-dashed border-zinc-200 bg-zinc-50/60">
              <p className="text-[13px] text-zinc-500">Select two templates above to compare.</p>
            </div>
          )}
        </Section>
      </div>

      {/* Per-template table */}
      <Section
        title="Per-template breakdown"
        description="Delivery and read rates for every active template."
        padded={false}
      >
        {isLoading && analytics.length === 0 ? (
          <div className="flex h-20 items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-zinc-400" />
          </div>
        ) : analytics.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={BarChart3}
              title="No analytics data"
              description="Send template messages to start collecting delivery metrics."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[12.5px]">
              <thead>
                <tr className="border-b border-zinc-100 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                  <th className="px-5 py-2.5 text-left">Template</th>
                  <th className="px-5 py-2.5 text-right">Sent</th>
                  <th className="px-5 py-2.5 text-right">Delivered</th>
                  <th className="px-5 py-2.5 text-right">Read</th>
                  <th className="px-5 py-2.5 text-right">Failed</th>
                  <th className="px-5 py-2.5 text-right">Delivery %</th>
                  <th className="px-5 py-2.5 text-right">Read %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {analytics.map((row) => {
                  const deliveryRate = pct(row.delivered || 0, row.sent || 0);
                  const readRate = pct(row.read || 0, row.sent || 0);
                  return (
                    <tr key={row._id || 'unknown'} className="hover:bg-zinc-50">
                      <td className="px-5 py-2 font-medium text-zinc-900">{row._id || 'Unknown'}</td>
                      <td className="px-5 py-2 text-right tabular-nums text-zinc-900">
                        {(row.sent || 0).toLocaleString()}
                      </td>
                      <td className="px-5 py-2 text-right tabular-nums text-zinc-900">
                        {(row.delivered || 0).toLocaleString()}
                      </td>
                      <td className="px-5 py-2 text-right tabular-nums text-zinc-900">
                        {(row.read || 0).toLocaleString()}
                      </td>
                      <td className="px-5 py-2 text-right tabular-nums text-zinc-900">
                        {(row.failed || 0).toLocaleString()}
                      </td>
                      <td className={`px-5 py-2 text-right font-semibold tabular-nums ${rateClass(deliveryRate)}`}>
                        {deliveryRate}%
                      </td>
                      <td className={`px-5 py-2 text-right font-semibold tabular-nums ${rateClass(readRate)}`}>
                        {readRate}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </WaPage>
  );
}
