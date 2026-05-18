'use client';

import { ZoruCard, ZoruInput, ZoruLabel, ZoruSkeleton, ZoruTextarea, useZoruToast } from '@/components/zoruui';
import {
  useActionState,
  useCallback,
  useEffect,
  useState,
  useTransition,
  } from 'react';

/**
 * Company Profile — single-doc settings form per §1D.3:
 *  - Sectioned cards via <EntityFormShell> (Identity · Address ·
 *    Tax · Locale & Fiscal · Document Prefixes)
 *  - Every reference field uses <EntityFormField> (country, state,
 *    city, industry, currency, timezone, language) with cascade
 *    filter from country → state → city
 *  - Logo input goes through <SabFileUrlInput> (SabFiles policy)
 *  - Preserves every FormData key the existing saveCompanyProfile
 *    action reads (company_name, legal_name, logo, website, email,
 *    phone, address, country_id, state, city, postal_code, industry,
 *    gst_number, pan_number, currency_code, fiscal_year_start_month,
 *    timezone, language, date_format, time_format, first_day_of_week,
 *    invoice_prefix, estimate_prefix, proposal_prefix)
 */

import * as React from 'react';

import { SabFileUrlInput } from '@/components/sabfiles';
import { EntityFormField } from '@/components/crm/entity-form-field';
import { EntityFormShell } from '@/components/crm/entity-form-shell';
import { EntityListShell } from '@/components/crm/entity-list-shell';
import {
    getCompanyProfile,
    saveCompanyProfile,
} from '@/app/actions/worksuite/company.actions';
import type { WsCompanyProfile } from '@/lib/worksuite/company-types';

type FormState = { message?: string; error?: string; id?: string };
const initialState: FormState = {};

function TextField({
    name,
    label,
    defaultValue,
    type = 'text',
    placeholder,
    fullWidth,
}: {
    name: string;
    label: string;
    defaultValue?: string | number | null;
    type?: string;
    placeholder?: string;
    fullWidth?: boolean;
}) {
    return (
        <div className={fullWidth ? 'md:col-span-2' : ''}>
            <ZoruLabel htmlFor={name} className="text-[13px] text-zoru-ink">
                {label}
            </ZoruLabel>
            <ZoruInput
                id={name}
                name={name}
                type={type}
                defaultValue={defaultValue ?? ''}
                placeholder={placeholder}
                className="mt-1.5"
            />
        </div>
    );
}

function PickerField({
    label,
    name,
    entity,
    initialId,
    filter,
    placeholder,
}: {
    label: string;
    name: string;
    entity: Parameters<typeof EntityFormField>[0]['entity'];
    initialId: string | null;
    filter?: Record<string, unknown>;
    placeholder?: string;
}) {
    return (
        <div>
            <ZoruLabel className="text-[13px] text-zoru-ink">{label}</ZoruLabel>
            <div className="mt-1.5">
                <EntityFormField
                    entity={entity}
                    name={name}
                    initialId={initialId}
                    filter={filter}
                    placeholder={placeholder}
                />
            </div>
        </div>
    );
}

export default function CompanyProfilePage() {
    const { toast } = useZoruToast();
    const [profile, setProfile] = useState<WsCompanyProfile | null>(null);
    const [logo, setLogo] = useState<string>('');
    const [isLoading, startLoading] = useTransition();
    const [saveState, formAction] = useActionState(
        saveCompanyProfile,
        initialState,
    );

    const refresh = useCallback(() => {
        startLoading(async () => {
            const p = await getCompanyProfile();
            setProfile(p);
            setLogo(p?.logo ?? '');
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

    if (isLoading && !profile) {
        return (
            <EntityListShell
                title="Company Profile"
                subtitle="Master details for your organization — branding, contact, fiscal year, and document prefixes."
            >
                <ZoruCard className="p-6">
                    <ZoruSkeleton className="h-[420px] w-full" />
                </ZoruCard>
            </EntityListShell>
        );
    }

    return (
        <EntityListShell
            title="Company Profile"
            subtitle="Master details for your organization — branding, contact, fiscal year, and document prefixes."
        >
            <EntityFormShell
                action={formAction}
                submitLabel="Save Profile"
                error={saveState?.error}
                message={saveState?.message}
                sections={[
                    {
                        id: 'identity',
                        title: 'Identity',
                        description: 'Brand and legal names plus your company logo.',
                        children: (
                            <div className="grid gap-4 md:grid-cols-2">
                                <TextField
                                    name="company_name"
                                    label="Company Name"
                                    defaultValue={profile?.company_name}
                                    fullWidth
                                />
                                <TextField
                                    name="legal_name"
                                    label="Legal Name"
                                    defaultValue={profile?.legal_name}
                                />
                                <div>
                                    <ZoruLabel
                                        htmlFor="logo"
                                        className="text-[13px] text-zoru-ink"
                                    >
                                        Logo
                                    </ZoruLabel>
                                    <SabFileUrlInput
                                        id="logo"
                                        name="logo"
                                        value={logo}
                                        onChange={(v) => setLogo(v)}
                                        accept="image"
                                        placeholder="Pick from SabFiles or upload"
                                        className="mt-1.5"
                                    />
                                </div>
                                <PickerField
                                    label="Industry"
                                    name="industry"
                                    entity="industry"
                                    initialId={
                                        (profile as unknown as { industry?: string })
                                            ?.industry ?? null
                                    }
                                    placeholder="Select industry"
                                />
                            </div>
                        ),
                    },
                    {
                        id: 'contact',
                        title: 'Contact',
                        description: 'How customers reach you.',
                        children: (
                            <div className="grid gap-4 md:grid-cols-2">
                                <TextField
                                    name="email"
                                    label="Email"
                                    type="email"
                                    defaultValue={profile?.email}
                                />
                                <TextField
                                    name="phone"
                                    label="Phone"
                                    type="tel"
                                    defaultValue={profile?.phone}
                                />
                                <TextField
                                    name="website"
                                    label="Website"
                                    type="url"
                                    defaultValue={profile?.website}
                                    fullWidth
                                />
                            </div>
                        ),
                    },
                    {
                        id: 'address',
                        title: 'Address',
                        description: 'Primary registered office address.',
                        children: (
                            <div className="grid gap-4 md:grid-cols-2">
                                <div className="md:col-span-2">
                                    <ZoruLabel
                                        htmlFor="address"
                                        className="text-[13px] text-zoru-ink"
                                    >
                                        Primary Address
                                    </ZoruLabel>
                                    <ZoruTextarea
                                        id="address"
                                        name="address"
                                        rows={2}
                                        defaultValue={profile?.address ?? ''}
                                        className="mt-1.5"
                                    />
                                </div>
                                <PickerField
                                    label="Country"
                                    name="country_id"
                                    entity="country"
                                    initialId={profile?.country_id ?? null}
                                    placeholder="Select country"
                                />
                                <PickerField
                                    label="State"
                                    name="state"
                                    entity="state"
                                    initialId={profile?.state ?? null}
                                    filter={
                                        profile?.country_id
                                            ? { country: profile.country_id }
                                            : undefined
                                    }
                                    placeholder="Select state"
                                />
                                <PickerField
                                    label="City"
                                    name="city"
                                    entity="city"
                                    initialId={profile?.city ?? null}
                                    filter={
                                        profile?.state
                                            ? { state: profile.state }
                                            : profile?.country_id
                                              ? { country: profile.country_id }
                                              : undefined
                                    }
                                    placeholder="Select city"
                                />
                                <TextField
                                    name="postal_code"
                                    label="Postal Code"
                                    defaultValue={profile?.postal_code}
                                />
                            </div>
                        ),
                    },
                    {
                        id: 'tax',
                        title: 'Tax',
                        description: 'Tax identifiers shown on invoices and returns.',
                        children: (
                            <div className="grid gap-4 md:grid-cols-2">
                                <TextField
                                    name="gst_number"
                                    label="GSTIN"
                                    defaultValue={profile?.gst_number}
                                />
                                <TextField
                                    name="pan_number"
                                    label="PAN"
                                    defaultValue={profile?.pan_number}
                                />
                            </div>
                        ),
                    },
                    {
                        id: 'locale',
                        title: 'Locale & Fiscal',
                        description:
                            'Defaults used when creating new documents and records.',
                        children: (
                            <div className="grid gap-4 md:grid-cols-2">
                                <PickerField
                                    label="Currency"
                                    name="currency_code"
                                    entity="currency"
                                    initialId={profile?.currency_code ?? null}
                                    placeholder="Select currency"
                                />
                                <TextField
                                    name="fiscal_year_start_month"
                                    label="Fiscal Year Start Month (1–12)"
                                    type="number"
                                    defaultValue={profile?.fiscal_year_start_month ?? 1}
                                />
                                <PickerField
                                    label="Timezone"
                                    name="timezone"
                                    entity="timezone"
                                    initialId={profile?.timezone ?? null}
                                    placeholder="Asia/Kolkata"
                                />
                                <PickerField
                                    label="Language"
                                    name="language"
                                    entity="language"
                                    initialId={profile?.language ?? null}
                                    placeholder="Select language"
                                />
                                <TextField
                                    name="date_format"
                                    label="Date Format"
                                    defaultValue={profile?.date_format}
                                    placeholder="DD-MM-YYYY"
                                />
                                <TextField
                                    name="time_format"
                                    label="Time Format"
                                    defaultValue={profile?.time_format}
                                    placeholder="h:i a"
                                />
                                <TextField
                                    name="first_day_of_week"
                                    label="First Day of Week (0 = Sun)"
                                    type="number"
                                    defaultValue={profile?.first_day_of_week ?? 1}
                                />
                            </div>
                        ),
                    },
                    {
                        id: 'prefixes',
                        title: 'Document Prefixes',
                        description:
                            'Used when auto-generating invoice / estimate / proposal numbers.',
                        children: (
                            <div className="grid gap-4 md:grid-cols-3">
                                <TextField
                                    name="invoice_prefix"
                                    label="Invoice"
                                    defaultValue={profile?.invoice_prefix}
                                    placeholder="INV"
                                />
                                <TextField
                                    name="estimate_prefix"
                                    label="Estimate"
                                    defaultValue={profile?.estimate_prefix}
                                    placeholder="EST"
                                />
                                <TextField
                                    name="proposal_prefix"
                                    label="Proposal"
                                    defaultValue={profile?.proposal_prefix}
                                    placeholder="PRO"
                                />
                            </div>
                        ),
                    },
                ]}
            />
        </EntityListShell>
    );
}
