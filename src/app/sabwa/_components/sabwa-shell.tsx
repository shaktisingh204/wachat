"use client";

import { ZoruHomeShell } from '@/components/sabcrm/20ui/zoru';
import { usePathname } from "next/navigation";

/**
 * SabwaShell — wraps `ZoruHomeShell` with the SabWa-specific grouped
 * sidebar (Get started, Inbox & chats, Groups, Outbound, Library,
 * Automation, Media, Reports, Developer, Settings).
 *
 * Mirrors `WachatShell` so every `/sabwa/*` page renders inside the
 * SAME sidebar + dock as `/dashboard`. No bespoke SabWa chrome.
 */

import * as React from "react";

import { useSabwaSession } from "@/lib/sabwa/session-context";

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
  const { current } = useSabwaSession();
  const hasActive = !!current;
  const groups = React.useMemo(
    () => buildSabwaSidebarGroups(pathname, hasActive),
    [pathname, hasActive],
  );

  const caption = React.useMemo(() => {
    if (!current)
      return <span className="text-[var(--st-text-secondary)]">No account active</span>;
    const statusColor =
      current.status === "connected"
        ? "bg-[var(--st-status-ok)]"
        : current.status === "pending" ||
            current.status === "pairing" ||
            current.status === "syncing"
          ? "bg-[var(--st-warn)]"
          : current.status === "banned" || current.status === "error"
            ? "bg-[var(--st-danger)]"
            : "bg-[var(--st-text-secondary)]";
    const label =
      current.label?.trim() ||
      current.pushName?.trim() ||
      (current.phoneE164
        ? current.phoneE164.startsWith("+")
          ? current.phoneE164
          : `+${current.phoneE164}`
        : current.id?.slice(-6)
          ? `Linked WhatsApp · ${current.id.slice(-6)}`
          : "Linked WhatsApp");
    return (
      <span className="flex items-center gap-1.5">
        <span
          aria-hidden
          className={`inline-block h-1.5 w-1.5 rounded-full ${statusColor}`}
        />
        <span className="truncate">{label}</span>
      </span>
    );
  }, [current]);

  return (
    <ZoruHomeShell
      user={user}
      plan={plan}
      sidebarHeading="SabWa"
      sidebarCaption={caption}
      sidebarGroups={groups}
    >
      {children}
    </ZoruHomeShell>
  );
}
