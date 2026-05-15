/**
 * /sabwa — All Projects landing for SabWa.
 *
 * Server Component shell. Pre-fetches the user's projects so the
 * client picker hydrates immediately. Live SabWa session counts per
 * project (number of paired WhatsApp accounts) are fetched on the
 * client because they depend on the engine being reachable.
 *
 * Flow:
 *   /sabwa  ─►  pick / create a project  ─►  /sabwa/connect or
 *                                            /sabwa/overview
 */

import * as React from 'react';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import type { WithId } from 'mongodb';

import { getCachedSession, getCachedProjects } from '@/lib/server-cache';
import type { Project } from '@/lib/definitions';

import { AllProjectsClient, type AllProjectsBootstrap } from './_components/all-projects-client';

export const metadata: Metadata = {
  title: 'Projects — SabWa',
  description:
    'Pick or create a SabNode project to link your personal WhatsApp number with SabWa.',
};

export const dynamic = 'force-dynamic';

export default async function SabwaAllProjectsPage() {
  const session = await getCachedSession();
  if (!session?.user) {
    redirect('/login');
  }

  const projects = ((await getCachedProjects()) ?? []) as WithId<Project>[];

  const bootstrap: AllProjectsBootstrap = {
    projects: projects.map((p) => ({
      id: p._id.toString(),
      name: p.name ?? 'Untitled project',
      groupName: (p as any).groupName ?? null,
      wabaId: (p as any).wabaId ?? null,
      phoneNumber:
        ((p as any).phoneNumbers?.[0]?.display_phone_number as
          | string
          | undefined) ?? null,
    })),
  };

  return <AllProjectsClient bootstrap={bootstrap} />;
}
