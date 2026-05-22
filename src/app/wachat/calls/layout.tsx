'use client';

import {
  Breadcrumb,
  ZoruBreadcrumbItem,
  ZoruBreadcrumbLink,
  ZoruBreadcrumbList,
  ZoruBreadcrumbPage,
  ZoruBreadcrumbSeparator,
  Button,
} from '@/components/zoruui';
import {
  usePathname } from 'next/navigation';
import { History,
  Phone,
  Settings } from 'lucide-react';

import { useProject } from '@/context/project-context';

/**
 * Wachat Calls — ZoruUI layout.
 *
 * Two sub-pages: Call Logs · Call Setup. Sub-nav uses Button
 * variants (no tab UI per the no-tab-ui directive). Each sub-page's
 * content is rendered by its child route.
 */

import * as React from 'react';

const SECTIONS = [
  {
    href: '/wachat/calls/logs',
    label: 'Call Logs',
    icon: <History />,
  },
  {
    href: '/wachat/calls/settings',
    label: 'Call Setup',
    icon: <Settings />,
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
    <div className="mx-auto flex w-full max-w-[1320px] flex-col gap-6 px-6 pt-6 pb-10">
      <Breadcrumb>
        <ZoruBreadcrumbList>
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/dashboard">SabNode</ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/wachat">WaChat</ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbPage>
              {activeProject?.name ? `${activeProject.name} · Calls` : 'Calls'}
            </ZoruBreadcrumbPage>
          </ZoruBreadcrumbItem>
        </ZoruBreadcrumbList>
      </Breadcrumb>

      <div>
        <h1 className="flex items-center gap-3 text-[30px] tracking-[-0.015em] text-zoru-ink leading-[1.1]">
          <span className="flex h-10 w-10 items-center justify-center rounded-[var(--zoru-radius)] bg-zoru-surface-2 text-zoru-ink">
            <Phone className="h-5 w-5" />
          </span>
          WhatsApp Calling
        </h1>
        <p className="mt-1.5 max-w-[720px] text-[13px] text-zoru-ink-muted">
          Configure and monitor your WhatsApp calling features — review call
          logs, tweak voicemail prompts, and enable business calling on
          specific numbers.
        </p>
      </div>

      {/* Sub-page nav (no tab UI). Active section uses solid button,
          inactive uses outline. */}
      <nav className="flex flex-wrap gap-2">
        {SECTIONS.map((s) => {
          const active =
            pathname === s.href || pathname.startsWith(s.href + '/');
          return (
            <Button
              key={s.href}
              variant={active ? 'default' : 'outline'}
              size="sm"
              asChild
            >
              <a href={s.href}>
                {s.icon}
                {s.label}
              </a>
            </Button>
          );
        })}
      </nav>

      <div>{children}</div>
    </div>
  );
}
