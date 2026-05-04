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
  '/wachat/chat',
  '/wachat/broadcasts',
  '/wachat/templates',
  '/wachat/contacts',
  '/dashboard/overview',
  '/wachat/bulk',
  '/wachat/canned-messages',
  '/dashboard/catalog',
  '/wachat/calls',
  '/dashboard/flow-builder',
  '/dashboard/flows',
  '/wachat/numbers',
  '/wachat/webhooks',
  '/wachat/auto-reply',
  '/wachat/whatsapp-pay',
  '/dashboard/integrations',
  '/dashboard/setup',
  '/dashboard/wachat',
  '/dashboard/analytics',
  '/wachat/qr-codes',
  '/wachat/automation',
  '/dashboard/health',
  '/dashboard/settings',
  '/wachat/chat-labels',
  '/wachat/chat-export',
  '/wachat/chat-ratings',
  '/wachat/chat-transfer',
  '/wachat/chatbot',
  '/wachat/scheduled-messages',
  '/wachat/contact-notes',
  '/wachat/contact-groups',
  '/wachat/contact-blacklist',
  '/wachat/contact-merge',
  '/wachat/contact-import-history',
  '/wachat/contact-timeline',
  '/wachat/auto-reply-rules',
  '/wachat/broadcast-segments',
  '/wachat/broadcast-history',
  '/wachat/broadcast-scheduler',
  '/wachat/template-analytics',
  '/wachat/template-builder',
  '/wachat/message-analytics',
  '/wachat/message-statistics',
  '/wachat/message-tags',
  '/wachat/message-templates-library',
  '/wachat/saved-replies',
  '/wachat/media-library',
  '/wachat/link-tracking',
  '/wachat/quick-reply-categories',
  '/wachat/opt-out',
  '/wachat/blocked-contacts',
  '/wachat/business-hours',
  '/wachat/team-performance',
  '/wachat/assignments',
  '/wachat/conversation-search',
  '/wachat/conversation-kanban',
  '/wachat/conversation-filters',
  '/wachat/conversation-summary',
  '/wachat/interactive-messages',
  '/wachat/bulk-messaging',
  '/wachat/response-time-tracker',
  '/wachat/customer-satisfaction',
  '/dashboard/api-keys',
  '/dashboard/notification-preferences',
  '/wachat/delivery-reports',
  '/wachat/whatsapp-link-generator',
  '/wachat/phone-number-settings',
  '/dashboard/credit-usage',
  '/wachat/greeting-messages',
  '/wachat/away-messages',
  '/wachat/agent-availability',
  '/wachat/campaign-ab-test',
  '/wachat/webhook-logs',
];

function isWachatRoute(pathname: string | null): boolean {
  if (!pathname) return false;
  if (pathname === '/wachat' || pathname === '/dashboard/') return true;
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
