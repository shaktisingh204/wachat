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
  AvatarFallback,
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
      <span className="text-sm font-medium">{rating.toFixed(1)} out of 5</span>
    </div>
  );

  return (
    <div className="flex-1 space-y-4 p-4 pt-6 md:p-8">
      <PageHeader>
        <PageHeaderHeading>
          <PageTitle>Suppliers</PageTitle>
          <PageDescription>
            Manage your vendor relationships, contacts, and performance metrics.
          </PageDescription>
        </PageHeaderHeading>
        <PageActions>
          <Button variant="primary" iconLeft={Plus}>
            Add Supplier
          </Button>
        </PageActions>
      </PageHeader>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Active Suppliers"
          value="42"
          icon={Building2}
          delta={{ value: "+3 new this quarter", tone: "up" }}
        />
        <StatCard
          label="Avg Lead Time"
          value="18 days"
          icon={Clock}
          delta={{ value: "-2 days from last year", tone: "up" }}
        />
        <StatCard label="Avg Supplier Rating" value="4.6 / 5" icon={Star} />
        <StatCard label="Total Contacts" value="156" icon={Users} />
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-4 pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Supplier Database</CardTitle>
            <CardDescription>
              Directory of all vendors and manufacturing partners.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Input
              type="search"
              aria-label="Search suppliers"
              placeholder="Search suppliers..."
              iconLeft={Search}
              className="w-[200px] sm:w-[300px]"
            />
            <Button variant="outline">Filters</Button>
          </div>
        </CardHeader>
        <CardBody>
          <Table>
            <THead>
              <Tr>
                <Th>Supplier</Th>
                <Th>Contact Info</Th>
                <Th>Category</Th>
                <Th>Lead Time</Th>
                <Th>Rating</Th>
                <Th>Status</Th>
                <Th align="right">Actions</Th>
              </Tr>
            </THead>
            <TBody>
              {mockSuppliers.map((supplier) => (
                <Tr key={supplier.id}>
                  <Td>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8" data-shape="square">
                        <AvatarFallback className="text-xs">
                          {supplier.avatar}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col">
                        <span className="font-medium">{supplier.name}</span>
                        <span className="text-xs text-[var(--st-text-secondary)]">
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
                      <div className="flex items-center text-xs text-[var(--st-text-secondary)]">
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
