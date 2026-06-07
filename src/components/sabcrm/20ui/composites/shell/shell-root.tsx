import * as React from "react";

import { cn } from "../lib/cn";

export interface SabShellProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Vertical app rail (left-most). Optional. */
  rail?: React.ReactNode;
  /** Module sidebar (between rail and main). Optional. */
  sidebar?: React.ReactNode;
  /** Top header bar. Optional. */
  header?: React.ReactNode;
  /** Bottom dock (re-export of existing dock). Optional. */
  dock?: React.ReactNode;
  /** Main content. */
  children: React.ReactNode;
  /** Constrain main column to a fixed width. */
  contained?: boolean;
}

/**
 * SabShell — the new dashboard chrome.
 *
 * Composition: [rail] · [sidebar] · ( header / main / dock ).
 *
 * INTENTIONAL: has no tab UI at all — neither the URL-synced
 * `TabsProvider`/`TabsBar` from `src/components/tabs/`, nor an in-page
 * tab primitive. For step-wise flows, use a numbered stepper. For
 * binary toggles, use a segmented button group. For module sub-pages,
 * use distinct routes.
 */
export function SabShell({
  rail,
  sidebar,
  header,
  dock,
  children,
  contained,
  className,
  ...props
}: SabShellProps) {
  return (
    <div
      className={cn(
        "flex h-screen w-full overflow-hidden bg-[var(--st-bg)] text-[var(--st-text)]",
        className,
      )}
      {...props}
    >
      {rail}
      {sidebar}
      <div className="flex min-w-0 flex-1 flex-col">
        {header}
        <main
          className={cn(
            "flex-1 overflow-y-auto",
            contained ? "mx-auto w-full max-w-6xl px-6 py-8" : "px-6 py-8",
          )}
        >
          {children}
        </main>
        {dock && (
          <div className="border-t border-[var(--st-border)] bg-[var(--st-bg)] px-4 py-2">
            {dock}
          </div>
        )}
      </div>
    </div>
  );
}
