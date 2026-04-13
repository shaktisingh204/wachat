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
  '/dashboard/integrations',
  '/dashboard/setup',
  '/dashboard/wachat',
  '/dashboard/analytics',
  '/dashboard/qr-codes',
  '/dashboard/automation',
  '/dashboard/health',
  '/dashboard/settings',
  // New Wachat feature routes
  '/dashboard/chat-labels',
  '/dashboard/chat-export',
  '/dashboard/chat-ratings',
  '/dashboard/chat-transfer',
  '/dashboard/chatbot',
  '/dashboard/scheduled-messages',
  '/dashboard/contact-notes',
  '/dashboard/contact-groups',
  '/dashboard/contact-blacklist',
  '/dashboard/contact-merge',
  '/dashboard/contact-import-history',
  '/dashboard/contact-timeline',
  '/dashboard/auto-reply-rules',
  '/dashboard/broadcast-segments',
  '/dashboard/broadcast-history',
  '/dashboard/broadcast-scheduler',
  '/dashboard/template-analytics',
  '/dashboard/template-builder',
  '/dashboard/message-analytics',
  '/dashboard/message-statistics',
  '/dashboard/message-tags',
  '/dashboard/message-templates-library',
  '/dashboard/saved-replies',
  '/dashboard/media-library',
  '/dashboard/link-tracking',
  '/dashboard/quick-reply-categories',
  '/dashboard/opt-out',
  '/dashboard/blocked-contacts',
  '/dashboard/business-hours',
  '/dashboard/team-performance',
  '/dashboard/assignments',
  '/dashboard/conversation-search',
  '/dashboard/conversation-kanban',
  '/dashboard/conversation-filters',
  '/dashboard/conversation-summary',
  '/dashboard/interactive-messages',
  '/dashboard/bulk-messaging',
  '/dashboard/response-time-tracker',
  '/dashboard/customer-satisfaction',
  '/dashboard/api-keys',
  '/dashboard/notification-preferences',
  '/dashboard/delivery-reports',
  '/dashboard/whatsapp-link-generator',
  '/dashboard/phone-number-settings',
  '/dashboard/credit-usage',
  '/dashboard/greeting-messages',
  '/dashboard/away-messages',
  '/dashboard/agent-availability',
  '/dashboard/campaign-ab-test',
  '/dashboard/webhook-logs',
];

function isWachatRoute(pathname: string | null): boolean {
  if (!pathname) return false;
  // /dashboard itself is the Wachat project selector (Clay chrome)
  if (pathname === '/dashboard' || pathname === '/dashboard/') return true;
  return WACHAT_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(p + '/'),
  );
}

/**
 * Ad Manager routes get their own Clay context="ad-manager" with
 * a dedicated sidebar for campaigns, audiences, pixels, etc.
 */
function isAdManagerRoute(pathname: string | null): boolean {
  if (!pathname) return false;
  return pathname === '/dashboard/ad-manager' || pathname.startsWith('/dashboard/ad-manager/');
}

/**
 * Meta Suite routes (Facebook pages/posts/messaging/commerce).
 * Gets Clay context="meta-suite".
 */
function isMetaSuiteRoute(pathname: string | null): boolean {
  if (!pathname) return false;
  return pathname === '/dashboard/facebook' || pathname.startsWith('/dashboard/facebook/');
}

/**
 * Instagram routes get their own Clay context="instagram" with
 * sidebar for feed, stories, reels, DMs, discovery, hashtags.
 */
function isInstagramRoute(pathname: string | null): boolean {
  if (!pathname) return false;
  return pathname === '/dashboard/instagram' || pathname.startsWith('/dashboard/instagram/');
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
  const onAdManager = isAdManagerRoute(pathname);
  const onInstagram = !onAdManager && isInstagramRoute(pathname);
  const onMetaSuite = !onAdManager && !onInstagram && isMetaSuiteRoute(pathname);
  const onWachat = !onAdManager && !onInstagram && !onMetaSuite && isWachatRoute(pathname);

  /* ── Wachat branch: fetch projects + session so context providers
        match what the legacy DashboardClientLayout supplies.
        Synchronously seeded from bootstrapCache if available, which
        means re-entering /dashboard/* from /home is instant. ── */
  const [wachatData, setWachatData] = useState<WachatBootstrap | null>(
    () => bootstrapCache,
  );

  const needsBootstrap = onWachat || onAdManager || onMetaSuite || onInstagram;

  useEffect(() => {
    if (!needsBootstrap) return;

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
  }, [needsBootstrap, router]);

  // ── Ad Manager branch: Clay chrome with AdManagerProvider.
  if (onAdManager) {
    if (!wachatData) {
      return <ClayBootSkeleton />;
    }
    return (
      <ProjectProvider
        initialProjects={wachatData.projects}
        user={wachatData.user}
      >
        <AdManagerProvider>
          <ClayDashboardLayout context="ad-manager" user={user} plan={plan}>
            {children}
          </ClayDashboardLayout>
        </AdManagerProvider>
      </ProjectProvider>
    );
  }

  // ── Instagram branch: Clay chrome for Instagram Graph API.
  if (onInstagram) {
    if (!wachatData) {
      return <ClayBootSkeleton />;
    }
    return (
      <ProjectProvider
        initialProjects={wachatData.projects}
        user={wachatData.user}
      >
        <AdManagerProvider>
          <ClayDashboardLayout context="instagram" user={user} plan={plan}>
            {children}
          </ClayDashboardLayout>
        </AdManagerProvider>
      </ProjectProvider>
    );
  }

  // ── Meta Suite branch: Facebook pages/posts/messaging/commerce.
  if (onMetaSuite) {
    if (!wachatData) {
      return <ClayBootSkeleton />;
    }
    return (
      <ProjectProvider
        initialProjects={wachatData.projects}
        user={wachatData.user}
      >
        <AdManagerProvider>
          <ClayDashboardLayout context="meta-suite" user={user} plan={plan}>
            {children}
          </ClayDashboardLayout>
        </AdManagerProvider>
      </ProjectProvider>
    );
  }

  if (onWachat) {
    if (!wachatData) {
      return <ClayBootSkeleton />;
    }
    // Only WABA projects should be shown/managed in Wachat
    const wabaProjects = wachatData.projects.filter((p: any) => !!p.wabaId);
    return (
      <ProjectProvider
        initialProjects={wabaProjects}
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
