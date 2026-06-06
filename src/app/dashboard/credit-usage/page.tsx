'use client';

import { Alert, AlertDescription, AlertTitle, Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator, Button, Card, PageDescription, PageHeader, PageHeading, PageTitle, useToast } from '@/components/sabcrm/20ui/compat';
import {
  useEffect,
  useState,
  useTransition,
  useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Calendar,
  Coins,
  CreditCard,
  Loader2,
  TrendingUp,
  TriangleAlert,
  } from 'lucide-react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  } from 'recharts';

import { useProject } from '@/context/project-context';
import { getCreditUsage } from '@/app/actions/wachat-features.actions';

/**
 * Wachat Credit Usage — billing and credit usage dashboard.
 */

import * as React from 'react';

export default function CreditUsagePage() {
  const router = useRouter();
  const { activeProject } = useProject();
  const { toast } = useToast();
  const projectId = activeProject?._id?.toString();

  const [credits, setCredits] = useState(0);
  const [dailyUsage, setDailyUsage] = useState<any[]>([]);
  const [isLoading, startLoading] = useTransition();

  const fetchUsage = useCallback(
    (pid: string) => {
      startLoading(async () => {
        const res = await getCreditUsage(pid);
        if (res.error) {
          toast({ title: 'Error', description: res.error, variant: 'destructive' });
        } else {
          setCredits(res.credits || 0);
          setDailyUsage(res.dailyUsage || []);
        }
      });
    },
    [toast],
  );

  useEffect(() => {
    if (projectId) fetchUsage(projectId);
  }, [projectId, fetchUsage]);

  const totalUsed = dailyUsage.reduce((sum, d) => sum + (d.count || 0), 0);
  const dailyAvg = dailyUsage.length > 0 ? Math.round(totalUsed / dailyUsage.length) : 0;
  const maxUsed = Math.max(...dailyUsage.map((d) => d.count || 0), 1);
  const isLow = credits < 5000;
  const daysLeft = dailyAvg > 0 ? Math.floor(credits / dailyAvg) : 0;

  const stats = [
    { label: 'Credits remaining', value: credits.toLocaleString(), icon: Coins },
    { label: 'Used (30 days)', value: totalUsed.toLocaleString(), icon: TrendingUp },
    { label: 'Daily average', value: dailyAvg.toLocaleString(), icon: Calendar },
  ];

  return (
    <div className="flex min-h-full flex-col gap-6">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/dashboard">SabNode</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Credit usage</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex flex-wrap items-end justify-between gap-4">
        <PageHeader>
          <PageHeading>
            <PageTitle>Credit usage</PageTitle>
            <PageDescription>
              Monitor your messaging credit balance and daily usage.
            </PageDescription>
          </PageHeading>
        </PageHeader>
        <Button onClick={() => router.push('/dashboard/billing')}>
          <CreditCard className="h-3.5 w-3.5" />
          Top up credits
        </Button>
      </div>

      {isLow && credits > 0 && (
        <Alert variant="warning">
          <TriangleAlert className="h-4 w-4" />
          <AlertTitle>Low credit balance</AlertTitle>
          <AlertDescription>
            Approximately {daysLeft} day{daysLeft !== 1 ? 's' : ''} of credits remaining at current
            usage.
          </AlertDescription>
        </Alert>
      )}

      {isLoading ? (
        <div className="flex h-32 items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-[var(--st-text-secondary)]" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {stats.map((s) => {
              const Icon = s.icon;
              return (
                <Card key={s.label} className="flex items-center gap-4 p-5">
                  <span className="flex h-10 w-10 items-center justify-center rounded-[var(--st-radius)] bg-[var(--st-bg-muted)]">
                    <Icon className="h-5 w-5 text-[var(--st-text-secondary)]" />
                  </span>
                  <div>
                    <div className="text-xs text-[var(--st-text-secondary)]">{s.label}</div>
                    <div className="text-[22px] leading-tight tabular-nums text-[var(--st-text)]">
                      {s.value}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>

          {dailyUsage.length > 0 && (
            <Card className="p-5">
              <h2 className="mb-4 text-[15px] text-[var(--st-text)]">Daily trend</h2>
              <div className="mb-5 h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={dailyUsage.map((d) => ({ date: d._id, count: d.count }))}
                    margin={{ top: 5, right: 12, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--st-border)" />
                    <XAxis dataKey="date" stroke="var(--st-text-secondary)" tick={{ fontSize: 10 }} />
                    <YAxis stroke="var(--st-text-secondary)" tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Line
                      type="monotone"
                      dataKey="count"
                      stroke="var(--st-warn)"
                      strokeWidth={2}
                      dot={false}
                      name="Credits used"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-2">
                <div className="grid grid-cols-[100px_80px_1fr] gap-2 text-[11.5px] text-[var(--st-text-secondary)]">
                  <span>Date</span>
                  <span className="text-right">Messages</span>
                  <span />
                </div>
                {dailyUsage.map((d) => (
                  <div
                    key={d._id}
                    className="grid grid-cols-[100px_80px_1fr] items-center gap-2 text-sm text-[var(--st-text)]"
                  >
                    <span>{d._id}</span>
                    <span className="text-right tabular-nums">{d.count}</span>
                    <div className="h-5 w-full overflow-hidden rounded-full bg-[var(--st-bg-muted)]">
                      <div
                        className="h-full rounded-full bg-[var(--st-text)] transition-all"
                        style={{ width: `${(d.count / maxUsed) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
