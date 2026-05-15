/**
 * /sabwa — Overview dashboard.
 *
 * Server Component shell. Pre-fetches everything that's safe to know
 * server-side (session, projects, plan caps) and hands a typed
 * `bootstrap` snapshot down to the client component. Per-session live
 * data (analytics, scheduled queue, audit feed, status stream) is the
 * client's job, since the *active* SabWa session id is a per-tab pick
 * persisted client-side.
 *
 * Source of truth: SABWA_PLAN.md § 6 page 1.
 */

import * as React from 'react';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import type { WithId } from 'mongodb';

import { getCachedSession, getCachedProjects } from '@/lib/server-cache';
import { listSessions } from '@/app/actions/sabwa.actions';
import { getSabwaLimits } from '@/lib/sabwa/plan-limits';
import type { SabwaSession } from '@/lib/sabwa/types';
import type { Project } from '@/lib/definitions';

import {
  OverviewClient,
  type OverviewBootstrap,
  type OverviewSessionSummary,
} from '../_components/overview-client';

export const metadata: Metadata = {
  title: 'Overview — SabWa',
  description:
    'At-a-glance dashboard for your connected WhatsApp account: presence, activity, queue health, ban-risk, and quick actions.',
};

// Force dynamic — the page reads the session cookie + Mongo on every
// request. The expensive parts (sessions, audit, analytics) are not
// cacheable per-project until the Rust engine is online.
export const dynamic = 'force-dynamic';

/**
 * Attempt to fetch the list of paired SabWa sessions for the given
 * project. The Phase-1 stub throws `_NOT_IMPLEMENTED_`, so we swallow
 * the exception and yield an empty array — the page renders the
 * "connect" empty state instead of crashing.
 */
async function safeListSessions(
  projectId: string | null,
): Promise<SabwaSession[]> {
  if (!projectId) return [];
  try {
    const result = await listSessions(projectId);
    if (result.ok) return result.sessions ?? [];
    return [];
  } catch {
    return [];
  }
}

function toSummary(s: SabwaSession): OverviewSessionSummary {
  return {
    sessionId: s._id.toString(),
    projectId: s.projectId.toString(),
    phoneE164: s.phoneE164,
    pushName: s.pushName,
    profilePicUrl: s.profilePicUrl,
    label: s.label,
    status: s.status,
    rateLimitProfile: s.rateLimitProfile,
    warmupEnabled: s.warmupEnabled,
  };
}

export default async function SabwaOverviewPage() {
  const session = await getCachedSession();
  if (!session?.user) {
    redirect('/login');
  }

  const projects = ((await getCachedProjects()) ?? []) as WithId<Project>[];
  // The active project is selected client-side (localStorage). On the
  // server we conservatively pick the first project belonging to the
  // current user — the client will swap to the user's chosen project on
  // mount if it differs. This keeps the empty-vs-connected branch
  // correct for the most common case (single project).
  const projectId =
    projects.length > 0 ? projects[0]!._id.toString() : null;

  const rawSessions = await safeListSessions(projectId);
  const sessions = rawSessions.map(toSummary);

  const planName =
    (session.user as { plan?: { name?: string } | null } | undefined)?.plan
      ?.name ?? 'free';
  const planLimits = getSabwaLimits(planName);

  const bootstrap: OverviewBootstrap = {
    projectId,
    sessions,
    initialSessionId: sessions[0]?.sessionId ?? null,
    planLimits,
    planName,
  };

  return <OverviewClient bootstrap={bootstrap} />;
}
