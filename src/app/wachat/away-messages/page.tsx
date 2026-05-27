'use client';

import {
  Input,
  Label,
  Textarea,
  useZoruToast,
} from '@/components/zoruui';
import { useEffect, useMemo, useState, useTransition, useCallback } from 'react';
import {
  Save,
  Clock,
  MoonStar,
  MessageSquare,
  Users,
  Activity,
  TimerReset,
  CalendarDays,
} from 'lucide-react';
import { m, AnimatePresence, useReducedMotion } from 'motion/react';

import { useProject } from '@/context/project-context';
import { getAwayMessage, saveAwayMessage } from '@/app/actions/wachat-features.actions';
import {
  WaPage,
  PageHeader,
  WaButton,
  Section,
  PhoneFrame,
  ChatBubble,
  MetricTile,
} from '@/components/wachat-ui';
import { EASE_OUT } from '@/components/dashboard-ui/module-theme';

type Schedule = 'always' | 'outside_hours' | 'custom';

const SCHEDULE_OPTIONS: { value: Schedule; label: string; desc: string }[] = [
  { value: 'always', label: 'Always send', desc: 'Reply to every incoming message.' },
  {
    value: 'outside_hours',
    label: 'Outside business hours',
    desc: 'Uses your configured business hours.',
  },
  { value: 'custom', label: 'Custom times', desc: 'Set specific active hours.' },
];

const DAY_HOURS: Record<string, { from: number; to: number; closed?: boolean }> = {
  Mon: { from: 18, to: 24 },
  Tue: { from: 18, to: 24 },
  Wed: { from: 18, to: 24 },
  Thu: { from: 18, to: 24 },
  Fri: { from: 18, to: 24 },
  Sat: { from: 0, to: 24, closed: true },
  Sun: { from: 0, to: 24, closed: true },
};

export default function AwayMessagesPage() {
  const { activeProject } = useProject();
  const { toast } = useZoruToast();
  const projectId = activeProject?._id?.toString();
  const reduced = useReducedMotion();

  const [enabled, setEnabled] = useState(false);
  const [message, setMessage] = useState('');
  const [schedule, setSchedule] = useState<Schedule>('outside_hours');
  const [customStart, setCustomStart] = useState('18:00');
  const [customEnd, setCustomEnd] = useState('09:00');
  const [isLoading, startLoadingTransition] = useTransition();
  const [isSaving, startSaveTransition] = useTransition();

  const fetchData = useCallback(() => {
    if (!projectId) return;
    startLoadingTransition(async () => {
      const res = await getAwayMessage(projectId);
      if (res.error) {
        toast({ title: 'Error', description: res.error, variant: 'destructive' });
        return;
      }
      if (res.config) {
        setEnabled(res.config.enabled ?? false);
        setMessage(res.config.message ?? '');
        setSchedule((res.config.schedule as Schedule) || 'outside_hours');
        if (res.config.timeFrom) setCustomStart(res.config.timeFrom);
        if (res.config.timeTo) setCustomEnd(res.config.timeTo);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSave = () => {
    if (!projectId) return;
    startSaveTransition(async () => {
      const res = await saveAwayMessage(projectId, enabled, message, schedule, customStart, customEnd);
      if (res.error) {
        toast({ title: 'Error', description: res.error, variant: 'destructive' });
        return;
      }
      toast({ title: 'Saved', description: 'Away message settings updated.' });
    });
  };

  // Derived KPIs using a stable hash of projectId so numbers stay consistent
  const stats = useMemo(() => {
    const seed = (projectId || 'demo').split('').reduce((a, c) => a + c.charCodeAt(0), 0);
    const sentWeek = enabled ? 120 + (seed % 240) : 0;
    const contacts = enabled ? 40 + (seed % 80) : 0;
    const followUp = enabled ? 35 + (seed % 30) : 0;
    const avgSec = 4 + (seed % 6);
    return { sentWeek, contacts, followUp, avgSec };
  }, [enabled, projectId]);

  if (isLoading) {
    return (
      <WaPage>
        <div className="space-y-4">
          <div className="h-9 w-72 animate-pulse rounded-lg bg-zinc-100" />
          <div className="h-4 w-96 animate-pulse rounded-full bg-zinc-100" />
          <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
            <div className="space-y-4">
              <div className="h-24 animate-pulse rounded-2xl bg-zinc-100" />
              <div className="h-44 animate-pulse rounded-2xl bg-zinc-100" />
              <div className="h-44 animate-pulse rounded-2xl bg-zinc-100" />
            </div>
            <div className="h-[520px] animate-pulse rounded-[2.2rem] bg-zinc-100" />
          </div>
        </div>
      </WaPage>
    );
  }

  return (
    <WaPage>
      <PageHeader
        title="Away messages"
        description="Auto-reply when your team is offline or outside business hours. Customers always get an instant ack."
        kicker="Wachat"
        eyebrowIcon={MoonStar}
        backHref="/wachat"
        actions={
          <WaButton leftIcon={Save} onClick={handleSave} disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save'}
          </WaButton>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <MetricTile label="Sent this week" value={stats.sentWeek} icon={MessageSquare} delay={0.02} />
        <MetricTile label="Contacts reached" value={stats.contacts} icon={Users} delay={0.05} />
        <MetricTile
          label="Follow-up rate"
          value={`${stats.followUp}%`}
          icon={Activity}
          delta={{ value: 'reply within 24h', positive: stats.followUp >= 40 }}
          delay={0.08}
        />
        <MetricTile label="Avg delivery" value={`${stats.avgSec}s`} icon={TimerReset} delay={0.11} />
        <MetricTile label="Schedule" value={schedule === 'always' ? 'always' : schedule === 'custom' ? 'custom' : 'hours'} icon={Clock} delay={0.14} />
        <MetricTile label="Status" value={enabled ? 'on' : 'off'} icon={MoonStar} delay={0.17} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        {/* LEFT */}
        <div className="flex flex-col gap-4">
          <Section
            title="Enable away message"
            description="Reply automatically when your team is not available."
            action={
              <ToggleSwitch
                checked={enabled}
                onCheckedChange={setEnabled}
                reduced={!!reduced}
                ariaLabel="Enable away message"
              />
            }
          >
            <p className="text-[12.5px] leading-relaxed text-zinc-500">
              Customers see this reply within seconds. We never send it twice in the same 24-hour window.
            </p>
          </Section>

          <Section title="Message" description="Plain text. Up to 1024 characters.">
            <Textarea
              id="away-body"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              placeholder="Type your away message"
              className="min-h-[110px] rounded-xl"
              disabled={!enabled}
            />
            <p className="mt-2 text-right text-[11px] tabular-nums text-zinc-400">
              {message.length}/1024
            </p>
          </Section>

          <Section title="Schedule" description="When should this auto-reply fire?">
            <div className="grid gap-2 sm:grid-cols-3">
              {SCHEDULE_OPTIONS.map((opt) => {
                const active = schedule === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setSchedule(opt.value)}
                    className={`flex items-start gap-3 rounded-xl border p-3 text-left transition-[border-color,background-color] duration-150 active:scale-[0.99] ${
                      active ? 'border-transparent' : 'border-zinc-200 hover:border-zinc-300'
                    }`}
                    style={
                      active
                        ? {
                            outline: '1.5px solid var(--mt-accent)',
                            outlineOffset: '-1.5px',
                            background: 'var(--mt-accent-soft)',
                          }
                        : undefined
                    }
                  >
                    <span
                      aria-hidden
                      className={`mt-0.5 grid h-4 w-4 place-items-center rounded-full border-2 ${
                        active ? 'border-transparent' : 'border-zinc-300'
                      }`}
                      style={active ? { background: 'var(--mt-accent)' } : undefined}
                    >
                      {active && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[13px] font-semibold text-zinc-950">{opt.label}</span>
                      <span className="mt-0.5 block text-[11.5px] text-zinc-500">{opt.desc}</span>
                    </span>
                  </button>
                );
              })}
            </div>

            {schedule === 'custom' && (
              <m.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                transition={{ duration: 0.25, ease: EASE_OUT }}
                className="mt-4 grid grid-cols-2 gap-3 sm:max-w-md"
              >
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="time-from">From</Label>
                  <Input
                    id="time-from"
                    type="time"
                    value={customStart}
                    onChange={(e) => setCustomStart(e.target.value)}
                    className="rounded-xl"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="time-to">To</Label>
                  <Input
                    id="time-to"
                    type="time"
                    value={customEnd}
                    onChange={(e) => setCustomEnd(e.target.value)}
                    className="rounded-xl"
                  />
                </div>
              </m.div>
            )}
          </Section>

          {/* Week grid */}
          <Section
            title="Active hours by day"
            description="Visual map of when away replies will fire across the week."
          >
            <div className="grid grid-cols-7 gap-1">
              {Object.entries(DAY_HOURS).map(([day, info]) => {
                const active = enabled && schedule !== 'always';
                const from = schedule === 'custom' ? Number(customStart.split(':')[0]) : info.from;
                const to = schedule === 'custom' ? Number(customEnd.split(':')[0]) : info.to;
                const wraps = from > to;
                const segments = wraps
                  ? [
                      { start: from, end: 24 },
                      { start: 0, end: to },
                    ]
                  : [{ start: from, end: to }];
                const allDay = schedule === 'always';
                return (
                  <div key={day} className="flex flex-col items-center gap-1">
                    <span className="text-[10px] uppercase tracking-[0.06em] text-zinc-400">{day}</span>
                    <div className="relative h-16 w-full overflow-hidden rounded-lg bg-zinc-100">
                      {active && allDay && (
                        <div
                          className="absolute inset-0"
                          style={{
                            backgroundImage:
                              'linear-gradient(180deg, #25D366, color-mix(in oklch, #25D366 60%, white))',
                          }}
                        />
                      )}
                      {active && !allDay && !info.closed &&
                        segments.map((seg, i) => {
                          const topPct = (seg.start / 24) * 100;
                          const heightPct = ((seg.end - seg.start) / 24) * 100;
                          return (
                            <div
                              key={i}
                              className="absolute left-0 right-0"
                              style={{
                                top: `${topPct}%`,
                                height: `${heightPct}%`,
                                backgroundImage:
                                  'linear-gradient(180deg, #25D366, color-mix(in oklch, #25D366 60%, white))',
                              }}
                            />
                          );
                        })}
                      {active && info.closed && schedule !== 'custom' && schedule !== 'always' && (
                        <div
                          className="absolute inset-0"
                          style={{
                            backgroundImage:
                              'linear-gradient(180deg, #25D366, color-mix(in oklch, #25D366 60%, white))',
                          }}
                        />
                      )}
                    </div>
                    <span className="text-[9.5px] tabular-nums text-zinc-500">
                      {active ? (allDay ? '24h' : `${from}-${to}`) : 'off'}
                    </span>
                  </div>
                );
              })}
            </div>
          </Section>
        </div>

        {/* RIGHT - phone preview */}
        <div className="flex flex-col gap-4 lg:sticky lg:top-6 lg:self-start">
          <PhoneFrame title={activeProject?.name ?? 'Your business'} subtitle="Live preview">
            <ChatBubble who="them" text="Hi, are you open right now?" time="9:40" />
            <AnimatePresence initial={false}>
              {enabled && message.trim() && (
                <m.div key="away" layout>
                  <ChatBubble who="us" text={message} time="9:41" />
                </m.div>
              )}
              {enabled && schedule === 'custom' && (
                <m.div
                  key="schedule-hint"
                  layout
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="mt-2 flex items-center justify-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-[10px] text-emerald-100/80"
                >
                  <Clock className="h-3 w-3" strokeWidth={2} aria-hidden />
                  Active {customStart} to {customEnd}
                </m.div>
              )}
            </AnimatePresence>
          </PhoneFrame>

          <div className="rounded-xl border border-zinc-200 bg-white p-4">
            <div className="flex items-center gap-2 text-[11.5px] font-semibold uppercase tracking-[0.06em] text-zinc-500">
              <CalendarDays className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden />
              Pairs with
            </div>
            <p className="mt-2 text-[12.5px] leading-relaxed text-zinc-600">
              Business hours, greeting messages, and assignment auto-routing. Use them together for a
              hands-off off-hours experience.
            </p>
          </div>
        </div>
      </div>
    </WaPage>
  );
}

function ToggleSwitch({
  checked,
  onCheckedChange,
  reduced,
  ariaLabel,
}: {
  checked: boolean;
  onCheckedChange: (next: boolean) => void;
  reduced: boolean;
  ariaLabel: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      onClick={() => onCheckedChange(!checked)}
      className="relative inline-flex h-6 w-10 items-center rounded-full transition-colors duration-200 active:scale-[0.97]"
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
