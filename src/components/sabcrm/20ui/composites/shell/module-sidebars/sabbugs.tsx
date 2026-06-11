"use client";

import { Bug, Grid3x3, KanbanSquare, Plus, Tag } from "lucide-react";

import { leaf, type SabAppSidebarConfig } from "./_shared";

export const SABBUGS_SIDEBAR: SabAppSidebarConfig = {
  prefix: "/dashboard/sabbugs",
  heading: "SabBugs",
  caption: "Bug tracking",
  build: (p) => [
    {
      id: "sabbugs-tracker",
      label: "Tracker",
      items: [
        leaf("all-bugs", "All bugs", "/dashboard/sabbugs", Bug, p, { exact: true }),
        leaf("new-bug", "New bug", "/dashboard/sabbugs/new", Plus, p),
        leaf("board", "Board", "/dashboard/sabbugs/board", KanbanSquare, p),
        leaf("versions", "Versions", "/dashboard/sabbugs/versions", Tag, p),
        leaf("severity-matrix", "Severity matrix", "/dashboard/sabbugs/severity-matrix", Grid3x3, p),
      ],
    },
  ],
};
