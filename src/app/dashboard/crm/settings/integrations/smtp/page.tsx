'use client';

import { ZoruBadge, ZoruButton, ZoruCard, ZoruInput, ZoruLabel, ZoruSkeleton, useZoruToast } from '@/components/zoruui';
import {
  useActionState,
  useCallback,
  useEffect,
  useState,
  useTransition,
  } from 'react';
import { LoaderCircle,
  Play } from 'lucide-react';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import {
  getSmtpSetting,
  saveSmtpSetting,
  testSmtp,
} from '@/app/actions/worksuite/integrations.actions';
import type { WsSmtpSetting } from '@/lib/worksuite/integrations-types';

type Doc = (WsSmtpSetting & { _id: unknown }) | null;

export default function SmtpIntegrationPage() {
  const { toast } = useZoruToast();
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
    <EntityListShell
      title="SMTP"
      subtitle="Outbound email server for transactional email."
    >

      <ZoruCard className="p-6">
        <div className="mb-4 flex items-center gap-2">
          <ZoruBadge variant={doc?.verified ? 'success' : 'ghost'}>
            {doc?.verified ? 'Verified' : 'Unverified'}
          </ZoruBadge>
        </div>

        {!doc && !id ? (
          <div className="space-y-4">
            <ZoruSkeleton className="h-10 w-full" />
            <ZoruSkeleton className="h-10 w-full" />
          </div>
        ) : null}

        <form action={saveFormAction} className="space-y-4">
          {id ? <input type="hidden" name="_id" value={id} /> : null}

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <ZoruLabel htmlFor="mail_driver">Mail Driver</ZoruLabel>
              <div className="mt-1.5">
                <ZoruInput
                  id="mail_driver"
                  name="mail_driver"
                  defaultValue={v('mail_driver') || 'smtp'}
                  placeholder="smtp"
                />
              </div>
            </div>

            <div>
              <ZoruLabel htmlFor="encryption">Encryption</ZoruLabel>
              <div className="mt-1.5">
                <ZoruInput
                  id="encryption"
                  name="encryption"
                  defaultValue={v('encryption')}
                  placeholder="tls / ssl"
                />
              </div>
            </div>

            <div>
              <ZoruLabel htmlFor="host">Host</ZoruLabel>
              <div className="mt-1.5">
                <ZoruInput
                  id="host"
                  name="host"
                  defaultValue={v('host')}
                  placeholder="smtp.example.com"
                />
              </div>
            </div>

            <div>
              <ZoruLabel htmlFor="port">Port</ZoruLabel>
              <div className="mt-1.5">
                <ZoruInput
                  id="port"
                  name="port"
                  defaultValue={v('port')}
                  placeholder="587"
                />
              </div>
            </div>

            <div>
              <ZoruLabel htmlFor="username">Username</ZoruLabel>
              <div className="mt-1.5">
                <ZoruInput
                  id="username"
                  name="username"
                  defaultValue={v('username')}
                />
              </div>
            </div>

            <div>
              <ZoruLabel htmlFor="password">Password</ZoruLabel>
              <div className="mt-1.5">
                <ZoruInput
                  id="password"
                  name="password"
                  type="password"
                  defaultValue={v('password')}
                />
              </div>
            </div>

            <div>
              <ZoruLabel htmlFor="from_email">From Email</ZoruLabel>
              <div className="mt-1.5">
                <ZoruInput
                  id="from_email"
                  name="from_email"
                  type="email"
                  defaultValue={v('from_email')}
                />
              </div>
            </div>

            <div>
              <ZoruLabel htmlFor="from_name">From Name</ZoruLabel>
              <div className="mt-1.5">
                <ZoruInput
                  id="from_name"
                  name="from_name"
                  defaultValue={v('from_name')}
                />
              </div>
            </div>
          </div>

          <div className="flex flex-wrap justify-end gap-2 pt-2">
            <ZoruButton
              type="button"
              onClick={onTest}
              disabled={isTesting}
            >
              {isTesting ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              Test
            </ZoruButton>
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
