'use client';

import { Button, Card, CardBody, CardDescription, CardHeader, CardTitle, Input, Label, Textarea, useToast } from '@/components/sabcrm/20ui/compat';
import {
  useRouter } from 'next/navigation';
import { LoaderCircle,
  Save,
  UserPlus } from 'lucide-react';

/**
 * <AccountForm> — shared client form for `/dashboard/crm/accounts/new`
 * and `/dashboard/crm/accounts/[accountId]/edit` (§1D.3).
 *
 * Drives both `addCrmAccount` and `updateCrmAccount` server actions.
 * The same component handles "Save", "Save & New", and "Save & Add
 * contact" via a small `intent` parameter; routing happens here on the
 * action's response.
 *
 * Field-name contract: every named input matches what the actions read
 * via `formData.get(...)` (see `src/app/actions/crm-accounts.actions.ts`):
 *   name · industry · website · phone · address · country · state · city ·
 *   gstin · pan · billingAddress · shippingAddress · annualRevenue ·
 *   employeeCount · currency · paymentTerms · category · logoUrl ·
 *   accountId (edit only).
 */

import * as React from 'react';

import { EntityFormField } from '@/components/crm/entity-form-field';
import { EnumFormField } from '@/components/crm/enum-form-field';
import { DirtyFormPrompt } from '@/components/crm/dirty-form-prompt';
import { useFormKeyboardShortcuts } from '@/components/crm/use-form-keyboard-shortcuts';
import { SabFileUrlInput } from '@/components/sabfiles';
import {
    addCrmAccount,
    updateCrmAccount,
} from '@/app/actions/crm-accounts.actions';
import type { CrmAccount } from '@/lib/definitions';
import type { WithId } from 'mongodb';

// Catalogue lives in `src/data/reference/crm-enums.ts` (accountCategory,
// paymentTermsLegacy) — the pickers below pull from there.

export interface AccountFormPrefill {
    name?: string;
    industry?: string;
    website?: string;
    phone?: string;
    country?: string;
    state?: string;
    city?: string;
    currency?: string;
    category?: string;
}

interface AccountFormProps {
    mode: 'create' | 'edit';
    initial?: WithId<CrmAccount> | null;
    prefill?: AccountFormPrefill | null;
}

type ActionState = {
    message?: string;
    error?: string;
    accountId?: string;
    newClient?: { _id?: unknown };
};

export function AccountForm({ mode, initial, prefill }: AccountFormProps) {
    const router = useRouter();
    const { toast } = useToast();
    const formRef = React.useRef<HTMLFormElement>(null);
    const [pending, startTransition] = React.useTransition();
    const [dirty, setDirty] = React.useState(false);
    const onDirty = React.useCallback(() => setDirty(true), []);

    /* ─── Profile ──────────────────────────────────────────────── */
    const [name, setName] = React.useState(initial?.name ?? prefill?.name ?? '');
    const [industry, setIndustry] = React.useState(
        initial?.industry ?? prefill?.industry ?? '',
    );
    const [website, setWebsite] = React.useState(
        initial?.website ?? prefill?.website ?? '',
    );
    const [phone, setPhone] = React.useState(
        initial?.phone ?? prefill?.phone ?? '',
    );
    const [category, setCategory] = React.useState<string>(
        (initial?.category as string | undefined) ?? prefill?.category ?? '',
    );
    const [logoUrl, setLogoUrl] = React.useState(initial?.logoUrl ?? '');

    /* ─── Address cascade ─────────────────────────────────────── */
    const [country, setCountry] = React.useState(
        initial?.country ?? prefill?.country ?? '',
    );
    const [stateVal, setStateVal] = React.useState(
        initial?.state ?? prefill?.state ?? '',
    );
    const [city, setCity] = React.useState(
        initial?.city ?? prefill?.city ?? '',
    );
    const [address, setAddress] = React.useState(initial?.address ?? '');
    const [billingAddress, setBillingAddress] = React.useState(
        initial?.billingAddress ?? '',
    );
    const [shippingAddress, setShippingAddress] = React.useState(
        initial?.shippingAddress ?? '',
    );

    /* ─── Commercial ─────────────────────────────────────────── */
    const [currency, setCurrency] = React.useState(
        initial?.currency ?? prefill?.currency ?? '',
    );
    const [paymentTerms, setPaymentTerms] = React.useState<string>(
        (initial?.paymentTerms as string | undefined) ?? '',
    );
    const [annualRevenue, setAnnualRevenue] = React.useState<string>(
        initial?.annualRevenue !== undefined ? String(initial.annualRevenue) : '',
    );
    const [employeeCount, setEmployeeCount] = React.useState<string>(
        initial?.employeeCount !== undefined ? String(initial.employeeCount) : '',
    );

    /* ─── Identifiers ────────────────────────────────────────── */
    const [gstin, setGstin] = React.useState(initial?.gstin ?? '');
    const [pan, setPan] = React.useState(initial?.pan ?? '');

    const submit = React.useCallback(
        async (intent: 'save' | 'save_new' | 'save_contact') => {
            if (!name.trim()) {
                toast({
                    title: 'Company name is required',
                    variant: 'destructive',
                });
                return;
            }
            if (!formRef.current) return;
            const fd = new FormData(formRef.current);
            // Ensure controlled state wins over any stray DOM values.
            fd.set('name', name);

            startTransition(async () => {
                const state: ActionState =
                    mode === 'edit'
                        ? await updateCrmAccount({}, fd)
                        : await addCrmAccount({}, fd);

                if (state.error) {
                    toast({
                        title: 'Could not save',
                        description: state.error,
                        variant: 'destructive',
                    });
                    return;
                }

                setDirty(false);
                toast({ title: state.message ?? 'Saved' });

                const newId =
                    state.accountId ??
                    (state.newClient?._id ? String(state.newClient._id) : '') ??
                    (initial?._id ? String(initial._id) : '');

                if (intent === 'save_new') {
                    router.push('/dashboard/crm/accounts/new');
                    return;
                }
                if (intent === 'save_contact' && newId) {
                    router.push(
                        `/dashboard/crm/sales-crm/contacts/new?accountId=${newId}`,
                    );
                    return;
                }
                if (newId) {
                    router.push(`/dashboard/crm/accounts/${newId}`);
                } else {
                    router.push('/dashboard/crm/accounts');
                }
            });
        },
        [mode, initial?._id, name, router, toast],
    );

    const handleCancel = React.useCallback(() => {
        if (dirty && typeof window !== 'undefined') {
            const ok = window.confirm(
                'You have unsaved changes. Discard and leave?',
            );
            if (!ok) return;
        }
        router.back();
    }, [dirty, router]);

    useFormKeyboardShortcuts({
        onSave: () => void submit('save'),
        onSaveNew: () => void submit('save_new'),
        onCancel: handleCancel,
    });

    return (
        <>
            <DirtyFormPrompt dirty={dirty} />
            <form
                ref={formRef}
                onChange={onDirty}
                onSubmit={(e) => {
                    e.preventDefault();
                    void submit('save');
                }}
                className="flex w-full flex-col gap-4"
            >
                {mode === 'edit' && initial?._id ? (
                    <input
                        type="hidden"
                        name="accountId"
                        value={String(initial._id)}
                    />
                ) : null}

                {/* ─── Profile ─────────────────────────────────── */}
                <Card className="p-0">
                    <CardHeader>
                        <CardTitle>Profile</CardTitle>
                        <CardDescription>
                            Identity, industry, and how to reach the company.
                            Required fields marked with *.
                        </CardDescription>
                    </CardHeader>
                    <CardBody className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2 md:col-span-2">
                            <Label htmlFor="name">Company name *</Label>
                            <Input
                                id="name"
                                name="name"
                                value={name}
                                onChange={(e) => {
                                    setName(e.target.value);
                                    onDirty();
                                }}
                                required
                                placeholder="Acme Corp"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Industry</Label>
                            <EntityFormField
                                entity="industry"
                                name="industry"
                                initialId={industry || null}
                                initialLabel={industry}
                                onChange={(id) => {
                                    setIndustry(id ?? '');
                                    onDirty();
                                }}
                                placeholder="Select or create…"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="website">Website</Label>
                            <Input
                                id="website"
                                name="website"
                                type="url"
                                value={website}
                                onChange={(e) => {
                                    setWebsite(e.target.value);
                                    onDirty();
                                }}
                                placeholder="https://example.com"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="phone">Phone</Label>
                            <Input
                                id="phone"
                                name="phone"
                                value={phone}
                                onChange={(e) => {
                                    setPhone(e.target.value);
                                    onDirty();
                                }}
                                placeholder="+91 22 1234 5678"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Category</Label>
                            <EnumFormField
                                enumName="accountCategory"
                                name="category"
                                initialId={category || null}
                                placeholder="Pick a category…"
                                onChange={(id) => {
                                    setCategory(id ?? '');
                                    onDirty();
                                }}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Logo</Label>
                            <SabFileUrlInput
                                name="logoUrl"
                                accept="image"
                                value={logoUrl}
                                onChange={(v) => {
                                    setLogoUrl(v);
                                    onDirty();
                                }}
                                placeholder="Pick a logo from SabFiles"
                                pickerTitle="Choose account logo"
                            />
                        </div>
                    </CardBody>
                </Card>

                {/* ─── Address ─────────────────────────────────── */}
                <Card className="p-0">
                    <CardHeader>
                        <CardTitle>Address</CardTitle>
                        <CardDescription>
                            Registered, billing, and shipping locations.
                        </CardDescription>
                    </CardHeader>
                    <CardBody className="grid gap-4 md:grid-cols-3">
                        <div className="space-y-2">
                            <Label>Country</Label>
                            <EntityFormField
                                entity="country"
                                name="country"
                                initialId={country || null}
                                initialLabel={country}
                                onChange={(id) => {
                                    setCountry(id ?? '');
                                    setStateVal('');
                                    setCity('');
                                    onDirty();
                                }}
                                placeholder="Select a country…"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>State / Region</Label>
                            <EntityFormField
                                entity="state"
                                name="state"
                                initialId={stateVal || null}
                                initialLabel={stateVal}
                                filter={country ? { countryCode: country } : undefined}
                                onChange={(id) => {
                                    setStateVal(id ?? '');
                                    setCity('');
                                    onDirty();
                                }}
                                placeholder="Select a state…"
                                disabled={!country}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>City</Label>
                            <EntityFormField
                                entity="city"
                                name="city"
                                initialId={city || null}
                                initialLabel={city}
                                filter={
                                    country
                                        ? {
                                              countryCode: country,
                                              ...(stateVal
                                                  ? { stateCode: stateVal.includes(':') ? stateVal.split(':')[1] : stateVal }
                                                  : {}),
                                          }
                                        : undefined
                                }
                                onChange={(id) => {
                                    setCity(id ?? '');
                                    onDirty();
                                }}
                                placeholder="Select a city…"
                                disabled={!stateVal}
                            />
                        </div>
                        <div className="space-y-2 md:col-span-3">
                            <Label htmlFor="address">
                                Registered address
                            </Label>
                            <Textarea
                                id="address"
                                name="address"
                                rows={2}
                                value={address}
                                onChange={(e) => {
                                    setAddress(e.target.value);
                                    onDirty();
                                }}
                                placeholder="Street, locality, ZIP…"
                            />
                        </div>
                        <div className="space-y-2 md:col-span-3 lg:col-span-3">
                            <Label htmlFor="billingAddress">
                                Billing address
                            </Label>
                            <Textarea
                                id="billingAddress"
                                name="billingAddress"
                                rows={2}
                                value={billingAddress}
                                onChange={(e) => {
                                    setBillingAddress(e.target.value);
                                    onDirty();
                                }}
                                placeholder="If different from registered."
                            />
                        </div>
                        <div className="space-y-2 md:col-span-3 lg:col-span-3">
                            <Label htmlFor="shippingAddress">
                                Shipping address
                            </Label>
                            <Textarea
                                id="shippingAddress"
                                name="shippingAddress"
                                rows={2}
                                value={shippingAddress}
                                onChange={(e) => {
                                    setShippingAddress(e.target.value);
                                    onDirty();
                                }}
                                placeholder="If different from registered."
                            />
                        </div>
                    </CardBody>
                </Card>

                {/* ─── Commercial ──────────────────────────────── */}
                <Card className="p-0">
                    <CardHeader>
                        <CardTitle>Commercial</CardTitle>
                        <CardDescription>
                            Currency, terms, and rough firmographics.
                        </CardDescription>
                    </CardHeader>
                    <CardBody className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                            <Label>Currency</Label>
                            <EntityFormField
                                entity="currency"
                                name="currency"
                                initialId={currency || null}
                                initialLabel={currency}
                                onChange={(id) => {
                                    setCurrency(id ?? '');
                                    onDirty();
                                }}
                                placeholder="USD, INR, EUR…"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Payment terms</Label>
                            <EnumFormField
                                enumName="paymentTermsLegacy"
                                name="paymentTerms"
                                initialId={paymentTerms || null}
                                placeholder="Pick terms…"
                                onChange={(id) => {
                                    setPaymentTerms(id ?? '');
                                    onDirty();
                                }}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="annualRevenue">
                                Annual revenue
                            </Label>
                            <Input
                                id="annualRevenue"
                                name="annualRevenue"
                                type="number"
                                step="0.01"
                                value={annualRevenue}
                                onChange={(e) => {
                                    setAnnualRevenue(e.target.value);
                                    onDirty();
                                }}
                                placeholder="0"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="employeeCount">
                                Employees
                            </Label>
                            <Input
                                id="employeeCount"
                                name="employeeCount"
                                type="number"
                                step="1"
                                value={employeeCount}
                                onChange={(e) => {
                                    setEmployeeCount(e.target.value);
                                    onDirty();
                                }}
                                placeholder="0"
                            />
                        </div>
                    </CardBody>
                </Card>

                {/* ─── Identifiers ─────────────────────────────── */}
                <Card className="p-0">
                    <CardHeader>
                        <CardTitle>Identifiers</CardTitle>
                        <CardDescription>
                            Tax IDs and registration codes used on documents.
                        </CardDescription>
                    </CardHeader>
                    <CardBody className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                            <Label htmlFor="gstin">GSTIN</Label>
                            <Input
                                id="gstin"
                                name="gstin"
                                value={gstin}
                                onChange={(e) => {
                                    setGstin(e.target.value.toUpperCase());
                                    onDirty();
                                }}
                                placeholder="29AAAAA0000A1Z5"
                                className="font-mono"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="pan">PAN</Label>
                            <Input
                                id="pan"
                                name="pan"
                                value={pan}
                                onChange={(e) => {
                                    setPan(e.target.value.toUpperCase());
                                    onDirty();
                                }}
                                placeholder="AAAAA0000A"
                                className="font-mono"
                            />
                        </div>
                    </CardBody>
                </Card>

                {/* Sticky action bar */}
                <div className="sticky bottom-0 z-10 -mx-1 border-t border-[var(--st-border)] bg-[var(--st-bg)]/95 px-1 py-3 backdrop-blur supports-[backdrop-filter]:bg-[var(--st-bg)]/75">
                    <div className="flex flex-wrap items-center justify-end gap-2">
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={handleCancel}
                        >
                            Cancel
                        </Button>
                        {mode === 'create' ? (
                            <Button
                                type="button"
                                variant="outline"
                                disabled={pending}
                                onClick={() => void submit('save_contact')}
                            >
                                <UserPlus className="h-4 w-4" /> Save & add
                                contact
                            </Button>
                        ) : null}
                        {mode === 'create' ? (
                            <Button
                                type="button"
                                variant="outline"
                                disabled={pending}
                                onClick={() => void submit('save_new')}
                            >
                                Save & new
                            </Button>
                        ) : null}
                        <Button type="submit" disabled={pending}>
                            {pending ? (
                                <LoaderCircle className="h-4 w-4 animate-spin" />
                            ) : (
                                <Save className="h-4 w-4" />
                            )}
                            {mode === 'edit' ? 'Save changes' : 'Save account'}
                        </Button>
                    </div>
                </div>
            </form>
        </>
    );
}
