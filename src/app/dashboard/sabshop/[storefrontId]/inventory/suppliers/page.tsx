"use client";

import React from "react";
import {
  Plus,
  Search,
  Building2,
  Clock,
  Star,
  Users,
  MoreHorizontal,
  Mail,
  Phone,
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
  Avatar,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  useToast,
} from "@/components/sabcrm/20ui";

const mockSuppliers = [
  {
    id: "SUP-01",
    name: "Global Electronics Ltd.",
    category: "Electronics",
    contactName: "David Chen",
    email: "d.chen@globalelectronics.com",
    phone: "+1 (555) 123-4567",
    leadTime: "14 days",
    rating: 4.8,
    status: "Active",
    avatar: "GE",
  },
  {
    id: "SUP-02",
    name: "Pacific Textiles Inc.",
    category: "Apparel",
    contactName: "Maria Garcia",
    email: "maria@pacifictextiles.io",
    phone: "+1 (555) 987-6543",
    leadTime: "21 days",
    rating: 4.5,
    status: "Active",
    avatar: "PT",
  },
  {
    id: "SUP-03",
    name: "Nordic Home Goods",
    category: "Home & Garden",
    contactName: "Lars Jensen",
    email: "sales@nordichome.se",
    phone: "+46 8 123 45 67",
    leadTime: "30 days",
    rating: 4.9,
    status: "Active",
    avatar: "NH",
  },
  {
    id: "SUP-04",
    name: "TechSupply Co.",
    category: "Accessories",
    contactName: "Sarah Williams",
    email: "swilliams@techsupply.co",
    phone: "+1 (555) 321-7654",
    leadTime: "7 days",
    rating: 3.2,
    status: "Under Review",
    avatar: "TS",
  },
  {
    id: "SUP-05",
    name: "Apex Manufacturing",
    category: "Raw Materials",
    contactName: "Robert Taylor",
    email: "rtaylor@apex-mfg.com",
    phone: "+1 (555) 567-8901",
    leadTime: "45 days",
    rating: 4.1,
    status: "Inactive",
    avatar: "AM",
  },
];

const STATUS_TONE: Record<string, BadgeTone> = {
  Active: "success",
  "Under Review": "warning",
  Inactive: "neutral",
};

export default function SuppliersPage() {
  const { toast } = useToast();

  const renderRating = (rating: number) => (
    <div className="flex items-center gap-1">
      <Star
        className="h-3 w-3 fill-current text-[var(--st-warn)]"
        aria-hidden="true"
      />
      <span className="text-sm font-medium tabular-nums">{rating.toFixed(1)} out of 5</span>
    </div>
  );

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <PageHeader>
        <PageHeaderHeading>
          <PageTitle>Suppliers</PageTitle>
          <PageDescription>
            Manage vendor relationships, contacts, and performance.
          </PageDescription>
        </PageHeaderHeading>
        <PageActions>
          <Button variant="primary" iconLeft={Plus}>
            Add supplier
          </Button>
        </PageActions>
      </PageHeader>

      <section aria-label="Supplier summary" className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Active suppliers"
          value={<span className="tabular-nums">42</span>}
          icon={Building2}
          accent="#1f9d55"
          delta={{ value: "+3 this quarter", tone: "up" }}
        />
        <StatCard
          label="Average lead time"
          value={<span className="tabular-nums">18 days</span>}
          icon={Clock}
          accent="#3b7af5"
          delta={{ value: "-2 days vs last year", tone: "up" }}
        />
        <StatCard
          label="Average rating"
          value={<span className="tabular-nums">4.6 / 5</span>}
          icon={Star}
          accent="#d97706"
        />
        <StatCard
          label="Total contacts"
          value={<span className="tabular-nums">156</span>}
          icon={Users}
          accent="#7c3aed"
        />
      </section>

      <Card>
        <CardHeader className="flex flex-col gap-4 pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Supplier directory</CardTitle>
            <CardDescription>
              All vendors and manufacturing partners.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Input
              type="search"
              aria-label="Search suppliers"
              placeholder="Search suppliers"
              iconLeft={Search}
              className="w-[200px] sm:w-[300px]"
            />
            <Button variant="outline">Filters</Button>
          </div>
        </CardHeader>
        <CardBody>
          <Table hover>
            <THead>
              <Tr>
                <Th>Supplier</Th>
                <Th>Contact</Th>
                <Th>Category</Th>
                <Th>Lead time</Th>
                <Th>Rating</Th>
                <Th>Status</Th>
                <Th align="right" width={56}>
                  <span className="sr-only">Actions</span>
                </Th>
              </Tr>
            </THead>
            <TBody>
              {mockSuppliers.map((supplier) => (
                <Tr key={supplier.id}>
                  <Td>
                    <div className="flex items-center gap-3">
                      <Avatar name={supplier.name} shape="square" size="sm" />
                      <div className="flex flex-col">
                        <span className="font-medium">{supplier.name}</span>
                        <span className="text-xs tabular-nums text-[var(--st-text-secondary)]">
                          {supplier.id}
                        </span>
                      </div>
                    </div>
                  </Td>
                  <Td>
                    <div className="flex flex-col gap-1 text-sm">
                      <span className="font-medium">{supplier.contactName}</span>
                      <div className="flex items-center text-xs text-[var(--st-text-secondary)]">
                        <Mail className="mr-1 h-3 w-3" aria-hidden="true" />
                        {supplier.email}
                      </div>
                      <div className="flex items-center text-xs tabular-nums text-[var(--st-text-secondary)]">
                        <Phone className="mr-1 h-3 w-3" aria-hidden="true" />
                        {supplier.phone}
                      </div>
                    </div>
                  </Td>
                  <Td>{supplier.category}</Td>
                  <Td>
                    <div className="flex items-center text-sm">
                      <Clock
                        className="mr-2 h-4 w-4 text-[var(--st-text-secondary)]"
                        aria-hidden="true"
                      />
                      {supplier.leadTime}
                    </div>
                  </Td>
                  <Td>{renderRating(supplier.rating)}</Td>
                  <Td>
                    <Badge tone={STATUS_TONE[supplier.status] ?? "neutral"} dot>
                      {supplier.status}
                    </Badge>
                  </Td>
                  <Td align="right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <IconButton
                          label={`Actions for ${supplier.name}`}
                          icon={MoreHorizontal}
                          variant="ghost"
                          size="sm"
                        />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuItem
                          onSelect={() =>
                            toast.success(`Opening profile for ${supplier.name}`)
                          }
                        >
                          View profile
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onSelect={() =>
                            toast.success(`Loading POs for ${supplier.name}`)
                          }
                        >
                          View POs
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onSelect={() =>
                            toast.success(`Editing ${supplier.name}`)
                          }
                        >
                          Edit details
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          variant="danger"
                          onSelect={() =>
                            toast.success(`${supplier.name} deactivated`)
                          }
                        >
                          Deactivate
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        </CardBody>
        <CardFooter className="flex items-center justify-between text-sm text-[var(--st-text-secondary)]">
          <div>Showing 1 to {mockSuppliers.length} of 42 suppliers</div>
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
