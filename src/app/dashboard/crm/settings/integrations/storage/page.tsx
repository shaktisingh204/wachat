'use client';

import { ZoruButton, ZoruCard, ZoruInput, ZoruLabel, ZoruSkeleton, useZoruToast } from '@/components/zoruui';
import {
  useActionState,
  useCallback,
  useEffect,
  useState,
  useTransition,
  } from 'react';
import { LoaderCircle } from 'lucide-react';

import { EnumFormField } from '@/components/crm/enum-form-field';
import { EntityListShell } from '@/components/crm/entity-list-shell';
import {
  getStorageSetting,
  saveStorageSetting,
} from '@/app/actions/worksuite/integrations.actions';
import type {
  WsStorageSetting,
  WsStorageDriver,
} from '@/lib/worksuite/integrations-types';

type Doc = (WsStorageSetting & { _id: unknown }) | null;

export default function StorageIntegrationPage() {
  const { toast } = useZoruToast();
  const [doc, setDoc] = useState<Doc>(null);
  const [driver, setDriver] = useState<WsStorageDriver>('local');
  const [, startLoading] = useTransition();
  const [saveState, saveFormAction, isSaving] = useActionState(
    saveStorageSetting,
    { message: '', error: '' } as {
      message?: string;
      error?: string;
      id?: string;
    },
  );

  const refresh = useCallback(() => {
    startLoading(async () => {
      const d = (await getStorageSetting()) as Doc;
      setDoc(d);
      setDriver((d?.storage_driver as WsStorageDriver) || 'local');
    });
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (saveState?.message) {
      toast({ title: 'Saved', description: saveState.message });
      refresh();
    }
    if (saveState?.error)
      toast({
        title: 'Error',
        description: saveState.error,
        variant: 'destructive',
      });
  }, [saveState, toast, refresh]);

  const v = (k: keyof WsStorageSetting) => {
    const val = doc ? (doc as any)[k] : undefined;
    return val == null ? '' : String(val);
  };

  const id = doc && (doc as any)._id ? String((doc as any)._id) : '';

  return (
    <EntityListShell
      title="Storage"
      subtitle="Choose where uploaded files are stored."
    >

      <ZoruCard className="p-6">
        {!doc && !id ? (
          <div className="space-y-4">
            <ZoruSkeleton className="h-10 w-full" />
            <ZoruSkeleton className="h-10 w-full" />
          </div>
        ) : null}

        <form action={saveFormAction} className="space-y-4">
          {id ? <input type="hidden" name="_id" value={id} /> : null}

          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <ZoruLabel htmlFor="storage_driver">Storage Driver</ZoruLabel>
              <div className="mt-1.5">
                <EnumFormField
                  name="storage_driver"
                  enumName="storageDriver"
                  initialId={driver}
                  onChange={(id) => setDriver((id ?? 'local') as WsStorageDriver)}
                  placeholder="Select driver"
                />
              </div>
            </div>

            {driver === 's3' && (
              <>
                <div>
                  <ZoruLabel htmlFor="aws_access_key">AWS Access Key</ZoruLabel>
                  <div className="mt-1.5">
                    <ZoruInput
                      id="aws_access_key"
                      name="aws_access_key"
                      defaultValue={v('aws_access_key')}
                    />
                  </div>
                </div>
                <div>
                  <ZoruLabel htmlFor="aws_secret">AWS Secret</ZoruLabel>
                  <div className="mt-1.5">
                    <ZoruInput
                      id="aws_secret"
                      name="aws_secret"
                      type="password"
                      defaultValue={v('aws_secret')}
                    />
                  </div>
                </div>
                <div>
                  <ZoruLabel htmlFor="aws_region">AWS Region</ZoruLabel>
                  <div className="mt-1.5">
                    <ZoruInput
                      id="aws_region"
                      name="aws_region"
                      defaultValue={v('aws_region')}
                      placeholder="us-east-1"
                    />
                  </div>
                </div>
                <div>
                  <ZoruLabel htmlFor="aws_bucket">AWS Bucket</ZoruLabel>
                  <div className="mt-1.5">
                    <ZoruInput
                      id="aws_bucket"
                      name="aws_bucket"
                      defaultValue={v('aws_bucket')}
                    />
                  </div>
                </div>
              </>
            )}

            {driver === 'google-drive' && (
              <>
                <div>
                  <ZoruLabel htmlFor="gd_client_id">Google Drive Client ID</ZoruLabel>
                  <div className="mt-1.5">
                    <ZoruInput
                      id="gd_client_id"
                      name="gd_client_id"
                      defaultValue={v('gd_client_id')}
                    />
                  </div>
                </div>
                <div>
                  <ZoruLabel htmlFor="gd_client_secret">Google Drive Client Secret</ZoruLabel>
                  <div className="mt-1.5">
                    <ZoruInput
                      id="gd_client_secret"
                      name="gd_client_secret"
                      type="password"
                      defaultValue={v('gd_client_secret')}
                    />
                  </div>
                </div>
              </>
            )}

            {driver === 'azure' && (
              <div className="md:col-span-2">
                <ZoruLabel htmlFor="azure_account">Azure Account</ZoruLabel>
                <div className="mt-1.5">
                  <ZoruInput
                    id="azure_account"
                    name="azure_account"
                    defaultValue={v('azure_account')}
                  />
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <ZoruButton type="submit" disabled={isSaving}>
              {isSaving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
              Save
            </ZoruButton>
          </div>
        </form>
      </ZoruCard>
    </EntityListShell>
  );
}
