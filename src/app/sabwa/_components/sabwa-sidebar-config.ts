import { type SidebarGroup } from '@/components/sabcrm/20ui/compat';
import {
  Activity,
  BarChart3,
  Bell,
  BookMarked,
  Bot,
  Briefcase,
  ClipboardList,
  Cog,
  FileText,
  Filter,
  Inbox,
  Image as ImageIcon,
  KeyRound,
  LayoutDashboard,
  Library,
  Megaphone,
  MessageCircle,
  MessageSquare,
  PhoneCall,
  PlaySquare,
  QrCode,
  Send,
  Settings,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Star,
  Tag,
  Users,
  Webhook,
  Workflow,
  Zap,
  } from "lucide-react";

/**
 * SabWa sidebar — grouped menu configuration.
 *
 * Drives the per-section nav inside the SabWa shell (mirrors the
 * wachat pattern). All hrefs live under `/sabwa/*`. Returned shape
 * matches `SidebarGroup` so the SabWa layout can pass it straight
 * to `<ZoruHomeShell sidebarGroups={…} />`.
 */
import * as React from "react";

/** Groups whose leaves are gated on having an active SabWa session. */
const SESSION_GATED_GROUPS = new Set<string>([
  "inbox",
  "groups",
  "outbound",
  "library",
  "automation",
  "media",
  "reports",
  "developer",
]);

export function buildSabwaSidebarGroups(
  pathname: string | null,
  hasActiveSession: boolean = true,
): SidebarGroup[] {
  const isActive = (href: string, exact = false) => {
    if (!pathname) return false;
    if (exact) return pathname === href;
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  const groups: SidebarGroup[] = [
    {
      id: "setup",
      label: "Get started",
      defaultOpen: true,
      items: [
        {
          id: "all-projects",
          label: "All Projects",
          icon: React.createElement(Briefcase),
          href: "/sabwa",
          active: isActive("/sabwa", true),
        },
        {
          id: "overview",
          label: "Dashboard",
          icon: React.createElement(LayoutDashboard),
          href: "/sabwa/overview",
          active: isActive("/sabwa/overview"),
        },
        {
          id: "connect",
          label: "Connect WhatsApp",
          icon: React.createElement(QrCode),
          href: "/sabwa/connect",
          active: isActive("/sabwa/connect"),
        },
        {
          id: "devices",
          label: "Linked Devices",
          icon: React.createElement(Smartphone),
          href: "/sabwa/devices",
          active: isActive("/sabwa/devices"),
        },
      ],
    },
    {
      id: "inbox",
      label: "Inbox & chats",
      defaultOpen: true,
      items: [
        {
          id: "inbox",
          label: "Inbox",
          icon: React.createElement(Inbox),
          href: "/sabwa/inbox",
          active: isActive("/sabwa/inbox"),
        },
        {
          id: "chats",
          label: "Chats",
          icon: React.createElement(MessageSquare),
          href: "/sabwa/chats",
          active: isActive("/sabwa/chats"),
        },
        {
          id: "starred",
          label: "Starred",
          icon: React.createElement(Star),
          href: "/sabwa/starred",
          active: isActive("/sabwa/starred"),
        },
      ],
    },
    {
      id: "groups",
      label: "Groups",
      items: [
        {
          id: "groups-all",
          label: "All groups",
          icon: React.createElement(Users),
          href: "/sabwa/groups",
          active: isActive("/sabwa/groups", true),
        },
        {
          id: "groups-categories",
          label: "By category",
          icon: React.createElement(Filter),
          href: "/sabwa/groups/categories",
          active: isActive("/sabwa/groups/categories"),
        },
      ],
    },
    {
      id: "outbound",
      label: "Outbound",
      items: [
        {
          id: "broadcasts",
          label: "Broadcasts",
          icon: React.createElement(Megaphone),
          href: "/sabwa/broadcasts",
          active: isActive("/sabwa/broadcasts"),
        },
        {
          id: "bulk",
          label: "Bulk sender",
          icon: React.createElement(Send),
          href: "/sabwa/bulk",
          active: isActive("/sabwa/bulk"),
        },
        {
          id: "scheduler",
          label: "Scheduler",
          icon: React.createElement(ClipboardList),
          href: "/sabwa/scheduler",
          active: isActive("/sabwa/scheduler", true),
        },
        {
          id: "scheduler-queue",
          label: "Scheduler queue",
          icon: React.createElement(PlaySquare),
          href: "/sabwa/scheduler/queue",
          active: isActive("/sabwa/scheduler/queue"),
        },
      ],
    },
    {
      id: "library",
      label: "Library",
      items: [
        {
          id: "contacts",
          label: "Contacts",
          icon: React.createElement(Users),
          href: "/sabwa/contacts",
          active: isActive("/sabwa/contacts"),
        },
        {
          id: "templates",
          label: "Templates",
          icon: React.createElement(FileText),
          href: "/sabwa/templates",
          active: isActive("/sabwa/templates"),
        },
        {
          id: "quick-replies",
          label: "Quick replies",
          icon: React.createElement(Zap),
          href: "/sabwa/quick-replies",
          active: isActive("/sabwa/quick-replies"),
        },
      ],
    },
    {
      id: "automation",
      label: "Automation",
      items: [
        {
          id: "auto-reply",
          label: "Auto-reply",
          icon: React.createElement(MessageCircle),
          href: "/sabwa/auto-reply",
          active: isActive("/sabwa/auto-reply"),
        },
        {
          id: "flows",
          label: "Chatbot flows",
          icon: React.createElement(Workflow),
          href: "/sabwa/flows",
          active: isActive("/sabwa/flows"),
        },
        {
          id: "ai",
          label: "AI assistant",
          icon: React.createElement(Sparkles),
          href: "/sabwa/ai",
          active: isActive("/sabwa/ai"),
        },
      ],
    },
    {
      id: "media",
      label: "Media",
      items: [
        {
          id: "media",
          label: "Media library",
          icon: React.createElement(ImageIcon),
          href: "/sabwa/media",
          active: isActive("/sabwa/media"),
        },
        {
          id: "status",
          label: "Status / Stories",
          icon: React.createElement(BookMarked),
          href: "/sabwa/status",
          active: isActive("/sabwa/status"),
        },
        {
          id: "calls",
          label: "Calls",
          icon: React.createElement(PhoneCall),
          href: "/sabwa/calls",
          active: isActive("/sabwa/calls"),
        },
        {
          id: "labels",
          label: "Labels",
          icon: React.createElement(Tag),
          href: "/sabwa/labels",
          active: isActive("/sabwa/labels"),
        },
      ],
    },
    {
      id: "reports",
      label: "Reports",
      items: [
        {
          id: "analytics",
          label: "Analytics",
          icon: React.createElement(BarChart3),
          href: "/sabwa/analytics",
          active: isActive("/sabwa/analytics"),
        },
        {
          id: "export",
          label: "Export / Backup",
          icon: React.createElement(Library),
          href: "/sabwa/export",
          active: isActive("/sabwa/export"),
        },
        {
          id: "audit",
          label: "Audit log",
          icon: React.createElement(Activity),
          href: "/sabwa/audit",
          active: isActive("/sabwa/audit"),
        },
      ],
    },
    {
      id: "developer",
      label: "Developer",
      items: [
        {
          id: "webhooks",
          label: "Webhooks",
          icon: React.createElement(Webhook),
          href: "/sabwa/webhooks",
          active: isActive("/sabwa/webhooks"),
        },
        {
          id: "api-keys",
          label: "API keys",
          icon: React.createElement(KeyRound),
          href: "/sabwa/api-keys",
          active: isActive("/sabwa/api-keys"),
        },
      ],
    },
    {
      id: "settings",
      label: "Settings",
      items: [
        {
          id: "settings",
          label: "Settings",
          icon: React.createElement(Settings),
          href: "/sabwa/settings",
          active: isActive("/sabwa/settings"),
        },
      ],
    },
  ];

  if (hasActiveSession) {
    return groups;
  }

  // No active session — annotate gated groups so users see at a glance
  // that the destination needs a connected WhatsApp account. Routing
  // still works; the label suffix is purely a visual hint.
  return groups.map((group) => {
    if (!SESSION_GATED_GROUPS.has(group.id)) {
      return group;
    }
    return {
      ...group,
      items: group.items.map((item) =>
        item.label.includes("· no account")
          ? item
          : { ...item, label: `${item.label} · no account` },
      ),
    };
  });
}
