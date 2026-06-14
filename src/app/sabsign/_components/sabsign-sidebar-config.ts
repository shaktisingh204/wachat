import * as React from "react";

import {
  BarChart3,
  Cable,
  ClipboardList,
  Code2,
  FileSignature,
  FileText,
  FolderKanban,
  History,
  LayoutDashboard,
  Layers,
  Plus,
  Send,
  Settings,
  Stamp,
  Users,
} from "lucide-react";

// Import the `SidebarGroup` *interface* directly from the shell module (the
// 20ui barrel re-exports a `SidebarGroup` value that would shadow the type).
import { type SidebarGroup } from "@/components/sabcrm/20ui/shell";

/**
 * SabSign sidebar — grouped menu configuration. Drives the per-section nav
 * inside the SabSign shell so every `/sabsign/*` page renders inside the SAME
 * sidebar + dock as the rest of the suite.
 */
export function buildSabsignSidebarGroups(
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
          href: "/sabsign/projects",
          active: isActive("/sabsign/projects"),
        },
        {
          id: "overview",
          label: "Envelopes",
          icon: React.createElement(LayoutDashboard),
          href: "/sabsign",
          active: isActive("/sabsign", true),
        },
        {
          id: "new",
          label: "New envelope",
          icon: React.createElement(Plus),
          href: "/sabsign/new",
          active: isActive("/sabsign/new"),
        },
        {
          id: "bulk",
          label: "Bulk send",
          icon: React.createElement(Send),
          href: "/sabsign/bulk",
          active: isActive("/sabsign/bulk"),
        },
      ],
    },
    {
      id: "documents",
      label: "Documents",
      defaultOpen: true,
      items: [
        {
          id: "docs",
          label: "Documents",
          icon: React.createElement(FileText),
          href: "/sabsign/docs",
          active: isActive("/sabsign/docs"),
        },
        {
          id: "templates",
          label: "Templates",
          icon: React.createElement(Layers),
          href: "/sabsign/templates",
          active: isActive("/sabsign/templates"),
        },
        {
          id: "form-builder",
          label: "Form builder",
          icon: React.createElement(ClipboardList),
          href: "/sabsign/form-builder",
          active: isActive("/sabsign/form-builder"),
        },
      ],
    },
    {
      id: "people",
      label: "People & compliance",
      items: [
        {
          id: "contacts",
          label: "Address book",
          icon: React.createElement(Users),
          href: "/sabsign/contacts",
          active: isActive("/sabsign/contacts"),
        },
        {
          id: "notary",
          label: "Notary",
          icon: React.createElement(Stamp),
          href: "/sabsign/notary",
          active: isActive("/sabsign/notary"),
        },
        {
          id: "audit",
          label: "Audit log",
          icon: React.createElement(History),
          href: "/sabsign/audit",
          active: isActive("/sabsign/audit"),
        },
      ],
    },
    {
      id: "developer",
      label: "Developer",
      items: [
        {
          id: "reports",
          label: "Reports",
          icon: React.createElement(BarChart3),
          href: "/sabsign/reports",
          active: isActive("/sabsign/reports"),
        },
        {
          id: "integrations",
          label: "Integrations",
          icon: React.createElement(Cable),
          href: "/sabsign/integrations",
          active: isActive("/sabsign/integrations"),
        },
        {
          id: "api",
          label: "Developer API",
          icon: React.createElement(Code2),
          href: "/sabsign/api",
          active: isActive("/sabsign/api"),
        },
        {
          id: "settings",
          label: "Settings",
          icon: React.createElement(Settings),
          href: "/sabsign/settings",
          active: isActive("/sabsign/settings"),
        },
      ],
    },
  ];
}
