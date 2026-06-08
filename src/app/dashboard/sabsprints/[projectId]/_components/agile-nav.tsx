'use client';

/**
 * Top-of-page section nav for the agile module. Receives the current
 * `projectId` and renders an icon'd tab strip used across
 * backlog/sprints/epics/velocity. Active section is derived from the path.
 */
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ListChecks, Repeat, Layers, Gauge, type LucideIcon } from 'lucide-react';

import { cn } from '@/components/sabcrm/20ui';

interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Match-prefix; falls back to exact match when omitted. */
  matchPrefix?: string;
}

export function AgileNav({ projectId }: { projectId: string }) {
  const pathname = usePathname();
  const base = `/dashboard/sabsprints/${projectId}`;
  const items: NavItem[] = [
    { label: 'Backlog', href: `${base}/backlog`, icon: ListChecks, matchPrefix: `${base}/backlog` },
    { label: 'Sprints', href: `${base}/sprints/new`, icon: Repeat, matchPrefix: `${base}/sprints` },
    { label: 'Epics', href: `${base}/epics`, icon: Layers, matchPrefix: `${base}/epics` },
    { label: 'Velocity', href: `${base}/velocity`, icon: Gauge, matchPrefix: `${base}/velocity` },
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
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'inline-flex items-center gap-2 px-3 py-2 text-sm font-medium border-b-2 -mb-px rounded-t-[var(--st-radius-sm)]',
              'transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--st-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--st-bg)]',
              active
                ? 'border-[var(--st-accent)] text-[var(--st-text)]'
                : 'border-transparent text-[var(--st-text-secondary)] hover:text-[var(--st-text)] hover:bg-[var(--st-bg-secondary)]',
            )}
          >
            <Icon
              size={16}
              aria-hidden="true"
              className={active ? 'text-[var(--st-accent)]' : undefined}
            />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
