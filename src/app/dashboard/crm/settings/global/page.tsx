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
  ZoruSelect,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  ZoruSkeleton,
  useZoruToast,
} from '@/components/zoruui';
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
                <ZoruInput
                  id="timezone"
                  name="timezone"
                  defaultValue={settings?.timezone ?? 'Asia/Kolkata'}
                  className="mt-1.5"
                />
              </div>
              <div>
                <ZoruLabel htmlFor="currency_id" className="text-[13px]">
                  Default Currency
                </ZoruLabel>
                <ZoruSelect value={currencyId} onValueChange={setCurrencyId}>
                  <ZoruSelectTrigger id="currency_id" className="mt-1.5">
                    <ZoruSelectValue placeholder="Select currency" />
                  </ZoruSelectTrigger>
                  <ZoruSelectContent>
                    {currencies.map((c) => (
                      <ZoruSelectItem key={String(c._id)} value={String(c._id)}>
                        {c.code} — {c.name}
                      </ZoruSelectItem>
                    ))}
                  </ZoruSelectContent>
                </ZoruSelect>
                <input type="hidden" name="currency_id" value={currencyId} />
              </div>
              <div>
                <ZoruLabel htmlFor="datepicker_format" className="text-[13px]">
                  Date-picker Format
                </ZoruLabel>
                <ZoruInput
                  id="datepicker_format"
                  name="datepicker_format"
                  defaultValue={settings?.datepicker_format ?? 'dd-mm-yyyy'}
                  className="mt-1.5"
                />
              </div>
              <div>
                <ZoruLabel htmlFor="moment_format" className="text-[13px]">
                  Moment.js Format
                </ZoruLabel>
                <ZoruInput
                  id="moment_format"
                  name="moment_format"
                  defaultValue={settings?.moment_format ?? 'DD-MM-YYYY'}
                  className="mt-1.5"
                />
              </div>
              <div>
                <ZoruLabel htmlFor="rtl" className="text-[13px]">
                  Right-to-left Layout
                </ZoruLabel>
                <ZoruSelect value={rtl} onValueChange={setRtl}>
                  <ZoruSelectTrigger id="rtl" className="mt-1.5">
                    <ZoruSelectValue />
                  </ZoruSelectTrigger>
                  <ZoruSelectContent>
                    <ZoruSelectItem value="no">No</ZoruSelectItem>
                    <ZoruSelectItem value="yes">Yes</ZoruSelectItem>
                  </ZoruSelectContent>
                </ZoruSelect>
                <input type="hidden" name="rtl" value={rtl} />
              </div>
              <div>
                <ZoruLabel htmlFor="strict_timezone" className="text-[13px]">
                  Strict Timezone
                </ZoruLabel>
                <ZoruSelect value={strictTimezone} onValueChange={setStrictTimezone}>
                  <ZoruSelectTrigger id="strict_timezone" className="mt-1.5">
                    <ZoruSelectValue />
                  </ZoruSelectTrigger>
                  <ZoruSelectContent>
                    <ZoruSelectItem value="no">No</ZoruSelectItem>
                    <ZoruSelectItem value="yes">Yes</ZoruSelectItem>
                  </ZoruSelectContent>
                </ZoruSelect>
                <input type="hidden" name="strict_timezone" value={strictTimezone} />
              </div>
              <div>
                <ZoruLabel htmlFor="email_verified" className="text-[13px]">
                  Email Verified
                </ZoruLabel>
                <ZoruSelect value={emailVerified} onValueChange={setEmailVerified}>
                  <ZoruSelectTrigger id="email_verified" className="mt-1.5">
                    <ZoruSelectValue />
                  </ZoruSelectTrigger>
                  <ZoruSelectContent>
                    <ZoruSelectItem value="no">No</ZoruSelectItem>
                    <ZoruSelectItem value="yes">Yes</ZoruSelectItem>
                  </ZoruSelectContent>
                </ZoruSelect>
                <input type="hidden" name="email_verified" value={emailVerified} />
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
