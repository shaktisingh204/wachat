export const dynamic = 'force-dynamic';

/**
 * /sabcrm layout — guarded shell for the embedded SabCRM (Twenty) SPA.
 *
 * SabCRM is the vendored Twenty engine (`services/sabcrm/`) embedded into
 * the SabNode shell. The engine renders its own full-screen SPA (mounted by
 * `./page.tsx` via an iframe / status fallback), so unlike `/sabwa` this
 * layout deliberately does NOT wrap children in a bespoke SabNode chrome or a
 * module-specific session provider — it only enforces the SabNode auth /
 * onboarding / RBAC guard and provides project context, then hands off to the
 * embedded SPA inside the `.zoruui` scope.
 *
 * Auth/project guard mirrors `src/app/sabwa/layout.tsx`.
 */

import '@/styles/zoruui.css';

import * as React from 'react';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { getCachedSession, getCachedProjects } from '@/lib/server-cache';
import { RBACGuard } from '@/components/zoruui-domain/rbac-guard';
import { ProjectProvider } from '@/context/project-context';

export const metadata: Metadata = {
  title: 'SabCRM',
  description:
    'SabCRM — the embedded Twenty CRM engine, operated from inside the SabNode shell.',
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

  return (
    <RBACGuard>
      <ProjectProvider initialProjects={projects} user={user}>
        <div className="zoruui">{children}</div>
      </ProjectProvider>
    </RBACGuard>
  );
}
