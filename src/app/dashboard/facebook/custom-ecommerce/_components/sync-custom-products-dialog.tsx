"use client";

import {
  Button,
  Dialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  ZoruDialogTrigger,
  Label,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  useZoruToast,
} from '@/components/zoruui';
import {
  useEffect,
  useState,
  useTransition } from "react";
import { Facebook,
  LoaderCircle,
  RefreshCw } from "lucide-react";

import { getCatalogs,
  syncCatalogs } from "@/app/actions/catalog.actions";
import { syncProductsToMetaCatalog } from "@/app/actions/custom-ecommerce.actions";
import type { Catalog } from "@/lib/definitions";
import type { WithId } from "mongodb";

/**
 * Zoru-only replacement for
 * `@/components/wabasimplify/sync-custom-products-dialog`. Same external
 * props (`projectId`, `shopId`) and the same `syncProductsToMetaCatalog`
 * server action — only visuals change.
 */

import * as React from "react";

interface SyncCustomProductsDialogProps {
  projectId: string;
  shopId: string;
}

export function SyncCustomProductsDialog({
  projectId,
  shopId,
}: SyncCustomProductsDialogProps) {
  const [open, setOpen] = useState(false);
  const [catalogs, setCatalogs] = useState<WithId<Catalog>[]>([]);
  const [selectedCatalogId, setSelectedCatalogId] = useState<string>("");
  const [isLoading, startLoadingTransition] = useTransition();
  const [isSyncing, startSyncingTransition] = useTransition();
  const { toast } = useZoruToast();

  const fetchAndSetCatalogs = (showToast = false) => {
    startLoadingTransition(async () => {
      // Silently sync first to ensure list is fresh.
      await syncCatalogs(projectId);
      const data = await getCatalogs(projectId);
      setCatalogs(data as WithId<Catalog>[]);
      if (showToast) {
        toast({ title: "Catalogs refreshed" });
      }
    });
  };

  useEffect(() => {
    if (open) fetchAndSetCatalogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, projectId]);

  const handleSync = () => {
    if (!selectedCatalogId) {
      toast({
        title: "No catalog selected",
        description: "Pick a catalog to sync to first.",
        variant: "destructive",
      });
      return;
    }
    startSyncingTransition(async () => {
      const result = await syncProductsToMetaCatalog(
        projectId,
        shopId,
        selectedCatalogId,
      );
      if (result.error) {
        toast({
          title: "Sync failed",
          description: result.error,
          variant: "destructive",
        });
      } else {
        toast({ title: "Sync complete", description: result.message });
        setOpen(false);
      }
    });
  };

  return (
    <ZoruDialog open={open} onOpenChange={setOpen}>
      <ZoruDialogTrigger asChild>
        <ZoruButton variant="outline">
          <Facebook />
          Sync to Facebook catalog
        </ZoruButton>
      </ZoruDialogTrigger>
      <ZoruDialogContent className="sm:max-w-md">
        <ZoruDialogHeader>
          <ZoruDialogTitle>Sync products to Facebook</ZoruDialogTitle>
          <ZoruDialogDescription>
            Push your custom products to a Meta Catalog. This will create or
            update products based on their internal ID.
          </ZoruDialogDescription>
        </ZoruDialogHeader>
        <div className="space-y-2 py-2">
          <ZoruLabel htmlFor="catalog-select">Target catalog</ZoruLabel>
          <div className="flex items-center gap-2">
            <ZoruSelect
              value={selectedCatalogId}
              onValueChange={setSelectedCatalogId}
              disabled={isLoading}
            >
              <ZoruSelectTrigger id="catalog-select">
                <ZoruSelectValue placeholder="Select a catalog…" />
              </ZoruSelectTrigger>
              <ZoruSelectContent>
                {catalogs.map((catalog) => (
                  <ZoruSelectItem
                    key={catalog._id.toString()}
                    value={catalog.metaCatalogId}
                  >
                    {catalog.name}
                  </ZoruSelectItem>
                ))}
              </ZoruSelectContent>
            </ZoruSelect>
            <ZoruButton
              variant="ghost"
              size="icon"
              onClick={() => fetchAndSetCatalogs(true)}
              disabled={isLoading}
              aria-label="Refresh catalogs"
            >
              {isLoading ? (
                <LoaderCircle className="animate-spin" />
              ) : (
                <RefreshCw />
              )}
            </ZoruButton>
          </div>
        </div>
        <ZoruDialogFooter>
          <ZoruButton
            type="button"
            variant="ghost"
            onClick={() => setOpen(false)}
          >
            Cancel
          </ZoruButton>
          <ZoruButton
            type="button"
            onClick={handleSync}
            disabled={isSyncing || !selectedCatalogId}
          >
            {isSyncing ? <LoaderCircle className="animate-spin" /> : null}
            Sync now
          </ZoruButton>
        </ZoruDialogFooter>
      </ZoruDialogContent>
    </ZoruDialog>
  );
}
