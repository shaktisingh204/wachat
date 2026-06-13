"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { SabHomeShell } from '@/components/sabcrm/20ui';

import { buildSabsmsSidebarGroups } from "./sabsms-sidebar-config";
import "@/components/sabsms/motion/sabsms-motion.css";

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
  /** Active SabSMS project (resolved server-side from the cookie). */
  activeProjectId?: string | null;
  activeProjectName?: string | null;
  /** Whether the active project has finished mandatory setup. */
  setupComplete?: boolean;
  children: React.ReactNode;
}

export function SabsmsShell({
  user,
  plan,
  engineEnabled,
  engineUrl,
  activeProjectId,
  activeProjectName,
  setupComplete,
  children,
}: SabsmsShellProps) {
  const pathname = usePathname();
  const router = useRouter();

  const onPicker =
    pathname === "/sabsms/projects" || !!pathname?.startsWith("/sabsms/projects/");
  const onSetup =
    pathname === "/sabsms/setup" || !!pathname?.startsWith("/sabsms/setup/");

  // Client-side backstop for the server gate in `layout.tsx`. The server
  // redirect relies on the proxy `x-url` header; if it is ever unavailable
  // the layout skips the redirect and we enforce it here instead.
  React.useEffect(() => {
    if (onPicker || onSetup) return;
    if (!activeProjectId) {
      router.replace("/sabsms/projects");
    } else if (!setupComplete) {
      router.replace("/sabsms/setup");
    }
  }, [onPicker, onSetup, activeProjectId, setupComplete, router]);

  const groups = React.useMemo(
    () => buildSabsmsSidebarGroups(pathname),
    [pathname],
  );

  const caption = React.useMemo(() => {
    const dot = engineEnabled
      ? "sabsms-livedot bg-[var(--st-status-ok)] text-[var(--st-status-ok)]"
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
                href="/sabsms/projects"
                className="shrink-0 text-[var(--st-text-secondary)] underline underline-offset-2 hover:text-[var(--st-text)]"
              >
                Switch
              </Link>
            </>
          ) : (
            <Link
              href="/sabsms/projects"
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
      sidebarHeading="SabSMS"
      sidebarCaption={caption}
      sidebarGroups={groups}
    >
      {children}
    </SabHomeShell>
  );
}
