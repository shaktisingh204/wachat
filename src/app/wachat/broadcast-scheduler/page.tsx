'use client';

/**
 * Wachat Broadcast Scheduler — schedule broadcasts for future delivery.
 *
 * Multi-step numbered stepper: Template → Audience → Schedule → Review.
 * No tab UI — the stepper is a numbered progress indicator with prev/next
 * buttons. Same data + handlers as before (getScheduledBroadcasts,
 * scheduleBroadcast, cancelScheduledBroadcast).
 */

import * as React from 'react';
import {
  useEffect,
  useState,
  useTransition,
  useCallback,
  useActionState,
} from 'react';
import {
  CalendarClock,
  Loader2,
  Send,
  Users,
  ListChecks,
  CalendarDays,
} from 'lucide-react';

import { useProject } from '@/context/project-context';
import { useZoruToast } from '@/components/zoruui';

import {
  ZoruAlertDialog,
  ZoruAlertDialogAction,
  ZoruAlertDialogCancel,
  ZoruAlertDialogContent,
  ZoruAlertDialogDescription,
  ZoruAlertDialogFooter,
  ZoruAlertDialogHeader,
  ZoruAlertDialogTitle,
  ZoruAlertDialogTrigger,
  ZoruBadge,
  ZoruBreadcrumb,
  ZoruBreadcrumbItem,
  ZoruBreadcrumbLink,
  ZoruBreadcrumbList,
  ZoruBreadcrumbPage,
  ZoruBreadcrumbSeparator,
  ZoruButton,
  ZoruCard,
  ZoruEmptyState,
  ZoruInput,
  ZoruLabel,
  ZoruSelect,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
} from '@/components/zoruui';

import {
  getScheduledBroadcasts,
  scheduleBroadcast,
  cancelScheduledBroadcast,
} from '@/app/actions/wachat-features.actions';

const TIMEZONES = ['UTC', 'Asia/Kolkata', 'America/New_York', 'Europe/London'];

const STEPS = [
  { value: 'template', label: '1. Template', icon: <Send className="h-3.5 w-3.5" /> },
  { value: 'audience', label: '2. Audience', icon: <Users className="h-3.5 w-3.5" /> },
  { value: 'schedule', label: '3. Schedule', icon: <CalendarDays className="h-3.5 w-3.5" /> },
  { value: 'review', label: '4. Review', icon: <ListChecks className="h-3.5 w-3.5" /> },
] as const;

type StepValue = (typeof STEPS)[number]['value'];

/* ── cancel-schedule confirmation ───────────────────────────────── */

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
        <ZoruButton variant="ghost" size="sm" disabled={disabled}>
          Cancel
        </ZoruButton>
      </ZoruAlertDialogTrigger>
      <ZoruAlertDialogContent>
        <ZoruAlertDialogHeader>
          <ZoruAlertDialogTitle>Cancel scheduled broadcast?</ZoruAlertDialogTitle>
          <ZoruAlertDialogDescription>
            &ldquo;{schedule.name}&rdquo; will not be sent at{' '}
            {schedule.scheduledAt
              ? new Date(schedule.scheduledAt).toLocaleString()
              : 'its scheduled time'}
            . This action cannot be undone.
          </ZoruAlertDialogDescription>
        </ZoruAlertDialogHeader>
        <ZoruAlertDialogFooter>
          <ZoruAlertDialogCancel>Keep schedule</ZoruAlertDialogCancel>
          <ZoruAlertDialogAction onClick={() => onConfirm(schedule._id)}>
            Cancel schedule
          </ZoruAlertDialogAction>
        </ZoruAlertDialogFooter>
      </ZoruAlertDialogContent>
    </ZoruAlertDialog>
  );
}

/* ── page ───────────────────────────────────────────────────────── */

export default function BroadcastSchedulerPage() {
  const { activeProject } = useProject();
  const { toast } = useZoruToast();
  const projectId = activeProject?._id?.toString();

  const [schedules, setSchedules] = useState<any[]>([]);
  const [isLoading, startLoading] = useTransition();
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const [step, setStep] = useState<StepValue>('template');

  // Local form state mirrors form fields, used for review preview.
  const [name, setName] = useState('');
  const [templateName, setTemplateName] = useState('');
  const [audience, setAudience] = useState('');
  const [timezone, setTimezone] = useState(TIMEZONES[0]);
  const [scheduledAt, setScheduledAt] = useState('');
  const [recurring, setRecurring] = useState('none');

  const [formState, formAction, isPending] = useActionState(
    scheduleBroadcast,
    null,
  );

  const fetchSchedules = useCallback(
    (pid: string) => {
      startLoading(async () => {
        const res = await getScheduledBroadcasts(pid);
        if (res.error)
          toast({
            title: 'Error',
            description: res.error,
            variant: 'destructive',
          });
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
    if (formState?.error)
      toast({
        title: 'Error',
        description: formState.error,
        variant: 'destructive',
      });
  }, [formState, toast, projectId, fetchSchedules]);

  const handleCancel = async (id: string) => {
    setCancellingId(id);
    const res = await cancelScheduledBroadcast(id);
    setCancellingId(null);
    if (res.error)
      toast({
        title: 'Error',
        description: res.error,
        variant: 'destructive',
      });
    else {
      setSchedules((prev) =>
        prev.map((s) => (s._id === id ? { ...s, status: 'cancelled' } : s)),
      );
      toast({
        title: 'Cancelled',
        description: 'Broadcast schedule cancelled.',
      });
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

  return (
    <div className="mx-auto flex w-full max-w-[1320px] flex-col gap-6 px-6 pt-6 pb-10">
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
            <ZoruBreadcrumbPage>Broadcast Scheduler</ZoruBreadcrumbPage>
          </ZoruBreadcrumbItem>
        </ZoruBreadcrumbList>
      </ZoruBreadcrumb>

      <div>
        <h1 className="text-[30px] tracking-[-0.015em] text-zoru-ink leading-[1.1]">
          Broadcast Scheduler
        </h1>
        <p className="mt-1.5 text-[13px] text-zoru-ink-muted">
          Schedule broadcasts for future delivery.
        </p>
      </div>

      <ZoruCard className="p-6">
        <h2 className="text-[16px] text-zoru-ink mb-4">New Schedule</h2>
        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="projectId" value={projectId || ''} />
          <input type="hidden" name="name" value={name} />
          <input type="hidden" name="templateName" value={templateName} />
          <input type="hidden" name="audience" value={audience} />
          <input type="hidden" name="timezone" value={timezone} />
          <input type="hidden" name="scheduledAt" value={scheduledAt} />
          <input type="hidden" name="recurring" value={recurring} />

          {/* Numbered stepper (no tabs) — visual progress only.
              Step content is swapped below based on `step` state. */}
          <ol className="flex flex-wrap items-center gap-2">
            {STEPS.map((s, idx) => {
              const isActive = s.value === step;
              const stepIndex = STEPS.findIndex((x) => x.value === step);
              const isComplete = idx < stepIndex;
              return (
                <li key={s.value} className="flex items-center gap-2">
                  <div
                    className={`flex h-7 min-w-7 items-center gap-1.5 rounded-full px-2.5 text-xs ${
                      isActive
                        ? 'bg-zoru-ink text-zoru-on-primary'
                        : isComplete
                          ? 'border border-zoru-line bg-zoru-surface text-zoru-ink'
                          : 'border border-zoru-line bg-zoru-bg text-zoru-ink-muted'
                    }`}
                  >
                    <span className="text-[11px]">{idx + 1}</span>
                    {s.label}
                  </div>
                  {idx < STEPS.length - 1 && (
                    <span
                      className={`h-px w-6 ${
                        isComplete ? 'bg-zoru-ink' : 'bg-zoru-line'
                      }`}
                    />
                  )}
                </li>
              );
            })}
          </ol>

          <div className="mt-5">
            {step === 'template' && (
              <div className="flex flex-col gap-4 max-w-xl">
                <div className="flex flex-col gap-1.5">
                  <ZoruLabel htmlFor="bs-name">Broadcast name *</ZoruLabel>
                  <ZoruInput
                    id="bs-name"
                    placeholder="Spring promo"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <ZoruLabel htmlFor="bs-template">Template name *</ZoruLabel>
                  <ZoruInput
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
              <div className="flex flex-col gap-4 max-w-xl">
                <div className="flex flex-col gap-1.5">
                  <ZoruLabel htmlFor="bs-audience">
                    Audience (default: all)
                  </ZoruLabel>
                  <ZoruInput
                    id="bs-audience"
                    placeholder="segment-id or empty for all contacts"
                    value={audience}
                    onChange={(e) => setAudience(e.target.value)}
                  />
                </div>
              </div>
            )}

            {step === 'schedule' && (
              <div className="grid gap-4 max-w-xl sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <ZoruLabel>Timezone</ZoruLabel>
                  <ZoruSelect value={timezone} onValueChange={setTimezone}>
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
                  </ZoruSelect>
                </div>
                <div className="flex flex-col gap-1.5">
                  <ZoruLabel htmlFor="bs-when">Scheduled at *</ZoruLabel>
                  <ZoruInput
                    id="bs-when"
                    type="datetime-local"
                    value={scheduledAt}
                    onChange={(e) => setScheduledAt(e.target.value)}
                    required
                  />
                </div>
                <div className="flex flex-col gap-1.5 sm:col-span-2">
                  <ZoruLabel>Recurring</ZoruLabel>
                  <ZoruSelect value={recurring} onValueChange={setRecurring}>
                    <ZoruSelectTrigger>
                      <ZoruSelectValue placeholder="Frequency" />
                    </ZoruSelectTrigger>
                    <ZoruSelectContent>
                      <ZoruSelectItem value="none">One-time</ZoruSelectItem>
                      <ZoruSelectItem value="daily">Daily</ZoruSelectItem>
                      <ZoruSelectItem value="weekly">Weekly</ZoruSelectItem>
                      <ZoruSelectItem value="monthly">Monthly</ZoruSelectItem>
                    </ZoruSelectContent>
                  </ZoruSelect>
                </div>
              </div>
            )}

            {step === 'review' && (
              <div className="grid grid-cols-2 gap-3 max-w-xl text-[13px]">
                <ReviewRow label="Name" value={name || '—'} />
                <ReviewRow label="Template" value={templateName || '—'} />
                <ReviewRow label="Audience" value={audience || 'All contacts'} />
                <ReviewRow label="Timezone" value={timezone} />
                <ReviewRow
                  label="Scheduled at"
                  value={
                    scheduledAt
                      ? new Date(scheduledAt).toLocaleString()
                      : '—'
                  }
                />
                <ReviewRow label="Recurring" value={recurring} />
              </div>
            )}
          </div>

          <div className="mt-2 flex items-center justify-between gap-2 border-t border-zoru-line pt-4">
            <ZoruButton
              type="button"
              variant="outline"
              size="sm"
              onClick={goBack}
              disabled={step === 'template'}
            >
              Back
            </ZoruButton>
            {isLastStep ? (
              <ZoruButton type="submit" disabled={isPending || !projectId}>
                {isPending ? 'Scheduling…' : 'Save Schedule'}
              </ZoruButton>
            ) : (
              <ZoruButton type="button" onClick={goNext}>
                Next
              </ZoruButton>
            )}
          </div>
        </form>
      </ZoruCard>

      {isLoading && schedules.length === 0 ? (
        <div className="flex h-20 items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-zoru-ink-muted" />
        </div>
      ) : schedules.length > 0 ? (
        <ZoruCard className="overflow-x-auto p-0">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-zoru-line text-[11px] uppercase tracking-wide text-zoru-ink-muted">
                <th className="px-5 py-3">Name</th>
                <th className="px-5 py-3">Template</th>
                <th className="px-5 py-3">Scheduled At</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {schedules.map((s) => (
                <tr
                  key={s._id}
                  className="border-b border-zoru-line last:border-0"
                >
                  <td className="px-5 py-3 text-[13px] text-zoru-ink">
                    {s.name}
                  </td>
                  <td className="px-5 py-3 text-[13px] text-zoru-ink-muted">
                    {s.templateName}
                  </td>
                  <td className="px-5 py-3 text-[13px] text-zoru-ink-muted">
                    {s.scheduledAt
                      ? new Date(s.scheduledAt).toLocaleString()
                      : '--'}
                  </td>
                  <td className="px-5 py-3">
                    <ZoruBadge
                      variant={
                        s.status === 'scheduled'
                          ? 'info'
                          : s.status === 'cancelled'
                            ? 'danger'
                            : 'secondary'
                      }
                    >
                      {s.status}
                    </ZoruBadge>
                  </td>
                  <td className="px-5 py-3 text-right">
                    {s.status === 'scheduled' && (
                      <CancelScheduleDialog
                        schedule={s}
                        onConfirm={handleCancel}
                        disabled={cancellingId === s._id}
                      />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ZoruCard>
      ) : (
        <ZoruEmptyState
          icon={<CalendarClock />}
          title="No scheduled broadcasts"
          description="Use the form above to queue a broadcast for the future."
        />
      )}
      <div className="h-6" />
    </div>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-bg p-3">
      <div className="text-[11px] uppercase tracking-wide text-zoru-ink-muted">
        {label}
      </div>
      <div className="mt-1 text-zoru-ink truncate">{value}</div>
    </div>
  );
}
