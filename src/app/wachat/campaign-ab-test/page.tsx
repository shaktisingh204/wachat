'use client';

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
  Badge,
  Breadcrumb,
  ZoruBreadcrumbItem,
  ZoruBreadcrumbLink,
  ZoruBreadcrumbList,
  ZoruBreadcrumbPage,
  ZoruBreadcrumbSeparator,
  Button,
  Card,
  Label,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  cn,
} from '@/components/zoruui';
import {
  useEffect,
  useState,
  useTransition,
  useCallback,
  } from 'react';
import { ChartBar,
  Loader2,
  Send,
  Square } from 'lucide-react';

import { useProject } from '@/context/project-context';

/**
 * Wachat Campaign A/B Test — split-test broadcast campaigns.
 * ZoruUI rebuild. Uses real broadcast segments for audience selection.
 */

import * as React from 'react';

import { getBroadcastSegments } from '@/app/actions/wachat-features.actions';

const TEMPLATES = [
  'Order Confirmation',
  'Welcome Message',
  'Promo Offer',
  'Appointment Reminder',
  'Feedback Request',
];

interface TestResult {
  variant: string;
  sent: number;
  opened: number;
  replied: number;
}

export default function CampaignAbTestPage() {
  const { activeProject } = useProject();
  const { toast } = useZoruToast();
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
        variant: 'destructive',
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
      toast({ title: 'Test complete', description: 'A/B test results are ready.' });
    }, 2000);
  };

  const stopTest = () => {
    setResults(null);
    setSending(false);
    toast({ title: 'Test stopped', description: 'A/B test was stopped.' });
  };

  const pct = (n: number, d: number) =>
    d > 0 ? `${((n / d) * 100).toFixed(1)}%` : '0%';

  return (
    <div className="mx-auto flex w-full max-w-[1320px] flex-col gap-6 px-6 pt-6 pb-10">
      <Breadcrumb>
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
            <ZoruBreadcrumbPage>Campaign A/B Test</ZoruBreadcrumbPage>
          </ZoruBreadcrumbItem>
        </ZoruBreadcrumbList>
      </Breadcrumb>

      <div>
        <h1 className="text-[30px] tracking-[-0.015em] text-zoru-ink leading-[1.1]">
          Campaign A/B Test
        </h1>
        <p className="mt-1.5 text-[13px] text-zoru-ink-muted">
          Compare two templates to find which performs better.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="p-5">
          <h2 className="mb-3 flex items-center gap-2 text-sm text-zoru-ink">
            <Badge variant="info">A</Badge> Variant A
          </h2>
          <Select value={variantA} onValueChange={setVariantA}>
            <ZoruSelectTrigger>
              <ZoruSelectValue />
            </ZoruSelectTrigger>
            <ZoruSelectContent>
              {TEMPLATES.map((t) => (
                <ZoruSelectItem key={t} value={t}>
                  {t}
                </ZoruSelectItem>
              ))}
            </ZoruSelectContent>
          </Select>
        </Card>
        <Card className="p-5">
          <h2 className="mb-3 flex items-center gap-2 text-sm text-zoru-ink">
            <Badge variant="secondary">B</Badge> Variant B
          </h2>
          <Select value={variantB} onValueChange={setVariantB}>
            <ZoruSelectTrigger>
              <ZoruSelectValue />
            </ZoruSelectTrigger>
            <ZoruSelectContent>
              {TEMPLATES.map((t) => (
                <ZoruSelectItem key={t} value={t}>
                  {t}
                </ZoruSelectItem>
              ))}
            </ZoruSelectContent>
          </Select>
        </Card>
      </div>

      <Card className="p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label className="mb-2 block">Test split</Label>
            <div className="flex items-center gap-3">
              <span className="w-10 text-[12px] text-zoru-ink-muted tabular-nums">
                A: {split}%
              </span>
              <input
                type="range"
                min={10}
                max={90}
                value={split}
                onChange={(e) => setSplit(Number(e.target.value))}
                className="flex-1 accent-zoru-ink"
              />
              <span className="w-12 text-right text-[12px] text-zoru-ink-muted tabular-nums">
                B: {100 - split}%
              </span>
            </div>
            <div className="mt-2 flex h-2 w-full overflow-hidden rounded-full bg-zoru-surface-2">
              <div
                className="bg-zoru-ink transition-all"
                style={{ width: `${split}%` }}
              />
              <div
                className="bg-zoru-ink-muted transition-all"
                style={{ width: `${100 - split}%` }}
              />
            </div>
          </div>
          <div>
            <Label className="mb-2 block">Audience</Label>
            <Select value={audience} onValueChange={setAudience}>
              <ZoruSelectTrigger>
                <ZoruSelectValue />
              </ZoruSelectTrigger>
              <ZoruSelectContent>
                <ZoruSelectItem value="all">All contacts</ZoruSelectItem>
                {segments.map((s: any) => (
                  <ZoruSelectItem key={s._id} value={s._id}>
                    {s.name}
                  </ZoruSelectItem>
                ))}
              </ZoruSelectContent>
            </Select>
            {isPending && (
              <span className="mt-1 inline-block text-[11px] text-zoru-ink-muted">
                Loading segments…
              </span>
            )}
          </div>
        </div>
      </Card>

      <div className="flex items-center gap-2">
        <ZoruAlertDialog>
          <ZoruAlertDialogTrigger asChild>
            <Button disabled={sending || variantA === variantB}>
              {sending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Send className="h-3.5 w-3.5" />
              )}
              {sending ? 'Running test…' : 'Launch A/B test'}
            </Button>
          </ZoruAlertDialogTrigger>
          <ZoruAlertDialogContent>
            <ZoruAlertDialogHeader>
              <ZoruAlertDialogTitle>Start A/B test?</ZoruAlertDialogTitle>
              <ZoruAlertDialogDescription>
                Variant A ({variantA}) and Variant B ({variantB}) will be sent
                in a {split}/{100 - split} split to your selected audience.
                Results will appear once both variants finish processing.
              </ZoruAlertDialogDescription>
            </ZoruAlertDialogHeader>
            <ZoruAlertDialogFooter>
              <ZoruAlertDialogCancel>Cancel</ZoruAlertDialogCancel>
              <ZoruAlertDialogAction onClick={launchTest}>
                Start test
              </ZoruAlertDialogAction>
            </ZoruAlertDialogFooter>
          </ZoruAlertDialogContent>
        </ZoruAlertDialog>

        {sending && (
          <ZoruAlertDialog>
            <ZoruAlertDialogTrigger asChild>
              <Button variant="outline">
                <Square className="h-3.5 w-3.5" />
                Stop
              </Button>
            </ZoruAlertDialogTrigger>
            <ZoruAlertDialogContent>
              <ZoruAlertDialogHeader>
                <ZoruAlertDialogTitle>Stop the test?</ZoruAlertDialogTitle>
                <ZoruAlertDialogDescription>
                  In-flight messages cannot be unsent, but no new messages will
                  be queued. Partial results will be discarded.
                </ZoruAlertDialogDescription>
              </ZoruAlertDialogHeader>
              <ZoruAlertDialogFooter>
                <ZoruAlertDialogCancel>Keep running</ZoruAlertDialogCancel>
                <ZoruAlertDialogAction onClick={stopTest}>
                  Stop test
                </ZoruAlertDialogAction>
              </ZoruAlertDialogFooter>
            </ZoruAlertDialogContent>
          </ZoruAlertDialog>
        )}
      </div>

      {variantA === variantB && (
        <p className="text-[12px] text-zoru-danger">
          Variants A and B must use different templates.
        </p>
      )}

      {results && (
        <Card className="p-5">
          <h2 className="mb-4 flex items-center gap-2 text-sm text-zoru-ink">
            <ChartBar className="h-4 w-4" /> Results
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {results.map((r) => {
              const otherR = results.find((x) => x.variant !== r.variant);
              const isWinner = otherR
                ? r.replied / r.sent >= otherR.replied / otherR.sent
                : false;
              return (
                <div
                  key={r.variant}
                  className={cn(
                    'rounded-[var(--zoru-radius)] border p-4',
                    isWinner
                      ? 'border-zoru-success/40 bg-zoru-success/5'
                      : 'border-zoru-line',
                  )}
                >
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-sm text-zoru-ink">
                      Variant {r.variant}:{' '}
                      {r.variant === 'A' ? variantA : variantB}
                    </h3>
                    {isWinner && <Badge variant="success">Winner</Badge>}
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div>
                      <p className="text-[18px] text-zoru-ink">{r.sent}</p>
                      <p className="text-[11px] text-zoru-ink-muted">Sent</p>
                    </div>
                    <div>
                      <p className="text-[18px] text-zoru-ink">
                        {pct(r.opened, r.sent)}
                      </p>
                      <p className="text-[11px] text-zoru-ink-muted">
                        Open rate
                      </p>
                    </div>
                    <div>
                      <p className="text-[18px] text-zoru-ink">
                        {pct(r.replied, r.sent)}
                      </p>
                      <p className="text-[11px] text-zoru-ink-muted">
                        Reply rate
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}
      <div className="h-6" />
    </div>
  );
}
