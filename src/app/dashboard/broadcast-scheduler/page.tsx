'use client';

/**
 * Wachat Broadcast Scheduler -- schedule broadcasts for future delivery.
 */

import * as React from 'react';
import { useEffect, useState, useTransition, useCallback, useActionState } from 'react';
import { LuCalendarClock, LuLoader, LuCircleX } from 'react-icons/lu';
import { useProject } from '@/context/project-context';
import { useToast } from '@/hooks/use-toast';
import { ClayBreadcrumbs, ClayButton, ClayCard, ClayBadge } from '@/components/clay';
import {
  getScheduledBroadcasts,
  scheduleBroadcast,
  cancelScheduledBroadcast,
} from '@/app/actions/wachat-features.actions';

const TIMEZONES = ['UTC', 'Asia/Kolkata', 'America/New_York', 'Europe/London'];

export default function BroadcastSchedulerPage() {
  const { activeProject } = useProject();
  const { toast } = useToast();
  const projectId = activeProject?._id?.toString();

  const [schedules, setSchedules] = useState<any[]>([]);
  const [isLoading, startLoading] = useTransition();
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const [formState, formAction, isPending] = useActionState(scheduleBroadcast, null);

  const fetchSchedules = useCallback((pid: string) => {
    startLoading(async () => {
      const res = await getScheduledBroadcasts(pid);
      if (res.error) toast({ title: 'Error', description: res.error, variant: 'destructive' });
      else setSchedules(res.schedules || []);
    });
  }, [toast]);

  useEffect(() => { if (projectId) fetchSchedules(projectId); }, [projectId, fetchSchedules]);

  useEffect(() => {
    if (formState?.message) {
      toast({ title: 'Scheduled', description: formState.message });
      if (projectId) fetchSchedules(projectId);
    }
    if (formState?.error) toast({ title: 'Error', description: formState.error, variant: 'destructive' });
  }, [formState, toast, projectId, fetchSchedules]);

  const handleCancel = async (id: string) => {
    setCancellingId(id);
    const res = await cancelScheduledBroadcast(id);
    setCancellingId(null);
    if (res.error) toast({ title: 'Error', description: res.error, variant: 'destructive' });
    else {
      setSchedules((prev) => prev.map((s) => s._id === id ? { ...s, status: 'cancelled' } : s));
      toast({ title: 'Cancelled', description: 'Broadcast schedule cancelled.' });
    }
  };

  const inputCls = 'rounded-lg border border-clay-border bg-clay-bg px-3 py-2 text-sm text-clay-ink placeholder:text-clay-ink-muted focus:border-clay-accent focus:outline-none w-full';

  return (
    <div className="clay-enter flex min-h-full flex-col gap-6">
      <ClayBreadcrumbs items={[
        { label: 'Wachat', href: '/home' },
        { label: activeProject?.name || 'Project', href: '/dashboard' },
        { label: 'Broadcast Scheduler' },
      ]} />

      <div>
        <h1 className="text-[30px] font-semibold tracking-[-0.015em] text-clay-ink leading-[1.1]">Broadcast Scheduler</h1>
        <p className="mt-1.5 text-[13px] text-clay-ink-muted">Schedule broadcasts for future delivery.</p>
      </div>

      <ClayCard padded={false} className="p-5">
        <h2 className="text-[15px] font-semibold text-clay-ink mb-4">New Schedule</h2>
        <form action={formAction} className="grid gap-3 sm:grid-cols-2 max-w-2xl">
          <input type="hidden" name="projectId" value={projectId || ''} />
          <input className={inputCls} name="name" placeholder="Broadcast name *" required />
          <input className={inputCls} name="templateName" placeholder="Template name *" required />
          <input className={inputCls} name="audience" placeholder="Audience (default: all)" />
          <select className={inputCls} name="timezone">
            {TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
          </select>
          <input type="datetime-local" className={inputCls} name="scheduledAt" required />
          <select className={inputCls} name="recurring">
            <option value="none">One-time</option>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>
          <div className="sm:col-span-2">
            <ClayButton type="submit" variant="obsidian" disabled={isPending || !projectId}>
              {isPending ? 'Scheduling...' : 'Save Schedule'}
            </ClayButton>
          </div>
        </form>
      </ClayCard>

      {isLoading && schedules.length === 0 ? (
        <div className="flex h-20 items-center justify-center">
          <LuLoader className="h-5 w-5 animate-spin text-clay-ink-muted" />
        </div>
      ) : schedules.length > 0 ? (
        <ClayCard padded={false} className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-clay-border text-[11px] font-semibold uppercase tracking-wide text-clay-ink-muted">
                <th className="px-5 py-3">Name</th>
                <th className="px-5 py-3">Template</th>
                <th className="px-5 py-3">Scheduled At</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {schedules.map((s) => (
                <tr key={s._id} className="border-b border-clay-border last:border-0">
                  <td className="px-5 py-3 text-[13px] font-medium text-clay-ink">{s.name}</td>
                  <td className="px-5 py-3 text-[13px] text-clay-ink-muted">{s.templateName}</td>
                  <td className="px-5 py-3 text-[13px] text-clay-ink-muted">{s.scheduledAt ? new Date(s.scheduledAt).toLocaleString() : '--'}</td>
                  <td className="px-5 py-3">
                    <ClayBadge tone={s.status === 'scheduled' ? 'blue' : s.status === 'cancelled' ? 'red' : 'neutral'}>{s.status}</ClayBadge>
                  </td>
                  <td className="px-5 py-3 text-right">
                    {s.status === 'scheduled' && (
                      <ClayButton size="sm" variant="ghost" onClick={() => handleCancel(s._id)} disabled={cancellingId === s._id}>
                        {cancellingId === s._id ? 'Cancelling...' : 'Cancel'}
                      </ClayButton>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ClayCard>
      ) : (
        <ClayCard className="p-12 text-center">
          <LuCalendarClock className="mx-auto h-12 w-12 text-clay-ink-muted/30 mb-4" />
          <p className="text-sm text-clay-ink-muted">No scheduled broadcasts.</p>
        </ClayCard>
      )}
      <div className="h-6" />
    </div>
  );
}
