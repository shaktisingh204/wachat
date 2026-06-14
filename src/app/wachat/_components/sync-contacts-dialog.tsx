'use client';

import {
  Button,
  Modal,
  Field,
  SelectField as Select,
  useToast,
  type SelectOption,
} from '@/components/sabcrm/20ui';
import { useMemo, useRef, useState, useTransition } from 'react';
import {
  AlertCircle,
  Mail,
  RefreshCw,
  Smartphone,
  Store,
  Upload,
} from 'lucide-react';

import type { Project } from '@/lib/definitions';
import type { WithId } from 'mongodb';

import {
  syncContactsFromGoogle,
  syncContactsFromShopify,
  syncContactsFromVcard,
  type ContactsSyncResult,
} from '@/app/actions/wachat-contacts-export-sync.actions';

interface SyncContactsDialogProps {
  project: WithId<Project>;
  onSynced: () => void;
}

type SyncSource = 'google' | 'shopify' | 'device';

const SOURCE_OPTIONS: SelectOption[] = [
  { value: 'google', label: 'Google Contacts', icon: Mail },
  { value: 'shopify', label: 'Shopify Customers', icon: Store },
  { value: 'device', label: 'Device Contacts (vCard)', icon: Smartphone },
];

const PROVIDER_LABEL: Record<'google' | 'shopify', string> = {
  google: 'Google Contacts',
  shopify: 'Shopify',
};

export function SyncContactsDialog({ project, onSynced }: SyncContactsDialogProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();
  const [source, setSource] = useState<SyncSource | ''>('');
  const [phoneNumberId, setPhoneNumberId] = useState(
    project.phoneNumbers?.[0]?.id || '',
  );
  const [vcardName, setVcardName] = useState<string | null>(null);
  const [vcardText, setVcardText] = useState<string>('');
  /** Provider that returned a "not connected" 400 (shows Connect state). */
  const [notConnected, setNotConnected] = useState<'google' | 'shopify' | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const projectId = project._id.toString();

  const phoneOptions: SelectOption[] = useMemo(
    () =>
      (project.phoneNumbers || []).map((phone) => ({
        value: phone.id,
        label: `${phone.display_phone_number} (${phone.verified_name})`,
      })),
    [project.phoneNumbers],
  );

  const resetTransient = () => {
    setVcardName(null);
    setVcardText('');
    setNotConnected(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleClose = () => {
    setOpen(false);
    setSource('');
    resetTransient();
  };

  const handleSourceChange = (v: string | null) => {
    setSource((v as SyncSource | null) ?? '');
    resetTransient();
  };

  const handleVcardChange = async (file: File | undefined) => {
    if (!file) {
      setVcardName(null);
      setVcardText('');
      return;
    }
    setVcardName(file.name);
    try {
      const text = await file.text();
      setVcardText(text);
    } catch {
      setVcardText('');
      toast({
        title: 'Could not read file',
        description: 'The selected vCard file could not be read.',
        tone: 'danger',
      });
    }
  };

  const applyResult = (result: ContactsSyncResult, provider?: 'google' | 'shopify') => {
    if (result.notConnected) {
      setNotConnected(provider ?? null);
      return;
    }
    if (result.error) {
      toast({ title: 'Sync failed', description: result.error, tone: 'danger' });
      return;
    }
    toast({
      title: 'Sync complete',
      description: result.message ?? 'Contacts synced successfully.',
      tone: 'success',
    });
    onSynced();
    handleClose();
  };

  const handleSync = () => {
    if (!source) {
      toast({
        title: 'Select a source',
        description: 'Please choose where to sync contacts from.',
        tone: 'danger',
      });
      return;
    }
    if (!phoneNumberId) {
      toast({
        title: 'Select a number',
        description: 'Choose the phone number to associate synced contacts with.',
        tone: 'danger',
      });
      return;
    }

    setNotConnected(null);

    if (source === 'device') {
      if (!vcardText.trim()) {
        toast({
          title: 'No vCard selected',
          description: 'Choose a .vcf file exported from your device.',
          tone: 'danger',
        });
        return;
      }
      startTransition(async () => {
        const result = await syncContactsFromVcard({
          projectId,
          phoneNumberId,
          vcard: vcardText,
        });
        applyResult(result);
      });
      return;
    }

    const provider = source; // 'google' | 'shopify'
    startTransition(async () => {
      const fn =
        provider === 'google' ? syncContactsFromGoogle : syncContactsFromShopify;
      const result = await fn({ projectId, phoneNumberId });
      applyResult(result, provider);
    });
  };

  const isDevice = source === 'device';
  const canSync =
    !!source &&
    !!phoneNumberId &&
    (!isDevice || vcardText.trim().length > 0) &&
    !notConnected;

  return (
    <>
      <Button variant="outline" size="md" iconLeft={RefreshCw} onClick={() => setOpen(true)}>
        Sync
      </Button>

      <Modal
        open={open}
        onClose={handleClose}
        size="sm"
        title="Sync Contacts"
        description="Connect an external source to automatically sync contacts to your WaChat project."
        footer={
          <>
            <Button variant="ghost" onClick={handleClose}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleSync}
              disabled={isPending || !canSync}
              loading={isPending}
            >
              {isPending ? 'Syncing…' : 'Start Sync'}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Field label="Source">
            <Select
              value={source}
              onChange={handleSourceChange}
              options={SOURCE_OPTIONS}
              placeholder="Select integration…"
            />
          </Field>

          {source && (
            <Field label="Associate with number">
              <Select
                value={phoneNumberId}
                onChange={(v) => setPhoneNumberId(v ?? '')}
                options={phoneOptions}
                placeholder="Choose a number…"
                aria-label="Associate with number"
              />
            </Field>
          )}

          {isDevice && (
            <Field label="vCard file (.vcf)">
              <label
                className={`group flex cursor-pointer flex-col items-center justify-center gap-2 rounded-[var(--st-radius-lg)] border-2 border-dashed px-4 py-7 text-center transition-colors ${vcardName ? 'border-[var(--st-text)] bg-[var(--st-bg-muted)]' : 'border-[var(--st-border)] bg-[var(--st-bg)]'}`}
              >
                <Upload
                  className={`h-6 w-6 transition-colors ${vcardName ? 'text-[var(--st-text)]' : 'text-[var(--st-text-secondary)]'}`}
                  aria-hidden="true"
                />
                <div className="flex flex-col gap-0.5">
                  <span className="text-[13px] text-[var(--st-text)]">
                    {vcardName || 'Click to choose a .vcf file'}
                  </span>
                  <span className="text-[11px] text-[var(--st-text-secondary)]">
                    {vcardName ? 'Click to replace' : 'Exported contacts (vCard 2.1 / 3.0 / 4.0)'}
                  </span>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".vcf,text/vcard,text/x-vcard"
                  className="sr-only"
                  onChange={(e) => void handleVcardChange(e.target.files?.[0])}
                />
              </label>
            </Field>
          )}

          {source === 'google' && !notConnected && (
            <p className="text-[12px] text-[var(--st-text-tertiary)]">
              We will use your connected Google account to import contacts.
            </p>
          )}
          {source === 'shopify' && !notConnected && (
            <p className="text-[12px] text-[var(--st-text-tertiary)]">
              We will import customers from your connected Shopify store.
            </p>
          )}

          {notConnected && (
            <div className="flex items-start gap-2.5 rounded-[var(--st-radius-md)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] px-3 py-2.5">
              <AlertCircle
                className="mt-0.5 h-4 w-4 shrink-0 text-[var(--st-warning,var(--st-text-secondary))]"
                aria-hidden="true"
              />
              <div className="flex flex-col gap-0.5">
                <span className="text-[12.5px] font-medium text-[var(--st-text)]">
                  {PROVIDER_LABEL[notConnected]} is not connected
                </span>
                <span className="text-[11.5px] text-[var(--st-text-secondary)]">
                  Connect this integration in Settings → Integrations, then run the sync
                  again. You can still import via CSV or a device vCard in the meantime.
                </span>
              </div>
            </div>
          )}
        </div>
      </Modal>
    </>
  );
}
