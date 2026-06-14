'use client';

/**
 * SabcrmOuterShell — wraps the SabCRM suite frame in SabNode's standard chrome.
 *
 * SabCRM is a first-class SabNode module, so it shares the SAME outer chrome as
 * every other app: the top **header** (brand + universal search + notifications
 * + user menu) and the macOS-style bottom **dock** for app-switching — exactly
 * what the rest of SabNode uses. The dock is global (mounted once as the
 * persistent `DesktopHost` in the root layout and gated to `/sabcrm` via its
 * route list), so this shell does NOT render it. The left column is the SabNode
 * sidebar (`SabAppSidebar`) rendered by the inner `SabcrmSuiteFrame`.
 *
 * The old vertical **app rail** that SabCRM used to render here is retired — app
 * switching now lives in the dock, matching `SabHomeShell` across the workspace.
 */

import * as React from 'react';
import { LayoutDashboard, LogOut } from 'lucide-react';

import { AppHeader } from '@/components/sabcrm/20ui';
import { useHtmlDark, AppThemeToggle } from '@/components/sabcrm/20ui';
// The self-fetching header widgets — the SAME ones the canonical SabNode header
// (`SabHomeShell`) uses, so SabCRM's header matches the rest of the workspace
// exactly. Imported by deep path (not the barrel) since the dumb, data-driven
// `NotificationPopover`/`UserDropdown` barrel aliases require caller-supplied
// props; these resolve their own data.
import { SabNotificationPopover } from '@/components/sabcrm/20ui/composites/notification-popover';
import { SabUserDropdown } from '@/components/sabcrm/20ui/composites/user-dropdown';
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
  // The 20ui header follows the APP theme (the outer shell is the SabNode
  // chrome). Shared with SabHomeShell via useHtmlDark() so the whole workspace
  // flips light/dark together (the header is never out of sync).
  const appDark = useHtmlDark();

  return (
    <CommandPaletteProvider>
      <div className="flex h-[100dvh] w-full overflow-hidden bg-[var(--st-bg)] text-[var(--st-text)]">
        {/* App switching lives in the global macOS-style dock (the persistent
            DesktopHost in the root layout, gated to /sabcrm) — the old vertical
            app rail is retired. The left column below is the SabNode sidebar,
            rendered by SabcrmSuiteFrame. */}
        <div className="relative flex min-w-0 flex-1 flex-col">
          {/* Header — 20ui AppHeader, theme-synced (mirrors Ui20HomeShell). */}
          <div className={`20ui ${appDark ? 'dark' : 'light'}`}>
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
                  <SabNotificationPopover />
                  <SabUserDropdown
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
