'use client';

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
  cn,
  useZoruToast,
} from '@/components/zoruui';
import { useState, useTransition } from 'react';
import { Loader2, RefreshCw, Smartphone, Store, Mail } from 'lucide-react';

import type { Project } from '@/lib/definitions';
import type { WithId } from 'mongodb';

interface SyncContactsDialogProps {
  project: WithId<Project>;
  onSynced: () => void;
}

export function SyncContactsDialog({ project, onSynced }: SyncContactsDialogProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const { toast } = useZoruToast();
  const [source, setSource] = useState<string>('');

  const handleSync = () => {
    if (!source) {
      toast({ title: 'Error', description: 'Please select a source to sync from.', variant: 'destructive' });
      return;
    }

    startTransition(async () => {
      // Mocking an API call for syncing contacts
      await new Promise((resolve) => setTimeout(resolve, 1500));
      toast({ title: 'Sync started', description: 'Contacts are syncing in the background.' });
      setOpen(false);
      onSynced();
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <ZoruDialogTrigger asChild>
        <Button variant="outline" size="md">
          <RefreshCw className="h-4 w-4 mr-2" />
          Sync
        </Button>
      </ZoruDialogTrigger>
      <ZoruDialogContent className="sm:max-w-md">
        <ZoruDialogHeader>
          <ZoruDialogTitle>Sync Contacts</ZoruDialogTitle>
          <ZoruDialogDescription>
            Connect an external source to automatically sync contacts to your WaChat project.
          </ZoruDialogDescription>
        </ZoruDialogHeader>
        
        <div className="flex flex-col gap-4 py-4">
          <div className="flex flex-col gap-1.5">
            <Label>Source</Label>
            <Select value={source} onValueChange={setSource}>
              <ZoruSelectTrigger>
                <ZoruSelectValue placeholder="Select integration..." />
              </ZoruSelectTrigger>
              <ZoruSelectContent>
                <ZoruSelectItem value="google">
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    <span>Google Contacts</span>
                  </div>
                </ZoruSelectItem>
                <ZoruSelectItem value="shopify">
                  <div className="flex items-center gap-2">
                    <Store className="h-4 w-4" />
                    <span>Shopify Customers</span>
                  </div>
                </ZoruSelectItem>
                <ZoruSelectItem value="device">
                  <div className="flex items-center gap-2">
                    <Smartphone className="h-4 w-4" />
                    <span>Device Contacts (vCard)</span>
                  </div>
                </ZoruSelectItem>
              </ZoruSelectContent>
            </Select>
          </div>
          
          {source === 'google' && (
            <p className="text-[12px] text-zoru-ink-muted">
              We will require access to your Google account to fetch your contacts. You will be redirected to authenticate.
            </p>
          )}
          {source === 'shopify' && (
            <p className="text-[12px] text-zoru-ink-muted">
              Make sure your Shopify store is connected in Settings {'>'} Integrations.
            </p>
          )}
        </div>
        
        <ZoruDialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={handleSync} disabled={isPending || !source}>
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Syncing...
              </>
            ) : (
              'Start Sync'
            )}
          </Button>
        </ZoruDialogFooter>
      </ZoruDialogContent>
    </Dialog>
  );
}
