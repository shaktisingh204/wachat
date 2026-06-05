'use client';

import { usePathname } from 'next/navigation';
import { CreditCard, History, Settings } from 'lucide-react';

import { useProject } from '@/context/project-context';
import { WachatPage } from '@/app/wachat/_components/wachat-page';

/**
 * Wachat WhatsApp Pay — 20ui tab layout.
 *
 * Two tabs: Transactions · Setup. Each tab's content is rendered
 * by its child route.
 */

import * as React from 'react';
import Link from 'next/link';

function cx(...a: Array<string | false | null | undefined>): string {
  return a.filter(Boolean).join(' ');
}

const TABS = [
  {
    href: '/wachat/whatsapp-pay',
    label: 'Transactions',
    icon: <History className="h-3.5 w-3.5" aria-hidden="true" />,
    exact: true,
  },
  {
    href: '/wachat/whatsapp-pay/settings',
    label: 'Setup',
    icon: <Settings className="h-3.5 w-3.5" aria-hidden="true" />,
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
    <WachatPage
      breadcrumb={[
        { label: 'SabNode', href: '/dashboard' },
        { label: 'WaChat', href: '/wachat' },
        {
          label: activeProject?.name
            ? `${activeProject.name} · WhatsApp Pay`
            : 'WhatsApp Pay',
        },
      ]}
      title={
        <span className="flex items-center gap-3">
          <span
            className="flex h-10 w-10 items-center justify-center rounded-[var(--st-radius)] bg-[var(--st-bg-secondary)] text-[var(--st-text)]"
          >
            <CreditCard className="h-5 w-5" aria-hidden="true" />
          </span>
          WhatsApp Pay
        </span>
      }
      description="Manage your WhatsApp Pay configurations and view transaction history for customers paying directly inside conversations."
    >
      {/* Tab pills — route-based navigation links */}
      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => {
          const active = t.exact
            ? pathname === t.href
            : pathname === t.href || pathname.startsWith(t.href + '/');
          return (
            <Link
              key={t.href}
              href={t.href}
              aria-current={active ? 'page' : undefined}
              className={cx(
                'inline-flex items-center gap-2 px-3.5 py-2 text-[12.5px] font-medium transition-[background,border-color,color]',
                'rounded-[var(--st-radius-pill)] border',
                active
                  ? 'border-[var(--st-text)] bg-[var(--st-text)] text-[var(--st-bg)]'
                  : 'border-[var(--st-border)] bg-[var(--st-bg)] text-[var(--st-text-secondary)]',
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
    </WachatPage>
  );
}
