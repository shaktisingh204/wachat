'use client';

/**
 * SabcrmOuterShell — wraps the Twenty CRM frame in SabNode's standard chrome.
 *
 * SabCRM is a first-class SabNode module, so it shares the SAME outer
 * navigation as every other app: the left **app rail** (the `SAB_APPS`
 * switcher) and the top **header** (brand + universal search + notifications +
 * user menu) — exactly what `Ui20HomeShell` renders. The difference is the
 * inner column: instead of the Ui20 grouped sidebar we render the Twenty
 * `.sabcrm-twenty` frame (its object sidebar + main), so the CRM keeps its
 * Twenty-faithful look while living inside the SabNode shell.
 *
 * Mirrors `Ui20HomeShell`'s rail/header composition (same components, same
 * providers) so behaviour stays consistent across the workspace.
 */

import * as React from 'react';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, LogOut } from 'lucide-react';

import { SAB_APPS } from '@/components/sabcrm/20ui';
import { AppRail, AppHeader, type AppRailItem } from '@/components/sabcrm/20ui';
import type { LucideIcon } from 'lucide-react';
import { useHtmlDark, AppThemeToggle } from '@/components/sabcrm/20ui';
import { NotificationPopover } from '@/components/sabcrm/20ui';
import { UserDropdown } from '@/components/sabcrm/20ui';
import { CommandPaletteProvider } from '@/components/crm/command-palette';
import { UniversalSearch } from '@/components/crm/universal-search';

export interface SabcrmOuterShellProps {
  user?: {
    name?: string | null;
    email?: string | null;
    avatar?: string | null;
    role?: string | null;
  };
  children: React.ReactNode;
}

export function SabcrmOuterShell({ user, children }: SabcrmOuterShellProps) {
  const pathname = usePathname();

  // The app rail's items come from the central app registry — identical to
  // Ui20HomeShell, so the active app (SabCRM, under /sabcrm) highlights and
  // every other SabNode app is one click away. Now rendered by the 20ui AppRail.
  const railItems: AppRailItem[] = React.useMemo(
    () =>
      SAB_APPS.map((app) => ({
        id: app.id,
        label: app.name,
        href: app.href,
        active: app.isActive(pathname),
        icon: app.Icon as LucideIcon,
      })),
    [pathname],
  );

  // The 20ui rail + header follow the APP theme (the outer shell is the SabNode
  // chrome). Shared with Ui20HomeShell via useHtmlDark() so the whole workspace
  // flips light/dark together (the rail is never out of sync).
  const appDark = useHtmlDark();

  return (
    <CommandPaletteProvider>
      <div className="flex h-[100dvh] w-full overflow-hidden bg-[var(--st-bg)] text-[var(--st-text)]">
        {/* 20ui AppRail, scoped to its own design-system root + synced to the
            app theme so dark/light always matches the surrounding chrome. */}
        <div className={`ui20 ${appDark ? 'dark' : 'light'}`} style={{ display: 'flex' }}>
          <AppRail items={railItems} label="SabNode apps" />
        </div>

        <div className="relative flex min-w-0 flex-1 flex-col">
          {/* Header — 20ui AppHeader, theme-synced (mirrors Ui20HomeShell). */}
          <div className={`ui20 ${appDark ? 'dark' : 'light'}`}>
            <AppHeader
              sticky={false}
              leading={
                <a
                  href="/dashboard"
                  aria-label="SabNode home"
                  className="inline-flex items-center gap-2"
                >
                  <span className="flex h-7 w-7 items-center justify-center rounded-[var(--st-radius-sm)] bg-[var(--st-text)] text-xs text-[var(--st-text-inverted)]">
                    S
                  </span>
                  <span className="hidden text-sm text-[var(--st-text)] sm:inline">
                    SabNode
                  </span>
                </a>
              }
              center={<UniversalSearch />}
              trailing={
                <>
                  <AppThemeToggle />
                  <NotificationPopover />
                  <UserDropdown
                    name={user?.name ?? 'Account'}
                    email={user?.email ?? undefined}
                    avatarUrl={user?.avatar ?? undefined}
                    items={
                      user?.role === 'client'
                        ? [
                            {
                              id: 'client-portal',
                              label: 'Open Client Portal',
                              icon: <LayoutDashboard />,
                              href: '/portal/client',
                            },
                          ]
                        : undefined
                    }
                    footerItems={[
                      {
                        id: 'sign-out',
                        label: 'Sign out',
                        icon: <LogOut />,
                        href: '/api/auth/logout',
                        destructive: true,
                      },
                    ]}
                  />
                </>
              }
            />
          </div>

          {/* The Twenty `.sabcrm-twenty` frame fills the remaining column. */}
          <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
        </div>
      </div>
    </CommandPaletteProvider>
  );
}

export default SabcrmOuterShell;
