"use client";

import { Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, useToast } from '@/components/sabcrm/20ui/compat';
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
 * `@/components/zoruui-domain/sync-custom-products-dialog`. Same external
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
  const { toast } = useToast();

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
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Facebook />
          Sync to Facebook catalog
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Sync products to Facebook</DialogTitle>
          <DialogDescription>
            Push your custom products to a Meta Catalog. This will create or
            update products based on their internal ID.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2 py-2">
          <Label htmlFor="catalog-select">Target catalog</Label>
          <div className="flex items-center gap-2">
            <Select
              value={selectedCatalogId}
              onValueChange={setSelectedCatalogId}
              disabled={isLoading}
            >
              <SelectTrigger id="catalog-select">
                <SelectValue placeholder="Select a catalog…" />
              </SelectTrigger>
              <SelectContent>
                {catalogs.map((catalog) => (
                  <SelectItem
                    key={catalog._id.toString()}
                    value={catalog.metaCatalogId}
                  >
                    {catalog.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
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
            </Button>
          </div>
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={() => setOpen(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSync}
            disabled={isSyncing || !selectedCatalogId}
          >
            {isSyncing ? <LoaderCircle className="animate-spin" /> : null}
            Sync now
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
