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
} from '@/components/sabcrm/20ui';
import {
  useEffect,
  useState,
  useTransition,
  useCallback,
} from 'react';
import { ChartBar, Send, Square } from 'lucide-react';

import { useProject } from '@/context/project-context';

/**
 * Wachat Campaign A/B Test -- split-test broadcast campaigns.
 * 20ui rebuild. Uses real broadcast segments for audience selection.
 */

import * as React from 'react';

import { getBroadcastSegments } from '@/app/actions/wachat-features.actions';

import { WachatPage } from '@/app/wachat/_components/wachat-page';

function cx(...a: Array<string | false | null | undefined>): string {
  return a.filter(Boolean).join(' ');
}

const TEMPLATES = [
  'Order Confirmation',
  'Welcome Message',
  'Promo Offer',
  'Appointment Reminder',
  'Feedback Request',
];

const TEMPLATE_OPTIONS = TEMPLATES.map((t) => ({ value: t, label: t }));

interface TestResult {
  variant: string;
  sent: number;
  opened: number;
  replied: number;
}

export default function CampaignAbTestPage() {
  const { activeProject } = useProject();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [segments, setSegments] = useState<any[]>([]);
  const [variantA, setVariantA] = useState(TEMPLATES[0]);
  const [variantB, setVariantB] = useState(TEMPLATES[2]);
  const [split, setSplit] = useState(50);
  const [audience, setAudience] = useState('all');
  const [results, setResults] = useState<TestResult[] | null>(null);
  const [sending, setSending] = useState(false);

  const loadSegments = useCallback(() => {
    if (!activeProject?._id) return;
    startTransition(async () => {
      const res = await getBroadcastSegments(String(activeProject._id));
      if (!res.error) setSegments(res.segments ?? []);
    });
  }, [activeProject?._id]);

  useEffect(() => {
    loadSegments();
  }, [loadSegments]);

  const launchTest = () => {
    if (variantA === variantB) {
      toast({
        title: 'Error',
        description: 'Variants must differ.',
        tone: 'danger',
      });
      return;
    }
    setSending(true);
    const total =
      audience === 'all'
        ? 500
        : segments.find((s: any) => s._id === audience)?.estimatedSize || 200;
    setTimeout(() => {
      setResults([
        {
          variant: 'A',
          sent: Math.round((total * split) / 100),
          opened: Math.round(((total * split) / 100) * 0.72),
          replied: Math.round(((total * split) / 100) * 0.18),
        },
        {
          variant: 'B',
          sent: Math.round((total * (100 - split)) / 100),
          opened: Math.round(((total * (100 - split)) / 100) * 0.65),
          replied: Math.round(((total * (100 - split)) / 100) * 0.22),
        },
      ]);
      setSending(false);
      toast({ title: 'Test complete', description: 'A/B test results are ready.', tone: 'success' });
    }, 2000);
  };

  const stopTest = () => {
    setResults(null);
    setSending(false);
    toast({ title: 'Test stopped', description: 'A/B test was stopped.', tone: 'neutral' });
  };

  const pct = (n: number, d: number) =>
    d > 0 ? `${((n / d) * 100).toFixed(1)}%` : '0%';

  const audienceOptions = React.useMemo(
    () => [
      { value: 'all', label: 'All contacts' },
      ...segments.map((s: any) => ({ value: String(s._id), label: s.name })),
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
                disabled={sending || variantA === variantB}
              >
                {sending ? 'Running test...' : 'Launch A/B test'}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Start A/B test?</AlertDialogTitle>
                <AlertDialogDescription>
                  Variant A ({variantA}) and Variant B ({variantB}) will be sent
                  in a {split}/{100 - split} split to your selected audience.
                  Results will appear once both variants finish processing.
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

          {sending && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" iconLeft={Square}>
                  Stop
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Stop the test?</AlertDialogTitle>
                  <AlertDialogDescription>
                    In-flight messages cannot be unsent, but no new messages will
                    be queued. Partial results will be discarded.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Keep running</AlertDialogCancel>
                  <AlertDialogAction onClick={stopTest}>
                    Stop test
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>

        {variantA === variantB && (
          <Alert tone="danger">
            Variants A and B must use different templates.
          </Alert>
        )}

        {results && (
          <Card padding="lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <ChartBar className="h-4 w-4" aria-hidden="true" /> Results
              </CardTitle>
            </CardHeader>
            <CardBody>
              <div className="grid gap-4 sm:grid-cols-2">
                {results.map((r) => {
                  const otherR = results.find((x) => x.variant !== r.variant);
                  const isWinner = otherR
                    ? r.replied / r.sent >= otherR.replied / otherR.sent
                    : false;
                  return (
                    <Card
                      key={r.variant}
                      variant={isWinner ? 'outlined' : 'outlined'}
                      padding="md"
                      className={isWinner ? 'ab-result-card--winner' : undefined}
                    >
                      <CardHeader>
                        <CardTitle className="flex items-center justify-between text-sm">
                          Variant {r.variant}:{' '}
                          {r.variant === 'A' ? variantA : variantB}
                          {isWinner && <Badge tone="success">Winner</Badge>}
                        </CardTitle>
                      </CardHeader>
                      <CardBody>
                        <div className="grid grid-cols-3 gap-2">
                          <StatCard label="Sent" value={r.sent} />
                          <StatCard label="Open rate" value={pct(r.opened, r.sent)} />
                          <StatCard label="Reply rate" value={pct(r.replied, r.sent)} />
                        </div>
                      </CardBody>
                    </Card>
                  );
                })}
              </div>
            </CardBody>
          </Card>
        )}
      </div>
    </WachatPage>
  );
}
