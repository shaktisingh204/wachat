'use client';

import { useActionState, useCallback, useEffect, useState, useTransition } from 'react';
import { Building2, LoaderCircle } from 'lucide-react';

import { ClayButton, ClayCard } from '@/components/clay';
import { CrmPageHeader } from '../../_components/crm-page-header';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import {
  getCompanyProfile,
  saveCompanyProfile,
} from '@/app/actions/worksuite/company.actions';
import type { WsCompanyProfile } from '@/lib/worksuite/company-types';

type FormState = { message?: string; error?: string; id?: string };
const initialState: FormState = {};

const inputClass =
  'h-10 rounded-clay-md border-clay-border bg-clay-surface text-[13px]';

function Field({
  name,
  label,
  defaultValue,
  type = 'text',
  placeholder,
  fullWidth,
}: {
  name: string;
  label: string;
  defaultValue?: string | number;
  type?: string;
  placeholder?: string;
  fullWidth?: boolean;
}) {
  return (
    <div className={fullWidth ? 'md:col-span-2' : ''}>
      <Label htmlFor={name} className="text-[13px] text-clay-ink">
        {label}
      </Label>
      <Input
        id={name}
        name={name}
        type={type}
        defaultValue={defaultValue ?? ''}
        placeholder={placeholder}
        className={`mt-1.5 ${inputClass}`}
      />
    </div>
  );
}

export default function CompanyProfilePage() {
  const { toast } = useToast();
  const [profile, setProfile] = useState<WsCompanyProfile | null>(null);
  const [isLoading, startLoading] = useTransition();
  const [saveState, formAction, isSaving] = useActionState(
    saveCompanyProfile,
    initialState,
  );

  const refresh = useCallback(() => {
    startLoading(async () => {
      const p = await getCompanyProfile();
      setProfile(p);
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
        title="Company Profile"
        subtitle="Master details for your organization — branding, contact, fiscal year, and document prefixes."
        icon={Building2}
      />

      {isLoading && !profile ? (
        <ClayCard>
          <Skeleton className="h-[420px] w-full" />
        </ClayCard>
      ) : (
        <form action={formAction}>
          <div className="grid items-start gap-6 lg:grid-cols-2">
            <ClayCard>
              <h2 className="mb-4 text-[16px] font-semibold text-clay-ink">
                Identity
              </h2>
              <div className="grid gap-4 md:grid-cols-2">
                <Field
                  name="company_name"
                  label="Company Name"
                  defaultValue={profile?.company_name}
                  fullWidth
                />
                <Field
                  name="legal_name"
                  label="Legal Name"
                  defaultValue={profile?.legal_name}
                />
                <Field
                  name="logo"
                  label="Logo URL"
                  type="url"
                  defaultValue={profile?.logo}
                  placeholder="https://…"
                />
                <Field
                  name="website"
                  label="Website"
                  type="url"
                  defaultValue={profile?.website}
                />
                <Field
                  name="email"
                  label="Email"
                  type="email"
                  defaultValue={profile?.email}
                />
                <Field
                  name="phone"
                  label="Phone"
                  type="tel"
                  defaultValue={profile?.phone}
                />
                <div className="md:col-span-2">
                  <Label htmlFor="address" className="text-[13px] text-clay-ink">
                    Primary Address
                  </Label>
                  <Textarea
                    id="address"
                    name="address"
                    rows={2}
                    defaultValue={profile?.address ?? ''}
                    className="mt-1.5 rounded-clay-md border-clay-border bg-clay-surface text-[13px]"
                  />
                </div>
                <Field name="city" label="City" defaultValue={profile?.city} />
                <Field name="state" label="State" defaultValue={profile?.state} />
                <Field
                  name="country_id"
                  label="Country Code / ID"
                  defaultValue={profile?.country_id}
                />
                <Field
                  name="postal_code"
                  label="Postal Code"
                  defaultValue={profile?.postal_code}
                />
                <Field
                  name="gst_number"
                  label="GST Number"
                  defaultValue={profile?.gst_number}
                />
                <Field
                  name="pan_number"
                  label="PAN Number"
                  defaultValue={profile?.pan_number}
                />
              </div>
            </ClayCard>

            <ClayCard>
              <h2 className="mb-4 text-[16px] font-semibold text-clay-ink">
                Locale & Fiscal
              </h2>
              <div className="grid gap-4 md:grid-cols-2">
                <Field
                  name="currency_code"
                  label="Currency Code"
                  defaultValue={profile?.currency_code}
                  placeholder="USD"
                />
                <Field
                  name="fiscal_year_start_month"
                  label="Fiscal Year Start Month (1–12)"
                  type="number"
                  defaultValue={profile?.fiscal_year_start_month ?? 1}
                />
                <Field
                  name="timezone"
                  label="Timezone"
                  defaultValue={profile?.timezone}
                  placeholder="Asia/Kolkata"
                />
                <Field
                  name="language"
                  label="Language"
                  defaultValue={profile?.language}
                  placeholder="en"
                />
                <Field
                  name="date_format"
                  label="Date Format"
                  defaultValue={profile?.date_format}
                  placeholder="DD-MM-YYYY"
                />
                <Field
                  name="time_format"
                  label="Time Format"
                  defaultValue={profile?.time_format}
                  placeholder="h:i a"
                />
                <Field
                  name="first_day_of_week"
                  label="First Day of Week (0 = Sun)"
                  type="number"
                  defaultValue={profile?.first_day_of_week ?? 1}
                />
              </div>

              <h2 className="mb-4 mt-6 text-[16px] font-semibold text-clay-ink">
                Document Prefixes
              </h2>
              <div className="grid gap-4 md:grid-cols-3">
                <Field
                  name="invoice_prefix"
                  label="Invoice"
                  defaultValue={profile?.invoice_prefix}
                  placeholder="INV"
                />
                <Field
                  name="estimate_prefix"
                  label="Estimate"
                  defaultValue={profile?.estimate_prefix}
                  placeholder="EST"
                />
                <Field
                  name="proposal_prefix"
                  label="Proposal"
                  defaultValue={profile?.proposal_prefix}
                  placeholder="PRO"
                />
              </div>

              <div className="mt-6 flex justify-end">
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
                  Save Profile
                </ClayButton>
              </div>
            </ClayCard>
          </div>
        </form>
      )}
    </div>
  );
}
