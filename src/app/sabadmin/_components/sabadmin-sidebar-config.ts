import * as React from "react";

import {
  Boxes,
  Globe,
  History,
  LayoutDashboard,
  Settings,
  Users,
} from "lucide-react";

// Import the `SidebarGroup` *interface* from the shell module (the 20ui barrel
// re-exports a `SidebarGroup` value that would shadow the type).
import { type SidebarGroup } from "@/components/sabcrm/20ui/shell";

/**
 * SabAdmin (Admin Center) sidebar — grouped menu config so every `/sabadmin/*`
 * page renders inside the SAME sidebar + dock as the rest of the suite.
 */
export function buildSabAdminSidebarGroups(
  pathname: string | null,
): SidebarGroup[] {
  const isActive = (href: string, exact = false) => {
    if (!pathname) return false;
    if (exact) return pathname === href;
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  return [
    {
      id: "admin",
      label: "Admin Center",
      defaultOpen: true,
      items: [
        {
          id: "overview",
          label: "Overview",
          icon: React.createElement(LayoutDashboard),
          href: "/sabadmin",
          active: isActive("/sabadmin", true),
        },
        {
          id: "people",
          label: "People",
          icon: React.createElement(Users),
          href: "/sabadmin/people",
          active: isActive("/sabadmin/people"),
        },
        {
          id: "access",
          label: "Access Packages",
          icon: React.createElement(Boxes),
          href: "/sabadmin/access",
          active: isActive("/sabadmin/access"),
        },
      ],
    },
    {
      id: "govern",
      label: "Governance",
      defaultOpen: true,
      items: [
        {
          id: "audit",
          label: "Audit log",
          icon: React.createElement(History),
          href: "/sabadmin/audit",
          active: isActive("/sabadmin/audit"),
        },
        {
          id: "domains",
          label: "Domains & Email",
          icon: React.createElement(Globe),
          href: "/sabadmin/settings",
          active: false,
        },
        {
          id: "settings",
          label: "Settings",
          icon: React.createElement(Settings),
          href: "/sabadmin/settings",
          active: isActive("/sabadmin/settings"),
        },
      ],
    },
  ];
}
