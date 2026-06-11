"use client";

import { Award, Plus, Users } from "lucide-react";

import { leaf, type SabAppSidebarConfig } from "./_shared";

export const SABTHRIVE_SIDEBAR: SabAppSidebarConfig = {
  prefix: "/dashboard/sabthrive",
  heading: "SabThrive",
  caption: "Loyalty & affiliates",
  build: (p) => [
    {
      id: "sabthrive-loyalty",
      label: "Loyalty",
      items: [
        leaf("loyalty", "Loyalty programs", "/dashboard/sabthrive/loyalty", Award, p),
        leaf("loyalty-new", "New program", "/dashboard/sabthrive/loyalty/new", Plus, p, { exact: true }),
      ],
    },
    {
      id: "sabthrive-affiliates",
      label: "Affiliates",
      items: [
        leaf("affiliates", "Affiliate management", "/dashboard/sabthrive/affiliate-management", Users, p),
      ],
    },
  ],
};
