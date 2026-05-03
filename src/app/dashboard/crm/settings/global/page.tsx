'use client';

import { useActionState, useCallback, useEffect, useState, useTransition } from 'react';
import { Globe2, LoaderCircle } from 'lucide-react';

import { ClayButton, ClayCard } from '@/components/clay';
import { CrmPageHeader } from '../../_components/crm-page-header';
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

const inputClass =
  'h-10 rounded-lg border-border bg-card text-[13px]';

export default function GlobalSettingsPage() {
  const { toast } = useToast();
  const [settings, setSettings] = useState<WsGlobalSetting | null>(null);
  const [currencies, setCurrencies] = useState<WsCurrency[]>([]);
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
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="Global Settings"
        subtitle="Workspace-wide defaults — timezone, date/moment format, RTL, and default currency."
        icon={Globe2}
      />

      {isLoading && !settings ? (
        <ClayCard>
          <Skeleton className="h-[320px] w-full" />
        </ClayCard>
      ) : (
        <ClayCard>
          <form action={formAction} className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor="business_name" className="text-[13px] text-foreground">
                  Business Name
                </Label>
                <Input
                  id="business_name"
                  name="business_name"
                  defaultValue={settings?.business_name ?? ''}
                  className={`mt-1.5 ${inputClass}`}
                />
              </div>
              <div>
                <Label htmlFor="timezone" className="text-[13px] text-foreground">
                  Timezone
                </Label>
                <Input
                  id="timezone"
                  name="timezone"
                  defaultValue={settings?.timezone ?? 'Asia/Kolkata'}
                  className={`mt-1.5 ${inputClass}`}
                />
              </div>
              <div>
                <Label htmlFor="currency_id" className="text-[13px] text-foreground">
                  Default Currency
                </Label>
                <Select
                  name="currency_id"
                  defaultValue={settings?.currency_id ?? ''}
                >
                  <SelectTrigger id="currency_id" className={`mt-1.5 ${inputClass}`}>
                    <SelectValue placeholder="Select currency" />
                  </SelectTrigger>
                  <SelectContent>
                    {currencies.map((c) => (
                      <SelectItem key={String(c._id)} value={String(c._id)}>
                        {c.code} — {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label
                  htmlFor="datepicker_format"
                  className="text-[13px] text-foreground"
                >
                  Date-picker Format
                </Label>
                <Input
                  id="datepicker_format"
                  name="datepicker_format"
                  defaultValue={settings?.datepicker_format ?? 'dd-mm-yyyy'}
                  className={`mt-1.5 ${inputClass}`}
                />
              </div>
              <div>
                <Label htmlFor="moment_format" className="text-[13px] text-foreground">
                  Moment.js Format
                </Label>
                <Input
                  id="moment_format"
                  name="moment_format"
                  defaultValue={settings?.moment_format ?? 'DD-MM-YYYY'}
                  className={`mt-1.5 ${inputClass}`}
                />
              </div>
              <div>
                <Label htmlFor="rtl" className="text-[13px] text-foreground">
                  Right-to-left Layout
                </Label>
                <Select name="rtl" defaultValue={settings?.rtl ? 'yes' : 'no'}>
                  <SelectTrigger id="rtl" className={`mt-1.5 ${inputClass}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="no">No</SelectItem>
                    <SelectItem value="yes">Yes</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label
                  htmlFor="strict_timezone"
                  className="text-[13px] text-foreground"
                >
                  Strict Timezone
                </Label>
                <Select
                  name="strict_timezone"
                  defaultValue={settings?.strict_timezone ? 'yes' : 'no'}
                >
                  <SelectTrigger
                    id="strict_timezone"
                    className={`mt-1.5 ${inputClass}`}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="no">No</SelectItem>
                    <SelectItem value="yes">Yes</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label
                  htmlFor="email_verified"
                  className="text-[13px] text-foreground"
                >
                  Email Verified
                </Label>
                <Select
                  name="email_verified"
                  defaultValue={settings?.email_verified ? 'yes' : 'no'}
                >
                  <SelectTrigger
                    id="email_verified"
                    className={`mt-1.5 ${inputClass}`}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="no">No</SelectItem>
                    <SelectItem value="yes">Yes</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex justify-end">
              <ClayButton
                type="submit"
                variant="obsidian"
                disabled={isSaving}
                leading={
                  isSaving ? (
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                  ) : undefined
                }
              >
                Save Global Settings
              </ClayButton>
            </div>
          </form>
        </ClayCard>
      )}
    </div>
  );
}
