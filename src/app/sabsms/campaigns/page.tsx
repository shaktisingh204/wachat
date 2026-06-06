"use client";

import React, { useState, useMemo } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  flexRender,
  ColumnDef,
  SortingState,
  ColumnFiltersState,
} from "@tanstack/react-table";
import { fmtDate, formatUTC } from "@/lib/utils";
import {
  Search,
  Filter,
  Play,
  Pause,
  ArrowRight,
  BarChart2,
  Calendar,
  CheckCircle2,
  Clock,
  AlertCircle,
  Mail,
  MoreHorizontal,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Download,
  Plus,
  RefreshCw
} from "lucide-react";

import {
  Table,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
} from "@/components/zoruui/table";

import { Button } from "@/components/zoruui/button";
import { Input } from "@/components/zoruui/input";
import { Badge } from "@/components/zoruui/badge";
import { Card, ZoruCardContent } from "@/components/zoruui/card";
import { Select, ZoruSelectTrigger, ZoruSelectValue, ZoruSelectContent, ZoruSelectItem } from "@/components/zoruui/select";
import { Checkbox } from "@/components/zoruui/checkbox";
import {
  DropdownMenu,
  ZoruDropdownMenuTrigger,
  ZoruDropdownMenuContent,
  ZoruDropdownMenuItem,
  ZoruDropdownMenuSeparator,
  ZoruDropdownMenuLabel
} from "@/components/zoruui/dropdown-menu";
import { Avatar, ZoruAvatarFallback } from "@/components/zoruui/avatar";

type Campaign = {
  id: string;
  name: string;
  status: "Draft" | "Scheduled" | "Running" | "Paused" | "Completed" | "Failed";
  sent: number;
  delivered: number;
  clickRate: number;
  createdAt: string;
  creator: string;
  tags: string[];
};

const statuses = ["Draft", "Scheduled", "Running", "Paused", "Completed", "Failed"] as const;
const tagsPool = ["Promo", "Alert", "Newsletter", "Winback", "Seasonal", "VIP"];

const mockData: Campaign[] = Array.from({ length: 85 }, (_, i) => {
  const status = statuses[Math.floor(Math.random() * statuses.length)];
  const sent = status === "Draft" || status === "Scheduled" ? 0 : Math.floor(Math.random() * 50000) + 1000;
  const delivered = Math.floor(sent * (0.8 + Math.random() * 0.18)); 
  const clickRate = status === "Draft" || status === "Scheduled" ? 0 : Math.random() * 15;

  const date = new Date();
  date.setDate(date.getDate() - Math.floor(Math.random() * 60));

  const tagCount = Math.floor(Math.random() * 3) + 1;
  const tags = [...tagsPool].sort(() => 0.5 - Math.random()).slice(0, tagCount);

  return {
    id: `camp_${Math.random().toString(36).substr(2, 9)}`,
    name: `Campaign ${i + 1} - ${tags[0]}`,
    status,
    sent,
    delivered,
    clickRate: parseFloat(clickRate.toFixed(2)),
    createdAt: date.toISOString(),
    creator: ["Alice", "Bob", "Charlie", "Diana"][Math.floor(Math.random() * 4)],
    tags,
  };
});

// Helper for status colors
const getStatusTone = (status: Campaign["status"]) => {
  switch (status) {
    case "Completed": return "green";
    case "Running": return "blue";
    case "Paused": return "amber";
    case "Failed": return "red";
    case "Scheduled": return "neutral";
    case "Draft": return "obsidian";
    default: return "neutral";
  }
};

const getStatusIcon = (status: Campaign["status"]) => {
  switch (status) {
    case "Completed": return <CheckCircle2 className="mr-1 h-3 w-3" />;
    case "Running": return <Play className="mr-1 h-3 w-3" />;
    case "Paused": return <Pause className="mr-1 h-3 w-3" />;
    case "Failed": return <AlertCircle className="mr-1 h-3 w-3" />;
    case "Scheduled": return <Calendar className="mr-1 h-3 w-3" />;
    case "Draft": return <Clock className="mr-1 h-3 w-3" />;
    default: return null;
  }
};

export default function CampaignsPage() {
  const [data] = useState<Campaign[]>(mockData);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [rowSelection, setRowSelection] = useState({});

  const columns = useMemo<ColumnDef<Campaign>[]>(
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
        accessorKey: "name",
        header: "Campaign Name",
        cell: ({ row }) => {
          const name = row.getValue("name") as string;
          const tags = row.original.tags;
          return (
            <div className="flex flex-col gap-1">
              <span className="font-semibold text-[var(--st-text)]">{name}</span>
              <div className="flex gap-1">
                {tags.map(tag => (
                  <Badge key={tag} tone="neutral" className="text-[10px] px-1.5 py-0 leading-none h-4">
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          );
        },
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => {
          const status = row.getValue("status") as Campaign["status"];
          return (
            <Badge tone={getStatusTone(status)} className="capitalize px-2 py-0.5">
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
        accessorKey: "sent",
        header: "Sent",
        cell: ({ row }) => {
          const val = row.getValue("sent") as number;
          return <span className="font-medium text-[var(--st-text)]">{val.toLocaleString()}</span>;
        },
      },
      {
        accessorKey: "delivered",
        header: "Delivered",
        cell: ({ row }) => {
          const val = row.getValue("delivered") as number;
          const sent = row.original.sent;
          const percent = sent > 0 ? Math.round((val / sent) * 100) : 0;
          return (
            <div className="flex flex-col gap-1.5 w-full max-w-[120px]">
              <div className="flex items-center justify-between text-xs font-medium">
                <span className="text-[var(--st-text)]">{val.toLocaleString()}</span>
                <span className="text-[var(--st-text-secondary)]">{percent}%</span>
              </div>
              <div className="h-1.5 w-full bg-[var(--st-bg-muted)] rounded-full overflow-hidden border border-[var(--st-border)]">
                <div 
                  className="h-full bg-[var(--st-text)] transition-all" 
                  style={{ width: `${percent}%` }}
                />
              </div>
            </div>
          );
        },
      },
      {
        accessorKey: "clickRate",
        header: "Click Rate",
        cell: ({ row }) => {
          const val = row.getValue("clickRate") as number;
          return (
            <div className="flex items-center gap-2 text-[var(--st-text)]">
              <BarChart2 className="h-4 w-4 text-[var(--st-text-secondary)]" />
              <span className="font-medium">{val}%</span>
            </div>
          );
        },
      },
      {
        accessorKey: "creator",
        header: "Creator",
        cell: ({ row }) => {
          const val = row.getValue("creator") as string;
          return (
            <div className="flex items-center gap-2">
              <Avatar className="h-6 w-6">
                <ZoruAvatarFallback className="text-[10px]">{val[0]}</ZoruAvatarFallback>
              </Avatar>
              <span className="text-sm text-[var(--st-text)] font-medium">{val}</span>
            </div>
          );
        },
      },
      {
        accessorKey: "createdAt",
        header: "Created At",
        cell: ({ row }) => {
          const date = new Date(row.getValue("createdAt") as string);
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
          const status = row.original.status;
          return (
            <DropdownMenu>
              <ZoruDropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-8 w-8 p-0 border-none shadow-none text-[var(--st-text-secondary)] hover:text-[var(--st-text)] hover:bg-[var(--st-bg-muted)]">
                  <span className="sr-only">Open menu</span>
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </ZoruDropdownMenuTrigger>
              <ZoruDropdownMenuContent align="end">
                <ZoruDropdownMenuLabel>Actions</ZoruDropdownMenuLabel>
                <ZoruDropdownMenuItem onClick={() => navigator.clipboard.writeText(row.original.id)}>
                  Copy campaign ID
                </ZoruDropdownMenuItem>
                <ZoruDropdownMenuSeparator />
                <ZoruDropdownMenuItem>View analytics</ZoruDropdownMenuItem>
                <ZoruDropdownMenuItem>Duplicate campaign</ZoruDropdownMenuItem>
                {(status === "Running" || status === "Scheduled") && (
                  <ZoruDropdownMenuItem className="text-[var(--st-warn)]">
                    Pause campaign
                  </ZoruDropdownMenuItem>
                )}
                <ZoruDropdownMenuItem className="text-[var(--st-danger)]">
                  Delete campaign
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
    data,
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
    },
  });

  return (
    <div className="flex flex-col min-h-screen bg-[var(--st-bg-secondary)]/30">
      {/* Header Area */}
      <div className="relative border-b border-[var(--st-border)] bg-[var(--st-bg)] overflow-hidden">
        {/* Subtle background decoration */}
        <div className="absolute inset-0 bg-gradient-to-r from-[var(--st-text)]/5 to-transparent pointer-events-none" />
        
        <div className="relative mx-auto w-full max-w-[1600px] px-6 py-8 md:py-12">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-[var(--zoru-radius-lg)] bg-[var(--st-text)]/10 text-[var(--st-text)] ring-1 ring-[var(--st-text)]/20">
                  <Mail className="h-5 w-5" />
                </div>
                <h1 className="text-3xl font-semibold tracking-tight text-[var(--st-text)]">Campaigns</h1>
              </div>
              <p className="max-w-2xl text-[var(--st-text-secondary)] text-lg mt-3">
                Schedule, throttle, and observe outbound SMS campaigns. Pause, duplicate, or convert any campaign into a drip or reusable template.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Button variant="outline" className="h-10 bg-[var(--st-bg)]">
                <Download className="mr-2 h-4 w-4" />
                Export
              </Button>
              <Button variant="primary" className="h-10">
                <Plus className="mr-2 h-4 w-4" />
                New Campaign
              </Button>
            </div>
          </div>

          {/* Quick Stats Banner */}
          <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="bg-[var(--st-bg)]/50 backdrop-blur-sm border-[var(--st-border)] shadow-[var(--zoru-shadow-sm)]">
              <ZoruCardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-[var(--st-text-secondary)]">Total Campaigns</p>
                  <p className="text-2xl font-bold mt-1 text-[var(--st-text)]">85</p>
                </div>
                <div className="h-10 w-10 rounded-full bg-[var(--st-bg-secondary)] flex items-center justify-center border border-[var(--st-border)]">
                  <Mail className="h-5 w-5 text-[var(--st-text-secondary)]" />
                </div>
              </ZoruCardContent>
            </Card>
            <Card className="bg-[var(--st-bg)]/50 backdrop-blur-sm border-[var(--st-border)] shadow-[var(--zoru-shadow-sm)]">
              <ZoruCardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-[var(--st-text-secondary)]">Active Sending</p>
                  <p className="text-2xl font-bold mt-1 text-[var(--st-text-secondary)]">12</p>
                </div>
                <div className="h-10 w-10 rounded-full bg-[var(--st-text-secondary)]/10 flex items-center justify-center border border-[var(--st-text-secondary)]/20">
                  <Play className="h-5 w-5 text-[var(--st-text-secondary)]" />
                </div>
              </ZoruCardContent>
            </Card>
            <Card className="bg-[var(--st-bg)]/50 backdrop-blur-sm border-[var(--st-border)] shadow-[var(--zoru-shadow-sm)]">
              <ZoruCardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-[var(--st-text-secondary)]">Total Sent (30d)</p>
                  <p className="text-2xl font-bold mt-1 text-[var(--st-text)]">1.2M</p>
                </div>
                <div className="h-10 w-10 rounded-full bg-[var(--st-bg-secondary)] flex items-center justify-center border border-[var(--st-border)]">
                  <ArrowRight className="h-5 w-5 text-[var(--st-text-secondary)]" />
                </div>
              </ZoruCardContent>
            </Card>
            <Card className="bg-[var(--st-bg)]/50 backdrop-blur-sm border-[var(--st-border)] shadow-[var(--zoru-shadow-sm)]">
              <ZoruCardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-[var(--st-text-secondary)]">Avg Delivery</p>
                  <p className="text-2xl font-bold mt-1 text-[var(--st-status-ok)]">94.2%</p>
                </div>
                <div className="h-10 w-10 rounded-full bg-[var(--st-status-ok)]/10 flex items-center justify-center border border-[var(--st-status-ok)]/20">
                  <CheckCircle2 className="h-5 w-5 text-[var(--st-status-ok)]" />
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
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 p-4 bg-[var(--st-bg)] rounded-[var(--zoru-radius-lg)] border border-[var(--st-border)] shadow-[var(--zoru-shadow-md)]">
            <div className="flex flex-1 items-center gap-3 w-full">
              <div className="relative max-w-sm w-full">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--st-text-secondary)]" />
                <Input
                  placeholder="Filter campaigns..."
                  value={(table.getColumn("name")?.getFilterValue() as string) ?? ""}
                  onChange={(event) => table.getColumn("name")?.setFilterValue(event.target.value)}
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
                <ZoruSelectTrigger className="w-[160px] h-10 border-[var(--st-border-strong)] bg-[var(--st-bg-secondary)]/50">
                  <div className="flex items-center gap-2">
                    <Filter className="h-4 w-4" />
                    <span><ZoruSelectValue placeholder="Status" /></span>
                  </div>
                </ZoruSelectTrigger>
                <ZoruSelectContent>
                  <ZoruSelectItem value="all">All Statuses</ZoruSelectItem>
                  {statuses.map(s => (
                    <ZoruSelectItem key={s} value={s}>{s}</ZoruSelectItem>
                  ))}
                </ZoruSelectContent>
              </Select>

            </div>
            
            <div className="flex items-center gap-2">
              <Button variant="ghost" className="h-10 text-[var(--st-text-secondary)] hover:text-[var(--st-text)]">
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
            </div>
          </div>

          {/* Table Container */}
          <div className="rounded-[var(--zoru-radius-lg)] border border-[var(--st-border)] bg-[var(--st-bg)] shadow-[var(--zoru-shadow-lg)] overflow-hidden">
            <Table className="border-0 shadow-none">
              <ZoruTableHeader className="bg-[var(--st-bg-secondary)]/60 border-b border-[var(--st-border)]">
                {table.getHeaderGroups().map((headerGroup) => (
                  <ZoruTableRow key={headerGroup.id} className="hover:bg-transparent border-0">
                    {headerGroup.headers.map((header) => {
                      return (
                        <ZoruTableHead key={header.id} className="h-12 px-4 whitespace-nowrap text-xs font-semibold text-[var(--st-text-secondary)] uppercase tracking-wider bg-transparent">
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
                {table.getRowModel().rows?.length ? (
                  table.getRowModel().rows.map((row) => (
                    <ZoruTableRow
                      key={row.id}
                      data-state={row.getIsSelected() && "selected"}
                      className="group hover:bg-[var(--st-bg-secondary)]/50 transition-colors duration-150"
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
                      <div className="flex flex-col items-center justify-center text-[var(--st-text-secondary)]">
                        <Search className="h-8 w-8 mb-2 opacity-20" />
                        <p>No results.</p>
                      </div>
                    </ZoruTableCell>
                  </ZoruTableRow>
                )}
              </ZoruTableBody>
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
              <div className="flex w-[100px] items-center justify-center text-sm font-medium text-[var(--st-text-secondary)]">
                Page {table.getState().pagination.pageIndex + 1} of{" "}
                {table.getPageCount()}
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
