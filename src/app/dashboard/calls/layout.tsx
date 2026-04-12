'use client';

/**
 * Wachat Calls — Clay-styled tab layout.
 *
 * Two tabs: Call Logs · Call Setup. Each tab's content is rendered
 * by its respective child route (/dashboard/calls/logs, /settings).
 */

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LuHistory, LuPhone, LuSettings } from 'react-icons/lu';

import { useProject } from '@/context/project-context';
import { cn } from '@/lib/utils';
import { ClayBreadcrumbs } from '@/components/clay';

const TABS = [
  {
    href: '/dashboard/calls/logs',
    label: 'Call Logs',
    icon: <LuHistory className="h-3.5 w-3.5" strokeWidth={2} />,
  },
  {
    href: '/dashboard/calls/settings',
    label: 'Call Setup',
    icon: <LuSettings className="h-3.5 w-3.5" strokeWidth={2} />,
  },
];

export default function CallsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { activeProject } = useProject();

  return (
    <div className="flex flex-col gap-6 clay-enter">
      <ClayBreadcrumbs
        items={[
          { label: 'Wachat', href: '/home' },
          { label: activeProject?.name || 'Project', href: '/dashboard' },
          { label: 'Calls' },
        ]}
      />

      <div>
        <h1 className="flex items-center gap-3 text-[30px] font-semibold tracking-[-0.015em] text-clay-ink leading-[1.1]">
          <span className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-clay-rose-soft text-clay-rose-ink">
            <LuPhone className="h-5 w-5" strokeWidth={2} />
          </span>
          WhatsApp Calling
        </h1>
        <p className="mt-1.5 max-w-[720px] text-[13px] text-clay-ink-muted">
          Configure and monitor your WhatsApp calling features — review call
          logs, tweak voicemail prompts, and enable business calling on
          specific numbers.
        </p>
      </div>

      {/* Tab pills */}
      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => {
          const active =
            pathname === t.href || pathname.startsWith(t.href + '/');
          return (
            <Link
              key={t.href}
              href={t.href}
              className={cn(
                'inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-[12.5px] font-medium transition-[background,border-color,color]',
                active
                  ? 'bg-clay-obsidian border-clay-obsidian text-white shadow-clay-card'
                  : 'bg-clay-surface border-clay-border text-clay-ink-muted hover:text-clay-ink hover:border-clay-border-strong',
              )}
            >
              {t.icon}
              {t.label}
            </Link>
          );
        })}
      </div>

      {/* Tab body */}
      <div>{children}</div>
    </div>
  );
}
