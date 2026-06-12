'use client';

/**
 * SabCRM — Sequences (cadences) list client (`/sabcrm/sequences`), 20ui.
 *
 * HubSpot/Close-style cadences: ordered email / task / wait steps that
 * enrolled records walk through on the scheduler tick. This client renders:
 *   - the sequence table (status toggle, step summary, active enrollments)
 *   - the builder dialog (vertical step list with add / reorder / remove,
 *     per-kind step editors, optional email-template prefill, settings)
 *   - the per-sequence enrollments sheet (record link, step x/y, status,
 *     next-run relative time, unenroll, status filter)
 *
 * Data flows down from the server page (`page.tsx`); after a mutation the
 * action revalidates `/sabcrm` and the client calls `router.refresh()` so
 * the table re-renders from fresh server props. Enrollments are fetched on
 * demand inside the sheet via `listSabcrmSequenceEnrollments`.
 *
 * ONLY `@/components/sabcrm/20ui` barrel imports (repo rule); auth /
 * onboarding / RBAC are enforced by the SabCRM layout, and every action
 * re-runs the full session → project → RBAC → plan gate.
 */

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowDown,
  ArrowUp,
  CheckSquare,
  Clock,
  ListChecks,
  Mail,
  Pencil,
  Plus,
  Trash2,
  Users,
} from 'lucide-react';

import {
  Alert,
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Badge,
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  EmptyState,
  Field,
  IconButton,
  Input,
  PageActions,
  PageDescription,
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  SelectField,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  Skeleton,
  Switch,
  Table,
  TBody,
  Td,
  Textarea,
  Th,
  THead,
  Tr,
  type BadgeTone,
  type SelectOption,
} from '@/components/sabcrm/20ui';

import {
  createSabcrmSequence,
  deleteSabcrmSequence,
  listSabcrmSequenceEnrollments,
  unenrollSabcrmEnrollment,
  updateSabcrmSequence,
} from '@/app/actions/sabcrm-sequences.actions';
import type {
  SabcrmEnrollmentStatus,
  SabcrmRustEnrollment,
  SabcrmSequenceStatus,
  SabcrmSequenceStep,
  SabcrmSequenceStepKind,
} from '@/lib/rust-client/sabcrm-sequences';

import '@/components/sabcrm/20ui/surface-crm-base.css';

// ---------------------------------------------------------------------------
// Row shapes passed down from the server page
// ---------------------------------------------------------------------------

/** Flat email-template option for the email-step prefill Select. */
export interface SequenceTemplateOption {
  id: string;
  name: string;
  subject: string;
  body: string;
}

/** One sequence, narrowed to what the table + builder need. */
export interface SequenceRow {
  id: string;
  name: string;
  status: SabcrmSequenceStatus;
  steps: SabcrmSequenceStep[];
  unenrollOnReply: boolean;
  /**
   * Active enrollments counted from the first page (≤200) of the project's
   * active enrollments — there is no per-sequence count endpoint yet.
   */
  activeEnrollments: number;
  createdAt: string;
}

export interface SequencesClientProps {
  initialRows: SequenceRow[];
  templates: SequenceTemplateOption[];
  /** Non-null when the list fetch failed (e.g. the Rust engine is down). */
  initialError: string | null;
}

// ---------------------------------------------------------------------------
// Display helpers
// ---------------------------------------------------------------------------

const ENROLLMENT_TONE: Record<SabcrmEnrollmentStatus, BadgeTone> = {
  active: 'accent',
  completed: 'success',
  unenrolled: 'neutral',
  failed: 'danger',
};

const ENROLLMENT_LABEL: Record<SabcrmEnrollmentStatus, string> = {
  active: 'Active',
  completed: 'Completed',
  unenrolled: 'Unenrolled',
  failed: 'Failed',
};

const ENROLLMENT_FILTER_OPTIONS: SelectOption[] = [
  { value: 'all', label: 'All statuses' },
  { value: 'active', label: 'Active' },
  { value: 'completed', label: 'Completed' },
  { value: 'unenrolled', label: 'Unenrolled' },
  { value: 'failed', label: 'Failed' },
];

/** "3 emails · 2 tasks · 12d span" — pluralised, zero-parts dropped. */
function stepSummary(steps: SabcrmSequenceStep[]): string {
  const emails = steps.filter((s) => s.kind === 'email').length;
  const tasks = steps.filter((s) => s.kind === 'task').length;
  const spanDays = steps.reduce(
    (sum, s) => sum + (s.kind === 'wait' ? s.waitDays ?? 0 : 0),
    0,
  );
  const parts: string[] = [];
  if (emails) parts.push(`${emails} ${emails === 1 ? 'email' : 'emails'}`);
  if (tasks) parts.push(`${tasks} ${tasks === 1 ? 'task' : 'tasks'}`);
  if (spanDays) parts.push(`${spanDays}d span`);
  if (parts.length === 0) return 'No steps';
  return parts.join(' · ');
}

/** `2026-06-11T00:00:00Z` → `11 Jun 2026` (deterministic, no TZ drift). */
function formatDate(iso: string): string {
  const day = iso.slice(0, 10);
  const [y, m, d] = day.split('-');
  if (!y || !m || !d) return day || '—';
  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];
  const month = months[Number(m) - 1] ?? m;
  return `${Number(d)} ${month} ${y}`;
}

/** RFC3339 → "in 2d" / "in 3h" / "5m ago" / "now". Client-side only. */
function relativeTime(iso: string): string {
  const ts = Date.parse(iso);
  if (Number.isNaN(ts)) return '—';
  const diffMs = ts - Date.now();
  const abs = Math.abs(diffMs);
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;
  let amount: string;
  if (abs < minute) return 'now';
  if (abs < hour) amount = `${Math.round(abs / minute)}m`;
  else if (abs < day) amount = `${Math.round(abs / hour)}h`;
  else amount = `${Math.round(abs / day)}d`;
  return diffMs > 0 ? `in ${amount}` : `${amount} ago`;
}

// ---------------------------------------------------------------------------
// Builder state
// ---------------------------------------------------------------------------

interface StepState {
  /** Local list key, NOT the wire id. */
  uid: number;
  /** Existing wire step id (kept stable on edit); null for new steps. */
  wireId: string | null;
  kind: SabcrmSequenceStepKind;
  // email
  templateId: string;
  subject: string;
  body: string;
  // task
  taskTitle: string;
  dueInDays: string;
  // wait
  waitDays: string;
}

interface BuilderState {
  id?: string;
  name: string;
  status: SabcrmSequenceStatus;
  unenrollOnReply: boolean;
  steps: StepState[];
}

let nextUid = 1;

function emptyStep(kind: SabcrmSequenceStepKind): StepState {
  return {
    uid: nextUid++,
    wireId: null,
    kind,
    templateId: '',
    subject: '',
    body: '',
    taskTitle: '',
    dueInDays: '',
    waitDays: kind === 'wait' ? '1' : '',
  };
}

function emptyBuilder(): BuilderState {
  return {
    name: '',
    status: 'active',
    unenrollOnReply: true,
    steps: [emptyStep('email')],
  };
}

/** Hydrates the builder from a wire sequence (the edit path). */
function builderFromRow(row: SequenceRow): BuilderState {
  return {
    id: row.id,
    name: row.name,
    status: row.status,
    unenrollOnReply: row.unenrollOnReply,
    steps: row.steps.map((s) => ({
      uid: nextUid++,
      wireId: s.id,
      kind: s.kind,
      templateId: s.email?.templateId ?? '',
      subject: s.email?.subject ?? '',
      body: s.email?.body ?? '',
      taskTitle: s.task?.title ?? '',
      dueInDays: s.task?.dueInDays != null ? String(s.task.dueInDays) : '',
      waitDays: s.waitDays != null ? String(s.waitDays) : '',
    })),
  };
}

/** Stable-enough wire id for a freshly added step. */
function newStepId(uid: number): string {
  return `step-${Date.now().toString(36)}-${uid}`;
}

const STEP_KIND_META: Record<
  SabcrmSequenceStepKind,
  { label: string; icon: typeof Mail }
> = {
  email: { label: 'Email', icon: Mail },
  task: { label: 'Task', icon: CheckSquare },
  wait: { label: 'Wait', icon: Clock },
};

// ---------------------------------------------------------------------------
// Builder dialog
// ---------------------------------------------------------------------------

interface SequenceBuilderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pre-populated when editing; null for "New sequence". */
  initial: BuilderState | null;
  templates: SequenceTemplateOption[];
  onSaved: () => void;
}

function SequenceBuilderDialog({
  open,
  onOpenChange,
  initial,
  templates,
  onSaved,
}: SequenceBuilderDialogProps): React.JSX.Element {
  const [state, setState] = React.useState<BuilderState>(emptyBuilder);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  React.useEffect(() => {
    if (open) {
      setState(initial ?? emptyBuilder());
      setError(null);
    }
  }, [open, initial]);

  const templateOptions: SelectOption[] = React.useMemo(
    () => templates.map((t) => ({ value: t.id, label: t.name })),
    [templates],
  );

  const patchStep = (uid: number, p: Partial<StepState>): void =>
    setState((s) => ({
      ...s,
      steps: s.steps.map((st) => (st.uid === uid ? { ...st, ...p } : st)),
    }));

  const moveStep = (uid: number, dir: -1 | 1): void =>
    setState((s) => {
      const idx = s.steps.findIndex((st) => st.uid === uid);
      const to = idx + dir;
      if (idx < 0 || to < 0 || to >= s.steps.length) return s;
      const steps = [...s.steps];
      const [row] = steps.splice(idx, 1);
      steps.splice(to, 0, row);
      return { ...s, steps };
    });

  const removeStep = (uid: number): void =>
    setState((s) => ({ ...s, steps: s.steps.filter((st) => st.uid !== uid) }));

  const addStep = (kind: SabcrmSequenceStepKind): void =>
    setState((s) => ({ ...s, steps: [...s.steps, emptyStep(kind)] }));

  /** Picking a template prefills subject/body (still editable afterwards). */
  const applyTemplate = (uid: number, templateId: string | null): void => {
    const t = templates.find((tpl) => tpl.id === templateId);
    patchStep(uid, {
      templateId: templateId ?? '',
      ...(t ? { subject: t.subject, body: t.body } : {}),
    });
  };

  const handleSubmit = (): void => {
    if (!state.name.trim()) {
      setError('A sequence name is required.');
      return;
    }
    if (state.steps.length === 0) {
      setError('Add at least one step.');
      return;
    }
    for (const [i, s] of state.steps.entries()) {
      const n = i + 1;
      if (s.kind === 'email' && !s.templateId && !s.body.trim()) {
        setError(`Step ${n} (email) needs a template or a body.`);
        return;
      }
      if (s.kind === 'task' && !s.taskTitle.trim()) {
        setError(`Step ${n} (task) needs a title.`);
        return;
      }
      if (s.kind === 'wait') {
        const days = Number(s.waitDays);
        if (!Number.isFinite(days) || days <= 0) {
          setError(`Step ${n} (wait) needs a positive number of days.`);
          return;
        }
      }
    }
    setError(null);

    const steps: SabcrmSequenceStep[] = state.steps.map((s) => {
      const base: SabcrmSequenceStep = {
        id: s.wireId ?? newStepId(s.uid),
        kind: s.kind,
      };
      if (s.kind === 'email') {
        base.email = {
          templateId: s.templateId || undefined,
          subject: s.subject.trim() || undefined,
          body: s.body.trim() || undefined,
        };
      } else if (s.kind === 'task') {
        const due = Number(s.dueInDays);
        base.task = {
          title: s.taskTitle.trim(),
          dueInDays:
            s.dueInDays.trim() !== '' && Number.isFinite(due) && due >= 0
              ? due
              : undefined,
        };
      } else {
        base.waitDays = Number(s.waitDays);
      }
      return base;
    });

    const editingId = state.id;
    startTransition(async () => {
      const res = editingId
        ? await updateSabcrmSequence(editingId, {
            name: state.name.trim(),
            steps,
            settings: { unenrollOnReply: state.unenrollOnReply },
          })
        : await createSabcrmSequence({
            name: state.name.trim(),
            steps,
            settings: { unenrollOnReply: state.unenrollOnReply },
            status: state.status,
          });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      onOpenChange(false);
      onSaved();
    });
  };

  const editing = !!state.id;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        aria-describedby="sequence-builder-desc"
        className="max-h-[85vh] w-full max-w-2xl overflow-y-auto"
      >
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit sequence' : 'New sequence'}</DialogTitle>
          <DialogDescription id="sequence-builder-desc">
            {editing
              ? 'Update the cadence. Active enrollments keep walking the updated steps.'
              : 'Define an ordered cadence of emails, tasks and waits. Enroll records from their detail page or in bulk.'}
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSubmit();
          }}
        >
          <div className="flex flex-col gap-3 pb-2 pt-1">
            <Field label="Sequence name" required>
              <Input
                value={state.name}
                onChange={(e) =>
                  setState((s) => ({ ...s, name: e.target.value }))
                }
                placeholder="New-lead outreach"
                autoFocus
                disabled={pending}
              />
            </Field>

            <div className="mt-2 flex items-center justify-between">
              <p className="text-sm font-medium">Steps</p>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  iconLeft={Mail}
                  onClick={() => addStep('email')}
                  disabled={pending}
                >
                  Email
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  iconLeft={CheckSquare}
                  onClick={() => addStep('task')}
                  disabled={pending}
                >
                  Task
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  iconLeft={Clock}
                  onClick={() => addStep('wait')}
                  disabled={pending}
                >
                  Wait
                </Button>
              </div>
            </div>

            {state.steps.length === 0 ? (
              <p className="text-sm text-[var(--st-text-secondary)]">
                No steps yet — add an email, task or wait above.
              </p>
            ) : null}

            <div className="flex flex-col gap-3">
              {state.steps.map((s, idx) => {
                const meta = STEP_KIND_META[s.kind];
                return (
                  <div
                    key={s.uid}
                    className="rounded-md border border-[var(--st-border)] p-3"
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <Badge tone="neutral">
                        Step {idx + 1} · {meta.label}
                      </Badge>
                      <div className="flex items-center gap-1">
                        <IconButton
                          icon={ArrowUp}
                          label={`Move step ${idx + 1} up`}
                          size="sm"
                          onClick={() => moveStep(s.uid, -1)}
                          disabled={pending || idx === 0}
                        />
                        <IconButton
                          icon={ArrowDown}
                          label={`Move step ${idx + 1} down`}
                          size="sm"
                          onClick={() => moveStep(s.uid, 1)}
                          disabled={pending || idx === state.steps.length - 1}
                        />
                        <IconButton
                          icon={Trash2}
                          label={`Remove step ${idx + 1}`}
                          size="sm"
                          onClick={() => removeStep(s.uid)}
                          disabled={pending}
                        />
                      </div>
                    </div>

                    {s.kind === 'email' ? (
                      <div className="flex flex-col gap-2">
                        {templates.length > 0 ? (
                          <Field
                            label="Template"
                            help="Optional — picking one prefills the subject and body"
                          >
                            <SelectField
                              value={s.templateId || null}
                              onChange={(v) => applyTemplate(s.uid, v)}
                              options={templateOptions}
                              placeholder="No template"
                              clearable
                              searchable
                              disabled={pending}
                            />
                          </Field>
                        ) : null}
                        <Field label="Subject">
                          <Input
                            value={s.subject}
                            onChange={(e) =>
                              patchStep(s.uid, { subject: e.target.value })
                            }
                            placeholder="Quick question, {{name}}"
                            disabled={pending}
                          />
                        </Field>
                        <Field label="Body">
                          <Textarea
                            value={s.body}
                            onChange={(e) =>
                              patchStep(s.uid, { body: e.target.value })
                            }
                            rows={4}
                            placeholder="Hi {{name}}, …"
                            disabled={pending}
                          />
                        </Field>
                      </div>
                    ) : null}

                    {s.kind === 'task' ? (
                      <div className="grid grid-cols-12 gap-2">
                        <div className="col-span-12 sm:col-span-8">
                          <Field label="Task title" required>
                            <Input
                              value={s.taskTitle}
                              onChange={(e) =>
                                patchStep(s.uid, { taskTitle: e.target.value })
                              }
                              placeholder="Call {{name}}"
                              disabled={pending}
                            />
                          </Field>
                        </div>
                        <div className="col-span-12 sm:col-span-4">
                          <Field
                            label="Due in (days)"
                            help="From the day the step runs"
                          >
                            <Input
                              type="number"
                              min={0}
                              value={s.dueInDays}
                              onChange={(e) =>
                                patchStep(s.uid, { dueInDays: e.target.value })
                              }
                              placeholder="1"
                              disabled={pending}
                            />
                          </Field>
                        </div>
                      </div>
                    ) : null}

                    {s.kind === 'wait' ? (
                      <div className="grid grid-cols-12 gap-2">
                        <div className="col-span-12 sm:col-span-4">
                          <Field label="Wait (days)" required>
                            <Input
                              type="number"
                              min={1}
                              value={s.waitDays}
                              onChange={(e) =>
                                patchStep(s.uid, { waitDays: e.target.value })
                              }
                              placeholder="2"
                              disabled={pending}
                            />
                          </Field>
                        </div>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>

            <div className="mt-2 rounded-md border border-[var(--st-border)] p-3">
              <p className="mb-2 text-sm font-medium">Settings</p>
              <Switch
                checked={state.unenrollOnReply}
                onCheckedChange={(checked) =>
                  setState((s) => ({ ...s, unenrollOnReply: checked }))
                }
                label="Unenroll on reply — stop the cadence when the record replies"
                disabled={pending}
              />
            </div>

            {error ? (
              <Alert tone="danger" role="alert">
                {error}
              </Alert>
            ) : null}
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="secondary" disabled={pending}>
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" variant="primary" loading={pending}>
              {editing ? 'Save changes' : 'Create sequence'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Enrollments sheet
// ---------------------------------------------------------------------------

interface EnrollmentsSheetProps {
  /** Sequence whose enrollments are shown; null = closed. */
  sequence: SequenceRow | null;
  onClose: () => void;
}

function EnrollmentsSheet({
  sequence,
  onClose,
}: EnrollmentsSheetProps): React.JSX.Element {
  const [statusFilter, setStatusFilter] = React.useState<string>('all');
  const [enrollments, setEnrollments] = React.useState<SabcrmRustEnrollment[]>(
    [],
  );
  const [total, setTotal] = React.useState(0);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [unenrollingId, setUnenrollingId] = React.useState<string | null>(null);
  const [, startUnenroll] = React.useTransition();

  const sequenceId = sequence?.id ?? null;
  const stepTotal = sequence?.steps.length ?? 0;

  // Reset the filter whenever a different sequence's sheet opens.
  React.useEffect(() => {
    setStatusFilter('all');
  }, [sequenceId]);

  const load = React.useCallback(
    async (seqId: string, status: string): Promise<void> => {
      setLoading(true);
      setError(null);
      const res = await listSabcrmSequenceEnrollments({
        sequenceId: seqId,
        status:
          status === 'all' ? undefined : (status as SabcrmEnrollmentStatus),
        limit: 100,
      });
      setLoading(false);
      if (!res.ok) {
        setError(res.error);
        setEnrollments([]);
        setTotal(0);
        return;
      }
      setEnrollments(res.data.enrollments);
      setTotal(res.data.total);
    },
    [],
  );

  React.useEffect(() => {
    if (!sequenceId) return;
    let cancelled = false;
    void (async () => {
      if (cancelled) return;
      await load(sequenceId, statusFilter);
    })();
    return () => {
      cancelled = true;
    };
  }, [sequenceId, statusFilter, load]);

  const handleUnenroll = (enrollmentId: string): void => {
    if (!sequenceId) return;
    setUnenrollingId(enrollmentId);
    startUnenroll(async () => {
      const res = await unenrollSabcrmEnrollment(enrollmentId, 'manual');
      setUnenrollingId(null);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      await load(sequenceId, statusFilter);
    });
  };

  return (
    <Sheet
      open={sequence !== null}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <SheetContent
        side="right"
        style={{ width: 'min(720px, calc(100vw - 24px))' }}
      >
        <SheetHeader>
          <SheetTitle>Enrollments — {sequence?.name ?? ''}</SheetTitle>
          <SheetDescription>
            Records currently walking (or done walking) this cadence.
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-3 overflow-y-auto px-4 pb-6">
          <div className="flex items-center justify-between gap-2">
            <SelectField
              value={statusFilter}
              onChange={(v) => setStatusFilter(v ?? 'all')}
              options={ENROLLMENT_FILTER_OPTIONS}
              aria-label="Filter enrollments by status"
              disabled={loading}
            />
            <span className="text-xs text-[var(--st-text-secondary)]">
              {total} total
            </span>
          </div>

          {error ? (
            <Alert tone="danger" role="alert">
              {error}
            </Alert>
          ) : null}

          {loading ? (
            <div className="flex flex-col gap-2" aria-busy="true">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-9 w-full" />
              ))}
            </div>
          ) : null}

          {!loading && !error && enrollments.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No enrollments"
              description={
                statusFilter === 'all'
                  ? 'No records have been enrolled in this sequence yet. Enroll records from their detail page.'
                  : 'No enrollments match this status.'
              }
            />
          ) : null}

          {!loading && enrollments.length > 0 ? (
            <Table hover>
              <THead>
                <Tr>
                  <Th>Record</Th>
                  <Th>Step</Th>
                  <Th>Status</Th>
                  <Th>Next run</Th>
                  <Th align="right">
                    <span className="sr-only">Actions</span>
                  </Th>
                </Tr>
              </THead>
              <TBody>
                {enrollments.map((en) => (
                  <Tr key={en.id}>
                    <Td>
                      <Link
                        href={`/sabcrm/${encodeURIComponent(en.objectSlug)}/${encodeURIComponent(en.recordId)}`}
                        className="underline-offset-2 hover:underline"
                      >
                        <span className="font-medium">{en.objectSlug}</span>
                        <span className="text-[var(--st-text-secondary)]">
                          {' '}
                          · {en.recordId.slice(-6)}
                        </span>
                      </Link>
                    </Td>
                    <Td>
                      {Math.min(en.currentStepIndex + 1, Math.max(stepTotal, 1))}
                      /{Math.max(stepTotal, 1)}
                    </Td>
                    <Td>
                      <Badge tone={ENROLLMENT_TONE[en.status] ?? 'neutral'} dot>
                        {ENROLLMENT_LABEL[en.status] ?? en.status}
                      </Badge>
                    </Td>
                    <Td>
                      {en.status === 'active' ? relativeTime(en.nextRunAt) : '—'}
                    </Td>
                    <Td align="right">
                      {en.status === 'active' ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          loading={unenrollingId === en.id}
                          onClick={() => handleUnenroll(en.id)}
                          aria-label={`Unenroll record ${en.recordId}`}
                        >
                          Unenroll
                        </Button>
                      ) : null}
                    </Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
// Page client
// ---------------------------------------------------------------------------

export function SequencesClient({
  initialRows,
  templates,
  initialError,
}: SequencesClientProps): React.JSX.Element {
  const router = useRouter();
  const [builderOpen, setBuilderOpen] = React.useState(false);
  const [builderInitial, setBuilderInitial] =
    React.useState<BuilderState | null>(null);
  const [rowError, setRowError] = React.useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = React.useState<SequenceRow | null>(
    null,
  );
  const [enrollSheetFor, setEnrollSheetFor] =
    React.useState<SequenceRow | null>(null);
  const [togglingId, setTogglingId] = React.useState<string | null>(null);
  const [deleting, startDelete] = React.useTransition();
  const [, startToggle] = React.useTransition();

  const refresh = React.useCallback(() => {
    router.refresh();
  }, [router]);

  const openNew = (): void => {
    setBuilderInitial(null);
    setBuilderOpen(true);
  };

  const openEdit = (row: SequenceRow): void => {
    setRowError(null);
    setBuilderInitial(builderFromRow(row));
    setBuilderOpen(true);
  };

  const toggleStatus = (row: SequenceRow): void => {
    setRowError(null);
    setTogglingId(row.id);
    startToggle(async () => {
      const res = await updateSabcrmSequence(row.id, {
        status: row.status === 'active' ? 'paused' : 'active',
      });
      setTogglingId(null);
      if (!res.ok) {
        setRowError(res.error);
        return;
      }
      refresh();
    });
  };

  const handleDelete = (): void => {
    const target = confirmDelete;
    if (!target) return;
    setRowError(null);
    startDelete(async () => {
      const res = await deleteSabcrmSequence(target.id);
      if (!res.ok) {
        setRowError(res.error);
        return;
      }
      setConfirmDelete(null);
      refresh();
    });
  };

  return (
    <div className="mx-auto w-full max-w-[1040px] px-6 pb-12 pt-6">
      <PageHeader>
        <PageHeaderHeading>
          <PageTitle>Sequences</PageTitle>
          <PageDescription>
            Automated cadences of emails, tasks and waits — enroll records and
            the scheduler walks them step by step.
          </PageDescription>
        </PageHeaderHeading>
        <PageActions>
          <Button variant="primary" iconLeft={Plus} onClick={openNew}>
            New sequence
          </Button>
        </PageActions>
      </PageHeader>

      {initialError ? (
        <div className="my-4">
          <Alert tone="danger" role="alert">
            Couldn&apos;t load sequences: {initialError}
          </Alert>
        </div>
      ) : null}

      {rowError ? (
        <div className="my-4">
          <Alert tone="danger" role="alert">
            {rowError}
          </Alert>
        </div>
      ) : null}

      {!initialError && initialRows.length === 0 ? (
        <div className="mt-12">
          <EmptyState
            icon={ListChecks}
            title="No sequences yet"
            description="Build your first cadence — a series of emails, tasks and waits — then enroll records to start outreach on autopilot."
            action={
              <Button variant="primary" iconLeft={Plus} onClick={openNew}>
                New sequence
              </Button>
            }
          />
        </div>
      ) : null}

      {initialRows.length > 0 ? (
        <div className="mt-4">
          <Table hover>
            <THead>
              <Tr>
                <Th>Name</Th>
                <Th>Status</Th>
                <Th>Steps</Th>
                <Th align="right">Active enrollments</Th>
                <Th>Created</Th>
                <Th align="right" width={220}>
                  <span className="sr-only">Actions</span>
                </Th>
              </Tr>
            </THead>
            <TBody>
              {initialRows.map((row) => (
                <Tr key={row.id}>
                  <Td>
                    <span className="font-medium">{row.name}</span>
                  </Td>
                  <Td>
                    <div className="flex items-center gap-2">
                      <Switch
                        size="sm"
                        checked={row.status === 'active'}
                        onCheckedChange={() => toggleStatus(row)}
                        disabled={togglingId === row.id}
                        aria-label={
                          row.status === 'active'
                            ? `Pause sequence ${row.name}`
                            : `Activate sequence ${row.name}`
                        }
                      />
                      <Badge
                        tone={row.status === 'active' ? 'success' : 'neutral'}
                        dot
                      >
                        {row.status === 'active' ? 'Active' : 'Paused'}
                      </Badge>
                    </div>
                  </Td>
                  <Td>{stepSummary(row.steps)}</Td>
                  <Td align="right">
                    <button
                      type="button"
                      className="underline-offset-2 hover:underline"
                      onClick={() => setEnrollSheetFor(row)}
                      aria-label={`View enrollments for ${row.name}`}
                    >
                      {row.activeEnrollments}
                    </button>
                  </Td>
                  <Td>{formatDate(row.createdAt)}</Td>
                  <Td align="right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        iconLeft={Users}
                        aria-label={`View enrollments for ${row.name}`}
                        onClick={() => setEnrollSheetFor(row)}
                      >
                        Enrollments
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        iconLeft={Pencil}
                        aria-label={`Edit sequence ${row.name}`}
                        onClick={() => openEdit(row)}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        iconLeft={Trash2}
                        aria-label={`Delete sequence ${row.name}`}
                        onClick={() => {
                          setRowError(null);
                          setConfirmDelete(row);
                        }}
                      >
                        Delete
                      </Button>
                    </div>
                  </Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        </div>
      ) : null}

      <SequenceBuilderDialog
        open={builderOpen}
        onOpenChange={setBuilderOpen}
        initial={builderInitial}
        templates={templates}
        onSaved={refresh}
      />

      <EnrollmentsSheet
        sequence={enrollSheetFor}
        onClose={() => setEnrollSheetFor(null)}
      />

      <AlertDialog
        open={confirmDelete !== null}
        onOpenChange={(next) => {
          if (!next && !deleting) {
            setConfirmDelete(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {confirmDelete?.name ?? 'this sequence'}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              The sequence is removed and every remaining active enrollment is
              unenrolled — no further emails or tasks will be created.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel asChild>
              <Button variant="secondary" disabled={deleting}>
                Cancel
              </Button>
            </AlertDialogCancel>
            <Button variant="danger" loading={deleting} onClick={handleDelete}>
              Delete sequence
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
