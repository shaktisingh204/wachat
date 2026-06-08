'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Bug,
  KanbanSquare,
  Tag,
  Grid3x3,
  Plus,
  type LucideIcon,
} from 'lucide-react';

import { Button } from '@/components/sabcrm/20ui';

/**
 * Bug Tracker module layout.
 *
 * Renders a thin sub-navigation strip across the top of every page in
 * `/dashboard/sabbugs/*`. These are plain route links rendered as a pill row
 * (real navigation, not a control primitive) with active-state indication, and
 * a single 20ui primary action on the right.
 */
const NAV_ITEMS: { href: string; label: string; icon: LucideIcon }[] = [
  { href: '/dashboard/sabbugs', label: 'All bugs', icon: Bug },
  { href: '/dashboard/sabbugs/board', label: 'Board', icon: KanbanSquare },
  { href: '/dashboard/sabbugs/versions', label: 'Versions', icon: Tag },
  {
    href: '/dashboard/sabbugs/severity-matrix',
    label: 'Severity matrix',
    icon: Grid3x3,
  },
];

export default function BugTrackerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <div className="20ui flex w-full flex-col gap-5 p-4 md:p-6">
      <nav
        aria-label="Bug tracker sections"
        className="flex flex-wrap items-center gap-1 border-b border-[var(--st-border)] pb-3"
      >
        {NAV_ITEMS.map((item) => {
          const active =
            item.href === '/dashboard/sabbugs'
              ? pathname === item.href
              : pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <SubNavLink
              key={item.href}
              href={item.href}
              label={item.label}
              icon={item.icon}
              active={active}
            />
          );
        })}
        <span className="ml-auto" />
        <Button
          variant="primary"
          iconLeft={Plus}
          onClick={() => router.push('/dashboard/sabbugs/new')}
        >
          New bug
        </Button>
      </nav>
      <main className="flex flex-col gap-5">{children}</main>
    </div>
  );
}

function SubNavLink({
  href,
  label,
  icon: Icon,
  active,
}: {
  href: string;
  label: string;
  icon: LucideIcon;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={[
        'inline-flex items-center gap-1.5 rounded-[var(--st-radius)] px-3 py-1.5 text-sm font-medium transition-colors duration-150',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--st-accent)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--st-bg)]',
        active
          ? 'bg-[var(--st-accent-soft)] text-[var(--st-accent)]'
          : 'text-[var(--st-text-secondary)] hover:bg-[var(--st-bg-secondary)] hover:text-[var(--st-text)]',
      ].join(' ')}
    >
      <Icon size={15} aria-hidden="true" />
      {label}
    </Link>
  );
}
