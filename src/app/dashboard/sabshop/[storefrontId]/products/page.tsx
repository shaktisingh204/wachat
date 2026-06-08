"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  AlertTriangle,
  Boxes,
  CircleSlash,
  Download,
  Filter,
  MoreHorizontal,
  Package,
  Plus,
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
  Input,
  Card,
  CardBody,
  StatCard,
  Table,
  THead,
  TBody,
  Tr,
  Th,
  Td,
  Badge,
  type BadgeTone,
  EmptyState,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/sabcrm/20ui";

type ProductStatus = "active" | "draft" | "out_of_stock";

const PRODUCTS: Array<{
  id: string;
  title: string;
  price: number;
  inventory: number;
  status: ProductStatus;
  type: string;
}> = [
  { id: "PRD-1001", title: "Aura wireless headphones", price: 24999, inventory: 45, status: "active", type: "Electronics" },
  { id: "PRD-1002", title: "Lumen mechanical keyboard", price: 12400, inventory: 12, status: "active", type: "Electronics" },
  { id: "PRD-1003", title: "Atlas ergonomic chair", price: 33150, inventory: 0, status: "out_of_stock", type: "Furniture" },
  { id: "PRD-1004", title: "Northwind leather satchel", price: 10750, inventory: 8, status: "draft", type: "Accessories" },
  { id: "PRD-1005", title: "Sentry home camera", price: 16599, inventory: 156, status: "active", type: "Smart home" },
];

const STATUS_META: Record<ProductStatus, { tone: BadgeTone; label: string }> = {
  active: { tone: "success", label: "Active" },
  draft: { tone: "neutral", label: "Draft" },
  out_of_stock: { tone: "danger", label: "Out of stock" },
};

function inr(n: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n);
}

export default function ProductsPage() {
  const params = useParams();
  const storefrontId = params.storefrontId as string;
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const filtered = useMemo(
    () =>
      PRODUCTS.filter((product) => {
        const matchesSearch = product.title
          .toLowerCase()
          .includes(searchTerm.toLowerCase());
        const matchesStatus =
          statusFilter === "all" || product.status === statusFilter;
        return matchesSearch && matchesStatus;
      }),
    [searchTerm, statusFilter],
  );

  const activeCount = PRODUCTS.filter((p) => p.status === "active").length;
  const lowStock = PRODUCTS.filter((p) => p.inventory > 0 && p.inventory <= 12).length;
  const outOfStock = PRODUCTS.filter((p) => p.inventory === 0).length;

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <PageHeader>
        <PageHeading>
          <PageTitle>Products</PageTitle>
          <PageDescription>
            Manage product listings, pricing, and inventory.
          </PageDescription>
        </PageHeading>
        <PageActions>
          <Button variant="outline" iconLeft={Download}>
            Export
          </Button>
          <Button asChild variant="primary">
            <Link href={`/dashboard/sabshop/${storefrontId}/products/new`}>
              <Plus size={14} aria-hidden="true" />
              Add product
            </Link>
          </Button>
        </PageActions>
      </PageHeader>

      <section aria-label="Inventory summary" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total products"
          value={<span className="tabular-nums">{PRODUCTS.length}</span>}
          icon={Boxes}
          accent="#3b7af5"
        />
        <StatCard
          label="Active"
          value={<span className="tabular-nums">{activeCount}</span>}
          icon={Package}
          accent="#1f9d55"
        />
        <StatCard
          label="Low stock"
          value={<span className="tabular-nums">{lowStock}</span>}
          icon={AlertTriangle}
          accent="#d97706"
        />
        <StatCard
          label="Out of stock"
          value={<span className="tabular-nums">{outOfStock}</span>}
          icon={CircleSlash}
          accent="#c13c2c"
        />
      </section>

      <Card padding="none">
        <CardBody>
          <div className="flex flex-col items-center justify-between gap-4 border-b border-[var(--st-border)] p-4 sm:flex-row">
            <div className="w-full sm:max-w-sm">
              <Input
                type="search"
                placeholder="Search products"
                aria-label="Search products"
                iconLeft={Search}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex w-full items-center gap-2 sm:w-auto">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger aria-label="Filter by status" className="w-[160px]">
                  <Filter className="mr-2 h-4 w-4 text-[var(--st-text-tertiary)]" aria-hidden="true" />
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="out_of_stock">Out of stock</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="overflow-x-auto">
            {filtered.length === 0 ? (
              <EmptyState
                icon={Package}
                title="No products found"
                description="Adjust your search or status filter, or add a new product to get started."
                action={
                  <Button asChild variant="primary">
                    <Link href={`/dashboard/sabshop/${storefrontId}/products/new`}>
                      <Plus size={14} aria-hidden="true" />
                      Add product
                    </Link>
                  </Button>
                }
              />
            ) : (
              <Table hover>
                <THead>
                  <Tr>
                    <Th>Product</Th>
                    <Th>Status</Th>
                    <Th>Inventory</Th>
                    <Th>Type</Th>
                    <Th align="right">Price</Th>
                    <Th width={56}>
                      <span className="sr-only">Actions</span>
                    </Th>
                  </Tr>
                </THead>
                <TBody>
                  {filtered.map((product) => (
                    <Tr key={product.id}>
                      <Td>
                        <div className="flex items-center gap-3">
                          <span
                            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--st-radius)] bg-[var(--st-bg-secondary)] text-[var(--st-text-secondary)] ring-1 ring-inset ring-[var(--st-border)]"
                            aria-hidden="true"
                          >
                            <Package size={16} />
                          </span>
                          <div className="min-w-0">
                            <div className="truncate font-medium text-[var(--st-text)]">
                              {product.title}
                            </div>
                            <div className="text-xs tabular-nums text-[var(--st-text-tertiary)]">
                              {product.id}
                            </div>
                          </div>
                        </div>
                      </Td>
                      <Td>
                        <Badge tone={STATUS_META[product.status].tone}>
                          {STATUS_META[product.status].label}
                        </Badge>
                      </Td>
                      <Td>
                        <span
                          className={
                            product.inventory === 0
                              ? "font-medium tabular-nums text-[var(--st-danger)]"
                              : "tabular-nums text-[var(--st-text)]"
                          }
                        >
                          {product.inventory} in stock
                        </span>
                      </Td>
                      <Td className="text-[var(--st-text-secondary)]">{product.type}</Td>
                      <Td align="right" className="font-medium tabular-nums">
                        {inr(product.price)}
                      </Td>
                      <Td>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <IconButton
                              label={`Actions for ${product.title}`}
                              icon={MoreHorizontal}
                              variant="ghost"
                              size="sm"
                            />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuItem>Edit product</DropdownMenuItem>
                            <DropdownMenuItem>Duplicate</DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem variant="danger">Delete</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </Td>
                    </Tr>
                  ))}
                </TBody>
              </Table>
            )}
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
