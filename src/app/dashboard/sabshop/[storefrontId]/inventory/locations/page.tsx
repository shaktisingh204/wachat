"use client";

import * as React from "react";
import {
  Plus,
  MapPin,
  Building2,
  HardDrive,
  Settings,
  Search,
  MoreHorizontal,
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
  type BadgeStyleKind,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  StatCard,
  Progress,
  type Ui20ProgressTone,
} from "@/components/sabcrm/20ui";

interface InventoryLocation {
  id: string;
  name: string;
  type: string;
  address: string;
  capacity: number;
  used: number;
  status: "Active" | "Maintenance" | "Warning";
  manager: string;
}

const mockLocations: InventoryLocation[] = [
  {
    id: "LOC-001",
    name: "Central US Distribution",
    type: "Distribution Center",
    address: "1234 Commerce Pkwy, Chicago, IL 60601",
    capacity: 50000,
    used: 42500,
    status: "Active",
    manager: "Alex Johnson",
  },
  {
    id: "LOC-002",
    name: "West Coast Fulfillment",
    type: "Fulfillment Center",
    address: "8899 Industrial Way, Los Angeles, CA 90001",
    capacity: 35000,
    used: 31000,
    status: "Active",
    manager: "Sarah Smith",
  },
  {
    id: "LOC-003",
    name: "East Coast Hub",
    type: "Warehouse",
    address: "45 Enterprise Blvd, Newark, NJ 07102",
    capacity: 40000,
    used: 15000,
    status: "Maintenance",
    manager: "Mike Davis",
  },
  {
    id: "LOC-004",
    name: "South Retail Storage",
    type: "Retail Backend",
    address: "776 Retail Row, Austin, TX 78701",
    capacity: 10000,
    used: 8500,
    status: "Active",
    manager: "Emily White",
  },
  {
    id: "LOC-005",
    name: "European Depot",
    type: "Distribution Center",
    address: "Logistikpark 1, 12345 Berlin, Germany",
    capacity: 60000,
    used: 58000,
    status: "Warning",
    manager: "Hans Muller",
  },
];

const STATUS_TONE: Record<InventoryLocation["status"], BadgeTone> = {
  Active: "success",
  Maintenance: "info",
  Warning: "warning",
};

const STATUS_KIND: Record<InventoryLocation["status"], BadgeStyleKind> = {
  Active: "soft",
  Maintenance: "outline",
  Warning: "soft",
};

function utilizationTone(percent: number): Ui20ProgressTone {
  if (percent >= 90) return "danger";
  if (percent >= 75) return "warning";
  return "accent";
}

export default function LocationsPage() {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <PageHeader>
        <PageHeaderHeading>
          <PageTitle>Locations</PageTitle>
          <PageDescription>
            Manage your warehouses, distribution centres, and retail storage capacity.
          </PageDescription>
        </PageHeaderHeading>
        <PageActions>
          <Button variant="primary" iconLeft={Plus}>
            Add location
          </Button>
        </PageActions>
      </PageHeader>

      <section aria-label="Location summary" className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total locations"
          value={<span className="tabular-nums">12</span>}
          icon={MapPin}
          accent="#3b7af5"
          delta={{ value: "+1 from last month", tone: "up" }}
        />
        <StatCard
          label="Total capacity"
          value={<span className="tabular-nums">195,000</span>}
          icon={Building2}
          accent="#7c3aed"
          delta={{ value: "Pallet positions across all sites", tone: "neutral" }}
        />
        <StatCard
          label="Global utilisation"
          value={<span className="tabular-nums">79%</span>}
          icon={HardDrive}
          accent="#d97706"
          delta={{ value: "+5% from last month", tone: "up" }}
        />
        <StatCard
          label="In maintenance"
          value={<span className="tabular-nums">1</span>}
          icon={Settings}
          accent="#1f9d55"
          delta={{ value: "Down 1 from last week", tone: "down" }}
        />
      </section>

      <Card>
        <CardHeader className="flex flex-col gap-4 pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Inventory locations</CardTitle>
            <CardDescription>
              View and manage your network of storage facilities.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Field label="Search locations" className="w-[200px] sm:w-[300px]">
              <Input
                type="search"
                placeholder="Search locations"
                iconLeft={Search}
              />
            </Field>
            <Button variant="outline">Filters</Button>
          </div>
        </CardHeader>
        <CardBody>
          <Table hover>
            <THead>
              <Tr>
                <Th>Location</Th>
                <Th>Type</Th>
                <Th>Capacity and utilisation</Th>
                <Th>Manager</Th>
                <Th>Status</Th>
                <Th align="right" width={56}>
                  <span className="sr-only">Actions</span>
                </Th>
              </Tr>
            </THead>
            <TBody>
              {mockLocations.map((location) => {
                const utilPercentage = Math.round(
                  (location.used / location.capacity) * 100,
                );
                return (
                  <Tr key={location.id}>
                    <Td>
                      <div className="flex flex-col gap-1">
                        <span className="font-medium text-[var(--st-text)]">
                          {location.name}
                        </span>
                        <span className="text-xs text-[var(--st-text-secondary)]">
                          {location.address}
                        </span>
                      </div>
                    </Td>
                    <Td>
                      <Badge tone="neutral" kind="soft">
                        {location.type}
                      </Badge>
                    </Td>
                    <Td>
                      <div className="flex w-[150px] flex-col gap-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="tabular-nums text-[var(--st-text-secondary)]">
                            {location.used.toLocaleString()} /{" "}
                            {location.capacity.toLocaleString()}
                          </span>
                          <span className="font-medium tabular-nums text-[var(--st-text)]">
                            {utilPercentage}%
                          </span>
                        </div>
                        <Progress
                          value={utilPercentage}
                          size="sm"
                          tone={utilizationTone(utilPercentage)}
                          aria-label={`${location.name} utilization`}
                        />
                      </div>
                    </Td>
                    <Td>{location.manager}</Td>
                    <Td>
                      <Badge
                        tone={STATUS_TONE[location.status]}
                        kind={STATUS_KIND[location.status]}
                        dot
                      >
                        {location.status}
                      </Badge>
                    </Td>
                    <Td align="right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <IconButton
                            label={`Open actions for ${location.name}`}
                            icon={MoreHorizontal}
                            variant="ghost"
                            size="sm"
                          />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuItem>View inventory</DropdownMenuItem>
                          <DropdownMenuItem>Edit location</DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem variant="danger">
                            Deactivate
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </Td>
                  </Tr>
                );
              })}
            </TBody>
          </Table>
        </CardBody>
        <CardFooter className="flex items-center justify-between text-sm text-[var(--st-text-secondary)]">
          <div>Showing 1 to {mockLocations.length} of 12 locations</div>
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
