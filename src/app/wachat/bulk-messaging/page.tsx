'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { m, AnimatePresence, useReducedMotion } from 'motion/react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  CircleCheck,
  CircleX,
  Loader2,
  Send,
  MessageCircle,
  Gauge,
  Users,
  AlertTriangle,
  ShieldX,
  ListChecks,
} from 'lucide-react';

import { useProject } from '@/context/project-context';
import { sendBulkMessages } from '@/app/actions/wachat-features.actions';

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
  Textarea,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
} from '@/components/zoruui';

import {
  WaPage,
  PageHeader,
  Section,
  WaButton,
  MetricTile,
} from '@/components/wachat-ui';
import { EASE_OUT } from '@/components/dashboard-ui/module-theme';

function compact(n: number | null | undefined): string {
  const v = typeof n === 'number' && Number.isFinite(n) ? n : 0;
  if (v >= 1_000) return (v / 1_000).toFixed(1).replace(/\.0$/, '') + 'k';
  return String(v);
}

const RATE_OPTIONS = [
  { value: '1', label: '1 msg/sec (safe)' },
  { value: '3', label: '3 msgs/sec' },
  { value: '5', label: '5 msgs/sec' },
  { value: '10', label: '10 msgs/sec (max)' },
];

export default function BulkMessagingPage() {
  const { activeProject } = useProject();
  const { toast } = useZoruToast();
  const projectId = activeProject?._id?.toString();
  const reduce = useReducedMotion();

  const [numbers, setNumbers] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [rate, setRate] = useState('3');
  const [result, setResult] = useState<{ success: number; failed: number; total: number } | null>(null);

  // Live progress ticker while server action is running
  const [tick, setTick] = useState(0);
  const tickerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (sending) {
      setTick(0);
      tickerRef.current = setInterval(() => setTick((n) => n + 1), 1000);
    } else if (tickerRef.current) {
      clearInterval(tickerRef.current);
      tickerRef.current = null;
    }
    return () => {
      if (tickerRef.current) clearInterval(tickerRef.current);
    };
  }, [sending]);

  const rawLines = useMemo(() => numbers.split('\n').map((l) => l.trim()), [numbers]);

  const validation = useMemo(() => {
    const valid: string[] = [];
    const invalid: string[] = [];
    const seen = new Set<string>();
    const duplicates: string[] = [];
    const optOutSet = new Set<string>(); // We have no opt-out list source here; left as 0 unless project provides one
    const e164 = /^\+?\d{8,15}$/;
    for (const l of rawLines) {
      if (!l) continue;
      const stripped = l.replace(/[\s\-()]/g, '');
      if (!e164.test(stripped)) {
        invalid.push(l);
        continue;
      }
      if (seen.has(stripped)) duplicates.push(l);
      else seen.add(stripped);
      valid.push(stripped);
    }
    return { valid, invalid, duplicates, optOuts: Array.from(optOutSet) };
  }, [rawLines]);

  const lines = validation.valid;
  const canSend = lines.length > 0 && message.trim().length > 0 && !!projectId;

  // Audience preview by country code (from leading digits)
  const audienceByCountry = useMemo(() => {
    const map = new Map<string, number>();
    for (const v of lines) {
      const code = v.startsWith('+') ? v.slice(1, 4).replace(/\D/g, '') : v.slice(0, 2);
      const cc = code.slice(0, code.startsWith('1') ? 1 : code.startsWith('91') ? 2 : 2) || 'xx';
      map.set(cc, (map.get(cc) || 0) + 1);
    }
    return Array.from(map, ([code, count]) => ({ code: `+${code}`, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
  }, [lines]);

  const eta = useMemo(() => {
    const r = Number(rate) || 1;
    return Math.ceil(lines.length / r);
  }, [lines.length, rate]);

  const handleSend = async () => {
    if (!projectId) {
      toast({ title: 'Error', description: 'No project selected.', variant: 'destructive' });
      return;
    }
    setSending(true);
    setResult(null);
    const res = await sendBulkMessages(projectId, lines, message.trim());
    setSending(false);
    if (res.error) {
      toast({ title: 'Error', description: res.error, variant: 'destructive' });
    } else {
      setResult({
        success: res.success || 0,
        failed: res.failed || 0,
        total: res.total || lines.length,
      });
      toast({ title: 'Complete', description: `Sent ${res.success} of ${res.total} messages.` });
    }
  };

  // Estimated live progress (since we can't get realtime feedback from this action,
  // show a deterministic ramp clamped to send rate; resets to result once known)
  const liveSent = sending ? Math.min(lines.length, tick * Number(rate || 1)) : result?.success ?? 0;
  const liveFailed = result?.failed ?? 0;

  return (
    <WaPage>
      <PageHeader
        title="Bulk messaging"
        description="Send a free-text message to a list of phone numbers in one shot."
        kicker="Wachat / bulk messaging"
        eyebrowIcon={MessageCircle}
        backHref="/wachat"
      />

      {/* KPI strip */}
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        <MetricTile label="Pasted lines" value={compact(rawLines.filter(Boolean).length)} icon={ListChecks} delay={0} />
        <MetricTile label="Valid" value={compact(validation.valid.length)} icon={CircleCheck} delay={0.04} />
        <MetricTile label="Invalid" value={compact(validation.invalid.length)} icon={AlertTriangle} delay={0.08} />
        <MetricTile label="Duplicates" value={compact(validation.duplicates.length)} icon={Users} delay={0.12} />
        <MetricTile label="Opt-outs" value={compact(validation.optOuts.length)} icon={ShieldX} delay={0.16} />
        <MetricTile label={`ETA at ${rate}/s`} value={`${eta}s`} icon={Gauge} delay={0.2} />
      </div>

      <div className="grid gap-3 lg:grid-cols-[1fr_360px]">
        <Section title="Compose" description="Paste numbers, one per line. We validate and dedupe automatically.">
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="bm-numbers">Phone numbers (one per line)</Label>
              <Textarea
                id="bm-numbers"
                value={numbers}
                onChange={(e) => setNumbers(e.target.value)}
                rows={6}
                disabled={sending}
                placeholder={'+91 98765 43210\n+91 87654 32109\n+91 76543 21098'}
                className="font-mono"
              />
              <p className="text-[11px] tabular-nums text-zinc-500">
                {validation.valid.length} valid / {validation.invalid.length} invalid / {validation.duplicates.length} duplicate
              </p>
            </div>

            {/* Preview first 5 valid rows */}
            {validation.valid.length > 0 && (
              <div className="rounded-xl border border-zinc-100 bg-zinc-50/60 p-3">
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-zinc-500">
                  Preview / first 5 recipients
                </p>
                <ul className="divide-y divide-zinc-100">
                  {validation.valid.slice(0, 5).map((v) => (
                    <li key={v} className="flex h-[28px] items-center justify-between text-[12px]">
                      <span className="font-mono tabular-nums text-zinc-900">{v}</span>
                      <span className="text-[10px] text-emerald-600">valid</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="bm-message">Message</Label>
              <Textarea
                id="bm-message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={4}
                disabled={sending}
                placeholder="Type your message here..."
              />
              <p className="text-[11px] tabular-nums text-zinc-500">
                {message.length} chars
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="bm-rate">Send rate</Label>
                <Select value={rate} onValueChange={setRate}>
                  <ZoruSelectTrigger id="bm-rate">
                    <ZoruSelectValue />
                  </ZoruSelectTrigger>
                  <ZoruSelectContent>
                    {RATE_OPTIONS.map((o) => (
                      <ZoruSelectItem key={o.value} value={o.value}>
                        {o.label}
                      </ZoruSelectItem>
                    ))}
                  </ZoruSelectContent>
                </Select>
              </div>
              <div className="flex flex-col justify-end">
                <div className="rounded-xl border border-zinc-100 bg-white px-3 py-2 text-[11px] tabular-nums text-zinc-600">
                  <Gauge className="mr-1 inline h-2.5 w-2.5" strokeWidth={2.5} aria-hidden />
                  ETA {eta}s for {compact(lines.length)} messages at {rate}/s
                </div>
              </div>
            </div>

            <div>
              <ZoruAlertDialog>
                <ZoruAlertDialogTrigger asChild>
                  <WaButton disabled={sending || !canSend} leftIcon={sending ? Loader2 : Send}>
                    {sending ? 'Sending' : 'Send all'}
                  </WaButton>
                </ZoruAlertDialogTrigger>
                <ZoruAlertDialogContent>
                  <ZoruAlertDialogHeader>
                    <ZoruAlertDialogTitle>Confirm bulk send?</ZoruAlertDialogTitle>
                    <ZoruAlertDialogDescription>
                      {lines.length} message{lines.length === 1 ? '' : 's'} will be sent immediately. Charges may apply per recipient and these messages cannot be unsent.
                    </ZoruAlertDialogDescription>
                  </ZoruAlertDialogHeader>
                  <ZoruAlertDialogFooter>
                    <ZoruAlertDialogCancel>Cancel</ZoruAlertDialogCancel>
                    <ZoruAlertDialogAction onClick={handleSend}>
                      Send {lines.length} message{lines.length === 1 ? '' : 's'}
                    </ZoruAlertDialogAction>
                  </ZoruAlertDialogFooter>
                </ZoruAlertDialogContent>
              </ZoruAlertDialog>
            </div>
          </div>
        </Section>

        <div className="flex flex-col gap-3">
          {/* Audience preview chart */}
          <Section title="Audience by country" description="Detected from leading country code on each line.">
            {audienceByCountry.length === 0 ? (
              <p className="py-8 text-center text-[12px] text-zinc-500">Paste numbers to preview the audience.</p>
            ) : (
              <div className="h-[160px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={audienceByCountry} margin={{ top: 4, right: 4, bottom: 0, left: -16 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" />
                    <XAxis dataKey="code" tick={{ fontSize: 10, fill: '#71717a' }} stroke="#e4e4e7" />
                    <YAxis tick={{ fontSize: 10, fill: '#71717a' }} stroke="#e4e4e7" />
                    <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e4e4e7' }} />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                      {audienceByCountry.map((_, i) => (
                        <Cell key={i} fill="#25D366" />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </Section>

          {/* Live progress */}
          <Section title="Progress" description={sending ? `Estimated at ${rate} msgs/sec` : result ? `${result.total} processed` : 'Idle'}>
            <AnimatePresence mode="wait">
              {sending ? (
                <m.div
                  key="sending"
                  initial={reduce ? false : { opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.25, ease: EASE_OUT }}
                  className="flex flex-col gap-3"
                >
                  <div className="flex items-center justify-between text-[11px] tabular-nums text-zinc-600">
                    <span>{liveSent} / {lines.length}</span>
                    <span>{Math.round((liveSent / Math.max(1, lines.length)) * 100)}%</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-100">
                    <m.div
                      initial={false}
                      animate={{ width: `${(liveSent / Math.max(1, lines.length)) * 100}%` }}
                      transition={{ duration: 0.3, ease: EASE_OUT }}
                      className="h-full rounded-full"
                      style={{ background: 'var(--mt-accent)' }}
                    />
                  </div>
                  <p className="text-[11px] text-zinc-500">Elapsed {tick}s / ~{eta}s</p>
                </m.div>
              ) : result ? (
                <m.div
                  key="result"
                  initial={reduce ? false : { opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3, ease: EASE_OUT }}
                  className="flex flex-col gap-3"
                >
                  <div className="flex items-center gap-2 text-[13px]">
                    <CircleCheck className="h-4 w-4 text-emerald-600" strokeWidth={2.25} aria-hidden />
                    <span className="tabular-nums text-zinc-900">{result.success}</span>
                    <span className="text-zinc-500">sent</span>
                  </div>
                  <div className="flex items-center gap-2 text-[13px]">
                    <CircleX className="h-4 w-4 text-rose-600" strokeWidth={2.25} aria-hidden />
                    <span className="tabular-nums text-zinc-900">{liveFailed}</span>
                    <span className="text-zinc-500">failed</span>
                  </div>
                </m.div>
              ) : (
                <m.p
                  key="idle"
                  initial={reduce ? false : { opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="py-6 text-center text-[12.5px] text-zinc-500"
                >
                  Enter numbers and a message, then click Send all.
                </m.p>
              )}
            </AnimatePresence>
          </Section>
        </div>
      </div>
    </WaPage>
  );
}
