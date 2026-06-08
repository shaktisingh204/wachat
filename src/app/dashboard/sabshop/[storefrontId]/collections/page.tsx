"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Folder, LayoutGrid, MoreHorizontal, Plus, Search } from "lucide-react";
import {
  PageHeader,
  PageHeading,
  PageTitle,
  PageDescription,
  PageActions,
  Button,
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
  type BadgeTone,
  EmptyState,
  IconButton,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/sabcrm/20ui";

type CollectionStatus = "active" | "draft";

const COLLECTIONS: Array<{
  id: string;
  title: string;
  type: "Manual" | "Automated";
  productCount: number;
  status: CollectionStatus;
  updatedAt: string;
}> = [
  { id: "COL-001", title: "Summer 2026", type: "Manual", productCount: 24, status: "active", updatedAt: "Oct 24, 2025" },
  { id: "COL-002", title: "New arrivals", type: "Automated", productCount: 156, status: "active", updatedAt: "Today" },
  { id: "COL-003", title: "Clearance", type: "Automated", productCount: 89, status: "active", updatedAt: "Nov 12, 2025" },
  { id: "COL-004", title: "Home and living", type: "Manual", productCount: 42, status: "draft", updatedAt: "Dec 1, 2025" },
  { id: "COL-005", title: "Tech gadgets", type: "Automated", productCount: 12, status: "active", updatedAt: "Jan 15, 2026" },
];

const STATUS_META: Record<CollectionStatus, { tone: BadgeTone; label: string }> = {
  active: { tone: "success", label: "Active" },
  draft: { tone: "neutral", label: "Draft" },
};

export default function CollectionsPage() {
  const params = useParams();
  const storefrontId = params.storefrontId as string;
  const [searchTerm, setSearchTerm] = useState("");

  const filtered = useMemo(
    () =>
      COLLECTIONS.filter((collection) =>
        collection.title.toLowerCase().includes(searchTerm.toLowerCase()),
      ),
    [searchTerm],
  );

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <PageHeader>
        <PageHeading>
          <PageTitle>Collections</PageTitle>
          <PageDescription>
            Group products into collections so customers can browse by category.
          </PageDescription>
        </PageHeading>
        <PageActions>
          <Button variant="outline">Import</Button>
          <Button asChild variant="primary">
            <Link href={`/dashboard/sabshop/${storefrontId}/collections/new`}>
              <Plus size={14} aria-hidden="true" />
              Create collection
            </Link>
          </Button>
        </PageActions>
      </PageHeader>

      <Card padding="none">
        <CardBody>
          <div className="flex items-center justify-between gap-4 border-b border-[var(--st-border)] p-4">
            <div className="w-full max-w-sm">
              <Input
                type="search"
                placeholder="Search collections"
                aria-label="Search collections"
                iconLeft={Search}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <IconButton label="Grid view" icon={LayoutGrid} variant="ghost" />
          </div>

          <div className="overflow-x-auto">
            {filtered.length === 0 ? (
              <EmptyState
                icon={Folder}
                title="No collections found"
                description="Adjust your search, or create your first collection."
                action={
                  <Button asChild variant="primary">
                    <Link href={`/dashboard/sabshop/${storefrontId}/collections/new`}>
                      <Plus size={14} aria-hidden="true" />
                      Create collection
                    </Link>
                  </Button>
                }
              />
            ) : (
              <Table hover>
                <THead>
                  <Tr>
                    <Th>Collection</Th>
                    <Th align="right">Products</Th>
                    <Th>Type</Th>
                    <Th>Status</Th>
                    <Th>Last updated</Th>
                    <Th width={56}>
                      <span className="sr-only">Actions</span>
                    </Th>
                  </Tr>
                </THead>
                <TBody>
                  {filtered.map((collection) => (
                    <Tr key={collection.id}>
                      <Td>
                        <div className="flex items-center gap-3">
                          <span
                            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--st-radius)] bg-[var(--st-bg-secondary)] text-[var(--st-text-secondary)] ring-1 ring-inset ring-[var(--st-border)]"
                            aria-hidden="true"
                          >
                            <Folder size={16} />
                          </span>
                          <div className="min-w-0">
                            <div className="truncate font-medium text-[var(--st-text)]">
                              {collection.title}
                            </div>
                            <div className="text-xs tabular-nums text-[var(--st-text-tertiary)]">
                              {collection.id}
                            </div>
                          </div>
                        </div>
                      </Td>
                      <Td align="right" className="tabular-nums text-[var(--st-text)]">
                        {collection.productCount}
                      </Td>
                      <Td>
                        <Badge tone="neutral" kind="outline">
                          {collection.type}
                        </Badge>
                      </Td>
                      <Td>
                        <Badge tone={STATUS_META[collection.status].tone}>
                          {STATUS_META[collection.status].label}
                        </Badge>
                      </Td>
                      <Td className="text-[var(--st-text-secondary)]">{collection.updatedAt}</Td>
                      <Td>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <IconButton
                              label={`Actions for ${collection.title}`}
                              icon={MoreHorizontal}
                              variant="ghost"
                              size="sm"
                            />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuItem>View on store</DropdownMenuItem>
                            <DropdownMenuItem>Edit collection</DropdownMenuItem>
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
