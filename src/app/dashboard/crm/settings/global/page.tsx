'use client';

import { useActionState, useCallback, useEffect, useState, useTransition } from 'react';
import { LoaderCircle } from 'lucide-react';

import {
  ZoruBreadcrumb,
  ZoruBreadcrumbItem,
  ZoruBreadcrumbLink,
  ZoruBreadcrumbList,
  ZoruBreadcrumbPage,
  ZoruBreadcrumbSeparator,
  ZoruButton,
  ZoruCard,
  ZoruInput,
  ZoruLabel,
  ZoruPageDescription,
  ZoruPageHeader,
  ZoruPageHeading,
  ZoruPageTitle,
  ZoruSkeleton,
  useZoruToast,
} from '@/components/zoruui';
import { EnumFormField } from '@/components/crm/enum-form-field';
import { EntityFormField } from '@/components/crm/entity-form-field';
import {
  getGlobalSettings,
  saveGlobalSettings,
  getCurrencies,
} from '@/app/actions/worksuite/company.actions';
import type {
  WsGlobalSetting,
  WsCurrency,
} from '@/lib/worksuite/company-types';

type FormState = { message?: string; error?: string; id?: string };
const initialState: FormState = {};

export default function GlobalSettingsPage() {
  const { toast } = useZoruToast();
  const [settings, setSettings] = useState<WsGlobalSetting | null>(null);
  const [currencies, setCurrencies] = useState<WsCurrency[]>([]);
  const [currencyId, setCurrencyId] = useState('');
  const [rtl, setRtl] = useState('no');
  const [strictTimezone, setStrictTimezone] = useState('no');
  const [emailVerified, setEmailVerified] = useState('no');
  const [isLoading, startLoading] = useTransition();
  const [saveState, formAction, isSaving] = useActionState(
    saveGlobalSettings,
    initialState,
  );

  const refresh = useCallback(() => {
    startLoading(async () => {
      const [s, cs] = await Promise.all([getGlobalSettings(), getCurrencies()]);
      setSettings(s);
      setCurrencies(cs as unknown as WsCurrency[]);
      if (s) {
        setCurrencyId(s.currency_id ?? '');
        setRtl(s.rtl ? 'yes' : 'no');
        setStrictTimezone(s.strict_timezone ? 'yes' : 'no');
        setEmailVerified(s.email_verified ? 'yes' : 'no');
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

  return (
    <div className="flex min-h-full flex-col gap-6">
      <ZoruBreadcrumb>
        <ZoruBreadcrumbList>
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/dashboard/crm">CRM</ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/dashboard/crm/settings">Settings</ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbPage>Global</ZoruBreadcrumbPage>
          </ZoruBreadcrumbItem>
        </ZoruBreadcrumbList>
      </ZoruBreadcrumb>

      <ZoruPageHeader>
        <ZoruPageHeading>
          <ZoruPageTitle>Global Settings</ZoruPageTitle>
          <ZoruPageDescription>
            Workspace-wide defaults — timezone, date/moment format, RTL, and default currency.
          </ZoruPageDescription>
        </ZoruPageHeading>
      </ZoruPageHeader>

      {isLoading && !settings ? (
        <ZoruCard className="p-6">
          <ZoruSkeleton className="h-[320px] w-full" />
        </ZoruCard>
      ) : (
        <ZoruCard className="p-6">
          <form action={formAction} className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <ZoruLabel htmlFor="business_name" className="text-[13px]">
                  Business Name
                </ZoruLabel>
                <ZoruInput
                  id="business_name"
                  name="business_name"
                  defaultValue={settings?.business_name ?? ''}
                  className="mt-1.5"
                />
              </div>
              <div>
                <ZoruLabel htmlFor="timezone" className="text-[13px]">
                  Timezone
                </ZoruLabel>
                <div className="mt-1.5">
                  <EnumFormField
                    name="timezone"
                    enumName="timezonePreset"
                    initialId={settings?.timezone ?? 'Asia/Kolkata'}
                    placeholder="Pick a timezone (or type a custom IANA id)"
                  />
                </div>
              </div>
              <div>
                <ZoruLabel htmlFor="currency_id" className="text-[13px]">
                  Default Currency
                </ZoruLabel>
                <div className="mt-1.5">
                  <EntityFormField
                    entity="currency"
                    name="currency_id"
                    initialId={currencyId || undefined}
                    onChange={(id) => setCurrencyId(id ?? '')}
                    placeholder="Select currency"
                    allowCreate
                  />
                </div>
              </div>
              <div>
                <ZoruLabel htmlFor="datepicker_format" className="text-[13px]">
                  Date-picker Format
                </ZoruLabel>
                <div className="mt-1.5">
                  <EnumFormField
                    name="datepicker_format"
                    enumName="datepickerFormat"
                    initialId={settings?.datepicker_format ?? 'dd-mm-yyyy'}
                  />
                </div>
              </div>
              <div>
                <ZoruLabel htmlFor="moment_format" className="text-[13px]">
                  Moment.js Format
                </ZoruLabel>
                <div className="mt-1.5">
                  <EnumFormField
                    name="moment_format"
                    enumName="momentFormat"
                    initialId={settings?.moment_format ?? 'DD-MM-YYYY'}
                  />
                </div>
              </div>
              <div>
                <ZoruLabel htmlFor="rtl" className="text-[13px]">
                  Right-to-left Layout
                </ZoruLabel>
                <div className="mt-1.5">
                  <EnumFormField
                    name="rtl"
                    enumName="yesNo"
                    initialId={rtl}
                    onChange={(id) => setRtl(id ?? 'no')}
                  />
                </div>
              </div>
              <div>
                <ZoruLabel htmlFor="strict_timezone" className="text-[13px]">
                  Strict Timezone
                </ZoruLabel>
                <div className="mt-1.5">
                  <EnumFormField
                    name="strict_timezone"
                    enumName="yesNo"
                    initialId={strictTimezone}
                    onChange={(id) => setStrictTimezone(id ?? 'no')}
                  />
                </div>
              </div>
              <div>
                <ZoruLabel htmlFor="email_verified" className="text-[13px]">
                  Email Verified
                </ZoruLabel>
                <div className="mt-1.5">
                  <EnumFormField
                    name="email_verified"
                    enumName="yesNo"
                    initialId={emailVerified}
                    onChange={(id) => setEmailVerified(id ?? 'no')}
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <ZoruButton type="submit" disabled={isSaving}>
                {isSaving ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                ) : null}
                Save Global Settings
              </ZoruButton>
            </div>
          </form>
        </ZoruCard>
      )}
    </div>
  );
}
