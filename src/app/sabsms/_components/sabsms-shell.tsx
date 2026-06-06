"use client";

import * as React from "react";
import { usePathname } from "next/navigation";

import { ZoruHomeShell } from "@/components/zoruui";

import { buildSabsmsSidebarGroups } from "./sabsms-sidebar-config";

export interface SabsmsShellProps {
  user?: {
    name?: string | null;
    email?: string | null;
    avatar?: string | null;
  };
  plan?: {
    name?: string | null;
    credits?: number;
  };
  engineEnabled: boolean;
  engineUrl: string;
  children: React.ReactNode;
}

export function SabsmsShell({
  user,
  plan,
  engineEnabled,
  engineUrl,
  children,
}: SabsmsShellProps) {
  const pathname = usePathname();
  const groups = React.useMemo(
    () => buildSabsmsSidebarGroups(pathname),
    [pathname],
  );

  const caption = React.useMemo(() => {
    const dot = engineEnabled ? "bg-[var(--st-status-ok)]" : "bg-[var(--st-text-secondary)]";
    return (
      <span className="flex items-center gap-1.5">
        <span
          aria-hidden
          className={`inline-block h-1.5 w-1.5 rounded-full ${dot}`}
        />
        <span className="truncate">
          {engineEnabled ? "Engine online" : "Engine disabled"} ·{" "}
          {engineUrl.replace(/^https?:\/\//, "")}
        </span>
      </span>
    );
  }, [engineEnabled, engineUrl]);

  return (
    <ZoruHomeShell
      user={user}
      plan={plan}
      sidebarHeading="SabSMS"
      sidebarCaption={caption}
      sidebarGroups={groups}
    >
      {children}
    </ZoruHomeShell>
  );
}
