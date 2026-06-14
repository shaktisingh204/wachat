'use client';

import { Alert, AlertDescription, AlertTitle, Badge, Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator, Button, Card, CardBody, CardHeader, CardTitle, DataTable, EmptyState, Label, PageActions, PageDescription, PageEyebrow, PageHeader, PageHeading, PageTitle, Progress, Skeleton, StatCard, Textarea, cn, useToast, type DataTableColumn } from '@/components/sabcrm/20ui';
import {
  useActionState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  } from 'react';
import { useFormStatus } from 'react-dom';
import { formatDistanceToNow } from 'date-fns';
import type { WithId } from 'mongodb';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  Loader2,
  RefreshCw,
  Send,
  Users,
  } from 'lucide-react';

import {
  getFacebookBroadcasts,
  handleSendFacebookBroadcast,
  } from '@/app/actions/facebook.actions';
import type { FacebookBroadcast } from '@/lib/definitions';
import { useProject } from '@/context/project-context';

/**
 * /dashboard/facebook/broadcasts — Messenger broadcasts (Ui20).
 *
 * Composer is a 3-step numbered stepper (Audience › Compose › Review),
 * NOT tabs. The history view is a `Ui20DataTable`. Same data + handlers
 * as the original wabasimplify version (handleSendFacebookBroadcast,
 * getFacebookBroadcasts, useProject).
 */

import * as React from 'react';

import {
  FeatureLock,
  FeatureLockOverlay,
} from '@/app/dashboard/facebook/_components/feature-lock';

const initialState: { message?: string; error?: string } = {
  message: undefined,
  error: undefined,
};

type BroadcastRow = WithId<FacebookBroadcast>;

const STEPS = [
  {
    key: 'audience',
    label: 'Audience',
    description: 'Confirm who will receive this message.',
  },
  {
    key: 'compose',
    label: 'Compose',
    description: 'Write the broadcast text.',
  },
  {
    key: 'review',
    label: 'Review & send',
    description: 'Double-check and dispatch.',
  },
] as const;

type StepKey = (typeof STEPS)[number]['key'];

type BroadcastState = {
  step: StepKey;
  message: string;
};

type BroadcastAction =
  | { type: 'SET_STEP'; payload: StepKey }
  | { type: 'SET_MESSAGE'; payload: string }
  | { type: 'RESET' };

function broadcastReducer(state: BroadcastState, action: BroadcastAction): BroadcastState {
  switch (action.type) {
    case 'SET_STEP':
      return { ...state, step: action.payload };
    case 'SET_MESSAGE':
      return { ...state, message: action.payload };
    case 'RESET':
      return { step: 'audience', message: '' };
    default:
      return state;
  }
}

function PageSkeleton() {
  return (
    <div className="mx-auto w-full max-w-[1320px] px-6 pt-6 pb-10">
      <Skeleton className="h-3 w-52" />
      <div className="mt-5 flex items-center justify-between">
        <Skeleton className="h-9 w-72" />
        <Skeleton className="h-9 w-32" />
      </div>
      <Skeleton className="mt-6 h-16 w-full" />
      <Skeleton className="mt-6 h-72 w-full" />
    </div>
  );
}

function StepperHeader({ current }: { current: StepKey }) {
  const currentIdx = STEPS.findIndex((s) => s.key === current);
  return (
    <ol className="flex flex-col gap-2 rounded-[var(--st-radius-lg)] border border-[var(--st-border)] bg-[var(--st-bg)] p-3 sm:flex-row sm:items-stretch sm:gap-0">
      {STEPS.map((step, idx) => {
        const isDone = idx < currentIdx;
        const isCurrent = idx === currentIdx;
        return (
          <React.Fragment key={step.key}>
            <li
              className={cn(
                'flex flex-1 items-start gap-3 rounded-[var(--st-radius)] px-3 py-2',
                isCurrent && 'bg-[var(--st-bg-secondary)]',
              )}
            >
              <span
                className={cn(
                  'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[12px]',
                  isDone && 'bg-[var(--st-text)] text-[var(--st-text-inverted)]',
                  isCurrent &&
                    'border border-[var(--st-text)] bg-[var(--st-bg)] text-[var(--st-text)]',
                  !isDone &&
                    !isCurrent &&
                    'border border-[var(--st-border)] bg-[var(--st-bg-muted)] text-[var(--st-text-secondary)]',
                )}
              >
                {isDone ? (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                ) : (
                  idx + 1
                )}
              </span>
              <div className="min-w-0 pt-0.5">
                <p
                  className={cn(
                    'text-[12.5px] leading-none',
                    isCurrent || isDone
                      ? 'text-[var(--st-text)]'
                      : 'text-[var(--st-text-secondary)]',
                  )}
                >
                  {step.label}
                </p>
                <p className="mt-1 text-[11px] text-[var(--st-text-secondary)] leading-tight">
                  {step.description}
                </p>
              </div>
            </li>
            {idx !== STEPS.length - 1 ? (
              <span className="hidden items-center px-1 text-[var(--st-text-tertiary)] sm:flex">
                <ChevronRight className="h-3.5 w-3.5" />
              </span>
            ) : null}
          </React.Fragment>
        );
      })}
    </ol>
  );
}

function SubmitButton({ disabled }: { disabled?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending || disabled}>
      {pending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Send className="h-4 w-4" />
      )}
      Send broadcast
    </Button>
  );
}

function statusVariant(
  status: FacebookBroadcast['status'],
): 'success' | 'info' | 'warning' | 'danger' | 'outline' {
  if (status === 'COMPLETED') return 'success';
  if (status === 'PROCESSING' || status === 'QUEUED') return 'info';
  if (status === 'PARTIAL_FAILURE') return 'warning';
  if (status === 'FAILED') return 'danger';
  return 'outline';
}

function StatusBadge({
  status,
}: {
  status: FacebookBroadcast['status'];
}) {
  const variant = statusVariant(status);
  const map: Record<typeof variant, string> = {
    success: 'bg-[var(--st-status-ok)]/15 text-[var(--st-status-ok)] border-[var(--st-status-ok)]/30',
    info: 'bg-[var(--st-text-secondary)]/15 text-[var(--st-text-secondary)] border-[var(--st-text-secondary)]/30',
    warning: 'bg-[var(--st-warn)]/15 text-[var(--st-warn)] border-[var(--st-warn)]/30',
    danger: 'bg-[var(--st-danger)]/15 text-[var(--st-danger)] border-[var(--st-danger)]/30',
    outline: '',
  };
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2 py-0.5 text-[10.5px] uppercase tracking-wide',
        map[variant],
      )}
    >
      {status}
    </span>
  );
}

export default function FacebookBroadcastsPage() {
  const { toast } = useToast();
  const { activeProject, isLoadingProject, sessionUser } = useProject();
  const [broadcasts, setBroadcasts] = useState<BroadcastRow[]>([]);
  const [isLoading, startLoading] = useTransition();
  const [stateForm, dispatch] = React.useReducer(broadcastReducer, { step: 'audience', message: '' });

  const [state, formAction] = useActionState(
    handleSendFacebookBroadcast,
    initialState,
  );
  const formRef = useRef<HTMLFormElement>(null);

  const isAllowed = sessionUser?.plan?.features?.liveChat ?? false;

  const fetchData = useCallback(() => {
    if (!activeProject) return;
    startLoading(async () => {
      const data = await getFacebookBroadcasts(
        activeProject._id.toString(),
      );
      setBroadcasts(data);
    });
  }, [activeProject]);

  useEffect(() => {
    if (activeProject) fetchData();
  }, [activeProject, fetchData]);

  useEffect(() => {
    if (state?.message) {
      toast({ title: 'Broadcast queued', description: state.message });
      formRef.current?.reset();
      dispatch({ type: 'RESET' });
      fetchData();
    }
    if (state?.error) {
      toast({
        title: 'Error',
        description: state.error,
        variant: 'destructive',
      });
    }
  }, [state, toast, fetchData]);

  const stats = useMemo(() => {
    const total = broadcasts.length;
    const completed = broadcasts.filter((b) => b.status === 'COMPLETED')
      .length;
    const inFlight = broadcasts.filter(
      (b) => b.status === 'PROCESSING' || b.status === 'QUEUED',
    ).length;
    return { total, completed, inFlight };
  }, [broadcasts]);

  const columns = useMemo<DataTableColumn<BroadcastRow>[]>(
    () => [
      {
        key: 'createdAt',
        header: 'Created',
        render: (row) => (
          <span className="text-[12px] text-[var(--st-text-secondary)]">
            {formatDistanceToNow(new Date(row.createdAt), {
              addSuffix: true,
            })}
          </span>
        ),
      },
      {
        key: 'status',
        header: 'Status',
        render: (row) => <StatusBadge status={row.status} />,
      },
      {
        key: 'message',
        header: 'Message',
        render: (row) => (
          <span className="line-clamp-1 max-w-[420px] text-[12.5px] text-[var(--st-text)]">
            {row.message}
          </span>
        ),
      },
      {
        key: 'stats',
        header: 'Stats',
        render: (row) => {
          const b = row;
          const sent = b.successCount + b.failedCount;
          const pct =
            b.totalRecipients > 0
              ? Math.round((sent / b.totalRecipients) * 100)
              : 0;
          return (
            <div className="flex flex-col gap-1 text-[11.5px]">
              <span className="text-[var(--st-text)]">
                Sent {b.successCount}/{b.totalRecipients}
              </span>
              <span className="text-[var(--st-text-secondary)]">
                Failed {b.failedCount}
              </span>
              {b.status === 'PROCESSING' ? (
                <Progress value={pct} className="h-1" />
              ) : null}
            </div>
          );
        },
      },
    ],
    [],
  );

  if (isLoadingProject) return <PageSkeleton />;

  return (
    <div className="mx-auto w-full max-w-[1320px] px-6 pt-6 pb-10">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/dashboard">SabNode</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink href="/dashboard/facebook">
              Meta Suite
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Broadcasts</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <PageHeader className="mt-5">
        <PageHeading>
          <PageEyebrow>Marketing</PageEyebrow>
          <PageTitle>Messenger broadcasts</PageTitle>
          <PageDescription>
            Send a Messenger update to every user who has previously messaged
            your connected Page. Use the numbered steps to compose, review,
            and dispatch.
          </PageDescription>
        </PageHeading>
        <PageActions>
          <Button variant="outline" size="sm" onClick={fetchData}>
            <RefreshCw /> Refresh history
          </Button>
        </PageActions>
      </PageHeader>

      {!activeProject ? (
        <Alert variant="destructive" className="mt-6">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>No project selected</AlertTitle>
          <AlertDescription>
            Select a project from the main dashboard to send broadcasts.
          </AlertDescription>
        </Alert>
      ) : (
        <div className="relative mt-6">
          <FeatureLockOverlay
            isAllowed={isAllowed}
            featureName="Facebook Broadcasts"
          />
          <FeatureLock isAllowed={isAllowed}>
            <div className="mt-2 grid gap-3 md:grid-cols-3">
              <StatCard
                label="Total broadcasts"
                value={stats.total.toLocaleString()}
                icon={<Send />}
              />
              <StatCard
                label="Completed"
                value={stats.completed.toLocaleString()}
                icon={<CheckCircle2 />}
              />
              <StatCard
                label="In progress"
                value={stats.inFlight.toLocaleString()}
                icon={<Users />}
              />
            </div>

            <div className="mt-6">
              <StepperHeader current={stateForm.step} />
            </div>

            <Card className="mt-4 p-0">
              <CardHeader>
                <CardTitle className="text-base">
                  {STEPS.find((s) => s.key === stateForm.step)?.label}
                </CardTitle>
              </CardHeader>
              <CardBody>
                <form ref={formRef} action={formAction}>
                  <input
                    type="hidden"
                    name="projectId"
                    value={activeProject._id.toString()}
                  />
                  <input type="hidden" name="message" value={stateForm.message} />

                  {stateForm.step === 'audience' ? (
                    <div className="flex flex-col gap-4">
                      <Alert>
                        <Users className="h-4 w-4" />
                        <AlertTitle>Audience scope</AlertTitle>
                        <AlertDescription>
                          Broadcasts go to every Messenger subscriber that is
                          eligible to receive a message under Meta&apos;s
                          24-hour window and POST_PURCHASE_UPDATE tag rules.
                          Manage subscribers from the{' '}
                          <a
                            href="/dashboard/facebook/subscribers"
                            className="underline underline-offset-2"
                          >
                            Subscribers
                          </a>{' '}
                          page.
                        </AlertDescription>
                      </Alert>
                      <div className="flex justify-end">
                        <Button
                          type="button"
                          onClick={() => dispatch({ type: 'SET_STEP', payload: 'compose' })}
                        >
                          Continue <ArrowRight />
                        </Button>
                      </div>
                    </div>
                  ) : null}

                  {stateForm.step === 'compose' ? (
                    <div className="flex flex-col gap-4">
                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor="broadcast-message">
                          Message
                        </Label>
                        <Textarea
                          id="broadcast-message"
                          className="min-h-32"
                          placeholder="Enter your broadcast message…"
                          value={stateForm.message}
                          onChange={(e) => dispatch({ type: 'SET_MESSAGE', payload: e.target.value })}
                          required
                        />
                        <p className="text-[11px] text-[var(--st-text-secondary)]">
                          {stateForm.message.length} characters
                        </p>
                      </div>
                      <div className="flex justify-between">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => dispatch({ type: 'SET_STEP', payload: 'audience' })}
                        >
                          <ArrowLeft /> Back
                        </Button>
                        <Button
                          type="button"
                          onClick={() => dispatch({ type: 'SET_STEP', payload: 'review' })}
                          disabled={!stateForm.message.trim()}
                        >
                          Continue <ArrowRight />
                        </Button>
                      </div>
                    </div>
                  ) : null}

                  {stateForm.step === 'review' ? (
                    <div className="flex flex-col gap-4">
                      <div className="rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] px-4 py-3">
                        <p className="text-[11px] uppercase tracking-wide text-[var(--st-text-tertiary)]">
                          Preview
                        </p>
                        <p className="mt-1 whitespace-pre-wrap text-[13px] text-[var(--st-text)]">
                          {stateForm.message || '— empty message —'}
                        </p>
                      </div>
                      <Alert variant="warning">
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>One-shot dispatch</AlertTitle>
                        <AlertDescription>
                          This sends to every eligible subscriber as soon as
                          you click send. There is no scheduling at this step.
                        </AlertDescription>
                      </Alert>
                      <div className="flex justify-between">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => dispatch({ type: 'SET_STEP', payload: 'compose' })}
                        >
                          <ArrowLeft /> Back
                        </Button>
                        <SubmitButton disabled={!stateForm.message.trim()} />
                      </div>
                    </div>
                  ) : null}
                </form>
              </CardBody>
            </Card>

            <div className="mt-8">
              <h2 className="text-[14px] font-medium text-[var(--st-text)]">
                Broadcast history
              </h2>
              <p className="text-[12px] text-[var(--st-text-secondary)]">
                Every dispatch and its delivery stats.
              </p>
              <div className="mt-3">
                {isLoading && broadcasts.length === 0 ? (
                  <div className="flex flex-col gap-2">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <Skeleton key={i} className="h-10 w-full" />
                    ))}
                  </div>
                ) : broadcasts.length === 0 ? (
                  <EmptyState
                    icon={<Send />}
                    title="No broadcasts sent yet"
                    description="Compose one above to reach your Messenger subscribers."
                  />
                ) : (
                  <DataTable
                    columns={columns}
                    rows={broadcasts}
                    getRowId={(row) => row._id.toString()}
                  />
                )}
              </div>
            </div>
          </FeatureLock>
        </div>
      )}
    </div>
  );
}
