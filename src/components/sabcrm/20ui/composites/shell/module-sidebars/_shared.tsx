"use client";

/**
 * Shared helpers for per-module sidebar configs.
 *
 * Each module file in this folder exports a `SabAppSidebarConfig` that
 * `./index.ts` aggregates into `MODULE_SIDEBARS`, which is spread into
 * `SAB_APP_SIDEBARS` (../app-sidebars.tsx) ahead of the `/dashboard`
 * catch-all. Import types RELATIVELY — never via the 20ui barrel (the
 * barrel re-exports the shell, so a barrel import here forms a circular
 * `export *` that Turbopack resolves to an empty object).
 */

import type { ComponentType, SVGProps } from "react";

import type { SabSidebarGroup } from "../app-sidebar";

export interface SabAppSidebarConfig {
  prefix: string;
  heading: string;
  caption?: string;
  build: (pathname: string) => SabSidebarGroup[];
}

export type Icon = ComponentType<SVGProps<SVGSVGElement>>;

export function leaf(
  id: string,
  label: string,
  href: string,
  IconComp: Icon,
  pathname: string,
  options?: { exact?: boolean; adminOnly?: boolean },
) {
  return {
    id,
    label,
    href,
    icon: <IconComp />,
    active:
      pathname === href ||
      (!options?.exact && href !== "/" && pathname.startsWith(href + "/")),
    ...(options?.adminOnly ? { adminOnly: true as const } : {}),
  };
}
