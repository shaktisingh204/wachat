'use client';
import { fmtDate } from "@/lib/utils";

import {
  useToast,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  Select,
  Spinner,
  Table,
  THead,
  TBody,
  Tr,
  Th,
  Td,
} from '@/components/sabcrm/20ui';
import {
  useEffect,
  useState,
  useTransition,
  useCallback,
  useActionState,
  } from 'react';
import {
  CalendarClock,
  Send,
  Users,
  ListChecks,
  CalendarDays,
  } from 'lucide-react';

import { useProject } from '@/context/project-context';

import { WachatPage } from '@/app/wachat/_components/wachat-page';

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
  getScheduledBroadcasts,
  scheduleBroadcast,
  cancelScheduledBroadcast,
} from '@/app/actions/wachat-features.actions';

function cx(...a: Array<string | false | null | undefined>): string {
  return a.filter(Boolean).join(' ');
}

const TIMEZONES = ['UTC', 'Asia/Kolkata', 'America/New_York', 'Europe/London'];

const TIMEZONE_OPTIONS = TIMEZONES.map((tz) => ({ value: tz, label: tz }));

const RECURRING_OPTIONS = [
  { value: 'none', label: 'One-time' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
];

const STEPS = [
  { value: 'template', label: '1. Template', icon: <Send className="h-3.5 w-3.5" aria-hidden="true" /> },
  { value: 'audience', label: '2. Audience', icon: <Users className="h-3.5 w-3.5" aria-hidden="true" /> },
  { value: 'schedule', label: '3. Schedule', icon: <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" /> },
  { value: 'review', label: '4. Review', icon: <ListChecks className="h-3.5 w-3.5" aria-hidden="true" /> },
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
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="sm" disabled={disabled}>
          Cancel
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Cancel scheduled broadcast?</AlertDialogTitle>
          <AlertDialogDescription>
            &ldquo;{schedule.name}&rdquo; will not be sent at{' '}
            {schedule.scheduledAt
              ? fmtDate(schedule.scheduledAt)
              : 'its scheduled time'}
            . This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep schedule</AlertDialogCancel>
          <AlertDialogAction onClick={() => onConfirm(schedule._id)}>
            Cancel schedule
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/* ── page ───────────────────────────────────────────────────────── */

export default function BroadcastSchedulerPage() {
  const { activeProject } = useProject();
  const { toast } = useToast();
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
            tone: 'danger',
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
      toast({ title: 'Scheduled', description: formState.message, tone: 'success' });
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
        tone: 'danger',
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
        tone: 'danger',
      });
    else {
      setSchedules((prev) =>
        prev.map((s) => (s._id === id ? { ...s, status: 'cancelled' } : s)),
      );
      toast({
        title: 'Cancelled',
        description: 'Broadcast schedule cancelled.',
        tone: 'success',
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
    <WachatPage
      breadcrumb={[
        { label: 'SabNode', href: '/dashboard' },
        { label: 'WaChat', href: '/wachat' },
        { label: 'Broadcast Scheduler' },
      ]}
      title="Broadcast Scheduler"
      description="Schedule broadcasts for future delivery."
      width="narrow"
    >
      <div className="flex flex-col gap-6">
        <Card padding="lg">
          <h2 className="text-[16px] mb-4" style={{ color: 'var(--st-text)' }}>
            New Schedule
          </h2>
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
                      className="flex h-7 min-w-7 items-center gap-1.5 rounded-full px-2.5 text-xs"
                      style={
                        isActive
                          ? {
                              background: 'var(--st-accent)',
                              color: 'var(--st-on-accent, #fff)',
                            }
                          : isComplete
                            ? {
                                border: '1px solid var(--st-border)',
                                background: 'var(--st-bg-secondary)',
                                color: 'var(--st-text)',
                              }
                            : {
                                border: '1px solid var(--st-border)',
                                background: 'var(--st-bg)',
                                color: 'var(--st-text-tertiary)',
                              }
                      }
                    >
                      <span className="text-[11px]">{idx + 1}</span>
                      {s.label}
                    </div>
                    {idx < STEPS.length - 1 && (
                      <span
                        className="h-px w-6"
                        style={{
                          background: isComplete
                            ? 'var(--st-accent)'
                            : 'var(--st-border)',
                        }}
                      />
                    )}
                  </li>
                );
              })}
            </ol>

            <div className="mt-5">
              {step === 'template' && (
                <div className="flex flex-col gap-4 max-w-xl">
                  <Field label="Broadcast name" required>
                    <Input
                      id="bs-name"
                      placeholder="Spring promo"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                    />
                  </Field>
                  <Field label="Template name" required>
                    <Input
                      id="bs-template"
                      placeholder="welcome_v3"
                      value={templateName}
                      onChange={(e) => setTemplateName(e.target.value)}
                      required
                    />
                  </Field>
                </div>
              )}

              {step === 'audience' && (
                <div className="flex flex-col gap-4 max-w-xl">
                  <Field label="Audience (default: all)">
                    <Input
                      id="bs-audience"
                      placeholder="segment-id or empty for all contacts"
                      value={audience}
                      onChange={(e) => setAudience(e.target.value)}
                    />
                  </Field>
                </div>
              )}

              {step === 'schedule' && (
                <div className="grid gap-4 max-w-xl sm:grid-cols-2">
                  <Field label="Timezone">
                    <Select
                      value={timezone}
                      onChange={(v) => setTimezone(v ?? TIMEZONES[0])}
                      options={TIMEZONE_OPTIONS}
                      placeholder="Timezone"
                      aria-label="Timezone"
                    />
                  </Field>
                  <Field label="Scheduled at" required>
                    <Input
                      id="bs-when"
                      type="datetime-local"
                      value={scheduledAt}
                      onChange={(e) => setScheduledAt(e.target.value)}
                      required
                    />
                  </Field>
                  <div className="sm:col-span-2">
                    <Field label="Recurring">
                      <Select
                        value={recurring}
                        onChange={(v) => setRecurring(v ?? 'none')}
                        options={RECURRING_OPTIONS}
                        placeholder="Frequency"
                        aria-label="Recurring"
                      />
                    </Field>
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
                        ? fmtDate(scheduledAt)
                        : '—'
                    }
                  />
                  <ReviewRow label="Recurring" value={recurring} />
                </div>
              )}
            </div>

            <div
              className="mt-2 flex items-center justify-between gap-2 pt-4"
              style={{ borderTop: '1px solid var(--st-border)' }}
            >
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={goBack}
                disabled={step === 'template'}
              >
                Back
              </Button>
              {isLastStep ? (
                <Button
                  type="submit"
                  variant="primary"
                  disabled={isPending || !projectId}
                >
                  {isPending ? 'Scheduling…' : 'Save Schedule'}
                </Button>
              ) : (
                <Button type="button" variant="primary" onClick={goNext}>
                  Next
                </Button>
              )}
            </div>
          </form>
        </Card>

        {isLoading && schedules.length === 0 ? (
          <div className="flex h-20 items-center justify-center">
            <Spinner size="md" label="Loading schedules" />
          </div>
        ) : schedules.length > 0 ? (
          <Card padding="none" className="overflow-x-auto">
            <Table>
              <THead>
                <Tr>
                  <Th>Name</Th>
                  <Th>Template</Th>
                  <Th>Scheduled At</Th>
                  <Th>Status</Th>
                  <Th align="right">Action</Th>
                </Tr>
              </THead>
              <TBody>
                {schedules.map((s) => (
                  <Tr key={s._id}>
                    <Td>{s.name}</Td>
                    <Td style={{ color: 'var(--st-text-secondary)' }}>
                      {s.templateName}
                    </Td>
                    <Td style={{ color: 'var(--st-text-secondary)' }}>
                      {s.scheduledAt ? fmtDate(s.scheduledAt) : '--'}
                    </Td>
                    <Td>
                      <Badge
                        tone={
                          s.status === 'scheduled'
                            ? 'info'
                            : s.status === 'cancelled'
                              ? 'danger'
                              : 'neutral'
                        }
                      >
                        {s.status}
                      </Badge>
                    </Td>
                    <Td align="right">
                      {s.status === 'scheduled' && (
                        <CancelScheduleDialog
                          schedule={s}
                          onConfirm={handleCancel}
                          disabled={cancellingId === s._id}
                        />
                      )}
                    </Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
          </Card>
        ) : (
          <EmptyState
            icon={CalendarClock}
            title="No scheduled broadcasts"
            description="Use the form above to queue a broadcast for the future."
          />
        )}
      </div>
    </WachatPage>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="p-3"
      style={{
        borderRadius: 'var(--st-radius)',
        border: '1px solid var(--st-border)',
        background: 'var(--st-bg-secondary)',
      }}
    >
      <div
        className="text-[11px] uppercase tracking-wide"
        style={{ color: 'var(--st-text-tertiary)' }}
      >
        {label}
      </div>
      <div className="mt-1 truncate" style={{ color: 'var(--st-text)' }}>
        {value}
      </div>
    </div>
  );
}
