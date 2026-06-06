"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Plus, Search, MoreHorizontal, Filter } from "lucide-react";
import { PageHeader, PageHeading, PageTitle, PageDescription, PageActions, Button, Input, Card, CardBody, Table, THead, TBody, Tr, Th, Td, Badge, DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/sabcrm/20ui';

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
        return <Badge variant="success">Active</Badge>;
      case "draft":
        return <Badge variant="secondary">Draft</Badge>;
      case "out_of_stock":
        return <Badge variant="destructive">Out of Stock</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
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
          <Button variant="outline" className="mr-2">
            Export
          </Button>
          <Link href={`/dashboard/sabshop/${storefrontId}/products/new`}>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Add Product
            </Button>
          </Link>
        </PageActions>
      </PageHeader>

      <Card>
        <CardBody className="p-0">
          <div className="flex flex-col sm:flex-row items-center justify-between p-4 border-b border-[var(--st-border)] gap-4">
            <div className="relative w-full sm:max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--st-text-tertiary)]" />
              <Input
                placeholder="Search products..."
                className="pl-9 w-full"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[140px]">
                  <Filter className="w-4 h-4 mr-2 text-[var(--st-text-tertiary)]" />
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
            <Table>
              <THead>
                <Tr>
                  <Th className="w-[80px]">Image</Th>
                  <Th>Product</Th>
                  <Th>Status</Th>
                  <Th>Inventory</Th>
                  <Th>Type</Th>
                  <Th className="text-right">Price</Th>
                  <Th className="w-[50px]"></Th>
                </Tr>
              </THead>
              <TBody>
                {filteredProducts.length === 0 ? (
                  <Tr>
                    <Td colSpan={7} className="text-center h-32 text-[var(--st-text-secondary)]">
                      No products found.
                    </Td>
                  </Tr>
                ) : (
                  filteredProducts.map((product) => (
                    <Tr key={product.id}>
                      <Td>
                        <img 
                          src={product.image} 
                          alt={product.title}
                          className="w-12 h-12 rounded-md object-cover border border-[var(--st-border)]"
                        />
                      </Td>
                      <Td>
                        <div className="font-medium text-[var(--st-text)]">{product.title}</div>
                        <div className="text-xs text-[var(--st-text-tertiary)]">{product.id}</div>
                      </Td>
                      <Td>{getStatusBadge(product.status)}</Td>
                      <Td>
                        <span className={product.inventory === 0 ? "text-[var(--st-danger)] font-medium" : "text-[var(--st-text)]"}>
                          {product.inventory} in stock
                        </span>
                      </Td>
                      <Td className="text-[var(--st-text-secondary)]">{product.type}</Td>
                      <Td className="text-right font-medium">{product.price}</Td>
                      <Td>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuItem>Edit Product</DropdownMenuItem>
                            <DropdownMenuItem>Duplicate</DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-[var(--st-danger)]">Delete</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </Td>
                    </Tr>
                  ))
                )}
              </TBody>
            </Table>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
