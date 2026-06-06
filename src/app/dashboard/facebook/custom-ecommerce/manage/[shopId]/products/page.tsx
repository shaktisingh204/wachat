"use client";

import { Alert, AlertDescription, AlertTitle, Button, EmptyState, Skeleton } from '@/components/sabcrm/20ui';
import {
  useEffect,
  useState,
  useTransition } from "react";
import { useParams } from "next/navigation";
import { AlertCircle,
  PlusCircle,
  ShoppingBag } from "lucide-react";

import {
  getEcommProducts,
  getEcommShopById,
  } from "@/app/actions/custom-ecommerce.actions";
import type { EcommProduct,
  EcommShop } from "@/lib/definitions";
import type { WithId } from "mongodb";

/**
 * /dashboard/facebook/custom-ecommerce/manage/[shopId]/products
 *
 * Product catalog — `ZoruCard` grid (one card per product) plus the
 * create / edit / delete dialogs. Same data fetchers + handlers, only
 * the visual layer is rebuilt with zoru atoms.
 */

import * as React from "react";

import { EcommProductCard } from "../../../_components/ecomm-product-card";
import { EcommProductDialog } from "../../../_components/ecomm-product-dialog";
import { SyncCustomProductsDialog } from "../../../_components/sync-custom-products-dialog";

function PageSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-9 w-40" />
      </div>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-80 w-full" />
        ))}
      </div>
    </div>
  );
}

export default function ProductsPage() {
  const params = useParams();
  const shopId = params?.shopId as string | undefined;
  const [shop, setShop] = useState<WithId<EcommShop> | null>(null);
  const [products, setProducts] = useState<WithId<EcommProduct>[]>([]);
  const [isLoading, startLoading] = useTransition();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] =
    useState<WithId<EcommProduct> | null>(null);

  const fetchData = React.useCallback(() => {
    if (!shopId) return;
    startLoading(async () => {
      const [shopData, productsData] = await Promise.all([
        getEcommShopById(shopId),
        getEcommProducts(shopId),
      ]);
      setShop(shopData);
      setProducts(productsData);
    });
  }, [shopId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleOpenDialog = (product: WithId<EcommProduct> | null) => {
    setEditingProduct(product);
    setIsDialogOpen(true);
  };

  if (isLoading && products.length === 0 && !shop) {
    return <PageSkeleton />;
  }

  if (!shop) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Shop not found</AlertTitle>
        <AlertDescription>
          Please select a valid shop to manage its products.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <>
      <EcommProductDialog
        isOpen={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        shop={shop}
        product={editingProduct}
        onSuccess={fetchData}
      />

      <div className="flex flex-col gap-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-[20px] tracking-tight text-[var(--st-text)]">
              Products
            </h2>
            <p className="text-[13px] text-[var(--st-text-secondary)]">
              Manage products for your custom shop.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {shop.projectId ? (
              <SyncCustomProductsDialog
                projectId={shop.projectId.toString()}
                shopId={shop._id.toString()}
              />
            ) : null}
            <Button onClick={() => handleOpenDialog(null)}>
              <PlusCircle />
              Add product
            </Button>
          </div>
        </div>

        {products.length > 0 ? (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {products.map((product) => (
              <EcommProductCard
                key={product._id.toString()}
                product={product}
                shopSettings={shop}
                onEdit={() => handleOpenDialog(product)}
                onDelete={fetchData}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={<ShoppingBag />}
            title="No products yet"
            description='Click "Add product" to get started.'
          />
        )}
      </div>
    </>
  );
}
