'use client';

/**
 * Wachat Credit Usage -- billing and credit usage dashboard.
 */

import * as React from 'react';
import { useEffect, useState, useTransition, useCallback } from 'react';
import { LuCoins, LuTrendingUp, LuCalendar, LuTriangleAlert, LuLoader, LuCreditCard } from 'react-icons/lu';
import { useRouter } from 'next/navigation';
import { useProject } from '@/context/project-context';
import { useToast } from '@/hooks/use-toast';
import { ClayBreadcrumbs, ClayButton, ClayCard } from '@/components/clay';
import { getCreditUsage } from '@/app/actions/wachat-features.actions';
import { ResponsiveContainer, LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip } from 'recharts';

export default function CreditUsagePage() {
  const router = useRouter();
  const { activeProject } = useProject();
  const { toast } = useToast();
  const projectId = activeProject?._id?.toString();

  const [credits, setCredits] = useState(0);
  const [dailyUsage, setDailyUsage] = useState<any[]>([]);
  const [isLoading, startLoading] = useTransition();

  const fetchUsage = useCallback((pid: string) => {
    startLoading(async () => {
      const res = await getCreditUsage(pid);
      if (res.error) toast({ title: 'Error', description: res.error, variant: 'destructive' });
      else {
        setCredits(res.credits || 0);
        setDailyUsage(res.dailyUsage || []);
      }
    });
  }, [toast]);

  useEffect(() => { if (projectId) fetchUsage(projectId); }, [projectId, fetchUsage]);

  const totalUsed = dailyUsage.reduce((sum, d) => sum + (d.count || 0), 0);
  const dailyAvg = dailyUsage.length > 0 ? Math.round(totalUsed / dailyUsage.length) : 0;
  const maxUsed = Math.max(...dailyUsage.map((d) => d.count || 0), 1);
  const isLow = credits < 5000;
  const daysLeft = dailyAvg > 0 ? Math.floor(credits / dailyAvg) : 0;

  const stats = [
    { label: 'Credits Remaining', value: credits.toLocaleString(), icon: LuCoins },
    { label: 'Used (30 days)', value: totalUsed.toLocaleString(), icon: LuTrendingUp },
    { label: 'Daily Average', value: dailyAvg.toLocaleString(), icon: LuCalendar },
  ];

  return (
    <div className="clay-enter flex min-h-full flex-col gap-6">
      <ClayBreadcrumbs items={[
        { label: 'Wachat', href: '/home' },
        { label: activeProject?.name || 'Project', href: '/dashboard' },
        { label: 'Credit Usage' },
      ]} />

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[30px] font-semibold tracking-[-0.015em] text-foreground leading-[1.1]">Credit Usage</h1>
          <p className="mt-1.5 text-[13px] text-muted-foreground">Monitor your messaging credit balance and daily usage.</p>
        </div>
        <ClayButton
          variant="obsidian"
          size="md"
          leading={<LuCreditCard className="h-3.5 w-3.5" strokeWidth={2} />}
          onClick={() => router.push('/dashboard/billing')}
        >
          Top up credits
        </ClayButton>
      </div>

      {isLow && credits > 0 && (
        <div className="rounded-[12px] border border-amber-200 bg-amber-50 p-4 flex items-start gap-3">
          <LuTriangleAlert className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-[13px] font-semibold text-amber-800">Low credit balance</p>
            <p className="text-[12.5px] text-amber-700">
              Approximately {daysLeft} day{daysLeft !== 1 ? 's' : ''} of credits remaining at current usage.
            </p>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex h-32 items-center justify-center">
          <LuLoader className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {stats.map((s) => (
              <ClayCard key={s.label} padded={false} className="flex items-center gap-4 p-5">
                <span className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-secondary">
                  <s.icon className="h-5 w-5 text-muted-foreground" strokeWidth={1.75} />
                </span>
                <div>
                  <div className="text-[12px] text-muted-foreground">{s.label}</div>
                  <div className="text-[22px] font-semibold text-foreground leading-tight tabular-nums">{s.value}</div>
                </div>
              </ClayCard>
            ))}
          </div>

          {dailyUsage.length > 0 && (
            <ClayCard padded={false} className="p-5">
              <h2 className="text-[15px] font-semibold text-foreground mb-4">Daily trend</h2>
              <div className="mb-5 h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={dailyUsage.map((d) => ({ date: d._id, count: d.count }))} margin={{ top: 5, right: 12, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
                    <XAxis dataKey="date" stroke="#a1a1aa" tick={{ fontSize: 10 }} />
                    <YAxis stroke="#a1a1aa" tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Line type="monotone" dataKey="count" stroke="#f59e0b" strokeWidth={2} dot={false} name="Credits used" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-2">
                <div className="grid grid-cols-[100px_80px_1fr] gap-2 text-[11.5px] font-medium text-muted-foreground">
                  <span>Date</span><span className="text-right">Messages</span><span />
                </div>
                {dailyUsage.map((d) => (
                  <div key={d._id} className="grid grid-cols-[100px_80px_1fr] items-center gap-2 text-[13px] text-foreground">
                    <span className="font-medium">{d._id}</span>
                    <span className="text-right tabular-nums">{d.count}</span>
                    <div className="h-5 w-full overflow-hidden rounded-full bg-secondary">
                      <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${(d.count / maxUsed) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </ClayCard>
          )}
        </>
      )}
      <div className="h-6" />
    </div>
  );
}
