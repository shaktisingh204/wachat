'use client';

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  Button,
  Card,
  EmptyState,
  Skeleton,
  Spinner,
  Switch,
  useToast,
} from '@/components/sabcrm/20ui';
import {
  useState,
  useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CircleAlert,
  ListFilter,
  Sparkles,
  MessageCircle,
  Clock,
  Bot } from 'lucide-react';

import { WachatPage } from '@/app/wachat/_components/wachat-page';
import { useProject } from '@/context/project-context';
import { updateMasterSwitch } from '@/app/actions/wachat-auto-reply-settings.actions';
import { AutoReplyForm } from '@/app/wachat/_components/auto-reply-form';
import { OptInOutForm } from '@/app/wachat/_components/opt-in-out-form';

/**
 * /wachat/auto-reply — Auto-Reply settings page (20ui).
 *
 * Master switch + per-rule-type accordion (welcome, away, general, AI).
 * Visual layer only — server actions and same data flow are unchanged.
 */

import * as React from 'react';

function cx(...a: Array<string | false | null | undefined>): string {
  return a.filter(Boolean).join(' ');
}

const BREADCRUMB = [
  { label: 'SabNode', href: '/dashboard' },
  { label: 'WaChat', href: '/wachat' },
  { label: 'Auto Reply' },
];

const PAGE_DESCRIPTION =
  'Configure automatic responses: welcome messages, business-hour away messages, AI-powered replies, and keyword-based rules.';

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
  const { toast } = useToast();
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
      const result = await updateMasterSwitch(activeProject._id.toString(), checked);
      if (result.error) {
        toast({ title: 'Error', description: result.error, tone: 'danger' });
        setMasterEnabled(!checked);
      } else {
        toast({ title: 'Saved', description: result.message, tone: 'success' });
      }
    });
  };

  if (isLoadingProject) {
    return (
      <WachatPage breadcrumb={BREADCRUMB} width="narrow">
        <Skeleton className="h-9 w-56" />
        <Skeleton className="h-[120px]" />
        <Skeleton className="h-[420px]" />
      </WachatPage>
    );
  }

  if (!activeProject) {
    return (
      <WachatPage breadcrumb={BREADCRUMB} width="narrow">
        <EmptyState
          icon={CircleAlert}
          title="No project selected"
          description="Pick a WaChat project to configure auto-reply behaviour."
          action={
            <Button variant="primary" onClick={() => router.push('/wachat')}>
              Choose a project
            </Button>
          }
        />
      </WachatPage>
    );
  }

  return (
    <WachatPage
      breadcrumb={BREADCRUMB}
      title="Auto Reply"
      description={PAGE_DESCRIPTION}
      width="narrow"
      actions={
        <Button
          variant="outline"
          size="sm"
          iconLeft={ListFilter}
          onClick={() => router.push('/wachat/auto-reply-rules')}
        >
          Advanced rules
        </Button>
      }
    >
      {/* Master switch */}
      <Card padding="lg">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-[15px] text-[var(--st-text)]">
              Master auto-reply switch
            </h2>
            <p className="mt-1 text-[13px] text-[var(--st-text-secondary)]">
              Enable or disable all auto-reply functionality for this project.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {isSwitchPending && <Spinner size="sm" label="Saving" />}
            <Switch
              checked={masterEnabled}
              onCheckedChange={onMasterSwitchChange}
              disabled={isSwitchPending}
              aria-label="Master auto-reply"
            />
          </div>
        </div>
      </Card>

      {/* Per rule-type accordion */}
      <Card padding="none">
        <Accordion type="multiple" defaultValue={['welcomeMessage']}>
          {RULE_TYPES.map(({ key, label, description, icon: Icon }) => (
            <AccordionItem key={key} value={key} className="px-5">
              <AccordionTrigger>
                <div className="flex items-center gap-3">
                  <span
                    className="flex h-8 w-8 items-center justify-center rounded-[var(--st-radius)] bg-[var(--st-bg-secondary)] text-[var(--st-text)] [&_svg]:size-4"
                    aria-hidden="true"
                  >
                    <Icon />
                  </span>
                  <div className="text-left">
                    <div className="text-[14px] leading-tight text-[var(--st-text)]">
                      {label}
                    </div>
                    <div className="mt-0.5 text-[12px] leading-tight text-[var(--st-text-secondary)]">
                      {description}
                    </div>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="pt-2">
                  <AutoReplyForm
                    type={key as 'welcomeMessage' | 'inactiveHours' | 'general' | 'aiAssistant'}
                    project={activeProject}
                  />
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </Card>

      {/* Opt-in / opt-out — separate concern */}
      <Card padding="lg">
        <OptInOutForm project={activeProject} />
      </Card>
    </WachatPage>
  );
}
