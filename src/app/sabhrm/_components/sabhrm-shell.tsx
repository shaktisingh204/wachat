"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { SabHomeShell } from "@/components/sabcrm/20ui";

import { buildSabHrmSidebarGroups } from "./sabhrm-sidebar-config";

export interface SabHrmShellProps {
  user?: {
    name?: string | null;
    email?: string | null;
    avatar?: string | null;
  };
  plan?: {
    name?: string | null;
    credits?: number;
  };
  /** Active SabHRM organization (resolved server-side from the cookie). */
  activeProjectId?: string | null;
  activeProjectName?: string | null;
  /** Whether the active organization has finished mandatory setup. */
  setupComplete?: boolean;
  children: React.ReactNode;
}

export function SabHrmShell({
  user,
  plan,
  activeProjectId,
  activeProjectName,
  setupComplete,
  children,
}: SabHrmShellProps) {
  const pathname = usePathname();
  const router = useRouter();

  const onPicker =
    pathname === "/sabhrm/projects" || !!pathname?.startsWith("/sabhrm/projects/");
  const onSetup =
    pathname === "/sabhrm/setup" || !!pathname?.startsWith("/sabhrm/setup/");

  // Client-side backstop for the server gate in `layout.tsx`.
  React.useEffect(() => {
    if (onPicker || onSetup) return;
    if (!activeProjectId) {
      router.replace("/sabhrm/projects");
    } else if (!setupComplete) {
      router.replace("/sabhrm/setup");
    }
  }, [onPicker, onSetup, activeProjectId, setupComplete, router]);

  const groups = React.useMemo(
    () => buildSabHrmSidebarGroups(pathname),
    [pathname],
  );

  const caption = React.useMemo(() => {
    return (
      <span className="flex items-center gap-1.5">
        {activeProjectName ? (
          <>
            <span className="truncate font-medium text-[var(--st-text)]">
              {activeProjectName}
            </span>
            <Link
              href="/sabhrm/projects"
              className="shrink-0 text-[var(--st-text-secondary)] underline underline-offset-2 hover:text-[var(--st-text)]"
            >
              Switch
            </Link>
          </>
        ) : (
          <Link
            href="/sabhrm/projects"
            className="text-[var(--st-text-secondary)] underline underline-offset-2 hover:text-[var(--st-text)]"
          >
            Select an organization
          </Link>
        )}
      </span>
    );
  }, [activeProjectName]);

  return (
    <SabHomeShell
      user={user}
      plan={plan}
      sidebarHeading="SabHRM"
      sidebarCaption={caption}
      sidebarGroups={groups}
    >
      {children}
    </SabHomeShell>
  );
}
