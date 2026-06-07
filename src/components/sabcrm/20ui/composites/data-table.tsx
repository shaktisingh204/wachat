"use client";

import * as React from "react";
import {
  ColumnDef,
  ColumnFiltersState,
  RowSelectionState,
  SortingState,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, ChevronsUpDown, Settings2 } from "lucide-react";

import { cn } from "./lib/cn";
import { Button } from "./button";
import { Input } from "./input";
import {
  DropdownMenu,
  ZoruDropdownMenuCheckboxItem,
  ZoruDropdownMenuContent,
  ZoruDropdownMenuLabel,
  ZoruDropdownMenuSeparator,
  ZoruDropdownMenuTrigger,
} from "./dropdown-menu";
import {
  Table,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
} from "./table";

export interface ZoruDataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  /** Column id to filter on via the toolbar input. */
  filterColumn?: string;
  filterPlaceholder?: string;
  /** Render extra toolbar content (right side). */
  toolbar?: React.ReactNode;
  className?: string;
  /** Page size for pagination. Defaults to 10. */
  pageSize?: number;
  /** Show density / column visibility menu. Defaults to true. */
  showColumnMenu?: boolean;
  /** Empty state shown when there are no rows. */
  empty?: React.ReactNode;
  /** Called when row selection changes (controlled mode optional). */
  onRowSelectionChange?: (rows: TData[]) => void;
}

export function DataTable<TData, TValue>({
  columns,
  data,
  filterColumn,
  filterPlaceholder = "Filter…",
  toolbar,
  className,
  pageSize = 10,
  showColumnMenu = true,
  empty,
  onRowSelectionChange,
}: ZoruDataTableProps<TData, TValue>) {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});

  const table = useReactTable({
    data,
    columns,
    initialState: { pagination: { pageSize } },
    state: { sorting, columnFilters, columnVisibility, rowSelection },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    enableRowSelection: true,
  });

  React.useEffect(() => {
    if (!onRowSelectionChange) return;
    onRowSelectionChange(
      table.getSelectedRowModel().rows.map((r) => r.original),
    );
  }, [rowSelection, onRowSelectionChange, table]);

  const filterColumnApi = filterColumn ? table.getColumn(filterColumn) : null;

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="flex flex-wrap items-center gap-2">
        {filterColumnApi && (
          <Input
            placeholder={filterPlaceholder}
            value={(filterColumnApi.getFilterValue() as string) ?? ""}
            onChange={(e) => filterColumnApi.setFilterValue(e.target.value)}
            className="max-w-xs"
          />
        )}
        <div className="ml-auto flex items-center gap-2">
          {toolbar}
          {showColumnMenu && (
            <DropdownMenu>
              <ZoruDropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Settings2 /> Columns
                </Button>
              </ZoruDropdownMenuTrigger>
              <ZoruDropdownMenuContent align="end" className="w-48">
                <ZoruDropdownMenuLabel>Toggle columns</ZoruDropdownMenuLabel>
                <ZoruDropdownMenuSeparator />
                {table
                  .getAllColumns()
                  .filter((c) => c.getCanHide())
                  .map((column) => (
                    <ZoruDropdownMenuCheckboxItem
                      key={column.id}
                      className="capitalize"
                      checked={column.getIsVisible()}
                      onCheckedChange={(v) => column.toggleVisibility(!!v)}
                    >
                      {column.id}
                    </ZoruDropdownMenuCheckboxItem>
                  ))}
              </ZoruDropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      <div className="rounded-[var(--st-radius-lg)] border border-[var(--st-border)]">
        <Table>
          <ZoruTableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <ZoruTableRow key={headerGroup.id} className="hover:bg-transparent">
                {headerGroup.headers.map((header) => {
                  const canSort = header.column.getCanSort();
                  const sorted = header.column.getIsSorted();
                  return (
                    <ZoruTableHead key={header.id}>
                      {header.isPlaceholder ? null : (
                        <button
                          type="button"
                          onClick={
                            canSort
                              ? header.column.getToggleSortingHandler()
                              : undefined
                          }
                          className={cn(
                            "inline-flex items-center gap-1.5",
                            canSort && "hover:text-[var(--st-text)]",
                          )}
                          disabled={!canSort}
                        >
                          {flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )}
                          {canSort &&
                            (sorted === "asc" ? (
                              <ArrowUp className="h-3 w-3" />
                            ) : sorted === "desc" ? (
                              <ArrowDown className="h-3 w-3" />
                            ) : (
                              <ChevronsUpDown className="h-3 w-3 opacity-50" />
                            ))}
                        </button>
                      )}
                    </ZoruTableHead>
                  );
                })}
              </ZoruTableRow>
            ))}
          </ZoruTableHeader>
          <ZoruTableBody>
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <ZoruTableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                >
                  {row.getVisibleCells().map((cell) => (
                    <ZoruTableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </ZoruTableCell>
                  ))}
                </ZoruTableRow>
              ))
            ) : (
              <ZoruTableRow className="hover:bg-transparent">
                <ZoruTableCell
                  colSpan={columns.length}
                  className="h-32 text-center text-sm text-[var(--st-text-secondary)]"
                >
                  {empty ?? "No results."}
                </ZoruTableCell>
              </ZoruTableRow>
            )}
          </ZoruTableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between gap-3 px-1">
        <p className="text-xs text-[var(--st-text-secondary)]">
          {table.getFilteredSelectedRowModel().rows.length} of{" "}
          {table.getFilteredRowModel().rows.length} row(s) selected
        </p>
        <div className="flex items-center gap-2">
          <p className="text-xs text-[var(--st-text-secondary)]">
            Page {table.getState().pagination.pageIndex + 1} of{" "}
            {Math.max(table.getPageCount(), 1)}
          </p>
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Previous"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            <ChevronLeft />
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Next"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            <ChevronRight />
          </Button>
        </div>
      </div>
    </div>
  );
}
