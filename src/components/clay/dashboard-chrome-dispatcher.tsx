'use client';

/**
 * DashboardChromeDispatcher
 *
 * Client-side router that picks between Clay chrome and legacy
 * (DashboardClientLayout → AdminLayout) chrome based on the current
 * pathname. Lets us migrate `/dashboard/*` routes to Clay module-by-
 * module without breaking routes that haven't been migrated yet.
 *
 * For Wachat routes, this component itself owns the ProjectProvider +
 * AdManagerProvider so Wachat pages that call useProject() / useAdManager()
 * keep working inside Clay chrome.
 *
 * For every other route we fall back to DashboardClientLayout which
 * manages its own data fetching + context providers.
 */

import * as React from 'react';
import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';

import { DashboardClientLayout } from '@/components/wabasimplify/dashboard-client-layout';
import {
  ClayDashboardLayout,
  type ClayLayoutUser,
  type ClayLayoutPlan,
} from '@/components/clay';
import { ClayProjectGate } from './clay-project-gate';
import { ProjectProvider } from '@/context/project-context';
import { AdManagerProvider } from '@/context/ad-manager-context';
import { getProjects } from '@/app/actions/project.actions';
import { getSession } from '@/app/actions/user.actions';

/**
 * Module-level bootstrap cache.
 *
 * The dispatcher lives inside /dashboard/layout.tsx, which unmounts
 * whenever the user navigates to a route outside /dashboard/* (e.g.
 * /home) and remounts when they come back. Without a cache we'd
 * refetch the entire project list + session on every re-entry.
 *
 * This module-level record survives unmount/remount (it's just a
 * JS module scope) so subsequent entries render instantly from cache
 * and we refresh in the background. It DOES reset on a hard page
 * reload — that's intentional: a reload should always refetch.
 */
type WachatBootstrap = { user: any; projects: any[] };
let bootstrapCache: WachatBootstrap | null = null;
let inflightBootstrap: Promise<WachatBootstrap | null> | null = null;

async function fetchBootstrap(): Promise<WachatBootstrap | null> {
  if (inflightBootstrap) return inflightBootstrap;
  inflightBootstrap = (async () => {
    try {
      const [session, projects] = await Promise.all([
        getSession(),
        getProjects(),
      ]);
      if (!session?.user) return null;
      const next: WachatBootstrap = {
        user: session.user,
        projects: projects || [],
      };
      bootstrapCache = next;
      return next;
    } finally {
      inflightBootstrap = null;
    }
  })();
  return inflightBootstrap;
}

/**
 * Route prefixes owned by the Wachat module. If the current pathname
 * starts with any of these, Clay chrome (context="wachat") wraps the
 * children. Order doesn't matter — startsWith is evaluated in `some`.
 */
const WACHAT_PREFIXES = [
  '/dashboard/chat',
  '/dashboard/broadcasts',
  '/dashboard/templates',
  '/dashboard/contacts',
  '/dashboard/overview',
  '/dashboard/bulk',
  '/dashboard/canned-messages',
  '/dashboard/catalog',
  '/dashboard/calls',
  '/dashboard/flow-builder',
  '/dashboard/flows',
  '/dashboard/numbers',
  '/dashboard/webhooks',
  '/dashboard/auto-reply',
  '/dashboard/whatsapp-pay',
  '/dashboard/wachat',
];

function isWachatRoute(pathname: string | null): boolean {
  if (!pathname) return false;
  // /dashboard itself is the Wachat project selector (Clay chrome)
  if (pathname === '/dashboard' || pathname === '/dashboard/') return true;
  return WACHAT_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(p + '/'),
  );
}

export interface DashboardChromeDispatcherProps {
  user?: ClayLayoutUser;
  plan?: ClayLayoutPlan;
  children: React.ReactNode;
}

/**
 * Minimal loading placeholder shown while we fetch projects + session
 * on first mount for a Wachat route. Kept in sync with the Clay panel's
 * cream canvas so the transition to the real chrome is invisible.
 */
function ClayBootSkeleton() {
  return (
    <div className="clay-outer-shell relative w-full p-3 md:p-4">
      <div
        className="clay-panel"
        style={{ height: 'calc(100vh - 2rem)' }}
      />
    </div>
  );
}

export function DashboardChromeDispatcher({
  user,
  plan,
  children,
}: DashboardChromeDispatcherProps) {
  const pathname = usePathname();
  const router = useRouter();
  const onWachat = isWachatRoute(pathname);

  /* ── Wachat branch: fetch projects + session so context providers
        match what the legacy DashboardClientLayout supplies.
        Synchronously seeded from bootstrapCache if available, which
        means re-entering /dashboard/* from /home is instant. ── */
  const [wachatData, setWachatData] = useState<WachatBootstrap | null>(
    () => bootstrapCache,
  );

  useEffect(() => {
    if (!onWachat) return;

    // If cache is fresh, don't refetch — the sidebar already has
    // the data and a background refresh would cause needless flicker.
    if (bootstrapCache) {
      // Ensure React state is synced with the module cache (covers the
      // edge case where the cache was populated between render + effect).
      if (wachatData !== bootstrapCache) {
        setWachatData(bootstrapCache);
      }
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const next = await fetchBootstrap();
        if (cancelled) return;

        if (!next) {
          router.push('/login');
          return;
        }

        const onboarding = (next.user as any).onboarding;
        if (onboarding && onboarding.status !== 'complete') {
          router.push('/onboarding');
          return;
        }

        setWachatData(next);
      } catch (err) {
        console.error('ClayDispatcher init failed:', err);
        router.push('/login');
      }
    })();

    return () => {
      cancelled = true;
    };
    // `wachatData` intentionally omitted — we only want this to run when
    // the route context switches, not on every state change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onWachat, router]);

  if (onWachat) {
    if (!wachatData) {
      return <ClayBootSkeleton />;
    }
    return (
      <ProjectProvider
        initialProjects={wachatData.projects}
        user={wachatData.user}
      >
        <AdManagerProvider>
          <ClayDashboardLayout context="wachat" user={user} plan={plan}>
            <ClayProjectGate>{children}</ClayProjectGate>
          </ClayDashboardLayout>
        </AdManagerProvider>
      </ProjectProvider>
    );
  }

  // Legacy chrome — every other /dashboard/* route owns its own providers
  return <DashboardClientLayout>{children}</DashboardClientLayout>;
}
