"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Plus, Search, MoreHorizontal, LayoutGrid } from "lucide-react";
import {
  PageHeader,
  ZoruPageHeading,
  ZoruPageTitle,
  ZoruPageDescription,
  ZoruPageActions,
  Button,
  Input,
  Card,
  CardContent,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  Badge,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/zoruui";

const MOCK_COLLECTIONS = [
  {
    id: "COL-001",
    title: "Summer Collection 2024",
    type: "Manual",
    productCount: 24,
    status: "active",
    image: "https://images.unsplash.com/photo-1523381210434-271e8be1f52b?w=800&q=80",
    updatedAt: "Oct 24, 2023",
  },
  {
    id: "COL-002",
    title: "New Arrivals",
    type: "Automated",
    productCount: 156,
    status: "active",
    image: "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=800&q=80",
    updatedAt: "Today",
  },
  {
    id: "COL-003",
    title: "Clearance Sale",
    type: "Automated",
    productCount: 89,
    status: "active",
    image: "https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=800&q=80",
    updatedAt: "Nov 12, 2023",
  },
  {
    id: "COL-004",
    title: "Home & Living",
    type: "Manual",
    productCount: 42,
    status: "draft",
    image: "https://images.unsplash.com/photo-1616046229478-9901c5536a45?w=800&q=80",
    updatedAt: "Dec 01, 2023",
  },
  {
    id: "COL-005",
    title: "Tech Gadgets",
    type: "Automated",
    productCount: 12,
    status: "active",
    image: "https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=800&q=80",
    updatedAt: "Jan 15, 2024",
  },
];

export default function CollectionsPage() {
  const params = useParams();
  const storefrontId = params.storefrontId as string;
  const [searchTerm, setSearchTerm] = useState("");

  const filteredCollections = MOCK_COLLECTIONS.filter((collection) =>
    collection.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge variant="success">Active</Badge>;
      case "draft":
        return <Badge variant="secondary">Draft</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="flex-1 space-y-6 p-8 w-full max-w-7xl mx-auto">
      <PageHeader>
        <ZoruPageHeading>
          <ZoruPageTitle>Collections</ZoruPageTitle>
          <ZoruPageDescription>
            Group your products into collections to make it easier for customers to find them by category.
          </ZoruPageDescription>
        </ZoruPageHeading>
        <ZoruPageActions>
          <Button variant="outline" className="mr-2">
            Import
          </Button>
          <Link href={`/dashboard/sabshop/${storefrontId}/collections/new`}>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Create Collection
            </Button>
          </Link>
        </ZoruPageActions>
      </PageHeader>

      <Card>
        <CardContent className="p-0">
          <div className="flex items-center justify-between p-4 border-b border-[var(--st-border)]">
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--st-text-tertiary)]" />
              <Input
                placeholder="Search collections..."
                className="pl-9 w-full"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2">
               <Button variant="ghost" size="icon">
                 <LayoutGrid className="h-4 w-4 text-[var(--st-text-secondary)]" />
               </Button>
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[80px]">Image</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Products</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Updated</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCollections.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center h-32 text-[var(--st-text-secondary)]">
                      No collections found.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredCollections.map((collection) => (
                    <TableRow key={collection.id}>
                      <TableCell>
                        <img 
                          src={collection.image} 
                          alt={collection.title}
                          className="w-12 h-12 rounded-md object-cover border border-[var(--st-border)]"
                        />
                      </TableCell>
                      <TableCell>
                        <div className="font-medium text-[var(--st-text)]">{collection.title}</div>
                        <div className="text-xs text-[var(--st-text-tertiary)]">{collection.id}</div>
                      </TableCell>
                      <TableCell>
                        <span className="text-[var(--st-text)]">{collection.productCount}</span>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="font-normal text-[11px]">
                          {collection.type}
                        </Badge>
                      </TableCell>
                      <TableCell>{getStatusBadge(collection.status)}</TableCell>
                      <TableCell className="text-[var(--st-text-secondary)] text-sm">{collection.updatedAt}</TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuItem>View on store</DropdownMenuItem>
                            <DropdownMenuItem>Edit Collection</DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-zoru-error">Delete</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
