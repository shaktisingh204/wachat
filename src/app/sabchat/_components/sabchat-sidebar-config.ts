import * as React from "react";

import {
  BarChart3,
  BookOpen,
  Code2,
  FolderKanban,
  Gauge,
  Inbox,
  MessagesSquare,
  CalendarRange,
  Settings,
  Settings2,
  ShoppingCart,
  Workflow,
  Wrench,
} from "lucide-react";

// Import the `SidebarGroup` *interface* directly from the shell module (the
// 20ui barrel re-exports a value of the same name from `sidebar.tsx`, which
// would shadow the type — see the SabSMS sidebar config for the rationale).
import { type SidebarGroup } from "@/components/sabcrm/20ui/shell";

/**
 * SabChat sidebar — grouped menu configuration.
 *
 * Drives the per-section nav inside the SabChat shell so every `/sabchat/*`
 * page renders inside the SAME sidebar + dock as the rest of SabNode. Groups
 * grow as later phases land their pages; routes listed here are the ones that
 * exist (no dead links).
 */
export function buildSabchatSidebarGroups(
  pathname: string | null,
): SidebarGroup[] {
  const isActive = (href: string, exact = false) => {
    if (!pathname) return false;
    if (exact) return pathname === href;
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  return [
    {
      id: "conversations",
      label: "Conversations",
      defaultOpen: true,
      items: [
        {
          id: "inbox",
          label: "Inbox",
          icon: React.createElement(Inbox),
          href: "/sabchat/inbox",
          active: isActive("/sabchat/inbox"),
        },
        {
          id: "projects",
          label: "Projects",
          icon: React.createElement(FolderKanban),
          href: "/sabchat/projects",
          active: isActive("/sabchat/projects"),
        },
      ],
    },
    {
      id: "insights",
      label: "Insights",
      defaultOpen: true,
      items: [
        {
          id: "reports",
          label: "Reports",
          icon: React.createElement(BarChart3),
          href: "/sabchat/reports",
          active: isActive("/sabchat/reports"),
        },
        {
          id: "quality",
          label: "Quality review",
          icon: React.createElement(Gauge),
          href: "/sabchat/quality",
          active: isActive("/sabchat/quality"),
        },
        {
          id: "wfm",
          label: "Workforce",
          icon: React.createElement(CalendarRange),
          href: "/sabchat/wfm",
          active: isActive("/sabchat/wfm"),
        },
      ],
    },
    {
      id: "engage",
      label: "Engage",
      defaultOpen: true,
      items: [
        {
          id: "journeys",
          label: "Journeys",
          icon: React.createElement(Workflow),
          href: "/sabchat/journeys",
          active: isActive("/sabchat/journeys"),
        },
        {
          id: "cart-recovery",
          label: "Cart recovery",
          icon: React.createElement(ShoppingCart),
          href: "/sabchat/cart-recovery",
          active: isActive("/sabchat/cart-recovery"),
        },
      ],
    },
    {
      id: "configure",
      label: "Configure",
      defaultOpen: true,
      items: [
        {
          id: "widget",
          label: "Widget Studio",
          icon: React.createElement(Code2),
          href: "/sabchat/widget",
          active: isActive("/sabchat/widget"),
        },
        {
          id: "knowledge",
          label: "Knowledge base",
          icon: React.createElement(BookOpen),
          href: "/sabchat/knowledge",
          active: isActive("/sabchat/knowledge"),
        },
        {
          id: "community",
          label: "Community",
          icon: React.createElement(MessagesSquare),
          href: "/sabchat/community",
          active: isActive("/sabchat/community"),
        },
        {
          id: "actions",
          label: "AI actions",
          icon: React.createElement(Wrench),
          href: "/sabchat/actions",
          active: isActive("/sabchat/actions"),
        },
        {
          id: "admin",
          label: "Admin",
          icon: React.createElement(Settings2),
          href: "/sabchat/admin",
          active: isActive("/sabchat/admin"),
        },
        {
          id: "settings",
          label: "Settings",
          icon: React.createElement(Settings),
          href: "/sabchat/settings",
          active: isActive("/sabchat/settings"),
        },
      ],
    },
  ];
}
