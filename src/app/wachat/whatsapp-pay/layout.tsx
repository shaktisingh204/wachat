'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { m } from 'motion/react';
import { CreditCard, History, Settings } from 'lucide-react';

import { useProject } from '@/context/project-context';
import { WaPage, PageHeader } from '@/components/wachat-ui';
import { EASE_OUT } from '@/components/dashboard-ui/module-theme';

const TABS = [
  { href: '/wachat/whatsapp-pay', label: 'Transactions', icon: History, exact: true },
  { href: '/wachat/whatsapp-pay/settings', label: 'Setup', icon: Settings, exact: false },
];

export default function WhatsAppPayLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { activeProject } = useProject();

  return (
    <WaPage>
      <PageHeader
        title="WhatsApp Pay"
        description={`Take payments directly inside chat for ${activeProject?.name ?? 'this project'}. Review transactions, configure providers, and reconcile.`}
        kicker="Wachat · payments"
        eyebrowIcon={CreditCard}
      />

      {/* tab pills */}
      <div className="mb-6 flex flex-wrap gap-1 rounded-full border border-zinc-200 bg-white p-1">
        {TABS.map((t) => {
          const active = t.exact ? pathname === t.href : pathname === t.href || pathname.startsWith(t.href + '/');
          const Icon = t.icon;
          return (
            <Link
              key={t.href}
              href={t.href}
              className="relative inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[12px] font-semibold transition-colors duration-150 active:scale-[0.97]"
            >
              {active && (
                <m.span
                  layoutId="wa-pay-tab"
                  className="absolute inset-0 rounded-full"
                  style={{ background: 'var(--mt-accent)' }}
                  transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                />
              )}
              <span className={`relative z-10 inline-flex items-center gap-1.5 ${active ? 'text-white' : 'text-zinc-600'}`}>
                <Icon className="h-3 w-3" strokeWidth={2.25} aria-hidden />
                {t.label}
              </span>
            </Link>
          );
        })}
      </div>

      <m.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: EASE_OUT }}
      >
        {children}
      </m.div>
    </WaPage>
  );
}
