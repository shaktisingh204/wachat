'use client';

/**
 * Wachat Broadcast Scheduler — schedule broadcasts for future delivery.
 */

import * as React from 'react';
import { useState } from 'react';
import { LuCalendarClock, LuSave, LuRepeat } from 'react-icons/lu';
import { useProject } from '@/context/project-context';
import { useToast } from '@/hooks/use-toast';
import { ClayBreadcrumbs, ClayButton, ClayCard, ClayBadge } from '@/components/clay';

type Recurrence = 'none' | 'daily' | 'weekly' | 'monthly';

interface ScheduledBroadcast {
  id: string;
  name: string;
  template: string;
  audience: string;
  date: string;
  time: string;
  timezone: string;
  recurrence: Recurrence;
}

const TEMPLATES = ['Order Confirmation', 'Welcome Message', 'Promo Offer', 'Appointment Reminder'];
const TIMEZONES = ['UTC', 'Asia/Kolkata', 'America/New_York', 'Europe/London', 'Asia/Dubai'];

export default function BroadcastSchedulerPage() {
  const { activeProject } = useProject();
  const { toast } = useToast();

  const [schedules, setSchedules] = useState<ScheduledBroadcast[]>([
    { id: '1', name: 'Weekly Promo', template: 'Promo Offer', audience: 'tag:vip', date: '2026-04-15', time: '10:00', timezone: 'UTC', recurrence: 'weekly' },
  ]);

  const [form, setForm] = useState({
    name: '', template: TEMPLATES[0], audience: 'all', date: '', time: '09:00', timezone: 'UTC', recurrence: 'none' as Recurrence,
  });

  const handleSave = () => {
    if (!form.name.trim() || !form.date) {
      toast({ title: 'Missing fields', description: 'Name and date are required.', variant: 'destructive' });
      return;
    }
    const newItem: ScheduledBroadcast = { ...form, id: Date.now().toString() };
    setSchedules((prev) => [...prev, newItem]);
    setForm({ name: '', template: TEMPLATES[0], audience: 'all', date: '', time: '09:00', timezone: 'UTC', recurrence: 'none' });
    toast({ title: 'Scheduled', description: `"${form.name}" has been scheduled.` });
  };

  const handleDelete = (id: string) => {
    setSchedules((prev) => prev.filter((s) => s.id !== id));
    toast({ title: 'Removed', description: 'Schedule deleted.' });
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
        <p className="mt-1.5 text-[13px] text-clay-ink-muted">Schedule broadcasts for future delivery with optional recurring patterns.</p>
      </div>

      {/* Form */}
      <ClayCard padded={false} className="p-5">
        <h2 className="text-[15px] font-semibold text-clay-ink mb-4">New Schedule</h2>
        <div className="grid gap-3 sm:grid-cols-2 max-w-2xl">
          <input className={inputCls} placeholder="Broadcast name *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <select className={inputCls} value={form.template} onChange={(e) => setForm({ ...form, template: e.target.value })}>
            {TEMPLATES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <select className={inputCls} value={form.audience} onChange={(e) => setForm({ ...form, audience: e.target.value })}>
            <option value="all">All Contacts</option>
            <option value="tag:vip">Tag: VIP</option>
            <option value="tag:new">Tag: New</option>
            <option value="segment:active">Segment: Active Users</option>
          </select>
          <select className={inputCls} value={form.timezone} onChange={(e) => setForm({ ...form, timezone: e.target.value })}>
            {TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
          </select>
          <input type="date" className={inputCls} value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          <input type="time" className={inputCls} value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} />
          <div className="sm:col-span-2">
            <label className="text-[12px] text-clay-ink-muted mb-1.5 block">Recurrence</label>
            <div className="flex gap-2">
              {(['none', 'daily', 'weekly', 'monthly'] as const).map((r) => (
                <button key={r} onClick={() => setForm({ ...form, recurrence: r })}
                  className={`rounded-md px-3 py-1.5 text-[12px] font-medium capitalize transition-colors ${
                    form.recurrence === r ? 'bg-clay-ink text-white' : 'bg-clay-bg text-clay-ink-muted border border-clay-border hover:bg-clay-bg-2'
                  }`}>{r === 'none' ? 'One-time' : r}</button>
              ))}
            </div>
          </div>
        </div>
        <div className="mt-4">
          <ClayButton variant="obsidian" onClick={handleSave} leading={<LuSave className="h-4 w-4" />}>Save Schedule</ClayButton>
        </div>
      </ClayCard>

      {/* Scheduled list */}
      {schedules.length > 0 ? (
        <ClayCard padded={false} className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-clay-border text-[11px] font-semibold uppercase tracking-wide text-clay-ink-muted">
                <th className="px-5 py-3">Name</th>
                <th className="px-5 py-3">Template</th>
                <th className="px-5 py-3">Audience</th>
                <th className="px-5 py-3">Date / Time</th>
                <th className="px-5 py-3">Recurrence</th>
                <th className="px-5 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {schedules.map((s) => (
                <tr key={s.id} className="border-b border-clay-border last:border-0">
                  <td className="px-5 py-3 text-[13px] font-medium text-clay-ink">{s.name}</td>
                  <td className="px-5 py-3 text-[13px] text-clay-ink-muted">{s.template}</td>
                  <td className="px-5 py-3"><ClayBadge tone="neutral">{s.audience}</ClayBadge></td>
                  <td className="px-5 py-3 text-[13px] text-clay-ink-muted">{s.date} {s.time} ({s.timezone})</td>
                  <td className="px-5 py-3">
                    {s.recurrence !== 'none' ? (
                      <span className="inline-flex items-center gap-1 text-[12px] text-clay-ink-muted"><LuRepeat className="h-3 w-3" />{s.recurrence}</span>
                    ) : <span className="text-[12px] text-clay-ink-muted">One-time</span>}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <ClayButton size="sm" variant="ghost" onClick={() => handleDelete(s.id)}>Delete</ClayButton>
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
