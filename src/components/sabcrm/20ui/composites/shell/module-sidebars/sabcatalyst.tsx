"use client";

/**
 * SabCatalyst sidebar — serverless backend console.
 *
 * The module has two routes: the project list and the per-project
 * console (`[projectId]`), whose feature areas (functions, datastore,
 * auth, file store, …) are in-page tabs rather than routes. `build`
 * surfaces a "Project console" leaf only while inside a project.
 */

import { Boxes, FolderGit2 } from "lucide-react";

import { leaf, type SabAppSidebarConfig } from "./_shared";

export const SABCATALYST_SIDEBAR: SabAppSidebarConfig = {
  prefix: "/dashboard/sabcatalyst",
  heading: "SabCatalyst",
  caption: "Serverless backend platform",
  build: (p) => {
    const match = p.match(/^\/dashboard\/sabcatalyst\/([^/]+)/);
    const id = match ? match[1] : null;

    return [
      {
        id: "catalyst-projects",
        label: "Projects",
        items: [
          leaf("all", "All projects", "/dashboard/sabcatalyst", Boxes, p, { exact: true }),
          ...(id
            ? [leaf("console", "Project console", `/dashboard/sabcatalyst/${id}`, FolderGit2, p)]
            : []),
        ],
      },
    ];
  },
};
