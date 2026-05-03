import * as React from "react";

import { cn } from "./lib/cn";

export const ZoruTable = React.forwardRef<
  HTMLTableElement,
  React.HTMLAttributes<HTMLTableElement>
>(({ className, ...props }, ref) => (
  <div className="relative w-full overflow-x-auto">
    <table
      ref={ref}
      className={cn("w-full caption-bottom text-sm text-zoru-ink", className)}
      {...props}
    />
  </div>
));
ZoruTable.displayName = "ZoruTable";

export const ZoruTableHeader = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <thead
    ref={ref}
    className={cn("[&_tr]:border-b [&_tr]:border-zoru-line", className)}
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
      "border-t border-zoru-line bg-zoru-surface font-medium",
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
      "border-b border-zoru-line transition-colors",
      "hover:bg-zoru-surface data-[state=selected]:bg-zoru-surface-2",
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
      "h-10 px-3 text-left align-middle text-[11px] font-medium uppercase tracking-wide text-zoru-ink-subtle",
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
    className={cn("mt-4 text-xs text-zoru-ink-muted", className)}
    {...props}
  />
));
ZoruTableCaption.displayName = "ZoruTableCaption";
