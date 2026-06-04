export const dynamic = 'force-dynamic';

/**
 * /sabcrm layout — native SabCRM inside the shared SabNode shell.
 *
 * SabCRM is a metadata-driven CRM, rendered here in a Twenty-faithful frame.
 * This layout keeps ALL of the SabNode gating (session/onboarding/RBAC guard)
 * and the React context providers (ProjectProvider + LocaleProvider) so pages
 * can call `useProject()` and the gated server actions resolve a project — but
 * it swaps the visual shell from `ZoruHomeShell` to `TwentyAppFrame` so every
 * `/sabcrm/*` page renders inside Twenty's sidebar + main frame.
 *
 * Mirrors `src/app/dashboard/layout.tsx` for the gating pipeline; only the
 * visual chrome differs (Twenty's `.sabcrm-twenty` scope, not the ZoruUI shell).
 */

import React from 'react';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { TwentyAppFrame } from '@/components/sabcrm/twenty';
import { SabcrmOuterShell } from '@/components/sabcrm/twenty/sabcrm-outer-shell';
import { TwentyEmbed } from '@/components/sabcrm/twenty/twenty-embed';
import { getCachedSession, getCachedProjects } from '@/lib/server-cache';
import { RBACGuard } from '@/components/zoruui-domain/rbac-guard';
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

  // Production switch: when SABCRM_USE_TWENTY_FRONT=true the route hosts the
  // real built `twenty-front` SPA (blueprint verdict); otherwise it serves the
  // native `.sabcrm-twenty` pages. EITHER way the content is wrapped in
  // `SabcrmOuterShell` so the SabNode app rail + header are always present.
  const useTwentyFront = process.env.SABCRM_USE_TWENTY_FRONT === 'true';

  return (
    <RBACGuard>
      <LocaleProvider initialLocale={locale}>
        <ProjectProvider initialProjects={projects} user={user}>
          <SabcrmOuterShell
            user={{
              name: user?.name,
              email: user?.email,
              avatar: user?.avatar ?? user?.picture,
              role: user?.role,
            }}
          >
            {useTwentyFront ? (
              <TwentyEmbed />
            ) : (
              <TwentyAppFrame>{children}</TwentyAppFrame>
            )}
          </SabcrmOuterShell>
        </ProjectProvider>
      </LocaleProvider>
    </RBACGuard>
  );
}
