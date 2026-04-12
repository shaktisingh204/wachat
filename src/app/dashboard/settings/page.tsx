'use client';

/**
 * Wachat Project Settings — rebuilt on Clay primitives.
 *
 * Hosts 5 settings tabs as Clay-styled pill selectors:
 *   General / Auto-reply / Agents & roles / User attributes / Canned messages
 *
 * Each tab still renders its existing form component (they contain
 * real form logic I'm not rewriting — they inherit Clay via shadcn
 * token remap).
 */

import * as React from 'react';
import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { WithId, User, Plan } from '@/lib/definitions';

import {
  LuCircleAlert,
  LuSettings,
  LuReply,
  LuUsers,
  LuKey,
  LuBookmark,
} from 'react-icons/lu';

import { useProject } from '@/context/project-context';
import { ProjectSettingsForm } from '@/components/wabasimplify/project-settings-form';
import { AutoReplySettingsTab } from '@/components/wabasimplify/auto-reply-settings-tab';
import { AgentsRolesSettingsTab } from '@/components/wabasimplify/agents-roles-settings-tab';
import { UserAttributesSettingsTab } from '@/components/wabasimplify/user-attributes-settings-tab';
import { CannedMessagesSettingsTab } from '@/components/wabasimplify/canned-messages-settings-tab';
import { getSession } from '@/app/actions/index.ts';

import { cn } from '@/lib/utils';
import { ClayBreadcrumbs, ClayButton, ClayCard } from '@/components/clay';

type TabId = 'general' | 'auto-reply' | 'agents' | 'attributes' | 'canned-messages';

const TABS: Array<{
  id: TabId;
  label: string;
  icon: React.ReactNode;
  description: string;
}> = [
  {
    id: 'general',
    label: 'General',
    icon: <LuSettings className="h-3.5 w-3.5" strokeWidth={2} />,
    description: 'Project name, WABA ID, tags, and basic configuration.',
  },
  {
    id: 'auto-reply',
    label: 'Auto-reply',
    icon: <LuReply className="h-3.5 w-3.5" strokeWidth={2} />,
    description: 'Away messages, greeting replies, and keyword triggers.',
  },
  {
    id: 'agents',
    label: 'Agents & roles',
    icon: <LuUsers className="h-3.5 w-3.5" strokeWidth={2} />,
    description: 'Invite teammates and configure role-based permissions.',
  },
  {
    id: 'attributes',
    label: 'User attributes',
    icon: <LuKey className="h-3.5 w-3.5" strokeWidth={2} />,
    description: 'Custom contact fields for segmentation and personalization.',
  },
  {
    id: 'canned-messages',
    label: 'Canned messages',
    icon: <LuBookmark className="h-3.5 w-3.5" strokeWidth={2} />,
    description: 'Pre-written message snippets your agents can send instantly.',
  },
];

export default function WachatSettingsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { activeProject, isLoadingProject } = useProject();

  const initialTab = (searchParams.get('tab') as TabId) || 'general';
  const [tab, setTab] = useState<TabId>(
    TABS.some((t) => t.id === initialTab) ? initialTab : 'general',
  );

  const [user, setUser] = useState<
    (Omit<User, 'password'> & { plan?: WithId<Plan> | null }) | null
  >(null);

  useEffect(() => {
    getSession().then((session) => {
      if (session?.user) {
        setUser(session.user as any);
      }
    });
  }, []);

  const currentTabMeta = TABS.find((t) => t.id === tab) ?? TABS[0];

  const header = (
    <>
      <ClayBreadcrumbs
        items={[
          { label: 'Wachat', href: '/home' },
          { label: activeProject?.name || 'Project', href: '/dashboard' },
          { label: 'Settings' },
        ]}
      />
      <div>
        <h1 className="text-[30px] font-semibold tracking-[-0.015em] text-clay-ink leading-[1.1]">
          Project settings
        </h1>
        <p className="mt-1.5 max-w-[720px] text-[13px] text-clay-ink-muted">
          {activeProject
            ? `Configure ${activeProject.name}'s WhatsApp behavior, auto-reply rules, team access, and canned messages.`
            : "Configure your project's WhatsApp behavior, auto-reply rules, team access, and canned messages."}
        </p>
      </div>
    </>
  );

  if (isLoadingProject) {
    return (
      <div className="clay-enter flex min-h-full flex-col gap-6">
        {header}
        <div className="h-[420px] animate-pulse rounded-clay-lg bg-clay-bg-2" />
      </div>
    );
  }

  if (!activeProject) {
    return (
      <div className="clay-enter flex min-h-full flex-col gap-6">
        {header}
        <ClayCard padded={false} className="p-10 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-clay-rose-soft text-clay-rose-ink">
            <LuCircleAlert className="h-5 w-5" strokeWidth={1.5} />
          </div>
          <div className="mt-4 text-[15px] font-semibold text-clay-ink">
            No project selected
          </div>
          <div className="mt-1.5 text-[12.5px] text-clay-ink-muted">
            Please select a project from the main dashboard to configure its
            settings.
          </div>
          <ClayButton
            variant="rose"
            size="md"
            onClick={() => router.push('/dashboard')}
            className="mt-5"
          >
            Choose a project
          </ClayButton>
        </ClayCard>
      </div>
    );
  }

  return (
    <div className="clay-enter flex min-h-full flex-col gap-6">
      {header}

      {/* Tab pills */}
      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              'inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-[12.5px] font-medium transition-[background,border-color,color]',
              tab === t.id
                ? 'bg-clay-obsidian border-clay-obsidian text-white shadow-clay-card'
                : 'bg-clay-surface border-clay-border text-clay-ink-muted hover:text-clay-ink hover:border-clay-border-strong',
            )}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab description strip */}
      <div className="rounded-[12px] border border-clay-border bg-clay-surface-2 px-4 py-3">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-clay-ink-muted">
          {currentTabMeta.label}
        </div>
        <div className="mt-0.5 text-[12.5px] text-clay-ink">
          {currentTabMeta.description}
        </div>
      </div>

      {/* Tab body */}
      <ClayCard padded={false} className="p-6">
        {tab === 'general' ? (
          <ProjectSettingsForm project={activeProject} />
        ) : tab === 'auto-reply' ? (
          <AutoReplySettingsTab project={activeProject} />
        ) : tab === 'agents' ? (
          user ? (
            <AgentsRolesSettingsTab project={activeProject} user={user} />
          ) : (
            <div className="h-40 w-full animate-pulse rounded-[10px] bg-clay-bg-2" />
          )
        ) : tab === 'attributes' ? (
          <UserAttributesSettingsTab project={activeProject} />
        ) : (
          <CannedMessagesSettingsTab project={activeProject} />
        )}
      </ClayCard>

      <div className="h-6" />
    </div>
  );
}
