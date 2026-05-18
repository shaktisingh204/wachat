'use client';

import {
  ZoruAlert,
  ZoruAlertDescription,
  ZoruAlertTitle,
  ZoruBadge,
  ZoruBreadcrumb,
  ZoruBreadcrumbItem,
  ZoruBreadcrumbLink,
  ZoruBreadcrumbList,
  ZoruBreadcrumbPage,
  ZoruBreadcrumbSeparator,
  ZoruButton,
  ZoruCard,
  ZoruCardContent,
  ZoruCardHeader,
  ZoruCardTitle,
  ZoruDataTable,
  ZoruEmptyState,
  ZoruLabel,
  ZoruPageActions,
  ZoruPageDescription,
  ZoruPageEyebrow,
  ZoruPageHeader,
  ZoruPageHeading,
  ZoruPageTitle,
  ZoruProgress,
  ZoruSkeleton,
  ZoruStatCard,
  ZoruTextarea,
  cn,
  useZoruToast,
} from '@/components/zoruui';
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
import type { ColumnDef } from '@tanstack/react-table';
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
 * /dashboard/facebook/broadcasts — Messenger broadcasts (ZoruUI).
 *
 * Composer is a 3-step numbered stepper (Audience › Compose › Review),
 * NOT tabs. The history view is a `ZoruDataTable`. Same data + handlers
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

function PageSkeleton() {
  return (
    <div className="mx-auto w-full max-w-[1320px] px-6 pt-6 pb-10">
      <ZoruSkeleton className="h-3 w-52" />
      <div className="mt-5 flex items-center justify-between">
        <ZoruSkeleton className="h-9 w-72" />
        <ZoruSkeleton className="h-9 w-32" />
      </div>
      <ZoruSkeleton className="mt-6 h-16 w-full" />
      <ZoruSkeleton className="mt-6 h-72 w-full" />
    </div>
  );
}

function StepperHeader({ current }: { current: StepKey }) {
  const currentIdx = STEPS.findIndex((s) => s.key === current);
  return (
    <ol className="flex flex-col gap-2 rounded-[var(--zoru-radius-lg)] border border-zoru-line bg-zoru-bg p-3 sm:flex-row sm:items-stretch sm:gap-0">
      {STEPS.map((step, idx) => {
        const isDone = idx < currentIdx;
        const isCurrent = idx === currentIdx;
        return (
          <React.Fragment key={step.key}>
            <li
              className={cn(
                'flex flex-1 items-start gap-3 rounded-[var(--zoru-radius)] px-3 py-2',
                isCurrent && 'bg-zoru-surface',
              )}
            >
              <span
                className={cn(
                  'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[12px]',
                  isDone && 'bg-zoru-ink text-zoru-on-primary',
                  isCurrent &&
                    'border border-zoru-ink bg-zoru-bg text-zoru-ink',
                  !isDone &&
                    !isCurrent &&
                    'border border-zoru-line bg-zoru-surface-2 text-zoru-ink-muted',
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
                      ? 'text-zoru-ink'
                      : 'text-zoru-ink-muted',
                  )}
                >
                  {step.label}
                </p>
                <p className="mt-1 text-[11px] text-zoru-ink-muted leading-tight">
                  {step.description}
                </p>
              </div>
            </li>
            {idx !== STEPS.length - 1 ? (
              <span className="hidden items-center px-1 text-zoru-ink-subtle sm:flex">
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
    <ZoruButton type="submit" disabled={pending || disabled}>
      {pending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Send className="h-4 w-4" />
      )}
      Send broadcast
    </ZoruButton>
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
    success: 'bg-zoru-success/15 text-zoru-success border-zoru-success/30',
    info: 'bg-zoru-info/15 text-zoru-info border-zoru-info/30',
    warning: 'bg-zoru-warning/15 text-zoru-warning border-zoru-warning/30',
    danger: 'bg-zoru-danger/15 text-zoru-danger border-zoru-danger/30',
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
  const { toast } = useZoruToast();
  const { activeProject, isLoadingProject, sessionUser } = useProject();
  const [broadcasts, setBroadcasts] = useState<BroadcastRow[]>([]);
  const [isLoading, startLoading] = useTransition();
  const [step, setStep] = useState<StepKey>('audience');
  const [message, setMessage] = useState('');

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
      setMessage('');
      setStep('audience');
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

  const columns = useMemo<ColumnDef<BroadcastRow>[]>(
    () => [
      {
        accessorKey: 'createdAt',
        header: 'Created',
        cell: ({ row }) => (
          <span className="text-[12px] text-zoru-ink-muted">
            {formatDistanceToNow(new Date(row.original.createdAt), {
              addSuffix: true,
            })}
          </span>
        ),
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => <StatusBadge status={row.original.status} />,
      },
      {
        accessorKey: 'message',
        header: 'Message',
        cell: ({ row }) => (
          <span className="line-clamp-1 max-w-[420px] text-[12.5px] text-zoru-ink">
            {row.original.message}
          </span>
        ),
      },
      {
        id: 'stats',
        header: 'Stats',
        cell: ({ row }) => {
          const b = row.original;
          const sent = b.successCount + b.failedCount;
          const pct =
            b.totalRecipients > 0
              ? Math.round((sent / b.totalRecipients) * 100)
              : 0;
          return (
            <div className="flex flex-col gap-1 text-[11.5px]">
              <span className="text-zoru-ink">
                Sent {b.successCount}/{b.totalRecipients}
              </span>
              <span className="text-zoru-ink-muted">
                Failed {b.failedCount}
              </span>
              {b.status === 'PROCESSING' ? (
                <ZoruProgress value={pct} className="h-1" />
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
      <ZoruBreadcrumb>
        <ZoruBreadcrumbList>
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/dashboard">SabNode</ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/dashboard/facebook">
              Meta Suite
            </ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbPage>Broadcasts</ZoruBreadcrumbPage>
          </ZoruBreadcrumbItem>
        </ZoruBreadcrumbList>
      </ZoruBreadcrumb>

      <ZoruPageHeader className="mt-5">
        <ZoruPageHeading>
          <ZoruPageEyebrow>Marketing</ZoruPageEyebrow>
          <ZoruPageTitle>Messenger broadcasts</ZoruPageTitle>
          <ZoruPageDescription>
            Send a Messenger update to every user who has previously messaged
            your connected Page. Use the numbered steps to compose, review,
            and dispatch.
          </ZoruPageDescription>
        </ZoruPageHeading>
        <ZoruPageActions>
          <ZoruButton variant="outline" size="sm" onClick={fetchData}>
            <RefreshCw /> Refresh history
          </ZoruButton>
        </ZoruPageActions>
      </ZoruPageHeader>

      {!activeProject ? (
        <ZoruAlert variant="destructive" className="mt-6">
          <AlertCircle className="h-4 w-4" />
          <ZoruAlertTitle>No project selected</ZoruAlertTitle>
          <ZoruAlertDescription>
            Select a project from the main dashboard to send broadcasts.
          </ZoruAlertDescription>
        </ZoruAlert>
      ) : (
        <div className="relative mt-6">
          <FeatureLockOverlay
            isAllowed={isAllowed}
            featureName="Facebook Broadcasts"
          />
          <FeatureLock isAllowed={isAllowed}>
            <div className="mt-2 grid gap-3 md:grid-cols-3">
              <ZoruStatCard
                label="Total broadcasts"
                value={stats.total.toLocaleString()}
                period="Lifetime"
                icon={<Send />}
              />
              <ZoruStatCard
                label="Completed"
                value={stats.completed.toLocaleString()}
                period="Successful runs"
                icon={<CheckCircle2 />}
              />
              <ZoruStatCard
                label="In progress"
                value={stats.inFlight.toLocaleString()}
                period="Queued or processing"
                icon={<Users />}
              />
            </div>

            <div className="mt-6">
              <StepperHeader current={step} />
            </div>

            <ZoruCard className="mt-4 p-0">
              <ZoruCardHeader>
                <ZoruCardTitle className="text-base">
                  {STEPS.find((s) => s.key === step)?.label}
                </ZoruCardTitle>
              </ZoruCardHeader>
              <ZoruCardContent>
                <form ref={formRef} action={formAction}>
                  <input
                    type="hidden"
                    name="projectId"
                    value={activeProject._id.toString()}
                  />
                  <input type="hidden" name="message" value={message} />

                  {step === 'audience' ? (
                    <div className="flex flex-col gap-4">
                      <ZoruAlert>
                        <Users className="h-4 w-4" />
                        <ZoruAlertTitle>Audience scope</ZoruAlertTitle>
                        <ZoruAlertDescription>
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
                        </ZoruAlertDescription>
                      </ZoruAlert>
                      <div className="flex justify-end">
                        <ZoruButton
                          type="button"
                          onClick={() => setStep('compose')}
                        >
                          Continue <ArrowRight />
                        </ZoruButton>
                      </div>
                    </div>
                  ) : null}

                  {step === 'compose' ? (
                    <div className="flex flex-col gap-4">
                      <div className="flex flex-col gap-1.5">
                        <ZoruLabel htmlFor="broadcast-message">
                          Message
                        </ZoruLabel>
                        <ZoruTextarea
                          id="broadcast-message"
                          className="min-h-32"
                          placeholder="Enter your broadcast message…"
                          value={message}
                          onChange={(e) => setMessage(e.target.value)}
                          required
                        />
                        <p className="text-[11px] text-zoru-ink-muted">
                          {message.length} characters
                        </p>
                      </div>
                      <div className="flex justify-between">
                        <ZoruButton
                          type="button"
                          variant="outline"
                          onClick={() => setStep('audience')}
                        >
                          <ArrowLeft /> Back
                        </ZoruButton>
                        <ZoruButton
                          type="button"
                          onClick={() => setStep('review')}
                          disabled={!message.trim()}
                        >
                          Continue <ArrowRight />
                        </ZoruButton>
                      </div>
                    </div>
                  ) : null}

                  {step === 'review' ? (
                    <div className="flex flex-col gap-4">
                      <div className="rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-surface px-4 py-3">
                        <p className="text-[11px] uppercase tracking-wide text-zoru-ink-subtle">
                          Preview
                        </p>
                        <p className="mt-1 whitespace-pre-wrap text-[13px] text-zoru-ink">
                          {message || '— empty message —'}
                        </p>
                      </div>
                      <ZoruAlert variant="warning">
                        <AlertCircle className="h-4 w-4" />
                        <ZoruAlertTitle>One-shot dispatch</ZoruAlertTitle>
                        <ZoruAlertDescription>
                          This sends to every eligible subscriber as soon as
                          you click send. There is no scheduling at this step.
                        </ZoruAlertDescription>
                      </ZoruAlert>
                      <div className="flex justify-between">
                        <ZoruButton
                          type="button"
                          variant="outline"
                          onClick={() => setStep('compose')}
                        >
                          <ArrowLeft /> Back
                        </ZoruButton>
                        <SubmitButton disabled={!message.trim()} />
                      </div>
                    </div>
                  ) : null}
                </form>
              </ZoruCardContent>
            </ZoruCard>

            <div className="mt-8">
              <h2 className="text-[14px] font-medium text-zoru-ink">
                Broadcast history
              </h2>
              <p className="text-[12px] text-zoru-ink-muted">
                Every dispatch and its delivery stats.
              </p>
              <div className="mt-3">
                {isLoading && broadcasts.length === 0 ? (
                  <div className="flex flex-col gap-2">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <ZoruSkeleton key={i} className="h-10 w-full" />
                    ))}
                  </div>
                ) : broadcasts.length === 0 ? (
                  <ZoruEmptyState
                    icon={<Send />}
                    title="No broadcasts sent yet"
                    description="Compose one above to reach your Messenger subscribers."
                  />
                ) : (
                  <ZoruDataTable
                    columns={columns}
                    data={broadcasts}
                    showColumnMenu={false}
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
