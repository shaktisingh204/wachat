"use client";

import {
  Alert,
  ZoruAlertDescription,
  ZoruAlertTitle,
  Button,
  Card,
  ZoruCardContent,
  ZoruCardDescription,
  ZoruCardHeader,
  ZoruCardTitle,
  DataTable,
  EmptyState,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  Skeleton,
  useZoruToast,
} from '@/components/zoruui';
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition } from "react";
import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import { AlertCircle,
  ExternalLink,
  Layers,
  PlusCircle,
  RefreshCw,
  Trash2 } from "lucide-react";

import { getCatalogs,
  listProductSets } from "@/app/actions/catalog.actions";
import { useProject } from "@/context/project-context";
import type { ProductSet } from "@/lib/definitions";

/**
 * /dashboard/facebook/commerce/collections — Meta Suite Commerce
 * collections.
 *
 * Aggregates product sets across every catalog on the active Facebook
 * project. Same data sources as the per-catalog detail page
 * (`getCatalogs` + `listProductSets` per catalog). Pure ZoruUI primitives.
 */

import * as React from "react";

import {
  CommerceBreadcrumb,
  CommerceHeader,
  CommercePage,
} from "../../_components/commerce-shell";
import {
  CreateCollectionDialog,
  DeleteCollectionConfirmDialog,
} from "../../_components/commerce-collection-dialogs";

type CatalogOption = { id: string; name: string };

type CollectionRow = ProductSet & {
  catalogId: string;
  catalogName: string;
};

function CollectionsSkeleton() {
  return (
    <CommercePage>
      <Skeleton className="h-3 w-72" />
      <div className="mt-5 flex items-end justify-between">
        <div className="space-y-3">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-8 w-72" />
          <Skeleton className="h-4 w-96" />
        </div>
        <Skeleton className="h-9 w-32" />
      </div>
      <Skeleton className="mt-8 h-72 w-full" />
    </CommercePage>
  );
}

export default function CommerceCollectionsPage() {
  const { activeProject, activeProjectId, isLoadingProject } = useProject();
  const { toast } = useZoruToast();

  const [catalogs, setCatalogs] = useState<CatalogOption[]>([]);
  const [collections, setCollections] = useState<CollectionRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, startLoading] = useTransition();

  const [createOpen, setCreateOpen] = useState(false);
  const [createCatalogId, setCreateCatalogId] = useState<string>("");
  const [deleteCollection, setDeleteCollection] = useState<CollectionRow | null>(
    null,
  );

  const fetchData = useCallback(() => {
    if (!activeProjectId) return;
    startLoading(async () => {
      const result = await getCatalogs(activeProjectId);
      if (result.error) {
        setError(result.error);
        setCatalogs([]);
        setCollections([]);
        return;
      }
      const cats = (result.catalogs ?? []) as CatalogOption[];
      setCatalogs(cats);
      // Default the create-target to the first catalog.
      if (cats.length > 0 && !createCatalogId) {
        setCreateCatalogId(cats[0].id);
      }
      // Fan-out: pull product sets per catalog in parallel.
      const buckets = await Promise.all(
        cats.map(async (cat) => {
          const sets = await listProductSets(cat.id, activeProjectId);
          if (Array.isArray(sets)) {
            return (sets as ProductSet[]).map<CollectionRow>((s) => ({
              ...s,
              catalogId: cat.id,
              catalogName: cat.name,
            }));
          }
          return [];
        }),
      );
      setCollections(buckets.flat());
      setError(null);
    });
  }, [activeProjectId, createCatalogId]);

  useEffect(() => {
    if (activeProjectId) fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeProjectId]);

  const isFacebookProject =
    !!activeProject?.facebookPageId && !activeProject?.wabaId;
  const hasCatalogAccess = activeProject?.hasCatalogManagement === true;

  const columns = useMemo<ColumnDef<CollectionRow>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Collection",
        cell: ({ row }) => (
          <span className="font-medium text-zoru-ink">{row.original.name}</span>
        ),
      },
      {
        accessorKey: "catalogName",
        header: "Catalog",
        cell: ({ row }) => (
          <Link
            href={`/dashboard/facebook/commerce/products/${row.original.catalogId}`}
            className="text-zoru-ink underline-offset-2 hover:underline"
          >
            {row.original.catalogName}
          </Link>
        ),
      },
      {
        accessorKey: "product_count",
        header: "Products",
        cell: ({ row }) => row.original.product_count ?? 0,
      },
      {
        id: "actions",
        header: () => <span className="sr-only">Actions</span>,
        cell: ({ row }) => (
          <div className="flex justify-end">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Delete collection"
              onClick={() => setDeleteCollection(row.original)}
            >
              <Trash2 />
            </Button>
          </div>
        ),
      },
    ],
    [],
  );

  if (isLoadingProject) {
    return <CollectionsSkeleton />;
  }

  return (
    <CommercePage>
      <CommerceBreadcrumb section="Commerce" pageLabel="Collections" />
      <CommerceHeader
        eyebrow="Meta Suite › Commerce"
        title="Collections"
        description="Group products from any catalog into sets for promotions, dynamic ads and easier browsing."
        actions={
          activeProjectId && isFacebookProject && hasCatalogAccess ? (
            <div className="flex items-center gap-2">
              {catalogs.length > 0 ? (
                <Select
                  value={createCatalogId}
                  onValueChange={setCreateCatalogId}
                >
                  <ZoruSelectTrigger className="h-9 w-44">
                    <ZoruSelectValue placeholder="Pick a catalog" />
                  </ZoruSelectTrigger>
                  <ZoruSelectContent>
                    {catalogs.map((c) => (
                      <ZoruSelectItem key={c.id} value={c.id}>
                        {c.name}
                      </ZoruSelectItem>
                    ))}
                  </ZoruSelectContent>
                </Select>
              ) : null}
              <Button
                size="sm"
                variant="outline"
                onClick={fetchData}
                disabled={isLoading}
              >
                <RefreshCw
                  className={isLoading ? "animate-spin" : undefined}
                />
                Refresh
              </Button>
              <Button
                size="sm"
                disabled={!createCatalogId}
                onClick={() => {
                  if (!createCatalogId) {
                    toast({
                      title: "Select a catalog",
                      description: "Pick a catalog before creating a collection.",
                      variant: "destructive",
                    });
                    return;
                  }
                  setCreateOpen(true);
                }}
              >
                <PlusCircle />
                New collection
              </Button>
            </div>
          ) : undefined
        }
      />

      {!activeProjectId ? (
        <Alert variant="destructive" className="mt-6">
          <AlertCircle className="h-4 w-4" />
          <ZoruAlertTitle>No project selected</ZoruAlertTitle>
          <ZoruAlertDescription>
            Pick a Facebook Page project to manage its product collections.
          </ZoruAlertDescription>
        </Alert>
      ) : !isFacebookProject ? (
        <Alert variant="destructive" className="mt-6">
          <AlertCircle className="h-4 w-4" />
          <ZoruAlertTitle>Invalid project type</ZoruAlertTitle>
          <ZoruAlertDescription>
            Collections live under Facebook Page projects. Switch to a
            Facebook project to continue.
          </ZoruAlertDescription>
        </Alert>
      ) : !hasCatalogAccess ? (
        <Card className="mt-8">
          <ZoruCardHeader>
            <ZoruCardTitle>Catalog management locked</ZoruCardTitle>
            <ZoruCardDescription>
              This project was set up without catalog management permissions.
              Re-authorize to grant <code>catalog_management</code> and{" "}
              <code>business_management</code>.
            </ZoruCardDescription>
          </ZoruCardHeader>
          <ZoruCardContent>
            <Button asChild>
              <Link href="/dashboard/facebook/all-projects">
                Re-authorize project
              </Link>
            </Button>
          </ZoruCardContent>
        </Card>
      ) : error ? (
        <Alert variant="destructive" className="mt-6">
          <AlertCircle className="h-4 w-4" />
          <ZoruAlertTitle>Could not fetch collections</ZoruAlertTitle>
          <ZoruAlertDescription>{error}</ZoruAlertDescription>
        </Alert>
      ) : isLoading && collections.length === 0 ? (
        <CollectionsSkeleton />
      ) : catalogs.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            icon={<Layers />}
            title="No catalogs found"
            description="Create a catalog in Meta Commerce Manager to start organizing products into collections."
            action={
              <Button asChild size="sm" variant="outline">
                <a
                  href="https://business.facebook.com/commerce_manager/"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Open Commerce Manager <ExternalLink />
                </a>
              </Button>
            }
          />
        </div>
      ) : collections.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            icon={<Layers />}
            title="No collections yet"
            description="Create a collection within one of your catalogs to organize products for promotions or browsing."
            action={
              createCatalogId ? (
                <Button size="sm" onClick={() => setCreateOpen(true)}>
                  <PlusCircle />
                  New collection
                </Button>
              ) : undefined
            }
          />
        </div>
      ) : (
        <div className="mt-8">
          <DataTable
            columns={columns}
            data={collections}
            filterColumn="name"
            filterPlaceholder="Search collections…"
            pageSize={10}
          />
        </div>
      )}

      {/* ── Dialogs ── */}
      {activeProjectId && createCatalogId ? (
        <CreateCollectionDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          catalogId={createCatalogId}
          projectId={activeProjectId}
          onCreated={fetchData}
        />
      ) : null}
      {activeProjectId ? (
        <DeleteCollectionConfirmDialog
          open={!!deleteCollection}
          onOpenChange={(o) => !o && setDeleteCollection(null)}
          collection={deleteCollection}
          projectId={activeProjectId}
          onDeleted={fetchData}
        />
      ) : null}
    </CommercePage>
  );
}
