"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  Bell,
  Briefcase,
  Home,
  LogOut,
  Search,
  Smartphone,
  Sparkles,
  Workflow,
} from "lucide-react";

import { cn } from "../lib/cn";
import { ZoruAppSidebar, type ZoruSidebarGroup } from "./zoru-app-sidebar";
import { ZORU_APPS } from "./zoru-apps";
import { findAppSidebarConfig } from "./zoru-app-sidebars";
import { ZoruDock, ZoruDockIcon } from "./zoru-dock";
import { ZoruHeader } from "./zoru-header";
import { ZoruInput } from "../input";
import { ZoruKbd } from "../kbd";
import { ZoruButton } from "../button";
import { ZoruNotificationPopover } from "../notification-popover";
import { ZoruToaster } from "../toaster";
import { ZoruUserDropdown } from "../user-dropdown";
import {
  CommandPaletteProvider,
  useCommandPalette,
} from "@/components/crm/command-palette";

export interface ZoruHomeShellProps {
  user?: {
    name?: string | null;
    email?: string | null;
    avatar?: string | null;
  };
  plan?: {
    name?: string | null;
    credits?: number;
  };
  /**
   * Override the sidebar heading shown above the menu (defaults to
   * "Home"). Useful when the same shell hosts a different module
   * (e.g. "WaChat", "CRM").
   */
  sidebarHeading?: React.ReactNode;
  /**
   * Override the small caption beneath the sidebar heading.
   * Defaults to the user's name/email.
   */
  sidebarCaption?: React.ReactNode;
  /**
   * Override the sidebar's grouped menu. When omitted, the default
   * Workspace + Shortcuts groups are rendered. Pass module-specific
   * groups (e.g. wachatMenuItems organized into Inbox / Broadcasts /
   * Settings) to make the sidebar reflect the current section.
   */
  sidebarGroups?: ZoruSidebarGroup[];
  children: React.ReactNode;
}

const DOCK_APPS = ZORU_APPS;

/**
 * ZoruHomeShell — sidebar + header + main + dock. The vertical app
 * rail is intentionally absent; every app lives in the bottom dock
 * per the zoru directive. The URL-synced multi-tab strip is also
 * absent (hard constraint from the project plan).
 */
export function ZoruHomeShell({
  user,
  plan,
  sidebarHeading,
  sidebarCaption,
  sidebarGroups: sidebarGroupsProp,
  children,
}: ZoruHomeShellProps) {
  return (
    <CommandPaletteProvider>
      <ZoruHomeShellContent
        user={user}
        plan={plan}
        sidebarHeading={sidebarHeading}
        sidebarCaption={sidebarCaption}
        sidebarGroups={sidebarGroupsProp}
      >
        {children}
      </ZoruHomeShellContent>
    </CommandPaletteProvider>
  );
}

function ZoruHomeShellContent({
  user,
  plan,
  sidebarHeading,
  sidebarCaption,
  sidebarGroups: sidebarGroupsProp,
  children,
}: ZoruHomeShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { setOpen: setCommandPaletteOpen } = useCommandPalette();
  const openCommandPalette = React.useCallback(() => {
    setCommandPaletteOpen(true);
  }, [setCommandPaletteOpen]);
  const [, startTransition] = React.useTransition();
  // Track which dock target we're navigating to so the icon can show
  // an inline pulse — gives instant visual feedback even before
  // `loading.tsx` kicks in. Cleared once `pathname` actually changes.
  const [pendingDockHref, setPendingDockHref] = React.useState<string | null>(
    null,
  );
  React.useEffect(() => {
    setPendingDockHref(null);
  }, [pathname]);

  const handleDockActivate = React.useCallback(
    (href: string) => {
      setPendingDockHref(href);
      startTransition(() => {
        router.push(href);
      });
    },
    [router],
  );

  // Auto-select per-app sidebar groups from the central registry based on
  // the current pathname. Each app declares its own grouped menu in
  // `zoru-app-sidebars.tsx`; the active config wins, the fallback is the
  // home Workspace + Shortcuts pair.
  const activeAppConfig = React.useMemo(
    () => findAppSidebarConfig(pathname),
    [pathname],
  );

  const autoGroups: ZoruSidebarGroup[] = React.useMemo(
    () => (activeAppConfig ? activeAppConfig.build(pathname ?? "") : []),
    [activeAppConfig, pathname],
  );

  const defaultSidebarGroups: ZoruSidebarGroup[] =
    autoGroups.length > 0
      ? autoGroups
      : [
          {
            id: "main",
            label: "Workspace",
            items: [
              { id: "home", label: "Home", icon: <Home />, href: "/dashboard", active: pathname === "/dashboard" },
              { id: "what's-new", label: "What's new", icon: <Sparkles />, href: "/dashboard" },
              { id: "notifications", label: "Notifications", icon: <Bell />, href: "/dashboard/notifications" },
            ],
          },
          {
            id: "shortcuts",
            label: "Shortcuts",
            items: [
              { id: "wachat", label: "WaChat inbox", icon: <Smartphone />, href: "/wachat" },
              { id: "sabflow", label: "Flows", icon: <Workflow />, href: "/dashboard/sabflow/flow-builder" },
              { id: "crm", label: "CRM", icon: <Briefcase />, href: "/dashboard/crm" },
            ],
          },
        ];

  // The dock already lists every app — show only the active app's
  // grouped menu in the sidebar (or the override passed by the layout).
  const sidebarGroups: ZoruSidebarGroup[] = sidebarGroupsProp ?? defaultSidebarGroups;

  // Auto-resolve the heading + caption from the active app config when
  // the caller hasn't explicitly overridden them.
  const resolvedHeading = sidebarHeading ?? activeAppConfig?.heading ?? "Home";
  const resolvedCaption =
    sidebarCaption ??
    activeAppConfig?.caption ??
    user?.name ??
    user?.email ??
    "Workspace";

  const planFooter = plan?.name || plan?.credits !== undefined ? (
    <div className="flex flex-col gap-2 rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-surface p-3">
      <div className="flex items-center justify-between">
        <span className="text-xs text-zoru-ink">{plan?.name ?? "Free plan"}</span>
        {plan?.credits !== undefined && (
          <span className="text-[11px] text-zoru-ink-muted">
            {plan.credits.toLocaleString()} credits
          </span>
        )}
      </div>
      <ZoruButton size="sm" variant="outline" className="w-full" asChild>
        <a href="/dashboard/billing">Manage plan</a>
      </ZoruButton>
    </div>
  ) : null;

  return (
    <div className="zoruui flex h-screen w-full overflow-hidden bg-zoru-bg text-zoru-ink">
      <ZoruAppSidebar
        heading={resolvedHeading}
        caption={resolvedCaption}
        groups={sidebarGroups}
        footer={planFooter}
      />

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
          center={
            <ZoruInput
              placeholder="Search SabNode…"
              leadingSlot={<Search />}
              trailingSlot={
                <button
                  type="button"
                  aria-label="Open command palette"
                  onClick={openCommandPalette}
                  className="inline-flex cursor-pointer items-center rounded-[var(--zoru-radius-sm)] border-0 bg-transparent p-0 outline-none focus-visible:ring-2 focus-visible:ring-zoru-ink/30"
                >
                  <ZoruKbd>⌘K</ZoruKbd>
                </button>
              }
            />
          }
          trailing={
            <>
              <ZoruNotificationPopover />
              <ZoruUserDropdown
                name={user?.name ?? "Account"}
                email={user?.email ?? undefined}
                avatarUrl={user?.avatar ?? undefined}
                footerItems={[
                  {
                    id: "sign-out",
                    label: "Sign out",
                    icon: <LogOut />,
                    href: "/api/auth/signout",
                    destructive: true,
                  },
                ]}
              />
            </>
          }
        />

        <main className={cn("flex-1 overflow-y-auto px-6 py-6 pb-36")}>
          {children}
        </main>

        {/* Bottom-anchored, centered dock — every app lives here now.
            Wrapper stays overflow-visible so the per-icon tooltip pill
            (rendered ABOVE the icons) is never clipped. The
            `max-w-[calc(100vw-1.5rem)]` cap lets the dock spill wider
            than its content but never past the viewport. */}
        <div className="pointer-events-none absolute inset-x-0 bottom-5 z-30 flex justify-center px-3">
          <div className="pointer-events-auto max-w-[calc(100vw-1.5rem)] overflow-visible rounded-[26px] border border-zoru-line bg-zoru-bg/95 p-1 shadow-[var(--zoru-shadow-lg)] backdrop-blur">
            <ZoruDock iconSize={44} static>
              {DOCK_APPS.map((app) => {
                const isPending = pendingDockHref === app.href;
                const Icon = app.Icon;
                return (
                  <ZoruDockIcon
                    key={app.id}
                    name={app.name}
                    href={app.href}
                    active={app.isActive(pathname) || isPending}
                    onActivate={handleDockActivate}
                  >
                    <span
                      className={
                        isPending ? "animate-pulse opacity-70" : undefined
                      }
                    >
                      <Icon className="h-5 w-5" />
                    </span>
                  </ZoruDockIcon>
                );
              })}
            </ZoruDock>
          </div>
        </div>
      </div>

      {/* Mount once at the shell level so any page rendered inside
          ZoruHomeShell can call zoruToast() / useZoruToast(). */}
      <ZoruToaster />
    </div>
  );
}
