'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';

import { Button } from '@/components/sabcrm/20ui';

/**
 * Bug Tracker module layout.
 *
 * Renders a thin sub-navigation strip across the top of every page in
 * `/dashboard/sabbugs/*`. These are plain route links rendered as a pill row
 * (real navigation, not a control primitive), with a single 20ui primary
 * action on the right.
 */
export default function BugTrackerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();

  return (
    <div className="ui20 flex w-full flex-col gap-4 p-4 md:p-6">
      <nav
        aria-label="Bug Tracker"
        className="flex flex-wrap items-center gap-2 border-b border-[var(--st-border)] pb-3"
      >
        <SubNavLink href="/dashboard/sabbugs" label="All Bugs" />
        <SubNavLink href="/dashboard/sabbugs/board" label="Board" />
        <SubNavLink href="/dashboard/sabbugs/versions" label="Versions" />
        <SubNavLink
          href="/dashboard/sabbugs/severity-matrix"
          label="Severity matrix"
        />
        <span className="ml-auto" />
        <Button
          variant="primary"
          iconLeft={Plus}
          onClick={() => router.push('/dashboard/sabbugs/new')}
        >
          New bug
        </Button>
      </nav>
      {children}
    </div>
  );
}

function SubNavLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="rounded-[var(--st-radius)] px-3 py-1.5 text-sm text-[var(--st-text-secondary)] hover:bg-[var(--st-bg-secondary)] hover:text-[var(--st-text)]"
    >
      {label}
    </Link>
  );
}
