'use client';

/**
 * /wachat/auto-reply — Auto-Reply settings page.
 * Manages welcome messages, away/business hours, AI assistant, and keyword rules.
 */

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { LuCircleAlert, LuListFilter } from 'react-icons/lu';
import { useProject } from '@/context/project-context';
import { AutoReplySettingsTab } from '@/components/wabasimplify/auto-reply-settings-tab';
import { ClayBreadcrumbs, ClayButton, ClayCard } from '@/components/clay';

export const dynamic = 'force-dynamic';

export default function AutoReplyPage() {
  const router = useRouter();
  const { activeProject, isLoadingProject } = useProject();

  if (isLoadingProject) {
    return (
      <div className="clay-enter flex min-h-full flex-col gap-6">
        <ClayBreadcrumbs items={[{ label: 'Wachat', href: '/dashboard' }, { label: 'Auto Reply' }]} />
        <div className="h-[420px] animate-pulse rounded-xl bg-muted" />
      </div>
    );
  }

  if (!activeProject) {
    return (
      <div className="clay-enter flex min-h-full flex-col gap-6">
        <ClayBreadcrumbs items={[{ label: 'Wachat', href: '/dashboard' }, { label: 'Auto Reply' }]} />
        <ClayCard className="p-10 text-center">
          <LuCircleAlert className="mx-auto h-10 w-10 text-muted-foreground/30 mb-4" />
          <p className="text-sm text-muted-foreground">Select a project first.</p>
          <ClayButton variant="obsidian" size="md" onClick={() => router.push('/wachat')} className="mt-4">Choose a project</ClayButton>
        </ClayCard>
      </div>
    );
  }

  return (
    <div className="clay-enter flex min-h-full flex-col gap-6">
      <ClayBreadcrumbs items={[
        { label: 'Wachat', href: '/dashboard' },
        { label: activeProject.name, href: '/wachat' },
        { label: 'Auto Reply' },
      ]} />

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[30px] font-semibold tracking-[-0.015em] text-foreground leading-[1.1]">
            Auto Reply
          </h1>
          <p className="mt-1.5 max-w-[720px] text-[13px] text-muted-foreground">
            Configure automatic responses: welcome messages, business hours away messages, AI-powered replies, and keyword-based rules.
          </p>
        </div>
        <ClayButton
          variant="pill"
          size="sm"
          leading={<LuListFilter className="h-3.5 w-3.5" strokeWidth={2} />}
          onClick={() => router.push('/wachat/auto-reply-rules')}
        >
          Advanced rules
        </ClayButton>
      </div>

      <AutoReplySettingsTab project={activeProject} />
    </div>
  );
}
