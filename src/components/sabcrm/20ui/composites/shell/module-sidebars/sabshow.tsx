"use client";

import { Presentation } from "lucide-react";

import { leaf, type SabAppSidebarConfig } from "./_shared";

export const SABSHOW_SIDEBAR: SabAppSidebarConfig = {
  prefix: "/dashboard/sabshow",
  heading: "SabShow",
  caption: "Presentation decks",
  build: (p) => [
    {
      id: "show-decks",
      label: "Presentations",
      items: [
        leaf("decks", "Decks", "/dashboard/sabshow", Presentation, p),
      ],
    },
  ],
};
