'use client';

/**
 * Wachat Business Hours — ZoruUI migration.
 * Weekly schedule + holiday list + offline auto-reply config.
 */

import * as React from 'react';
import { useEffect, useState, useTransition, useCallback } from 'react';
import { CalendarOff, Loader2, Plus, Save, Trash2 } from 'lucide-react';

import { useProject } from '@/context/project-context';
import {
  getBusinessHours,
  saveBusinessHours,
} from '@/app/actions/wachat-features.actions';

import {
  ZoruBreadcrumb,
  ZoruBreadcrumbItem,
  ZoruBreadcrumbLink,
  ZoruBreadcrumbList,
  ZoruBreadcrumbPage,
  ZoruBreadcrumbSeparator,
  ZoruButton,
  ZoruCard,
  ZoruDialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  ZoruEmptyState,
  ZoruInput,
  ZoruLabel,
  ZoruSelect,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  ZoruSwitch,
  ZoruTextarea,
  useZoruToast,
} from '@/components/zoruui';

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

// 30-min increments for the schedule grid time pickers
const TIME_OPTIONS = (() => {
  const arr: string[] = [];
  for (let h = 0; h < 24; h++) {
    for (const m of [0, 30]) {
      arr.push(
        `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`,
      );
    }
  }
  return arr;
})();

const DAYS = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
] as const;

type DaySchedule = { open: boolean; start: string; end: string };
type WeekSchedule = Record<string, DaySchedule>;
type Holiday = { id: string; name: string; date: string };

const defaultSchedule = (): WeekSchedule =>
  Object.fromEntries(
    DAYS.map((d) => [
      d,
      {
        open: d !== 'Saturday' && d !== 'Sunday',
        start: '09:00',
        end: '18:00',
      },
    ]),
  );

export default function BusinessHoursPage() {
  const { activeProject } = useProject();
  const { toast } = useZoruToast();
  const [isPending, startTransition] = useTransition();
  const [timezone, setTimezone] = useState('UTC');
  const [schedule, setSchedule] = useState<WeekSchedule>(defaultSchedule);
  const [offlineMsg, setOfflineMsg] = useState('');
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [editingHoliday, setEditingHoliday] = useState<Holiday | null>(null);
  const [holidayDraft, setHolidayDraft] = useState<{
    name: string;
    date: string;
  }>({ name: '', date: '' });

  const load = useCallback(() => {
    if (!activeProject?._id) return;
    startTransition(async () => {
      const res = await getBusinessHours(String(activeProject._id));
      if (res.error) {
        toast({
          title: 'Error',
          description: res.error,
          variant: 'destructive',
        });
        return;
      }
      if (res.hours) {
        setTimezone(res.hours.timezone || 'UTC');
        setOfflineMsg(res.hours.offlineMessage || '');
        if (res.hours.schedule && typeof res.hours.schedule === 'object') {
          setSchedule((prev) => ({ ...prev, ...res.hours.schedule }));
        }
        if (Array.isArray((res.hours as any).holidays)) {
          setHolidays((res.hours as any).holidays as Holiday[]);
        }
      }
    });
  }, [activeProject?._id, toast]);

  useEffect(() => {
    load();
  }, [load]);

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
    fd.set('holidays', JSON.stringify(holidays));
    const res = await saveBusinessHours(null, fd);
    if (res.error) {
      toast({
        title: 'Error',
        description: res.error,
        variant: 'destructive',
      });
      return;
    }
    toast({ title: res.message });
  };

  const openHolidayDialog = (h: Holiday | null) => {
    if (h) {
      setEditingHoliday(h);
      setHolidayDraft({ name: h.name, date: h.date });
    } else {
      setEditingHoliday({ id: '', name: '', date: '' });
      setHolidayDraft({ name: '', date: '' });
    }
  };

  const saveHoliday = () => {
    if (!holidayDraft.name.trim() || !holidayDraft.date) return;
    if (editingHoliday && editingHoliday.id) {
      setHolidays((prev) =>
        prev.map((h) =>
          h.id === editingHoliday.id ? { ...h, ...holidayDraft } : h,
        ),
      );
    } else {
      setHolidays((prev) => [
        ...prev,
        { id: crypto.randomUUID(), ...holidayDraft },
      ]);
    }
    setEditingHoliday(null);
  };

  const removeHoliday = (id: string) => {
    setHolidays((prev) => prev.filter((h) => h.id !== id));
  };

  return (
    <div className="mx-auto w-full max-w-[1320px] px-6 pt-6 pb-10">
      <ZoruBreadcrumb>
        <ZoruBreadcrumbList>
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/dashboard">SabNode</ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/wachat">WaChat</ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbPage>Business hours</ZoruBreadcrumbPage>
          </ZoruBreadcrumbItem>
        </ZoruBreadcrumbList>
      </ZoruBreadcrumb>

      <div className="mt-5">
        <h1 className="text-[30px] tracking-[-0.015em] text-zoru-ink leading-[1.1]">
          Business hours
        </h1>
        <p className="mt-1.5 text-[13px] text-zoru-ink-muted">
          Set your operating hours, holidays, and offline auto-reply message.
        </p>
      </div>

      <form onSubmit={handleSave} className="mt-6 flex flex-col gap-6">
        {/* Timezone */}
        <ZoruCard className="p-5">
          <ZoruLabel>Timezone</ZoruLabel>
          <ZoruSelect value={timezone} onValueChange={setTimezone}>
            <ZoruSelectTrigger className="mt-2 w-72">
              <ZoruSelectValue placeholder="Select timezone" />
            </ZoruSelectTrigger>
            <ZoruSelectContent>
              {TIMEZONES.map((tz) => (
                <ZoruSelectItem key={tz.value} value={tz.value}>
                  {tz.label}
                </ZoruSelectItem>
              ))}
            </ZoruSelectContent>
          </ZoruSelect>
        </ZoruCard>

        {/* Weekly schedule */}
        <ZoruCard className="p-5">
          <h2 className="mb-4 text-[15px] text-zoru-ink">Weekly schedule</h2>
          <div className="space-y-3">
            {DAYS.map((day) => {
              const d = schedule[day];
              return (
                <div
                  key={day}
                  className="flex flex-wrap items-center gap-4 rounded-[var(--zoru-radius)] border border-zoru-line p-3"
                >
                  <span className="w-24 text-[13px] text-zoru-ink">{day}</span>
                  <ZoruSwitch
                    checked={d.open}
                    onCheckedChange={(v) => updateDay(day, { open: v })}
                    aria-label={`${day} open`}
                  />
                  <span className="text-[12px] text-zoru-ink-muted">
                    {d.open ? 'Open' : 'Closed'}
                  </span>
                  {d.open && (
                    <>
                      <ZoruSelect
                        value={d.start}
                        onValueChange={(v) => updateDay(day, { start: v })}
                      >
                        <ZoruSelectTrigger className="w-28">
                          <ZoruSelectValue />
                        </ZoruSelectTrigger>
                        <ZoruSelectContent>
                          {TIME_OPTIONS.map((t) => (
                            <ZoruSelectItem key={t} value={t}>
                              {t}
                            </ZoruSelectItem>
                          ))}
                        </ZoruSelectContent>
                      </ZoruSelect>
                      <span className="text-[12px] text-zoru-ink-muted">to</span>
                      <ZoruSelect
                        value={d.end}
                        onValueChange={(v) => updateDay(day, { end: v })}
                      >
                        <ZoruSelectTrigger className="w-28">
                          <ZoruSelectValue />
                        </ZoruSelectTrigger>
                        <ZoruSelectContent>
                          {TIME_OPTIONS.map((t) => (
                            <ZoruSelectItem key={t} value={t}>
                              {t}
                            </ZoruSelectItem>
                          ))}
                        </ZoruSelectContent>
                      </ZoruSelect>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </ZoruCard>

        {/* Holidays */}
        <ZoruCard className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-[15px] text-zoru-ink">Holidays</h2>
            <ZoruButton
              type="button"
              size="sm"
              variant="outline"
              onClick={() => openHolidayDialog(null)}
            >
              <Plus /> Add holiday
            </ZoruButton>
          </div>
          {holidays.length === 0 ? (
            <ZoruEmptyState
              compact
              icon={<CalendarOff />}
              title="No holidays added"
              description="Add observed holidays so auto-replies kick in even on closed days."
            />
          ) : (
            <ul className="flex flex-col gap-2">
              {holidays.map((h) => (
                <li
                  key={h.id}
                  className="flex items-center justify-between gap-3 rounded-[var(--zoru-radius)] border border-zoru-line px-3 py-2"
                >
                  <div className="min-w-0">
                    <div className="text-[13px] text-zoru-ink">{h.name}</div>
                    <div className="text-[11.5px] text-zoru-ink-muted">
                      {h.date}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <ZoruButton
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => openHolidayDialog(h)}
                    >
                      Edit
                    </ZoruButton>
                    <ZoruButton
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Remove holiday"
                      onClick={() => removeHoliday(h.id)}
                    >
                      <Trash2 />
                    </ZoruButton>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </ZoruCard>

        {/* Offline message */}
        <ZoruCard className="p-5">
          <ZoruLabel htmlFor="offline-msg">Offline message</ZoruLabel>
          <ZoruTextarea
            id="offline-msg"
            value={offlineMsg}
            onChange={(e) => setOfflineMsg(e.target.value)}
            rows={3}
            placeholder="e.g. Thanks for reaching out! We are currently offline and will get back to you during business hours."
            className="mt-2"
          />
        </ZoruCard>

        <div className="flex items-center gap-3">
          <ZoruButton type="submit" disabled={isPending}>
            {isPending ? <Loader2 className="animate-spin" /> : <Save />}
            {isPending ? 'Saving…' : 'Save business hours'}
          </ZoruButton>
        </div>
      </form>

      {/* ── Edit holiday dialog ── */}
      <ZoruDialog
        open={!!editingHoliday}
        onOpenChange={(o) => !o && setEditingHoliday(null)}
      >
        <ZoruDialogContent>
          <ZoruDialogHeader>
            <ZoruDialogTitle>
              {editingHoliday?.id ? 'Edit holiday' : 'Add holiday'}
            </ZoruDialogTitle>
            <ZoruDialogDescription>
              Holidays apply across every connected WhatsApp number.
            </ZoruDialogDescription>
          </ZoruDialogHeader>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <ZoruLabel htmlFor="holiday-name">Name</ZoruLabel>
              <ZoruInput
                id="holiday-name"
                value={holidayDraft.name}
                onChange={(e) =>
                  setHolidayDraft((prev) => ({
                    ...prev,
                    name: e.target.value,
                  }))
                }
                placeholder="New Year's Day"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <ZoruLabel htmlFor="holiday-date">Date</ZoruLabel>
              <ZoruInput
                id="holiday-date"
                type="date"
                value={holidayDraft.date}
                onChange={(e) =>
                  setHolidayDraft((prev) => ({
                    ...prev,
                    date: e.target.value,
                  }))
                }
              />
            </div>
          </div>
          <ZoruDialogFooter>
            <ZoruButton variant="ghost" onClick={() => setEditingHoliday(null)}>
              Cancel
            </ZoruButton>
            <ZoruButton
              onClick={saveHoliday}
              disabled={!holidayDraft.name.trim() || !holidayDraft.date}
            >
              Save
            </ZoruButton>
          </ZoruDialogFooter>
        </ZoruDialogContent>
      </ZoruDialog>

      <div className="h-6" />
    </div>
  );
}
