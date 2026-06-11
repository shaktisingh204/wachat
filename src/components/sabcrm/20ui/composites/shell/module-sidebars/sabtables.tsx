"use client";

import { Database, Layers, LayoutGrid, Zap } from "lucide-react";

import { leaf, type SabAppSidebarConfig } from "./_shared";

/** Static top-level segments — everything else under the prefix is a workspace id. */
const STATIC_SEGMENTS = new Set(["automations", "bases", "views"]);

/**
 * SabTables (relational bases) sidebar. Deep routes are
 * `/[workspaceId]/[baseId]/[tableId]` — when a workspace is in the path
 * we surface a scoped "Current workspace" entry; base/table levels keep
 * their own in-content rails (`base-shell-client.tsx`).
 */
export const SABTABLES_SIDEBAR: SabAppSidebarConfig = {
  prefix: "/dashboard/sabtables",
  heading: "SabTables",
  caption: "Bases & tables",
  build: (p) => {
    const seg = p.startsWith("/dashboard/sabtables/")
      ? p.slice("/dashboard/sabtables/".length).split("/")[0]
      : null;
    const workspaceId = seg && !STATIC_SEGMENTS.has(seg) ? seg : null;

    return [
      {
        id: "sabtables-main",
        label: "SabTables",
        items: [
          leaf("workspaces", "Workspaces", "/dashboard/sabtables", LayoutGrid, p, { exact: true }),
          leaf("bases", "Bases", "/dashboard/sabtables/bases", Database, p),
          leaf("views", "Views", "/dashboard/sabtables/views", Layers, p),
          leaf("automations", "Automations", "/dashboard/sabtables/automations", Zap, p, { exact: true }),
        ],
      },
      ...(workspaceId
        ? [
            {
              id: "sabtables-workspace",
              label: "Current workspace",
              items: [
                leaf("workspace-bases", "Workspace bases", `/dashboard/sabtables/${workspaceId}`, Database, p),
              ],
            },
          ]
        : []),
    ];
  },
};
