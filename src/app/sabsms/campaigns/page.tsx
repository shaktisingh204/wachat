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
  RefreshCw,
} from "lucide-react";

import {
  Table,
  TBody,
  Td,
  Th,
  THead,
  Tr,
  Button,
  IconButton,
  Input,
  Field,
  Badge,
  type BadgeTone,
  Card,
  CardBody,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  Checkbox,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  Avatar,
  AvatarFallback,
  EmptyState,
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  PageDescription,
  PageActions,
} from "@/components/sabcrm/20ui";

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

// Helper for status colors (mapped to 20ui Badge tones).
const getStatusTone = (status: Campaign["status"]): BadgeTone => {
  switch (status) {
    case "Completed": return "success";
    case "Running": return "info";
    case "Paused": return "warning";
    case "Failed": return "danger";
    case "Scheduled": return "neutral";
    case "Draft": return "neutral";
    default: return "neutral";
  }
};

const getStatusIcon = (status: Campaign["status"]) => {
  switch (status) {
    case "Completed": return <CheckCircle2 className="mr-1 h-3 w-3" aria-hidden="true" />;
    case "Running": return <Play className="mr-1 h-3 w-3" aria-hidden="true" />;
    case "Paused": return <Pause className="mr-1 h-3 w-3" aria-hidden="true" />;
    case "Failed": return <AlertCircle className="mr-1 h-3 w-3" aria-hidden="true" />;
    case "Scheduled": return <Calendar className="mr-1 h-3 w-3" aria-hidden="true" />;
    case "Draft": return <Clock className="mr-1 h-3 w-3" aria-hidden="true" />;
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
            checked={table.getIsAllPageRowsSelected()}
            indeterminate={table.getIsSomePageRowsSelected() && !table.getIsAllPageRowsSelected()}
            onChange={(event) => table.toggleAllPageRowsSelected(event.target.checked)}
            aria-label="Select all"
            className="translate-y-[2px]"
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={row.getIsSelected()}
            onChange={(event) => row.toggleSelected(event.target.checked)}
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
                {tags.map((tag) => (
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
              <BarChart2 className="h-4 w-4 text-[var(--st-text-secondary)]" aria-hidden="true" />
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
                <AvatarFallback className="text-[10px]">{val[0]}</AvatarFallback>
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
              <DropdownMenuTrigger asChild>
                <IconButton label="Open menu" icon={MoreHorizontal} variant="ghost" size="sm" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => navigator.clipboard.writeText(row.original.id)}>
                  Copy campaign ID
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem>View analytics</DropdownMenuItem>
                <DropdownMenuItem>Duplicate campaign</DropdownMenuItem>
                {(status === "Running" || status === "Scheduled") && (
                  <DropdownMenuItem className="text-[var(--st-warn)]">
                    Pause campaign
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem variant="danger">
                  Delete campaign
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
    <div className="20ui flex flex-col min-h-screen bg-[var(--st-bg-secondary)]">
      {/* Header Area */}
      <div className="border-b border-[var(--st-border)] bg-[var(--st-bg)]">
        <div className="mx-auto w-full max-w-[1600px] px-6 py-8 md:py-12">
          <PageHeader bordered={false} className="pb-0">
            <PageHeaderHeading>
              <div className="flex items-center gap-3 mb-2">
                <span className="flex h-10 w-10 items-center justify-center rounded-[var(--st-radius-lg)] bg-[var(--st-accent-soft)] text-[var(--st-accent)] ring-1 ring-[var(--st-accent-ring)]">
                  <Mail className="h-5 w-5" aria-hidden="true" />
                </span>
                <PageTitle>Campaigns</PageTitle>
              </div>
              <PageDescription>
                Schedule, throttle, and observe outbound SMS campaigns. Pause, duplicate, or convert any campaign into a drip or reusable template.
              </PageDescription>
            </PageHeaderHeading>
            <PageActions>
              <Button variant="outline" iconLeft={Download}>
                Export
              </Button>
              <Button variant="primary" iconLeft={Plus}>
                New Campaign
              </Button>
            </PageActions>
          </PageHeader>

          {/* Quick Stats Banner */}
          <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardBody className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-[var(--st-text-secondary)]">Total Campaigns</p>
                  <p className="text-2xl font-bold mt-1 text-[var(--st-text)]">85</p>
                </div>
                <span className="h-10 w-10 rounded-full bg-[var(--st-bg-secondary)] flex items-center justify-center border border-[var(--st-border)]">
                  <Mail className="h-5 w-5 text-[var(--st-text-secondary)]" aria-hidden="true" />
                </span>
              </CardBody>
            </Card>
            <Card>
              <CardBody className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-[var(--st-text-secondary)]">Active Sending</p>
                  <p className="text-2xl font-bold mt-1 text-[var(--st-text)]">12</p>
                </div>
                <span className="h-10 w-10 rounded-full bg-[var(--st-bg-secondary)] flex items-center justify-center border border-[var(--st-border)]">
                  <Play className="h-5 w-5 text-[var(--st-text-secondary)]" aria-hidden="true" />
                </span>
              </CardBody>
            </Card>
            <Card>
              <CardBody className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-[var(--st-text-secondary)]">Total Sent (30d)</p>
                  <p className="text-2xl font-bold mt-1 text-[var(--st-text)]">1.2M</p>
                </div>
                <span className="h-10 w-10 rounded-full bg-[var(--st-bg-secondary)] flex items-center justify-center border border-[var(--st-border)]">
                  <ArrowRight className="h-5 w-5 text-[var(--st-text-secondary)]" aria-hidden="true" />
                </span>
              </CardBody>
            </Card>
            <Card>
              <CardBody className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-[var(--st-text-secondary)]">Avg Delivery</p>
                  <p className="text-2xl font-bold mt-1 text-[var(--st-status-ok)]">94.2%</p>
                </div>
                <span className="h-10 w-10 rounded-full bg-[var(--st-bg-secondary)] flex items-center justify-center border border-[var(--st-border)]">
                  <CheckCircle2 className="h-5 w-5 text-[var(--st-status-ok)]" aria-hidden="true" />
                </span>
              </CardBody>
            </Card>
          </div>
        </div>
      </div>

      {/* Main Table Area */}
      <div className="flex-1 p-6 mx-auto w-full max-w-[1600px] mb-20">
        <div className="flex flex-col space-y-4">

          {/* Advanced Filters Toolbar */}
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 p-4 bg-[var(--st-bg)] rounded-[var(--st-radius-lg)] border border-[var(--st-border)] shadow-[var(--st-shadow-md)]">
            <div className="flex flex-1 items-center gap-3 w-full">
              <Field className="max-w-sm w-full">
                <Input
                  iconLeft={Search}
                  placeholder="Filter campaigns..."
                  aria-label="Filter campaigns by name"
                  value={(table.getColumn("name")?.getFilterValue() as string) ?? ""}
                  onChange={(event) => table.getColumn("name")?.setFilterValue(event.target.value)}
                  className="w-full"
                />
              </Field>

              <Select
                value={(table.getColumn("status")?.getFilterValue() as string[])?.[0] ?? ""}
                onValueChange={(val) => {
                  if (val === "all") table.getColumn("status")?.setFilterValue(undefined);
                  else table.getColumn("status")?.setFilterValue([val]);
                }}
              >
                <SelectTrigger className="w-[160px]" aria-label="Filter by status">
                  <span className="flex items-center gap-2">
                    <Filter className="h-4 w-4" aria-hidden="true" />
                    <SelectValue placeholder="Status" />
                  </span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  {statuses.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <Button variant="ghost" iconLeft={RefreshCw}>
                Refresh
              </Button>
            </div>
          </div>

          {/* Table Container */}
          <div className="rounded-[var(--st-radius-lg)] border border-[var(--st-border)] bg-[var(--st-bg)] shadow-[var(--st-shadow-lg)] overflow-hidden">
            <Table hover>
              <THead>
                {table.getHeaderGroups().map((headerGroup) => (
                  <Tr key={headerGroup.id}>
                    {headerGroup.headers.map((header) => {
                      return (
                        <Th key={header.id} className="whitespace-nowrap uppercase tracking-wider">
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
                {table.getRowModel().rows?.length ? (
                  table.getRowModel().rows.map((row) => (
                    <Tr
                      key={row.id}
                      selected={row.getIsSelected()}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <Td key={cell.id}>
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </Td>
                      ))}
                    </Tr>
                  ))
                ) : (
                  <Tr>
                    <Td colSpan={columns.length} className="h-32 text-center">
                      <EmptyState
                        icon={Search}
                        title="No results"
                        description="No campaigns match your current filters. Try clearing the search or status filter."
                      />
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
                  <SelectTrigger className="w-[70px]" aria-label="Rows per page">
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
                {table.getPageCount()}
              </div>
              <div className="flex items-center gap-1">
                <IconButton
                  label="Go to first page"
                  icon={ChevronsLeft}
                  variant="outline"
                  size="sm"
                  className="hidden lg:flex"
                  onClick={() => table.setPageIndex(0)}
                  disabled={!table.getCanPreviousPage()}
                />
                <IconButton
                  label="Go to previous page"
                  icon={ChevronLeft}
                  variant="outline"
                  size="sm"
                  onClick={() => table.previousPage()}
                  disabled={!table.getCanPreviousPage()}
                />
                <IconButton
                  label="Go to next page"
                  icon={ChevronRight}
                  variant="outline"
                  size="sm"
                  onClick={() => table.nextPage()}
                  disabled={!table.getCanNextPage()}
                />
                <IconButton
                  label="Go to last page"
                  icon={ChevronsRight}
                  variant="outline"
                  size="sm"
                  className="hidden lg:flex"
                  onClick={() => table.setPageIndex(table.getPageCount() - 1)}
                  disabled={!table.getCanNextPage()}
                />
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
