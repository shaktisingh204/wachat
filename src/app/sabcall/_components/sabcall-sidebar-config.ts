import * as React from "react";

import {
  FolderKanban,
  Headphones,
  Layers,
  LayoutDashboard,
  Phone,
  PhoneCall,
  Voicemail,
  Workflow,
} from "lucide-react";

// Import the `SidebarGroup` *interface* directly from the shell module — the
// 20ui barrel re-exports both `sidebar.tsx`'s `SidebarGroup` value and
// `shell.tsx`'s `SidebarGroup` interface, and the value shadows the type
// (TS2749). The module path is unambiguous.
import { type SidebarGroup } from '@/components/sabcrm/20ui/shell';

/**
 * SabCall sidebar — grouped menu configuration.
 *
 * Drives the per-section nav inside the SabCall shell so every `/sabcall/*`
 * page renders inside the SAME sidebar + dock as the other suite apps.
 * Mirrors `buildSabsmsSidebarGroups`. (No "Remote assist" group — the
 * remote-screen-share feature was removed; SabCall is purely telephony.)
 */
export function buildSabcallSidebarGroups(
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
          href: "/sabcall/projects",
          active: isActive("/sabcall/projects"),
        },
        {
          id: "overview",
          label: "Overview",
          icon: React.createElement(LayoutDashboard),
          href: "/sabcall",
          active: isActive("/sabcall", true),
        },
      ],
    },
    {
      id: "calling",
      label: "Calling",
      defaultOpen: true,
      items: [
        {
          id: "agent-dashboard",
          label: "Agent dashboard",
          icon: React.createElement(Headphones),
          href: "/sabcall/agent-dashboard",
          active: isActive("/sabcall/agent-dashboard"),
        },
        {
          id: "calls",
          label: "Call log",
          icon: React.createElement(PhoneCall),
          href: "/sabcall/calls",
          active: isActive("/sabcall/calls"),
        },
        {
          id: "voicemail",
          label: "Voicemail",
          icon: React.createElement(Voicemail),
          href: "/sabcall/voicemail",
          active: isActive("/sabcall/voicemail"),
        },
      ],
    },
    {
      id: "routing",
      label: "Routing",
      defaultOpen: true,
      items: [
        {
          id: "dids",
          label: "Phone numbers",
          icon: React.createElement(Phone),
          href: "/sabcall/dids",
          active: isActive("/sabcall/dids"),
        },
        {
          id: "ivr",
          label: "IVR flows",
          icon: React.createElement(Workflow),
          href: "/sabcall/ivr",
          active: isActive("/sabcall/ivr"),
        },
        {
          id: "queues",
          label: "Call queues",
          icon: React.createElement(Layers),
          href: "/sabcall/queues",
          active: isActive("/sabcall/queues"),
        },
      ],
    },
  ];
}
