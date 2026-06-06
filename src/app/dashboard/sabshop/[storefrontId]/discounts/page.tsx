"use client";

import React, { useState } from "react";
import { Plus, Tag, Ticket, Activity, MoreHorizontal, Copy, Trash2, Edit3, ArrowUpRight, ArrowDownRight } from "lucide-react";

import { PageHeader, PageHeading, PageTitle, PageDescription, PageActions, Button, StatCard, DataTable, Badge, DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/sabcrm/20ui/compat';

const discountData = [
  {
    id: "d_001",
    code: "SUMMER2026",
    type: "Percentage",
    value: "20%",
    status: "Active",
    usage: "145 / 500",
    createdAt: "2026-05-10",
  },
  {
    id: "d_002",
    code: "WELCOME10",
    type: "Fixed Amount",
    value: "$10.00",
    status: "Active",
    usage: "89 / ∞",
    createdAt: "2026-05-15",
  },
  {
    id: "d_003",
    code: "FREESHIP",
    type: "Free Shipping",
    value: "Shipping",
    status: "Expired",
    usage: "210 / 210",
    createdAt: "2026-04-01",
  },
  {
    id: "d_004",
    code: "VIP50",
    type: "Percentage",
    value: "50%",
    status: "Active",
    usage: "12 / 50",
    createdAt: "2026-06-01",
  },
];

const automaticDiscountData = [
  {
    id: "ad_001",
    title: "Buy 2 Get 1 Free",
    status: "Active",
    usage: "340",
    createdAt: "2026-05-01",
  },
  {
    id: "ad_002",
    title: "15% off orders over $100",
    status: "Active",
    usage: "1,204",
    createdAt: "2026-03-12",
  },
  {
    id: "ad_003",
    title: "Free Gift with Purchase",
    status: "Scheduled",
    usage: "0",
    createdAt: "2026-06-02",
  },
];

export default function DiscountsPage({ params }: { params: { storefrontId: string } }) {
  const [activeTab, setActiveTab] = useState("codes");

  const discountColumns = [
    {
      accessorKey: "code",
      header: "Discount Code",
      cell: ({ row }: any) => (
        <div className="flex items-center gap-2">
          <Ticket className="h-4 w-4 text-[var(--st-text-secondary)]" />
          <span className="font-medium">{row.original.code}</span>
        </div>
      ),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }: any) => (
        <Badge
          variant={
            row.original.status === "Active"
              ? "success"
              : row.original.status === "Expired"
              ? "danger"
              : "outline"
          }
        >
          {row.original.status}
        </Badge>
      ),
    },
    {
      accessorKey: "type",
      header: "Type",
    },
    {
      accessorKey: "value",
      header: "Value",
    },
    {
      accessorKey: "usage",
      header: "Usage",
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
              <Copy className="mr-2 h-4 w-4" />
              Copy Code
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Edit3 className="mr-2 h-4 w-4" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-[var(--st-danger)]">
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  const automaticColumns = [
    {
      accessorKey: "title",
      header: "Title",
      cell: ({ row }: any) => (
        <div className="flex items-center gap-2">
          <Tag className="h-4 w-4 text-[var(--st-text-secondary)]" />
          <span className="font-medium">{row.original.title}</span>
        </div>
      ),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }: any) => (
        <Badge
          variant={
            row.original.status === "Active"
              ? "success"
              : row.original.status === "Scheduled"
              ? "warning"
              : "outline"
          }
        >
          {row.original.status}
        </Badge>
      ),
    },
    {
      accessorKey: "usage",
      header: "Usage count",
    },
    {
      accessorKey: "createdAt",
      header: "Created",
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
              <Edit3 className="mr-2 h-4 w-4" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-[var(--st-danger)]">
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6 p-6 md:p-8 w-full max-w-7xl mx-auto">
      <PageHeader>
        <PageHeading>
          <PageTitle>Discounts</PageTitle>
          <PageDescription>
            Manage discount codes and automatic discounts for your store.
          </PageDescription>
        </PageHeading>
        <PageActions>
          <Button variant="outline">Export</Button>
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Create discount
          </Button>
        </PageActions>
      </PageHeader>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          label="Total Redemptions"
          value="1,544"
          delta={12.5}
          period="vs last month"
          icon={<Activity className="h-4 w-4" />}
        />
        <StatCard
          label="Discount Revenue"
          value="$12,450.00"
          delta={5.2}
          period="vs last month"
          icon={<ArrowUpRight className="h-4 w-4" />}
        />
        <StatCard
          label="Active Campaigns"
          value="4"
          delta={-1}
          period="vs last month"
          icon={<Tag className="h-4 w-4" />}
          invertDelta
        />
      </div>

      <div className="mt-4">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="codes">Discount Codes</TabsTrigger>
            <TabsTrigger value="automatic">Automatic Discounts</TabsTrigger>
          </TabsList>
          <TabsContent value="codes" className="w-full">
            <div className="rounded-xl border border-[var(--st-border)] bg-[var(--st-bg)]">
              <div className="p-4 border-b border-[var(--st-border)] flex items-center justify-between">
                <h3 className="font-semibold">Active & Expired Codes</h3>
              </div>
              <DataTable
                columns={discountColumns}
                data={discountData}
                filterColumn="code"
                filterPlaceholder="Search discount codes..."
              />
            </div>
          </TabsContent>
          <TabsContent value="automatic" className="w-full">
            <div className="rounded-xl border border-[var(--st-border)] bg-[var(--st-bg)]">
              <div className="p-4 border-b border-[var(--st-border)] flex items-center justify-between">
                <h3 className="font-semibold">Automatic Discounts</h3>
              </div>
              <DataTable
                columns={automaticColumns}
                data={automaticDiscountData}
                filterColumn="title"
                filterPlaceholder="Search automatic discounts..."
              />
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
