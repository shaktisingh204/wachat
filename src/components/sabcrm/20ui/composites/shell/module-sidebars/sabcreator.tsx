"use client";

import { FileText, LayoutGrid, Workflow } from "lucide-react";

import { leaf, type SabAppSidebarConfig } from "./_shared";

export const SABCREATOR_SIDEBAR: SabAppSidebarConfig = {
  prefix: "/dashboard/sabcreator",
  heading: "SabCreator",
  caption: "No-code app builder",
  build: (p) => [
    {
      id: "cr-build",
      label: "Build",
      items: [
        // Apps list doubles as the app picker; per-app builder/preview
        // routes (`/dashboard/sabcreator/[appId]/…`) open from here.
        leaf("apps", "Apps", "/dashboard/sabcreator", LayoutGrid, p, { exact: true }),
        leaf("forms", "Forms", "/dashboard/sabcreator/forms", FileText, p),
        leaf("workflows", "Workflows", "/dashboard/sabcreator/workflows", Workflow, p),
      ],
    },
  ],
};
