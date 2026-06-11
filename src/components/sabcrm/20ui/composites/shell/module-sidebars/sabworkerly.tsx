"use client";

import {
  Banknote,
  Briefcase,
  Building2,
  Clock,
  LayoutDashboard,
  Receipt,
  UserCheck,
  Users,
} from "lucide-react";

import { leaf, type SabAppSidebarConfig } from "./_shared";

export const SABWORKERLY_SIDEBAR: SabAppSidebarConfig = {
  prefix: "/dashboard/sabworkerly",
  heading: "SabWorkerly",
  caption: "Workforce scheduling",
  build: (p) => [
    {
      id: "sabworkerly-workforce",
      label: "Workforce",
      items: [
        leaf("overview", "Overview", "/dashboard/sabworkerly", LayoutDashboard, p, { exact: true }),
        leaf("workers", "Workers", "/dashboard/sabworkerly/workers", Users, p),
        leaf("clients", "Clients", "/dashboard/sabworkerly/clients", Building2, p),
        leaf("jobs", "Jobs", "/dashboard/sabworkerly/jobs", Briefcase, p),
        leaf("placements", "Placements", "/dashboard/sabworkerly/placements", UserCheck, p),
      ],
    },
    {
      id: "sabworkerly-operations",
      label: "Operations",
      items: [
        leaf("timesheets", "Timesheets", "/dashboard/sabworkerly/timesheets", Clock, p),
        leaf("invoices", "Invoices", "/dashboard/sabworkerly/invoices", Receipt, p),
        leaf("payroll", "Payroll", "/dashboard/sabworkerly/payroll", Banknote, p),
      ],
    },
  ],
};
