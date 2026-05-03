'use client';

import * as React from 'react';
import { useEffect, useState, useTransition, useCallback } from 'react';
import { LuSend, LuCheckCheck, LuEye, LuCircleX, LuLoader } from 'react-icons/lu';
import { useProject } from '@/context/project-context';
import { useToast } from '@/hooks/use-toast';
import { ClayBreadcrumbs, ClayCard, ClayBadge } from '@/components/clay';
import { getDeliveryReport } from '@/app/actions/wachat-features.actions';

const STAT_META = [
  { key: 'sent', label: 'Sent', icon: LuSend, color: 'bg-blue-400' },
  { key: 'delivered', label: 'Delivered', icon: LuCheckCheck, color: 'bg-emerald-400' },
  { key: 'read', label: 'Read', icon: LuEye, color: 'bg-violet-400' },
  { key: 'failed', label: 'Failed', icon: LuCircleX, color: 'bg-red-400' },
];

export default function DeliveryReportsPage() {
  const { activeProject } = useProject();
  const { toast } = useToast();
  const projectId = activeProject?._id?.toString();
  const [stats, setStats] = useState<any[]>([]);
  const [failedMessages, setFailedMessages] = useState<any[]>([]);
  const [isLoading, startTransition] = useTransition();

  const fetchData = useCallback(() => {
    if (!projectId) return;
    startTransition(async () => {
      const res = await getDeliveryReport(projectId, 7);
      if (res.error) { toast({ title: 'Error', description: res.error, variant: 'destructive' }); return; }
      setStats(res.stats ?? []);
      setFailedMessages(res.failedMessages ?? []);
    });
  }, [projectId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const statMap: Record<string, number> = {};
  let total = 0;
  for (const s of stats) {
    statMap[s._id] = s.count;
    total += s.count;
  }

  const statCards = STAT_META.map((m) => {
    const value = statMap[m.key] ?? 0;
    const pct = total > 0 ? ((value / total) * 100).toFixed(1) : '0';
    return { ...m, value, pct };
  });

  if (isLoading) {
    return (
      <div className="flex min-h-[300px] items-center justify-center">
        <LuLoader className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="clay-enter flex min-h-full flex-col gap-6">
      <ClayBreadcrumbs items={[
        { label: 'Wachat', href: '/home' },
        { label: activeProject?.name || 'Project', href: '/dashboard' },
        { label: 'Delivery Reports' },
      ]} />

      <div>
        <h1 className="text-[30px] font-semibold tracking-[-0.015em] text-foreground leading-[1.1]">Delivery Reports</h1>
        <p className="mt-1.5 text-[13px] text-muted-foreground">View message delivery status breakdown and failed message details.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((s) => (
          <ClayCard key={s.key} padded={false} className="p-5">
            <div className="flex items-center gap-3 mb-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-secondary">
                <s.icon className="h-5 w-5 text-muted-foreground" strokeWidth={1.75} />
              </span>
              <div>
                <div className="text-[12px] text-muted-foreground">{s.label}</div>
                <div className="text-[22px] font-semibold text-foreground leading-tight tabular-nums">{s.value.toLocaleString()}</div>
              </div>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
              <div className={`h-full rounded-full ${s.color} transition-all`} style={{ width: `${s.pct}%` }} />
            </div>
            <div className="mt-1 text-[11px] text-muted-foreground text-right">{s.pct}%</div>
          </ClayCard>
        ))}
      </div>

      <ClayCard padded={false} className="overflow-x-auto">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="text-[15px] font-semibold text-foreground">Recent Failed Messages</h2>
        </div>
        {failedMessages.length > 0 ? (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                <th className="px-5 py-3">Recipient</th>
                <th className="px-5 py-3">Type</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Date</th>
              </tr>
            </thead>
            <tbody>
              {failedMessages.map((m) => (
                <tr key={m._id} className="border-b border-border last:border-0">
                  <td className="px-5 py-3 text-[13px] text-foreground font-mono">{m.recipientPhone || m.contactId || '-'}</td>
                  <td className="px-5 py-3 text-[13px] text-foreground">{m.type || 'text'}</td>
                  <td className="px-5 py-3"><ClayBadge tone="red">{m.status}</ClayBadge></td>
                  <td className="px-5 py-3 text-[12px] text-muted-foreground whitespace-nowrap">
                    {m.timestamp ? new Date(m.timestamp).toLocaleString() : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="px-5 py-8 text-center text-sm text-muted-foreground">No failed messages in the last 7 days.</div>
        )}
      </ClayCard>
      <div className="h-6" />
    </div>
  );
}
