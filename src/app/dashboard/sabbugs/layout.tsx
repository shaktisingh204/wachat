import * as React from 'react';
import Link from 'next/link';

/**
 * Bug Tracker module layout.
 *
 * Renders a thin sub-navigation strip across the top of every page in
 * `/dashboard/sabbugs/*`. Per the ZoruUI directive, we do NOT
 * use a tab primitive — these are plain route links rendered as a
 * pill row.
 */
export default function BugTrackerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="zoruui flex w-full flex-col gap-4 p-4 md:p-6">
      <nav
        aria-label="Bug Tracker"
        className="flex flex-wrap items-center gap-2 border-b border-[var(--zoru-divider)] pb-3"
      >
        <SubNavLink href="/dashboard/sabbugs" label="All Bugs" />
        <SubNavLink href="/dashboard/sabbugs/board" label="Board" />
        <SubNavLink href="/dashboard/sabbugs/versions" label="Versions" />
        <SubNavLink
          href="/dashboard/sabbugs/severity-matrix"
          label="Severity matrix"
        />
        <span className="ml-auto" />
        <Link
          href="/dashboard/sabbugs/new"
          className="inline-flex h-9 items-center justify-center rounded-md bg-[var(--st-accent)] px-3 text-sm font-medium text-[var(--zoru-on-accent)] shadow hover:opacity-90"
        >
          + New bug
        </Link>
      </nav>
      {children}
    </div>
  );
}

function SubNavLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="rounded-md px-3 py-1.5 text-sm text-[var(--st-text-secondary)] hover:bg-[var(--st-bg-muted)] hover:text-[var(--st-text)]"
    >
      {label}
    </Link>
  );
}
