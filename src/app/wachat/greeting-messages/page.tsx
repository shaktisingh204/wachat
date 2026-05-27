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
import { useEffect, useState, useTransition, useCallback } from 'react';
import { Save, Hand, MoonStar } from 'lucide-react';
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
} from '@/components/wachat-ui';
import { EASE_OUT } from '@/components/dashboard-ui/module-theme';

import * as React from 'react';

const VARIABLES = ['{name}', '{phone}', '{email}', '{company}'];

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

  return (
    <WaPage>
      <PageHeader
        title="Greeting and away messages"
        description="Configure the welcome message and after-hours away message sent to contacts."
        kicker="Wachat"
        eyebrowIcon={Hand}
        backHref="/wachat"
        actions={
          <WaButton leftIcon={Save} onClick={handleSave} disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save'}
          </WaButton>
        }
      />

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        {/* GREETING */}
        <div className="flex flex-col gap-5">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
            Greeting message
          </h2>

          <Section
            title="Enable greeting"
            description="Automatically send a greeting when a contact messages for the first time."
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
              Sent within seconds of the first inbound message. We never send it twice for the same contact.
            </p>
          </Section>

          <Section
            title="A/B testing"
            description="Test two greetings to see which performs better."
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
              <div className="flex flex-col gap-5">
                <div className="flex flex-col gap-2">
                  <Label>Variant A</Label>
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
                  <Label>Variant B</Label>
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

          <div>
            <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
              Live preview
            </h3>
            <PhoneFrame title={activeProject?.name ?? 'Your business'} subtitle="Greeting preview">
              <ChatBubble who="them" text="Hi" time="9:40" />
              <AnimatePresence initial={false}>
                {greetingEnabled && greetingType === 'ab_test' ? (
                  <>
                    {renderPreviewText(greetingVariantA) && (
                      <m.div key="variant-a" layout>
                        <ChatBubble who="us" text={renderPreviewText(greetingVariantA) ?? ''} time="9:41" />
                      </m.div>
                    )}
                    {renderPreviewText(greetingVariantB) && (
                      <m.div
                        key="variant-b"
                        layout
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.08 }}
                      >
                        <div className="mt-1 text-[10px] uppercase tracking-[0.12em] text-emerald-200/70">Variant B</div>
                        <ChatBubble who="us" text={renderPreviewText(greetingVariantB) ?? ''} time="9:41" />
                      </m.div>
                    )}
                  </>
                ) : greetingEnabled && renderPreviewText(greetingMessage) ? (
                  <m.div key="single" layout>
                    <ChatBubble who="us" text={renderPreviewText(greetingMessage) ?? ''} time="9:41" />
                  </m.div>
                ) : null}
              </AnimatePresence>
            </PhoneFrame>
          </div>
        </div>

        {/* AWAY */}
        <div className="flex flex-col gap-5">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">Away message</h2>

          <Section
            title="Enable away message"
            description="Send a response when your team is unavailable."
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
              Pairs with business hours or a custom schedule.
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

          <div>
            <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
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
