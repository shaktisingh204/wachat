'use client';

/**
 * Sub-navigation strip for the unified Rewards module. Per the
 * no-tab-ui directive, this uses segmented buttons rather than a
 * `<Tabs>` primitive. Each item is a real route so deep links work.
 */

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Gift, Users, Share2 } from 'lucide-react';

import { cn } from '@/components/sabcrm/20ui';

const ITEMS = [
  { href: '/dashboard/sabrewards/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/dashboard/sabrewards/catalog', label: 'Catalog', icon: Gift },
  { href: '/dashboard/sabrewards/members', label: 'Members', icon: Users },
  { href: '/dashboard/sabrewards/referrals', label: 'Referrals', icon: Share2 },
] as const;

export function RewardsNav(): React.JSX.Element {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Rewards sections"
      className="zoruui flex flex-wrap gap-1 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-1"
    >
      {ITEMS.map(({ href, label, icon: Icon }) => {
        const active = pathname?.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'inline-flex items-center gap-2 rounded-[calc(var(--st-radius)-4px)] px-3 py-1.5 text-[13px] font-medium transition-colors',
              active
                ? 'bg-[var(--st-accent)] text-[var(--st-text-inverted)]'
                : 'text-[var(--st-text-secondary)] hover:bg-[var(--st-bg-muted)] hover:text-[var(--st-text)]',
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
