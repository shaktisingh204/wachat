'use client';

import {
  Button,
  Card,
  Input,
  Label,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  Skeleton,
  Textarea,
  useZoruToast,
} from '@/components/sabcrm/20ui/compat';
import {
  useActionState,
  useEffect,
  useState,
  useTransition } from 'react';
import { LoaderCircle } from 'lucide-react';

import * as React from 'react';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import {
  getGdprSettings,
  saveGdprSettings,
} from '@/app/actions/worksuite/gdpr.actions';
import type { WsGdprSetting } from '@/lib/worksuite/gdpr-types';

type ConfigDoc = (WsGdprSetting & { _id: unknown }) | null;

const BOOL_FIELDS: {
  key: keyof WsGdprSetting;
  label: string;
  hint?: string;
}[] = [
  {
    key: 'enable_gdpr',
    label: 'Enable GDPR mode',
    hint: 'Activate compliance features across the workspace.',
  },
  {
    key: 'show_cookie_consent',
    label: 'Show cookie consent banner',
    hint: 'Display the cookie banner on public-facing pages.',
  },
  {
    key: 'enable_consent_logs',
    label: 'Record consent logs',
    hint: 'Store who granted or revoked each purpose and when.',
  },
  {
    key: 'enable_right_to_be_forgotten',
    label: 'Allow right-to-be-forgotten',
    hint: 'Let users submit account-deletion requests.',
  },
  {
    key: 'enable_data_portability',
    label: 'Allow data portability',
    hint: 'Let users export their personal data.',
  },
];

export default function GdprSettingsPage() {
  const { toast } = useZoruToast();
  const [config, setConfig] = useState<ConfigDoc>(null);
  const [isLoading, startLoading] = useTransition();
  const [saveState, saveFormAction, isSaving] = useActionState(
    saveGdprSettings,
    { message: '', error: '' } as {
      message?: string;
      error?: string;
      id?: string;
    },
  );

  const refresh = React.useCallback(() => {
    startLoading(async () => {
      try {
        const doc = await getGdprSettings();
        setConfig((doc as ConfigDoc) ?? null);
      } catch (e) {
        console.error('Failed to load GDPR settings:', e);
      }
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
    if (saveState?.error) {
      toast({
        title: 'Error',
        description: saveState.error,
        variant: 'destructive',
      });
    }
  }, [saveState, toast, refresh]);

  const value = (key: keyof WsGdprSetting) => {
    const v = config ? (config as any)[key] : undefined;
    return v == null ? '' : String(v);
  };

  const boolValue = (key: keyof WsGdprSetting) => {
    return config && (config as any)[key] ? 'yes' : 'no';
  };

  const configId =
    config && (config as any)._id ? String((config as any)._id) : '';

  return (
    <EntityListShell
      title="GDPR Settings"
      subtitle="EU compliance controls, cookie banner, and data-controller details."
    >

      <Card className="p-6">
        {isLoading && !config ? (
          <div className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : (
          <form action={saveFormAction} className="space-y-6">
            {configId ? (
              <input type="hidden" name="_id" value={configId} />
            ) : null}

            <section className="space-y-4">
              <h2 className="text-[14px] text-[var(--st-text)]">Core controls</h2>
              <div className="grid gap-4 md:grid-cols-2">
                {BOOL_FIELDS.map((f) => (
                  <div key={String(f.key)}>
                    <Label htmlFor={String(f.key)}>{f.label}</Label>
                    <div className="mt-1.5">
                      <Select
                        name={String(f.key)}
                        defaultValue={boolValue(f.key)}
                      >
                        <ZoruSelectTrigger id={String(f.key)}>
                          <ZoruSelectValue placeholder="Select" />
                        </ZoruSelectTrigger>
                        <ZoruSelectContent>
                          <ZoruSelectItem value="yes">Enabled</ZoruSelectItem>
                          <ZoruSelectItem value="no">Disabled</ZoruSelectItem>
                        </ZoruSelectContent>
                      </Select>
                    </div>
                    {f.hint ? (
                      <p className="mt-1 text-[11.5px] text-[var(--st-text-secondary)]">
                        {f.hint}
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
            </section>

            <section className="space-y-4">
              <h2 className="text-[14px] text-[var(--st-text)]">Cookie banner</h2>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="md:col-span-2">
                  <Label htmlFor="cookie_message">Cookie message</Label>
                  <div className="mt-1.5">
                    <Textarea
                      id="cookie_message"
                      name="cookie_message"
                      rows={3}
                      defaultValue={value('cookie_message')}
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="accept_cookie_btn_text">Accept button text</Label>
                  <div className="mt-1.5">
                    <Input
                      id="accept_cookie_btn_text"
                      name="accept_cookie_btn_text"
                      defaultValue={value('accept_cookie_btn_text')}
                      placeholder="Accept"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="decline_cookie_btn_text">Decline button text</Label>
                  <div className="mt-1.5">
                    <Input
                      id="decline_cookie_btn_text"
                      name="decline_cookie_btn_text"
                      defaultValue={value('decline_cookie_btn_text')}
                      placeholder="Decline"
                    />
                  </div>
                </div>

                <div className="md:col-span-2">
                  <Label htmlFor="privacy_policy_url">Privacy policy URL</Label>
                  <div className="mt-1.5">
                    <Input
                      id="privacy_policy_url"
                      name="privacy_policy_url"
                      type="url"
                      defaultValue={value('privacy_policy_url')}
                      placeholder="https://example.com/privacy"
                    />
                  </div>
                </div>
              </div>
            </section>

            <section className="space-y-4">
              <h2 className="text-[14px] text-[var(--st-text)]">Data controller</h2>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label htmlFor="data_controller_name">Controller name</Label>
                  <div className="mt-1.5">
                    <Input
                      id="data_controller_name"
                      name="data_controller_name"
                      defaultValue={value('data_controller_name')}
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="data_controller_email">Controller email</Label>
                  <div className="mt-1.5">
                    <Input
                      id="data_controller_email"
                      name="data_controller_email"
                      type="email"
                      defaultValue={value('data_controller_email')}
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="retention_period_days">Retention period (days)</Label>
                  <div className="mt-1.5">
                    <Input
                      id="retention_period_days"
                      name="retention_period_days"
                      type="number"
                      min={0}
                      defaultValue={value('retention_period_days')}
                      placeholder="365"
                    />
                  </div>
                </div>
              </div>
            </section>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="submit" disabled={isSaving}>
                {isSaving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
                Save
              </Button>
            </div>
          </form>
        )}
      </Card>
    </EntityListShell>
  );
}
