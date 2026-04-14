'use client';

import * as React from 'react';
import {
  useActionState,
  useCallback,
  useEffect,
  useState,
  useTransition,
} from 'react';
import { KeyRound, LoaderCircle } from 'lucide-react';

import { ClayCard, ClayButton } from '@/components/clay';
import { CrmPageHeader } from '../../../_components/crm-page-header';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import {
  getSocialAuthSetting,
  saveSocialAuthSetting,
} from '@/app/actions/worksuite/integrations.actions';
import type { WsSocialAuthSetting } from '@/lib/worksuite/integrations-types';

type Doc = (WsSocialAuthSetting & { _id: unknown }) | null;

const PROVIDERS: Array<{
  title: string;
  idKey: keyof WsSocialAuthSetting;
  secretKey: keyof WsSocialAuthSetting;
  idLabel: string;
  secretLabel: string;
}> = [
  {
    title: 'Google',
    idKey: 'google_client_id',
    secretKey: 'google_client_secret',
    idLabel: 'Client ID',
    secretLabel: 'Client Secret',
  },
  {
    title: 'Facebook',
    idKey: 'facebook_app_id',
    secretKey: 'facebook_app_secret',
    idLabel: 'App ID',
    secretLabel: 'App Secret',
  },
  {
    title: 'LinkedIn',
    idKey: 'linkedin_client_id',
    secretKey: 'linkedin_client_secret',
    idLabel: 'Client ID',
    secretLabel: 'Client Secret',
  },
  {
    title: 'Twitter',
    idKey: 'twitter_api_key',
    secretKey: 'twitter_api_secret',
    idLabel: 'API Key',
    secretLabel: 'API Secret',
  },
  {
    title: 'Microsoft',
    idKey: 'microsoft_client_id',
    secretKey: 'microsoft_client_secret',
    idLabel: 'Client ID',
    secretLabel: 'Client Secret',
  },
];

export default function SocialAuthIntegrationPage() {
  const { toast } = useToast();
  const [doc, setDoc] = useState<Doc>(null);
  const [, startLoading] = useTransition();
  const [saveState, saveFormAction, isSaving] = useActionState(
    saveSocialAuthSetting,
    { message: '', error: '' } as {
      message?: string;
      error?: string;
      id?: string;
    },
  );

  const refresh = useCallback(() => {
    startLoading(async () => {
      const d = (await getSocialAuthSetting()) as Doc;
      setDoc(d);
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

  const v = (k: keyof WsSocialAuthSetting) => {
    const val = doc ? (doc as any)[k] : undefined;
    return val == null ? '' : String(val);
  };

  const id = doc && (doc as any)._id ? String((doc as any)._id) : '';

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="Social Auth"
        subtitle="OAuth credentials for social sign-in providers."
        icon={KeyRound}
      />

      <ClayCard>
        {!doc && !id ? (
          <div className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : null}

        <form action={saveFormAction} className="space-y-6">
          {id ? <input type="hidden" name="_id" value={id} /> : null}

          {PROVIDERS.map((p) => (
            <div key={p.title} className="space-y-3">
              <h3 className="text-[13px] font-semibold text-clay-ink">
                {p.title}
              </h3>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label
                    htmlFor={String(p.idKey)}
                    className="text-clay-ink"
                  >
                    {p.idLabel}
                  </Label>
                  <div className="mt-1.5">
                    <Input
                      id={String(p.idKey)}
                      name={String(p.idKey)}
                      defaultValue={v(p.idKey)}
                      className="h-10 rounded-clay-md border-clay-border bg-clay-surface text-[13px]"
                    />
                  </div>
                </div>
                <div>
                  <Label
                    htmlFor={String(p.secretKey)}
                    className="text-clay-ink"
                  >
                    {p.secretLabel}
                  </Label>
                  <div className="mt-1.5">
                    <Input
                      id={String(p.secretKey)}
                      name={String(p.secretKey)}
                      type="password"
                      defaultValue={v(p.secretKey)}
                      className="h-10 rounded-clay-md border-clay-border bg-clay-surface text-[13px]"
                    />
                  </div>
                </div>
              </div>
            </div>
          ))}

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
