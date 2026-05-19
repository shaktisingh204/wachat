'use client';

import { useState } from 'react';
import { ZoruCard, cn } from '@/components/zoruui';

interface AnalyticsTabsShellProps {
  overviewSlot: React.ReactNode;
  audienceSlot: React.ReactNode;
  settingsSlot: React.ReactNode;
}

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'audience', label: 'Audience' },
  { id: 'settings', label: 'Settings' },
] as const;

type TabId = (typeof TABS)[number]['id'];

export function AnalyticsTabsShell({ overviewSlot, audienceSlot, settingsSlot }: AnalyticsTabsShellProps) {
  const [active, setActive] = useState<TabId>('overview');

  return (
    <div className="flex flex-col gap-4">
      <ZoruCard className="p-0">
        <div className="flex items-center gap-0 border-b border-zoru-line px-1">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActive(tab.id)}
              className={cn(
                'relative px-4 py-3 text-[13px] transition-colors',
                active === tab.id
                  ? 'text-zoru-ink after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[2px] after:bg-[#6366f1] after:rounded-t'
                  : 'text-zoru-ink-muted hover:text-zoru-ink',
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </ZoruCard>

      {active === 'overview' && overviewSlot}
      {active === 'audience' && audienceSlot}
      {active === 'settings' && settingsSlot}
    </div>
  );
}
