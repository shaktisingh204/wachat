"use client";

import { BarChart3, Home, Plus, Presentation, Users } from "lucide-react";

import { leaf, type SabAppSidebarConfig } from "./_shared";

export const SABWEBINAR_SIDEBAR: SabAppSidebarConfig = {
  prefix: "/dashboard/sabwebinar",
  heading: "SabWebinar",
  caption: "Live webinars",
  build: (p) => [
    {
      id: "webinar-webinars",
      label: "Webinars",
      items: [
        leaf("overview", "Overview", "/dashboard/sabwebinar", Home, p, { exact: true }),
        leaf("webinars", "All webinars", "/dashboard/sabwebinar/webinars", Presentation, p),
        leaf("new", "New webinar", "/dashboard/sabwebinar/new", Plus, p),
        leaf("registrations", "Registrations", "/dashboard/sabwebinar/registrations", Users, p),
        leaf("analytics", "Analytics", "/dashboard/sabwebinar/analytics", BarChart3, p),
      ],
    },
  ],
};
