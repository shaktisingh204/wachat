"use client";

import React from "react";
import { Plus, Gift, CreditCard, Clock, MoreHorizontal, Eye, Copy, RefreshCw, Download } from "lucide-react";

import {
  PageHeader,
  ZoruPageHeading,
  ZoruPageTitle,
  ZoruPageDescription,
  ZoruPageActions,
  Button,
  StatCard,
  DataTable,
  Badge,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  Card,
} from "@/components/sabcrm/20ui/zoru";

const giftCardData = [
  {
    id: "gc_001",
    code: "•••• •••• •••• 4A92",
    customer: "Alice Johnson",
    initialBalance: "$100.00",
    currentBalance: "$45.50",
    status: "Active",
    issueDate: "2026-05-20",
    expiryDate: "2027-05-20",
  },
  {
    id: "gc_002",
    code: "•••• •••• •••• 8B3F",
    customer: "Mark Smith",
    initialBalance: "$50.00",
    currentBalance: "$0.00",
    status: "Redeemed",
    issueDate: "2026-04-15",
    expiryDate: "2027-04-15",
  },
  {
    id: "gc_003",
    code: "•••• •••• •••• 1C77",
    customer: "-",
    initialBalance: "$200.00",
    currentBalance: "$200.00",
    status: "Active",
    issueDate: "2026-06-01",
    expiryDate: "2027-06-01",
  },
  {
    id: "gc_004",
    code: "•••• •••• •••• 9D21",
    customer: "Emily Davis",
    initialBalance: "$25.00",
    currentBalance: "$25.00",
    status: "Expired",
    issueDate: "2025-05-01",
    expiryDate: "2026-05-01",
  },
  {
    id: "gc_005",
    code: "•••• •••• •••• 5E44",
    customer: "John Doe",
    initialBalance: "$150.00",
    currentBalance: "$120.00",
    status: "Active",
    issueDate: "2026-06-03",
    expiryDate: "2027-06-03",
  },
];

export default function GiftCardsPage({ params }: { params: { storefrontId: string } }) {
  const giftCardColumns = [
    {
      accessorKey: "code",
      header: "Gift Card Code",
      cell: ({ row }: any) => (
        <div className="flex items-center gap-2">
          <Gift className="h-4 w-4 text-[var(--st-text-secondary)]" />
          <span className="font-medium font-mono">{row.original.code}</span>
        </div>
      ),
    },
    {
      accessorKey: "customer",
      header: "Customer",
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }: any) => (
        <Badge
          variant={
            row.original.status === "Active"
              ? "success"
              : row.original.status === "Redeemed"
              ? "default"
              : "outline"
          }
        >
          {row.original.status}
        </Badge>
      ),
    },
    {
      accessorKey: "currentBalance",
      header: "Current Balance",
      cell: ({ row }: any) => (
        <span className="font-semibold">{row.original.currentBalance}</span>
      ),
    },
    {
      accessorKey: "initialBalance",
      header: "Initial Balance",
      cell: ({ row }: any) => (
        <span className="text-[var(--st-text-secondary)]">{row.original.initialBalance}</span>
      ),
    },
    {
      accessorKey: "issueDate",
      header: "Issue Date",
    },
    {
      id: "actions",
      cell: ({ row }: any) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem>
              <Eye className="mr-2 h-4 w-4" />
              View Details
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Copy className="mr-2 h-4 w-4" />
              Copy Code
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <RefreshCw className="mr-2 h-4 w-4" />
              Resend to Customer
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6 p-6 md:p-8 w-full max-w-7xl mx-auto">
      <PageHeader>
        <ZoruPageHeading>
          <ZoruPageTitle>Gift Cards</ZoruPageTitle>
          <ZoruPageDescription>
            Issue and track gift cards. Monitor current balances and redemptions.
          </ZoruPageDescription>
        </ZoruPageHeading>
        <ZoruPageActions>
          <Button variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Issue gift card
          </Button>
        </ZoruPageActions>
      </PageHeader>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          label="Total Issued (Value)"
          value="$5,250.00"
          delta={8.2}
          period="vs last month"
          icon={<CreditCard className="h-4 w-4" />}
        />
        <StatCard
          label="Outstanding Balance"
          value="$3,145.50"
          delta={2.4}
          period="vs last month"
          icon={<Clock className="h-4 w-4" />}
        />
        <StatCard
          label="Active Gift Cards"
          value="48"
          delta={5.0}
          period="vs last month"
          icon={<Gift className="h-4 w-4" />}
        />
      </div>

      <div className="mt-4 rounded-xl border border-[var(--st-border)] bg-[var(--st-bg)]">
        <div className="p-4 border-b border-[var(--st-border)] flex items-center justify-between">
          <h3 className="font-semibold">All Gift Cards</h3>
        </div>
        <DataTable
          columns={giftCardColumns}
          data={giftCardData}
          filterColumn="code"
          filterPlaceholder="Search by gift card code..."
        />
      </div>
    </div>
  );
}
