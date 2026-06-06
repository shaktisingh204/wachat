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
    id: "PO-2023-1042",
    supplier: "Global Electronics Ltd.",
    orderDate: "2023-10-15",
    expectedDate: "2023-10-22",
    totalAmount: 14500.0,
    items: 450,
    status: "Pending",
  },
  {
    id: "PO-2023-1043",
    supplier: "Pacific Textiles Inc.",
    orderDate: "2023-10-16",
    expectedDate: "2023-10-25",
    totalAmount: 8240.5,
    items: 1200,
    status: "Draft",
  },
  {
    id: "PO-2023-1044",
    supplier: "Nordic Home Goods",
    orderDate: "2023-10-10",
    expectedDate: "2023-10-18",
    totalAmount: 22100.0,
    items: 320,
    status: "Receiving",
  },
  {
    id: "PO-2023-1045",
    supplier: "TechSupply Co.",
    orderDate: "2023-10-05",
    expectedDate: "2023-10-12",
    totalAmount: 4500.0,
    items: 50,
    status: "Completed",
  },
  {
    id: "PO-2023-1046",
    supplier: "Global Electronics Ltd.",
    orderDate: "2023-10-18",
    expectedDate: "2023-11-01",
    totalAmount: 56000.0,
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
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
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
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <PageHeader>
        <PageHeaderHeading>
          <PageTitle>Purchase Orders</PageTitle>
          <PageDescription>
            Manage incoming procurement from your suppliers and vendors.
          </PageDescription>
        </PageHeaderHeading>
        <PageActions>
          <Button variant="primary" iconLeft={Plus}>
            Create PO
          </Button>
        </PageActions>
      </PageHeader>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Active POs"
          value="24"
          icon={FileText}
          delta={{ value: "Pending and Receiving", tone: "neutral" }}
        />
        <StatCard
          label="Pending Value"
          value="$124,500"
          icon={AlertCircle}
          delta={{ value: "+12% from last month", tone: "up" }}
        />
        <StatCard
          label="Expected Today"
          value="3"
          icon={Clock}
          delta={{ value: "Shipments arriving today", tone: "neutral" }}
        />
        <StatCard
          label="Received (MTD)"
          value="18"
          icon={PackageCheck}
          delta={{ value: "+4 from last month", tone: "up" }}
        />
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle>Procurement Orders</CardTitle>
            <CardDescription>
              Track all your purchase orders and their current fulfillment
              status.
            </CardDescription>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Field className="w-full sm:w-[300px]">
              <Input
                type="search"
                placeholder="Search POs..."
                iconLeft={Search}
                aria-label="Search purchase orders"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </Field>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger aria-label="Filter by status" className="sm:w-[160px]">
                <SelectValue placeholder="Filter Status" />
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
            <Table>
              <THead>
                <Tr>
                  <Th>PO Number</Th>
                  <Th>Supplier</Th>
                  <Th>Order Date</Th>
                  <Th>Expected Date</Th>
                  <Th align="right">Total Amount</Th>
                  <Th>Status</Th>
                  <Th align="right">Actions</Th>
                </Tr>
              </THead>
              <TBody>
                {filtered.map((po) => (
                  <Tr key={po.id}>
                    <Td className="font-medium">{po.id}</Td>
                    <Td>{po.supplier}</Td>
                    <Td className="text-[var(--st-text-secondary)]">
                      {po.orderDate}
                    </Td>
                    <Td className="text-[var(--st-text-secondary)]">
                      {po.expectedDate}
                    </Td>
                    <Td align="right">{formatCurrency(po.totalAmount)}</Td>
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
                          <DropdownMenuItem>Edit PO</DropdownMenuItem>
                          <DropdownMenuItem>Mark as Received</DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem variant="danger">
                            Cancel PO
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
