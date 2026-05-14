'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const TABS = [
  { href: '/sabwa/settings', label: 'Profile' },
  { href: '/sabwa/settings/devices', label: 'Devices' },
  { href: '/sabwa/settings/privacy', label: 'Privacy & Security' },
  { href: '/sabwa/settings/rate-limits', label: 'Rate Limits' },
  { href: '/sabwa/settings/notifications', label: 'Notifications' },
];

export function SettingsTabs() {
  const pathname = usePathname();
  return (
    <div className="border-b overflow-x-auto">
      <nav className="flex gap-1 -mb-px" aria-label="Settings sections">
        {TABS.map((tab) => {
          const active = pathname === tab.href;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors',
                active
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
              )}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
