'use client';

import { usePathname } from 'next/navigation';
import { History, Settings } from 'lucide-react';

import { WachatPage } from '@/app/wachat/_components/wachat-page';
import { useProject } from '@/context/project-context';

/**
 * Wachat Calls — 20ui layout.
 *
 * Two sub-pages: Call Logs · Call Setup. Sub-nav uses 20ui button-styled
 * route links (no tab UI per the no-tab-ui directive). Each sub-page's
 * content is rendered by its child route. The WachatPage container owns the
 * width, gutters, breadcrumb, and the single page <h1>.
 */

import * as React from 'react';

function cx(...a: Array<string | false | null | undefined>): string {
  return a.filter(Boolean).join(' ');
}

const SECTIONS = [
  {
    href: '/wachat/calls/logs',
    label: 'Call Logs',
    icon: History,
  },
  {
    href: '/wachat/calls/settings',
    label: 'Call Setup',
    icon: Settings,
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
    <WachatPage
      breadcrumb={[
        { label: 'SabNode', href: '/dashboard' },
        { label: 'WaChat', href: '/wachat' },
        { label: activeProject?.name ? `${activeProject.name} · Calls` : 'Calls' },
      ]}
      title="WhatsApp Calling"
      description="Configure and monitor your WhatsApp calling features — review call logs, tweak voicemail prompts, and enable business calling on specific numbers."
    >
      {/* Sub-page nav (no tab UI). Active section uses the primary button
          style, inactive uses outline. Anchors preserve route navigation. */}
      <nav className="flex flex-wrap gap-2">
        {SECTIONS.map((s) => {
          const active =
            pathname === s.href || pathname.startsWith(s.href + '/');
          const Icon = s.icon;
          return (
            <a
              key={s.href}
              href={s.href}
              className={cx(
                'u-btn',
                'u-btn--sm',
                active ? 'u-btn--primary' : 'u-btn--outline',
              )}
            >
              <Icon size={13} aria-hidden="true" />
              <span className="u-btn__label">{s.label}</span>
            </a>
          );
        })}
      </nav>

      <div>{children}</div>
    </WachatPage>
  );
}
