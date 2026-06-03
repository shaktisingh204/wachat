'use client';

/**
 * SabcrmOuterShell — wraps the Twenty CRM frame in SabNode's standard chrome.
 *
 * SabCRM is a first-class SabNode module, so it shares the SAME outer
 * navigation as every other app: the left **app rail** (the `ZORU_APPS`
 * switcher) and the top **header** (brand + universal search + notifications +
 * user menu) — exactly what `ZoruHomeShell` renders. The difference is the
 * inner column: instead of the Zoru grouped sidebar we render the Twenty
 * `.sabcrm-twenty` frame (its object sidebar + main), so the CRM keeps its
 * Twenty-faithful look while living inside the SabNode shell.
 *
 * Mirrors `ZoruHomeShell`'s rail/header composition (same components, same
 * providers) so behaviour stays consistent across the workspace.
 */

import * as React from 'react';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, LogOut } from 'lucide-react';

import { ZoruAppRail, type ZoruAppRailItem } from '@/components/zoruui/shell/zoru-app-rail';
import { ZORU_APPS } from '@/components/zoruui/shell/zoru-apps';
import { ZoruHeader } from '@/components/zoruui/shell/zoru-header';
import { ZoruNotificationPopover } from '@/components/zoruui/notification-popover';
import { ZoruUserDropdown } from '@/components/zoruui/user-dropdown';
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
  // ZoruHomeShell, so the active app (SabCRM, under /sabcrm) highlights and
  // every other SabNode app is one click away.
  const railItems: ZoruAppRailItem[] = React.useMemo(
    () =>
      ZORU_APPS.map((app) => ({
        id: app.id,
        label: app.name,
        href: app.href,
        active: app.isActive(pathname),
        icon: <app.Icon />,
      })),
    [pathname],
  );

  return (
    <CommandPaletteProvider>
      <div className="zoruui flex h-[100dvh] w-full overflow-hidden bg-zoru-bg text-zoru-ink">
        <ZoruAppRail items={railItems} />

        <div className="relative flex min-w-0 flex-1 flex-col">
          <ZoruHeader
            leading={
              <a
                href="/dashboard"
                aria-label="SabNode home"
                className="inline-flex items-center gap-2"
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-[var(--zoru-radius-sm)] bg-zoru-ink text-xs text-zoru-on-primary">
                  S
                </span>
                <span className="hidden text-sm text-zoru-ink sm:inline">
                  SabNode
                </span>
              </a>
            }
            center={<UniversalSearch />}
            trailing={
              <>
                <ZoruNotificationPopover />
                <ZoruUserDropdown
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

          {/* The Twenty `.sabcrm-twenty` frame fills the remaining column. */}
          <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
        </div>
      </div>
    </CommandPaletteProvider>
  );
}

export default SabcrmOuterShell;
