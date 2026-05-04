'use client';

/**
 * /wachat/auto-reply — Auto-Reply settings page (ZoruUI).
 *
 * Master switch + per-rule-type accordion (welcome, away, general, AI).
 * Visual layer only — server actions and same data flow are unchanged.
 */

import * as React from 'react';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CircleAlert, ListFilter, Loader, Sparkles, MessageCircle, Clock, Bot } from 'lucide-react';

import { useProject } from '@/context/project-context';
import { handleUpdateMasterSwitch } from '@/app/actions/project.actions';
import { AutoReplyForm } from '@/components/wabasimplify/auto-reply-form';
import { OptInOutForm } from '@/components/wabasimplify/opt-in-out-form';

import {
  ZoruAccordion,
  ZoruAccordionContent,
  ZoruAccordionItem,
  ZoruAccordionTrigger,
  ZoruBreadcrumb,
  ZoruBreadcrumbItem,
  ZoruBreadcrumbLink,
  ZoruBreadcrumbList,
  ZoruBreadcrumbPage,
  ZoruBreadcrumbSeparator,
  ZoruButton,
  ZoruCard,
  ZoruEmptyState,
  ZoruPageActions,
  ZoruPageDescription,
  ZoruPageHeader,
  ZoruPageHeading,
  ZoruPageTitle,
  ZoruSeparator,
  ZoruSkeleton,
  ZoruSwitch,
  useZoruToast,
} from '@/components/zoruui';

export const dynamic = 'force-dynamic';

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
      <div className="mx-auto w-full max-w-[1320px] px-6 pt-6 pb-10">
        <ZoruSkeleton className="h-3 w-52" />
        <div className="mt-5 flex items-end justify-between">
          <ZoruSkeleton className="h-9 w-56" />
          <ZoruSkeleton className="h-9 w-32 rounded-full" />
        </div>
        <div className="mt-6 space-y-4">
          <ZoruSkeleton className="h-[120px]" />
          <ZoruSkeleton className="h-[420px]" />
        </div>
      </div>
    );
  }

  if (!activeProject) {
    return (
      <div className="mx-auto w-full max-w-[1320px] px-6 pt-6 pb-10">
        <ZoruBreadcrumb>
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
              <ZoruBreadcrumbPage>Auto Reply</ZoruBreadcrumbPage>
            </ZoruBreadcrumbItem>
          </ZoruBreadcrumbList>
        </ZoruBreadcrumb>
        <div className="mt-6">
          <ZoruEmptyState
            icon={<CircleAlert />}
            title="No project selected"
            description="Pick a WaChat project to configure auto-reply behaviour."
            action={
              <ZoruButton onClick={() => router.push('/wachat')}>
                Choose a project
              </ZoruButton>
            }
          />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1320px] px-6 pt-6 pb-10">
      <ZoruBreadcrumb>
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
            <ZoruBreadcrumbPage>Auto Reply</ZoruBreadcrumbPage>
          </ZoruBreadcrumbItem>
        </ZoruBreadcrumbList>
      </ZoruBreadcrumb>

      <ZoruPageHeader className="mt-5">
        <ZoruPageHeading>
          <ZoruPageTitle>Auto Reply</ZoruPageTitle>
          <ZoruPageDescription>
            Configure automatic responses: welcome messages, business-hour away
            messages, AI-powered replies, and keyword-based rules.
          </ZoruPageDescription>
        </ZoruPageHeading>
        <ZoruPageActions>
          <ZoruButton
            variant="outline"
            size="sm"
            onClick={() => router.push('/wachat/auto-reply-rules')}
          >
            <ListFilter /> Advanced rules
          </ZoruButton>
        </ZoruPageActions>
      </ZoruPageHeader>

      {/* Master switch */}
      <ZoruCard className="mt-6 p-5">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-[15px] text-zoru-ink">Master auto-reply switch</h2>
            <p className="mt-1 text-[13px] text-zoru-ink-muted">
              Enable or disable all auto-reply functionality for this project.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {isSwitchPending && (
              <Loader className="h-4 w-4 animate-spin text-zoru-ink-muted" />
            )}
            <ZoruSwitch
              checked={masterEnabled}
              onCheckedChange={onMasterSwitchChange}
              disabled={isSwitchPending}
              aria-label="Master auto-reply"
            />
          </div>
        </div>
      </ZoruCard>

      <ZoruSeparator className="my-6" />

      {/* Per rule-type accordion */}
      <ZoruCard className="p-0">
        <ZoruAccordion type="multiple" defaultValue={['welcomeMessage']}>
          {RULE_TYPES.map(({ key, label, description, icon: Icon }) => (
            <ZoruAccordionItem key={key} value={key} className="px-5">
              <ZoruAccordionTrigger>
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-[var(--zoru-radius-sm)] bg-zoru-surface-2 text-zoru-ink [&_svg]:size-4">
                    <Icon />
                  </span>
                  <div className="text-left">
                    <div className="text-[14px] text-zoru-ink leading-tight">{label}</div>
                    <div className="mt-0.5 text-[12px] text-zoru-ink-muted leading-tight">
                      {description}
                    </div>
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
        </ZoruAccordion>
      </ZoruCard>

      <ZoruSeparator className="my-6" />

      {/* Opt-in / opt-out — separate concern */}
      <ZoruCard className="p-5">
        <OptInOutForm project={activeProject} />
      </ZoruCard>

      <div className="h-6" />
    </div>
  );
}
