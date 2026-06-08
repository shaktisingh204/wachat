"use client";

import * as React from "react";
import { m, useReducedMotion } from "motion/react";

interface HomeMotionShellProps {
  children: React.ReactNode;
}

/**
 * Thin client wrapper that fades the dashboard surface in on mount.
 * Server data and layout stay in `dashboard/page.tsx` - this only adds
 * a single reduced-motion-safe transform/opacity transition.
 */
export function HomeMotionShell({ children }: HomeMotionShellProps) {
  const reduce = useReducedMotion();

  if (reduce) {
    return <>{children}</>;
  }

  return (
    <m.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </m.div>
  );
}
