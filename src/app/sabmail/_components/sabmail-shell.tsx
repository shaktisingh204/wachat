"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { SabHomeShell } from "@/components/sabcrm/20ui";

import { buildSabmailSidebarGroups } from "./sabmail-sidebar-config";

export interface SabmailShellProps {
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
  /** Active SabMail project (resolved server-side from the cookie). */
  activeProjectId?: string | null;
  activeProjectName?: string | null;
  /** Whether the active project has finished mandatory setup. */
  setupComplete?: boolean;
  children: React.ReactNode;
}

export function SabmailShell({
  user,
  plan,
  engineEnabled,
  engineUrl,
  activeProjectId,
  activeProjectName,
  setupComplete,
  children,
}: SabmailShellProps) {
  const pathname = usePathname();
  const router = useRouter();

  const onPicker =
    pathname === "/sabmail/projects" || !!pathname?.startsWith("/sabmail/projects/");
  const onSetup =
    pathname === "/sabmail/setup" || !!pathname?.startsWith("/sabmail/setup/");

  // Client-side backstop for the server gate in `layout.tsx` (covers the rare
  // case where the proxy `x-url` header is unavailable).
  React.useEffect(() => {
    if (onPicker || onSetup) return;
    if (!activeProjectId) {
      router.replace("/sabmail/projects");
    } else if (!setupComplete) {
      router.replace("/sabmail/setup");
    }
  }, [onPicker, onSetup, activeProjectId, setupComplete, router]);

  const groups = React.useMemo(
    () => buildSabmailSidebarGroups(pathname),
    [pathname],
  );

  const caption = React.useMemo(() => {
    return (
      <span className="flex flex-col gap-1">
        <span className="flex items-center gap-1.5">
          {activeProjectName ? (
            <>
              <span className="truncate font-medium text-[var(--st-text)]">
                {activeProjectName}
              </span>
              <Link
                href="/sabmail/projects"
                className="shrink-0 text-[var(--st-text-secondary)] underline underline-offset-2 hover:text-[var(--st-text)]"
              >
                Switch
              </Link>
            </>
          ) : (
            <Link
              href="/sabmail/projects"
              className="text-[var(--st-text-secondary)] underline underline-offset-2 hover:text-[var(--st-text)]"
            >
              Select a project
            </Link>
          )}
        </span>
        <span className="flex items-center gap-1.5">
          <span
            aria-hidden
            className={`inline-block h-1.5 w-1.5 rounded-full ${
              engineEnabled
                ? "bg-[var(--st-status-ok,#16a34a)]"
                : "bg-[var(--st-text-secondary)]"
            }`}
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
      sidebarHeading="SabMail"
      sidebarCaption={caption}
      sidebarGroups={groups}
    >
      {children}
    </SabHomeShell>
  );
}
