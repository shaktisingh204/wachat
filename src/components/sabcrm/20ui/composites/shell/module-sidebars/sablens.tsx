"use client";

import { CirclePlus, Smartphone, Video } from "lucide-react";

import { leaf, type SabAppSidebarConfig } from "./_shared";

export const SABLENS_SIDEBAR: SabAppSidebarConfig = {
  prefix: "/dashboard/sablens",
  heading: "SabLens",
  caption: "Remote AR support",
  build: (p) => [
    {
      id: "sablens-sessions",
      label: "Sessions",
      items: [
        leaf("sessions", "All sessions", "/dashboard/sablens", Video, p, { exact: true }),
        leaf("new", "New session", "/dashboard/sablens/new", CirclePlus, p),
      ],
    },
    {
      id: "sablens-hardware",
      label: "Hardware",
      items: [
        leaf("devices", "Registered devices", "/dashboard/sablens/devices", Smartphone, p),
      ],
    },
  ],
};
