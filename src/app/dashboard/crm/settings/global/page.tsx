'use client';

import {
  Breadcrumb,
  ZoruBreadcrumbItem,
  ZoruBreadcrumbLink,
  ZoruBreadcrumbList,
  ZoruBreadcrumbPage,
  ZoruBreadcrumbSeparator,
  Button,
  Card,
  Input,
  Label,
  ZoruPageDescription,
  PageHeader,
  ZoruPageHeading,
  ZoruPageTitle,
  Skeleton,
  StatCard,
  useZoruToast,
} from '@/components/zoruui';
import {
  useActionState,
  useCallback,
  useEffect,
  useState,
  useTransition,
} from 'react';
import { Building2, Clock, DollarSign, Globe, LoaderCircle } from 'lucide-react';

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
  const [datepickerFormat, setDatepickerFormat] = useState('dd-mm-yyyy');
  const [momentFormat, setMomentFormat] = useState('DD-MM-YYYY');
  const [timezone, setTimezone] = useState('Asia/Kolkata');
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
        setDatepickerFormat(s.datepicker_format ?? 'dd-mm-yyyy');
        setMomentFormat(s.moment_format ?? 'DD-MM-YYYY');
        setTimezone(s.timezone ?? 'Asia/Kolkata');
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
      toast({ title: 'Error', description: saveState.error, variant: 'destructive' });
    }
  }, [saveState, toast, refresh]);

  // resolve currency label for KPI
  const currencyLabel =
    currencies.find(
      (c) => String((c as unknown as { _id: string })._id) === currencyId,
    )?.currency_code ??
    currencyId ??
    '—';

  const getLiveDatePreview = () => {
    const today = new Date();
    const day = String(today.getDate()).padStart(2, '0');
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const year = String(today.getFullYear());

    let formattedPicker = datepickerFormat;
    formattedPicker = formattedPicker
      .replace('dd', day)
      .replace('mm', month)
      .replace('yyyy', year);

    let formattedMoment = momentFormat;
    formattedMoment = formattedMoment
      .replace('DD', day)
      .replace('MM', month)
      .replace('YYYY', year);

    return {
      picker: formattedPicker,
      moment: formattedMoment
    };
  };

  const preview = getLiveDatePreview();

  return (
    <div className="flex min-h-full flex-col gap-6">
      <Breadcrumb>
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
      </Breadcrumb>

      <PageHeader>
        <ZoruPageHeading>
          <ZoruPageTitle>Global Settings</ZoruPageTitle>
          <ZoruPageDescription>
            Workspace-wide defaults — timezone, date/moment format, RTL, and default currency.
          </ZoruPageDescription>
        </ZoruPageHeading>
      </PageHeader>

      {/* Status summary strip */}
      {settings ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard
            label="Business name"
            value={settings.business_name || '—'}
            icon={<Building2 className="h-4 w-4" />}
          />
          <StatCard
            label="Timezone"
            value={timezone || '—'}
            icon={<Clock className="h-4 w-4" />}
          />
          <StatCard
            label="Currency"
            value={currencyLabel}
            icon={<DollarSign className="h-4 w-4" />}
          />
          <StatCard
            label="RTL"
            value={settings.rtl ? 'Enabled' : 'Disabled'}
            icon={<Globe className="h-4 w-4" />}
          />
        </div>
      ) : null}

      {isLoading && !settings ? (
        <Card className="p-6">
          <Skeleton className="h-[320px] w-full" />
        </Card>
      ) : (
        <form action={formAction} className="flex flex-col gap-4">
          {/* Section: Identity */}
          <Card className="p-6">
            <h3 className="mb-4 text-[13px] uppercase tracking-wide text-zoru-ink-muted">
              Identity
            </h3>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor="business_name" className="text-[13px]">
                  Business Name
                </Label>
                <Input
                  id="business_name"
                  name="business_name"
                  defaultValue={settings?.business_name ?? ''}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="currency_id" className="text-[13px]">
                  Default Currency
                </Label>
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
            </div>
          </Card>

          {/* Section: Locale */}
          <Card className="p-6">
            <h3 className="mb-4 text-[13px] uppercase tracking-wide text-zoru-ink-muted">
              Locale &amp; Date Formats
            </h3>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor="timezone" className="text-[13px]">
                  Timezone
                </Label>
                <div className="mt-1.5">
                  <EnumFormField
                    name="timezone"
                    enumName="timezonePreset"
                    initialId={timezone}
                    onChange={(v) => setTimezone(v ?? 'Asia/Kolkata')}
                    placeholder="Pick a timezone (or type a custom IANA id)"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="datepicker_format" className="text-[13px]">
                  Date-picker Format
                </Label>
                <div className="mt-1.5">
                  <EnumFormField
                    name="datepicker_format"
                    enumName="datepickerFormat"
                    initialId={datepickerFormat}
                    onChange={(v) => setDatepickerFormat(v ?? 'dd-mm-yyyy')}
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="moment_format" className="text-[13px]">
                  Moment.js Format
                </Label>
                <div className="mt-1.5">
                  <EnumFormField
                    name="moment_format"
                    enumName="momentFormat"
                    initialId={momentFormat}
                    onChange={(v) => setMomentFormat(v ?? 'DD-MM-YYYY')}
                  />
                </div>
              </div>

              <div className="md:col-span-2 border-t border-dashed pt-4 mt-2">
                <div className="rounded-lg bg-zoru-surface-2 p-4 border border-zoru-line flex items-center justify-between flex-wrap gap-4">
                  <div>
                    <span className="text-[12px] font-semibold text-zoru-ink uppercase tracking-wide">Live Preview (Today)</span>
                    <p className="text-[11.5px] text-zoru-ink-muted mt-0.5">See how dates will look across the workspace based on your settings.</p>
                  </div>
                  <div className="flex gap-4">
                    <div className="rounded bg-zoru-surface px-3 py-1.5 border border-zoru-line font-mono text-[13px] text-zoru-ink">
                      <span className="text-[10px] block text-zoru-ink-muted font-sans font-normal mb-0.5">Date-picker Preview</span>
                      {preview.picker}
                    </div>
                    <div className="rounded bg-zoru-surface px-3 py-1.5 border border-zoru-line font-mono text-[13px] text-zoru-ink">
                      <span className="text-[10px] block text-zoru-ink-muted font-sans font-normal mb-0.5">Moment.js Preview</span>
                      {preview.moment}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Card>

          {/* Section: Behaviour */}
          <Card className="p-6">
            <h3 className="mb-4 text-[13px] uppercase tracking-wide text-zoru-ink-muted">
              Behaviour
            </h3>
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <Label htmlFor="rtl" className="text-[13px]">
                  Right-to-left Layout
                </Label>
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
                <Label htmlFor="strict_timezone" className="text-[13px]">
                  Strict Timezone
                </Label>
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
                <Label htmlFor="email_verified" className="text-[13px]">
                  Email Verified
                </Label>
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
          </Card>

          <div className="flex justify-end">
            <Button type="submit" disabled={isSaving}>
              {isSaving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
              Save Global Settings
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
