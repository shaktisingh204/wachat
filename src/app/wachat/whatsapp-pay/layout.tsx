'use client';

/**
 * Wachat WhatsApp Pay — Clay-styled tab layout.
 *
 * Two tabs: Transactions · Setup. Each tab's content is rendered
 * by its child route.
 */

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LuCreditCard, LuHistory, LuSettings } from 'react-icons/lu';

import { useProject } from '@/context/project-context';
import { cn } from '@/lib/utils';
import { ClayBreadcrumbs } from '@/components/clay';

const TABS = [
  {
    href: '/wachat/whatsapp-pay',
    label: 'Transactions',
    icon: <LuHistory className="h-3.5 w-3.5" strokeWidth={2} />,
    exact: true,
  },
  {
    href: '/wachat/whatsapp-pay/settings',
    label: 'Setup',
    icon: <LuSettings className="h-3.5 w-3.5" strokeWidth={2} />,
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
    <div className="flex flex-col gap-6 clay-enter">
      <ClayBreadcrumbs
        items={[
          { label: 'Wachat', href: '/dashboard' },
          { label: activeProject?.name || 'Project', href: '/wachat' },
          { label: 'WhatsApp Pay' },
        ]}
      />

      <div>
        <h1 className="flex items-center gap-3 text-[30px] font-semibold tracking-[-0.015em] text-foreground leading-[1.1]">
          <span className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-gradient-to-br from-[#FDE68A] to-[#B45309] text-white shadow-sm">
            <LuCreditCard className="h-5 w-5" strokeWidth={2} />
          </span>
          WhatsApp Pay
        </h1>
        <p className="mt-1.5 max-w-[720px] text-[13px] text-muted-foreground">
          Manage your WhatsApp Pay configurations and view transaction
          history for customers paying directly inside conversations.
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
                  ? 'bg-foreground border-foreground text-white shadow-sm'
                  : 'bg-card border-border text-muted-foreground hover:text-foreground hover:border-border',
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
