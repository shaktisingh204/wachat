'use client';

import * as React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Loader2,
  Plug,
  PowerOff,
  XCircle,
} from 'lucide-react';

import {
  Badge,
  Button,
  Card,
  ZoruCardContent,
  ZoruCardDescription,
  ZoruCardHeader,
  ZoruCardTitle,
  Separator,
  useZoruToast,
} from '@/components/sabcrm/20ui/compat';
import { cn } from '@/lib/utils';

import type {
  CrmConnectionModuleKey,
  CrmModuleConnectionDTO,
} from '@/lib/worksuite/module-connections-types';
import {
  connectCrmModule,
  disconnectCrmModule,
  getCrmModuleConnection,
} from '@/app/actions/crm/module-connections.actions';

export interface ModuleWizardStep<TDraft extends Record<string, any>> {
  id: string;
  title: string;
  description?: string;
  /** Renders the step body. Pass `draft` + `setDraft` to bind fields. */
  render: (ctx: {
    draft: TDraft;
    setDraft: (next: Partial<TDraft>) => void;
    connection: CrmModuleConnectionDTO | null;
  }) => React.ReactNode;
  /** Optional async validator before allowing Next. Throw or return error string. */
  validate?: (draft: TDraft) => Promise<string | null> | string | null;
}

export interface ModuleConnectionWizardProps<TDraft extends Record<string, any>> {
  moduleKey: CrmConnectionModuleKey;
  /** Heading shown above the card (e.g. "Storage"). */
  title: string;
  /** One-liner under the title. */
  subtitle: string;
  /** Lucide icon shown in the hero. */
  icon: React.ComponentType<{ className?: string }>;
  /** Where this connection ends up (e.g. "Routes to SabFiles"). */
  targetModuleLabel: string;
  /** Initial draft used when no connection exists yet. */
  defaultDraft: TDraft;
  /** Step list for the new-connection wizard. */
  steps: ModuleWizardStep<TDraft>[];
  /**
   * Manage-view content shown when already connected. Receives the
   * current connection so the page can render summary + edit affordances.
   */
  manageView?: (ctx: {
    connection: CrmModuleConnectionDTO;
    onReconnect: () => void;
  }) => React.ReactNode;
  /**
   * Optional async test-run hook fired after a successful connect.
   * Resolve with `{ ok, error? }` — UI surfaces the result.
   */
  onTestConnection?: (connection: CrmModuleConnectionDTO) => Promise<{
    ok: boolean;
    error?: string;
  }>;
}

export function ModuleConnectionWizard<TDraft extends Record<string, any>>(
  props: ModuleConnectionWizardProps<TDraft>,
) {
  const {
    moduleKey,
    title,
    subtitle,
    icon: Icon,
    targetModuleLabel,
    defaultDraft,
    steps,
    manageView,
    onTestConnection,
  } = props;

  const { toast } = useZoruToast();

  const [connection, setConnection] =
    React.useState<CrmModuleConnectionDTO | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [mode, setMode] = React.useState<'idle' | 'wizard'>('idle');
  const [stepIdx, setStepIdx] = React.useState(0);
  const [direction, setDirection] = React.useState<1 | -1>(1);
  const [draft, setDraftState] = React.useState<TDraft>(defaultDraft);
  const [validating, setValidating] = React.useState(false);
  const [stepError, setStepError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  const refresh = React.useCallback(async () => {
    setLoading(true);
    const c = await getCrmModuleConnection(moduleKey);
    setConnection(c);
    if (c) {
      // Seed draft from saved config so "Reconnect" pre-fills.
      setDraftState({ ...defaultDraft, ...(c.config as TDraft) });
    }
    setLoading(false);
  }, [moduleKey, defaultDraft]);

  React.useEffect(() => {
    refresh();
  }, [refresh]);

  const setDraft = React.useCallback((next: Partial<TDraft>) => {
    setDraftState((prev) => ({ ...prev, ...next }));
  }, []);

  const startWizard = () => {
    setStepIdx(0);
    setDirection(1);
    setStepError(null);
    setMode('wizard');
  };

  const cancelWizard = () => {
    setMode('idle');
    setStepError(null);
  };

  const goNext = async () => {
    const step = steps[stepIdx];
    if (step.validate) {
      setValidating(true);
      try {
        const err = await step.validate(draft);
        if (err) {
          setStepError(err);
          setValidating(false);
          return;
        }
      } finally {
        setValidating(false);
      }
    }
    setStepError(null);
    if (stepIdx < steps.length - 1) {
      setDirection(1);
      setStepIdx((i) => i + 1);
    } else {
      void submit();
    }
  };

  const goBack = () => {
    if (stepIdx === 0) {
      cancelWizard();
      return;
    }
    setDirection(-1);
    setStepError(null);
    setStepIdx((i) => i - 1);
  };

  const submit = async () => {
    setSubmitting(true);
    try {
      const res = await connectCrmModule(moduleKey, draft);
      if (!res.ok || !res.connection) {
        toast({
          title: 'Connection failed',
          description: res.error ?? 'Unknown error',
          variant: 'destructive',
        });
        return;
      }
      setConnection(res.connection);
      if (onTestConnection) {
        const test = await onTestConnection(res.connection);
        if (!test.ok) {
          toast({
            title: 'Connected with warning',
            description:
              test.error ?? 'Test run did not succeed; please review.',
            variant: 'destructive',
          });
        } else {
          toast({
            title: 'Connected',
            description: `${title} is now wired into ${targetModuleLabel}.`,
          });
        }
      } else {
        toast({
          title: 'Connected',
          description: `${title} is now wired into ${targetModuleLabel}.`,
        });
      }
      setMode('idle');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDisconnect = async () => {
    const res = await disconnectCrmModule(moduleKey);
    if (res.ok) {
      toast({ title: 'Disconnected', description: `${title} is no longer wired.` });
      await refresh();
    } else {
      toast({
        title: 'Failed to disconnect',
        description: res.error ?? 'Unknown error',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Hero */}
      <Card className="overflow-hidden">
        <ZoruCardHeader>
          <div className="flex items-start gap-4">
            <motion.div
              initial={{ scale: 0.7, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 220, damping: 18 }}
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[var(--zoru-radius)] bg-zoru-surface border border-zoru-line"
            >
              <Icon className="h-6 w-6 text-zoru-ink" />
            </motion.div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <ZoruCardTitle>{title}</ZoruCardTitle>
                <ConnectionBadge
                  loading={loading}
                  status={connection?.status ?? 'disconnected'}
                />
              </div>
              <ZoruCardDescription className="mt-1">
                {subtitle}
              </ZoruCardDescription>
              <p className="mt-2 text-xs text-zoru-ink-muted">
                Routes to:{' '}
                <span className="font-medium text-zoru-ink">
                  {targetModuleLabel}
                </span>
              </p>
            </div>
            <div className="flex gap-2">
              {connection?.status === 'connected' ? (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={startWizard}
                  >
                    Reconnect
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleDisconnect}
                  >
                    <PowerOff className="h-4 w-4" />
                    Disconnect
                  </Button>
                </>
              ) : (
                <Button size="sm" onClick={startWizard}>
                  <Plug className="h-4 w-4" />
                  Connect
                </Button>
              )}
            </div>
          </div>
        </ZoruCardHeader>
      </Card>

      {/* Body */}
      <AnimatePresence mode="wait">
        {mode === 'wizard' ? (
          <motion.div
            key="wizard"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.25 }}
          >
            <Card>
              <ZoruCardHeader>
                <StepperHeader
                  steps={steps}
                  current={stepIdx}
                />
              </ZoruCardHeader>
              <Separator />
              <ZoruCardContent className="p-6">
                <AnimatePresence mode="wait" custom={direction}>
                  <motion.div
                    key={steps[stepIdx].id}
                    custom={direction}
                    initial={{ opacity: 0, x: direction * 32 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: direction * -32 }}
                    transition={{ duration: 0.25, ease: 'easeOut' }}
                    className="min-h-[180px]"
                  >
                    <h3 className="text-base font-semibold text-zoru-ink">
                      {steps[stepIdx].title}
                    </h3>
                    {steps[stepIdx].description ? (
                      <p className="mt-1 text-sm text-zoru-ink-muted">
                        {steps[stepIdx].description}
                      </p>
                    ) : null}
                    <div className="mt-4">
                      {steps[stepIdx].render({
                        draft,
                        setDraft,
                        connection,
                      })}
                    </div>
                    {stepError ? (
                      <p className="mt-3 text-sm text-zoru-danger flex items-center gap-1">
                        <XCircle className="h-4 w-4" />
                        {stepError}
                      </p>
                    ) : null}
                  </motion.div>
                </AnimatePresence>
              </ZoruCardContent>
              <Separator />
              <div className="flex items-center justify-between p-4">
                <Button
                  variant="ghost"
                  onClick={goBack}
                  disabled={validating || submitting}
                >
                  <ArrowLeft className="h-4 w-4" />
                  {stepIdx === 0 ? 'Cancel' : 'Back'}
                </Button>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-zoru-ink-muted">
                    Step {stepIdx + 1} of {steps.length}
                  </span>
                  <Button
                    onClick={goNext}
                    disabled={validating || submitting}
                  >
                    {validating || submitting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : null}
                    {stepIdx === steps.length - 1 ? 'Connect' : 'Next'}
                    {stepIdx === steps.length - 1 ? null : (
                      <ArrowRight className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            </Card>
          </motion.div>
        ) : (
          <motion.div
            key="manage"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.25 }}
          >
            {connection?.status === 'connected' && manageView ? (
              manageView({ connection, onReconnect: startWizard })
            ) : (
              <Card>
                <ZoruCardContent className="p-8 flex flex-col items-center text-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zoru-surface border border-zoru-line">
                    <Plug className="h-6 w-6 text-zoru-ink-muted" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-zoru-ink">
                      {title} is not connected yet
                    </h3>
                    <p className="mt-1 text-sm text-zoru-ink-muted max-w-md">
                      Click <span className="font-medium">Connect</span> to
                      wire the CRM into {targetModuleLabel}. We&apos;ll walk
                      you through the {steps.length}-step setup.
                    </p>
                  </div>
                  <Button onClick={startWizard}>
                    <Plug className="h-4 w-4" />
                    Start setup
                  </Button>
                </ZoruCardContent>
              </Card>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ConnectionBadge({
  loading,
  status,
}: {
  loading: boolean;
  status: 'connected' | 'disconnected';
}) {
  if (loading) {
    return (
      <Badge variant="outline" className="gap-1">
        <Loader2 className="h-3 w-3 animate-spin" />
        Checking…
      </Badge>
    );
  }
  if (status === 'connected') {
    return (
      <motion.span
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 18 }}
      >
        <Badge variant="default" className="gap-1 bg-zoru-ink/15 text-zoru-ink border-zoru-line/30">
          <CheckCircle2 className="h-3 w-3" />
          Connected
        </Badge>
      </motion.span>
    );
  }
  return (
    <Badge variant="outline" className="gap-1">
      Disconnected
    </Badge>
  );
}

function StepperHeader<TDraft extends Record<string, any>>({
  steps,
  current,
}: {
  steps: ModuleWizardStep<TDraft>[];
  current: number;
}) {
  return (
    <ol className="flex items-center gap-2 flex-wrap">
      {steps.map((s, i) => {
        const state =
          i < current ? 'done' : i === current ? 'active' : 'upcoming';
        return (
          <React.Fragment key={s.id}>
            <li className="flex items-center gap-2">
              <motion.div
                animate={{
                  scale: state === 'active' ? 1.08 : 1,
                }}
                transition={{ type: 'spring', stiffness: 240, damping: 18 }}
                className={cn(
                  'flex h-7 w-7 items-center justify-center rounded-full border text-xs font-medium',
                  state === 'done' &&
                    'bg-zoru-ink border-zoru-line text-white',
                  state === 'active' &&
                    'bg-zoru-ink text-zoru-on-primary border-zoru-ink',
                  state === 'upcoming' &&
                    'bg-zoru-surface border-zoru-line text-zoru-ink-muted',
                )}
              >
                {state === 'done' ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  i + 1
                )}
              </motion.div>
              <span
                className={cn(
                  'text-sm whitespace-nowrap',
                  state === 'active'
                    ? 'text-zoru-ink font-medium'
                    : 'text-zoru-ink-muted',
                )}
              >
                {s.title}
              </span>
            </li>
            {i < steps.length - 1 ? (
              <span className="h-px w-6 bg-zoru-line" aria-hidden />
            ) : null}
          </React.Fragment>
        );
      })}
    </ol>
  );
}
