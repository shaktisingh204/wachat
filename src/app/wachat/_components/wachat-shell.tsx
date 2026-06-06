"use client";

import { SabHomeShell } from '@/components/sabcrm/20ui';
import { usePathname } from "next/navigation";

/**
 * WachatShell — wraps `SabHomeShell` with the wachat-specific
 * grouped sidebar (Inbox, Contacts, Broadcasts, Templates,
 * Automation, Reports, Growth, Calling, Engagement, Settings).
 *
 * Used by `src/app/wachat/layout.tsx`. Client-only so we can read
 * `usePathname()` to flag the active sidebar item.
 */

import * as React from "react";

import { buildWachatSidebarGroups } from "./wachat-sidebar-config";

export interface WachatShellProps {
  user?: {
    name?: string | null;
    email?: string | null;
    avatar?: string | null;
  };
  plan?: {
    name?: string | null;
    credits?: number;
  };
  children: React.ReactNode;
}

export function WachatShell({ user, plan, children }: WachatShellProps) {
  const pathname = usePathname();
  const groups = React.useMemo(
    () => buildWachatSidebarGroups(pathname),
    [pathname],
  );

  return (
    <SabHomeShell
      user={user}
      plan={plan}
      sidebarHeading="WaChat"
      sidebarCaption={user?.name ?? user?.email ?? "Project"}
      sidebarGroups={groups}
    >
      {children}
    </SabHomeShell>
  );
}
