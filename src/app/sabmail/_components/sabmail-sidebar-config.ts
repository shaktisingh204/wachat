import * as React from "react";

import {
  AtSign,
  BarChart3,
  Bot,
  FileText,
  Filter,
  FolderKanban,
  Globe,
  Inbox,
  Layers,
  LayoutDashboard,
  Lock,
  Mailbox,
  Megaphone,
  ScrollText,
  Settings,
  ShieldBan,
  ShieldQuestion,
  Sparkles,
  SquarePen,
  Users,
  UsersRound,
  Workflow,
} from "lucide-react";

// Import the `SidebarGroup` *interface* directly from the shell module (not
// the 20ui barrel) to avoid the value/type shadowing that trips TS2749 —
// see the same note in `sabsms-sidebar-config.ts`.
import { type SidebarGroup } from "@/components/sabcrm/20ui/shell";

/**
 * SabMail sidebar — grouped menu configuration. Covers the full module:
 * inbox client, outbound (campaigns/templates/automations), audience,
 * insights, AI, deliverability, and settings.
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
        {
          id: "unified",
          label: "Unified inbox",
          icon: React.createElement(Layers),
          href: "/sabmail/unified",
          active: isActive("/sabmail/unified"),
        },
        {
          id: "ask-ai",
          label: "Ask AI",
          icon: React.createElement(Sparkles),
          href: "/sabmail/ai",
          active: isActive("/sabmail/ai"),
        },
      ],
    },
    {
      id: "outbound",
      label: "Outbound",
      defaultOpen: true,
      items: [
        {
          id: "campaigns",
          label: "Campaigns",
          icon: React.createElement(Megaphone),
          href: "/sabmail/campaigns",
          active: isActive("/sabmail/campaigns"),
        },
        {
          id: "templates",
          label: "Templates",
          icon: React.createElement(FileText),
          href: "/sabmail/templates",
          active: isActive("/sabmail/templates"),
        },
        {
          id: "automations",
          label: "Automations",
          icon: React.createElement(Workflow),
          href: "/sabmail/automations",
          active: isActive("/sabmail/automations"),
        },
        {
          id: "forms",
          label: "Forms",
          icon: React.createElement(SquarePen),
          href: "/sabmail/forms",
          active: isActive("/sabmail/forms"),
        },
      ],
    },
    {
      id: "ai-rules",
      label: "AI & rules",
      items: [
        {
          id: "autopilot",
          label: "Autopilot",
          icon: React.createElement(Bot),
          href: "/sabmail/autopilot",
          active: isActive("/sabmail/autopilot"),
        },
        {
          id: "rules",
          label: "Rules",
          icon: React.createElement(ScrollText),
          href: "/sabmail/rules",
          active: isActive("/sabmail/rules"),
        },
        {
          id: "screener",
          label: "Screener",
          icon: React.createElement(ShieldQuestion),
          href: "/sabmail/screener",
          active: isActive("/sabmail/screener"),
        },
      ],
    },
    {
      id: "audience",
      label: "Audience",
      items: [
        {
          id: "contacts",
          label: "Contacts",
          icon: React.createElement(Users),
          href: "/sabmail/contacts",
          active: isActive("/sabmail/contacts"),
        },
        {
          id: "segments",
          label: "Segments",
          icon: React.createElement(Filter),
          href: "/sabmail/segments",
          active: isActive("/sabmail/segments"),
        },
        {
          id: "suppressions",
          label: "Suppressions",
          icon: React.createElement(ShieldBan),
          href: "/sabmail/suppressions",
          active: isActive("/sabmail/suppressions"),
        },
      ],
    },
    {
      id: "team",
      label: "Team",
      items: [
        {
          id: "team-inbox",
          label: "Shared inbox",
          icon: React.createElement(UsersRound),
          href: "/sabmail/team",
          active: isActive("/sabmail/team"),
        },
      ],
    },
    {
      id: "mailboxes",
      label: "Mailboxes",
      items: [
        {
          id: "accounts",
          label: "Accounts",
          icon: React.createElement(AtSign),
          href: "/sabmail/accounts",
          active: isActive("/sabmail/accounts"),
        },
        {
          id: "hosted-mail",
          label: "Hosted mail",
          icon: React.createElement(Mailbox),
          href: "/sabmail/mailboxes",
          active: isActive("/sabmail/mailboxes"),
        },
        {
          id: "domains",
          label: "Domains & deliverability",
          icon: React.createElement(Globe),
          href: "/sabmail/domains",
          active: isActive("/sabmail/domains"),
        },
      ],
    },
    {
      id: "insights",
      label: "Insights",
      items: [
        {
          id: "analytics",
          label: "Analytics",
          icon: React.createElement(BarChart3),
          href: "/sabmail/analytics",
          active: isActive("/sabmail/analytics"),
        },
      ],
    },
    {
      id: "developer",
      label: "Developer",
      items: [
        {
          id: "settings",
          label: "Settings",
          icon: React.createElement(Settings),
          href: "/sabmail/settings",
          active: isActive("/sabmail/settings"),
        },
        {
          id: "security",
          label: "Security & encryption",
          icon: React.createElement(Lock),
          href: "/sabmail/security",
          active: isActive("/sabmail/security"),
        },
      ],
    },
  ];
}
