"use client";

import { FlaskConical, ListChecks } from "lucide-react";

import { leaf, type SabAppSidebarConfig } from "./_shared";

/**
 * SabPrep (visual data preparation) sidebar. Recipes are opened from the
 * list; when one is open (`/recipes/[id]`) we surface a scoped canvas entry.
 */
export const SABPREP_SIDEBAR: SabAppSidebarConfig = {
  prefix: "/dashboard/sabprep",
  heading: "SabPrep",
  caption: "Data preparation",
  build: (p) => {
    const recipeId = p.startsWith("/dashboard/sabprep/recipes/")
      ? p.slice("/dashboard/sabprep/recipes/".length).split("/")[0] || null
      : null;

    return [
      {
        id: "sabprep-main",
        label: "SabPrep",
        items: [
          leaf("recipes", "Recipes", "/dashboard/sabprep", ListChecks, p, { exact: true }),
        ],
      },
      ...(recipeId
        ? [
            {
              id: "sabprep-recipe",
              label: "Current recipe",
              items: [
                leaf("canvas", "Recipe canvas", `/dashboard/sabprep/recipes/${recipeId}`, FlaskConical, p),
              ],
            },
          ]
        : []),
    ];
  },
};
