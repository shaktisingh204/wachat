"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Plus, Search, MoreHorizontal, Filter, Download, Package } from "lucide-react";
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
  Table,
  THead,
  TBody,
  Tr,
  Th,
  Td,
  Badge,
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

const MOCK_PRODUCTS = [
  {
    id: "PROD-1001",
    title: "Premium Wireless Headphones",
    price: "$299.99",
    inventory: 45,
    status: "active",
    type: "Electronics",
    image: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&q=80",
  },
  {
    id: "PROD-1002",
    title: "Minimalist Mechanical Keyboard",
    price: "$149.00",
    inventory: 12,
    status: "active",
    type: "Electronics",
    image: "https://images.unsplash.com/photo-1595225476474-87563907a212?w=800&q=80",
  },
  {
    id: "PROD-1003",
    title: "Ergonomic Office Chair",
    price: "$399.00",
    inventory: 0,
    status: "out_of_stock",
    type: "Furniture",
    image: "https://images.unsplash.com/photo-1505843490538-5133c6c7d0e1?w=800&q=80",
  },
  {
    id: "PROD-1004",
    title: "Leather Messenger Bag",
    price: "$129.50",
    inventory: 8,
    status: "draft",
    type: "Accessories",
    image: "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=800&q=80",
  },
  {
    id: "PROD-1005",
    title: "Smart Home Security Camera",
    price: "$199.99",
    inventory: 156,
    status: "active",
    type: "Smart Home",
    image: "https://images.unsplash.com/photo-1558089687-f282ffcbc126?w=800&q=80",
  },
];

export default function ProductsPage() {
  const params = useParams();
  const storefrontId = params.storefrontId as string;
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const filteredProducts = MOCK_PRODUCTS.filter((product) => {
    const matchesSearch = product.title.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || product.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge tone="success">Active</Badge>;
      case "draft":
        return <Badge tone="neutral">Draft</Badge>;
      case "out_of_stock":
        return <Badge tone="danger">Out of Stock</Badge>;
      default:
        return <Badge tone="neutral" kind="outline">{status}</Badge>;
    }
  };

  return (
    <div className="flex-1 space-y-6 p-8 w-full max-w-7xl mx-auto">
      <PageHeader>
        <PageHeading>
          <PageTitle>Products</PageTitle>
          <PageDescription>
            Manage your product inventory, pricing, and variants.
          </PageDescription>
        </PageHeading>
        <PageActions>
          <Button variant="outline" iconLeft={Download}>
            Export
          </Button>
          <Link href={`/dashboard/sabshop/${storefrontId}/products/new`}>
            <Button variant="primary" iconLeft={Plus}>
              Add Product
            </Button>
          </Link>
        </PageActions>
      </PageHeader>

      <Card padding="none">
        <CardBody>
          <div className="flex flex-col sm:flex-row items-center justify-between p-4 border-b border-[var(--st-border)] gap-4">
            <div className="w-full sm:max-w-sm">
              <Input
                type="search"
                placeholder="Search products..."
                aria-label="Search products"
                iconLeft={Search}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger aria-label="Filter by status" className="w-[160px]">
                  <Filter className="w-4 h-4 mr-2 text-[var(--st-text-tertiary)]" aria-hidden="true" />
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="out_of_stock">Out of Stock</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="overflow-x-auto">
            {filteredProducts.length === 0 ? (
              <EmptyState
                icon={Package}
                title="No products found"
                description="Try adjusting your search or status filter, or add a new product to get started."
              />
            ) : (
              <Table>
                <THead>
                  <Tr>
                    <Th width={80}>Image</Th>
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
                  {filteredProducts.map((product) => (
                    <Tr key={product.id}>
                      <Td>
                        <img
                          src={product.image}
                          alt={product.title}
                          className="w-12 h-12 rounded-[var(--st-radius)] object-cover border border-[var(--st-border)]"
                        />
                      </Td>
                      <Td>
                        <div className="font-medium text-[var(--st-text)]">{product.title}</div>
                        <div className="text-xs text-[var(--st-text-tertiary)]">{product.id}</div>
                      </Td>
                      <Td>{getStatusBadge(product.status)}</Td>
                      <Td>
                        <span
                          className={
                            product.inventory === 0
                              ? "text-[var(--st-danger)] font-medium"
                              : "text-[var(--st-text)]"
                          }
                        >
                          {product.inventory} in stock
                        </span>
                      </Td>
                      <Td className="text-[var(--st-text-secondary)]">{product.type}</Td>
                      <Td align="right" className="font-medium">{product.price}</Td>
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
                            <DropdownMenuItem>Edit Product</DropdownMenuItem>
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
