import * as React from "react";

import {
  AtSign,
  FolderKanban,
  Inbox,
  LayoutDashboard,
} from "lucide-react";

// Import the `SidebarGroup` *interface* directly from the shell module (not
// the 20ui barrel) to avoid the value/type shadowing that trips TS2749 —
// see the same note in `sabsms-sidebar-config.ts`.
import { type SidebarGroup } from "@/components/sabcrm/20ui/shell";

/**
 * SabMail sidebar — grouped menu configuration.
 *
 * Phase 0 lists only routes that exist (no dead links). New groups —
 * Inbox / Threads / Compose, Contacts, Campaigns, Automations, Templates,
 * Domains & Deliverability, Analytics, Settings, AI — are added as their
 * phases land (see the SabMail roadmap).
 */
export function buildSabmailSidebarGroups(
  pathname: string | null,
): SidebarGroup[] {
  const isActive = (href: string, exact = false) => {
    if (!pathname) return false;
    if (exact) return pathname === href;
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  return [
    {
      id: "workspace",
      label: "Workspace",
      defaultOpen: true,
      items: [
        {
          id: "projects",
          label: "Projects",
          icon: React.createElement(FolderKanban),
          href: "/sabmail/projects",
          active: isActive("/sabmail/projects"),
        },
        {
          id: "overview",
          label: "Overview",
          icon: React.createElement(LayoutDashboard),
          href: "/sabmail",
          active: isActive("/sabmail", true),
        },
        {
          id: "inbox",
          label: "Inbox",
          icon: React.createElement(Inbox),
          href: "/sabmail/inbox",
          active: isActive("/sabmail/inbox"),
        },
      ],
    },
    {
      id: "mailboxes",
      label: "Mailboxes",
      defaultOpen: true,
      items: [
        {
          id: "accounts",
          label: "Accounts",
          icon: React.createElement(AtSign),
          href: "/sabmail/accounts",
          active: isActive("/sabmail/accounts"),
        },
      ],
    },
  ];
}
