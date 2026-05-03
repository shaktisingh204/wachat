'use client';

import * as React from 'react';
import { useEffect, useState, useTransition, useCallback } from 'react';
import { LuClock, LuSave, LuLoader } from 'react-icons/lu';
import { useProject } from '@/context/project-context';
import { useToast } from '@/hooks/use-toast';
import { ClayBreadcrumbs, ClayButton, ClayCard, ClayInput, ClaySelect } from '@/components/clay';
import { getBusinessHours, saveBusinessHours } from '@/app/actions/wachat-features.actions';

const TIMEZONES = [
  { value: 'UTC', label: 'UTC' },
  { value: 'Asia/Kolkata', label: 'IST (Asia/Kolkata)' },
  { value: 'America/New_York', label: 'EST (America/New_York)' },
  { value: 'America/Los_Angeles', label: 'PST (America/Los_Angeles)' },
  { value: 'Europe/London', label: 'GMT (Europe/London)' },
  { value: 'Europe/Berlin', label: 'CET (Europe/Berlin)' },
  { value: 'Asia/Dubai', label: 'GST (Asia/Dubai)' },
  { value: 'Asia/Singapore', label: 'SGT (Asia/Singapore)' },
  { value: 'Australia/Sydney', label: 'AEST (Australia/Sydney)' },
];

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const;
type DaySchedule = { open: boolean; start: string; end: string };
type WeekSchedule = Record<string, DaySchedule>;

const defaultSchedule = (): WeekSchedule =>
  Object.fromEntries(DAYS.map((d) => [d, { open: d !== 'Saturday' && d !== 'Sunday', start: '09:00', end: '18:00' }]));

export default function BusinessHoursPage() {
  const { activeProject } = useProject();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [timezone, setTimezone] = useState('UTC');
  const [schedule, setSchedule] = useState<WeekSchedule>(defaultSchedule);
  const [offlineMsg, setOfflineMsg] = useState('');

  const load = useCallback(() => {
    if (!activeProject?._id) return;
    startTransition(async () => {
      const res = await getBusinessHours(String(activeProject._id));
      if (res.error) { toast({ title: 'Error', description: res.error, variant: 'destructive' }); return; }
      if (res.hours) {
        setTimezone(res.hours.timezone || 'UTC');
        setOfflineMsg(res.hours.offlineMessage || '');
        if (res.hours.schedule && typeof res.hours.schedule === 'object') {
          setSchedule((prev) => ({ ...prev, ...res.hours.schedule }));
        }
      }
    });
  }, [activeProject?._id, toast]);

  useEffect(() => { load(); }, [load]);

  const updateDay = (day: string, patch: Partial<DaySchedule>) => {
    setSchedule((prev) => ({ ...prev, [day]: { ...prev[day], ...patch } }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const fd = new FormData();
    fd.set('projectId', String(activeProject?._id ?? ''));
    fd.set('timezone', timezone);
    fd.set('offlineMessage', offlineMsg);
    fd.set('schedule', JSON.stringify(schedule));
    const res = await saveBusinessHours(null, fd);
    if (res.error) { toast({ title: 'Error', description: res.error, variant: 'destructive' }); return; }
    toast({ title: res.message });
  };

  return (
    <div className="clay-enter flex min-h-full flex-col gap-6">
      <ClayBreadcrumbs items={[
        { label: 'Wachat', href: '/home' },
        { label: activeProject?.name || 'Project', href: '/dashboard' },
        { label: 'Business Hours' },
      ]} />

      <div>
        <h1 className="text-[30px] font-semibold tracking-[-0.015em] text-foreground leading-[1.1]">Business Hours</h1>
        <p className="mt-1.5 text-[13px] text-muted-foreground">Set your operating hours and offline auto-reply message.</p>
      </div>

      <form onSubmit={handleSave} className="flex flex-col gap-6">
        {/* Timezone */}
        <ClayCard padded={false} className="p-5">
          <label className="flex flex-col gap-1.5 text-[12px] font-medium text-muted-foreground">
            Timezone
            <ClaySelect options={TIMEZONES} value={timezone} onChange={(e) => setTimezone(e.target.value)} className="w-72" />
          </label>
        </ClayCard>

        {/* Weekly schedule */}
        <ClayCard padded={false} className="p-5">
          <h2 className="mb-4 text-[15px] font-semibold text-foreground">Weekly Schedule</h2>
          <div className="space-y-3">
            {DAYS.map((day) => {
              const d = schedule[day];
              return (
                <div key={day} className="flex flex-wrap items-center gap-4 rounded-lg border border-border p-3">
                  <span className="w-24 text-[13px] font-medium text-foreground">{day}</span>
                  <button type="button" onClick={() => updateDay(day, { open: !d.open })}
                    className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${d.open ? 'bg-primary' : 'bg-border'}`}>
                    <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${d.open ? 'left-[22px]' : 'left-0.5'}`} />
                  </button>
                  <span className="text-[12px] text-muted-foreground">{d.open ? 'Open' : 'Closed'}</span>
                  {d.open && (
                    <>
                      <ClayInput type="time" value={d.start} onChange={(e) => updateDay(day, { start: e.target.value })} sizeVariant="sm" className="w-32" />
                      <span className="text-[12px] text-muted-foreground">to</span>
                      <ClayInput type="time" value={d.end} onChange={(e) => updateDay(day, { end: e.target.value })} sizeVariant="sm" className="w-32" />
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </ClayCard>

        {/* Offline message */}
        <ClayCard padded={false} className="p-5">
          <label className="flex flex-col gap-1.5 text-[12px] font-medium text-muted-foreground">
            Offline Message
            <textarea value={offlineMsg} onChange={(e) => setOfflineMsg(e.target.value)} rows={3}
              placeholder="e.g. Thanks for reaching out! We are currently offline and will get back to you during business hours."
              className="clay-input min-h-[72px] resize-y py-2.5" />
          </label>
        </ClayCard>

        <div className="flex items-center gap-3">
          <ClayButton type="submit" variant="obsidian" leading={<LuSave className="h-4 w-4" />} disabled={isPending}>
            {isPending ? 'Saving...' : 'Save Business Hours'}
          </ClayButton>
          {isPending && <LuLoader className="h-4 w-4 animate-spin text-muted-foreground" />}
        </div>
      </form>
      <div className="h-6" />
    </div>
  );
}
