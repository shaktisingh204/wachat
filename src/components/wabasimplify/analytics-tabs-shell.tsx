'use client';

import { useState } from 'react';
import { Card, cn } from '@/components/zoruui';
import { BarChart2, Users, Settings as SettingsIcon } from 'lucide-react';

interface AnalyticsTabsShellProps {
  overviewSlot: React.ReactNode;
  audienceSlot: React.ReactNode;
  settingsSlot: React.ReactNode;
}

const NAV_ITEMS = [
  { id: 'overview', label: 'Overview', icon: BarChart2 },
  { id: 'audience', label: 'Audience', icon: Users },
  { id: 'settings', label: 'Settings', icon: SettingsIcon },
] as const;

type NavId = (typeof NAV_ITEMS)[number]['id'];

export function AnalyticsTabsShell({ overviewSlot, audienceSlot, settingsSlot }: AnalyticsTabsShellProps) {
  const [active, setActive] = useState<NavId>('overview');

  return (
    <div className="flex flex-col md:flex-row gap-4">
      <aside className="md:w-52 flex-shrink-0">
        <Card className="p-2 md:sticky md:top-4">
          <div className="px-2 pt-1 pb-2 text-[11px] uppercase tracking-wider text-zoru-ink-muted/60">
            Analytics
          </div>
          <nav className="flex md:flex-col gap-1" aria-label="Analytics sections">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = active === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActive(item.id)}
                  aria-current={isActive ? 'page' : undefined}
                  className={cn(
                    'flex items-center gap-2 px-3 py-2 text-[13px] rounded-md transition-colors text-left flex-1 md:flex-none',
                    isActive
                      ? 'bg-zoru-surface-2 text-zoru-ink'
                      : 'text-zoru-ink-muted hover:bg-zoru-surface-2 hover:text-zoru-ink',
                  )}
                >
                  <Icon className="h-3.5 w-3.5 flex-shrink-0" />
                  {item.label}
                </button>
              );
            })}
          </nav>
        </Card>
      </aside>
      <div className="flex-1 min-w-0">
        {active === 'overview' && overviewSlot}
        {active === 'audience' && audienceSlot}
        {active === 'settings' && settingsSlot}
      </div>
    </div>
  );
}
