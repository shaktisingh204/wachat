'use client';

/**
 * Wachat WhatsApp Pay — ZoruUI tab layout.
 *
 * Two tabs: Transactions · Setup. Each tab's content is rendered
 * by its child route.
 */

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CreditCard, History, Settings } from 'lucide-react';

import { useProject } from '@/context/project-context';
import {
  ZoruBreadcrumb,
  ZoruBreadcrumbItem,
  ZoruBreadcrumbLink,
  ZoruBreadcrumbList,
  ZoruBreadcrumbPage,
  ZoruBreadcrumbSeparator,
  cn,
} from '@/components/zoruui';

const TABS = [
  {
    href: '/wachat/whatsapp-pay',
    label: 'Transactions',
    icon: <History className="h-3.5 w-3.5" />,
    exact: true,
  },
  {
    href: '/wachat/whatsapp-pay/settings',
    label: 'Setup',
    icon: <Settings className="h-3.5 w-3.5" />,
    exact: false,
  },
];

export default function WhatsAppPayLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { activeProject } = useProject();

  return (
    <div className="mx-auto flex w-full max-w-[1320px] flex-col gap-6 px-6 pt-6 pb-10">
      <ZoruBreadcrumb>
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
              {activeProject?.name
                ? `${activeProject.name} · WhatsApp Pay`
                : 'WhatsApp Pay'}
            </ZoruBreadcrumbPage>
          </ZoruBreadcrumbItem>
        </ZoruBreadcrumbList>
      </ZoruBreadcrumb>

      <div>
        <h1 className="flex items-center gap-3 text-[30px] tracking-[-0.015em] text-zoru-ink leading-[1.1]">
          <span className="flex h-10 w-10 items-center justify-center rounded-[var(--zoru-radius)] bg-zoru-surface-2 text-zoru-ink">
            <CreditCard className="h-5 w-5" />
          </span>
          WhatsApp Pay
        </h1>
        <p className="mt-1.5 max-w-[720px] text-[13px] text-zoru-ink-muted">
          Manage your WhatsApp Pay configurations and view transaction history
          for customers paying directly inside conversations.
        </p>
      </div>

      {/* Tab pills */}
      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => {
          const active = t.exact
            ? pathname === t.href
            : pathname === t.href || pathname.startsWith(t.href + '/');
          return (
            <Link
              key={t.href}
              href={t.href}
              className={cn(
                'inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-[12.5px] font-medium transition-[background,border-color,color]',
                active
                  ? 'bg-zoru-ink border-zoru-ink text-zoru-on-primary'
                  : 'bg-zoru-bg border-zoru-line text-zoru-ink-muted hover:text-zoru-ink hover:bg-zoru-surface-2',
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
