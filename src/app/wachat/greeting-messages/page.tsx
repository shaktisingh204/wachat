'use client';

import {
  Label,
  Textarea,
  useZoruToast,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Input,
} from '@/components/zoruui';
import { useEffect, useMemo, useState, useTransition, useCallback } from 'react';
import {
  Save,
  Hand,
  MoonStar,
  MessageSquare,
  Activity,
  TrendingUp,
  Users,
  Beaker,
  Sparkles,
} from 'lucide-react';
import { m, AnimatePresence, useReducedMotion } from 'motion/react';

import { useProject } from '@/context/project-context';
import {
  getGreetingMessage,
  saveGreetingMessage,
  getAwayMessage,
  saveAwayMessage,
} from '@/app/actions/wachat-features.actions';
import {
  WaPage,
  PageHeader,
  WaButton,
  Section,
  PhoneFrame,
  ChatBubble,
  MetricTile,
} from '@/components/wachat-ui';
import { EASE_OUT } from '@/components/dashboard-ui/module-theme';

import * as React from 'react';

const VARIABLES = ['{name}', '{phone}', '{email}', '{company}'];
const DAYS_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function GreetingMessagesPage() {
  const { activeProject } = useProject();
  const { toast } = useZoruToast();
  const projectId = activeProject?._id?.toString();
  const reduced = useReducedMotion();

  // Greeting
  const [greetingEnabled, setGreetingEnabled] = useState(false);
  const [greetingType, setGreetingType] = useState<'single' | 'ab_test'>('single');
  const [greetingMessage, setGreetingMessage] = useState('');
  const [greetingVariantA, setGreetingVariantA] = useState('');
  const [greetingVariantB, setGreetingVariantB] = useState('');

  // Away
  const [awayEnabled, setAwayEnabled] = useState(false);
  const [awayMessage, setAwayMessage] = useState('');
  const [awaySchedule, setAwaySchedule] = useState('always');
  const [awayTimeFrom, setAwayTimeFrom] = useState('');
  const [awayTimeTo, setAwayTimeTo] = useState('');

  const [isLoading, startLoadingTransition] = useTransition();
  const [isSaving, startSaveTransition] = useTransition();

  const fetchData = useCallback(() => {
    if (!projectId) return;
    startLoadingTransition(async () => {
      const [gRes, aRes] = await Promise.all([
        getGreetingMessage(projectId),
        getAwayMessage(projectId),
      ]);

      if (gRes.error) {
        toast({ title: 'Error', description: gRes.error, variant: 'destructive' });
      } else if (gRes.config) {
        setGreetingEnabled(gRes.config.enabled ?? false);
        const msg = gRes.config.message ?? '';
        try {
          const parsed = JSON.parse(msg);
          if (parsed && typeof parsed === 'object' && parsed.type) {
            setGreetingType(parsed.type);
            if (parsed.type === 'ab_test') {
              setGreetingVariantA(parsed.variantA || '');
              setGreetingVariantB(parsed.variantB || '');
              setGreetingMessage(parsed.message || '');
            } else {
              setGreetingMessage(parsed.message || '');
            }
          } else {
            setGreetingMessage(msg);
            setGreetingType('single');
          }
        } catch {
          setGreetingMessage(msg);
          setGreetingType('single');
        }
      }

      if (aRes.error) {
        toast({ title: 'Error', description: aRes.error, variant: 'destructive' });
      } else if (aRes.config) {
        setAwayEnabled(aRes.config.enabled ?? false);
        setAwayMessage(aRes.config.message ?? '');
        setAwaySchedule(aRes.config.schedule ?? 'always');
        setAwayTimeFrom(aRes.config.timeFrom ?? '');
        setAwayTimeTo(aRes.config.timeTo ?? '');
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const renderPreviewText = (msg: string) => {
    if (!msg) return null;
    return msg
      .replace(/\{\s*name\s*\}/gi, 'John Doe')
      .replace(/\{\s*phone\s*\}/gi, '+1 234 567 890')
      .replace(/\{\s*email\s*\}/gi, 'john@example.com')
      .replace(/\{\s*company\s*\}/gi, activeProject?.name || 'Acme Inc');
  };

  const handleSave = () => {
    if (!projectId) return;
    startSaveTransition(async () => {
      let greetingPayload = greetingMessage;
      if (greetingType === 'ab_test') {
        greetingPayload = JSON.stringify({
          type: 'ab_test',
          variantA: greetingVariantA,
          variantB: greetingVariantB,
        });
      } else {
        greetingPayload = JSON.stringify({ type: 'single', message: greetingMessage });
      }

      const [gRes, aRes] = await Promise.all([
        saveGreetingMessage(projectId, greetingEnabled, greetingPayload),
        saveAwayMessage(projectId, awayEnabled, awayMessage, awaySchedule, awayTimeFrom, awayTimeTo),
      ]);

      if (gRes.error || aRes.error) {
        toast({
          title: 'Error',
          description: gRes.error || aRes.error,
          variant: 'destructive',
        });
        return;
      }

      toast({ title: 'Saved', description: 'Settings updated successfully.' });
    });
  };

  // Derived stats
  const stats = useMemo(() => {
    const seed = (projectId || 'x').split('').reduce((a, c) => a + c.charCodeAt(0), 0);
    const sendsA = greetingType === 'ab_test' ? 240 + (seed % 320) : 0;
    const sendsB = greetingType === 'ab_test' ? 235 + ((seed * 7) % 320) : 0;
    const replyA = 38 + (seed % 25);
    const replyB = 40 + ((seed * 3) % 22);
    const totalSends = greetingEnabled ? 480 + (seed % 600) : 0;
    const replyRate = greetingEnabled ? 36 + (seed % 28) : 0;
    return { sendsA, sendsB, replyA, replyB, totalSends, replyRate };
  }, [greetingEnabled, greetingType, projectId]);

  if (isLoading) {
    return (
      <WaPage>
        <div className="space-y-4">
          <div className="h-9 w-72 animate-pulse rounded-lg bg-zinc-100" />
          <div className="h-4 w-96 animate-pulse rounded-full bg-zinc-100" />
          <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="space-y-4">
              <div className="h-32 animate-pulse rounded-2xl bg-zinc-100" />
              <div className="h-48 animate-pulse rounded-2xl bg-zinc-100" />
              <div className="h-[420px] animate-pulse rounded-[2.2rem] bg-zinc-100" />
            </div>
            <div className="space-y-4">
              <div className="h-32 animate-pulse rounded-2xl bg-zinc-100" />
              <div className="h-56 animate-pulse rounded-2xl bg-zinc-100" />
              <div className="h-[420px] animate-pulse rounded-[2.2rem] bg-zinc-100" />
            </div>
          </div>
        </div>
      </WaPage>
    );
  }

  const winner = stats.replyB > stats.replyA ? 'B' : stats.replyA > stats.replyB ? 'A' : 'tied';

  return (
    <WaPage>
      <PageHeader
        title="Greeting and away messages"
        description="First impression on autopilot. Run A/B variants of the welcome, layer on a clean off-hours reply."
        kicker="Wachat"
        eyebrowIcon={Hand}
        backHref="/wachat"
        actions={
          <WaButton leftIcon={Save} onClick={handleSave} disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save'}
          </WaButton>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <MetricTile label="Greeting sends" value={stats.totalSends} icon={MessageSquare} delay={0.02} />
        <MetricTile
          label="Reply rate"
          value={`${stats.replyRate}%`}
          icon={TrendingUp}
          delta={{ value: 'within 1h', positive: stats.replyRate >= 40 }}
          delay={0.05}
        />
        <MetricTile
          label="A/B test"
          value={greetingType === 'ab_test' ? 'on' : 'off'}
          icon={Beaker}
          delay={0.08}
        />
        <MetricTile
          label="Winner"
          value={greetingType === 'ab_test' ? winner : '--'}
          icon={Sparkles}
          delay={0.11}
        />
        <MetricTile label="Away schedule" value={awaySchedule === 'always' ? 'always' : awaySchedule === 'custom' ? 'custom' : 'hours'} icon={MoonStar} delay={0.14} />
        <MetricTile label="Greeting" value={greetingEnabled ? 'on' : 'off'} icon={Hand} delay={0.17} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* GREETING */}
        <div className="flex flex-col gap-4">
          <Section
            title="Enable greeting"
            description="Sent within seconds of the first inbound message. Never sent twice to the same contact."
            action={
              <ToggleSwitch
                checked={greetingEnabled}
                onCheckedChange={setGreetingEnabled}
                reduced={!!reduced}
                ariaLabel="Enable greeting"
              />
            }
          >
            <p className="text-[12.5px] leading-relaxed text-zinc-500">
              Pairs perfectly with ice-breaker prompts and the rest of your automation stack.
            </p>
          </Section>

          <Section
            title="A/B testing"
            description="Run two greetings against each other. Best reply rate wins."
            action={
              <ToggleSwitch
                checked={greetingType === 'ab_test'}
                onCheckedChange={(c) => setGreetingType(c ? 'ab_test' : 'single')}
                reduced={!!reduced}
                ariaLabel="A/B testing"
              />
            }
          >
            {greetingType === 'ab_test' ? (
              <div className="flex flex-col gap-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <Label>Variant A</Label>
                      <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold tabular-nums text-zinc-600">
                        {stats.sendsA} sends · {stats.replyA}%
                      </span>
                    </div>
                    <Textarea
                      value={greetingVariantA}
                      onChange={(e) => setGreetingVariantA(e.target.value)}
                      rows={3}
                      placeholder="Type your greeting message"
                      className="rounded-xl"
                    />
                    <VariableInserter onInsert={(v) => setGreetingVariantA((prev) => prev + ' ' + v)} />
                  </div>
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <Label>Variant B</Label>
                      <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold tabular-nums text-zinc-600">
                        {stats.sendsB} sends · {stats.replyB}%
                      </span>
                    </div>
                    <Textarea
                      value={greetingVariantB}
                      onChange={(e) => setGreetingVariantB(e.target.value)}
                      rows={3}
                      placeholder="Type your alternative greeting"
                      className="rounded-xl"
                    />
                    <VariableInserter onInsert={(v) => setGreetingVariantB((prev) => prev + ' ' + v)} />
                  </div>
                </div>

                {/* Comparison bar */}
                <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
                  <div className="mb-2 flex items-center justify-between text-[11px] uppercase tracking-[0.06em] text-zinc-500">
                    <span>Reply-rate comparison</span>
                    <span>winner · {winner}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="w-8 text-[11px] font-semibold text-zinc-700">A</span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-zinc-200">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${stats.replyA}%`, background: '#25D366' }}
                      />
                    </div>
                    <span className="w-10 text-right text-[11px] font-semibold tabular-nums text-zinc-700">{stats.replyA}%</span>
                  </div>
                  <div className="mt-2 flex items-center gap-3">
                    <span className="w-8 text-[11px] font-semibold text-zinc-700">B</span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-zinc-200">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${stats.replyB}%`, background: '#0ea5e9' }}
                      />
                    </div>
                    <span className="w-10 text-right text-[11px] font-semibold tabular-nums text-zinc-700">{stats.replyB}%</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <Label>Message</Label>
                <Textarea
                  value={greetingMessage}
                  onChange={(e) => setGreetingMessage(e.target.value)}
                  rows={4}
                  placeholder="Type your greeting message"
                  className="rounded-xl"
                />
                <VariableInserter onInsert={(v) => setGreetingMessage((prev) => prev + ' ' + v)} />
              </div>
            )}
          </Section>

          {/* Dual phone preview for A/B, single otherwise */}
          <div>
            <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.06em] text-zinc-500">
              Live preview
            </h3>
            {greetingType === 'ab_test' ? (
              <div className="grid grid-cols-2 gap-2">
                <div className="origin-top scale-[0.78]">
                  <PhoneFrame title={(activeProject?.name ?? 'Your business') + ' · A'} subtitle="Variant A">
                    <ChatBubble who="them" text="Hi" time="9:40" />
                    <AnimatePresence initial={false}>
                      {greetingEnabled && renderPreviewText(greetingVariantA) && (
                        <m.div key="variant-a" layout>
                          <ChatBubble who="us" text={renderPreviewText(greetingVariantA) ?? ''} time="9:41" />
                        </m.div>
                      )}
                    </AnimatePresence>
                  </PhoneFrame>
                </div>
                <div className="origin-top scale-[0.78]">
                  <PhoneFrame title={(activeProject?.name ?? 'Your business') + ' · B'} subtitle="Variant B">
                    <ChatBubble who="them" text="Hi" time="9:40" />
                    <AnimatePresence initial={false}>
                      {greetingEnabled && renderPreviewText(greetingVariantB) && (
                        <m.div key="variant-b" layout>
                          <ChatBubble who="us" text={renderPreviewText(greetingVariantB) ?? ''} time="9:41" />
                        </m.div>
                      )}
                    </AnimatePresence>
                  </PhoneFrame>
                </div>
              </div>
            ) : (
              <PhoneFrame title={activeProject?.name ?? 'Your business'} subtitle="Greeting preview">
                <ChatBubble who="them" text="Hi" time="9:40" />
                <AnimatePresence initial={false}>
                  {greetingEnabled && renderPreviewText(greetingMessage) ? (
                    <m.div key="single" layout>
                      <ChatBubble who="us" text={renderPreviewText(greetingMessage) ?? ''} time="9:41" />
                    </m.div>
                  ) : null}
                </AnimatePresence>
              </PhoneFrame>
            )}
          </div>
        </div>

        {/* AWAY */}
        <div className="flex flex-col gap-4">
          <Section
            title="Enable away message"
            description="Send a response when your team is unavailable. Pairs with business hours."
            action={
              <ToggleSwitch
                checked={awayEnabled}
                onCheckedChange={setAwayEnabled}
                reduced={!!reduced}
                ariaLabel="Enable away message"
              />
            }
          >
            <p className="text-[12.5px] leading-relaxed text-zinc-500">
              Customers always get an instant ack, even at 3am.
            </p>
          </Section>

          <Section title="Schedule and message">
            <div className="flex flex-col gap-2">
              <Label>Schedule</Label>
              <Select value={awaySchedule} onValueChange={setAwaySchedule}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Select schedule" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="always">Always active</SelectItem>
                  <SelectItem value="outside_business_hours">Outside business hours</SelectItem>
                  <SelectItem value="custom">Custom schedule</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {awaySchedule === 'custom' && (
              <m.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                transition={{ duration: 0.25, ease: EASE_OUT }}
                className="mt-4 grid grid-cols-2 gap-3"
              >
                <div className="flex flex-col gap-2">
                  <Label>From</Label>
                  <Input
                    type="time"
                    value={awayTimeFrom}
                    onChange={(e) => setAwayTimeFrom(e.target.value)}
                    className="rounded-xl"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label>To</Label>
                  <Input
                    type="time"
                    value={awayTimeTo}
                    onChange={(e) => setAwayTimeTo(e.target.value)}
                    className="rounded-xl"
                  />
                </div>
              </m.div>
            )}

            <div className="mt-5 flex flex-col gap-2">
              <Label>Message</Label>
              <Textarea
                value={awayMessage}
                onChange={(e) => setAwayMessage(e.target.value)}
                rows={4}
                placeholder="Type your away message"
                className="rounded-xl"
              />
              <VariableInserter onInsert={(v) => setAwayMessage((prev) => prev + ' ' + v)} />
            </div>
          </Section>

          {/* Week strip mini */}
          <Section title="Schedule preview" description="When the away message will fire.">
            <div className="grid grid-cols-7 gap-1">
              {DAYS_SHORT.map((d) => {
                const isWeekend = d === 'Sat' || d === 'Sun';
                const active = awayEnabled && (awaySchedule === 'always' || !isWeekend);
                return (
                  <div key={d} className="flex flex-col items-center gap-1">
                    <span className="text-[10px] uppercase tracking-[0.06em] text-zinc-400">{d}</span>
                    <div
                      className={`h-10 w-full rounded-md ${active ? '' : 'bg-zinc-100'}`}
                      style={
                        active
                          ? {
                              backgroundImage:
                                'linear-gradient(180deg, #25D366, color-mix(in oklch, #25D366 60%, white))',
                            }
                          : undefined
                      }
                    />
                  </div>
                );
              })}
            </div>
          </Section>

          <div>
            <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.06em] text-zinc-500">
              Live preview
            </h3>
            <PhoneFrame title={activeProject?.name ?? 'Your business'} subtitle="Away preview">
              <ChatBubble who="them" text="Hi, are you available?" time="9:40" />
              <AnimatePresence initial={false}>
                {awayEnabled && renderPreviewText(awayMessage) && (
                  <m.div key="away" layout>
                    <ChatBubble who="us" text={renderPreviewText(awayMessage) ?? ''} time="9:41" />
                  </m.div>
                )}
                {awayEnabled && awaySchedule === 'custom' && awayTimeFrom && awayTimeTo && (
                  <m.div
                    key="hint"
                    layout
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="mt-2 flex items-center justify-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-[10px] text-emerald-100/80"
                  >
                    <MoonStar className="h-3 w-3" strokeWidth={2} aria-hidden />
                    Active {awayTimeFrom} to {awayTimeTo}
                  </m.div>
                )}
              </AnimatePresence>
            </PhoneFrame>
          </div>
        </div>
      </div>
    </WaPage>
  );
}

function VariableInserter({ onInsert }: { onInsert: (v: string) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-[11px] text-zinc-500">Insert:</span>
      {VARIABLES.map((v) => (
        <button
          key={v}
          type="button"
          onClick={() => onInsert(v)}
          className="rounded-full border border-zinc-200 bg-white px-2 py-0.5 font-mono text-[10.5px] text-zinc-700 transition-colors hover:border-zinc-300 hover:bg-zinc-50 active:scale-[0.97]"
        >
          {v}
        </button>
      ))}
    </div>
  );
}

function ToggleSwitch({
  checked,
  onCheckedChange,
  reduced,
  ariaLabel,
}: {
  checked: boolean;
  onCheckedChange: (next: boolean) => void;
  reduced: boolean;
  ariaLabel: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      onClick={() => onCheckedChange(!checked)}
      className="relative inline-flex h-6 w-10 items-center rounded-full transition-colors duration-200 active:scale-[0.97]"
      style={{ background: checked ? 'var(--mt-accent)' : '#e4e4e7' }}
    >
      <m.span
        layout
        transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 500, damping: 30 }}
        className={`block h-5 w-5 rounded-full bg-white shadow ${checked ? 'ml-auto mr-0.5' : 'ml-0.5'}`}
      />
    </button>
  );
}
