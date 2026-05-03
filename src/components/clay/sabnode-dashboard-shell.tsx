'use client';

/**
 * SabNodeDashboardShell — the production dashboard chrome.
 *
 * Wraps every `/dashboard/*` route with:
 *   1. The unified two-line sidebar (`SabNodeSidebar`)
 *   2. The same data + provider bootstrap the old
 *      `DashboardChromeDispatcher` did (session + projects, plus
 *      `ProjectProvider` and `AdManagerProvider`).
 *   3. The Wachat project gate (forces the user to pick a WABA project
 *      before any Wachat page renders).
 *
 * Replaces the per-module Clay sidebars with a single cross-module
 * sidebar.  The Clay layouts themselves are still available for routes
 * that opt-in explicitly, but `/dashboard/layout.tsx` now mounts this
 * shell by default.
 */

import * as React from 'react';
import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';

import { ProjectProvider } from '@/context/project-context';
import { AdManagerProvider } from '@/context/ad-manager-context';
import { ClayProjectGate } from '@/components/clay/clay-project-gate';
import { getProjects } from '@/app/actions/project.actions';
import { getSession } from '@/app/actions/user.actions';
import { SabNodeSidebar } from '@/components/ui/sidebar-component';
import {
  TabsProvider,
  TabsBar,
  useTabRouteSync,
  useTabsKeyboard,
} from '@/components/tabs';

/* ── Bootstrap cache (survives unmount/remount across navigations) ─── */

type Bootstrap = {
  user: Record<string, unknown>;
  projects: Array<Record<string, unknown> & { wabaId?: string }>;
};

let bootstrapCache: Bootstrap | null = null;
let inflight: Promise<Bootstrap | null> | null = null;

async function fetchBootstrap(): Promise<Bootstrap | null> {
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const [session, projects] = await Promise.all([getSession(), getProjects()]);
      if (!session?.user) return null;
      const next: Bootstrap = {
        user: session.user as Record<string, unknown>,
        projects: (projects || []) as Bootstrap['projects'],
      };
      bootstrapCache = next;
      return next;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

/* ── Wachat-route detection (drives ClayProjectGate) ─────────────── */

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
  if (pathname === '/dashboard' || pathname === '/dashboard/') return true;
  return WACHAT_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/* ── Boot skeleton ──────────────────────────────────────────────── */

function ShellSkeleton() {
  return (
    <div
      className="flex min-h-screen w-full"
      style={{ backgroundColor: 'hsl(36 15% 97%)' }}
    >
      <div
        className="hidden lg:block w-14 shrink-0 border-r border-black/5"
        style={{ backgroundColor: 'hsl(36 18% 96%)' }}
        aria-hidden
      />
      <div
        className="hidden lg:block w-72 lg:w-80 shrink-0 border-r border-black/5"
        style={{ backgroundColor: 'hsl(36 15% 97%)' }}
        aria-hidden
      />
      <div className="flex-1" aria-hidden />
    </div>
  );
}

/* ── Public component ───────────────────────────────────────────── */

export interface SabNodeDashboardShellProps {
  children: React.ReactNode;
}

export function SabNodeDashboardShell({ children }: SabNodeDashboardShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [data, setData] = useState<Bootstrap | null>(() => bootstrapCache);

  useEffect(() => {
    if (bootstrapCache) {
      if (data !== bootstrapCache) setData(bootstrapCache);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const next = await fetchBootstrap();
        if (cancelled) return;
        if (!next) {
          router.push('/login');
          return;
        }
        const onboarding = (next.user as { onboarding?: { status?: string } }).onboarding;
        if (onboarding && onboarding.status !== 'complete') {
          router.push('/onboarding');
          return;
        }
        setData(next);
      } catch (err) {
        console.error('SabNodeDashboardShell init failed:', err);
        router.push('/login');
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  if (!data) return <ShellSkeleton />;

  const onWachat = isWachatRoute(pathname);
  // Wachat scope: only WABA-projects show in the project picker.
  const projectsForContext = onWachat
    ? data.projects.filter((p) => Boolean(p.wabaId))
    : data.projects;

  const main = onWachat ? <ClayProjectGate>{children}</ClayProjectGate> : children;

  return (
    <ProjectProvider
      initialProjects={projectsForContext as Parameters<typeof ProjectProvider>[0]['initialProjects']}
      user={data.user as Parameters<typeof ProjectProvider>[0]['user']}
    >
      <AdManagerProvider>
        <TabsProvider>
          <ShellLayout>{main}</ShellLayout>
        </TabsProvider>
      </AdManagerProvider>
    </ProjectProvider>
  );
}

/**
 * Inner layout — must live INSIDE TabsProvider so it can use the
 * tab-aware hooks (route sync + keyboard shortcuts).
 */
function ShellLayout({ children }: { children: React.ReactNode }) {
  // Keep the active tab's href synced with the URL the user is on.
  useTabRouteSync();
  // Browser-style keyboard shortcuts (Cmd+W close, Cmd+1..9 jump, etc.).
  useTabsKeyboard();

  return (
    <div
      className="flex min-h-screen w-full"
      style={{ backgroundColor: 'hsl(36 15% 97%)' }}
    >
      <SabNodeSidebar />
      <div className="flex-1 min-w-0 flex flex-col">
        <TabsBar />
        <main className="flex-1 min-w-0 px-4 pt-4 pb-28 sm:px-6 sm:pt-6 sm:pb-32 lg:px-8 lg:pt-8 lg:pb-32">
          {children}
        </main>
      </div>
    </div>
  );
}

export default SabNodeDashboardShell;
