import { Card } from '@/components/sabcrm/20ui/compat';
/**
 * <HrDetailGrid /> — 2-column grid for HR detail pages (per §1D.2 of
 * the CRM rebuild contract). Renders `<HrDetailRow />` items inside a
 * `ZoruCard`. Designed to be used inside `<EntityDetailShell>`.
 *
 * @example
 * ```tsx
 * <HrDetailGrid title="Overview">
 *   <HrDetailRow label="Employee">{e.employeeName}</HrDetailRow>
 *   <HrDetailRow label="Status">
 *     <Badge variant="success">{e.status}</Badge>
 *   </HrDetailRow>
 * </HrDetailGrid>
 * ```
 */

import * as React from 'react';

export interface HrDetailGridProps {
  title?: string;
  /** Additional content rendered next to the title (e.g. a status pill). */
  titleSlot?: React.ReactNode;
  children: React.ReactNode;
}

export function HrDetailGrid({ title, titleSlot, children }: HrDetailGridProps) {
  return (
    <Card className="p-6">
      {title || titleSlot ? (
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          {title ? (
            <h2 className="text-[15px] font-medium text-zoru-ink">{title}</h2>
          ) : (
            <span />
          )}
          {titleSlot}
        </div>
      ) : null}
      <div className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">{children}</div>
    </Card>
  );
}

export interface HrDetailRowProps {
  label: string;
  children?: React.ReactNode;
  /** Span both columns of the 2-col grid. */
  fullWidth?: boolean;
}

export function HrDetailRow({ label, children, fullWidth }: HrDetailRowProps) {
  return (
    <div className={fullWidth ? 'sm:col-span-2' : undefined}>
      <div className="text-[12px] text-zoru-ink-muted">{label}</div>
      <div className="mt-0.5 text-[13px] text-zoru-ink whitespace-pre-line">
        {children === null || children === undefined || children === '' ? '—' : children}
      </div>
    </div>
  );
}
