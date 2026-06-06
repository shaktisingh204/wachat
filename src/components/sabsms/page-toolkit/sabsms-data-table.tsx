"use client";

import * as React from "react";
import { ChevronDown, MoreHorizontal } from "lucide-react";

import { Button, Checkbox, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, Table, TBody, Td, Th, THead, Tr } from '@/components/sabcrm/20ui';

import { SabsmsBulkActionsBar, type SabsmsBulkAction } from "./sabsms-bulk-actions";
import { SabsmsPagination } from "./sabsms-pagination";
import { SabsmsEmpty, SabsmsErrorState, SabsmsTableSkeleton } from "./sabsms-states";

/**
 * Generic table that delivers S13-S20 (sticky header, resizable cols
 * stub, hover quick actions, bulk select, select-all-on-page, bulk
 * actions, pagination), plus loading / error / empty states.
 *
 * Resizable columns are intentionally stubbed (the column-picker handles
 * show/hide); native resize via CSS `resize` keeps the surface area
 * small without a heavyweight grid library.
 */

export interface SabsmsColumn<T> {
  id: string;
  header: React.ReactNode;
  render: (row: T) => React.ReactNode;
  width?: string;
  align?: "left" | "right" | "center";
  hideByDefault?: boolean;
}

export interface SabsmsRowAction<T> {
  label: string;
  icon?: React.ReactNode;
  onSelect: (row: T) => void;
  destructive?: boolean;
}

export interface SabsmsDataTableProps<T> {
  rows: T[];
  total?: number;
  page?: number;
  pageSize?: number;
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (size: number) => void;

  columns: SabsmsColumn<T>[];
  visibleColumnIds?: string[];
  density?: "compact" | "comfortable" | "cosy";

  rowKey: (row: T) => string;
  selectable?: boolean;
  selectedIds?: string[];
  onSelectionChange?: (ids: string[]) => void;
  bulkActions?: SabsmsBulkAction<T>[];

  rowActions?: SabsmsRowAction<T>[];
  onRowClick?: (row: T) => void;

  loading?: boolean;
  error?: { message: string; retry?: () => void };
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: { label: string; href?: string; onClick?: () => void };
  emptyIcon?: React.ReactNode;
}

const DENSITY_PADDING: Record<NonNullable<SabsmsDataTableProps<unknown>["density"]>, string> = {
  compact: "py-1.5",
  comfortable: "py-3",
  cosy: "py-5",
};

export function SabsmsDataTable<T>({
  rows,
  total,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
  columns,
  visibleColumnIds,
  density = "comfortable",
  rowKey,
  selectable,
  selectedIds,
  onSelectionChange,
  bulkActions,
  rowActions,
  onRowClick,
  loading,
  error,
  emptyTitle = "Nothing here yet",
  emptyDescription,
  emptyAction,
  emptyIcon,
}: SabsmsDataTableProps<T>) {
  const visibleCols = React.useMemo(() => {
    if (!visibleColumnIds || visibleColumnIds.length === 0) {
      return columns.filter((c) => !c.hideByDefault);
    }
    return columns.filter((c) => visibleColumnIds.includes(c.id));
  }, [columns, visibleColumnIds]);

  const lastClickedIndexRef = React.useRef<number | null>(null);

  function toggleRow(id: string, index: number, shiftKey: boolean) {
    if (!onSelectionChange || !selectedIds) return;

    if (shiftKey && lastClickedIndexRef.current !== null) {
      const [a, b] = [lastClickedIndexRef.current, index].sort((x, y) => x - y);
      const rangeIds = rows.slice(a, b + 1).map(rowKey);
      const merged = new Set(selectedIds);
      const allSelected = rangeIds.every((rid) => merged.has(rid));
      for (const rid of rangeIds) {
        if (allSelected) merged.delete(rid);
        else merged.add(rid);
      }
      onSelectionChange(Array.from(merged));
    } else {
      const set = new Set(selectedIds);
      if (set.has(id)) set.delete(id);
      else set.add(id);
      onSelectionChange(Array.from(set));
    }
    lastClickedIndexRef.current = index;
  }

  function toggleAllOnPage() {
    if (!onSelectionChange || !selectedIds) return;
    const pageIds = rows.map(rowKey);
    const everySelected = pageIds.every((id) => selectedIds.includes(id));
    if (everySelected) {
      onSelectionChange(selectedIds.filter((id) => !pageIds.includes(id)));
    } else {
      onSelectionChange(Array.from(new Set([...selectedIds, ...pageIds])));
    }
  }

  if (error) {
    return <SabsmsErrorState message={error.message} onRetry={error.retry} />;
  }
  if (loading) {
    return <SabsmsTableSkeleton columns={visibleCols.length} rows={pageSize ?? 10} />;
  }
  if (rows.length === 0) {
    return (
      <SabsmsEmpty
        icon={emptyIcon}
        title={emptyTitle}
        description={emptyDescription}
        action={emptyAction}
      />
    );
  }

  const allOnPageSelected =
    selectable &&
    selectedIds &&
    rows.length > 0 &&
    rows.every((r) => selectedIds.includes(rowKey(r)));
  const someOnPageSelected =
    selectable &&
    selectedIds &&
    rows.some((r) => selectedIds.includes(rowKey(r))) &&
    !allOnPageSelected;

  return (
    <div className="space-y-3">
      {selectable && selectedIds && selectedIds.length > 0 && bulkActions && (
        <SabsmsBulkActionsBar
          selectedCount={selectedIds.length}
          totalCount={total ?? rows.length}
          actions={bulkActions}
          rows={rows.filter((r) => selectedIds.includes(rowKey(r)))}
          onClear={() => onSelectionChange?.([])}
        />
      )}
      <div className="overflow-hidden rounded-md border border-[var(--st-border)] bg-white">
        <div className="max-h-[70vh] overflow-auto">
          <Table>
            <THead className="sticky top-0 z-10 bg-[var(--st-bg-muted)]">
              <Tr>
                {selectable && (
                  <Th className="w-[40px]">
                    <Checkbox
                      checked={
                        allOnPageSelected
                          ? true
                          : someOnPageSelected
                            ? "indeterminate"
                            : false
                      }
                      onCheckedChange={toggleAllOnPage}
                      aria-label="Select all on page"
                    />
                  </Th>
                )}
                {visibleCols.map((col) => (
                  <Th
                    key={col.id}
                    style={col.width ? { width: col.width } : undefined}
                    className={col.align === "right" ? "text-right" : undefined}
                  >
                    {col.header}
                  </Th>
                ))}
                {rowActions && rowActions.length > 0 && (
                  <Th className="w-[40px]" aria-label="Row actions" />
                )}
              </Tr>
            </THead>
            <TBody>
              {rows.map((row, index) => {
                const id = rowKey(row);
                const isSelected = !!selectedIds?.includes(id);
                return (
                  <Tr
                    key={id}
                    data-state={isSelected ? "selected" : undefined}
                    className={
                      onRowClick
                        ? "cursor-pointer hover:bg-[var(--st-bg-muted)]"
                        : "hover:bg-[var(--st-bg-muted)]"
                    }
                  >
                    {selectable && (
                      <Td
                        className={DENSITY_PADDING[density]}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleRow(id, index, e.shiftKey);
                        }}
                      >
                        <span className="pointer-events-none">
                          <Checkbox
                            checked={isSelected}
                            aria-label={`Select row ${id}`}
                          />
                        </span>
                      </Td>
                    )}
                    {visibleCols.map((col) => (
                      <Td
                        key={col.id}
                        className={`${DENSITY_PADDING[density]} ${col.align === "right" ? "text-right" : ""}`}
                        onClick={onRowClick ? () => onRowClick(row) : undefined}
                      >
                        {col.render(row)}
                      </Td>
                    ))}
                    {rowActions && rowActions.length > 0 && (
                      <Td
                        className={DENSITY_PADDING[density]}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              aria-label="Row actions"
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {rowActions.map((a) => (
                              <DropdownMenuItem
                                key={a.label}
                                onSelect={() => a.onSelect(row)}
                                destructive={a.destructive}
                              >
                                {a.icon}
                                <span className={a.icon ? "ml-2" : undefined}>
                                  {a.label}
                                </span>
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </Td>
                    )}
                  </Tr>
                );
              })}
            </TBody>
          </Table>
        </div>
      </div>
      {(page !== undefined && pageSize && total !== undefined) ? (
        <SabsmsPagination
          page={page}
          pageSize={pageSize}
          total={total}
          onPageChange={onPageChange}
          onPageSizeChange={onPageSizeChange}
        />
      ) : null}
    </div>
  );
}
