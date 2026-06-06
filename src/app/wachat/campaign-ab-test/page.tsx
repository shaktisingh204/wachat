'use client';

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
  Alert,
  Badge,
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardBody,
  StatCard,
  Field,
  Select,
  Slider,
  Spinner,
  EmptyState,
} from '@/components/sabcrm/20ui';
import {
  useEffect,
  useState,
  useTransition,
  useCallback,
} from 'react';
import { ChartBar, Send, Square, Trophy, Trash2, FlaskConical } from 'lucide-react';

import { useProject } from '@/context/project-context';

/**
 * Wachat Campaign A/B Test -- split-test broadcast campaigns.
 *
 * Backed end-to-end by the `wachat-ab-testing` Rust crate (via
 * `@/app/actions/wachat-ab-testing.actions`): create persists the test +
 * launches the real split broadcast, and the list / detail views read the
 * persisted tests and their per-variant results. Results stay at zero
 * until the broadcast webhook populates `wa_ab_test_results`.
 */

import * as React from 'react';

import { getBroadcastSegments } from '@/app/actions/wachat-features.actions';
import {
  listAbTests,
  createAbTest,
  getAbTest,
  stopAbTest,
  promoteAbTestWinner,
  deleteAbTest,
} from '@/app/actions/wachat-ab-testing.actions';
import type {
  AbTest,
  VariantResult,
} from '@/lib/rust-client/wachat-ab-testing';

import { WachatPage } from '@/app/wachat/_components/wachat-page';

const TEMPLATES = [
  'Order Confirmation',
  'Welcome Message',
  'Promo Offer',
  'Appointment Reminder',
  'Feedback Request',
];

const TEMPLATE_OPTIONS = TEMPLATES.map((t) => ({ value: t, label: t }));

interface SegmentRow {
  _id: string;
  name: string;
  estimatedSize?: number;
}

function statusTone(status: string): 'info' | 'neutral' | 'success' | 'warning' {
  switch (status) {
    case 'running':
      return 'info';
    case 'completed':
      return 'success';
    case 'stopped':
      return 'warning';
    default:
      return 'neutral';
  }
}

function pct(n: number, d: number): string {
  return d > 0 ? `${((n / d) * 100).toFixed(1)}%` : '0%';
}

/** Per-variant rate as already-computed `0..1` from the backend. */
function rateLabel(rate: number): string {
  return `${(rate * 100).toFixed(1)}%`;
}

export default function CampaignAbTestPage() {
  const { activeProject } = useProject();
  const projectId = activeProject?._id ? String(activeProject._id) : null;
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  // ---- Form state ----
  const [segments, setSegments] = useState<SegmentRow[]>([]);
  const [name, setName] = useState('');
  const [variantA, setVariantA] = useState(TEMPLATES[0]);
  const [variantB, setVariantB] = useState(TEMPLATES[2]);
  const [split, setSplit] = useState(50);
  const [audience, setAudience] = useState('all');
  const [sending, setSending] = useState(false);

  // ---- List state ----
  const [tests, setTests] = useState<AbTest[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  // ---- Detail (per-variant results) state ----
  const [detailId, setDetailId] = useState<string | null>(null);
  const [detailVariants, setDetailVariants] = useState<VariantResult[] | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const loadSegments = useCallback(() => {
    if (!projectId) return;
    startTransition(async () => {
      const res = await getBroadcastSegments(projectId);
      if (!res.error) setSegments((res.segments ?? []) as SegmentRow[]);
    });
  }, [projectId]);

  const loadTests = useCallback(async () => {
    if (!projectId) {
      setTests([]);
      setListLoading(false);
      return;
    }
    setListLoading(true);
    setListError(null);
    const res = await listAbTests(projectId);
    if (res.error) {
      setListError(res.error);
      setTests([]);
    } else {
      setTests(res.tests ?? []);
    }
    setListLoading(false);
  }, [projectId]);

  useEffect(() => {
    loadSegments();
  }, [loadSegments]);

  useEffect(() => {
    void loadTests();
  }, [loadTests]);

  const loadDetail = useCallback(async (testId: string) => {
    setDetailId(testId);
    setDetailLoading(true);
    setDetailVariants(null);
    const res = await getAbTest(testId);
    setDetailLoading(false);
    if (res.error) {
      toast({ title: 'Error', description: res.error, tone: 'danger' });
      return;
    }
    setDetailVariants(res.variants ?? []);
  }, [toast]);

  const launchTest = () => {
    if (!projectId) {
      toast({
        title: 'No project',
        description: 'Select a project first.',
        tone: 'danger',
      });
      return;
    }
    if (variantA === variantB) {
      toast({
        title: 'Error',
        description: 'Variants must differ.',
        tone: 'danger',
      });
      return;
    }
    const testName = name.trim() || `${variantA} vs ${variantB}`;
    setSending(true);
    void (async () => {
      const res = await createAbTest({
        projectId,
        name: testName,
        variantA: { name: variantA },
        variantB: { name: variantB },
        splitPct: split,
        audience,
        phoneNumberId: null,
      });
      setSending(false);
      if (res.error) {
        toast({ title: 'Error', description: res.error, tone: 'danger' });
        return;
      }
      if (res.warning) {
        toast({ title: 'Test saved', description: res.warning, tone: 'warning' });
      } else {
        toast({
          title: 'Test launched',
          description: res.message ?? 'A/B test launched.',
          tone: 'success',
        });
      }
      setName('');
      await loadTests();
    })();
  };

  const handleStop = async (testId: string) => {
    const res = await stopAbTest(testId);
    if (res.success) {
      toast({ title: 'Test stopped', description: 'No new messages will be queued.', tone: 'neutral' });
      await loadTests();
    } else {
      toast({ title: 'Error', description: res.error ?? 'Could not stop test.', tone: 'danger' });
    }
  };

  const handlePromote = async (testId: string, winner: 'A' | 'B') => {
    const res = await promoteAbTestWinner(testId, winner);
    if (res.success) {
      toast({ title: 'Winner promoted', description: `Variant ${winner} marked as winner.`, tone: 'success' });
      await loadTests();
    } else {
      toast({ title: 'Error', description: res.error ?? 'Could not promote winner.', tone: 'danger' });
    }
  };

  const handleDelete = async (testId: string) => {
    const res = await deleteAbTest(testId);
    if (res.success) {
      toast({ title: 'Test deleted', description: 'The A/B test was removed.', tone: 'neutral' });
      if (detailId === testId) {
        setDetailId(null);
        setDetailVariants(null);
      }
      await loadTests();
    } else {
      toast({ title: 'Error', description: res.error ?? 'Could not delete test.', tone: 'danger' });
    }
  };

  const audienceOptions = React.useMemo(
    () => [
      { value: 'all', label: 'All contacts' },
      ...segments.map((s) => ({ value: String(s._id), label: s.name })),
    ],
    [segments],
  );

  return (
    <WachatPage
      breadcrumb={[
        { label: 'SabNode', href: '/dashboard' },
        { label: 'WaChat', href: '/wachat' },
        { label: 'Campaign A/B Test' },
      ]}
      title="Campaign A/B Test"
      description="Compare two templates to find which performs better."
      width="narrow"
    >
      <div className="flex flex-col gap-6">
        {/* ----------------------------- New test form ----------------------------- */}
        <div className="grid gap-4 sm:grid-cols-2">
          <Card padding="lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <Badge tone="info">A</Badge> Variant A
              </CardTitle>
            </CardHeader>
            <CardBody>
              <Field label="Template A">
                <Select
                  value={variantA}
                  onChange={(v) => v && setVariantA(v)}
                  options={TEMPLATE_OPTIONS}
                  aria-label="Variant A template"
                />
              </Field>
            </CardBody>
          </Card>
          <Card padding="lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <Badge tone="neutral">B</Badge> Variant B
              </CardTitle>
            </CardHeader>
            <CardBody>
              <Field label="Template B">
                <Select
                  value={variantB}
                  onChange={(v) => v && setVariantB(v)}
                  options={TEMPLATE_OPTIONS}
                  aria-label="Variant B template"
                />
              </Field>
            </CardBody>
          </Card>
        </div>

        <Card padding="lg">
          <CardBody>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Test split">
                <div className="flex items-center gap-3">
                  <span className="w-10 text-[12px] tabular-nums text-[var(--st-text-secondary)]">
                    A: {split}%
                  </span>
                  <Slider
                    value={split}
                    onValueChange={(v) =>
                      setSplit(Array.isArray(v) ? v[0] : v)
                    }
                    min={10}
                    max={90}
                    ariaLabel="Variant A traffic share"
                    className="flex-1"
                  />
                  <span className="w-12 text-right text-[12px] tabular-nums text-[var(--st-text-secondary)]">
                    B: {100 - split}%
                  </span>
                </div>
                <div className="ab-split-bar mt-2 flex h-2 w-full overflow-hidden">
                  <div
                    className="transition-all bg-[var(--st-accent)]"
                    style={{ width: `${split}%` }}
                  />
                  <div
                    className="transition-all bg-[var(--st-text-tertiary)]"
                    style={{ width: `${100 - split}%` }}
                  />
                </div>
              </Field>
              <Field label="Audience" help={isPending ? 'Loading segments...' : undefined}>
                <Select
                  value={audience}
                  onChange={(v) => setAudience(v ?? 'all')}
                  options={audienceOptions}
                  aria-label="Audience"
                />
              </Field>
            </div>
          </CardBody>
        </Card>

        <div className="flex items-center gap-2">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="primary"
                iconLeft={Send}
                loading={sending}
                disabled={sending || variantA === variantB || !projectId}
              >
                {sending ? 'Launching test...' : 'Launch A/B test'}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Start A/B test?</AlertDialogTitle>
                <AlertDialogDescription>
                  Variant A ({variantA}) and Variant B ({variantB}) will be sent
                  in a {split}/{100 - split} split to your selected audience.
                  Results populate as delivery and reply webhooks arrive.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction intent="primary" onClick={launchTest}>
                  Start test
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>

        {variantA === variantB && (
          <Alert tone="danger">
            Variants A and B must use different templates.
          </Alert>
        )}

        {/* ----------------------------- Test list ----------------------------- */}
        <Card padding="lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <FlaskConical className="h-4 w-4" aria-hidden="true" /> Your A/B tests
            </CardTitle>
          </CardHeader>
          <CardBody>
            {listLoading ? (
              <div className="flex items-center justify-center py-10">
                <Spinner size="md" />
              </div>
            ) : listError ? (
              <Alert tone="danger">{listError}</Alert>
            ) : tests.length === 0 ? (
              <EmptyState
                icon={FlaskConical}
                title="No A/B tests yet"
                description="Pick two templates above and launch your first split test."
              />
            ) : (
              <div className="flex flex-col gap-3">
                {tests.map((t) => {
                  const summary = t.summary;
                  const totalSent = summary?.totalSent ?? 0;
                  const isOpen = detailId === t._id;
                  return (
                    <div
                      key={t._id}
                      className="ab-test-row rounded-[var(--st-radius-md)] border border-[var(--st-border)] p-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{t.name}</span>
                          <Badge tone={statusTone(t.status)}>{t.status}</Badge>
                          {t.winnerVariant && (
                            <Badge tone="success">Winner: {t.winnerVariant}</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[12px] tabular-nums text-[var(--st-text-secondary)]">
                            {totalSent} sent
                          </span>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => (isOpen ? setDetailId(null) : void loadDetail(t._id))}
                          >
                            {isOpen ? 'Hide results' : 'View results'}
                          </Button>
                        </div>
                      </div>

                      <div className="mt-1 text-[12px] text-[var(--st-text-tertiary)]">
                        {t.variantA.name} ({t.splitPct}%) vs {t.variantB.name} ({100 - t.splitPct}%)
                      </div>

                      {/* Per-variant detail */}
                      {isOpen && (
                        <div className="mt-3">
                          {detailLoading ? (
                            <div className="flex items-center justify-center py-6">
                              <Spinner size="sm" />
                            </div>
                          ) : detailVariants && detailVariants.length > 0 ? (
                            <div className="grid gap-3 sm:grid-cols-2">
                              {detailVariants.map((v) => {
                                const templateName =
                                  v.variant === 'A' ? t.variantA.name : t.variantB.name;
                                const launched = v.broadcastId !== null;
                                return (
                                  <Card key={v.variant} variant="outlined" padding="md">
                                    <CardHeader>
                                      <CardTitle className="flex items-center justify-between text-sm">
                                        <span className="flex items-center gap-2">
                                          Variant {v.variant}: {templateName}
                                          {!launched && (
                                            <Badge tone="neutral">Not launched</Badge>
                                          )}
                                        </span>
                                        {t.winnerVariant === v.variant && (
                                          <Badge tone="success">Winner</Badge>
                                        )}
                                      </CardTitle>
                                    </CardHeader>
                                    <CardBody>
                                      {!launched ? (
                                        <Alert tone="info">
                                          Not launched yet — no broadcast is linked to
                                          this variant, so there are no metrics to show.
                                        </Alert>
                                      ) : (
                                        <div className="flex flex-col gap-3">
                                          <div className="grid grid-cols-2 gap-2">
                                            <StatCard label="Sent" value={v.sent} />
                                            <StatCard label="Delivered" value={v.delivered} />
                                            <StatCard label="Read" value={v.read} />
                                            <StatCard label="Failed" value={v.failed} />
                                          </div>
                                          <div className="grid grid-cols-2 gap-2">
                                            <StatCard
                                              label="Open rate"
                                              value={v.sent > 0 ? rateLabel(v.openRate) : pct(0, 0)}
                                            />
                                            <StatCard
                                              label="Reply rate"
                                              value={v.sent > 0 ? rateLabel(v.replyRate) : pct(0, 0)}
                                            />
                                          </div>
                                        </div>
                                      )}
                                    </CardBody>
                                  </Card>
                                );
                              })}
                            </div>
                          ) : (
                            <Alert tone="info">
                              No results yet. Metrics appear as delivery and reply
                              webhooks arrive.
                            </Alert>
                          )}
                        </div>
                      )}

                      {/* Row actions */}
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        {t.status === 'running' && (
                          <>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="outline" size="sm" iconLeft={Square}>
                                  Stop
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Stop the test?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    In-flight messages cannot be unsent, but no new
                                    messages will be queued.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Keep running</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => void handleStop(t._id)}>
                                    Stop test
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>

                            <Button
                              variant="outline"
                              size="sm"
                              iconLeft={Trophy}
                              onClick={() => void handlePromote(t._id, 'A')}
                            >
                              Promote A
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              iconLeft={Trophy}
                              onClick={() => void handlePromote(t._id, 'B')}
                            >
                              Promote B
                            </Button>
                          </>
                        )}

                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="sm" iconLeft={Trash2}>
                              Delete
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete this A/B test?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This permanently removes the test and its recorded
                                results. This cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction intent="danger" onClick={() => void handleDelete(t._id)}>
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardBody>
        </Card>

        <div className="flex items-center gap-2 text-[12px] text-[var(--st-text-tertiary)]">
          <ChartBar className="h-3.5 w-3.5" aria-hidden="true" />
          Results update from delivery and reply webhooks; rates stay at 0% until they arrive.
        </div>
      </div>
    </WachatPage>
  );
}
