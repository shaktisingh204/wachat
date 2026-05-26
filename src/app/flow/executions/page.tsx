"use client";

import React, { useState, useMemo } from "react";
import { useReactTable, getCoreRowModel, getFilteredRowModel, getPaginationRowModel, getSortedRowModel, flexRender, ColumnDef, SortingState, ColumnFiltersState } from "@tanstack/react-table";
import { useQuery, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fmtDate, formatUTC } from "@/lib/utils";
import { Search, Filter, Play, CheckCircle2, Clock, AlertCircle, MoreHorizontal, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, RefreshCw, Activity, Zap, MousePointer2, Calendar, Eye, Trash2, XCircle } from "lucide-react";
import { Table, ZoruTableBody, ZoruTableCell, ZoruTableHead, ZoruTableHeader, ZoruTableRow } from "@/components/zoruui/table";
import { Button } from "@/components/zoruui/button";
import { Input } from "@/components/zoruui/input";
import { Badge } from "@/components/zoruui/badge";
import { Card, ZoruCardContent } from "@/components/zoruui/card";
import { Select, ZoruSelectTrigger, ZoruSelectValue, ZoruSelectContent, ZoruSelectItem } from "@/components/zoruui/select";
import { Checkbox } from "@/components/zoruui/checkbox";
import { DropdownMenu, ZoruDropdownMenuTrigger, ZoruDropdownMenuContent, ZoruDropdownMenuItem, ZoruDropdownMenuSeparator, ZoruDropdownMenuLabel } from "@/components/zoruui/dropdown-menu";
import { Avatar, ZoruAvatarFallback } from "@/components/zoruui/avatar";

type ExecutionTriggerMode = "webhook" | "schedule" | "manual" | "app_event";
type ExecutionStatus = "completed" | "running" | "failed" | "canceled";

interface ExecutionHistoryEntry {
  _id: string; // The API returns _id instead of id based on the mapExecutionDoc, wait no, let's just accept _id or id
  id?: string;
  flowId: string;
  triggerMode: ExecutionTriggerMode;
  startedAt: string;
  finishedAt?: string;
  status: ExecutionStatus;
  error?: string;
  nodeCount: number;
  executionTimeMs?: number;
}

const statuses = ["completed", "running", "failed", "canceled"] as const;

const getStatusTone = (status: string) => {
  switch (status.toLowerCase()) {
    case "completed": return "success";
    case "running": return "info";
    case "failed": return "danger";
    case "canceled": return "warning";
    default: return "neutral";
  }
};

const getStatusIcon = (status: string) => {
  switch (status.toLowerCase()) {
    case "completed": return <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />;
    case "running": return <Activity className="mr-1.5 h-3.5 w-3.5" />;
    case "failed": return <AlertCircle className="mr-1.5 h-3.5 w-3.5" />;
    case "canceled": return <XCircle className="mr-1.5 h-3.5 w-3.5" />;
    default: return <Clock className="mr-1.5 h-3.5 w-3.5" />;
  }
};

const getTriggerIcon = (trigger: string) => {
  switch (trigger?.toLowerCase()) {
    case "webhook": return <Zap className="h-4 w-4" />;
    case "schedule": return <Calendar className="h-4 w-4" />;
    case "manual": return <MousePointer2 className="h-4 w-4" />;
    case "app_event": return <Play className="h-4 w-4" />;
    default: return <Activity className="h-4 w-4" />;
  }
};

const queryClient = new QueryClient();

export default function ExecutionsPageWrapper() {
  return (
    <QueryClientProvider client={queryClient}>
      <ExecutionsPage />
    </QueryClientProvider>
  );
}

function ExecutionsPage() {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [rowSelection, setRowSelection] = useState({});

  // Fetch executions
  const { data, isLoading, refetch, isFetching } = useQuery<{ executions: ExecutionHistoryEntry[] }>({
    queryKey: ['flow-executions'],
    queryFn: async () => {
      const res = await fetch('/api/sabflow/executions?limit=100');
      if (!res.ok) throw new Error('Failed to fetch executions');
      return res.json();
    }
  });

  const executions = data?.executions || [];

  const columns = useMemo<ColumnDef<ExecutionHistoryEntry>[]>(
    () => [
      {
        id: "select",
        header: ({ table }) => (
          <Checkbox
            checked={table.getIsAllPageRowsSelected() || (table.getIsSomePageRowsSelected() ? "indeterminate" : false)}
            onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
            aria-label="Select all"
            className="translate-y-[2px]"
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(value) => row.toggleSelected(!!value)}
            aria-label="Select row"
            className="translate-y-[2px]"
          />
        ),
        enableSorting: false,
        enableHiding: false,
      },
      {
        accessorKey: "id",
        header: "Execution ID",
        cell: ({ row }) => {
          const id = (row.original.id || row.original._id) as string;
          return (
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs text-zoru-ink bg-zoru-surface-2 px-2 py-1 rounded-[var(--zoru-radius-sm)] border border-zoru-line">
                {id.slice(-8)}
              </span>
            </div>
          );
        },
      },
      {
        accessorKey: "flowId",
        header: "Flow ID",
        cell: ({ row }) => {
          const flowId = row.getValue("flowId") as string;
          return (
            <span className="font-semibold text-zoru-ink">{flowId}</span>
          );
        },
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => {
          const status = row.getValue("status") as string;
          return (
            <Badge tone={getStatusTone(status) as any} className="capitalize px-2.5 py-1 font-medium">
              {getStatusIcon(status)}
              {status}
            </Badge>
          );
        },
        filterFn: (row, id, value) => {
          return value.includes(row.getValue(id));
        },
      },
      {
        accessorKey: "triggerMode",
        header: "Trigger",
        cell: ({ row }) => {
          const trigger = row.getValue("triggerMode") as string;
          return (
            <div className="flex items-center gap-2 text-zoru-ink-muted">
              <div className="flex h-6 w-6 items-center justify-center rounded-md bg-zoru-surface border border-zoru-line">
                {getTriggerIcon(trigger)}
              </div>
              <span className="capitalize font-medium text-sm">{trigger?.replace('_', ' ') || 'Unknown'}</span>
            </div>
          );
        },
      },
      {
        accessorKey: "executionTimeMs",
        header: "Duration",
        cell: ({ row }) => {
          const ms = row.getValue("executionTimeMs") as number | undefined;
          if (ms === undefined) return <span className="text-zoru-ink-muted">-</span>;
          
          let display = `${ms}ms`;
          if (ms > 1000) display = `${(ms / 1000).toFixed(2)}s`;

          return <span className="font-medium text-zoru-ink">{display}</span>;
        },
      },
      {
        accessorKey: "nodeCount",
        header: "Steps",
        cell: ({ row }) => {
          const val = row.getValue("nodeCount") as number;
          return <span className="text-zoru-ink">{val || 0}</span>;
        },
      },
      {
        accessorKey: "startedAt",
        header: "Started At",
        cell: ({ row }) => {
          const date = new Date(row.getValue("startedAt") as string);
          return (
            <div className="flex flex-col text-xs text-zoru-ink-muted font-medium">
              <span>{fmtDate(date)}</span>
              <span>{formatUTC(date, true).split(", ")[1]}</span>
            </div>
          );
        },
      },
      {
        id: "actions",
        cell: ({ row }) => {
          const id = row.original.id || row.original._id;
          return (
            <DropdownMenu>
              <ZoruDropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-8 w-8 p-0 border-none shadow-none text-zoru-ink-muted hover:text-zoru-ink hover:bg-zoru-surface-2">
                  <span className="sr-only">Open menu</span>
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </ZoruDropdownMenuTrigger>
              <ZoruDropdownMenuContent align="end">
                <ZoruDropdownMenuLabel>Actions</ZoruDropdownMenuLabel>
                <ZoruDropdownMenuItem onClick={() => navigator.clipboard.writeText(id)}>
                  Copy Execution ID
                </ZoruDropdownMenuItem>
                <ZoruDropdownMenuSeparator />
                <ZoruDropdownMenuItem>
                  <Eye className="h-4 w-4 mr-2 text-zoru-ink-muted" />
                  View Details
                </ZoruDropdownMenuItem>
                <ZoruDropdownMenuItem>
                  <RefreshCw className="h-4 w-4 mr-2 text-zoru-ink-muted" />
                  Replay Execution
                </ZoruDropdownMenuItem>
                <ZoruDropdownMenuSeparator />
                <ZoruDropdownMenuItem className="text-zoru-danger-ink">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Record
                </ZoruDropdownMenuItem>
              </ZoruDropdownMenuContent>
            </DropdownMenu>
          );
        },
      },
    ],
    []
  );

  const table = useReactTable({
    data: executions,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onRowSelectionChange: setRowSelection,
    state: {
      sorting,
      columnFilters,
      rowSelection,
    },
    initialState: {
      pagination: {
        pageSize: 15,
      },
      sorting: [{ id: 'startedAt', desc: true }]
    },
  });

  return (
    <div className="flex flex-col min-h-screen bg-zoru-surface/30">
      {/* Header Area */}
      <div className="relative border-b border-zoru-line bg-zoru-bg overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-zoru-primary/5 to-transparent pointer-events-none" />
        
        <div className="relative mx-auto w-full max-w-[1600px] px-6 py-8 md:py-12">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-[var(--zoru-radius-lg)] bg-zoru-primary/10 text-zoru-primary ring-1 ring-zoru-primary/20">
                  <Activity className="h-5 w-5" />
                </div>
                <h1 className="text-3xl font-semibold tracking-tight text-zoru-ink">Flow Executions</h1>
              </div>
              <p className="max-w-2xl text-zoru-ink-muted text-lg mt-3">
                Review execution history for your automated workflows. Monitor performance, debug failures, and replay executions.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Button variant="outline" className="h-10 bg-zoru-bg" onClick={() => refetch()} disabled={isFetching}>
                <RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
                {isFetching ? 'Refreshing...' : 'Refresh'}
              </Button>
            </div>
          </div>

          {/* Quick Stats Banner */}
          <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="bg-zoru-bg/50 backdrop-blur-sm border-zoru-line shadow-[var(--zoru-shadow-sm)]">
              <ZoruCardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-zoru-ink-muted">Total Executions</p>
                  <p className="text-2xl font-bold mt-1 text-zoru-ink">{executions.length}</p>
                </div>
                <div className="h-10 w-10 rounded-full bg-zoru-surface flex items-center justify-center border border-zoru-line">
                  <Activity className="h-5 w-5 text-zoru-ink-muted" />
                </div>
              </ZoruCardContent>
            </Card>
            <Card className="bg-zoru-bg/50 backdrop-blur-sm border-zoru-line shadow-[var(--zoru-shadow-sm)]">
              <ZoruCardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-zoru-ink-muted">Success Rate</p>
                  <p className="text-2xl font-bold mt-1 text-zoru-success-ink">
                    {executions.length > 0 
                      ? Math.round((executions.filter(e => e.status === 'completed').length / executions.length) * 100) 
                      : 0}%
                  </p>
                </div>
                <div className="h-10 w-10 rounded-full bg-zoru-success/10 flex items-center justify-center border border-zoru-success/20">
                  <CheckCircle2 className="h-5 w-5 text-zoru-success-ink" />
                </div>
              </ZoruCardContent>
            </Card>
            <Card className="bg-zoru-bg/50 backdrop-blur-sm border-zoru-line shadow-[var(--zoru-shadow-sm)]">
              <ZoruCardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-zoru-ink-muted">Failed</p>
                  <p className="text-2xl font-bold mt-1 text-zoru-danger-ink">
                    {executions.filter(e => e.status === 'failed').length}
                  </p>
                </div>
                <div className="h-10 w-10 rounded-full bg-zoru-danger/10 flex items-center justify-center border border-zoru-danger/20">
                  <AlertCircle className="h-5 w-5 text-zoru-danger-ink" />
                </div>
              </ZoruCardContent>
            </Card>
            <Card className="bg-zoru-bg/50 backdrop-blur-sm border-zoru-line shadow-[var(--zoru-shadow-sm)]">
              <ZoruCardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-zoru-ink-muted">Avg Duration</p>
                  <p className="text-2xl font-bold mt-1 text-zoru-ink">
                    {executions.length > 0 
                      ? Math.round(executions.reduce((acc, curr) => acc + (curr.executionTimeMs || 0), 0) / executions.length) 
                      : 0}ms
                  </p>
                </div>
                <div className="h-10 w-10 rounded-full bg-zoru-surface flex items-center justify-center border border-zoru-line">
                  <Clock className="h-5 w-5 text-zoru-ink-muted" />
                </div>
              </ZoruCardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Main Table Area */}
      <div className="flex-1 p-6 mx-auto w-full max-w-[1600px] mb-20 -mt-6 z-10 relative">
        <div className="flex flex-col space-y-4">
          
          {/* Advanced Filters Toolbar */}
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 p-4 bg-zoru-bg rounded-[var(--zoru-radius-lg)] border border-zoru-line shadow-[var(--zoru-shadow-md)]">
            <div className="flex flex-1 items-center gap-3 w-full">
              <div className="relative max-w-sm w-full">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zoru-ink-muted" />
                <Input
                  placeholder="Filter by Flow ID..."
                  value={(table.getColumn("flowId")?.getFilterValue() as string) ?? ""}
                  onChange={(event) => table.getColumn("flowId")?.setFilterValue(event.target.value)}
                  className="pl-9 bg-zoru-surface/50 border-zoru-line-strong h-10 w-full"
                />
              </div>

              <Select
                value={(table.getColumn("status")?.getFilterValue() as string[])?.[0] ?? ""}
                onValueChange={(val) => {
                  if (val === "all") table.getColumn("status")?.setFilterValue(undefined);
                  else table.getColumn("status")?.setFilterValue([val]);
                }}
              >
                <ZoruSelectTrigger className="w-[160px] h-10 border-zoru-line-strong bg-zoru-surface/50">
                  <div className="flex items-center gap-2">
                    <Filter className="h-4 w-4" />
                    <span><ZoruSelectValue placeholder="Status" /></span>
                  </div>
                </ZoruSelectTrigger>
                <ZoruSelectContent>
                  <ZoruSelectItem value="all">All Statuses</ZoruSelectItem>
                  {statuses.map(s => (
                    <ZoruSelectItem key={s} value={s} className="capitalize">{s}</ZoruSelectItem>
                  ))}
                </ZoruSelectContent>
              </Select>

            </div>
          </div>

          {/* Table Container */}
          <div className="rounded-[var(--zoru-radius-lg)] border border-zoru-line bg-zoru-bg shadow-[var(--zoru-shadow-lg)] overflow-hidden">
            <Table className="border-0 shadow-none">
              <ZoruTableHeader className="bg-zoru-surface/60 border-b border-zoru-line">
                {table.getHeaderGroups().map((headerGroup) => (
                  <ZoruTableRow key={headerGroup.id} className="hover:bg-transparent border-0">
                    {headerGroup.headers.map((header) => {
                      return (
                        <ZoruTableHead key={header.id} className="h-12 px-4 whitespace-nowrap text-xs font-semibold text-zoru-ink-muted uppercase tracking-wider bg-transparent">
                          {header.isPlaceholder
                            ? null
                            : flexRender(
                                header.column.columnDef.header,
                                header.getContext()
                              )}
                        </ZoruTableHead>
                      );
                    })}
                  </ZoruTableRow>
                ))}
              </ZoruTableHeader>
              <ZoruTableBody>
                {isLoading ? (
                  <ZoruTableRow>
                    <ZoruTableCell colSpan={columns.length} className="h-32 text-center">
                      <div className="flex flex-col items-center justify-center text-zoru-ink-muted">
                        <RefreshCw className="h-8 w-8 mb-2 animate-spin opacity-50" />
                        <p>Loading executions...</p>
                      </div>
                    </ZoruTableCell>
                  </ZoruTableRow>
                ) : table.getRowModel().rows?.length ? (
                  table.getRowModel().rows.map((row) => (
                    <ZoruTableRow
                      key={row.id}
                      data-state={row.getIsSelected() && "selected"}
                      className="group hover:bg-zoru-surface/50 transition-colors duration-150"
                    >
                      {row.getVisibleCells().map((cell) => (
                        <ZoruTableCell key={cell.id} className="py-3 px-4">
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </ZoruTableCell>
                      ))}
                    </ZoruTableRow>
                  ))
                ) : (
                  <ZoruTableRow>
                    <ZoruTableCell colSpan={columns.length} className="h-32 text-center">
                      <div className="flex flex-col items-center justify-center text-zoru-ink-muted">
                        <Activity className="h-8 w-8 mb-2 opacity-20" />
                        <p>No executions found.</p>
                      </div>
                    </ZoruTableCell>
                  </ZoruTableRow>
                )}
              </ZoruTableBody>
            </Table>
          </div>

          {/* Pagination Component */}
          <div className="flex items-center justify-between px-2 pt-4">
            <div className="flex-1 text-sm font-medium text-zoru-ink-muted">
              {table.getFilteredSelectedRowModel().rows.length} of{" "}
              {table.getFilteredRowModel().rows.length} row(s) selected.
            </div>
            <div className="flex items-center gap-6 lg:gap-8">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-zoru-ink-muted">Rows per page</p>
                <Select
                  value={`${table.getState().pagination.pageSize}`}
                  onValueChange={(value) => {
                    table.setPageSize(Number(value));
                  }}
                >
                  <ZoruSelectTrigger className="h-8 w-[70px]">
                    <ZoruSelectValue placeholder={table.getState().pagination.pageSize} />
                  </ZoruSelectTrigger>
                  <ZoruSelectContent side="top">
                    {[10, 15, 20, 30, 40, 50].map((pageSize) => (
                      <ZoruSelectItem key={pageSize} value={`${pageSize}`}>
                        {pageSize}
                      </ZoruSelectItem>
                    ))}
                  </ZoruSelectContent>
                </Select>
              </div>
              <div className="flex w-[100px] items-center justify-center text-sm font-medium text-zoru-ink-muted">
                Page {table.getState().pagination.pageIndex + 1} of{" "}
                {table.getPageCount() || 1}
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  className="hidden h-8 w-8 p-0 lg:flex"
                  onClick={() => table.setPageIndex(0)}
                  disabled={!table.getCanPreviousPage()}
                >
                  <span className="sr-only">Go to first page</span>
                  <ChevronsLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  className="h-8 w-8 p-0"
                  onClick={() => table.previousPage()}
                  disabled={!table.getCanPreviousPage()}
                >
                  <span className="sr-only">Go to previous page</span>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  className="h-8 w-8 p-0"
                  onClick={() => table.nextPage()}
                  disabled={!table.getCanNextPage()}
                >
                  <span className="sr-only">Go to next page</span>
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  className="hidden h-8 w-8 p-0 lg:flex"
                  onClick={() => table.setPageIndex(table.getPageCount() - 1)}
                  disabled={!table.getCanNextPage()}
                >
                  <span className="sr-only">Go to last page</span>
                  <ChevronsRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
          
        </div>
      </div>
    </div>
  );
}
