'use client';

import {
  Button,
  Modal,
  Field,
  Select,
  useToast,
  type SelectOption,
} from '@/components/sabcrm/20ui';
import { useState, useTransition } from 'react';
import { RefreshCw, Smartphone, Store, Mail } from 'lucide-react';

import type { Project } from '@/lib/definitions';
import type { WithId } from 'mongodb';

interface SyncContactsDialogProps {
  project: WithId<Project>;
  onSynced: () => void;
}

const SOURCE_OPTIONS: SelectOption[] = [
  { value: 'google', label: 'Google Contacts', icon: Mail },
  { value: 'shopify', label: 'Shopify Customers', icon: Store },
  { value: 'device', label: 'Device Contacts (vCard)', icon: Smartphone },
];

export function SyncContactsDialog({ project, onSynced }: SyncContactsDialogProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();
  const [source, setSource] = useState<string>('');

  const handleSync = () => {
    if (!source) {
      toast({ title: 'Error', description: 'Please select a source to sync from.', tone: 'danger' });
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
    <>
      <Button variant="outline" size="md" iconLeft={RefreshCw} onClick={() => setOpen(true)}>
        Sync
      </Button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        size="sm"
        title="Sync Contacts"
        description="Connect an external source to automatically sync contacts to your WaChat project."
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleSync}
              disabled={isPending || !source}
              loading={isPending}
            >
              {isPending ? 'Syncing...' : 'Start Sync'}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Field label="Source">
            <Select
              value={source}
              onChange={(v) => setSource(v ?? '')}
              options={SOURCE_OPTIONS}
              placeholder="Select integration..."
            />
          </Field>

          {source === 'google' && (
            <p className="text-[12px] text-[var(--st-text-tertiary)]">
              We will require access to your Google account to fetch your contacts. You will be
              redirected to authenticate.
            </p>
          )}
          {source === 'shopify' && (
            <p className="text-[12px] text-[var(--st-text-tertiary)]">
              Make sure your Shopify store is connected in Settings {'>'} Integrations.
            </p>
          )}
        </div>
      </Modal>
    </>
  );
}
