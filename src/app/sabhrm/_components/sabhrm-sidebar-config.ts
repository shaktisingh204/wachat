import * as React from "react";

import {
  BarChart3,
  CalendarDays,
  CalendarOff,
  Clock,
  Coins,
  FileText,
  FolderKanban,
  Gauge,
  LayoutDashboard,
  Network,
  ReceiptText,
  Settings,
  Target,
  Timer,
  UserRound,
  Users,
  Wallet,
} from "lucide-react";

// Import the `SidebarGroup` *interface* directly from the shell module (the
// barrel's `export *` shadows it with the sidebar.tsx component value → TS2749).
import { type SidebarGroup } from "@/components/sabcrm/20ui/shell";

/**
 * SabHRM sidebar — grouped navigation rendered inside the SabHomeShell so
 * every `/sabhrm/*` page shares the same dock + sidebar chrome.
 */
export function buildSabHrmSidebarGroups(
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
          id: "overview",
          label: "Dashboard",
          icon: React.createElement(LayoutDashboard),
          href: "/sabhrm",
          active: isActive("/sabhrm", true),
        },
        {
          id: "org",
          label: "Organizations",
          icon: React.createElement(FolderKanban),
          href: "/sabhrm/projects",
          active: isActive("/sabhrm/projects"),
        },
        {
          id: "analytics",
          label: "Analytics",
          icon: React.createElement(BarChart3),
          href: "/sabhrm/analytics",
          active: isActive("/sabhrm/analytics"),
        },
      ],
    },
    {
      id: "people",
      label: "People",
      defaultOpen: true,
      items: [
        {
          id: "employees",
          label: "Employees",
          icon: React.createElement(Users),
          href: "/sabhrm/employees",
          active: isActive("/sabhrm/employees"),
        },
        {
          id: "org-chart",
          label: "Org chart",
          icon: React.createElement(Network),
          href: "/sabhrm/org-chart",
          active: isActive("/sabhrm/org-chart"),
        },
        {
          id: "ess",
          label: "My space (ESS)",
          icon: React.createElement(UserRound),
          href: "/sabhrm/me",
          active: isActive("/sabhrm/me"),
        },
      ],
    },
    {
      id: "time",
      label: "Time & attendance",
      defaultOpen: true,
      items: [
        {
          id: "attendance",
          label: "Attendance",
          icon: React.createElement(Clock),
          href: "/sabhrm/attendance",
          active: isActive("/sabhrm/attendance"),
        },
        {
          id: "leave",
          label: "Leave",
          icon: React.createElement(CalendarOff),
          href: "/sabhrm/leave",
          active: isActive("/sabhrm/leave"),
        },
        {
          id: "shifts",
          label: "Shifts",
          icon: React.createElement(CalendarDays),
          href: "/sabhrm/shifts",
          active: isActive("/sabhrm/shifts"),
        },
        {
          id: "holidays",
          label: "Holidays",
          icon: React.createElement(CalendarDays),
          href: "/sabhrm/holidays",
          active: isActive("/sabhrm/holidays"),
        },
        {
          id: "time-logs",
          label: "Timesheets",
          icon: React.createElement(Timer),
          href: "/sabhrm/time-logs",
          active: isActive("/sabhrm/time-logs"),
        },
      ],
    },
    {
      id: "payroll",
      label: "Payroll",
      defaultOpen: true,
      items: [
        {
          id: "payroll-runs",
          label: "Payroll runs",
          icon: React.createElement(Wallet),
          href: "/sabhrm/payroll-runs",
          active: isActive("/sabhrm/payroll-runs"),
        },
        {
          id: "payslips",
          label: "Payslips",
          icon: React.createElement(ReceiptText),
          href: "/sabhrm/payslips",
          active: isActive("/sabhrm/payslips"),
        },
        {
          id: "salary-structures",
          label: "Salary structures",
          icon: React.createElement(Coins),
          href: "/sabhrm/salary-structures",
          active: isActive("/sabhrm/salary-structures"),
        },
      ],
    },
    {
      id: "performance",
      label: "Performance",
      items: [
        {
          id: "goals",
          label: "Goals & OKRs",
          icon: React.createElement(Target),
          href: "/sabhrm/goals",
          active: isActive("/sabhrm/goals"),
        },
        {
          id: "reviews",
          label: "Reviews",
          icon: React.createElement(Gauge),
          href: "/sabhrm/reviews",
          active: isActive("/sabhrm/reviews"),
        },
      ],
    },
    {
      id: "admin",
      label: "Admin",
      items: [
        {
          id: "departments",
          label: "Departments",
          icon: React.createElement(Network),
          href: "/sabhrm/departments",
          active: isActive("/sabhrm/departments"),
        },
        {
          id: "designations",
          label: "Designations",
          icon: React.createElement(FileText),
          href: "/sabhrm/designations",
          active: isActive("/sabhrm/designations"),
        },
        {
          id: "settings",
          label: "Settings",
          icon: React.createElement(Settings),
          href: "/sabhrm/settings",
          active: isActive("/sabhrm/settings"),
        },
      ],
    },
  ];
}
