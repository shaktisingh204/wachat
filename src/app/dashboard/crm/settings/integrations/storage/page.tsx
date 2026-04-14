'use client';

import * as React from 'react';
import {
  useActionState,
  useCallback,
  useEffect,
  useState,
  useTransition,
} from 'react';
import { HardDrive, LoaderCircle } from 'lucide-react';

import { ClayCard, ClayButton } from '@/components/clay';
import { CrmPageHeader } from '../../../_components/crm-page-header';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
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
  const { toast } = useToast();
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
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="Storage"
        subtitle="Choose where uploaded files are stored."
        icon={HardDrive}
      />

      <ClayCard>
        {!doc && !id ? (
          <div className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : null}

        <form action={saveFormAction} className="space-y-4">
          {id ? <input type="hidden" name="_id" value={id} /> : null}

          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <Label htmlFor="storage_driver" className="text-clay-ink">
                Storage Driver
              </Label>
              <div className="mt-1.5">
                <Select
                  value={driver}
                  onValueChange={(val) => setDriver(val as WsStorageDriver)}
                  name="storage_driver"
                >
                  <SelectTrigger
                    id="storage_driver"
                    className="h-10 rounded-clay-md border-clay-border bg-clay-surface text-[13px]"
                  >
                    <SelectValue placeholder="Select driver" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="local">Local</SelectItem>
                    <SelectItem value="s3">Amazon S3</SelectItem>
                    <SelectItem value="google-drive">Google Drive</SelectItem>
                    <SelectItem value="azure">Azure Blob</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {driver === 's3' && (
              <>
                <div>
                  <Label htmlFor="aws_access_key" className="text-clay-ink">
                    AWS Access Key
                  </Label>
                  <div className="mt-1.5">
                    <Input
                      id="aws_access_key"
                      name="aws_access_key"
                      defaultValue={v('aws_access_key')}
                      className="h-10 rounded-clay-md border-clay-border bg-clay-surface text-[13px]"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="aws_secret" className="text-clay-ink">
                    AWS Secret
                  </Label>
                  <div className="mt-1.5">
                    <Input
                      id="aws_secret"
                      name="aws_secret"
                      type="password"
                      defaultValue={v('aws_secret')}
                      className="h-10 rounded-clay-md border-clay-border bg-clay-surface text-[13px]"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="aws_region" className="text-clay-ink">
                    AWS Region
                  </Label>
                  <div className="mt-1.5">
                    <Input
                      id="aws_region"
                      name="aws_region"
                      defaultValue={v('aws_region')}
                      placeholder="us-east-1"
                      className="h-10 rounded-clay-md border-clay-border bg-clay-surface text-[13px]"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="aws_bucket" className="text-clay-ink">
                    AWS Bucket
                  </Label>
                  <div className="mt-1.5">
                    <Input
                      id="aws_bucket"
                      name="aws_bucket"
                      defaultValue={v('aws_bucket')}
                      className="h-10 rounded-clay-md border-clay-border bg-clay-surface text-[13px]"
                    />
                  </div>
                </div>
              </>
            )}

            {driver === 'google-drive' && (
              <>
                <div>
                  <Label htmlFor="gd_client_id" className="text-clay-ink">
                    Google Drive Client ID
                  </Label>
                  <div className="mt-1.5">
                    <Input
                      id="gd_client_id"
                      name="gd_client_id"
                      defaultValue={v('gd_client_id')}
                      className="h-10 rounded-clay-md border-clay-border bg-clay-surface text-[13px]"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="gd_client_secret" className="text-clay-ink">
                    Google Drive Client Secret
                  </Label>
                  <div className="mt-1.5">
                    <Input
                      id="gd_client_secret"
                      name="gd_client_secret"
                      type="password"
                      defaultValue={v('gd_client_secret')}
                      className="h-10 rounded-clay-md border-clay-border bg-clay-surface text-[13px]"
                    />
                  </div>
                </div>
              </>
            )}

            {driver === 'azure' && (
              <div className="md:col-span-2">
                <Label htmlFor="azure_account" className="text-clay-ink">
                  Azure Account
                </Label>
                <div className="mt-1.5">
                  <Input
                    id="azure_account"
                    name="azure_account"
                    defaultValue={v('azure_account')}
                    className="h-10 rounded-clay-md border-clay-border bg-clay-surface text-[13px]"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <ClayButton
              type="submit"
              variant="obsidian"
              disabled={isSaving}
              leading={
                isSaving ? (
                  <LoaderCircle
                    className="h-4 w-4 animate-spin"
                    strokeWidth={1.75}
                  />
                ) : null
              }
            >
              Save
            </ClayButton>
          </div>
        </form>
      </ClayCard>
    </div>
  );
}
