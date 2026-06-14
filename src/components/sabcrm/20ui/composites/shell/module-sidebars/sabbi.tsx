"use client";

import {
  BarChart3,
  Briefcase,
  Cake,
  CalendarClock,
  CalendarX,
  Clock,
  Code2,
  Combine,
  Compass,
  CreditCard,
  Database,
  Library,
  FileSpreadsheet,
  FileText,
  Handshake,
  Layers,
  LayoutDashboard,
  LineChart,
  ListChecks,
  Package,
  PieChart,
  Plane,
  Plug,
  Receipt,
  Scale,
  Target,
  Ticket,
  TrendingDown,
  TrendingUp,
  UserCheck,
  Users,
  Wallet,
} from "lucide-react";

import { leaf, type SabAppSidebarConfig } from "./_shared";

export const SABBI_SIDEBAR: SabAppSidebarConfig = {
  prefix: "/dashboard/sabbi",
  heading: "SabBI",
  caption: "Business intelligence",
  build: (p) => [
    {
      id: "sabbi-overview",
      label: "Overview",
      items: [
        leaf("analytics", "Analytics", "/dashboard/sabbi/analytics", LineChart, p),
      ],
    },
    {
      id: "sabbi-semantic",
      label: "Semantic layer",
      items: [
        leaf("models", "Models & metrics", "/dashboard/sabbi/models", Layers, p),
        leaf("connectors", "Connectors", "/dashboard/sabbi/connectors", Plug, p),
        leaf("explore", "Explore", "/dashboard/sabbi/explore", Compass, p),
      ],
    },
    {
      id: "sabbi-build",
      label: "Build",
      items: [
        leaf("dashboards", "Dashboards", "/dashboard/sabbi/dashboards", LayoutDashboard, p),
        leaf("workbooks", "Workbooks", "/dashboard/sabbi/workbooks", Library, p),
        leaf("charts", "Charts", "/dashboard/sabbi/charts", BarChart3, p),
        leaf("datasets", "Datasets", "/dashboard/sabbi/datasets", Database, p, { exact: true }),
        leaf("joins", "Joins", "/dashboard/sabbi/datasets/joins", Combine, p),
        leaf("schedules", "Schedules", "/dashboard/sabbi/schedules", CalendarClock, p),
        leaf("embeds", "Embeds", "/dashboard/sabbi/embeds", Code2, p),
      ],
    },
    {
      id: "sabbi-reports",
      label: "Reports",
      items: [
        leaf("reports", "Reports hub", "/dashboard/sabbi/reports", FileText, p, { exact: true }),
      ],
    },
    {
      id: "sabbi-finance",
      label: "Finance reports",
      items: [
        leaf("income", "Income", "/dashboard/sabbi/reports/income", TrendingUp, p),
        leaf("expense", "Expense", "/dashboard/sabbi/reports/expense", TrendingDown, p),
        leaf("profit-loss", "Profit & loss", "/dashboard/sabbi/reports/profit-loss", Scale, p),
        leaf("payment-report", "Payments", "/dashboard/sabbi/reports/payment-report", CreditCard, p),
        leaf("invoice-aging", "Invoice aging", "/dashboard/sabbi/reports/invoice-aging", Clock, p),
        leaf("tax", "Tax", "/dashboard/sabbi/reports/tax", Wallet, p),
        leaf("gstr-1", "GSTR-1", "/dashboard/sabbi/reports/gstr-1", Receipt, p),
        leaf("gstr-2b", "GSTR-2B", "/dashboard/sabbi/reports/gstr-2b", FileSpreadsheet, p),
      ],
    },
    {
      id: "sabbi-sales",
      label: "Sales reports",
      items: [
        leaf("sales-deals", "Sales deals", "/dashboard/sabbi/reports/sales-deals", Handshake, p),
        leaf("leads-conversion", "Leads conversion", "/dashboard/sabbi/reports/leads-conversion", Target, p),
        leaf("agent-performance", "Agent performance", "/dashboard/sabbi/reports/agent-performance", PieChart, p),
        leaf("ticket-report", "Tickets", "/dashboard/sabbi/reports/ticket-report", Ticket, p),
        leaf("top-clients", "Top clients", "/dashboard/sabbi/reports/top-clients", Users, p),
        leaf("top-products", "Top products", "/dashboard/sabbi/reports/top-products", Package, p),
      ],
    },
    {
      id: "sabbi-people",
      label: "People reports",
      items: [
        leaf("attendance-report", "Attendance", "/dashboard/sabbi/reports/attendance-report", UserCheck, p),
        leaf("late-report", "Late arrivals", "/dashboard/sabbi/reports/late-report", CalendarClock, p),
        leaf("leave-report", "Leave", "/dashboard/sabbi/reports/leave-report", Plane, p),
        leaf("leave-balance-report", "Leave balance", "/dashboard/sabbi/reports/leave-balance-report", CalendarX, p),
        leaf("birthday-anniversary", "Birthdays & anniversaries", "/dashboard/sabbi/reports/birthday-anniversary", Cake, p),
      ],
    },
    {
      id: "sabbi-projects",
      label: "Project reports",
      items: [
        leaf("project-status", "Project status", "/dashboard/sabbi/reports/project-status-report", Briefcase, p),
        leaf("task-report", "Tasks", "/dashboard/sabbi/reports/task-report", ListChecks, p),
        leaf("overdue-tasks", "Overdue tasks", "/dashboard/sabbi/reports/overdue-tasks", CalendarX, p),
      ],
    },
  ],
};
