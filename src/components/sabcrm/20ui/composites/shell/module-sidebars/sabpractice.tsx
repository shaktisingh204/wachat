"use client";

import {
  Briefcase,
  CalendarClock,
  Clock,
  FileCheck2,
  LayoutDashboard,
  Settings2,
  Users,
} from "lucide-react";

import { leaf, type SabAppSidebarConfig } from "./_shared";

export const SABPRACTICE_SIDEBAR: SabAppSidebarConfig = {
  prefix: "/dashboard/sabpractice",
  heading: "SabPractice",
  caption: "Practice management",
  build: (p) => [
    {
      id: "sabpractice-practice",
      label: "Practice",
      items: [
        leaf("overview", "Overview", "/dashboard/sabpractice", LayoutDashboard, p, { exact: true }),
        leaf("clients", "Clients", "/dashboard/sabpractice/clients", Users, p),
        leaf("engagements", "Engagements", "/dashboard/sabpractice/engagements", Briefcase, p),
      ],
    },
    {
      id: "sabpractice-work",
      label: "Compliance & time",
      items: [
        leaf("deadlines", "Deadlines", "/dashboard/sabpractice/deadlines", CalendarClock, p),
        leaf("time", "Time", "/dashboard/sabpractice/time", Clock, p),
        leaf("doc-requests", "Document requests", "/dashboard/sabpractice/document-requests", FileCheck2, p),
      ],
    },
    {
      id: "sabpractice-settings",
      label: "Settings",
      items: [
        leaf("firm", "Firm settings", "/dashboard/sabpractice/firm", Settings2, p),
      ],
    },
  ],
};
