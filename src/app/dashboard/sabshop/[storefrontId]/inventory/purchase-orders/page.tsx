"use client";

import React from "react";
import {
  Plus,
  Search,
  FileText,
  PackageCheck,
  Clock,
  AlertCircle,
  MoreHorizontal,
  Inbox,
} from "lucide-react";
import {
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  PageDescription,
  PageActions,
  Button,
  IconButton,
  Field,
  Input,
  Card,
  CardBody,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
  Table,
  TBody,
  Td,
  Th,
  THead,
  Tr,
  Badge,
  type BadgeTone,
  StatCard,
  EmptyState,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/sabcrm/20ui";

interface PurchaseOrder {
  id: string;
  supplier: string;
  orderDate: string;
  expectedDate: string;
  totalAmount: number;
  items: number;
  status: string;
}

const mockPurchaseOrders: PurchaseOrder[] = [
  {
    id: "PO-2026-1042",
    supplier: "Global Electronics",
    orderDate: "May 15, 2026",
    expectedDate: "May 22, 2026",
    totalAmount: 1450000,
    items: 450,
    status: "Pending",
  },
  {
    id: "PO-2026-1043",
    supplier: "Pacific Textiles",
    orderDate: "May 16, 2026",
    expectedDate: "May 25, 2026",
    totalAmount: 824050,
    items: 1200,
    status: "Draft",
  },
  {
    id: "PO-2026-1044",
    supplier: "Nordic Home Goods",
    orderDate: "May 10, 2026",
    expectedDate: "May 18, 2026",
    totalAmount: 2210000,
    items: 320,
    status: "Receiving",
  },
  {
    id: "PO-2026-1045",
    supplier: "Apex Manufacturing",
    orderDate: "May 5, 2026",
    expectedDate: "May 12, 2026",
    totalAmount: 450000,
    items: 50,
    status: "Completed",
  },
  {
    id: "PO-2026-1046",
    supplier: "Global Electronics",
    orderDate: "May 18, 2026",
    expectedDate: "Jun 1, 2026",
    totalAmount: 5600000,
    items: 2000,
    status: "Pending",
  },
];

const STATUS_TONE: Record<string, BadgeTone> = {
  Completed: "success",
  Receiving: "info",
  Pending: "warning",
  Draft: "neutral",
};

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function PurchaseOrdersPage() {
  const [query, setQuery] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("all");

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return mockPurchaseOrders.filter((po) => {
      const matchesQuery =
        q === "" ||
        po.id.toLowerCase().includes(q) ||
        po.supplier.toLowerCase().includes(q);
      const matchesStatus = statusFilter === "all" || po.status === statusFilter;
      return matchesQuery && matchesStatus;
    });
  }, [query, statusFilter]);

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <PageHeader>
        <PageHeaderHeading>
          <PageTitle>Purchase orders</PageTitle>
          <PageDescription>
            Manage incoming procurement from your suppliers and vendors.
          </PageDescription>
        </PageHeaderHeading>
        <PageActions>
          <Button variant="primary" iconLeft={Plus}>
            Create order
          </Button>
        </PageActions>
      </PageHeader>

      <section aria-label="Procurement summary" className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Active orders"
          value={<span className="tabular-nums">24</span>}
          icon={FileText}
          accent="#3b7af5"
          delta={{ value: "Pending and receiving", tone: "neutral" }}
        />
        <StatCard
          label="Pending value"
          value={<span className="tabular-nums">₹1,24,500</span>}
          icon={AlertCircle}
          accent="#d97706"
          delta={{ value: "+12% from last month", tone: "up" }}
        />
        <StatCard
          label="Expected today"
          value={<span className="tabular-nums">3</span>}
          icon={Clock}
          accent="#7c3aed"
          delta={{ value: "Shipments arriving today", tone: "neutral" }}
        />
        <StatCard
          label="Received this month"
          value={<span className="tabular-nums">18</span>}
          icon={PackageCheck}
          accent="#1f9d55"
          delta={{ value: "+4 from last month", tone: "up" }}
        />
      </section>

      <Card>
        <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle>Procurement orders</CardTitle>
            <CardDescription>
              Track every purchase order and its current fulfillment status.
            </CardDescription>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Field className="w-full sm:w-[300px]">
              <Input
                type="search"
                placeholder="Search orders"
                iconLeft={Search}
                aria-label="Search purchase orders"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </Field>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger aria-label="Filter by status" className="sm:w-[160px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="Pending">Pending</SelectItem>
                <SelectItem value="Receiving">Receiving</SelectItem>
                <SelectItem value="Completed">Completed</SelectItem>
                <SelectItem value="Draft">Draft</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardBody>
          {filtered.length === 0 ? (
            <EmptyState
              icon={Inbox}
              title="No purchase orders found"
              description="Try a different search term or clear the status filter."
            />
          ) : (
            <Table hover>
              <THead>
                <Tr>
                  <Th>Order</Th>
                  <Th>Supplier</Th>
                  <Th>Ordered</Th>
                  <Th>Expected</Th>
                  <Th align="right">Total</Th>
                  <Th>Status</Th>
                  <Th align="right" width={56}>
                    <span className="sr-only">Actions</span>
                  </Th>
                </Tr>
              </THead>
              <TBody>
                {filtered.map((po) => (
                  <Tr key={po.id}>
                    <Td className="font-medium tabular-nums">{po.id}</Td>
                    <Td>{po.supplier}</Td>
                    <Td className="text-[var(--st-text-secondary)]">
                      {po.orderDate}
                    </Td>
                    <Td className="text-[var(--st-text-secondary)]">
                      {po.expectedDate}
                    </Td>
                    <Td align="right" className="font-medium tabular-nums">
                      {formatCurrency(po.totalAmount)}
                    </Td>
                    <Td>
                      <Badge tone={STATUS_TONE[po.status] ?? "neutral"} dot>
                        {po.status}
                      </Badge>
                    </Td>
                    <Td align="right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <IconButton
                            label={`Actions for ${po.id}`}
                            icon={MoreHorizontal}
                            variant="ghost"
                            size="sm"
                          />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuItem>View details</DropdownMenuItem>
                          <DropdownMenuItem>Edit order</DropdownMenuItem>
                          <DropdownMenuItem>Mark as received</DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem variant="danger">
                            Cancel order
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
          )}
        </CardBody>
        <CardFooter className="flex items-center justify-between text-sm text-[var(--st-text-secondary)]">
          <div>
            Showing 1 to {filtered.length} of 156 purchase orders
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled>
              Previous
            </Button>
            <Button variant="outline" size="sm">
              Next
            </Button>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
