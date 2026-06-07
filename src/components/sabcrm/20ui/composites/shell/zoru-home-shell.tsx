"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import {
  Bell,
  Briefcase,
  Home,
  LayoutDashboard,
  LogOut,
  Smartphone,
  Sparkles,
  Workflow,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { cn } from "../lib/cn";
// The app rail + header are now the 20ui primitives (dark-mode capable),
// scoped to their own `.ui20 light|dark` root and kept in lock-step with the
// app theme via useHtmlDark(). The grouped module sidebar stays ZoruUI.
import { AppRail, AppHeader, type AppRailItem } from "@/components/sabcrm/20ui";
import { useHtmlDark, AppThemeToggle } from "./app-theme";
import {
  ZoruAppSidebar,
  type ZoruSidebarGroup,
  type ZoruSidebarLeaf,
} from "./zoru-app-sidebar";
import { ZORU_APPS } from "./zoru-apps";
import { findAppSidebarConfig } from "./zoru-app-sidebars";
import { useProject } from "@/context/project-context";
import { isElevatedRole } from "@/lib/rbac";
import { Button } from "../button";
import { ZoruNotificationPopover } from "../notification-popover";
import { ZoruUserDropdown } from "../user-dropdown";
import {
  CommandPaletteProvider,
  useCommandPalette,
} from "@/components/crm/command-palette";
import { UniversalSearch } from "@/components/crm/universal-search";

export interface ZoruHomeShellProps {
  user?: {
    name?: string | null;
    email?: string | null;
    avatar?: string | null;
    /** Used to gate Client Portal entry point in the user dropdown. */
    role?: string | null;
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

/**
 * "Full-bleed" routes opt out of the dashboard's padded, scrolling
 * <main> wrapper — the page handles its own layout edge-to-edge.
 * Used by canvas-style editors like the SabFlow flow builder.
 */
function isFullBleedRoute(pathname: string | null): boolean {
  if (!pathname) return false;
  // /dashboard/sabflow/flow-builder/<flowId>(/subroute)? but NOT the
  // index list page `/dashboard/sabflow/flow-builder`.
  if (/^\/dashboard\/sabflow\/flow-builder\/[^/]+/.test(pathname)) return true;
  // SabWa inbox is a 3-pane WhatsApp-Web layout that needs to fill the
  // viewport edge-to-edge; the default padded <main> leaves a visible
  // gutter and forces a second scroll container.
  if (pathname === '/sabwa/inbox' || pathname.startsWith('/sabwa/inbox/')) return true;
  // CRM settings render inside their own full-height shell (grey surface +
  // centred column + back bar). The default padded <main> would frame that
  // shell in a white gutter and clip its background, so it owns the bleed and
  // scrolls internally instead.
  if (pathname === '/dashboard/settings/crm' || pathname.startsWith('/dashboard/settings/crm/')) {
    return true;
  }
  return false;
}

/**
 * "Sidebar-less" routes keep the padded, scrolling <main> (unlike
 * full-bleed) but drop the secondary <ZoruAppSidebar> column.
 *
 * Settings is the canonical case: `/dashboard/settings/*` is SabNode's
 * single settings surface, and the hub page itself IS the navigation —
 * a grouped list of every section. The old "Account & developer"
 * sidebar just duplicated that list, so it's suppressed. The thin app
 * rail + header stay so users can still switch apps.
 */
function isSidebarlessRoute(pathname: string | null): boolean {
  if (!pathname) return false;
  return (
    pathname === '/dashboard/settings' ||
    pathname.startsWith('/dashboard/settings/')
  );
}

/**
 * ZoruHomeShell — app rail + sidebar + header + main. Every app
 * lives in the leftmost vertical rail (was previously the bottom
 * dock). The URL-synced multi-tab strip is intentionally absent
 * (hard constraint from the project plan).
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
  // CommandPaletteProvider is still mounted; the universal search header
  // owns the ⌘K binding now, but the palette can be opened via other UI.
  useCommandPalette();

  const fullBleed = isFullBleedRoute(pathname);
  const sidebarless = isSidebarlessRoute(pathname);

  // Build the app rail's items from the central app registry — every
  // app that lived in the dock is now an icon in the vertical rail.
  const railItems: AppRailItem[] = React.useMemo(
    () =>
      ZORU_APPS.map((app) => ({
        id: app.id,
        label: app.name,
        href: app.href,
        active: app.isActive(pathname),
        icon: app.Icon as LucideIcon,
      })),
    [pathname],
  );

  // The 20ui rail + header follow the app's light/dark setting (the class on
  // <html>), so they flip in lock-step with the ZoruUI chrome around them.
  const appDark = useHtmlDark();

  // Auto-select per-app sidebar groups from the central registry based on
  // the current pathname. Each app declares its own grouped menu in
  // `zoru-app-sidebars.tsx`; the active config wins, the fallback is the
  // home Workspace + Shortcuts pair.
  const activeAppConfig = React.useMemo(
    () => findAppSidebarConfig(pathname),
    [pathname],
  );

  // Tenant-admin gating mirrors Worksuite parity: the inviting account
  // (project owner) sees admin-only menu entries; invited team members do
  // not. `isOwner` is the SabNode owner flag; `ADMIN_ROLE_ID` covers users
  // promoted to the elevated tenant-admin role within the workspace.
  const { effectivePermissions } = useProject();
  const isAdmin =
    Boolean(effectivePermissions?.isOwner) ||
    isElevatedRole(effectivePermissions?.role);

  const autoGroupsRaw: ZoruSidebarGroup[] = React.useMemo(
    () => (activeAppConfig ? activeAppConfig.build(pathname ?? "") : []),
    [activeAppConfig, pathname],
  );

  const autoGroups: ZoruSidebarGroup[] = React.useMemo(() => {
    if (isAdmin) return autoGroupsRaw;
    const stripAdmin = (items: ZoruSidebarLeaf[]): ZoruSidebarLeaf[] =>
      items
        .filter((it) => !it.adminOnly)
        .map((it) =>
          it.children
            ? { ...it, children: stripAdmin(it.children) }
            : it,
        );
    return autoGroupsRaw
      .map((g) => ({ ...g, items: stripAdmin(g.items) }))
      .filter((g) => g.items.length > 0);
  }, [autoGroupsRaw, isAdmin]);

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
    <div className="flex flex-col gap-2 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-surface)] p-3">
      <div className="flex items-center justify-between">
        <span className="text-xs text-[var(--st-text)]">{plan?.name ?? "Free plan"}</span>
        {plan?.credits !== undefined && (
          <span className="text-[11px] text-[var(--st-text-secondary)]">
            {plan.credits.toLocaleString()} credits
          </span>
        )}
      </div>
      <Button size="sm" variant="outline" className="w-full" asChild>
        <a href="/dashboard/billing">Manage plan</a>
      </Button>
    </div>
  ) : null;

  return (
    <div className="zoruui flex h-[100dvh] w-full overflow-hidden bg-[var(--st-bg)] text-[var(--st-text)]">
      {/* App rail — 20ui, in its own theme-synced design-system root. */}
      <div className={`ui20 ${appDark ? "dark" : "light"}`} style={{ display: "flex" }}>
        <AppRail items={railItems} label="SabNode apps" />
      </div>
      {!fullBleed && !sidebarless && (
        <ZoruAppSidebar
          heading={resolvedHeading}
          caption={resolvedCaption}
          groups={sidebarGroups}
          footer={planFooter}
        />
      )}

      <div className="relative flex min-w-0 flex-1 flex-col">
        {/* Header — 20ui AppHeader, theme-synced. The brand + search +
            notifications + user menu keep their ZoruUI widgets (they re-theme
            via the ZoruUI dark tokens), with a quick light/dark toggle added. */}
        <div className={`ui20 ${appDark ? "dark" : "light"}`}>
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
                <ZoruNotificationPopover />
                <ZoruUserDropdown
                  name={user?.name ?? "Account"}
                  email={user?.email ?? undefined}
                  avatarUrl={user?.avatar ?? undefined}
                  items={
                    user?.role === "client"
                      ? [
                          {
                            id: "client-portal",
                            label: "Open Client Portal",
                            icon: <LayoutDashboard />,
                            href: "/portal/client",
                          },
                        ]
                      : undefined
                  }
                  footerItems={[
                    {
                      id: "sign-out",
                      label: "Sign out",
                      icon: <LogOut />,
                      href: "/api/auth/logout",
                      destructive: true,
                    },
                  ]}
                />
              </>
            }
          />
        </div>

        <main
          className={cn(
            "min-h-0",
            fullBleed
              ? "relative flex-1 overflow-hidden"
              : "flex-1 overflow-y-auto px-6 py-6",
          )}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
