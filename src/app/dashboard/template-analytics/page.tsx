'use client';

/**
 * Wachat Template Analytics — view delivery and read metrics per template,
 * built on Clay primitives.
 */

import * as React from 'react';
import { useEffect, useState, useTransition, useCallback } from 'react';
import { LuChartBar, LuLoader, LuRefreshCw } from 'react-icons/lu';
import { useProject } from '@/context/project-context';
import { useToast } from '@/hooks/use-toast';
import { ClayBreadcrumbs, ClayButton, ClayCard } from '@/components/clay';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { getTemplateAnalytics } from '@/app/actions/wachat-features.actions';
import { cn } from '@/lib/utils';

function rateColor(rate: number): string {
  if (rate >= 80) return 'text-green-600';
  if (rate >= 50) return 'text-amber-600';
  return 'text-red-600';
}

function pct(num: number, den: number): number {
  if (!den) return 0;
  return Math.round((num / den) * 1000) / 10;
}

export default function TemplateAnalyticsPage() {
  const { activeProject } = useProject();
  const { toast } = useToast();
  const projectId = activeProject?._id?.toString();

  const [analytics, setAnalytics] = useState<any[]>([]);
  const [isLoading, startLoading] = useTransition();

  const fetchAnalytics = useCallback(
    (pid: string, showToast = false) => {
      startLoading(async () => {
        const res = await getTemplateAnalytics(pid);
        if (res.error) {
          toast({ title: 'Error', description: res.error, variant: 'destructive' });
        } else {
          setAnalytics(res.analytics || []);
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

  const totalSent = analytics.reduce((s, a) => s + (a.sent || 0), 0);
  const totalDelivered = analytics.reduce((s, a) => s + (a.delivered || 0), 0);
  const totalRead = analytics.reduce((s, a) => s + (a.read || 0), 0);
  const totalFailed = analytics.reduce((s, a) => s + (a.failed || 0), 0);

  return (
    <div className="clay-enter flex min-h-full flex-col gap-6">
      <ClayBreadcrumbs
        items={[
          { label: 'Wachat', href: '/home' },
          { label: activeProject?.name || 'Project', href: '/dashboard' },
          { label: 'Template Analytics' },
        ]}
      />

      <div className="flex items-center justify-between gap-6">
        <div className="min-w-0">
          <h1 className="text-[30px] font-semibold tracking-[-0.015em] text-foreground leading-[1.1]">
            Template Analytics
          </h1>
          <p className="mt-1.5 text-[13px] text-muted-foreground">
            Track delivery, read, and failure rates for your WhatsApp message templates.
          </p>
        </div>
        <ClayButton
          variant="pill"
          size="md"
          leading={<LuRefreshCw className="h-3.5 w-3.5" strokeWidth={2} />}
          onClick={() => projectId && fetchAnalytics(projectId, true)}
          disabled={!projectId || isLoading}
        >
          {isLoading ? 'Refreshing...' : 'Refresh'}
        </ClayButton>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-[14px] border border-border bg-card p-4">
          <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Total Sent</div>
          <div className="mt-2 text-[22px] font-semibold text-foreground leading-none">{totalSent.toLocaleString()}</div>
        </div>
        <div className="rounded-[14px] border border-border bg-card p-4">
          <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Delivered</div>
          <div className="mt-2 text-[22px] font-semibold text-foreground leading-none">{totalDelivered.toLocaleString()}</div>
        </div>
        <div className="rounded-[14px] border border-border bg-card p-4">
          <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Read</div>
          <div className="mt-2 text-[22px] font-semibold text-foreground leading-none">{totalRead.toLocaleString()}</div>
        </div>
        <div className="rounded-[14px] border border-border bg-card p-4">
          <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Failed</div>
          <div className="mt-2 text-[22px] font-semibold text-foreground leading-none">{totalFailed.toLocaleString()}</div>
        </div>
      </div>

      {/* Analytics table */}
      <ClayCard padded={false} className="p-6">
        {isLoading && analytics.length === 0 ? (
          <div className="flex h-20 items-center justify-center">
            <LuLoader className="h-5 w-5 animate-spin text-muted-foreground" strokeWidth={1.75} />
          </div>
        ) : analytics.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border bg-secondary px-4 py-10 text-center">
            <LuChartBar className="h-5 w-5 text-muted-foreground" strokeWidth={1.5} />
            <div className="text-[13px] font-semibold text-foreground">No analytics data</div>
            <div className="text-[11.5px] text-muted-foreground">
              Send template messages to start collecting delivery metrics.
            </div>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Template Name</TableHead>
                <TableHead className="text-right">Sent</TableHead>
                <TableHead className="text-right">Delivered</TableHead>
                <TableHead className="text-right">Read</TableHead>
                <TableHead className="text-right">Failed</TableHead>
                <TableHead className="text-right">Delivery %</TableHead>
                <TableHead className="text-right">Read %</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {analytics.map((row) => {
                const deliveryRate = pct(row.delivered, row.sent);
                const readRate = pct(row.read, row.sent);
                return (
                  <TableRow key={row._id || 'unknown'}>
                    <TableCell className="font-medium text-[13px]">
                      {row._id || 'Unknown'}
                    </TableCell>
                    <TableCell className="text-right text-[13px] tabular-nums">
                      {(row.sent || 0).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right text-[13px] tabular-nums">
                      {(row.delivered || 0).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right text-[13px] tabular-nums">
                      {(row.read || 0).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right text-[13px] tabular-nums">
                      {(row.failed || 0).toLocaleString()}
                    </TableCell>
                    <TableCell className={cn('text-right text-[13px] font-semibold tabular-nums', rateColor(deliveryRate))}>
                      {deliveryRate}%
                    </TableCell>
                    <TableCell className={cn('text-right text-[13px] font-semibold tabular-nums', rateColor(readRate))}>
                      {readRate}%
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </ClayCard>

      <div className="h-6" />
    </div>
  );
}
