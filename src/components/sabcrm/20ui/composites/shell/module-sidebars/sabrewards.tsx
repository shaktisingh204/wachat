"use client";

import { Gift, LayoutDashboard, Share2, Users } from "lucide-react";

import { leaf, type SabAppSidebarConfig } from "./_shared";

export const SABREWARDS_SIDEBAR: SabAppSidebarConfig = {
  prefix: "/dashboard/sabrewards",
  heading: "SabRewards",
  caption: "Points, tiers & referrals",
  build: (p) => [
    {
      id: "rw-loyalty",
      label: "Loyalty",
      items: [
        leaf("dashboard", "Dashboard", "/dashboard/sabrewards/dashboard", LayoutDashboard, p),
        leaf("catalog", "Catalog", "/dashboard/sabrewards/catalog", Gift, p),
        leaf("members", "Members", "/dashboard/sabrewards/members", Users, p),
        leaf("referrals", "Referrals", "/dashboard/sabrewards/referrals", Share2, p),
      ],
    },
  ],
};
