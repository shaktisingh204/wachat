'use client';

/**
 * SabTable — thin wrapper around a semantic `<table>` with SabUI styling.
 *
 * Unlike shadcn's Table (which is fine but generic), this ships with a
 * specific visual identity: no heavy borders, subtle row dividers, hover
 * tint from `--sab-bg-subtle`, uppercase column headers in the mono font.
 *
 * Use it like any other table:
 *
 *   <SabTable>
 *     <SabTHead>
 *       <tr>
 *         <SabTh>Name</SabTh>
 *         <SabTh align="right">Count</SabTh>
 *       </tr>
 *     </SabTHead>
 *     <SabTBody>
 *       {rows.map((r) => (
 *         <SabTr key={r.id}>
 *           <SabTd>{r.name}</SabTd>
 *           <SabTd align="right" numeric>{r.count}</SabTd>
 *         </SabTr>
 *       ))}
 *     </SabTBody>
 *   </SabTable>
 */

import * as React from 'react';
import { cn } from '@/lib/utils';

export const SabTable = React.forwardRef<
  HTMLTableElement,
  React.TableHTMLAttributes<HTMLTableElement>
>(({ className, ...props }, ref) => (
  <div className="w-full overflow-x-auto">
    <table
      ref={ref}
      className={cn('w-full border-collapse text-[13.5px]', className)}
      style={{ fontFamily: 'var(--sab-font-sans)' }}
      {...props}
    />
  </div>
));
SabTable.displayName = 'SabTable';

export const SabTHead = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <thead
    ref={ref}
    className={cn('', className)}
    style={{ borderBottom: '1px solid hsl(var(--sab-border))' }}
    {...props}
  />
));
SabTHead.displayName = 'SabTHead';

export const SabTBody = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => <tbody ref={ref} className={className} {...props} />);
SabTBody.displayName = 'SabTBody';

export interface SabThProps extends React.ThHTMLAttributes<HTMLTableCellElement> {
  align?: 'left' | 'right' | 'center';
}

export const SabTh = React.forwardRef<HTMLTableCellElement, SabThProps>(
  ({ className, align = 'left', style, ...props }, ref) => (
    <th
      ref={ref}
      className={cn(
        'px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.08em]',
        align === 'right' && 'text-right',
        align === 'center' && 'text-center',
        align === 'left' && 'text-left',
        className,
      )}
      style={{
        color: 'hsl(var(--sab-fg-subtle))',
        fontFamily: 'var(--sab-font-mono)',
        ...style,
      }}
      {...props}
    />
  ),
);
SabTh.displayName = 'SabTh';

export const SabTr = React.forwardRef<
  HTMLTableRowElement,
  React.HTMLAttributes<HTMLTableRowElement> & { interactive?: boolean }
>(({ className, interactive, style, ...props }, ref) => (
  <tr
    ref={ref}
    className={cn(
      'transition-colors',
      interactive && 'cursor-pointer',
      className,
    )}
    style={{
      borderBottom: '1px solid hsl(var(--sab-border))',
      ...style,
    }}
    onMouseEnter={interactive ? (e) => { (e.currentTarget as HTMLTableRowElement).style.background = 'hsl(var(--sab-bg-subtle))'; } : undefined}
    onMouseLeave={interactive ? (e) => { (e.currentTarget as HTMLTableRowElement).style.background = 'transparent'; } : undefined}
    {...props}
  />
));
SabTr.displayName = 'SabTr';

export interface SabTdProps extends React.TdHTMLAttributes<HTMLTableCellElement> {
  align?: 'left' | 'right' | 'center';
  numeric?: boolean;
  muted?: boolean;
}

export const SabTd = React.forwardRef<HTMLTableCellElement, SabTdProps>(
  ({ className, align = 'left', numeric, muted, style, ...props }, ref) => (
    <td
      ref={ref}
      className={cn(
        'px-4 py-3',
        align === 'right' && 'text-right',
        align === 'center' && 'text-center',
        align === 'left' && 'text-left',
        numeric && 'tabular-nums',
        className,
      )}
      style={{
        color: muted ? 'hsl(var(--sab-fg-muted))' : 'hsl(var(--sab-fg))',
        fontFamily: numeric ? 'var(--sab-font-mono)' : 'var(--sab-font-sans)',
        ...style,
      }}
      {...props}
    />
  ),
);
SabTd.displayName = 'SabTd';
