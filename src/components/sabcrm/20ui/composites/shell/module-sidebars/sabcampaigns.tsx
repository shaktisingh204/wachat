"use client";

import { Send } from "lucide-react";

import { leaf, type SabAppSidebarConfig } from "./_shared";

export const SABCAMPAIGNS_SIDEBAR: SabAppSidebarConfig = {
  prefix: "/dashboard/sabcampaigns",
  heading: "SabCampaigns",
  caption: "Drip campaigns",
  build: (p) => [
    {
      id: "camp-main",
      label: "Campaigns",
      items: [
        leaf("drip", "Drip campaigns", "/dashboard/sabcampaigns", Send, p, { exact: true }),
      ],
    },
  ],
};
