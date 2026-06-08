"use client";

import React, { useMemo, useState } from "react";
import {
  Plus,
  Tag,
  Ticket,
  Activity,
  MoreHorizontal,
  Copy,
  Trash2,
  Edit3,
  ArrowUpRight,
} from "lucide-react";

import {
  PageHeader,
  PageHeading,
  PageTitle,
  PageDescription,
  PageActions,
  Button,
  IconButton,
  StatCard,
  Card,
  CardHeader,
  CardTitle,
  Field,
  DataTable,
  Badge,
  EmptyState,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  useToast,
  type BadgeTone,
  type DataTableColumn,
} from "@/components/sabcrm/20ui";
import { SearchInput } from "@/components/sabcrm/20ui";

interface DiscountCode {
  id: string;
  code: string;
  type: string;
  value: string;
  status: string;
  usage: string;
  createdAt: string;
}

interface AutomaticDiscount {
  id: string;
  title: string;
  status: string;
  usage: string;
  createdAt: string;
}

const discountData: DiscountCode[] = [
  {
    id: "d_001",
    code: "SUMMER2026",
    type: "Percentage",
    value: "20%",
    status: "Active",
    usage: "145 / 500",
    createdAt: "May 10, 2026",
  },
  {
    id: "d_002",
    code: "WELCOME10",
    type: "Fixed amount",
    value: "₹500",
    status: "Active",
    usage: "89 / unlimited",
    createdAt: "May 15, 2026",
  },
  {
    id: "d_003",
    code: "FREESHIP",
    type: "Free shipping",
    value: "Shipping",
    status: "Expired",
    usage: "210 / 210",
    createdAt: "Apr 1, 2026",
  },
  {
    id: "d_004",
    code: "VIP50",
    type: "Percentage",
    value: "50%",
    status: "Active",
    usage: "12 / 50",
    createdAt: "Jun 1, 2026",
  },
];

const automaticDiscountData: AutomaticDiscount[] = [
  {
    id: "ad_001",
    title: "Buy 2 get 1 free",
    status: "Active",
    usage: "340",
    createdAt: "May 1, 2026",
  },
  {
    id: "ad_002",
    title: "15% off orders over ₹5,000",
    status: "Active",
    usage: "1,204",
    createdAt: "Mar 12, 2026",
  },
  {
    id: "ad_003",
    title: "Free gift with purchase",
    status: "Scheduled",
    usage: "0",
    createdAt: "Jun 2, 2026",
  },
];

function statusTone(status: string): BadgeTone {
  if (status === "Active") return "success";
  if (status === "Expired" || status === "Inactive") return "danger";
  if (status === "Scheduled") return "warning";
  return "neutral";
}

export default function DiscountsPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("codes");
  const [codeQuery, setCodeQuery] = useState("");
  const [autoQuery, setAutoQuery] = useState("");

  const filteredCodes = useMemo(() => {
    const q = codeQuery.trim().toLowerCase();
    if (!q) return discountData;
    return discountData.filter((d) => d.code.toLowerCase().includes(q));
  }, [codeQuery]);

  const filteredAutomatic = useMemo(() => {
    const q = autoQuery.trim().toLowerCase();
    if (!q) return automaticDiscountData;
    return automaticDiscountData.filter((d) => d.title.toLowerCase().includes(q));
  }, [autoQuery]);

  const discountColumns: Array<DataTableColumn<DiscountCode>> = [
    {
      key: "code",
      header: "Discount code",
      sortable: true,
      render: (row) => (
        <div className="flex items-center gap-2">
          <Ticket className="h-4 w-4 text-[var(--st-text-secondary)]" aria-hidden="true" />
          <span className="font-medium tabular-nums">{row.code}</span>
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      render: (row) => <Badge tone={statusTone(row.status)}>{row.status}</Badge>,
    },
    { key: "type", header: "Type", sortable: true },
    {
      key: "value",
      header: "Value",
      render: (row) => <span className="tabular-nums">{row.value}</span>,
    },
    {
      key: "usage",
      header: "Usage",
      render: (row) => <span className="tabular-nums">{row.usage}</span>,
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (row) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <IconButton label={`Actions for ${row.code}`} icon={MoreHorizontal} size="sm" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              iconLeft={Copy}
              onSelect={() => {
                void navigator.clipboard?.writeText(row.code);
                toast.success(`Copied ${row.code}`);
              }}
            >
              Copy code
            </DropdownMenuItem>
            <DropdownMenuItem iconLeft={Edit3}>Edit</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="danger" iconLeft={Trash2}>
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  const automaticColumns: Array<DataTableColumn<AutomaticDiscount>> = [
    {
      key: "title",
      header: "Title",
      sortable: true,
      render: (row) => (
        <div className="flex items-center gap-2">
          <Tag className="h-4 w-4 text-[var(--st-text-secondary)]" aria-hidden="true" />
          <span className="font-medium">{row.title}</span>
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      render: (row) => <Badge tone={statusTone(row.status)}>{row.status}</Badge>,
    },
    {
      key: "usage",
      header: "Usage count",
      sortable: true,
      render: (row) => <span className="tabular-nums">{row.usage}</span>,
    },
    { key: "createdAt", header: "Created", sortable: true },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (row) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <IconButton label={`Actions for ${row.title}`} icon={MoreHorizontal} size="sm" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem iconLeft={Edit3}>Edit</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="danger" iconLeft={Trash2}>
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <PageHeader>
        <PageHeading>
          <PageTitle>Discounts</PageTitle>
          <PageDescription>
            Manage discount codes and automatic discounts for your store.
          </PageDescription>
        </PageHeading>
        <PageActions>
          <Button variant="outline" onClick={() => toast({ title: "Export started", tone: "info" })}>
            Export
          </Button>
          <Button variant="primary" iconLeft={Plus}>
            Create discount
          </Button>
        </PageActions>
      </PageHeader>

      <section aria-label="Discount summary" className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatCard
          label="Total redemptions"
          value={<span className="tabular-nums">1,544</span>}
          icon={Activity}
          accent="#3b7af5"
          delta={{ value: "+12.5% vs last month", tone: "up" }}
        />
        <StatCard
          label="Discount value given"
          value={<span className="tabular-nums">₹12,450</span>}
          icon={ArrowUpRight}
          accent="#1f9d55"
          delta={{ value: "+5.2% vs last month", tone: "up" }}
        />
        <StatCard
          label="Active campaigns"
          value={<span className="tabular-nums">4</span>}
          icon={Tag}
          accent="#7c3aed"
          delta={{ value: "-1 vs last month", tone: "down" }}
        />
      </section>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="codes">Discount codes</TabsTrigger>
          <TabsTrigger value="automatic">Automatic discounts</TabsTrigger>
        </TabsList>

        <TabsContent value="codes" className="w-full">
          <Card padding="none">
            <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle>Active and expired codes</CardTitle>
              <Field label="Search discount codes" className="sm:w-72" id="search-codes">
                <SearchInput
                  value={codeQuery}
                  onValueChange={setCodeQuery}
                  placeholder="Search discount codes"
                  clearLabel="Clear discount code search"
                />
              </Field>
            </CardHeader>
            <DataTable
              columns={discountColumns}
              rows={filteredCodes}
              getRowId={(row) => row.id}
              empty={
                <EmptyState
                  icon={Ticket}
                  title="No discount codes found"
                  description="Try a different search, or create your first discount code."
                />
              }
            />
          </Card>
        </TabsContent>

        <TabsContent value="automatic" className="w-full">
          <Card padding="none">
            <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle>Automatic discounts</CardTitle>
              <Field label="Search automatic discounts" className="sm:w-72" id="search-automatic">
                <SearchInput
                  value={autoQuery}
                  onValueChange={setAutoQuery}
                  placeholder="Search automatic discounts"
                  clearLabel="Clear automatic discount search"
                />
              </Field>
            </CardHeader>
            <DataTable
              columns={automaticColumns}
              rows={filteredAutomatic}
              getRowId={(row) => row.id}
              empty={
                <EmptyState
                  icon={Tag}
                  title="No automatic discounts found"
                  description="Try a different search, or create an automatic discount."
                />
              }
            />
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
