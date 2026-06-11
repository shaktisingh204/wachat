"use client";

import { BarChart3, FilePlus2, Inbox, LayoutTemplate, Plus } from "lucide-react";

import { leaf, type SabAppSidebarConfig } from "./_shared";

export const SABREQUESTS_SIDEBAR: SabAppSidebarConfig = {
  prefix: "/dashboard/sabrequests",
  heading: "SabRequests",
  caption: "Service requests",
  build: (p) => [
    {
      id: "sabrequests-requests",
      label: "Requests",
      items: [
        leaf("inbox", "Inbox", "/dashboard/sabrequests", Inbox, p, { exact: true }),
        leaf("new-request", "New request", "/dashboard/sabrequests/new", FilePlus2, p),
        leaf("analytics", "Analytics", "/dashboard/sabrequests/analytics", BarChart3, p),
      ],
    },
    {
      id: "sabrequests-blueprints",
      label: "Blueprints",
      items: [
        leaf("blueprints", "Blueprints", "/dashboard/sabrequests/blueprints", LayoutTemplate, p, { exact: true }),
        leaf("new-blueprint", "New blueprint", "/dashboard/sabrequests/blueprints/new", Plus, p),
      ],
    },
  ],
};
