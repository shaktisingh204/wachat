"use client";

import React from "react";
import {
  Plus,
  Search,
  ArrowRightLeft,
  Truck,
  PackageCheck,
  AlertTriangle,
  MoreHorizontal,
  ArrowRight,
} from "lucide-react";
import {
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  PageDescription,
  PageActions,
  Button,
  IconButton,
  Input,
  Field,
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/sabcrm/20ui";

const mockTransfers = [
  {
    id: "TRN-0091",
    origin: "Central US Distribution",
    destination: "West Coast Fulfillment",
    date: "2023-10-24",
    items: 450,
    status: "In Transit",
    priority: "High",
  },
  {
    id: "TRN-0092",
    origin: "East Coast Hub",
    destination: "Central US Distribution",
    date: "2023-10-25",
    items: 120,
    status: "Preparing",
    priority: "Normal",
  },
  {
    id: "TRN-0093",
    origin: "West Coast Fulfillment",
    destination: "South Retail Storage",
    date: "2023-10-22",
    items: 85,
    status: "Delivered",
    priority: "Normal",
  },
  {
    id: "TRN-0094",
    origin: "European Depot",
    destination: "East Coast Hub",
    date: "2023-10-20",
    items: 1500,
    status: "Delayed",
    priority: "Urgent",
  },
  {
    id: "TRN-0095",
    origin: "Central US Distribution",
    destination: "South Retail Storage",
    date: "2023-10-26",
    items: 30,
    status: "Draft",
    priority: "Low",
  },
];

const STATUS_TONE: Record<string, BadgeTone> = {
  Delivered: "success",
  "In Transit": "info",
  Preparing: "neutral",
  Delayed: "danger",
  Draft: "neutral",
};

export default function TransfersPage() {
  const getStatusBadge = (status: string) => {
    const tone = STATUS_TONE[status] ?? "neutral";
    return <Badge tone={tone}>{status}</Badge>;
  };

  const getPriorityIcon = (priority: string) => {
    if (priority === "Urgent") {
      return (
        <AlertTriangle
          className="h-3 w-3 mr-1 text-[var(--st-danger)]"
          aria-hidden="true"
        />
      );
    }
    if (priority === "High") {
      return (
        <AlertTriangle
          className="h-3 w-3 mr-1 text-[var(--st-warn)]"
          aria-hidden="true"
        />
      );
    }
    return null;
  };

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <PageHeader>
        <PageHeaderHeading>
          <PageTitle>Stock Transfers</PageTitle>
          <PageDescription>
            Manage inventory movement between your warehouses and retail locations.
          </PageDescription>
        </PageHeaderHeading>
        <PageActions>
          <Button variant="primary" iconLeft={Plus}>
            New Transfer
          </Button>
        </PageActions>
      </PageHeader>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Active Transfers"
          value="12"
          icon={ArrowRightLeft}
          delta={{ value: "Preparing or In Transit", tone: "neutral" }}
        />
        <StatCard
          label="Items In Transit"
          value="2,450"
          icon={Truck}
          delta={{ value: "+300 from last week", tone: "up" }}
        />
        <StatCard
          label="Delivered (MTD)"
          value="45"
          icon={PackageCheck}
          delta={{ value: "Successfully received", tone: "neutral" }}
        />
        <StatCard
          label="Delayed Shipments"
          value="2"
          icon={AlertTriangle}
          delta={{ value: "Needs attention", tone: "down" }}
        />
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Transfer History</CardTitle>
            <CardDescription>
              Track internal stock movements across your supply chain network.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Field className="w-[200px] sm:w-[300px]">
              <Input
                type="search"
                placeholder="Search transfers..."
                iconLeft={Search}
                aria-label="Search transfers"
              />
            </Field>
            <Button variant="outline">Filters</Button>
          </div>
        </CardHeader>
        <CardBody>
          <Table>
            <THead>
              <Tr>
                <Th>Transfer ID</Th>
                <Th>Route</Th>
                <Th>Date</Th>
                <Th>Items</Th>
                <Th>Priority</Th>
                <Th>Status</Th>
                <Th align="right">Actions</Th>
              </Tr>
            </THead>
            <TBody>
              {mockTransfers.map((transfer) => (
                <Tr key={transfer.id}>
                  <Td className="font-medium">{transfer.id}</Td>
                  <Td>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="truncate max-w-[120px]">{transfer.origin}</span>
                      <ArrowRight
                        className="h-3 w-3 flex-shrink-0 text-[var(--st-text-secondary)]"
                        aria-hidden="true"
                      />
                      <span className="truncate max-w-[120px]">{transfer.destination}</span>
                    </div>
                  </Td>
                  <Td className="text-[var(--st-text-secondary)]">{transfer.date}</Td>
                  <Td>{transfer.items}</Td>
                  <Td>
                    <div className="flex items-center">
                      {getPriorityIcon(transfer.priority)}
                      <span className="text-sm">{transfer.priority}</span>
                    </div>
                  </Td>
                  <Td>{getStatusBadge(transfer.status)}</Td>
                  <Td align="right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <IconButton
                          label={`Actions for ${transfer.id}`}
                          icon={MoreHorizontal}
                          variant="ghost"
                          size="sm"
                        />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuItem>View details</DropdownMenuItem>
                        <DropdownMenuItem>Print packing slip</DropdownMenuItem>
                        <DropdownMenuItem>Update status</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem variant="danger">Cancel transfer</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        </CardBody>
        <CardFooter className="flex items-center justify-between text-sm text-[var(--st-text-secondary)]">
          <div>Showing 1 to {mockTransfers.length} of 84 transfers</div>
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
