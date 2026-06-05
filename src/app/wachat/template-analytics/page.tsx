'use client';

import {
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  CardDescription,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
  EmptyState,
  Skeleton,
  Spinner,
  StatCard,
  Table,
  THead,
  TBody,
  Th,
  Tr,
  Td,
  Badge,
  useToast,
  Select,
  Field,
  Alert,
} from '@/components/sabcrm/20ui';
import * as Recharts from 'recharts';
import {
  useEffect,
  useMemo,
  useState,
  useTransition,
  useCallback,
} from 'react';
import {
  BarChart3,
  RefreshCw,
  Send,
  CircleCheck,
  Eye,
  CircleX,
  Info,
} from 'lucide-react';

import { WachatPage } from '@/app/wachat/_components/wachat-page';
import { useProject } from '@/context/project-context';
import { getTemplateAnalytics } from '@/app/actions/wachat-features.actions';

/**
 * Wachat Template Analytics - view delivery and read metrics per
 * template, rebuilt on the 20ui design system.
 */

import * as React from 'react';

type AnalyticsRow = {
  _id?: string;
  sent?: number;
  delivered?: number;
  read?: number;
  failed?: number;
};

const ENGAGEMENT_CONFIG: ChartConfig = {
  Sent: { label: 'Sent', color: 'var(--st-accent)' },
  Delivered: { label: 'Delivered', color: 'var(--st-status-ok)' },
  Read: { label: 'Read', color: 'var(--st-text-secondary)' },
};

function rateTone(rate: number): 'success' | 'warning' | 'danger' {
  if (rate >= 80) return 'success';
  if (rate >= 50) return 'warning';
  return 'danger';
}

function pct(num: number, den: number): number {
  if (!den) return 0;
  return Math.round((num / den) * 1000) / 10;
}

import { fmtDate } from '@/lib/utils';
function formatDate(date: Date) {
  return fmtDate(date);
}

export default function TemplateAnalyticsPage() {
  const { activeProject } = useProject();
  const { toast } = useToast();
  const projectId = activeProject?._id?.toString();

  const [analytics, setAnalytics] = useState<AnalyticsRow[]>([]);
  const [lastSynced, setLastSynced] = useState<Date | null>(null);
  const [abTestTemplate1, setAbTestTemplate1] = useState<string>('');
  const [abTestTemplate2, setAbTestTemplate2] = useState<string>('');
  const [isLoading, startLoading] = useTransition();

  const fetchAnalytics = useCallback(
    (pid: string, showToast = false) => {
      startLoading(async () => {
        const res = await getTemplateAnalytics(pid);
        if (res.error) {
          toast({
            title: 'Error',
            description: res.error,
            tone: 'danger',
          });
        } else {
          setAnalytics(res.analytics || []);
          setLastSynced(new Date());
          if (showToast) {
            toast({
              title: 'Refreshed',
              description: 'Analytics data updated.',
            });
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
    const totalDelivered = analytics.reduce(
      (s, a) => s + (a.delivered || 0),
      0,
    );
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

  const templateOptions = useMemo(
    () =>
      analytics.map((a) => ({ value: a._id || '', label: a._id || 'Unknown' })),
    [analytics],
  );

  return (
    <WachatPage
      breadcrumb={[
        { label: 'SabNode', href: '/dashboard' },
        { label: 'WaChat', href: '/wachat' },
        { label: 'Templates', href: '/wachat/templates' },
        { label: 'Analytics' },
      ]}
      title="Template analytics"
      description="Track delivery, read, and failure rates for your WhatsApp message templates."
      actions={
        <div className="flex items-center gap-3">
          {lastSynced && (
            <span className="text-[12px] text-[var(--st-text-tertiary)]">
              Last synced: {formatDate(lastSynced)}
            </span>
          )}
          <Button
            variant="outline"
            size="sm"
            iconLeft={RefreshCw}
            onClick={() => projectId && fetchAnalytics(projectId, true)}
            disabled={!projectId || isLoading}
          >
            {isLoading ? 'Refreshing...' : 'Refresh'}
          </Button>
        </div>
      }
    >
      <Alert tone="info" icon={Info} title="Data sync delay">
        Template analytics heavily rely on Meta webhook deliveries, which can
        sometimes be delayed. Refresh periodically to get the latest metrics.
      </Alert>

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          label="Total sent"
          value={totals.totalSent.toLocaleString()}
          icon={Send}
        />
        <StatCard
          label="Delivered"
          value={totals.totalDelivered.toLocaleString()}
          icon={CircleCheck}
        />
        <StatCard
          label="Read"
          value={totals.totalRead.toLocaleString()}
          icon={Eye}
        />
        <StatCard
          label="Failed"
          value={totals.totalFailed.toLocaleString()}
          icon={CircleX}
        />
      </div>

      {/* Engagement chart */}
      <Card>
        <CardHeader>
          <CardTitle>Engagement by template</CardTitle>
          <CardDescription>Top 10 templates by send volume</CardDescription>
        </CardHeader>
        <CardBody>
          {isLoading && analytics.length === 0 ? (
            <Skeleton width="100%" height={280} radius="var(--st-radius-lg)" />
          ) : chartData.length === 0 ? (
            <EmptyState
              size="sm"
              icon={BarChart3}
              title="No engagement data"
              description="Send template messages to begin collecting metrics."
            />
          ) : (
            <ChartContainer config={ENGAGEMENT_CONFIG} style={{ height: 280 }}>
              <Recharts.BarChart data={chartData}>
                <Recharts.CartesianGrid
                  strokeDasharray="3 3"
                  stroke="var(--st-border)"
                  vertical={false}
                />
                <Recharts.XAxis
                  dataKey="name"
                  tick={{ fontSize: 11, fill: 'var(--st-text-tertiary)' }}
                  tickLine={false}
                  axisLine={{ stroke: 'var(--st-border)' }}
                />
                <Recharts.YAxis
                  tick={{ fontSize: 11, fill: 'var(--st-text-tertiary)' }}
                  tickLine={false}
                  axisLine={false}
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <ChartLegend content={<ChartLegendContent />} />
                <Recharts.Bar
                  dataKey="Sent"
                  fill="var(--color-Sent)"
                  radius={[4, 4, 0, 0]}
                />
                <Recharts.Bar
                  dataKey="Delivered"
                  fill="var(--color-Delivered)"
                  radius={[4, 4, 0, 0]}
                />
                <Recharts.Bar
                  dataKey="Read"
                  fill="var(--color-Read)"
                  radius={[4, 4, 0, 0]}
                />
              </Recharts.BarChart>
            </ChartContainer>
          )}
        </CardBody>
      </Card>

      {/* A/B Testing Card */}
      <Card>
        <CardHeader>
          <CardTitle>A/B testing comparison</CardTitle>
          <CardDescription>
            Compare performance between two different templates.
          </CardDescription>
        </CardHeader>
        <CardBody>
          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Template A">
              <Select
                value={abTestTemplate1}
                onChange={(v) => setAbTestTemplate1(v ?? '')}
                options={templateOptions}
                placeholder="Select first template"
                searchable
                aria-label="Template A"
              />
            </Field>
            <Field label="Template B">
              <Select
                value={abTestTemplate2}
                onChange={(v) => setAbTestTemplate2(v ?? '')}
                options={templateOptions}
                placeholder="Select second template"
                searchable
                aria-label="Template B"
              />
            </Field>
          </div>

          {abTestTemplate1 && abTestTemplate2 ? (
            <ChartContainer config={ENGAGEMENT_CONFIG} style={{ height: 280 }}>
              <Recharts.BarChart data={abTestData}>
                <Recharts.CartesianGrid
                  strokeDasharray="3 3"
                  stroke="var(--st-border)"
                  vertical={false}
                />
                <Recharts.XAxis
                  dataKey="name"
                  tick={{ fontSize: 11, fill: 'var(--st-text-tertiary)' }}
                  tickLine={false}
                  axisLine={{ stroke: 'var(--st-border)' }}
                />
                <Recharts.YAxis
                  tick={{ fontSize: 11, fill: 'var(--st-text-tertiary)' }}
                  tickLine={false}
                  axisLine={false}
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <ChartLegend content={<ChartLegendContent />} />
                <Recharts.Bar
                  dataKey="Sent"
                  fill="var(--color-Sent)"
                  radius={[4, 4, 0, 0]}
                />
                <Recharts.Bar
                  dataKey="Delivered"
                  fill="var(--color-Delivered)"
                  radius={[4, 4, 0, 0]}
                />
                <Recharts.Bar
                  dataKey="Read"
                  fill="var(--color-Read)"
                  radius={[4, 4, 0, 0]}
                />
              </Recharts.BarChart>
            </ChartContainer>
          ) : (
            <EmptyState
              size="sm"
              icon={BarChart3}
              title="Select two templates"
              description="Select two templates above to compare their performance."
            />
          )}
        </CardBody>
      </Card>

      {/* Per-template table */}
      <Card>
        <CardHeader>
          <CardTitle>Per-template breakdown</CardTitle>
          <CardDescription>
            Delivery and read rates for every template that sent messages.
          </CardDescription>
        </CardHeader>
        <CardBody>
          {isLoading && analytics.length === 0 ? (
            <div className="flex h-20 items-center justify-center">
              <Spinner label="Loading analytics" />
            </div>
          ) : analytics.length === 0 ? (
            <EmptyState
              size="sm"
              icon={BarChart3}
              title="No analytics data"
              description="Send template messages to start collecting delivery metrics."
            />
          ) : (
            <Table>
              <THead>
                <Tr>
                  <Th>Template name</Th>
                  <Th align="right">Sent</Th>
                  <Th align="right">Delivered</Th>
                  <Th align="right">Read</Th>
                  <Th align="right">Failed</Th>
                  <Th align="right">Delivery %</Th>
                  <Th align="right">Read %</Th>
                </Tr>
              </THead>
              <TBody>
                {analytics.map((row) => {
                  const deliveryRate = pct(row.delivered || 0, row.sent || 0);
                  const readRate = pct(row.read || 0, row.sent || 0);
                  return (
                    <Tr key={row._id || 'unknown'}>
                      <Td className="text-[13px] font-medium">
                        {row._id || 'Unknown'}
                      </Td>
                      <Td align="right" className="text-[13px] tabular-nums">
                        {(row.sent || 0).toLocaleString()}
                      </Td>
                      <Td align="right" className="text-[13px] tabular-nums">
                        {(row.delivered || 0).toLocaleString()}
                      </Td>
                      <Td align="right" className="text-[13px] tabular-nums">
                        {(row.read || 0).toLocaleString()}
                      </Td>
                      <Td align="right" className="text-[13px] tabular-nums">
                        {(row.failed || 0).toLocaleString()}
                      </Td>
                      <Td align="right">
                        <Badge tone={rateTone(deliveryRate)} kind="soft">
                          {deliveryRate}%
                        </Badge>
                      </Td>
                      <Td align="right">
                        <Badge tone={rateTone(readRate)} kind="soft">
                          {readRate}%
                        </Badge>
                      </Td>
                    </Tr>
                  );
                })}
              </TBody>
            </Table>
          )}
        </CardBody>
      </Card>
    </WachatPage>
  );
}
