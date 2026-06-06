'use client';

import { cn } from '@/components/sabcrm/20ui/compat';
import { usePathname } from 'next/navigation';

/**
 * SettingsTabs — segmented navigation between settings sub-routes.
 *
 * Despite the legacy name, this is NOT a tab UI — per the ZoruUI
 * no-tabs directive, each entry is a distinct sub-route. The component
 * renders a segmented ZoruButton-style group of Links so users can move
 * between Profile / Devices / Privacy / Rate limits / Notifications.
 */

import * as React from 'react';
import Link from 'next/link';

const SECTIONS = [
  { href: '/sabwa/settings', label: 'Profile' },
  { href: '/sabwa/settings/devices', label: 'Devices' },
  { href: '/sabwa/settings/privacy', label: 'Privacy & security' },
  { href: '/sabwa/settings/rate-limits', label: 'Rate limits' },
  { href: '/sabwa/settings/notifications', label: 'Notifications' },
];

export function SettingsTabs() {
  const pathname = usePathname();
  return (
    <nav
      role="navigation"
      aria-label="Settings sections"
      className="inline-flex flex-wrap gap-1 rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-bg p-1"
    >
      {SECTIONS.map((section) => {
        const active = pathname === section.href;
        return (
          <Link
            key={section.href}
            href={section.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'inline-flex h-8 items-center justify-center whitespace-nowrap rounded-[calc(var(--zoru-radius)-2px)] px-3 text-xs font-medium transition-colors',
              active
                ? 'bg-zoru-primary text-zoru-primary-foreground shadow-[var(--zoru-shadow-sm)]'
                : 'text-zoru-ink-muted hover:bg-zoru-surface-2 hover:text-zoru-ink',
            )}
          >
            {section.label}
          </Link>
        );
      })}
    </nav>
  );
}
