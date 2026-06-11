"use client";

import { Boxes, LayoutDashboard, ShieldAlert, ShieldCheck } from "lucide-react";

import { leaf, type SabAppSidebarConfig } from "./_shared";

export const SABOPS_SIDEBAR: SabAppSidebarConfig = {
  prefix: "/dashboard/sabops",
  heading: "SabOps",
  caption: "Endpoint fleet ops",
  build: (p) => [
    {
      id: "sabops-fleet",
      label: "Fleet",
      items: [
        leaf("overview", "Overview", "/dashboard/sabops", LayoutDashboard, p, { exact: true }),
        leaf("inventory", "Inventory", "/dashboard/sabops/inventory", Boxes, p),
        leaf("mdm-profiles", "MDM profiles", "/dashboard/sabops/mdm-profiles", ShieldCheck, p),
        leaf("alerts", "Alerts", "/dashboard/sabops/alerts", ShieldAlert, p),
      ],
    },
  ],
};
