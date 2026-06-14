"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { SabHomeShell } from '@/components/sabcrm/20ui';

import { buildSabcallSidebarGroups } from "./sabcall-sidebar-config";

export interface SabcallShellProps {
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
  /** Active SabCall project (resolved server-side from the cookie). */
  activeProjectId?: string | null;
  activeProjectName?: string | null;
  /** Whether the active project has finished mandatory setup. */
  setupComplete?: boolean;
  children: React.ReactNode;
}

export function SabcallShell({
  user,
  plan,
  engineEnabled,
  engineUrl,
  activeProjectId,
  activeProjectName,
  setupComplete,
  children,
}: SabcallShellProps) {
  const pathname = usePathname();
  const router = useRouter();

  const onPicker =
    pathname === "/sabcall/projects" || !!pathname?.startsWith("/sabcall/projects/");
  const onSetup =
    pathname === "/sabcall/setup" || !!pathname?.startsWith("/sabcall/setup/");

  // Client-side backstop for the server gate in `layout.tsx`. The server
  // redirect relies on the proxy `x-url` header; if it is ever unavailable the
  // layout skips the redirect and we enforce it here instead.
  React.useEffect(() => {
    if (onPicker || onSetup) return;
    if (!activeProjectId) {
      router.replace("/sabcall/projects");
    } else if (!setupComplete) {
      router.replace("/sabcall/setup");
    }
  }, [onPicker, onSetup, activeProjectId, setupComplete, router]);

  const groups = React.useMemo(
    () => buildSabcallSidebarGroups(pathname),
    [pathname],
  );

  const caption = React.useMemo(() => {
    const dot = engineEnabled
      ? "bg-[var(--st-status-ok)]"
      : "bg-[var(--st-text-secondary)]";
    return (
      <span className="flex flex-col gap-1">
        <span className="flex items-center gap-1.5">
          {activeProjectName ? (
            <>
              <span className="truncate font-medium text-[var(--st-text)]">
                {activeProjectName}
              </span>
              <Link
                href="/sabcall/projects"
                className="shrink-0 text-[var(--st-text-secondary)] underline underline-offset-2 hover:text-[var(--st-text)]"
              >
                Switch
              </Link>
            </>
          ) : (
            <Link
              href="/sabcall/projects"
              className="text-[var(--st-text-secondary)] underline underline-offset-2 hover:text-[var(--st-text)]"
            >
              Select a project
            </Link>
          )}
        </span>
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
      </span>
    );
  }, [engineEnabled, engineUrl, activeProjectName]);

  return (
    <SabHomeShell
      user={user}
      plan={plan}
      sidebarHeading="SabCall"
      sidebarCaption={caption}
      sidebarGroups={groups}
    >
      {children}
    </SabHomeShell>
  );
}
