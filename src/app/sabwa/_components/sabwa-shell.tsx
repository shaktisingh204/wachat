"use client";

/**
 * SabwaShell — wraps `ZoruHomeShell` with the SabWa-specific grouped
 * sidebar (Get started, Inbox & chats, Groups, Outbound, Library,
 * Automation, Media, Reports, Developer, Settings).
 *
 * Mirrors `WachatShell` so every `/sabwa/*` page renders inside the
 * SAME sidebar + dock as `/dashboard`. No bespoke SabWa chrome.
 */

import * as React from "react";
import { usePathname } from "next/navigation";

import { ZoruHomeShell } from "@/components/zoruui";

import { buildSabwaSidebarGroups } from "./sabwa-sidebar-config";

export interface SabwaShellProps {
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

export function SabwaShell({ user, plan, children }: SabwaShellProps) {
  const pathname = usePathname();
  const groups = React.useMemo(
    () => buildSabwaSidebarGroups(pathname),
    [pathname],
  );

  return (
    <ZoruHomeShell
      user={user}
      plan={plan}
      sidebarHeading="SabWa"
      sidebarCaption="Personal WhatsApp"
      sidebarGroups={groups}
    >
      {children}
    </ZoruHomeShell>
  );
}
