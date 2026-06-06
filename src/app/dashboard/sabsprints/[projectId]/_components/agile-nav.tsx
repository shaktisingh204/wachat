'use client';

/**
 * Top-of-page tabs for the agile module. Pure presentational — receives the
 * current `projectId` and renders the standard nav strip used across
 * backlog/sprints/velocity/epics pages.
 */
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { cn } from '@/components/sabcrm/20ui/compat';

interface NavItem {
  label: string;
  href: string;
  /** Match-prefix; falls back to exact match when omitted. */
  matchPrefix?: string;
}

export function AgileNav({ projectId }: { projectId: string }) {
  const pathname = usePathname();
  const base = `/dashboard/sabsprints/${projectId}`;
  const items: NavItem[] = [
    { label: 'Backlog', href: `${base}/backlog`, matchPrefix: `${base}/backlog` },
    { label: 'Sprints', href: `${base}/sprints/new`, matchPrefix: `${base}/sprints` },
    { label: 'Epics', href: `${base}/epics`, matchPrefix: `${base}/epics` },
    { label: 'Velocity', href: `${base}/velocity`, matchPrefix: `${base}/velocity` },
  ];

  return (
    <nav
      aria-label="Agile sections"
      className="flex items-center gap-1 border-b border-[var(--st-border)]"
    >
      {items.map((item) => {
        const active = item.matchPrefix
          ? pathname?.startsWith(item.matchPrefix)
          : pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
              active
                ? 'border-[var(--st-accent)] text-[var(--st-text)]'
                : 'border-transparent text-[var(--st-text-secondary)] hover:text-[var(--st-text)]',
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
