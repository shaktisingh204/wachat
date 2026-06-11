"use client";

import {
  Activity,
  AlertTriangle,
  BellRing,
  Globe2,
  LayoutDashboard,
  ListOrdered,
  Network,
  PlaySquare,
  Radio,
} from "lucide-react";

import { leaf, type SabAppSidebarConfig } from "./_shared";

export const SABMONITOR_SIDEBAR: SabAppSidebarConfig = {
  prefix: "/dashboard/sabmonitor",
  heading: "SabMonitor",
  caption: "Uptime & APM",
  build: (p) => [
    {
      id: "sabmonitor-monitoring",
      label: "Monitoring",
      items: [
        leaf("overview", "Overview", "/dashboard/sabmonitor", LayoutDashboard, p, { exact: true }),
        leaf("checks", "Checks", "/dashboard/sabmonitor/checks", Activity, p),
        leaf("incidents", "Incidents", "/dashboard/sabmonitor/incidents", AlertTriangle, p),
        leaf("alert-policies", "Alert policies", "/dashboard/sabmonitor/alert-policies", BellRing, p),
        leaf("status-pages", "Status pages", "/dashboard/sabmonitor/status-pages", Globe2, p),
      ],
    },
    {
      id: "sabmonitor-synthetics",
      label: "Synthetics & APM",
      items: [
        leaf("synthetic-scripts", "Synthetic scripts", "/dashboard/sabmonitor/synthetic-scripts", PlaySquare, p),
        leaf("api-transactions", "API transactions", "/dashboard/sabmonitor/api-transactions", ListOrdered, p),
        leaf("apm-traces", "APM traces", "/dashboard/sabmonitor/apm/traces", Network, p),
        leaf("probes", "Probes", "/dashboard/sabmonitor/probes", Radio, p),
      ],
    },
  ],
};
