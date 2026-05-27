'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { m } from 'motion/react';
import { History, Phone, Settings } from 'lucide-react';

import { useProject } from '@/context/project-context';
import { WaPage, PageHeader } from '@/components/wachat-ui';
import { EASE_OUT } from '@/components/dashboard-ui/module-theme';

const SECTIONS = [
  { href: '/wachat/calls/logs', label: 'Call logs', icon: History },
  { href: '/wachat/calls/settings', label: 'Call setup', icon: Settings },
];

export default function CallsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { activeProject } = useProject();

  return (
    <WaPage>
      <PageHeader
        title="WhatsApp calling"
        description={`Calling controls for ${activeProject?.name ?? 'this project'}. Review call logs, tweak voicemail prompts, and toggle business calling per number.`}
        kicker="Wachat · calls"
        eyebrowIcon={Phone}
      />

      <div className="mb-6 flex flex-wrap gap-1 rounded-full border border-zinc-200 bg-white p-1">
        {SECTIONS.map((s) => {
          const active = pathname === s.href || pathname.startsWith(s.href + '/');
          const Icon = s.icon;
          return (
            <Link
              key={s.href}
              href={s.href}
              className="relative inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[12px] font-semibold transition-colors duration-150 active:scale-[0.97]"
            >
              {active && (
                <m.span
                  layoutId="wa-calls-tab"
                  className="absolute inset-0 rounded-full"
                  style={{ background: 'var(--mt-accent)' }}
                  transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                />
              )}
              <span className={`relative z-10 inline-flex items-center gap-1.5 ${active ? 'text-white' : 'text-zinc-600'}`}>
                <Icon className="h-3 w-3" strokeWidth={2.25} aria-hidden />
                {s.label}
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
