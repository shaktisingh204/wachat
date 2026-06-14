"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { SabHomeShell } from "@/components/sabcrm/20ui";

import { buildSabchatSidebarGroups } from "./sabchat-sidebar-config";

export interface SabchatShellProps {
  user?: {
    name?: string | null;
    email?: string | null;
    avatar?: string | null;
  };
  plan?: {
    name?: string | null;
    credits?: number;
  };
  engineUrl: string;
  /** Active SabChat project (resolved server-side from the cookie). */
  activeProjectId?: string | null;
  activeProjectName?: string | null;
  /** Whether the active project has finished mandatory setup. */
  setupComplete?: boolean;
  children: React.ReactNode;
}

export function SabchatShell({
  user,
  plan,
  engineUrl,
  activeProjectId,
  activeProjectName,
  setupComplete,
  children,
}: SabchatShellProps) {
  const pathname = usePathname();
  const router = useRouter();

  const onPicker =
    pathname === "/sabchat/projects" ||
    !!pathname?.startsWith("/sabchat/projects/");
  const onSetup =
    pathname === "/sabchat/setup" || !!pathname?.startsWith("/sabchat/setup/");

  // Client-side backstop for the server gate in `layout.tsx`. The server
  // redirect relies on the proxy `x-url` header; if it is ever unavailable
  // the layout skips the redirect and we enforce it here instead.
  React.useEffect(() => {
    if (onPicker || onSetup) return;
    if (!activeProjectId) {
      router.replace("/sabchat/projects");
    } else if (!setupComplete) {
      router.replace("/sabchat/setup");
    }
  }, [onPicker, onSetup, activeProjectId, setupComplete, router]);

  const groups = React.useMemo(
    () => buildSabchatSidebarGroups(pathname),
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
                href="/sabchat/projects"
                className="shrink-0 text-[var(--st-text-secondary)] underline underline-offset-2 hover:text-[var(--st-text)]"
              >
                Switch
              </Link>
            </>
          ) : (
            <Link
              href="/sabchat/projects"
              className="text-[var(--st-text-secondary)] underline underline-offset-2 hover:text-[var(--st-text)]"
            >
              Select a project
            </Link>
          )}
        </span>
        <span className="flex items-center gap-1.5 text-[var(--st-text-secondary)]">
          <span
            aria-hidden
            className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--st-status-ok)]"
          />
          <span className="truncate">
            Engine · {engineUrl.replace(/^https?:\/\//, "")}
          </span>
        </span>
      </span>
    );
  }, [engineUrl, activeProjectName]);

  return (
    <SabHomeShell
      user={user}
      plan={plan}
      sidebarHeading="SabChat"
      sidebarCaption={caption}
      sidebarGroups={groups}
    >
      {children}
    </SabHomeShell>
  );
}
