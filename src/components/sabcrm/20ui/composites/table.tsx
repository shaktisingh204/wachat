import * as React from "react";

import { cn } from "./lib/cn";

export const Table = React.forwardRef<
  HTMLTableElement,
  React.HTMLAttributes<HTMLTableElement>
>(({ className, ...props }, ref) => (
  <div className="relative w-full overflow-hidden rounded-[var(--st-radius-lg)] border border-[var(--st-border)] bg-[var(--st-bg)] shadow-[var(--st-shadow-sm)]">
    <div className="w-full overflow-x-auto">
    <table
      ref={ref}
      className={cn("w-full caption-bottom text-sm text-[var(--st-text)]", className)}
      {...props}
    />
    </div>
  </div>
));
Table.displayName = "Table";

export const ZoruTableHeader = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <thead
    ref={ref}
    className={cn("[&_tr]:border-b [&_tr]:border-[var(--st-border)]", className)}
    {...props}
  />
));
ZoruTableHeader.displayName = "ZoruTableHeader";

export const ZoruTableBody = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tbody
    ref={ref}
    className={cn("[&_tr:last-child]:border-0", className)}
    {...props}
  />
));
ZoruTableBody.displayName = "ZoruTableBody";

export const ZoruTableFooter = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tfoot
    ref={ref}
    className={cn(
      "border-t border-[var(--st-border)] bg-[var(--st-surface)] font-medium",
      className,
    )}
    {...props}
  />
));
ZoruTableFooter.displayName = "ZoruTableFooter";

export const ZoruTableRow = React.forwardRef<
  HTMLTableRowElement,
  React.HTMLAttributes<HTMLTableRowElement>
>(({ className, ...props }, ref) => (
  <tr
    ref={ref}
    className={cn(
      "border-b border-[var(--st-border)] transition-colors",
      "hover:bg-[var(--st-surface)] data-[state=selected]:bg-[var(--st-bg-muted)]",
      className,
    )}
    {...props}
  />
));
ZoruTableRow.displayName = "ZoruTableRow";

export const ZoruTableHead = React.forwardRef<
  HTMLTableCellElement,
  React.ThHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <th
    ref={ref}
    className={cn(
      "h-10 bg-[var(--st-surface)] px-3 text-left align-middle text-[11px] font-medium uppercase tracking-wide text-[var(--st-text-tertiary)]",
      "[&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-0",
      className,
    )}
    {...props}
  />
));
ZoruTableHead.displayName = "ZoruTableHead";

export const ZoruTableCell = React.forwardRef<
  HTMLTableCellElement,
  React.TdHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <td
    ref={ref}
    className={cn(
      "px-3 py-3 align-middle [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-0",
      className,
    )}
    {...props}
  />
));
ZoruTableCell.displayName = "ZoruTableCell";

export const ZoruTableCaption = React.forwardRef<
  HTMLTableCaptionElement,
  React.HTMLAttributes<HTMLTableCaptionElement>
>(({ className, ...props }, ref) => (
  <caption
    ref={ref}
    className={cn("mt-4 text-xs text-[var(--st-text-secondary)]", className)}
    {...props}
  />
));
ZoruTableCaption.displayName = "ZoruTableCaption";

export {
  ZoruTableHeader as TableHeader,
  ZoruTableBody as TableBody,
  ZoruTableFooter as TableFooter,
  ZoruTableRow as TableRow,
  ZoruTableHead as TableHead,
  ZoruTableCell as TableCell,
  ZoruTableCaption as TableCaption,
};
