"use client";

import {
  Alert,
  ZoruAlertDescription,
  ZoruAlertTitle,
  Badge,
  Button,
  Card,
  ZoruCardContent,
  ZoruCardDescription,
  ZoruCardHeader,
  ZoruCardTitle,
  DataTable,
  EmptyState,
  Skeleton,
} from '@/components/zoruui';
import {
  useCallback,
  useEffect,
  useState,
  useTransition,
  useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { useParams } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import {
  AlertCircle,
  ChevronLeft,
  Edit,
  Layers,
  PlusCircle,
  RefreshCw,
  ShoppingBag,
  Tags,
  Trash2,
  UploadCloud,
  } from "lucide-react";

import {
  getProductsForCatalog,
  listProductSets,
  } from "@/app/actions/catalog.actions";
import type { ProductSet } from "@/lib/definitions";

/**
 * /dashboard/facebook/commerce/products/[catalogId]
 *
 * Catalog detail — products + collections side-by-side, no tabs.
 * Same data shape as the previous incarnation:
 *   - getProductsForCatalog
 *   - listProductSets
 *   - addProductToCatalog (via dialog)
 *   - updateProductInCatalog (via dialog)
 *   - deleteProductFromCatalog (via dialog)
 *   - createProductSet (via dialog)
 *   - deleteProductSet (via dialog)
 *
 * Pure ZoruUI primitives + neutral tokens. Two distinct sections —
 * "Products" and "Collections" — replace the legacy tab UI per the
 * no-tab-ui directive.
 */

import * as React from "react";

import {
  CommerceBreadcrumb,
  CommerceHeader,
  CommercePage,
} from "../../../_components/commerce-shell";
import {
  CreateProductDialog,
  DeleteProductConfirmDialog,
  EditProductDialog,
  ViewTaggedMediaDialog,
  BulkUploadProductsDialog,
} from "../../../_components/commerce-product-dialogs";
import {
  CreateCollectionDialog,
  DeleteCollectionConfirmDialog,
} from "../../../_components/commerce-collection-dialogs";

type ProductRow = {
  id: string;
  retailer_id?: string;
  name?: string;
  image_url?: string;
  price?: number | string;
  currency?: string;
  inventory?: number;
  availability?: string;
  description?: string;
};

function CatalogDetailSkeleton() {
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
      <Skeleton className="mt-8 h-64 w-full" />
      <Skeleton className="mt-6 h-40 w-full" />
    </CommercePage>
  );
}

export default function CatalogDetailPage() {
  const params = useParams<{ catalogId: string }>();
  const catalogId = (params?.catalogId as string) ?? "";

  const [projectId, setProjectId] = useState<string | null>(null);
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [collections, setCollections] = useState<ProductSet[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, startLoading] = useTransition();

  // Dialog state
  const [createOpen, setCreateOpen] = useState(false);
  const [bulkUploadOpen, setBulkUploadOpen] = useState(false);
  const [editProduct, setEditProduct] = useState<ProductRow | null>(null);
  const [deleteProduct, setDeleteProduct] = useState<ProductRow | null>(null);
  const [taggedProduct, setTaggedProduct] = useState<ProductRow | null>(null);
  const [createCollectionOpen, setCreateCollectionOpen] = useState(false);
  const [deleteCollection, setDeleteCollection] = useState<ProductSet | null>(
    null,
  );

  const fetchData = useCallback(() => {
    const storedProjectId =
      typeof window !== "undefined"
        ? localStorage.getItem("activeProjectId")
        : null;
    if (!storedProjectId) {
      setError("No active project selected.");
      return;
    }
    if (!catalogId) return;
    setProjectId(storedProjectId);
    startLoading(async () => {
      const [productsResult, setsResult] = await Promise.all([
        getProductsForCatalog(catalogId, storedProjectId),
        listProductSets(catalogId, storedProjectId),
      ]);
      if ((productsResult as { error?: string })?.error) {
        setError((productsResult as { error?: string }).error ?? null);
      } else {
        setError(null);
      }
      setProducts(((productsResult as any).products as ProductRow[]) ?? []);
      // listProductSets returns ProductSet[] directly when ok, or { error } on failure
      const sets = Array.isArray(setsResult)
        ? (setsResult as ProductSet[])
        : ((setsResult as any)?.productSets as ProductSet[]) ?? [];
      setCollections(sets);
    });
  }, [catalogId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const productColumns = useMemo<ColumnDef<ProductRow>[]>(
    () => [
      {
        id: "image",
        header: () => <span className="sr-only">Image</span>,
        cell: ({ row }) => (
          <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-[var(--zoru-radius-sm)] border border-zoru-line bg-zoru-surface-2">
            {row.original.image_url ? (
              <Image
                src={row.original.image_url}
                alt={row.original.name ?? ""}
                width={48}
                height={48}
                className="h-full w-full object-cover"
              />
            ) : (
              <ShoppingBag className="h-5 w-5 text-zoru-ink-muted" />
            )}
          </div>
        ),
      },
      {
        accessorKey: "name",
        header: "Name",
        cell: ({ row }) => (
          <span className="font-medium text-zoru-ink">{row.original.name ?? "—"}</span>
        ),
      },
      {
        accessorKey: "price",
        header: "Price",
        cell: ({ row }) => {
          const price =
            typeof row.original.price === "number"
              ? row.original.price
              : Number(row.original.price);
          if (!Number.isFinite(price)) return <span>—</span>;
          return (
            <span>
              {new Intl.NumberFormat("en-US", {
                style: "currency",
                currency: row.original.currency || "USD",
              }).format(price / 100)}
            </span>
          );
        },
      },
      {
        accessorKey: "inventory",
        header: "Inventory",
        cell: ({ row }) =>
          typeof row.original.inventory === "number"
            ? row.original.inventory.toLocaleString()
            : "—",
      },
      {
        accessorKey: "availability",
        header: "Availability",
        cell: ({ row }) => {
          const a = row.original.availability;
          if (!a) return <span>—</span>;
          return (
            <Badge
              variant={a === "in_stock" ? "default" : "secondary"}
              className="capitalize"
            >
              {a.replace(/_/g, " ")}
            </Badge>
          );
        },
      },
      {
        accessorKey: "retailer_id",
        header: "SKU",
        cell: ({ row }) => (
          <span className="font-mono text-[11px] text-zoru-ink-muted">
            {row.original.retailer_id ?? "—"}
          </span>
        ),
      },
      {
        id: "actions",
        header: () => <span className="sr-only">Actions</span>,
        cell: ({ row }) => (
          <div className="flex justify-end gap-1">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Edit product"
              onClick={() => setEditProduct(row.original)}
            >
              <Edit />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="View tagged media"
              onClick={() => setTaggedProduct(row.original)}
            >
              <Tags />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Delete product"
              onClick={() => setDeleteProduct(row.original)}
            >
              <Trash2 />
            </Button>
          </div>
        ),
      },
    ],
    [],
  );

  const collectionColumns = useMemo<ColumnDef<ProductSet>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Collection",
        cell: ({ row }) => (
          <span className="font-medium text-zoru-ink">{row.original.name}</span>
        ),
      },
      {
        accessorKey: "product_count",
        header: "Products",
        cell: ({ row }) => (
          <span className="text-zoru-ink">
            {row.original.product_count ?? 0}
          </span>
        ),
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

  if (isLoading && products.length === 0 && collections.length === 0 && !error) {
    return <CatalogDetailSkeleton />;
  }

  return (
    <CommercePage>
      <CommerceBreadcrumb
        section="Products"
        parentLabel={catalogId}
        parentHref="/dashboard/facebook/commerce/products"
      />

      <div className="mt-2">
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="-ml-2 text-zoru-ink-muted"
        >
          <Link href="/dashboard/facebook/commerce/products">
            <ChevronLeft />
            Back to catalogs
          </Link>
        </Button>
      </div>

      <CommerceHeader
        eyebrow="Meta Suite › Commerce › Catalog"
        title="Catalog management"
        description="Manage products and collections within this Meta product catalog."
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={fetchData}
            disabled={isLoading}
          >
            <RefreshCw className={isLoading ? "animate-spin" : undefined} />
            Refresh
          </Button>
        }
      />

      {error ? (
        <Alert variant="destructive" className="mt-6">
          <AlertCircle className="h-4 w-4" />
          <ZoruAlertTitle>Could not load catalog</ZoruAlertTitle>
          <ZoruAlertDescription>{error}</ZoruAlertDescription>
        </Alert>
      ) : null}

      {/* ── Products ── */}
      <Card className="mt-6">
        <ZoruCardHeader className="flex flex-row items-start justify-between gap-3">
          <div>
            <ZoruCardTitle className="flex items-center gap-2 text-base">
              <ShoppingBag className="h-4 w-4" /> Products
            </ZoruCardTitle>
            <ZoruCardDescription>
              Items in this catalog. Products sync to Meta Commerce on save.
            </ZoruCardDescription>
          </div>
          {projectId ? (
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={() => setBulkUploadOpen(true)}>
                <UploadCloud className="mr-2 h-4 w-4" /> Bulk upload CSV
              </Button>
              <Button size="sm" onClick={() => setCreateOpen(true)}>
                <PlusCircle className="mr-2 h-4 w-4" />
                Add product
              </Button>
            </div>
          ) : null}
        </ZoruCardHeader>
        <ZoruCardContent>
          {products.length === 0 ? (
            <EmptyState
              compact
              icon={<ShoppingBag />}
              title="No products in this catalog"
              description="Add a product to get started, or push existing products from Commerce Manager."
              action={
                projectId ? (
                  <Button size="sm" onClick={() => setCreateOpen(true)}>
                    <PlusCircle />
                    Add product
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <DataTable
              columns={productColumns}
              data={products}
              filterColumn="name"
              filterPlaceholder="Search products…"
              pageSize={10}
            />
          )}
        </ZoruCardContent>
      </Card>

      {/* ── Collections ── */}
      <Card className="mt-6">
        <ZoruCardHeader className="flex flex-row items-start justify-between gap-3">
          <div>
            <ZoruCardTitle className="flex items-center gap-2 text-base">
              <Layers className="h-4 w-4" /> Collections
            </ZoruCardTitle>
            <ZoruCardDescription>
              Group products into sets for promotions and dynamic ads.
            </ZoruCardDescription>
          </div>
          {projectId ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setCreateCollectionOpen(true)}
            >
              <PlusCircle />
              New collection
            </Button>
          ) : null}
        </ZoruCardHeader>
        <ZoruCardContent>
          {collections.length === 0 ? (
            <EmptyState
              compact
              icon={<Layers />}
              title="No collections yet"
              description="Create a collection to organize products for promotions or browsing."
              action={
                projectId ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setCreateCollectionOpen(true)}
                  >
                    <PlusCircle />
                    New collection
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <DataTable
              columns={collectionColumns}
              data={collections}
              pageSize={10}
              showColumnMenu={false}
            />
          )}
        </ZoruCardContent>
      </Card>

      {/* ── Dialogs ── */}
      {projectId ? (
        <>
          <CreateProductDialog
            open={createOpen}
            onOpenChange={setCreateOpen}
            catalogId={catalogId}
            projectId={projectId}
            onCreated={fetchData}
          />
          <BulkUploadProductsDialog
            open={bulkUploadOpen}
            onOpenChange={setBulkUploadOpen}
            catalogId={catalogId}
            projectId={projectId}
            onUploaded={fetchData}
          />
          <EditProductDialog
            open={!!editProduct}
            onOpenChange={(o) => !o && setEditProduct(null)}
            product={editProduct}
            projectId={projectId}
            onUpdated={fetchData}
          />
          <DeleteProductConfirmDialog
            open={!!deleteProduct}
            onOpenChange={(o) => !o && setDeleteProduct(null)}
            product={deleteProduct}
            projectId={projectId}
            onDeleted={fetchData}
          />
          <ViewTaggedMediaDialog
            open={!!taggedProduct}
            onOpenChange={(o) => !o && setTaggedProduct(null)}
            product={taggedProduct}
            projectId={projectId}
          />
          <CreateCollectionDialog
            open={createCollectionOpen}
            onOpenChange={setCreateCollectionOpen}
            catalogId={catalogId}
            projectId={projectId}
            onCreated={fetchData}
          />
          <DeleteCollectionConfirmDialog
            open={!!deleteCollection}
            onOpenChange={(o) => !o && setDeleteCollection(null)}
            collection={deleteCollection}
            projectId={projectId}
            onDeleted={fetchData}
          />
        </>
      ) : null}
    </CommercePage>
  );
}
