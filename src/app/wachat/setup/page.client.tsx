'use client';

import { useEffect, useMemo, useState } from 'react';
import { m, AnimatePresence, useReducedMotion } from 'motion/react';
import {
  AlertCircle,
  ArrowRight,
  BadgeCheck,
  Check,
  CheckCircle2,
  ChevronRight,
  Lock,
  MessageCircle,
  Phone,
  Send,
  ShieldCheck,
  Sparkles,
  Workflow,
  Bot,
  Users,
  Briefcase,
  ExternalLink,
} from 'lucide-react';
import {
  Checkbox,
  Label,
  Dialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogHeader,
  ZoruDialogTitle,
  ZoruDialogTrigger,
} from '@/components/zoruui';
import EmbeddedSignup from '@/components/zoruui-domain/embedded-signup';
import {
  WaPage,
  PageHeader,
  WaButton,
  Section,
  PhoneFrame,
  ChatBubble,
  EmptyState,
} from '@/components/wachat-ui';
import { EASE_OUT } from '@/components/dashboard-ui/module-theme';

/* ------------------------------------------------------------------ */
/* Static config - what your customers will get / steps / trust       */
/* ------------------------------------------------------------------ */

const UNLOCKS = [
  { icon: Send, label: 'Bulk broadcasts', hint: 'Reach thousands in one tap.' },
  { icon: MessageCircle, label: 'Live inbox', hint: 'Reply in real time.' },
  { icon: Workflow, label: 'Flow automation', hint: 'Drip and auto-reply.' },
  { icon: Users, label: 'Smart segments', hint: 'Tags, attributes, lists.' },
  { icon: Bot, label: 'AI chatbot', hint: '24/7 first-line replies.' },
  { icon: Briefcase, label: 'CRM pipeline', hint: 'Leads, deals, tickets.' },
] as const;

const TRUST = [
  { icon: ShieldCheck, text: 'Official Meta partner using the secure Embedded Signup.' },
  { icon: Lock, text: 'No passwords stored. Access via OAuth token only.' },
  { icon: BadgeCheck, text: 'Revoke access anytime from Meta Business Settings.' },
] as const;

const STEPS = [
  {
    key: 'authorize',
    title: 'Connect WhatsApp',
    sub: 'Authorize SabNode through Meta\'s official popup. Takes about a minute.',
  },
  {
    key: 'select',
    title: 'Pick your WABA',
    sub: 'Choose an existing WhatsApp Business Account or create a new one inline.',
  },
  {
    key: 'verify',
    title: 'Verify number',
    sub: 'We verify the phone number you want to send from. Quality rating starts at green.',
  },
  {
    key: 'test',
    title: 'Send a test',
    sub: 'Fire off a hello message to confirm everything routes correctly.',
  },
] as const;

/* ------------------------------------------------------------------ */
/* Config-missing screen                                              */
/* ------------------------------------------------------------------ */

function ConfigError() {
  return (
    <WaPage>
      <PageHeader
        title="Setup is missing required config"
        description="Two environment variables are needed to launch the WhatsApp embedded signup flow."
        kicker="Wachat · setup"
      />
      <Section title="Add these to your environment" description="They power the Meta-hosted popup that links your WABA to SabNode.">
        <ul className="space-y-2.5">
          {[
            'NEXT_PUBLIC_META_ONBOARDING_APP_ID',
            'NEXT_PUBLIC_META_ONBOARDING_CONFIG_ID',
          ].map((k) => (
            <li
              key={k}
              className="flex items-center gap-2.5 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 font-mono text-[12.5px] text-zinc-700"
            >
              <AlertCircle className="h-3.5 w-3.5 shrink-0 text-rose-500" strokeWidth={2.25} />
              {k}
            </li>
          ))}
        </ul>
        <p className="mt-4 text-[12.5px] leading-relaxed text-zinc-500">
          Once both are present, refresh this page and the embedded signup will appear automatically.
        </p>
      </Section>
    </WaPage>
  );
}

/* ------------------------------------------------------------------ */
/* The setup flow                                                     */
/* ------------------------------------------------------------------ */

interface ConnectDialogProps {
  appId: string;
  configId: string;
  includeCatalog: boolean;
  setIncludeCatalog: (v: boolean) => void;
  trigger: React.ReactNode;
}

function ConnectDialog({ appId, configId, includeCatalog, setIncludeCatalog, trigger }: ConnectDialogProps) {
  return (
    <Dialog>
      <ZoruDialogTrigger asChild>{trigger}</ZoruDialogTrigger>
      <ZoruDialogContent className="sm:max-w-md rounded-2xl">
        <ZoruDialogHeader>
          <div
            className="mb-2 grid h-10 w-10 place-items-center rounded-xl text-white"
            style={{ backgroundImage: 'linear-gradient(135deg, var(--mt-accent), color-mix(in oklch, var(--mt-accent) 55%, white))' }}
          >
            <MessageCircle className="h-5 w-5" strokeWidth={2.25} />
          </div>
          <ZoruDialogTitle>Connect via Meta</ZoruDialogTitle>
          <ZoruDialogDescription>
            You will be redirected to Facebook to authorize SabNode. Takes about a minute.
          </ZoruDialogDescription>
        </ZoruDialogHeader>

        <div className="space-y-5 py-3">
          <EmbeddedSignup appId={appId} configId={configId} includeCatalog={includeCatalog} state="whatsapp" />

          <div className="flex items-start gap-3 rounded-xl border border-zinc-200 bg-zinc-50 p-3">
            <Checkbox
              id="include-catalog"
              checked={includeCatalog}
              onCheckedChange={(c) => setIncludeCatalog(Boolean(c))}
              className="mt-0.5"
            />
            <div>
              <Label htmlFor="include-catalog" className="text-[13px] font-medium cursor-pointer">
                Include catalog management
              </Label>
              <p className="mt-0.5 text-[11.5px] text-zinc-500">
                Grants permission to manage your WhatsApp product catalog.
              </p>
            </div>
          </div>

          <ul className="space-y-1.5">
            {TRUST.slice(0, 2).map((t) => (
              <li key={t.text} className="flex items-center gap-2 text-[11.5px] text-zinc-500">
                <t.icon className="h-3.5 w-3.5 shrink-0" style={{ color: 'var(--mt-accent)' }} />
                {t.text}
              </li>
            ))}
          </ul>
        </div>
      </ZoruDialogContent>
    </Dialog>
  );
}

/** A single step in the vertical rail. Active step pulses; completed pops a check. */
function StepRow({
  index,
  step,
  active,
  done,
}: {
  index: number;
  step: (typeof STEPS)[number];
  active: boolean;
  done: boolean;
}) {
  const reduce = useReducedMotion();
  return (
    <m.li
      initial={{ opacity: 0, x: -6 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4, delay: 0.1 + index * 0.06, ease: EASE_OUT }}
      className="relative flex gap-4 pb-6 last:pb-0"
    >
      {/* connector */}
      {index < STEPS.length - 1 && (
        <span aria-hidden className="absolute left-[15px] top-9 h-[calc(100%-1.5rem)] w-px bg-zinc-200" />
      )}

      <div className="relative">
        <m.span
          aria-hidden
          className={`relative grid h-8 w-8 place-items-center rounded-full border text-[12px] font-semibold tabular-nums ${
            done
              ? 'border-transparent text-white'
              : active
                ? 'border-zinc-900 bg-white text-zinc-900'
                : 'border-zinc-200 bg-white text-zinc-400'
          }`}
          style={done ? { background: 'var(--mt-accent)' } : undefined}
          animate={
            active && !done && !reduce
              ? { boxShadow: ['0 0 0 0px var(--mt-accent-glow)', '0 0 0 10px transparent'] }
              : { boxShadow: '0 0 0 0 transparent' }
          }
          transition={
            active && !done && !reduce
              ? { duration: 1.6, repeat: Infinity, ease: 'easeOut' }
              : { duration: 0.2 }
          }
        >
          <AnimatePresence mode="wait" initial={false}>
            {done ? (
              <m.span
                key="check"
                initial={reduce ? { opacity: 0 } : { scale: 0, opacity: 0 }}
                animate={reduce ? { opacity: 1 } : { scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 380, damping: 20 }}
              >
                <Check className="h-3.5 w-3.5" strokeWidth={2.75} aria-hidden />
              </m.span>
            ) : (
              <m.span
                key="num"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                {index + 1}
              </m.span>
            )}
          </AnimatePresence>
        </m.span>
      </div>

      <div className="min-w-0 flex-1 pt-1">
        <p className={`text-[13.5px] font-semibold ${done ? 'text-zinc-500 line-through decoration-zinc-300' : 'text-zinc-950'}`}>
          {step.title}
        </p>
        <p className="mt-1 text-[12.5px] leading-relaxed text-zinc-500">{step.sub}</p>
      </div>
    </m.li>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                               */
/* ------------------------------------------------------------------ */

export default function SetupClient() {
  const [mounted, setMounted] = useState(false);
  const [includeCatalog, setIncludeCatalog] = useState(true);
  const [completedSteps, setCompletedSteps] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setMounted(true);
  }, []);

  // Find the first un-done step - that's the active one.
  const activeStepIndex = useMemo(() => {
    const idx = STEPS.findIndex((s) => !completedSteps[s.key]);
    return idx === -1 ? STEPS.length - 1 : idx;
  }, [completedSteps]);

  const appId = process.env.NEXT_PUBLIC_META_ONBOARDING_APP_ID;
  const configId = process.env.NEXT_PUBLIC_META_ONBOARDING_CONFIG_ID;

  if (!appId || !configId) return <ConfigError />;
  if (!mounted) return null;

  // Connect-CTA reused at top and in the side card.
  const connectButton = (
    <WaButton leftIcon={MessageCircle} rightIcon={ArrowRight}>
      Connect WhatsApp
    </WaButton>
  );

  return (
    <WaPage>
      <PageHeader
        title="Connect your WhatsApp Business Account"
        description="Securely link your WABA to SabNode and unlock broadcasts, inbox, automation, and CRM from one place."
        kicker="Wachat · setup"
        backHref="/wachat"
        actions={
          <>
            <WaButton href="/wachat/setup/docs" variant="outline" rightIcon={ExternalLink}>
              Manual setup
            </WaButton>
            <ConnectDialog
              appId={appId}
              configId={configId}
              includeCatalog={includeCatalog}
              setIncludeCatalog={setIncludeCatalog}
              trigger={connectButton}
            />
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        {/* Left column - stepped onboarding */}
        <div className="space-y-6">
          <Section
            title="Onboarding flow"
            description="Four steps. Most teams finish in under three minutes."
          >
            <ol className="space-y-0">
              {STEPS.map((s, i) => (
                <StepRow
                  key={s.key}
                  index={i}
                  step={s}
                  active={i === activeStepIndex}
                  done={!!completedSteps[s.key]}
                />
              ))}
            </ol>

            {/* dev affordance: let the user manually toggle a step for demo / preview */}
            <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-zinc-100 pt-5">
              <p className="mr-1 text-[11px] uppercase tracking-[0.12em] text-zinc-400">
                Mark progress
              </p>
              {STEPS.map((s) => {
                const isDone = !!completedSteps[s.key];
                return (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() =>
                      setCompletedSteps((prev) => ({ ...prev, [s.key]: !prev[s.key] }))
                    }
                    className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-[transform,background-color,color] duration-150 active:scale-[0.97] ${
                      isDone
                        ? 'border-transparent text-white'
                        : 'border-zinc-200 bg-white text-zinc-600 hover:border-zinc-900 hover:text-zinc-900'
                    }`}
                    style={isDone ? { background: 'var(--mt-accent)' } : undefined}
                  >
                    {isDone && <Check className="h-3 w-3" strokeWidth={2.5} aria-hidden />}
                    {s.title}
                  </button>
                );
              })}
            </div>
          </Section>

          <Section title="What you unlock" description="Available immediately after the WABA is connected.">
            <div className="grid gap-3 sm:grid-cols-2">
              {UNLOCKS.map((u, i) => (
                <m.div
                  key={u.label}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, delay: 0.05 + i * 0.04, ease: EASE_OUT }}
                  className="group flex items-start gap-3 rounded-xl border border-zinc-200 bg-white p-3.5"
                >
                  <span
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-white"
                    style={{ backgroundImage: 'linear-gradient(135deg, var(--mt-accent), color-mix(in oklch, var(--mt-accent) 55%, white))' }}
                  >
                    <u.icon className="h-4 w-4" strokeWidth={2.25} aria-hidden />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold text-zinc-900">{u.label}</p>
                    <p className="mt-0.5 text-[12px] leading-relaxed text-zinc-500">{u.hint}</p>
                  </div>
                </m.div>
              ))}
            </div>
          </Section>

          <Section title="Security and trust" description="Why this is safer than handing over passwords.">
            <ul className="space-y-3">
              {TRUST.map((t) => (
                <li key={t.text} className="flex items-start gap-3">
                  <span
                    className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg"
                    style={{ background: 'var(--mt-accent-soft)' }}
                  >
                    <t.icon className="h-3.5 w-3.5" style={{ color: 'var(--mt-accent)' }} aria-hidden />
                  </span>
                  <p className="text-[13px] leading-relaxed text-zinc-600">{t.text}</p>
                </li>
              ))}
            </ul>
          </Section>
        </div>

        {/* Right column - phone preview + side CTA */}
        <div className="space-y-6">
          <Section title="What customers will see" description="A preview of your first conversation once connected.">
            <PhoneFrame title="Your business" subtitle="business account">
              <ChatBubble who="them" text="Hi! Is this offer still available?" time="9:41" delay={0.05} />
              <ChatBubble
                who="us"
                kind="template"
                text="Yes! Free shipping ends tonight. Reply YES to lock it in."
                time="9:42"
                delay={0.2}
              />
              <ChatBubble who="them" text="YES" time="9:42" delay={0.4} />
              <ChatBubble who="us" kind="cta" text="Confirmed. Order #4291 ships tomorrow." time="9:43" delay={0.55} />
            </PhoneFrame>
          </Section>

          <Section padded={false}>
            <div
              className="relative overflow-hidden rounded-2xl p-5 text-white"
              style={{
                backgroundImage:
                  'linear-gradient(135deg, var(--mt-accent), color-mix(in oklch, var(--mt-accent) 55%, white))',
              }}
            >
              <Sparkles className="h-6 w-6 opacity-90" strokeWidth={2} aria-hidden />
              <p className="mt-3 text-[15px] font-semibold leading-snug">Ready to start reaching customers?</p>
              <p className="mt-1 text-[12.5px] text-white/90">Most teams finish in under three minutes.</p>
              <div className="mt-4">
                <ConnectDialog
                  appId={appId}
                  configId={configId}
                  includeCatalog={includeCatalog}
                  setIncludeCatalog={setIncludeCatalog}
                  trigger={
                    <button
                      type="button"
                      className="inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-full bg-white px-4 text-[13px] font-semibold text-zinc-900 transition-[transform] duration-150 active:scale-[0.97]"
                    >
                      <MessageCircle className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden />
                      Connect now
                      <ChevronRight className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden />
                    </button>
                  }
                />
              </div>
            </div>
          </Section>

          <Section title="Before you start" description="Three things to have on hand.">
            <ul className="space-y-2.5">
              {[
                'A Facebook account with admin access to your Business portfolio.',
                'A verified Meta Business Account.',
                'A phone number not already on WhatsApp personal.',
              ].map((t) => (
                <li key={t} className="flex items-start gap-2.5 text-[13px] leading-relaxed text-zinc-600">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" style={{ color: 'var(--mt-accent)' }} strokeWidth={2.25} />
                  {t}
                </li>
              ))}
            </ul>
          </Section>
        </div>
      </div>

      {/* Connected accounts placeholder - kept as an empty state since the
          original page also rendered an empty list. Real data lands once
          the WABA is linked. */}
      <div className="mt-10">
        <Section
          title="Connected accounts"
          description="Linked WhatsApp Business Accounts will appear here."
        >
          <EmptyState
            icon={Phone}
            title="No accounts connected yet"
            description="Run the connect flow above. Once authorized, your WABA, number, and quality rating will land here automatically."
          />
        </Section>
      </div>
    </WaPage>
  );
}
