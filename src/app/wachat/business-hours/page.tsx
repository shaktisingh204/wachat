'use client';

import {
  Dialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  Input,
  Label,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  Textarea,
  useZoruToast,
} from '@/components/zoruui';
import { useEffect, useState, useTransition, useCallback } from 'react';
import { CalendarOff, Clock, Loader2, Plus, Save, Trash2 } from 'lucide-react';
import { m, AnimatePresence, useReducedMotion } from 'motion/react';

import { useProject } from '@/context/project-context';
import { getBusinessHours, saveBusinessHours } from '@/app/actions/wachat-features.actions';
import {
  WaPage,
  PageHeader,
  WaButton,
  Section,
  EmptyState,
} from '@/components/wachat-ui';
import { EASE_OUT } from '@/components/dashboard-ui/module-theme';

import * as React from 'react';

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

const TIME_OPTIONS = (() => {
  const arr: string[] = [];
  for (let h = 0; h < 24; h++) {
    for (const m of [0, 30]) {
      arr.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
    }
  }
  return arr;
})();

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const;

type DaySchedule = { open: boolean; start: string; end: string };
type WeekSchedule = Record<string, DaySchedule>;
type Holiday = { id: string; name: string; date: string };

const defaultSchedule = (): WeekSchedule =>
  Object.fromEntries(
    DAYS.map((d) => [
      d,
      { open: d !== 'Saturday' && d !== 'Sunday', start: '09:00', end: '18:00' },
    ]),
  );

export default function BusinessHoursPage() {
  const { activeProject } = useProject();
  const { toast } = useZoruToast();
  const [isPending, startTransition] = useTransition();
  const reduced = useReducedMotion();

  const [timezone, setTimezone] = useState('UTC');
  const [schedule, setSchedule] = useState<WeekSchedule>(defaultSchedule);
  const [offlineMsg, setOfflineMsg] = useState('');
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [editingHoliday, setEditingHoliday] = useState<Holiday | null>(null);
  const [holidayDraft, setHolidayDraft] = useState<{ name: string; date: string }>({
    name: '',
    date: '',
  });

  const load = useCallback(() => {
    if (!activeProject?._id) return;
    startTransition(async () => {
      const res = await getBusinessHours(String(activeProject._id));
      if (res.error) {
        toast({ title: 'Error', description: res.error, variant: 'destructive' });
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

  const persistHours = async () => {
    const fd = new FormData();
    fd.set('projectId', String(activeProject?._id ?? ''));
    fd.set('timezone', timezone);
    fd.set('offlineMessage', offlineMsg);
    fd.set('schedule', JSON.stringify(schedule));
    fd.set('holidays', JSON.stringify(holidays));
    const res = await saveBusinessHours(null, fd);
    if (res.error) {
      toast({ title: 'Error', description: res.error, variant: 'destructive' });
      return;
    }
    toast({ title: res.message });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    await persistHours();
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
        prev.map((h) => (h.id === editingHoliday.id ? { ...h, ...holidayDraft } : h)),
      );
    } else {
      setHolidays((prev) => [...prev, { id: crypto.randomUUID(), ...holidayDraft }]);
    }
    setEditingHoliday(null);
  };

  const removeHoliday = (id: string) => {
    setHolidays((prev) => prev.filter((h) => h.id !== id));
  };

  return (
    <WaPage>
      <PageHeader
        title="Business hours"
        description="Set your operating hours, holidays, and offline auto-reply message."
        kicker="Wachat"
        eyebrowIcon={Clock}
        backHref="/wachat"
        actions={
          <WaButton leftIcon={isPending ? Loader2 : Save} onClick={persistHours} disabled={isPending}>
            {isPending ? 'Saving...' : 'Save business hours'}
          </WaButton>
        }
      />

      <form onSubmit={handleSave} className="flex flex-col gap-6">
        {/* Timezone */}
        <Section title="Timezone" description="All scheduling uses this timezone.">
          <Select value={timezone} onValueChange={setTimezone}>
            <ZoruSelectTrigger className="w-72 rounded-xl">
              <ZoruSelectValue placeholder="Select timezone" />
            </ZoruSelectTrigger>
            <ZoruSelectContent>
              {TIMEZONES.map((tz) => (
                <ZoruSelectItem key={tz.value} value={tz.value}>
                  {tz.label}
                </ZoruSelectItem>
              ))}
            </ZoruSelectContent>
          </Select>
        </Section>

        {/* Weekly schedule */}
        <Section title="Weekly schedule" description="Toggle each day open or closed, then set hours.">
          <ul className="space-y-2">
            {DAYS.map((day, i) => {
              const d = schedule[day];
              return (
                <m.li
                  key={day}
                  initial={{ opacity: 0, x: -4 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.28, delay: 0.02 + i * 0.025, ease: EASE_OUT }}
                  className="flex flex-wrap items-center gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-3"
                >
                  <span className="w-24 shrink-0 text-[13px] font-semibold text-zinc-900">{day}</span>
                  <ToggleSwitch
                    checked={d.open}
                    onCheckedChange={(v) => updateDay(day, { open: v })}
                    ariaLabel={`${day} open`}
                    reduced={!!reduced}
                  />
                  <span className="w-14 text-[12px] text-zinc-500">{d.open ? 'Open' : 'Closed'}</span>
                  <AnimatePresence initial={false}>
                    {d.open && (
                      <m.div
                        key="hours"
                        initial={{ opacity: 0, width: 0 }}
                        animate={{ opacity: 1, width: 'auto' }}
                        exit={{ opacity: 0, width: 0 }}
                        transition={{ duration: 0.25, ease: EASE_OUT }}
                        className="flex items-center gap-2 overflow-hidden"
                      >
                        <Select value={d.start} onValueChange={(v) => updateDay(day, { start: v })}>
                          <ZoruSelectTrigger className="w-24 rounded-lg">
                            <ZoruSelectValue />
                          </ZoruSelectTrigger>
                          <ZoruSelectContent>
                            {TIME_OPTIONS.map((t) => (
                              <ZoruSelectItem key={t} value={t}>
                                {t}
                              </ZoruSelectItem>
                            ))}
                          </ZoruSelectContent>
                        </Select>
                        <span className="text-[12px] text-zinc-400">to</span>
                        <Select value={d.end} onValueChange={(v) => updateDay(day, { end: v })}>
                          <ZoruSelectTrigger className="w-24 rounded-lg">
                            <ZoruSelectValue />
                          </ZoruSelectTrigger>
                          <ZoruSelectContent>
                            {TIME_OPTIONS.map((t) => (
                              <ZoruSelectItem key={t} value={t}>
                                {t}
                              </ZoruSelectItem>
                            ))}
                          </ZoruSelectContent>
                        </Select>
                      </m.div>
                    )}
                  </AnimatePresence>
                </m.li>
              );
            })}
          </ul>
        </Section>

        {/* Holidays */}
        <Section
          title="Holidays"
          description="Observed dates close the business, even on normally-open days."
          action={
            <WaButton type="button" size="sm" variant="outline" leftIcon={Plus} onClick={() => openHolidayDialog(null)}>
              Add holiday
            </WaButton>
          }
        >
          {holidays.length === 0 ? (
            <div className="rounded-xl border border-dashed border-zinc-200 px-4 py-8 text-center">
              <CalendarOff className="mx-auto h-5 w-5 text-zinc-300" strokeWidth={2} aria-hidden />
              <p className="mt-2 text-[13px] font-semibold text-zinc-900">No holidays added</p>
              <p className="mt-1 text-[12px] text-zinc-500">
                Add observed holidays so auto-replies kick in even on closed days.
              </p>
            </div>
          ) : (
            <ul className="flex flex-col gap-2">
              {holidays.map((h, i) => (
                <m.li
                  key={h.id}
                  initial={{ opacity: 0, x: -4 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.25, delay: 0.02 + i * 0.025, ease: EASE_OUT }}
                  className="flex items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-3"
                >
                  <div className="min-w-0">
                    <div className="truncate text-[13px] font-semibold text-zinc-900">{h.name}</div>
                    <div className="text-[11.5px] tabular-nums text-zinc-500">{h.date}</div>
                  </div>
                  <div className="flex items-center gap-1">
                    <WaButton type="button" size="sm" variant="ghost" onClick={() => openHolidayDialog(h)}>
                      Edit
                    </WaButton>
                    <button
                      type="button"
                      onClick={() => removeHoliday(h.id)}
                      className="grid h-7 w-7 place-items-center rounded-lg text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-rose-600 active:scale-[0.97]"
                      aria-label="Remove holiday"
                    >
                      <Trash2 className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden />
                    </button>
                  </div>
                </m.li>
              ))}
            </ul>
          )}
        </Section>

        {/* Offline message */}
        <Section title="Offline message" description="Sent automatically outside business hours.">
          <Textarea
            id="offline-msg"
            value={offlineMsg}
            onChange={(e) => setOfflineMsg(e.target.value)}
            rows={3}
            placeholder="e.g. Thanks for reaching out. We are offline and will reply during business hours."
            className="rounded-xl"
          />
        </Section>

        <div className="flex items-center gap-3">
          <WaButton type="submit" leftIcon={isPending ? Loader2 : Save} disabled={isPending}>
            {isPending ? 'Saving...' : 'Save business hours'}
          </WaButton>
        </div>
      </form>

      {/* Edit holiday dialog */}
      <Dialog open={!!editingHoliday} onOpenChange={(o) => !o && setEditingHoliday(null)}>
        <ZoruDialogContent>
          <ZoruDialogHeader>
            <ZoruDialogTitle>{editingHoliday?.id ? 'Edit holiday' : 'Add holiday'}</ZoruDialogTitle>
            <ZoruDialogDescription>Holidays apply across every connected WhatsApp number.</ZoruDialogDescription>
          </ZoruDialogHeader>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="holiday-name">Name</Label>
              <Input
                id="holiday-name"
                value={holidayDraft.name}
                onChange={(e) => setHolidayDraft((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="New Year's Day"
                className="rounded-xl"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="holiday-date">Date</Label>
              <Input
                id="holiday-date"
                type="date"
                value={holidayDraft.date}
                onChange={(e) => setHolidayDraft((prev) => ({ ...prev, date: e.target.value }))}
                className="rounded-xl"
              />
            </div>
          </div>
          <ZoruDialogFooter>
            <WaButton variant="ghost" size="sm" onClick={() => setEditingHoliday(null)}>
              Cancel
            </WaButton>
            <WaButton size="sm" onClick={saveHoliday} disabled={!holidayDraft.name.trim() || !holidayDraft.date}>
              Save
            </WaButton>
          </ZoruDialogFooter>
        </ZoruDialogContent>
      </Dialog>
    </WaPage>
  );
}

function ToggleSwitch({
  checked,
  onCheckedChange,
  ariaLabel,
  reduced,
}: {
  checked: boolean;
  onCheckedChange: (next: boolean) => void;
  ariaLabel: string;
  reduced: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      onClick={() => onCheckedChange(!checked)}
      className="relative inline-flex h-6 w-10 shrink-0 items-center rounded-full transition-colors duration-200 active:scale-[0.97]"
      style={{ background: checked ? 'var(--mt-accent)' : '#e4e4e7' }}
    >
      <m.span
        layout
        transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 500, damping: 30 }}
        className={`block h-5 w-5 rounded-full bg-white shadow ${checked ? 'ml-auto mr-0.5' : 'ml-0.5'}`}
      />
    </button>
  );
}
