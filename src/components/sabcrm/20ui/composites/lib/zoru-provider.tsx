import * as React from "react";

import { cn } from "./cn";

/**
 * ZoruProvider — scopes the zoru palette to its subtree.
 *
 * Wrap any layout/page in <ZoruProvider> to switch that subtree to the
 * pure black-and-white zoru tokens. Works on Server Components — no
 * client runtime required at the scope boundary itself.
 */
export interface ZoruProviderProps {
  children: React.ReactNode;
  /** Optional extra classes applied to the scope root. */
  className?: string;
  /** Render as a different element (e.g. "main", "section"). Defaults to "div". */
  as?: "div" | "main" | "section" | "article";
}

export function ZoruProvider({
  children,
  className,
  as: Tag = "div",
}: ZoruProviderProps) {
  return (
    <Tag className={cn("zoruui min-h-full antialiased", className)}>
      {children}
    </Tag>
  );
}
