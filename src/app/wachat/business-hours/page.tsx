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
import { useEffect, useMemo, useState, useTransition, useCallback } from 'react';
import {
  CalendarOff,
  Clock,
  Loader2,
  Plus,
  Save,
  Trash2,
  Globe,
  CalendarDays,
  Sun,
  MoonStar,
  MessageSquare,
} from 'lucide-react';
import { m, AnimatePresence, useReducedMotion } from 'motion/react';

import { useProject } from '@/context/project-context';
import { getBusinessHours, saveBusinessHours } from '@/app/actions/wachat-features.actions';
import {
  WaPage,
  PageHeader,
  WaButton,
  Section,
  MetricTile,
  PhoneFrame,
  ChatBubble,
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
const DAYS_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

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

function toMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

export default function BusinessHoursPage() {
  const { activeProject } = useProject();
  const { toast } = useZoruToast();
  const [isPending, startTransition] = useTransition();
  const reduced = useReducedMotion();

  const [timezone, setTimezone] = useState('UTC');
  const [schedule, setSchedule] = useState<WeekSchedule>(defaultSchedule);
  const [offlineMsg, setOfflineMsg] = useState('');
  const [offlineAutoReply, setOfflineAutoReply] = useState(true);
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

  const stats = useMemo(() => {
    const openDays = DAYS.filter((d) => schedule[d]?.open).length;
    const totalMinutes = DAYS.reduce((sum, d) => {
      const s = schedule[d];
      if (!s?.open) return sum;
      return sum + Math.max(0, toMinutes(s.end) - toMinutes(s.start));
    }, 0);
    const weeklyHours = Math.round((totalMinutes / 60) * 10) / 10;
    const upcomingHolidays = holidays.filter((h) => {
      const t = new Date(h.date).getTime();
      return !isNaN(t) && t >= Date.now() - 24 * 60 * 60 * 1000;
    }).length;
    return { openDays, weeklyHours, upcomingHolidays };
  }, [schedule, holidays]);

  return (
    <WaPage>
      <PageHeader
        title="Business hours"
        description="Configure operating hours, holidays, and the offline auto-reply. Customers see a consistent presence across every WhatsApp number."
        kicker="Wachat"
        eyebrowIcon={Clock}
        backHref="/wachat"
        actions={
          <WaButton leftIcon={isPending ? Loader2 : Save} onClick={persistHours} disabled={isPending}>
            {isPending ? 'Saving...' : 'Save business hours'}
          </WaButton>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <MetricTile label="Open days" value={`${stats.openDays}/7`} icon={CalendarDays} delay={0.02} />
        <MetricTile label="Weekly hours" value={`${stats.weeklyHours}h`} icon={Clock} delay={0.05} />
        <MetricTile label="Holidays" value={holidays.length} icon={CalendarOff} delay={0.08} />
        <MetricTile label="Upcoming" value={stats.upcomingHolidays} icon={CalendarDays} delay={0.11} />
        <MetricTile label="Timezone" value={timezone.split('/').pop() ?? timezone} icon={Globe} delay={0.14} />
        <MetricTile
          label="Auto-reply"
          value={offlineAutoReply ? 'on' : 'off'}
          icon={MessageSquare}
          delay={0.17}
        />
      </div>

      <form onSubmit={handleSave} className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex flex-col gap-4">
          {/* Timezone + auto-reply */}
          <Section title="Timezone & defaults" description="All scheduling uses this timezone.">
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-[260px] flex-1">
                <Label className="mb-1 block">Timezone</Label>
                <Select value={timezone} onValueChange={setTimezone}>
                  <ZoruSelectTrigger className="rounded-xl">
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
              </div>
              <div className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2.5">
                <span className="text-[12.5px] font-semibold text-zinc-900">Auto-reply outside hours</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={offlineAutoReply}
                  onClick={() => setOfflineAutoReply((v) => !v)}
                  className="relative inline-flex h-6 w-10 items-center rounded-full transition-colors duration-200 active:scale-[0.97]"
                  style={{ background: offlineAutoReply ? 'var(--mt-accent)' : '#e4e4e7' }}
                >
                  <m.span
                    layout
                    transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 500, damping: 30 }}
                    className={`block h-5 w-5 rounded-full bg-white shadow ${offlineAutoReply ? 'ml-auto mr-0.5' : 'ml-0.5'}`}
                  />
                </button>
              </div>
            </div>
          </Section>

          {/* Weekly schedule with grid visualization */}
          <Section
            title="Weekly schedule"
            description="Toggle each day open or closed, then set hours. The bar shows the active window across 24h."
          >
            <ul className="flex flex-col gap-2">
              {DAYS.map((day, i) => {
                const d = schedule[day];
                const startMin = d.open ? toMinutes(d.start) : 0;
                const endMin = d.open ? toMinutes(d.end) : 0;
                const startPct = (startMin / 1440) * 100;
                const endPct = (endMin / 1440) * 100;
                const widthPct = Math.max(0, endPct - startPct);
                return (
                  <m.li
                    key={day}
                    initial={{ opacity: 0, x: -4 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.28, delay: 0.02 + i * 0.025, ease: EASE_OUT }}
                    className="rounded-xl border border-zinc-200 bg-white px-3 py-2.5"
                  >
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="w-20 shrink-0 text-[13px] font-semibold text-zinc-900">{day}</span>
                      <ToggleSwitch
                        checked={d.open}
                        onCheckedChange={(v) => updateDay(day, { open: v })}
                        ariaLabel={`${day} open`}
                        reduced={!!reduced}
                      />
                      <span className={`w-14 text-[11.5px] font-semibold ${d.open ? 'text-emerald-700' : 'text-zinc-400'}`}>
                        {d.open ? 'Open' : 'Closed'}
                      </span>
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
                              <ZoruSelectTrigger className="h-8 w-[88px] rounded-lg text-[12px]">
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
                              <ZoruSelectTrigger className="h-8 w-[88px] rounded-lg text-[12px]">
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
                    </div>
                    {/* 24h bar */}
                    <div className="mt-2 ml-[80px] flex items-center gap-2">
                      <span className="w-7 text-[10px] tabular-nums text-zinc-300">0</span>
                      <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-zinc-100">
                        {d.open ? (
                          <m.div
                            layout
                            className="absolute top-0 h-full rounded-full"
                            style={{
                              left: `${startPct}%`,
                              width: `${widthPct}%`,
                              backgroundImage:
                                'linear-gradient(90deg, #25D366, color-mix(in oklch, #25D366 60%, white))',
                            }}
                          />
                        ) : null}
                      </div>
                      <span className="w-7 text-right text-[10px] tabular-nums text-zinc-300">24</span>
                    </div>
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
              <ul className="divide-y divide-zinc-100">
                {holidays
                  .slice()
                  .sort((a, b) => a.date.localeCompare(b.date))
                  .map((h, i) => (
                    <m.li
                      key={h.id}
                      initial={{ opacity: 0, x: -4 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.25, delay: 0.02 + i * 0.025, ease: EASE_OUT }}
                      className="flex items-center justify-between gap-3 px-1 py-3"
                    >
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg" style={{ background: 'var(--mt-accent-soft)' }}>
                        <CalendarOff className="h-3.5 w-3.5" strokeWidth={2.25} style={{ color: 'var(--mt-accent)' }} aria-hidden />
                      </span>
                      <div className="min-w-0 flex-1">
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
              disabled={!offlineAutoReply}
            />
            <p className="mt-2 text-right text-[11px] tabular-nums text-zinc-400">{offlineMsg.length}/1024</p>
          </Section>

          <div className="flex items-center gap-3">
            <WaButton type="submit" leftIcon={isPending ? Loader2 : Save} disabled={isPending}>
              {isPending ? 'Saving...' : 'Save business hours'}
            </WaButton>
          </div>
        </div>

        {/* Right column: preview + at-a-glance week */}
        <div className="flex flex-col gap-4 lg:sticky lg:top-6 lg:self-start">
          <Section title="Week at a glance" description="Open vs closed per day.">
            <div className="grid grid-cols-7 gap-1">
              {DAYS.map((d, i) => {
                const s = schedule[d];
                return (
                  <div key={d} className="flex flex-col items-center gap-1">
                    <span className="text-[10px] uppercase tracking-[0.06em] text-zinc-400">{DAYS_SHORT[i]}</span>
                    <div
                      className={`grid h-12 w-full place-items-center rounded-lg text-[10px] font-semibold ${
                        s.open ? 'text-white' : 'bg-zinc-100 text-zinc-400'
                      }`}
                      style={
                        s.open
                          ? {
                              backgroundImage:
                                'linear-gradient(180deg, #25D366, color-mix(in oklch, #25D366 60%, white))',
                            }
                          : undefined
                      }
                      title={s.open ? `${s.start} to ${s.end}` : 'Closed'}
                    >
                      {s.open ? (
                        <Sun className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden />
                      ) : (
                        <MoonStar className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden />
                      )}
                    </div>
                    <span className="text-[9.5px] tabular-nums text-zinc-500">
                      {s.open ? s.start.slice(0, 5) : 'off'}
                    </span>
                  </div>
                );
              })}
            </div>
          </Section>

          <PhoneFrame title={activeProject?.name ?? 'Your business'} subtitle="Offline preview">
            <ChatBubble who="them" text="Hi, are you open right now?" time="22:14" />
            <AnimatePresence initial={false}>
              {offlineAutoReply && offlineMsg.trim() && (
                <m.div key="offline" layout>
                  <ChatBubble who="us" text={offlineMsg} time="22:14" />
                </m.div>
              )}
            </AnimatePresence>
          </PhoneFrame>
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
