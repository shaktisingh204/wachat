import * as React from "react";

import {
  Activity,
  BarChart3,
  BookOpen,
  FileSearch,
  FileText,
  FolderKanban,
  GitBranch,
  Inbox,
  KeyRound,
  KeySquare,
  Layers,
  LayoutDashboard,
  Megaphone,
  Network,
  Phone,
  Send,
  ServerCog,
  Settings,
  ShieldCheck,
  Users,
  Webhook,
} from "lucide-react";

// Import the `SidebarGroup` *interface* directly from the shell module.
// The 20ui barrel re-exports both `sidebar.tsx`'s `SidebarGroup` component
// (a value) and `shell.tsx`'s `SidebarGroup` interface via `export *`; the
// value shadows the type, so `import { type SidebarGroup }` from the barrel
// resolves to the value and trips TS2749. The module path is unambiguous.
import { type SidebarGroup } from '@/components/sabcrm/20ui/shell';

/**
 * SabSMS sidebar — grouped menu configuration.
 *
 * Mirrors `buildSabwaSidebarGroups`. Drives the per-section nav inside
 * the SabSMS shell so every `/sabsms/*` page renders inside the SAME
 * sidebar + dock as `/dashboard` and `/sabwa/*`.
 */

export function buildSabsmsSidebarGroups(
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
          href: "/sabsms/projects",
          active: isActive("/sabsms/projects"),
        },
        {
          id: "overview",
          label: "Overview",
          icon: React.createElement(LayoutDashboard),
          href: "/sabsms",
          active: isActive("/sabsms", true),
        },
        {
          id: "send",
          label: "Send",
          icon: React.createElement(Send),
          href: "/sabsms/send",
          active: isActive("/sabsms/send"),
        },
        {
          id: "inbox",
          label: "Inbox",
          icon: React.createElement(Inbox),
          href: "/sabsms/inbox",
          active: isActive("/sabsms/inbox"),
        },
        {
          id: "logs",
          label: "Message logs",
          icon: React.createElement(FileSearch),
          href: "/sabsms/logs",
          active: isActive("/sabsms/logs"),
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
          href: "/sabsms/campaigns",
          active: isActive("/sabsms/campaigns"),
        },
        {
          id: "templates",
          label: "Templates",
          icon: React.createElement(FileText),
          href: "/sabsms/templates",
          active: isActive("/sabsms/templates"),
        },
        {
          id: "drips",
          label: "Drip sequences",
          icon: React.createElement(GitBranch),
          href: "/sabsms/drips",
          active: isActive("/sabsms/drips"),
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
          href: "/sabsms/contacts",
          active: isActive("/sabsms/contacts"),
        },
        {
          id: "suppressions",
          label: "Suppressions",
          icon: React.createElement(ShieldCheck),
          href: "/sabsms/suppressions",
          active: isActive("/sabsms/suppressions"),
        },
        {
          id: "consent",
          label: "Consent log",
          icon: React.createElement(BookOpen),
          href: "/sabsms/consent",
          active: isActive("/sabsms/consent"),
        },
      ],
    },
    {
      id: "infrastructure",
      label: "Infrastructure",
      defaultOpen: true,
      items: [
        {
          id: "numbers",
          label: "Numbers",
          icon: React.createElement(Phone),
          href: "/sabsms/numbers",
          active: isActive("/sabsms/numbers"),
        },
        {
          // The dedicated /sabsms/pool route is a bare redirect back to
          // /sabsms/numbers (no pool config UI), so the sender-pool feature
          // is configured on the routing rules surface. Point users there.
          id: "routing",
          label: "Routing rules",
          icon: React.createElement(Network),
          href: "/sabsms/routing",
          active: isActive("/sabsms/routing"),
        },
        {
          id: "providers",
          label: "Providers",
          icon: React.createElement(ServerCog),
          href: "/sabsms/providers",
          active: isActive("/sabsms/providers"),
        },
        {
          id: "health",
          label: "Provider health",
          icon: React.createElement(Activity),
          href: "/sabsms/health",
          active: isActive("/sabsms/health"),
        },
        {
          id: "compliance",
          label: "Compliance",
          icon: React.createElement(ShieldCheck),
          href: "/sabsms/compliance",
          active: isActive("/sabsms/compliance"),
          children: [
            {
              id: "compliance-dlt",
              label: "India DLT registry",
              icon: React.createElement(Layers),
              href: "/sabsms/compliance/dlt",
              active: isActive("/sabsms/compliance/dlt"),
            },
          ],
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
          href: "/sabsms/analytics",
          active: isActive("/sabsms/analytics"),
        },
        {
          id: "otp",
          label: "OTP / Verify",
          icon: React.createElement(KeySquare),
          href: "/sabsms/otp",
          active: isActive("/sabsms/otp"),
        },
      ],
    },
    {
      id: "developer",
      label: "Developer",
      items: [
        {
          id: "api-keys",
          label: "API keys",
          icon: React.createElement(KeyRound),
          href: "/sabsms/api-keys",
          active: isActive("/sabsms/api-keys"),
        },
        {
          id: "webhooks",
          label: "Outbound webhooks",
          icon: React.createElement(Webhook),
          href: "/sabsms/webhooks",
          active: isActive("/sabsms/webhooks"),
        },
        {
          id: "settings",
          label: "Settings",
          icon: React.createElement(Settings),
          href: "/sabsms/settings",
          active: isActive("/sabsms/settings"),
        },
      ],
    },
  ];
}
