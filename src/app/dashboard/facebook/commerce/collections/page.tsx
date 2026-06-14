"use client";

import { Alert, AlertDescription, AlertTitle, Button, Card, CardBody, CardDescription, CardHeader, CardTitle, DataTable, EmptyState, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Skeleton, useToast, type DataTableColumn } from '@/components/sabcrm/20ui';
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition } from "react";
import Link from "next/link";
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
 * (`getCatalogs` + `listProductSets` per catalog). Pure Ui20 primitives.
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
  const { toast } = useToast();

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

  const columns = useMemo<DataTableColumn<CollectionRow>[]>(
    () => [
      {
        key: "name",
        header: "Collection",
        render: (row) => (
          <span className="font-medium text-[var(--st-text)]">{row.name}</span>
        ),
      },
      {
        key: "catalogName",
        header: "Catalog",
        render: (row) => (
          <Link
            href={`/dashboard/facebook/commerce/products/${row.catalogId}`}
            className="text-[var(--st-text)] underline-offset-2 hover:underline"
          >
            {row.catalogName}
          </Link>
        ),
      },
      {
        key: "product_count",
        header: "Products",
        render: (row) => row.product_count ?? 0,
      },
      {
        key: "actions",
        header: <span className="sr-only">Actions</span>,
        render: (row) => (
          <div className="flex justify-end">
            <Button
              variant="ghost"
              size="sm"
              aria-label="Delete collection"
              onClick={() => setDeleteCollection(row)}
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
                  <SelectTrigger className="h-9 w-44">
                    <SelectValue placeholder="Pick a catalog" />
                  </SelectTrigger>
                  <SelectContent>
                    {catalogs.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
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
          <AlertTitle>No project selected</AlertTitle>
          <AlertDescription>
            Pick a Facebook Page project to manage its product collections.
          </AlertDescription>
        </Alert>
      ) : !isFacebookProject ? (
        <Alert variant="destructive" className="mt-6">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Invalid project type</AlertTitle>
          <AlertDescription>
            Collections live under Facebook Page projects. Switch to a
            Facebook project to continue.
          </AlertDescription>
        </Alert>
      ) : !hasCatalogAccess ? (
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Catalog management locked</CardTitle>
            <CardDescription>
              This project was set up without catalog management permissions.
              Re-authorize to grant <code>catalog_management</code> and{" "}
              <code>business_management</code>.
            </CardDescription>
          </CardHeader>
          <CardBody>
            <Button asChild>
              <Link href="/dashboard/facebook/all-projects">
                Re-authorize project
              </Link>
            </Button>
          </CardBody>
        </Card>
      ) : error ? (
        <Alert variant="destructive" className="mt-6">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Could not fetch collections</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
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
            rows={collections}
            getRowId={(_, i) => String(i)}
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
