import * as React from 'react';

/**
 * Bug Tracker module layout.
 *
 * Section navigation (All bugs / New bug / Board / Versions / Severity
 * matrix) lives in the app sidebar (20ui shell `SABBUGS_SIDEBAR`); this
 * layout only provides page padding.
 */
export default function BugTrackerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="20ui flex w-full flex-col gap-5 p-4 md:p-6">
      <main className="flex flex-col gap-5">{children}</main>
    </div>
  );
}
