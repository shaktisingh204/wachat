export const dynamic = 'force-dynamic';

/**
 * /sabcrm layout — native SabCRM inside the shared SabNode shell.
 *
 * SabCRM is a metadata-driven CRM suite. This layout keeps ALL of the SabNode
 * gating (session/onboarding/RBAC guard) and the React context providers
 * (ProjectProvider + LocaleProvider) so pages can call `useProject()` and the
 * gated server actions resolve a project — the inner column is the 20ui
 * `SabcrmSuiteFrame` (suite-grouped sidebar + command menu), which still
 * carries the `.sabcrm-twenty` token scope for not-yet-migrated pages.
 *
 * Mirrors `src/app/dashboard/layout.tsx` for the gating pipeline; only the
 * visual chrome differs (Twenty's `.sabcrm-twenty` scope, not the Ui20 shell).
 */

import React from 'react';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { SabcrmSuiteFrame } from '@/components/sabcrm/sabcrm-suite-frame';
import { SabcrmOuterShell } from '@/components/sabcrm/sabcrm-outer-shell';
import { SabcrmActorNameProvider } from '@/components/sabcrm/sabcrm-actors-context';
import { PwaRegister } from '@/components/sabcrm/pwa-register';
import { getCachedSession, getCachedProjects } from '@/lib/server-cache';
import { RBACGuard } from '@/components/20ui-domain/rbac-guard';
import { ProjectProvider } from '@/context/project-context';
import { LocaleProvider } from '@/lib/i18n/client';
import { getCurrentLocale } from '@/lib/i18n/server';

export const metadata: Metadata = {
  title: 'SabCRM',
  description:
    'SabCRM — the metadata-driven CRM, native to the SabNode workspace.',
};

export default async function SabcrmLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getCachedSession();
  if (!session?.user) {
    redirect('/login');
  }

  const user = session.user as any;

  const onboarding = user.onboarding;
  if (onboarding && onboarding.status !== 'complete') {
    redirect('/onboarding');
  }

  const projects = (await getCachedProjects()) || [];
  if (
    (!onboarding || onboarding.status !== 'complete') &&
    projects.length === 0
  ) {
    redirect('/onboarding');
  }

  const locale = await getCurrentLocale();

  // /sabcrm renders the native `.sabcrm-twenty` Next.js pages, wrapped in
  // `SabcrmOuterShell` (the SabNode app rail + header). The iframe-embed path
  // was removed — Twenty's UI is being ported into these native Next.js pages
  // (backed by twenty-server), not embedded.
  return (
    <RBACGuard>
      <LocaleProvider initialLocale={locale}>
        <ProjectProvider initialProjects={projects} user={user}>
          <PwaRegister />
          <SabcrmActorNameProvider>
            <SabcrmOuterShell
              user={{
                name: user?.name,
                email: user?.email,
                avatar: user?.avatar ?? user?.picture,
                role: user?.role,
              }}
            >
              <SabcrmSuiteFrame>{children}</SabcrmSuiteFrame>
            </SabcrmOuterShell>
          </SabcrmActorNameProvider>
        </ProjectProvider>
      </LocaleProvider>
    </RBACGuard>
  );
}
