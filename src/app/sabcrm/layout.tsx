export const dynamic = 'force-dynamic';

/**
 * /sabcrm layout — native SabCRM inside the shared SabNode shell.
 *
 * SabCRM is a metadata-driven CRM built natively in SabNode (metadata in Mongo,
 * server actions for CRUD, ZoruUI for rendering). This layout wraps every
 * `/sabcrm/*` page in `ZoruHomeShell` — the SAME vertical app rail, header,
 * sidebar, bottom dock and ⌘K command palette used by `/dashboard` — so SabCRM
 * is a first-class citizen of the SabNode app shell rather than a bolt-on.
 *
 * Mirrors `src/app/dashboard/layout.tsx`: session/onboarding/RBAC guard,
 * ProjectProvider + LocaleProvider, server-resolved locale, plan-card credits.
 */

import '@/styles/zoruui.css';

import React from 'react';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { ZoruHomeShell } from '@/components/zoruui';
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

  // Collapse the per-channel credits map to a single total for the
  // sidebar plan-card readout (same logic as /dashboard).
  const credits = user?.credits;
  const totalCredits =
    typeof credits === 'number'
      ? credits
      : credits && typeof credits === 'object'
        ? Object.values(credits).reduce<number>(
            (sum, v) => sum + (typeof v === 'number' ? v : 0),
            0,
          )
        : 0;

  return (
    <RBACGuard>
      <LocaleProvider initialLocale={locale}>
        <ProjectProvider initialProjects={projects} user={user}>
          <ZoruHomeShell
            user={{
              name: user?.name,
              email: user?.email,
              avatar: user?.image,
              role: user?.role,
            }}
            plan={{
              name: user?.plan?.name,
              credits: totalCredits,
            }}
          >
            {children}
          </ZoruHomeShell>
        </ProjectProvider>
      </LocaleProvider>
    </RBACGuard>
  );
}
