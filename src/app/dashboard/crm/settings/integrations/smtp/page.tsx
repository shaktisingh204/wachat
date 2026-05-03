'use client';

import * as React from 'react';
import {
  useActionState,
  useCallback,
  useEffect,
  useState,
  useTransition,
} from 'react';
import { LoaderCircle, Mail, Play } from 'lucide-react';

import { ClayCard, ClayButton, ClayBadge } from '@/components/clay';
import { CrmPageHeader } from '../../../_components/crm-page-header';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import {
  getSmtpSetting,
  saveSmtpSetting,
  testSmtp,
} from '@/app/actions/worksuite/integrations.actions';
import type { WsSmtpSetting } from '@/lib/worksuite/integrations-types';

type Doc = (WsSmtpSetting & { _id: unknown }) | null;

export default function SmtpIntegrationPage() {
  const { toast } = useToast();
  const [doc, setDoc] = useState<Doc>(null);
  const [, startLoading] = useTransition();
  const [isTesting, startTesting] = useTransition();
  const [saveState, saveFormAction, isSaving] = useActionState(saveSmtpSetting, {
    message: '',
    error: '',
  } as { message?: string; error?: string; id?: string });

  const refresh = useCallback(() => {
    startLoading(async () => {
      const d = (await getSmtpSetting()) as Doc;
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

  const v = (k: keyof WsSmtpSetting) => {
    const val = doc ? (doc as any)[k] : undefined;
    return val == null ? '' : String(val);
  };

  const id = doc && (doc as any)._id ? String((doc as any)._id) : '';

  const onTest = () => {
    startTesting(async () => {
      const res = await testSmtp();
      if (res.message) toast({ title: 'SMTP', description: res.message });
      else if (res.error)
        toast({
          title: 'Error',
          description: res.error,
          variant: 'destructive',
        });
    });
  };

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="SMTP"
        subtitle="Outbound email server for transactional email."
        icon={Mail}
      />

      <ClayCard>
        <div className="mb-4 flex items-center gap-2">
          <ClayBadge tone={doc?.verified ? 'green' : 'neutral'}>
            {doc?.verified ? 'Verified' : 'Unverified'}
          </ClayBadge>
        </div>

        {!doc && !id ? (
          <div className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : null}

        <form action={saveFormAction} className="space-y-4">
          {id ? <input type="hidden" name="_id" value={id} /> : null}

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="mail_driver" className="text-foreground">
                Mail Driver
              </Label>
              <div className="mt-1.5">
                <Input
                  id="mail_driver"
                  name="mail_driver"
                  defaultValue={v('mail_driver') || 'smtp'}
                  placeholder="smtp"
                  className="h-10 rounded-lg border-border bg-card text-[13px]"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="encryption" className="text-foreground">
                Encryption
              </Label>
              <div className="mt-1.5">
                <Input
                  id="encryption"
                  name="encryption"
                  defaultValue={v('encryption')}
                  placeholder="tls / ssl"
                  className="h-10 rounded-lg border-border bg-card text-[13px]"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="host" className="text-foreground">
                Host
              </Label>
              <div className="mt-1.5">
                <Input
                  id="host"
                  name="host"
                  defaultValue={v('host')}
                  placeholder="smtp.example.com"
                  className="h-10 rounded-lg border-border bg-card text-[13px]"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="port" className="text-foreground">
                Port
              </Label>
              <div className="mt-1.5">
                <Input
                  id="port"
                  name="port"
                  defaultValue={v('port')}
                  placeholder="587"
                  className="h-10 rounded-lg border-border bg-card text-[13px]"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="username" className="text-foreground">
                Username
              </Label>
              <div className="mt-1.5">
                <Input
                  id="username"
                  name="username"
                  defaultValue={v('username')}
                  className="h-10 rounded-lg border-border bg-card text-[13px]"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="password" className="text-foreground">
                Password
              </Label>
              <div className="mt-1.5">
                <Input
                  id="password"
                  name="password"
                  type="password"
                  defaultValue={v('password')}
                  className="h-10 rounded-lg border-border bg-card text-[13px]"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="from_email" className="text-foreground">
                From Email
              </Label>
              <div className="mt-1.5">
                <Input
                  id="from_email"
                  name="from_email"
                  type="email"
                  defaultValue={v('from_email')}
                  className="h-10 rounded-lg border-border bg-card text-[13px]"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="from_name" className="text-foreground">
                From Name
              </Label>
              <div className="mt-1.5">
                <Input
                  id="from_name"
                  name="from_name"
                  defaultValue={v('from_name')}
                  className="h-10 rounded-lg border-border bg-card text-[13px]"
                />
              </div>
            </div>
          </div>

          <div className="flex flex-wrap justify-end gap-2 pt-2">
            <ClayButton
              type="button"
              variant="obsidian"
              onClick={onTest}
              disabled={isTesting}
              leading={
                isTesting ? (
                  <LoaderCircle
                    className="h-4 w-4 animate-spin"
                    strokeWidth={1.75}
                  />
                ) : (
                  <Play className="h-4 w-4" strokeWidth={1.75} />
                )
              }
            >
              Test
            </ClayButton>
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
