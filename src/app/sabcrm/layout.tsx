export const dynamic = 'force-dynamic';

/**
 * /sabcrm layout — auth guard and project context for the native SabCRM.
 *
 * SabCRM is a metadata-driven CRM built natively in SabNode (metadata in Mongo,
 * server actions for CRUD, ZoruUI for rendering). This layout enforces the
 * SabNode auth / onboarding / RBAC guard and provides project context via
 * ProjectProvider. All child routes render within the `.zoruui` scope.
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
