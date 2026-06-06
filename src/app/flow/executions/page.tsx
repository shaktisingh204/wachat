"use client";

import React, { useState, useMemo } from "react";
import { useReactTable, getCoreRowModel, getFilteredRowModel, getPaginationRowModel, getSortedRowModel, flexRender, ColumnDef, SortingState, ColumnFiltersState } from "@tanstack/react-table";
import { useQuery, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fmtDate, formatUTC } from "@/lib/utils";
import { Search, Filter, Play, CheckCircle2, Clock, AlertCircle, MoreHorizontal, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, RefreshCw, Activity, Zap, MousePointer2, Calendar, Eye, Trash2, XCircle } from "lucide-react";
import { Table, TBody, Td, Th, THead, Tr } from '@/components/sabcrm/20ui/compat';
import { Button } from '@/components/sabcrm/20ui/compat';
import { Input } from '@/components/sabcrm/20ui/compat';
import { Badge } from '@/components/sabcrm/20ui/compat';
import { Card, CardBody } from '@/components/sabcrm/20ui/compat';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/sabcrm/20ui/compat';
import { Checkbox } from '@/components/sabcrm/20ui/compat';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuLabel } from '@/components/sabcrm/20ui/compat';
import { Avatar, AvatarFallback } from '@/components/sabcrm/20ui/compat';

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
              <span className="font-mono text-xs text-[var(--st-text)] bg-[var(--st-bg-muted)] px-2 py-1 rounded-[var(--st-radius-sm)] border border-[var(--st-border)]">
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
            <span className="font-semibold text-[var(--st-text)]">{flowId}</span>
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
            <div className="flex items-center gap-2 text-[var(--st-text-secondary)]">
              <div className="flex h-6 w-6 items-center justify-center rounded-md bg-[var(--st-bg-secondary)] border border-[var(--st-border)]">
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
          if (ms === undefined) return <span className="text-[var(--st-text-secondary)]">-</span>;
          
          let display = `${ms}ms`;
          if (ms > 1000) display = `${(ms / 1000).toFixed(2)}s`;

          return <span className="font-medium text-[var(--st-text)]">{display}</span>;
        },
      },
      {
        accessorKey: "nodeCount",
        header: "Steps",
        cell: ({ row }) => {
          const val = row.getValue("nodeCount") as number;
          return <span className="text-[var(--st-text)]">{val || 0}</span>;
        },
      },
      {
        accessorKey: "startedAt",
        header: "Started At",
        cell: ({ row }) => {
          const date = new Date(row.getValue("startedAt") as string);
          return (
            <div className="flex flex-col text-xs text-[var(--st-text-secondary)] font-medium">
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
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-8 w-8 p-0 border-none shadow-none text-[var(--st-text-secondary)] hover:text-[var(--st-text)] hover:bg-[var(--st-bg-muted)]">
                  <span className="sr-only">Open menu</span>
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => navigator.clipboard.writeText(id)}>
                  Copy Execution ID
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem>
                  <Eye className="h-4 w-4 mr-2 text-[var(--st-text-secondary)]" />
                  View Details
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <RefreshCw className="h-4 w-4 mr-2 text-[var(--st-text-secondary)]" />
                  Replay Execution
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-[var(--st-danger)]">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Record
                </DropdownMenuItem>
              </DropdownMenuContent>
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
    <div className="flex flex-col min-h-screen bg-[var(--st-bg-secondary)]/30">
      {/* Header Area */}
      <div className="relative border-b border-[var(--st-border)] bg-[var(--st-bg)] overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-[var(--st-text)]/5 to-transparent pointer-events-none" />
        
        <div className="relative mx-auto w-full max-w-[1600px] px-6 py-8 md:py-12">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-[var(--st-radius-lg)] bg-[var(--st-text)]/10 text-[var(--st-text)] ring-1 ring-[var(--st-text)]/20">
                  <Activity className="h-5 w-5" />
                </div>
                <h1 className="text-3xl font-semibold tracking-tight text-[var(--st-text)]">Flow Executions</h1>
              </div>
              <p className="max-w-2xl text-[var(--st-text-secondary)] text-lg mt-3">
                Review execution history for your automated workflows. Monitor performance, debug failures, and replay executions.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Button variant="outline" className="h-10 bg-[var(--st-bg)]" onClick={() => refetch()} disabled={isFetching}>
                <RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
                {isFetching ? 'Refreshing...' : 'Refresh'}
              </Button>
            </div>
          </div>

          {/* Quick Stats Banner */}
          <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="bg-[var(--st-bg)]/50 backdrop-blur-sm border-[var(--st-border)] shadow-[var(--st-shadow-sm)]">
              <CardBody className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-[var(--st-text-secondary)]">Total Executions</p>
                  <p className="text-2xl font-bold mt-1 text-[var(--st-text)]">{executions.length}</p>
                </div>
                <div className="h-10 w-10 rounded-full bg-[var(--st-bg-secondary)] flex items-center justify-center border border-[var(--st-border)]">
                  <Activity className="h-5 w-5 text-[var(--st-text-secondary)]" />
                </div>
              </CardBody>
            </Card>
            <Card className="bg-[var(--st-bg)]/50 backdrop-blur-sm border-[var(--st-border)] shadow-[var(--st-shadow-sm)]">
              <CardBody className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-[var(--st-text-secondary)]">Success Rate</p>
                  <p className="text-2xl font-bold mt-1 text-[var(--st-status-ok)]">
                    {executions.length > 0 
                      ? Math.round((executions.filter(e => e.status === 'completed').length / executions.length) * 100) 
                      : 0}%
                  </p>
                </div>
                <div className="h-10 w-10 rounded-full bg-[var(--st-status-ok)]/10 flex items-center justify-center border border-[var(--st-status-ok)]/20">
                  <CheckCircle2 className="h-5 w-5 text-[var(--st-status-ok)]" />
                </div>
              </CardBody>
            </Card>
            <Card className="bg-[var(--st-bg)]/50 backdrop-blur-sm border-[var(--st-border)] shadow-[var(--st-shadow-sm)]">
              <CardBody className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-[var(--st-text-secondary)]">Failed</p>
                  <p className="text-2xl font-bold mt-1 text-[var(--st-danger)]">
                    {executions.filter(e => e.status === 'failed').length}
                  </p>
                </div>
                <div className="h-10 w-10 rounded-full bg-[var(--st-danger)]/10 flex items-center justify-center border border-[var(--st-danger)]/20">
                  <AlertCircle className="h-5 w-5 text-[var(--st-danger)]" />
                </div>
              </CardBody>
            </Card>
            <Card className="bg-[var(--st-bg)]/50 backdrop-blur-sm border-[var(--st-border)] shadow-[var(--st-shadow-sm)]">
              <CardBody className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-[var(--st-text-secondary)]">Avg Duration</p>
                  <p className="text-2xl font-bold mt-1 text-[var(--st-text)]">
                    {executions.length > 0 
                      ? Math.round(executions.reduce((acc, curr) => acc + (curr.executionTimeMs || 0), 0) / executions.length) 
                      : 0}ms
                  </p>
                </div>
                <div className="h-10 w-10 rounded-full bg-[var(--st-bg-secondary)] flex items-center justify-center border border-[var(--st-border)]">
                  <Clock className="h-5 w-5 text-[var(--st-text-secondary)]" />
                </div>
              </CardBody>
            </Card>
          </div>
        </div>
      </div>

      {/* Main Table Area */}
      <div className="flex-1 p-6 mx-auto w-full max-w-[1600px] mb-20 -mt-6 z-10 relative">
        <div className="flex flex-col space-y-4">
          
          {/* Advanced Filters Toolbar */}
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 p-4 bg-[var(--st-bg)] rounded-[var(--st-radius-lg)] border border-[var(--st-border)] shadow-[var(--st-shadow-md)]">
            <div className="flex flex-1 items-center gap-3 w-full">
              <div className="relative max-w-sm w-full">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--st-text-secondary)]" />
                <Input
                  placeholder="Filter by Flow ID..."
                  value={(table.getColumn("flowId")?.getFilterValue() as string) ?? ""}
                  onChange={(event) => table.getColumn("flowId")?.setFilterValue(event.target.value)}
                  className="pl-9 bg-[var(--st-bg-secondary)]/50 border-[var(--st-border-strong)] h-10 w-full"
                />
              </div>

              <Select
                value={(table.getColumn("status")?.getFilterValue() as string[])?.[0] ?? ""}
                onValueChange={(val) => {
                  if (val === "all") table.getColumn("status")?.setFilterValue(undefined);
                  else table.getColumn("status")?.setFilterValue([val]);
                }}
              >
                <SelectTrigger className="w-[160px] h-10 border-[var(--st-border-strong)] bg-[var(--st-bg-secondary)]/50">
                  <div className="flex items-center gap-2">
                    <Filter className="h-4 w-4" />
                    <span><SelectValue placeholder="Status" /></span>
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  {statuses.map(s => (
                    <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

            </div>
          </div>

          {/* Table Container */}
          <div className="rounded-[var(--st-radius-lg)] border border-[var(--st-border)] bg-[var(--st-bg)] shadow-[var(--st-shadow-lg)] overflow-hidden">
            <Table className="border-0 shadow-none">
              <THead className="bg-[var(--st-bg-secondary)]/60 border-b border-[var(--st-border)]">
                {table.getHeaderGroups().map((headerGroup) => (
                  <Tr key={headerGroup.id} className="hover:bg-transparent border-0">
                    {headerGroup.headers.map((header) => {
                      return (
                        <Th key={header.id} className="h-12 px-4 whitespace-nowrap text-xs font-semibold text-[var(--st-text-secondary)] uppercase tracking-wider bg-transparent">
                          {header.isPlaceholder
                            ? null
                            : flexRender(
                                header.column.columnDef.header,
                                header.getContext()
                              )}
                        </Th>
                      );
                    })}
                  </Tr>
                ))}
              </THead>
              <TBody>
                {isLoading ? (
                  <Tr>
                    <Td colSpan={columns.length} className="h-32 text-center">
                      <div className="flex flex-col items-center justify-center text-[var(--st-text-secondary)]">
                        <RefreshCw className="h-8 w-8 mb-2 animate-spin opacity-50" />
                        <p>Loading executions...</p>
                      </div>
                    </Td>
                  </Tr>
                ) : table.getRowModel().rows?.length ? (
                  table.getRowModel().rows.map((row) => (
                    <Tr
                      key={row.id}
                      data-state={row.getIsSelected() && "selected"}
                      className="group hover:bg-[var(--st-bg-secondary)]/50 transition-colors duration-150"
                    >
                      {row.getVisibleCells().map((cell) => (
                        <Td key={cell.id} className="py-3 px-4">
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </Td>
                      ))}
                    </Tr>
                  ))
                ) : (
                  <Tr>
                    <Td colSpan={columns.length} className="h-32 text-center">
                      <div className="flex flex-col items-center justify-center text-[var(--st-text-secondary)]">
                        <Activity className="h-8 w-8 mb-2 opacity-20" />
                        <p>No executions found.</p>
                      </div>
                    </Td>
                  </Tr>
                )}
              </TBody>
            </Table>
          </div>

          {/* Pagination Component */}
          <div className="flex items-center justify-between px-2 pt-4">
            <div className="flex-1 text-sm font-medium text-[var(--st-text-secondary)]">
              {table.getFilteredSelectedRowModel().rows.length} of{" "}
              {table.getFilteredRowModel().rows.length} row(s) selected.
            </div>
            <div className="flex items-center gap-6 lg:gap-8">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-[var(--st-text-secondary)]">Rows per page</p>
                <Select
                  value={`${table.getState().pagination.pageSize}`}
                  onValueChange={(value) => {
                    table.setPageSize(Number(value));
                  }}
                >
                  <SelectTrigger className="h-8 w-[70px]">
                    <SelectValue placeholder={table.getState().pagination.pageSize} />
                  </SelectTrigger>
                  <SelectContent side="top">
                    {[10, 15, 20, 30, 40, 50].map((pageSize) => (
                      <SelectItem key={pageSize} value={`${pageSize}`}>
                        {pageSize}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex w-[100px] items-center justify-center text-sm font-medium text-[var(--st-text-secondary)]">
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
