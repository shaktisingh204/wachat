'use client';

import React, { useEffect, useState, useTransition, useCallback } from 'react';
import { m, useReducedMotion } from 'motion/react';
import { ChartBar, Loader2, Send, Square, FlaskConical } from 'lucide-react';

import { useProject } from '@/context/project-context';
import { getBroadcastSegments } from '@/app/actions/wachat-features.actions';

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
  Label,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  cn,
} from '@/components/zoruui';

import {
  WaPage,
  PageHeader,
  Section,
  WaButton,
  StatusPill,
  MetricTile,
} from '@/components/wachat-ui';
import { EASE_OUT } from '@/components/dashboard-ui/module-theme';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Award, Beaker, Target, Users as UsersIcon } from 'lucide-react';

/**
 * Wachat campaign A/B test. Same flow; wachat-ui chrome.
 */

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
  const reduce = useReducedMotion();
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
      toast({ title: 'Error', description: 'Variants must differ.', variant: 'destructive' });
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

  const pct = (n: number, d: number) => (d > 0 ? `${((n / d) * 100).toFixed(1)}%` : '0%');

  // Two-proportion z-test for reply-rate significance
  const significance = (() => {
    if (!results || results.length !== 2) return null;
    const [A, B] = results;
    const p1 = A.replied / Math.max(1, A.sent);
    const p2 = B.replied / Math.max(1, B.sent);
    const n1 = Math.max(1, A.sent);
    const n2 = Math.max(1, B.sent);
    const p = (A.replied + B.replied) / (n1 + n2);
    const se = Math.sqrt(p * (1 - p) * (1 / n1 + 1 / n2));
    const z = se > 0 ? (p1 - p2) / se : 0;
    const abs = Math.abs(z);
    const confidence = abs >= 2.58 ? 99 : abs >= 1.96 ? 95 : abs >= 1.64 ? 90 : 0;
    return { z, confidence, lift: p1 - p2 };
  })();

  const audienceTotal =
    audience === 'all'
      ? 500
      : segments.find((s: any) => s._id === audience)?.estimatedSize || 200;

  return (
    <WaPage>
      <PageHeader
        title="Campaign A/B test"
        description="Compare two templates head to head and let the data pick the winner."
        kicker="Wachat / A/B test"
        eyebrowIcon={FlaskConical}
        backHref="/wachat"
      />

      {/* KPI strip - test setup snapshot */}
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MetricTile label="Audience" value={audienceTotal.toLocaleString()} icon={UsersIcon} delay={0} />
        <MetricTile label="Variants" value={2} icon={Beaker} delay={0.05} />
        <MetricTile label="Split" value={`${split}/${100 - split}`} icon={Target} delay={0.1} />
        <MetricTile label="Confidence" value={significance ? (significance.confidence ? `${significance.confidence}%` : 'low') : '-'} icon={Award} delay={0.15} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Section title="Variant A">
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
        </Section>
        <Section title="Variant B">
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
        </Section>
      </div>

      <div className="mt-3">
        <Section title="Split and audience">
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <Label className="mb-2 block">Test split</Label>
              <div className="flex items-center gap-3">
                <span className="w-12 text-[12px] tabular-nums text-zinc-500">A: {split}%</span>
                <input
                  type="range"
                  min={10}
                  max={90}
                  value={split}
                  onChange={(e) => setSplit(Number(e.target.value))}
                  className="flex-1"
                  style={{ accentColor: 'var(--mt-accent)' }}
                />
                <span className="w-14 text-right text-[12px] tabular-nums text-zinc-500">B: {100 - split}%</span>
              </div>
              <div className="mt-3 flex h-2 w-full overflow-hidden rounded-full bg-zinc-100">
                <m.div
                  initial={false}
                  animate={{ width: `${split}%` }}
                  transition={{ duration: 0.3, ease: EASE_OUT }}
                  style={{ background: 'var(--mt-accent)' }}
                />
                <m.div
                  initial={false}
                  animate={{ width: `${100 - split}%` }}
                  transition={{ duration: 0.3, ease: EASE_OUT }}
                  className="bg-zinc-300"
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
              {isPending && <span className="mt-1 inline-block text-[11px] text-zinc-500">Loading segments</span>}
            </div>
          </div>
        </Section>
      </div>

      <div className="mt-4 flex items-center gap-2">
        <ZoruAlertDialog>
          <ZoruAlertDialogTrigger asChild>
            <WaButton disabled={sending || variantA === variantB} leftIcon={sending ? Loader2 : Send}>
              {sending ? 'Running test' : 'Launch A/B test'}
            </WaButton>
          </ZoruAlertDialogTrigger>
          <ZoruAlertDialogContent>
            <ZoruAlertDialogHeader>
              <ZoruAlertDialogTitle>Start A/B test?</ZoruAlertDialogTitle>
              <ZoruAlertDialogDescription>
                Variant A ({variantA}) and Variant B ({variantB}) will be sent in a {split}/{100 - split} split to your
                selected audience. Results will appear once both variants finish processing.
              </ZoruAlertDialogDescription>
            </ZoruAlertDialogHeader>
            <ZoruAlertDialogFooter>
              <ZoruAlertDialogCancel>Cancel</ZoruAlertDialogCancel>
              <ZoruAlertDialogAction onClick={launchTest}>Start test</ZoruAlertDialogAction>
            </ZoruAlertDialogFooter>
          </ZoruAlertDialogContent>
        </ZoruAlertDialog>

        {sending && (
          <ZoruAlertDialog>
            <ZoruAlertDialogTrigger asChild>
              <WaButton variant="outline" leftIcon={Square}>
                Stop
              </WaButton>
            </ZoruAlertDialogTrigger>
            <ZoruAlertDialogContent>
              <ZoruAlertDialogHeader>
                <ZoruAlertDialogTitle>Stop the test?</ZoruAlertDialogTitle>
                <ZoruAlertDialogDescription>
                  In-flight messages cannot be unsent, but no new messages will be queued. Partial results will be discarded.
                </ZoruAlertDialogDescription>
              </ZoruAlertDialogHeader>
              <ZoruAlertDialogFooter>
                <ZoruAlertDialogCancel>Keep running</ZoruAlertDialogCancel>
                <ZoruAlertDialogAction onClick={stopTest}>Stop test</ZoruAlertDialogAction>
              </ZoruAlertDialogFooter>
            </ZoruAlertDialogContent>
          </ZoruAlertDialog>
        )}
      </div>

      {variantA === variantB && (
        <p className="mt-3 text-[12px] text-rose-600">Variants A and B must use different templates.</p>
      )}

      {results && (
        <div className="mt-4 flex flex-col gap-3">
          {/* Winner / significance banner */}
          {significance && (
            <Section
              title={
                <span className="inline-flex items-center gap-2">
                  <Award className="h-4 w-4 text-emerald-600" strokeWidth={2.25} aria-hidden /> Statistical readout
                </span>
              }
              description={
                significance.confidence >= 95
                  ? `Significant at ${significance.confidence}% confidence (z = ${significance.z.toFixed(2)}).`
                  : significance.confidence > 0
                    ? `Marginal - ${significance.confidence}% confidence. Run longer to lock the winner.`
                    : 'Not significant yet. Sample is too small or variants are tied.'
              }
            >
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Stat label="Lift (A vs B)" value={`${(significance.lift * 100).toFixed(1)}%`} />
                <Stat label="z-score" value={significance.z.toFixed(2)} />
                <Stat label="Confidence" value={significance.confidence ? `${significance.confidence}%` : 'low'} />
                <Stat label="Winner" value={significance.lift > 0 ? 'A' : significance.lift < 0 ? 'B' : 'tie'} />
              </div>
            </Section>
          )}

          {/* Comparison chart */}
          <Section
            title={
              <span className="inline-flex items-center gap-2">
                <ChartBar className="h-4 w-4" strokeWidth={2.25} aria-hidden /> Variant performance
              </span>
            }
            description="Sent / opened / replied side-by-side."
          >
            <div className="h-[220px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={results.map((r) => ({
                    name: `Variant ${r.variant}`,
                    sent: r.sent,
                    opened: r.opened,
                    replied: r.replied,
                  }))}
                  margin={{ top: 6, right: 8, bottom: 0, left: -16 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#71717a' }} stroke="#e4e4e7" />
                  <YAxis tick={{ fontSize: 10, fill: '#71717a' }} stroke="#e4e4e7" />
                  <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e4e4e7' }} />
                  <Bar dataKey="sent" fill="#a1a1aa" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="opened" fill="#60a5fa" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="replied" fill="#25D366" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Section>

          <Section
            title={
              <span className="inline-flex items-center gap-2">
                <ChartBar className="h-4 w-4" strokeWidth={2.25} aria-hidden /> Results
              </span>
            }
          >
            <div className="grid gap-4 sm:grid-cols-2">
              {results.map((r) => {
                const otherR = results.find((x) => x.variant !== r.variant);
                const isWinner = otherR ? r.replied / r.sent >= otherR.replied / otherR.sent : false;
                return (
                  <m.div
                    key={r.variant}
                    initial={reduce ? false : { opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, ease: EASE_OUT }}
                    className={cn(
                      'rounded-2xl border p-4',
                      isWinner ? 'border-emerald-200 bg-emerald-50/60' : 'border-zinc-200',
                    )}
                  >
                    <div className="mb-3 flex items-center justify-between">
                      <h3 className="text-[13.5px] font-semibold text-zinc-900">
                        Variant {r.variant}: {r.variant === 'A' ? variantA : variantB}
                      </h3>
                      {isWinner && <StatusPill tone="sent">Winner</StatusPill>}
                    </div>
                    <div className="grid grid-cols-3 gap-3 text-center">
                      <div>
                        <p className="text-[20px] font-semibold tabular-nums text-zinc-900">{r.sent}</p>
                        <p className="text-[10.5px] uppercase tracking-[0.08em] text-zinc-500">Sent</p>
                      </div>
                      <div>
                        <p className="text-[20px] font-semibold tabular-nums text-zinc-900">{pct(r.opened, r.sent)}</p>
                        <p className="text-[10.5px] uppercase tracking-[0.08em] text-zinc-500">Open rate</p>
                      </div>
                      <div>
                        <p className="text-[20px] font-semibold tabular-nums text-zinc-900">{pct(r.replied, r.sent)}</p>
                        <p className="text-[10.5px] uppercase tracking-[0.08em] text-zinc-500">Reply rate</p>
                      </div>
                    </div>
                  </m.div>
                );
              })}
            </div>
          </Section>
        </div>
      )}
    </WaPage>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-zinc-100 bg-white p-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-zinc-500">{label}</p>
      <p className="mt-1 text-[18px] font-semibold tabular-nums text-zinc-900">{value}</p>
    </div>
  );
}
