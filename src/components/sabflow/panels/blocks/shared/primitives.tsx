'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** Labelled field wrapper */
export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-[11.5px] font-medium text-[var(--gray-10)] uppercase tracking-wide">
        {label}
      </label>
      {children}
    </div>
  );
}

/** Shared input class */
export const inputClass =
  'w-full rounded-lg border border-[var(--gray-5)] bg-[var(--gray-2)] px-3 py-2 text-[13px] text-[var(--gray-12)] placeholder:text-[var(--gray-8)] outline-none focus:border-[#f76808] transition-colors';

/** Shared select class */
export const selectClass =
  'w-full rounded-lg border border-[var(--gray-5)] bg-[var(--gray-2)] px-3 py-2 text-[13px] text-[var(--gray-12)] outline-none focus:border-[#f76808] transition-colors appearance-none cursor-pointer';

/** Toggle button class based on checked state */
export function toggleClass(checked: boolean): string {
  return cn(
    'relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors',
    checked ? 'bg-[#f76808]' : 'bg-[var(--gray-5)]',
  );
}

/** Section divider */
export function Divider() {
  return <div className="h-px bg-[var(--gray-4)]" />;
}

/** Panel header with icon, color, and title */
export function PanelHeader({
  icon: Icon,
  title,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  title: string;
}) {
  return (
    <div className="flex items-center gap-2 pb-1 border-b border-[var(--gray-4)]">
      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#f7680822] text-[#f76808]">
        <Icon className="h-4 w-4" strokeWidth={1.8} />
      </div>
      <span className="text-[12px] font-semibold text-[var(--gray-11)] uppercase tracking-wide">
        {title}
      </span>
    </div>
  );
}
