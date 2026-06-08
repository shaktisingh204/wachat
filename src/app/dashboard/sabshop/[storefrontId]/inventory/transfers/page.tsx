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
    date: "May 24, 2026",
    items: 450,
    status: "In Transit",
    priority: "High",
  },
  {
    id: "TRN-0092",
    origin: "East Coast Hub",
    destination: "Central US Distribution",
    date: "May 25, 2026",
    items: 120,
    status: "Preparing",
    priority: "Normal",
  },
  {
    id: "TRN-0093",
    origin: "West Coast Fulfillment",
    destination: "South Retail Storage",
    date: "May 22, 2026",
    items: 85,
    status: "Delivered",
    priority: "Normal",
  },
  {
    id: "TRN-0094",
    origin: "European Depot",
    destination: "East Coast Hub",
    date: "May 20, 2026",
    items: 1500,
    status: "Delayed",
    priority: "Urgent",
  },
  {
    id: "TRN-0095",
    origin: "Central US Distribution",
    destination: "South Retail Storage",
    date: "May 26, 2026",
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
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <PageHeader>
        <PageHeaderHeading>
          <PageTitle>Stock transfers</PageTitle>
          <PageDescription>
            Move inventory between your warehouses and retail locations.
          </PageDescription>
        </PageHeaderHeading>
        <PageActions>
          <Button variant="primary" iconLeft={Plus}>
            New transfer
          </Button>
        </PageActions>
      </PageHeader>

      <section aria-label="Transfer summary" className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Active transfers"
          value={<span className="tabular-nums">12</span>}
          icon={ArrowRightLeft}
          accent="#3b7af5"
          delta={{ value: "Preparing or in transit", tone: "neutral" }}
        />
        <StatCard
          label="Items in transit"
          value={<span className="tabular-nums">2,450</span>}
          icon={Truck}
          accent="#7c3aed"
          delta={{ value: "+300 from last week", tone: "up" }}
        />
        <StatCard
          label="Delivered this month"
          value={<span className="tabular-nums">45</span>}
          icon={PackageCheck}
          accent="#1f9d55"
          delta={{ value: "Successfully received", tone: "neutral" }}
        />
        <StatCard
          label="Delayed shipments"
          value={<span className="tabular-nums">2</span>}
          icon={AlertTriangle}
          accent="#c13c2c"
          delta={{ value: "Needs attention", tone: "down" }}
        />
      </section>

      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Transfer history</CardTitle>
            <CardDescription>
              Internal stock movements across your supply network.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Field className="w-[200px] sm:w-[300px]">
              <Input
                type="search"
                placeholder="Search transfers"
                iconLeft={Search}
                aria-label="Search transfers"
              />
            </Field>
            <Button variant="outline">Filters</Button>
          </div>
        </CardHeader>
        <CardBody>
          <Table hover>
            <THead>
              <Tr>
                <Th>Transfer</Th>
                <Th>Route</Th>
                <Th>Date</Th>
                <Th align="right">Items</Th>
                <Th>Priority</Th>
                <Th>Status</Th>
                <Th align="right" width={56}>
                  <span className="sr-only">Actions</span>
                </Th>
              </Tr>
            </THead>
            <TBody>
              {mockTransfers.map((transfer) => (
                <Tr key={transfer.id}>
                  <Td className="font-medium tabular-nums">{transfer.id}</Td>
                  <Td>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="max-w-[120px] truncate">{transfer.origin}</span>
                      <ArrowRight
                        className="h-3 w-3 flex-shrink-0 text-[var(--st-text-secondary)]"
                        aria-hidden="true"
                      />
                      <span className="max-w-[120px] truncate">{transfer.destination}</span>
                    </div>
                  </Td>
                  <Td className="text-[var(--st-text-secondary)]">{transfer.date}</Td>
                  <Td align="right" className="tabular-nums">{transfer.items}</Td>
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
