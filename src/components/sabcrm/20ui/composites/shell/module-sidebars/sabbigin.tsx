"use client";

import {
  Building2,
  CalendarCheck,
  CheckCheck,
  Contact,
  GaugeCircle,
  Handshake,
  LayoutDashboard,
  Package,
  Settings2,
  Workflow,
  Zap,
} from "lucide-react";

import { leaf, type SabAppSidebarConfig } from "./_shared";

/**
 * SabBigin (pipeline CRM) sidebar.
 *
 * Flat groups of leaves (the sidebar model supports nothing deeper). Quick-add
 * lives in the shell header `+` / ⌘K rather than dedicated "New …" leaves, so
 * this list stays scannable. Calendar/board sub-views are reached via the
 * in-page view switcher (`?view=`), not separate leaves — `leaf()` matches by
 * pathname, so query-param leaves wouldn't highlight correctly.
 */
export const SABBIGIN_SIDEBAR: SabAppSidebarConfig = {
  prefix: "/dashboard/sabbigin",
  heading: "SabBigin",
  caption: "Pipeline CRM",
  build: (p) => [
    {
      id: "sabbigin-overview",
      label: "Overview",
      items: [
        leaf("home", "Home", "/dashboard/sabbigin", GaugeCircle, p, { exact: true }),
        leaf("dashboards", "Dashboards", "/dashboard/sabbigin/dashboards", LayoutDashboard, p),
      ],
    },
    {
      id: "sabbigin-sales",
      label: "Sales",
      items: [
        leaf("deals", "Deals", "/dashboard/sabbigin/deals", Handshake, p),
        leaf("activities", "Activities", "/dashboard/sabbigin/activities", CalendarCheck, p),
      ],
    },
    {
      id: "sabbigin-records",
      label: "Records",
      items: [
        leaf("contacts", "Contacts", "/dashboard/sabbigin/contacts", Contact, p),
        leaf("companies", "Companies", "/dashboard/sabbigin/companies", Building2, p),
        leaf("products", "Products", "/dashboard/sabbigin/products", Package, p),
      ],
    },
    {
      id: "sabbigin-automation",
      label: "Automation",
      items: [
        leaf("automation", "Rules", "/dashboard/sabbigin/automation", Zap, p),
        leaf("approvals", "Approvals", "/dashboard/sabbigin/approvals", CheckCheck, p),
      ],
    },
    {
      id: "sabbigin-workspace",
      label: "Workspace",
      items: [
        leaf("pipelines", "Pipelines", "/dashboard/sabbigin/pipelines", Workflow, p),
        leaf("settings", "Settings", "/dashboard/sabbigin/settings", Settings2, p),
      ],
    },
  ],
};
