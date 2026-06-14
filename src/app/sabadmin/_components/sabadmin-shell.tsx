"use client";

import * as React from "react";
import { usePathname } from "next/navigation";

import { SabHomeShell } from "@/components/sabcrm/20ui";

import { buildSabAdminSidebarGroups } from "./sabadmin-sidebar-config";

export interface SabAdminShellProps {
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

export function SabAdminShell({ user, plan, children }: SabAdminShellProps) {
  const pathname = usePathname();
  const groups = React.useMemo(
    () => buildSabAdminSidebarGroups(pathname),
    [pathname],
  );

  return (
    <SabHomeShell
      user={user}
      plan={plan}
      sidebarHeading="Admin Center"
      sidebarCaption="Identity · email · access"
      sidebarGroups={groups}
    >
      {children}
    </SabHomeShell>
  );
}
