'use client';

import { fmtDate } from '@/lib/utils';
import React, { useEffect, useMemo, useState, useTransition, useCallback, useActionState } from 'react';
import { m, useReducedMotion } from 'motion/react';
import { Line, LineChart, ResponsiveContainer } from 'recharts';
import {
  CalendarClock,
  Loader2,
  Send,
  Users,
  ListChecks,
  CalendarDays,
  Check,
  Clock,
  Pause,
  Repeat,
} from 'lucide-react';

import { useProject } from '@/context/project-context';
import {
  getScheduledBroadcasts,
  scheduleBroadcast,
  cancelScheduledBroadcast,
} from '@/app/actions/wachat-features.actions';

import {
  useZoruToast,
  ZoruAlertDialog,
  ZoruAlertDialogAction,
  ZoruAlertDialogCancel,
  ZoruAlertDialogContent,
  ZoruAlertDialogDescription,
  ZoruAlertDialogFooter,
  ZoruAlertDialogHeader,
  ZoruAlertDialogTitle,
  ZoruAlertDialogTrigger,
  Input,
  Label,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
} from '@/components/zoruui';

import {
  WaPage,
  PageHeader,
  Section,
  WaButton,
  EmptyState,
  StatusPill,
  MetricTile,
  type StatusTone,
} from '@/components/wachat-ui';
import { EASE_OUT } from '@/components/dashboard-ui/module-theme';

function compact(n: number | null | undefined): string {
  const v = typeof n === 'number' && Number.isFinite(n) ? n : 0;
  if (v >= 1_000) return (v / 1_000).toFixed(1).replace(/\.0$/, '') + 'k';
  return String(v);
}

/**
 * Wachat broadcast scheduler. Same actions; wachat-ui chrome.
 */

const TIMEZONES = ['UTC', 'Asia/Kolkata', 'America/New_York', 'Europe/London'];

const STEPS = [
  { value: 'template', label: 'Template', Icon: Send },
  { value: 'audience', label: 'Audience', Icon: Users },
  { value: 'schedule', label: 'Schedule', Icon: CalendarDays },
  { value: 'review', label: 'Review', Icon: ListChecks },
] as const;

type StepValue = (typeof STEPS)[number]['value'];

function tone(s: string): StatusTone {
  if (s === 'scheduled') return 'queued';
  if (s === 'cancelled') return 'failed';
  if (s === 'sent' || s === 'completed') return 'sent';
  return 'draft';
}

function CancelScheduleDialog({
  schedule,
  onConfirm,
  disabled,
}: {
  schedule: any;
  onConfirm: (id: string) => void;
  disabled?: boolean;
}) {
  return (
    <ZoruAlertDialog>
      <ZoruAlertDialogTrigger asChild>
        <WaButton variant="ghost" size="sm" disabled={disabled}>
          Cancel
        </WaButton>
      </ZoruAlertDialogTrigger>
      <ZoruAlertDialogContent>
        <ZoruAlertDialogHeader>
          <ZoruAlertDialogTitle>Cancel scheduled broadcast?</ZoruAlertDialogTitle>
          <ZoruAlertDialogDescription>
            &ldquo;{schedule.name}&rdquo; will not be sent at{' '}
            {schedule.scheduledAt ? fmtDate(schedule.scheduledAt) : 'its scheduled time'}. This action cannot be undone.
          </ZoruAlertDialogDescription>
        </ZoruAlertDialogHeader>
        <ZoruAlertDialogFooter>
          <ZoruAlertDialogCancel>Keep schedule</ZoruAlertDialogCancel>
          <ZoruAlertDialogAction onClick={() => onConfirm(schedule._id)}>Cancel schedule</ZoruAlertDialogAction>
        </ZoruAlertDialogFooter>
      </ZoruAlertDialogContent>
    </ZoruAlertDialog>
  );
}

export default function BroadcastSchedulerPage() {
  const { activeProject } = useProject();
  const { toast } = useZoruToast();
  const projectId = activeProject?._id?.toString();
  const reduce = useReducedMotion();

  const [schedules, setSchedules] = useState<any[]>([]);
  const [isLoading, startLoading] = useTransition();
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const [step, setStep] = useState<StepValue>('template');
  const [name, setName] = useState('');
  const [templateName, setTemplateName] = useState('');
  const [audience, setAudience] = useState('');
  const [timezone, setTimezone] = useState(TIMEZONES[0]);
  const [scheduledAt, setScheduledAt] = useState('');
  const [recurring, setRecurring] = useState('none');

  const [formState, formAction, isPending] = useActionState(scheduleBroadcast, null);

  const fetchSchedules = useCallback(
    (pid: string) => {
      startLoading(async () => {
        const res = await getScheduledBroadcasts(pid);
        if (res.error) toast({ title: 'Error', description: res.error, variant: 'destructive' });
        else setSchedules(res.schedules || []);
      });
    },
    [toast],
  );

  useEffect(() => {
    if (projectId) fetchSchedules(projectId);
  }, [projectId, fetchSchedules]);

  useEffect(() => {
    if (formState?.message) {
      toast({ title: 'Scheduled', description: formState.message });
      if (projectId) fetchSchedules(projectId);
      setName('');
      setTemplateName('');
      setAudience('');
      setScheduledAt('');
      setStep('template');
    }
    if (formState?.error) toast({ title: 'Error', description: formState.error, variant: 'destructive' });
  }, [formState, toast, projectId, fetchSchedules]);

  const handleCancel = async (id: string) => {
    setCancellingId(id);
    const res = await cancelScheduledBroadcast(id);
    setCancellingId(null);
    if (res.error) toast({ title: 'Error', description: res.error, variant: 'destructive' });
    else {
      setSchedules((prev) => prev.map((s) => (s._id === id ? { ...s, status: 'cancelled' } : s)));
      toast({ title: 'Cancelled', description: 'Broadcast schedule cancelled.' });
    }
  };

  const goNext = () => {
    const idx = STEPS.findIndex((s) => s.value === step);
    if (idx < STEPS.length - 1) setStep(STEPS[idx + 1].value);
  };
  const goBack = () => {
    const idx = STEPS.findIndex((s) => s.value === step);
    if (idx > 0) setStep(STEPS[idx - 1].value);
  };

  const isLastStep = step === 'review';
  const stepIndex = STEPS.findIndex((s) => s.value === step);

  const kpis = useMemo(() => {
    let scheduled = 0;
    let sentToday = 0;
    let queued = 0;
    let paused = 0;
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    for (const s of schedules) {
      const st = (s.status || '').toLowerCase();
      if (st === 'scheduled') scheduled++;
      if (st === 'completed' || st === 'sent') {
        const d = s.completedAt || s.sentAt;
        if (d && new Date(d) >= todayStart) sentToday++;
      }
      if (st === 'queued' || st === 'processing') queued++;
      if (st === 'cancelled' || st === 'paused') paused++;
    }
    return { scheduled, sentToday, queued, paused };
  }, [schedules]);

  return (
    <WaPage>
      <PageHeader
        title="Broadcast scheduler"
        description="Queue broadcasts for future delivery with one-time or recurring schedules."
        kicker="Wachat / scheduler"
        eyebrowIcon={CalendarClock}
        backHref="/wachat"
      />

      {/* 4-tile KPI strip */}
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MetricTile label="Scheduled" value={compact(kpis.scheduled)} icon={CalendarClock} delay={0} />
        <MetricTile label="Sent today" value={compact(kpis.sentToday)} icon={Send} delay={0.05} />
        <MetricTile label="Queued" value={compact(kpis.queued)} icon={Clock} delay={0.1} />
        <MetricTile label="Paused / cancelled" value={compact(kpis.paused)} icon={Pause} delay={0.15} />
      </div>

      <Section title="New schedule" description="Step through template, audience, timing, then save.">
        <form action={formAction} className="flex flex-col gap-5">
          <input type="hidden" name="projectId" value={projectId || ''} />
          <input type="hidden" name="name" value={name} />
          <input type="hidden" name="templateName" value={templateName} />
          <input type="hidden" name="audience" value={audience} />
          <input type="hidden" name="timezone" value={timezone} />
          <input type="hidden" name="scheduledAt" value={scheduledAt} />
          <input type="hidden" name="recurring" value={recurring} />

          {/* Stepper */}
          <ol className="flex flex-wrap items-center gap-2">
            {STEPS.map((s, idx) => {
              const isActive = s.value === step;
              const isComplete = idx < stepIndex;
              const Icon = s.Icon;
              return (
                <li key={s.value} className="flex items-center gap-2">
                  <div
                    className={`flex h-8 items-center gap-1.5 rounded-full px-3 text-[11.5px] font-semibold transition-colors ${
                      isActive
                        ? 'text-white'
                        : isComplete
                          ? 'border border-zinc-200 bg-zinc-50 text-zinc-700'
                          : 'border border-zinc-200 bg-white text-zinc-500'
                    }`}
                    style={isActive ? { background: 'var(--mt-accent)' } : undefined}
                  >
                    {isComplete && (
                      <span className="inline-flex h-4 w-4 items-center justify-center rounded-full text-[10px]">
                        <Check className="h-3 w-3" strokeWidth={2.5} />
                      </span>
                    )}
                    <Icon className="h-3 w-3" strokeWidth={2.25} aria-hidden />
                    {s.label}
                  </div>
                  {idx < STEPS.length - 1 && (
                    <span className={`h-px w-6 ${isComplete ? 'bg-zinc-900' : 'bg-zinc-200'}`} aria-hidden />
                  )}
                </li>
              );
            })}
          </ol>

          <m.div
            key={step}
            initial={reduce ? false : { opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, ease: EASE_OUT }}
            className="mt-2"
          >
            {step === 'template' && (
              <div className="grid max-w-xl gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="bs-name">Broadcast name</Label>
                  <Input id="bs-name" placeholder="Spring promo" value={name} onChange={(e) => setName(e.target.value)} required />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="bs-template">Template name</Label>
                  <Input
                    id="bs-template"
                    placeholder="welcome_v3"
                    value={templateName}
                    onChange={(e) => setTemplateName(e.target.value)}
                    required
                  />
                </div>
              </div>
            )}

            {step === 'audience' && (
              <div className="grid max-w-xl gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="bs-audience">Audience (default: all)</Label>
                  <Input
                    id="bs-audience"
                    placeholder="segment-id or empty for all contacts"
                    value={audience}
                    onChange={(e) => setAudience(e.target.value)}
                  />
                </div>
              </div>
            )}

            {step === 'schedule' && (
              <div className="grid max-w-xl gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label>Timezone</Label>
                  <Select value={timezone} onValueChange={setTimezone}>
                    <ZoruSelectTrigger>
                      <ZoruSelectValue placeholder="Timezone" />
                    </ZoruSelectTrigger>
                    <ZoruSelectContent>
                      {TIMEZONES.map((tz) => (
                        <ZoruSelectItem key={tz} value={tz}>
                          {tz}
                        </ZoruSelectItem>
                      ))}
                    </ZoruSelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="bs-when">Scheduled at</Label>
                  <Input
                    id="bs-when"
                    type="datetime-local"
                    value={scheduledAt}
                    onChange={(e) => setScheduledAt(e.target.value)}
                    required
                  />
                </div>
                <div className="flex flex-col gap-1.5 sm:col-span-2">
                  <Label>Recurring</Label>
                  <Select value={recurring} onValueChange={setRecurring}>
                    <ZoruSelectTrigger>
                      <ZoruSelectValue placeholder="Frequency" />
                    </ZoruSelectTrigger>
                    <ZoruSelectContent>
                      <ZoruSelectItem value="none">One-time</ZoruSelectItem>
                      <ZoruSelectItem value="daily">Daily</ZoruSelectItem>
                      <ZoruSelectItem value="weekly">Weekly</ZoruSelectItem>
                      <ZoruSelectItem value="monthly">Monthly</ZoruSelectItem>
                    </ZoruSelectContent>
                  </Select>
                </div>
              </div>
            )}

            {step === 'review' && (
              <div className="grid max-w-xl gap-3 text-[13px] sm:grid-cols-2">
                <ReviewRow label="Name" value={name || '-'} />
                <ReviewRow label="Template" value={templateName || '-'} />
                <ReviewRow label="Audience" value={audience || 'All contacts'} />
                <ReviewRow label="Timezone" value={timezone} />
                <ReviewRow label="Scheduled at" value={scheduledAt ? fmtDate(scheduledAt) : '-'} />
                <ReviewRow label="Recurring" value={recurring} />
              </div>
            )}
          </m.div>

          <div className="flex items-center justify-between gap-2 border-t border-zinc-100 pt-4">
            <WaButton variant="outline" size="sm" onClick={goBack} disabled={step === 'template'} type="button">
              Back
            </WaButton>
            {isLastStep ? (
              <WaButton type="submit" disabled={isPending || !projectId}>
                {isPending ? 'Scheduling' : 'Save schedule'}
              </WaButton>
            ) : (
              <WaButton onClick={goNext} type="button">
                Next
              </WaButton>
            )}
          </div>
        </form>
      </Section>

      <div className="mt-6">
        {isLoading && schedules.length === 0 ? (
          <div className="flex h-20 items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-zinc-400" />
          </div>
        ) : schedules.length > 0 ? (
          <Section title="Upcoming schedules" padded={false}>
            <div className="hidden border-b border-zinc-100 bg-zinc-50/60 px-5 py-2 text-[10px] font-semibold uppercase tracking-[0.06em] text-zinc-500 sm:grid sm:grid-cols-[minmax(160px,1.6fr)_120px_120px_120px_minmax(80px,1fr)_100px_auto]">
              <span>Name</span>
              <span>Template</span>
              <span>Recurring</span>
              <span>Next run</span>
              <span>Last 7 runs</span>
              <span>Status</span>
              <span className="text-right">Action</span>
            </div>
            <ul className="divide-y divide-zinc-100">
              {schedules.map((s, i) => {
                const lastRuns: number[] = Array.isArray(s.lastRuns) ? s.lastRuns.slice(-7) : [];
                const spark = lastRuns.length > 0 ? lastRuns.map((v) => ({ v: Number(v) || 0 })) : [];
                return (
                  <m.li
                    key={s._id}
                    initial={reduce ? false : { opacity: 0, y: 4 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.3, delay: 0.02 + Math.min(i, 20) * 0.03, ease: EASE_OUT }}
                    className="grid h-[36px] grid-cols-[minmax(160px,1.6fr)_120px_120px_120px_minmax(80px,1fr)_100px_auto] items-center gap-3 px-5 text-[12px] transition-colors hover:bg-zinc-50"
                  >
                    <span className="min-w-0 truncate font-medium text-zinc-900">{s.name}</span>
                    <span className="truncate font-mono text-zinc-500">{s.templateName || '-'}</span>
                    <span className="inline-flex items-center gap-1 text-zinc-700">
                      {s.recurring && s.recurring !== 'none' ? (
                        <>
                          <Repeat className="h-2.5 w-2.5 text-zinc-400" strokeWidth={2.5} />
                          {s.recurring}
                        </>
                      ) : (
                        '-'
                      )}
                    </span>
                    <span className="truncate tabular-nums text-zinc-500">
                      {s.scheduledAt ? fmtDate(s.scheduledAt) : '-'}
                    </span>
                    <span className="block h-[20px]">
                      {spark.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={spark} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
                            <Line type="monotone" dataKey="v" stroke="#25D366" strokeWidth={1.5} dot={false} />
                          </LineChart>
                        </ResponsiveContainer>
                      ) : (
                        <span className="text-[10px] text-zinc-400">-</span>
                      )}
                    </span>
                    <StatusPill tone={tone(s.status)}>{s.status}</StatusPill>
                    <div className="text-right">
                      {s.status === 'scheduled' && (
                        <CancelScheduleDialog schedule={s} onConfirm={handleCancel} disabled={cancellingId === s._id} />
                      )}
                    </div>
                  </m.li>
                );
              })}
            </ul>
          </Section>
        ) : (
          <EmptyState
            icon={CalendarClock}
            title="No scheduled broadcasts"
            description="Use the form above to queue a broadcast for the future."
          />
        )}
      </div>
    </WaPage>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-zinc-50/60 p-3">
      <div className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-zinc-500">{label}</div>
      <div className="mt-1 truncate text-[13px] text-zinc-900">{value}</div>
    </div>
  );
}
