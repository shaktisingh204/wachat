"use client";

import * as React from "react";

import { cn } from "./lib/cn";
import {
  ZoruDialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogHeader,
  ZoruDialogTitle,
} from "./dialog";
import {
  ZoruTable,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
} from "./table";

export interface ZoruTableColumn<T> {
  key: string;
  header: React.ReactNode;
  /** Cell renderer. Defaults to `String((row as any)[key])`. */
  cell?: (row: T) => React.ReactNode;
  className?: string;
  align?: "left" | "right" | "center";
}

export interface ZoruTableWithDialogProps<T> {
  rows: T[];
  columns: ZoruTableColumn<T>[];
  /** Function returning the dialog title for the active row. */
  rowTitle?: (row: T) => React.ReactNode;
  /** Function returning the dialog description for the active row. */
  rowDescription?: (row: T) => React.ReactNode;
  /** Render the dialog body for the active row. */
  rowDialog: (row: T) => React.ReactNode;
  /** Stable id for each row. Defaults to index. */
  rowId?: (row: T, index: number) => string;
  className?: string;
  empty?: React.ReactNode;
}

/**
 * Click-row-to-open-dialog table — the pattern called out in
 * componts.txt. Use for entity lists where each row's expanded
 * detail is too rich to render inline.
 */
export function ZoruTableWithDialog<T>({
  rows,
  columns,
  rowTitle,
  rowDescription,
  rowDialog,
  rowId,
  className,
  empty,
}: ZoruTableWithDialogProps<T>) {
  const [activeIndex, setActiveIndex] = React.useState<number | null>(null);
  const active = activeIndex === null ? null : rows[activeIndex] ?? null;

  return (
    <>
      <div
        className={cn(
          "rounded-[var(--zoru-radius-lg)] border border-zoru-line",
          className,
        )}
      >
        <ZoruTable>
          <ZoruTableHeader>
            <ZoruTableRow className="hover:bg-transparent">
              {columns.map((col) => (
                <ZoruTableHead
                  key={col.key}
                  className={cn(
                    col.align === "right" && "text-right",
                    col.align === "center" && "text-center",
                    col.className,
                  )}
                >
                  {col.header}
                </ZoruTableHead>
              ))}
            </ZoruTableRow>
          </ZoruTableHeader>
          <ZoruTableBody>
            {rows.length === 0 ? (
              <ZoruTableRow className="hover:bg-transparent">
                <ZoruTableCell
                  colSpan={columns.length}
                  className="h-32 text-center text-sm text-zoru-ink-muted"
                >
                  {empty ?? "No rows."}
                </ZoruTableCell>
              </ZoruTableRow>
            ) : (
              rows.map((row, idx) => (
                <ZoruTableRow
                  key={rowId ? rowId(row, idx) : idx}
                  className="cursor-pointer"
                  onClick={() => setActiveIndex(idx)}
                >
                  {columns.map((col) => (
                    <ZoruTableCell
                      key={col.key}
                      className={cn(
                        col.align === "right" && "text-right",
                        col.align === "center" && "text-center",
                      )}
                    >
                      {col.cell
                        ? col.cell(row)
                        : String((row as Record<string, unknown>)[col.key] ?? "")}
                    </ZoruTableCell>
                  ))}
                </ZoruTableRow>
              ))
            )}
          </ZoruTableBody>
        </ZoruTable>
      </div>

      <ZoruDialog
        open={active !== null}
        onOpenChange={(open) => {
          if (!open) setActiveIndex(null);
        }}
      >
        <ZoruDialogContent>
          {active && (
            <>
              <ZoruDialogHeader>
                {rowTitle && <ZoruDialogTitle>{rowTitle(active)}</ZoruDialogTitle>}
                {rowDescription && (
                  <ZoruDialogDescription>
                    {rowDescription(active)}
                  </ZoruDialogDescription>
                )}
              </ZoruDialogHeader>
              {rowDialog(active)}
            </>
          )}
        </ZoruDialogContent>
      </ZoruDialog>
    </>
  );
}
