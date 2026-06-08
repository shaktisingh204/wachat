"use client";

import React from "react";
import {
  Plus,
  Gift,
  CreditCard,
  Clock,
  MoreHorizontal,
  Eye,
  Copy,
  RefreshCw,
  Download,
  Search,
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
  DataTable,
  type DataTableColumn,
  Badge,
  type BadgeTone,
  EmptyState,
  Field,
  Input,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  useToast,
} from "@/components/sabcrm/20ui";

interface GiftCard {
  id: string;
  code: string;
  customer: string;
  initialBalance: string;
  currentBalance: string;
  status: string;
  issueDate: string;
  expiryDate: string;
}

const giftCardData: GiftCard[] = [
  {
    id: "gc_001",
    code: "•••• •••• •••• 4A92",
    customer: "Aanya Sharma",
    initialBalance: "₹10,000",
    currentBalance: "₹4,550",
    status: "Active",
    issueDate: "May 20, 2026",
    expiryDate: "May 20, 2027",
  },
  {
    id: "gc_002",
    code: "•••• •••• •••• 8B3F",
    customer: "Mark Reyes",
    initialBalance: "₹5,000",
    currentBalance: "₹0",
    status: "Redeemed",
    issueDate: "Apr 15, 2026",
    expiryDate: "Apr 15, 2027",
  },
  {
    id: "gc_003",
    code: "•••• •••• •••• 1C77",
    customer: "Unassigned",
    initialBalance: "₹20,000",
    currentBalance: "₹20,000",
    status: "Active",
    issueDate: "Jun 1, 2026",
    expiryDate: "Jun 1, 2027",
  },
  {
    id: "gc_004",
    code: "•••• •••• •••• 9D21",
    customer: "Emily Davis",
    initialBalance: "₹2,500",
    currentBalance: "₹2,500",
    status: "Expired",
    issueDate: "May 1, 2025",
    expiryDate: "May 1, 2026",
  },
  {
    id: "gc_005",
    code: "•••• •••• •••• 5E44",
    customer: "Rohan Mehta",
    initialBalance: "₹15,000",
    currentBalance: "₹12,000",
    status: "Active",
    issueDate: "Jun 3, 2026",
    expiryDate: "Jun 3, 2027",
  },
];

const STATUS_TONE: Record<string, BadgeTone> = {
  Active: "success",
  Redeemed: "neutral",
  Expired: "warning",
};

export default function GiftCardsPage() {
  const { toast } = useToast();
  const [query, setQuery] = React.useState("");

  const filteredRows = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return giftCardData;
    return giftCardData.filter((row) => row.code.toLowerCase().includes(q));
  }, [query]);

  const columns: Array<DataTableColumn<GiftCard>> = [
    {
      key: "code",
      header: "Gift card code",
      render: (row) => (
        <div className="flex items-center gap-2">
          <Gift className="h-4 w-4 text-[var(--st-text-secondary)]" aria-hidden="true" />
          <span className="font-mono font-medium tabular-nums">{row.code}</span>
        </div>
      ),
    },
    { key: "customer", header: "Customer" },
    {
      key: "status",
      header: "Status",
      render: (row) => (
        <Badge tone={STATUS_TONE[row.status] ?? "neutral"} dot>
          {row.status}
        </Badge>
      ),
    },
    {
      key: "currentBalance",
      header: "Current balance",
      align: "right",
      render: (row) => <span className="font-semibold tabular-nums">{row.currentBalance}</span>,
    },
    {
      key: "initialBalance",
      header: "Initial balance",
      align: "right",
      render: (row) => (
        <span className="tabular-nums text-[var(--st-text-secondary)]">{row.initialBalance}</span>
      ),
    },
    { key: "issueDate", header: "Issued" },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (row) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <IconButton label="Gift card actions" icon={MoreHorizontal} variant="ghost" size="sm" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              iconLeft={Eye}
              onSelect={() => toast.success(`Opening ${row.code}`)}
            >
              View details
            </DropdownMenuItem>
            <DropdownMenuItem
              iconLeft={Copy}
              onSelect={() => toast.success("Gift card code copied")}
            >
              Copy code
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              iconLeft={RefreshCw}
              onSelect={() => toast.success("Gift card resent to customer")}
            >
              Resend to customer
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
          <PageTitle>Gift cards</PageTitle>
          <PageDescription>
            Issue gift cards and track balances and redemptions.
          </PageDescription>
        </PageHeading>
        <PageActions>
          <Button variant="outline" iconLeft={Download} onClick={() => toast.success("Export started")}>
            Export
          </Button>
          <Button variant="primary" iconLeft={Plus} onClick={() => toast({ title: "Issue gift card", tone: "info" })}>
            Issue gift card
          </Button>
        </PageActions>
      </PageHeader>

      <section aria-label="Gift card summary" className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatCard
          label="Total issued value"
          value={<span className="tabular-nums">₹52,500</span>}
          icon={CreditCard}
          accent="#3b7af5"
          delta={{ value: "+8.2% vs last month", tone: "up" }}
        />
        <StatCard
          label="Outstanding balance"
          value={<span className="tabular-nums">₹31,455</span>}
          icon={Clock}
          accent="#d97706"
          delta={{ value: "+2.4% vs last month", tone: "up" }}
        />
        <StatCard
          label="Active gift cards"
          value={<span className="tabular-nums">48</span>}
          icon={Gift}
          accent="#1f9d55"
          delta={{ value: "+5.0% vs last month", tone: "up" }}
        />
      </section>

      <Card padding="none">
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>All gift cards</CardTitle>
          <Field label="Search gift cards" className="w-full sm:w-72">
            <Input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by gift card code"
              iconLeft={Search}
            />
          </Field>
        </CardHeader>
        <DataTable<GiftCard>
          columns={columns}
          rows={filteredRows}
          getRowId={(row) => row.id}
          empty={
            <EmptyState
              icon={Gift}
              title="No gift cards found"
              description="No gift cards match your search. Adjust the code or issue a new gift card."
            />
          }
        />
      </Card>
    </div>
  );
}
