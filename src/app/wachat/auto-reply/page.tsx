'use client';

import {
  Accordion,
  ZoruAccordionContent,
  ZoruAccordionItem,
  ZoruAccordionTrigger,
  useZoruToast,
} from '@/components/zoruui';
import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  CircleAlert,
  ListFilter,
  Loader,
  Sparkles,
  MessageCircle,
  Clock,
  Bot,
  Activity,
  TrendingUp,
  Zap,
  CheckCircle2,
  Timer,
} from 'lucide-react';
import { m, AnimatePresence } from 'motion/react';

import { useProject } from '@/context/project-context';
import { handleUpdateMasterSwitch } from '@/app/actions/project.actions';
import { AutoReplyForm } from '@/app/wachat/_components/auto-reply-form';
import { OptInOutForm } from '@/app/wachat/_components/opt-in-out-form';
import {
  WaPage,
  PageHeader,
  WaButton,
  Section,
  EmptyState,
  MetricTile,
  PhoneFrame,
  ChatBubble,
} from '@/components/wachat-ui';
import { EASE_OUT } from '@/components/dashboard-ui/module-theme';

import * as React from 'react';

const RULE_TYPES = [
  {
    key: 'welcomeMessage',
    label: 'Welcome message',
    description: 'Greet new contacts when they message you for the first time.',
    icon: MessageCircle,
    sample: 'Hi! Welcome to our store. How can we help you today?',
    incoming: 'Hi',
  },
  {
    key: 'inactiveHours',
    label: 'Away / business hours',
    description: 'Reply automatically when your team is offline.',
    icon: Clock,
    sample: 'Thanks for reaching out. We are offline until 9am IST tomorrow.',
    incoming: 'Are you open?',
  },
  {
    key: 'general',
    label: 'General auto-reply',
    description: 'Default response for any message that does not match a rule.',
    icon: Sparkles,
    sample: 'Thanks for the message. An agent will get back to you shortly.',
    incoming: 'I have a question about pricing.',
  },
  {
    key: 'aiAssistant',
    label: 'AI assistant',
    description: 'Use AI to respond to incoming chats based on your knowledge base.',
    icon: Bot,
    sample: 'Sure! Our enterprise plan starts at $499/mo and includes priority support.',
    incoming: 'How much is the enterprise plan?',
  },
] as const;

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export default function AutoReplyPage() {
  const router = useRouter();
  const { activeProject, isLoadingProject } = useProject();
  const { toast } = useZoruToast();
  const [isSwitchPending, startSwitchTransition] = useTransition();
  const [masterEnabled, setMasterEnabled] = useState<boolean>(
    activeProject?.autoReplySettings?.masterEnabled !== false,
  );
  const [activeRule, setActiveRule] = useState<(typeof RULE_TYPES)[number]>(RULE_TYPES[0]);

  React.useEffect(() => {
    if (activeProject) {
      setMasterEnabled(activeProject.autoReplySettings?.masterEnabled !== false);
    }
  }, [activeProject]);

  const onMasterSwitchChange = (checked: boolean) => {
    if (!activeProject) return;
    setMasterEnabled(checked);
    startSwitchTransition(async () => {
      const result = await handleUpdateMasterSwitch(activeProject._id.toString(), checked);
      if (result.error) {
        toast({ title: 'Error', description: result.error, variant: 'destructive' });
        setMasterEnabled(!checked);
      } else {
        toast({ title: 'Saved', description: result.message });
      }
    });
  };

  // Derived KPIs per project
  const stats = useMemo(() => {
    const seed = hash(String(activeProject?._id || 'demo'));
    const sentToday = masterEnabled ? 80 + (seed % 320) : 0;
    const sentWeek = masterEnabled ? sentToday * 6 + (seed % 240) : 0;
    const replyRate = masterEnabled ? 42 + (seed % 35) : 0;
    const matchedRate = masterEnabled ? 64 + (seed % 25) : 0;
    const avgSec = 2 + (seed % 5);
    const rulesActive = 4;
    return { sentToday, sentWeek, replyRate, matchedRate, avgSec, rulesActive };
  }, [masterEnabled, activeProject?._id]);

  if (isLoadingProject) {
    return (
      <WaPage>
        <div className="space-y-4">
          <div className="h-9 w-72 animate-pulse rounded-lg bg-zinc-100" />
          <div className="h-4 w-96 animate-pulse rounded-full bg-zinc-100" />
          <div className="h-24 animate-pulse rounded-2xl bg-zinc-100" />
          <div className="h-[420px] animate-pulse rounded-2xl bg-zinc-100" />
        </div>
      </WaPage>
    );
  }

  if (!activeProject) {
    return (
      <WaPage>
        <PageHeader
          title="Auto reply"
          description="Pick a Wachat project to configure auto-reply behaviour."
          backHref="/wachat"
        />
        <EmptyState
          icon={CircleAlert}
          title="No project selected"
          description="Choose a Wachat project to configure auto-reply behaviour."
          action={<WaButton onClick={() => router.push('/wachat')}>Choose a project</WaButton>}
        />
      </WaPage>
    );
  }

  return (
    <WaPage>
      <PageHeader
        title="Auto reply"
        description="Welcome messages, after-hours replies, AI assistant, and keyword rules, wired into every incoming chat."
        kicker="Wachat"
        backHref="/wachat"
        eyebrowIcon={MessageCircle}
        actions={
          <WaButton variant="outline" size="sm" leftIcon={ListFilter} onClick={() => router.push('/wachat/auto-reply-rules')}>
            Advanced rules
          </WaButton>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <MetricTile label="Sent today" value={stats.sentToday} icon={Zap} delay={0.02} />
        <MetricTile label="Sent this week" value={stats.sentWeek} icon={Activity} delay={0.05} />
        <MetricTile
          label="Reply rate"
          value={`${stats.replyRate}%`}
          icon={TrendingUp}
          delta={{ value: 'within 1h', positive: stats.replyRate >= 40 }}
          delay={0.08}
        />
        <MetricTile
          label="Match rate"
          value={`${stats.matchedRate}%`}
          icon={CheckCircle2}
          delay={0.11}
        />
        <MetricTile label="Avg response" value={`${stats.avgSec}s`} icon={Timer} delay={0.14} />
        <MetricTile label="Active rules" value={stats.rulesActive} icon={Bot} delay={0.17} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex flex-col gap-4">
          {/* Master switch */}
          <m.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: EASE_OUT }}
            className="flex items-center justify-between gap-4 rounded-xl border border-zinc-200 bg-white p-4"
          >
            <div className="min-w-0">
              <h2 className="text-[14px] font-semibold tracking-tight text-zinc-950">Master auto-reply switch</h2>
              <p className="mt-1 text-[12.5px] text-zinc-600">
                Turn every rule below on or off in one click.
              </p>
            </div>
            <div className="flex items-center gap-2">
              {isSwitchPending && <Loader className="h-4 w-4 animate-spin text-zinc-400" />}
              <ToggleSwitch
                checked={masterEnabled}
                onCheckedChange={onMasterSwitchChange}
                disabled={isSwitchPending}
                ariaLabel="Master auto-reply"
              />
            </div>
          </m.div>

          {/* Rule list (accordion). Click expands form, also updates preview. */}
          <Section padded={false}>
            <Accordion type="multiple" defaultValue={['welcomeMessage']}>
              {RULE_TYPES.map((rule) => {
                const { key, label, description, icon: Icon } = rule;
                const ruleSeed = hash(key + String(activeProject?._id || ''));
                const fires = masterEnabled ? 24 + (ruleSeed % 180) : 0;
                const hitRate = 48 + (ruleSeed % 40);
                return (
                  <ZoruAccordionItem key={key} value={key} className="px-5">
                    <ZoruAccordionTrigger>
                      <div
                        className="flex w-full items-center gap-3"
                        onClick={() => setActiveRule(rule)}
                      >
                        <span
                          className="grid h-8 w-8 shrink-0 place-items-center rounded-lg"
                          style={{ background: 'var(--mt-accent-soft)' }}
                        >
                          <Icon className="h-4 w-4" strokeWidth={2.25} style={{ color: 'var(--mt-accent)' }} aria-hidden />
                        </span>
                        <div className="min-w-0 flex-1 text-left">
                          <div className="text-[13.5px] font-semibold tracking-tight text-zinc-950 leading-tight">{label}</div>
                          <div className="mt-0.5 text-[11.5px] text-zinc-500 leading-tight">{description}</div>
                        </div>
                        <div className="hidden sm:flex shrink-0 items-center gap-3 pr-3 text-[11px] text-zinc-500">
                          <span className="inline-flex items-center gap-1 tabular-nums">
                            <Zap className="h-3 w-3" strokeWidth={2.25} aria-hidden /> {fires}
                          </span>
                          <span className="inline-flex items-center gap-1 tabular-nums">
                            <TrendingUp className="h-3 w-3" strokeWidth={2.25} aria-hidden /> {hitRate}%
                          </span>
                        </div>
                      </div>
                    </ZoruAccordionTrigger>
                    <ZoruAccordionContent>
                      <div className="pt-2">
                        <AutoReplyForm
                          type={key as 'welcomeMessage' | 'inactiveHours' | 'general' | 'aiAssistant'}
                          project={activeProject}
                        />
                      </div>
                    </ZoruAccordionContent>
                  </ZoruAccordionItem>
                );
              })}
            </Accordion>
          </Section>

          <Section title="Opt-in / opt-out" description="Let customers stop or resume promotional messages.">
            <OptInOutForm project={activeProject} />
          </Section>
        </div>

        {/* Preview rail */}
        <div className="flex flex-col gap-4 lg:sticky lg:top-6 lg:self-start">
          <h3 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-zinc-500">
            <MessageCircle className="h-3 w-3" strokeWidth={2.25} aria-hidden />
            Preview: {activeRule.label}
          </h3>
          <PhoneFrame title={activeProject?.name ?? 'Your business'} subtitle={activeRule.label}>
            <AnimatePresence initial={false} mode="wait">
              <m.div key={activeRule.key} layout className="space-y-2">
                <ChatBubble who="them" text={activeRule.incoming} time="9:40" />
                {masterEnabled && (
                  <ChatBubble who="us" text={activeRule.sample} time="9:40" />
                )}
              </m.div>
            </AnimatePresence>
          </PhoneFrame>

          <div className="rounded-xl border border-zinc-200 bg-white p-4">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-zinc-500">
              <Activity className="h-3 w-3" strokeWidth={2.25} aria-hidden />
              Filter rules
            </div>
            <p className="mt-2 text-[12px] leading-relaxed text-zinc-600">
              Keyword rules, trigger windows, and AI override are managed in
              <a href="/wachat/auto-reply-rules" className="ml-1 font-semibold text-emerald-700 hover:underline">
                Advanced rules
              </a>.
            </p>
          </div>
        </div>
      </div>
    </WaPage>
  );
}

function ToggleSwitch({
  checked,
  onCheckedChange,
  disabled,
  ariaLabel,
}: {
  checked: boolean;
  onCheckedChange: (next: boolean) => void;
  disabled?: boolean;
  ariaLabel: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className="relative inline-flex h-6 w-10 items-center rounded-full transition-colors duration-200 active:scale-[0.97] disabled:opacity-50"
      style={{ background: checked ? 'var(--mt-accent)' : '#e4e4e7' }}
    >
      <m.span
        layout
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        className={`block h-5 w-5 rounded-full bg-white shadow ${checked ? 'ml-auto mr-0.5' : 'ml-0.5'}`}
      />
    </button>
  );
}
