"use client";

import {
  FolderOpen,
  Gauge,
  Layers,
  ListChecks,
  Repeat,
} from "lucide-react";

import { leaf, type SabAppSidebarConfig } from "./_shared";

const PREFIX = "/dashboard/sabsprints";

/**
 * Top-level segments that are literal routes (global demo views), not
 * project ids. Anything else directly under /dashboard/sabsprints/ is a
 * `[projectId]` and scopes the per-project Scrum sections.
 */
const LITERAL_SEGMENTS = new Set(["epics", "sprints", "velocity"]);

function projectIdFromPath(pathname: string): string | null {
  if (!pathname.startsWith(PREFIX + "/")) return null;
  const segment = pathname.slice(PREFIX.length + 1).split("/")[0] ?? "";
  if (!segment || LITERAL_SEGMENTS.has(segment)) return null;
  return segment;
}

export const SABSPRINTS_SIDEBAR: SabAppSidebarConfig = {
  prefix: PREFIX,
  heading: "SabSprints",
  caption: "Agile boards & sprints",
  build: (p) => {
    const projectId = projectIdFromPath(p);

    if (!projectId) {
      return [
        {
          id: "sabsprints-projects",
          label: "Projects",
          items: [leaf("projects", "All projects", PREFIX, FolderOpen, p, { exact: true })],
        },
        {
          id: "sabsprints-workspace",
          label: "Workspace",
          items: [
            leaf("sprints", "Sprints", `${PREFIX}/sprints`, Repeat, p),
            leaf("epics", "Epics", `${PREFIX}/epics`, Layers, p),
            leaf("velocity", "Velocity", `${PREFIX}/velocity`, Gauge, p),
          ],
        },
      ];
    }

    const base = `${PREFIX}/${projectId}`;
    return [
      {
        id: "sabsprints-projects",
        label: "Projects",
        items: [leaf("projects", "All projects", PREFIX, FolderOpen, p, { exact: true })],
      },
      {
        id: "sabsprints-project",
        label: "Project workspace",
        items: [
          leaf("backlog", "Backlog", `${base}/backlog`, ListChecks, p),
          {
            // Lands on sprint creation but stays lit across
            // /sprints/[sprintId]/{plan,board,burndown}.
            ...leaf("sprints", "Sprints", `${base}/sprints/new`, Repeat, p),
            active: p.startsWith(`${base}/sprints`),
          },
          leaf("epics", "Epics", `${base}/epics`, Layers, p),
          leaf("velocity", "Velocity", `${base}/velocity`, Gauge, p),
        ],
      },
    ];
  },
};
