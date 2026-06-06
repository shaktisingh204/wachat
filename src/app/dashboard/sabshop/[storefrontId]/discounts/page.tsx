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
  type BadgeVariant,
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

const automaticDiscountData: AutomaticDiscount[] = [
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

function statusVariant(status: string): BadgeVariant {
  if (status === "Active") return "success";
  if (status === "Expired" || status === "Inactive") return "destructive";
  if (status === "Scheduled") return "warning";
  return "outline";
}

export default function DiscountsPage({ params }: { params: { storefrontId: string } }) {
  void params;
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
      header: "Discount Code",
      sortable: true,
      render: (row) => (
        <div className="flex items-center gap-2">
          <Ticket className="h-4 w-4 text-[var(--st-text-secondary)]" aria-hidden="true" />
          <span className="font-medium">{row.code}</span>
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      render: (row) => <Badge variant={statusVariant(row.status)}>{row.status}</Badge>,
    },
    { key: "type", header: "Type", sortable: true },
    { key: "value", header: "Value" },
    { key: "usage", header: "Usage" },
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
      render: (row) => <Badge variant={statusVariant(row.status)}>{row.status}</Badge>,
    },
    { key: "usage", header: "Usage count", sortable: true },
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
    <div className="flex flex-col gap-6 p-6 md:p-8 w-full max-w-7xl mx-auto">
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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          label="Total Redemptions"
          value="1,544"
          icon={Activity}
          delta={{ value: "+12.5% vs last month", tone: "up" }}
        />
        <StatCard
          label="Discount Revenue"
          value="$12,450.00"
          icon={ArrowUpRight}
          delta={{ value: "+5.2% vs last month", tone: "up" }}
        />
        <StatCard
          label="Active Campaigns"
          value="4"
          icon={Tag}
          delta={{ value: "-1 vs last month", tone: "down" }}
        />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="codes">Discount Codes</TabsTrigger>
          <TabsTrigger value="automatic">Automatic Discounts</TabsTrigger>
        </TabsList>

        <TabsContent value="codes" className="w-full">
          <Card padding="none">
            <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle>Active &amp; Expired Codes</CardTitle>
              <Field label="Search discount codes" className="sm:w-72" id="search-codes">
                <SearchInput
                  value={codeQuery}
                  onValueChange={setCodeQuery}
                  placeholder="Search discount codes..."
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
              <CardTitle>Automatic Discounts</CardTitle>
              <Field label="Search automatic discounts" className="sm:w-72" id="search-automatic">
                <SearchInput
                  value={autoQuery}
                  onValueChange={setAutoQuery}
                  placeholder="Search automatic discounts..."
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
