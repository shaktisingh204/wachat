import * as React from "react";

import { cn } from "../lib/cn";

export interface ZoruShellProps extends React.HTMLAttributes<HTMLDivElement> {
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
 * ZoruShell — the new dashboard chrome.
 *
 * Composition: [rail] · [sidebar] · ( header / main / dock ).
 *
 * INTENTIONAL: this shell does NOT include `TabsProvider` or
 * `TabsBar` from `src/components/tabs/`. URL-synced multi-tabs are
 * gone in zoruui per the project plan. If you need in-page tabbing,
 * use `ZoruTabs` from `@/components/zoruui/tabs`.
 */
export function ZoruShell({
  rail,
  sidebar,
  header,
  dock,
  children,
  contained,
  className,
  ...props
}: ZoruShellProps) {
  return (
    <div
      className={cn(
        "flex h-screen w-full overflow-hidden bg-zoru-bg text-zoru-ink",
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
          <div className="border-t border-zoru-line bg-zoru-bg px-4 py-2">
            {dock}
          </div>
        )}
      </div>
    </div>
  );
}
