'use client';

import {
  Accordion,
  ZoruAccordionContent,
  ZoruAccordionItem,
  ZoruAccordionTrigger,
  useZoruToast,
} from '@/components/zoruui';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  CircleAlert,
  ListFilter,
  Loader,
  Sparkles,
  MessageCircle,
  Clock,
  Bot,
} from 'lucide-react';
import { m } from 'motion/react';

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
} from '@/components/wachat-ui';
import { EASE_OUT } from '@/components/dashboard-ui/module-theme';

import * as React from 'react';

const RULE_TYPES = [
  {
    key: 'welcomeMessage',
    label: 'Welcome message',
    description: 'Greet new contacts when they message you for the first time.',
    icon: MessageCircle,
  },
  {
    key: 'inactiveHours',
    label: 'Away / business hours',
    description: 'Reply automatically when your team is offline.',
    icon: Clock,
  },
  {
    key: 'general',
    label: 'General auto-reply',
    description: 'Default response for any message that does not match a rule.',
    icon: Sparkles,
  },
  {
    key: 'aiAssistant',
    label: 'AI assistant',
    description: 'Use AI to respond to incoming chats based on your knowledge base.',
    icon: Bot,
  },
] as const;

export default function AutoReplyPage() {
  const router = useRouter();
  const { activeProject, isLoadingProject } = useProject();
  const { toast } = useZoruToast();
  const [isSwitchPending, startSwitchTransition] = useTransition();
  const [masterEnabled, setMasterEnabled] = useState<boolean>(
    activeProject?.autoReplySettings?.masterEnabled !== false,
  );

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
        description="Configure automatic responses: welcome messages, business-hour away messages, AI-powered replies, and keyword-based rules."
        kicker="Wachat"
        backHref="/wachat"
        eyebrowIcon={MessageCircle}
        actions={
          <WaButton variant="outline" size="sm" leftIcon={ListFilter} onClick={() => router.push('/wachat/auto-reply-rules')}>
            Advanced rules
          </WaButton>
        }
      />

      {/* Master switch */}
      <m.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: EASE_OUT }}
        className="mb-6 flex items-center justify-between gap-4 rounded-2xl border border-zinc-200 bg-white p-5"
      >
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold tracking-tight text-zinc-950">Master auto-reply switch</h2>
          <p className="mt-1 text-[13px] text-zinc-600">
            Enable or disable all auto-reply functionality for this project.
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

      {/* Accordion of rule types */}
      <Section padded={false}>
        <Accordion type="multiple" defaultValue={['welcomeMessage']}>
          {RULE_TYPES.map(({ key, label, description, icon: Icon }) => (
            <ZoruAccordionItem key={key} value={key} className="px-5">
              <ZoruAccordionTrigger>
                <div className="flex items-center gap-3">
                  <span
                    className="grid h-8 w-8 place-items-center rounded-lg"
                    style={{ background: 'var(--mt-accent-soft)' }}
                  >
                    <Icon className="h-4 w-4" strokeWidth={2.25} style={{ color: 'var(--mt-accent)' }} aria-hidden />
                  </span>
                  <div className="text-left">
                    <div className="text-[14px] font-semibold tracking-tight text-zinc-950 leading-tight">{label}</div>
                    <div className="mt-0.5 text-[12px] text-zinc-500 leading-tight">{description}</div>
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
          ))}
        </Accordion>
      </Section>

      <div className="mt-6">
        <Section title="Opt-in / opt-out" description="Let customers stop or resume promotional messages.">
          <OptInOutForm project={activeProject} />
        </Section>
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
