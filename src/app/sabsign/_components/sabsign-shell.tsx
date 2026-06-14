"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { SabHomeShell } from "@/components/sabcrm/20ui";

import { buildSabsignSidebarGroups } from "./sabsign-sidebar-config";

export interface SabsignShellProps {
  user?: {
    name?: string | null;
    email?: string | null;
    avatar?: string | null;
  };
  plan?: {
    name?: string | null;
    credits?: number;
  };
  /** Active SabSign project (resolved server-side from the cookie). */
  activeProjectId?: string | null;
  activeProjectName?: string | null;
  /** Whether the active project has finished mandatory setup. */
  setupComplete?: boolean;
  children: React.ReactNode;
}

export function SabsignShell({
  user,
  plan,
  activeProjectId,
  activeProjectName,
  setupComplete,
  children,
}: SabsignShellProps) {
  const pathname = usePathname();
  const router = useRouter();

  const onPicker =
    pathname === "/sabsign/projects" || !!pathname?.startsWith("/sabsign/projects/");
  const onSetup =
    pathname === "/sabsign/setup" || !!pathname?.startsWith("/sabsign/setup/");
  // In-person kiosk is a public-ish device flow; never gate-redirect it.
  const onKiosk = !!pathname?.startsWith("/sabsign/kiosk");

  // Client-side backstop for the server gate in `layout.tsx` (used when the
  // proxy `x-url` header is unavailable so the server skips the redirect).
  React.useEffect(() => {
    if (onPicker || onSetup || onKiosk) return;
    if (!activeProjectId) {
      router.replace("/sabsign/projects");
    } else if (!setupComplete) {
      router.replace("/sabsign/setup");
    }
  }, [onPicker, onSetup, onKiosk, activeProjectId, setupComplete, router]);

  const groups = React.useMemo(
    () => buildSabsignSidebarGroups(pathname),
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
              href="/sabsign/projects"
              className="shrink-0 text-[var(--st-text-secondary)] underline underline-offset-2 hover:text-[var(--st-text)]"
            >
              Switch
            </Link>
          </>
        ) : (
          <Link
            href="/sabsign/projects"
            className="text-[var(--st-text-secondary)] underline underline-offset-2 hover:text-[var(--st-text)]"
          >
            Select a project
          </Link>
        )}
      </span>
    );
  }, [activeProjectName]);

  return (
    <SabHomeShell
      user={user}
      plan={plan}
      sidebarHeading="SabSign"
      sidebarCaption={caption}
      sidebarGroups={groups}
    >
      {children}
    </SabHomeShell>
  );
}
