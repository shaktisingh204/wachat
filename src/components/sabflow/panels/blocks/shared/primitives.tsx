'use client';

import type { ReactNode } from 'react';

import {
  cn,
  Field as Field20,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/sabcrm/20ui';

/**
 * Labelled field wrapper.
 *
 * Forwards to the 20ui `Field`, which puts the label above the control and wires
 * `htmlFor` / `aria-describedby` / `aria-invalid` to whatever control is dropped
 * inside it, so blocks get correct labelling for free.
 */
export function Field({ label, children }: { label: string; children: ReactNode }) {
  return <Field20 label={label}>{children}</Field20>;
}

/** Shared input class (applied to 20ui-styled controls in block editors). */
export const inputClass =
  'w-full rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] px-3 py-2 text-[13px] text-[var(--st-text)] placeholder:text-[var(--st-text-tertiary)] outline-none focus:border-[var(--st-accent)] transition-colors';

/** Shared select class (applied to 20ui-styled controls in block editors). */
export const selectClass =
  'w-full rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] px-3 py-2 text-[13px] text-[var(--st-text)] outline-none focus:border-[var(--st-accent)] transition-colors appearance-none cursor-pointer';

/** Toggle track class based on checked state. */
export function toggleClass(checked: boolean): string {
  return cn(
    'relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors',
    checked ? 'bg-[var(--st-text)]' : 'bg-[var(--st-border-strong)]',
  );
}

/** Section divider. */
export function Divider() {
  return <div className="h-px bg-[var(--st-border)]" />;
}

/** Panel header with icon and title. */
export function PanelHeader({
  icon: Icon,
  title,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  title: string;
}) {
  return (
    <div className="flex items-center gap-2 pb-1 border-b border-[var(--st-border)]">
      <div className="flex h-7 w-7 items-center justify-center rounded-[var(--st-radius)] bg-[var(--st-accent-soft)] text-[var(--st-accent)]">
        <Icon className="h-4 w-4" strokeWidth={1.8} aria-hidden="true" />
      </div>
      <span className="text-[12px] font-semibold text-[var(--st-text-secondary)] uppercase tracking-wide">
        {title}
      </span>
    </div>
  );
}

/**
 * Collapsible settings section, used to group advanced options (e.g.
 * "Validation") so the default panel stays uncluttered. Built on the 20ui
 * `Collapsible`, so the chevron rotation, height animation, reduced-motion
 * handling, and `aria-expanded` / `aria-controls` wiring all come from the
 * design system rather than being hand-rolled here.
 */
export function CollapsibleSection({
  title,
  defaultOpen = false,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  return (
    <Collapsible
      defaultOpen={defaultOpen}
      className="rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)]"
    >
      <CollapsibleTrigger className="px-3 py-2 text-[11.5px] font-semibold text-[var(--st-text-secondary)] uppercase tracking-wide">
        {title}
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="space-y-3 border-t border-[var(--st-border)] px-3 py-3">{children}</div>
      </CollapsibleContent>
    </Collapsible>
  );
}
