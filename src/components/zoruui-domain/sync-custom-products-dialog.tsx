'use client';

import {
  Dialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  ZoruDialogTrigger,
  Button,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  Label,
} from '@/components/sabcrm/20ui/compat';
import {
  useEffect,
  useState,
  useTransition } from 'react';

import { LoaderCircle, RefreshCw, Facebook } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getCatalogs, syncCatalogs } from '@/app/actions/catalog.actions';
import { syncProductsToMetaCatalog } from '@/app/actions/custom-ecommerce.actions';
import type { Catalog } from '@/lib/definitions';
import type { WithId } from 'mongodb';

interface SyncCustomProductsDialogProps {
  projectId: string;
  shopId: string;
}

export function SyncCustomProductsDialog({ projectId, shopId }: SyncCustomProductsDialogProps) {
  const [open, setOpen] = useState(false);
  const [catalogs, setCatalogs] = useState<WithId<Catalog>[]>([]);
  const [selectedCatalogId, setSelectedCatalogId] = useState<string>('');
  const [isLoading, startLoadingTransition] = useTransition();
  const [isSyncing, startSyncingTransition] = useTransition();
  const { toast } = useToast();

  const fetchAndSetCatalogs = async (showToast: boolean = false) => {
    startLoadingTransition(async () => {
      // Silently sync first to ensure list is fresh
      await syncCatalogs(projectId);
      const catalogsData = await getCatalogs(projectId);
      setCatalogs(catalogsData as any);
      if (showToast) {
        toast({ title: "Catalogs Refreshed" });
      }
    });
  };

  useEffect(() => {
    if (open) {
      fetchAndSetCatalogs();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, projectId]);

  const handleSync = async () => {
    if (!selectedCatalogId) {
      toast({ title: 'Error', description: 'Please select a catalog to sync to.', variant: 'destructive' });
      return;
    }
    startSyncingTransition(async () => {
      const result = await syncProductsToMetaCatalog(projectId, shopId, selectedCatalogId);
      if (result.error) {
        toast({ title: 'Sync Error', description: result.error, variant: 'destructive' });
      } else {
        toast({ title: 'Sync Complete', description: result.message });
        setOpen(false);
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <ZoruDialogTrigger asChild>
        <Button variant="outline">
          <Facebook className="mr-2 h-4 w-4" />
          Sync to Facebook Catalog
        </Button>
      </ZoruDialogTrigger>
      <ZoruDialogContent className="sm:max-w-md max-h-[85vh] flex flex-col overflow-hidden p-0">
        <ZoruDialogHeader className="px-6 pt-6 pb-2">
          <ZoruDialogTitle>Sync Products to Facebook</ZoruDialogTitle>
          <ZoruDialogDescription>
            Push your custom products to a Meta Catalog. This will create or update products based on their internal ID.
          </ZoruDialogDescription>
        </ZoruDialogHeader>
        <div className="flex-1 overflow-y-auto px-6 py-2">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="catalog-select">Target Catalog</Label>
              <div className="flex items-center gap-2">
                <Select value={selectedCatalogId} onValueChange={setSelectedCatalogId} disabled={isLoading}>
                  <ZoruSelectTrigger id="catalog-select">
                    <ZoruSelectValue placeholder="Select a catalog..." />
                  </ZoruSelectTrigger>
                  <ZoruSelectContent>
                    {catalogs.map((catalog) => (
                      <ZoruSelectItem key={catalog._id.toString()} value={catalog.metaCatalogId}>
                        {catalog.name}
                      </ZoruSelectItem>
                    ))}
                  </ZoruSelectContent>
                </Select>
                <Button variant="ghost" size="icon" onClick={() => fetchAndSetCatalogs(true)} disabled={isLoading}>
                  {isLoading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </div>
        </div>
        <ZoruDialogFooter className="px-6 pb-6 pt-2">
          <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button type="button" onClick={handleSync} disabled={isSyncing || !selectedCatalogId}>
            {isSyncing && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />}
            Sync Now
          </Button>
        </ZoruDialogFooter>
      </ZoruDialogContent>
    </Dialog>
  );
}
