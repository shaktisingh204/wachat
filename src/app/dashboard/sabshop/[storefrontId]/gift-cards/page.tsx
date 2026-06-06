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
    customer: "Unassigned",
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

const STATUS_TONE: Record<string, BadgeTone> = {
  Active: "success",
  Redeemed: "neutral",
  Expired: "warning",
};

export default function GiftCardsPage({ params }: { params: { storefrontId: string } }) {
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
      header: "Gift Card Code",
      render: (row) => (
        <div className="flex items-center gap-2">
          <Gift className="h-4 w-4 text-[var(--st-text-secondary)]" aria-hidden="true" />
          <span className="font-medium font-mono">{row.code}</span>
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
      header: "Current Balance",
      align: "right",
      render: (row) => <span className="font-semibold">{row.currentBalance}</span>,
    },
    {
      key: "initialBalance",
      header: "Initial Balance",
      align: "right",
      render: (row) => (
        <span className="text-[var(--st-text-secondary)]">{row.initialBalance}</span>
      ),
    },
    { key: "issueDate", header: "Issue Date" },
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
              View Details
            </DropdownMenuItem>
            <DropdownMenuItem
              iconLeft={Copy}
              onSelect={() => toast.success("Gift card code copied")}
            >
              Copy Code
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              iconLeft={RefreshCw}
              onSelect={() => toast.success("Gift card resent to customer")}
            >
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
        <PageHeading>
          <PageTitle>Gift Cards</PageTitle>
          <PageDescription>
            Issue and track gift cards. Monitor current balances and redemptions.
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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          label="Total Issued (Value)"
          value="$5,250.00"
          icon={CreditCard}
          delta={{ value: "+8.2% vs last month", tone: "up" }}
        />
        <StatCard
          label="Outstanding Balance"
          value="$3,145.50"
          icon={Clock}
          delta={{ value: "+2.4% vs last month", tone: "up" }}
        />
        <StatCard
          label="Active Gift Cards"
          value="48"
          icon={Gift}
          delta={{ value: "+5.0% vs last month", tone: "up" }}
        />
      </div>

      <Card padding="none">
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>All Gift Cards</CardTitle>
          <Field label="Search gift cards" className="w-full sm:w-72">
            <Input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by gift card code..."
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
