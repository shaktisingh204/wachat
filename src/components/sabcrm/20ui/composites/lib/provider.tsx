import * as React from "react";

import { cn } from "./cn";

/**
 * SabProvider — scopes the sab palette to its subtree.
 *
 * Wrap any layout/page in <SabProvider> to switch that subtree to the
 * pure black-and-white sab tokens. Works on Server Components — no
 * client runtime required at the scope boundary itself.
 */
export interface SabProviderProps {
  children: React.ReactNode;
  /** Optional extra classes applied to the scope root. */
  className?: string;
  /** Render as a different element (e.g. "main", "section"). Defaults to "div". */
  as?: "div" | "main" | "section" | "article";
}

export function SabProvider({
  children,
  className,
  as: Tag = "div",
}: SabProviderProps) {
  return (
    <Tag className={cn("min-h-full antialiased", className)}>
      {children}
    </Tag>
  );
}
