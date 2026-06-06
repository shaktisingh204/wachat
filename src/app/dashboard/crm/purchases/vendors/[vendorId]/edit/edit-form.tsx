'use client';

import { Button, Card, ZoruCardContent, Input, Label, Textarea } from '@/components/sabcrm/20ui/compat';
import {
  useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { LoaderCircle,
  Save } from 'lucide-react';

import { saveCrmVendor } from '@/app/actions/crm-vendors.actions';
import { EntityFormField } from '@/components/crm/entity-form-field';

interface Props {
    vendor: Record<string, any>;
}

function SubmitButton() {
    const { pending } = useFormStatus();
    return (
        <Button type="submit" disabled={pending} className="gap-1">
            {pending ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
                <Save className="h-4 w-4" />
            )}
            Save
        </Button>
    );
}

export function VendorEditForm({ vendor }: Props) {
    const [state, action] = useActionState(saveCrmVendor as any, {
        message: '',
        error: '',
    } as any);

    return (
        <Card>
            <ZoruCardContent className="p-6">
                <form action={action} className="grid gap-4 md:grid-cols-2">
                    <input type="hidden" name="vendorId" value={String(vendor._id ?? '')} />
                    <Field name="name" label="Name" defaultValue={vendor.name} required />
                    <Field name="email" label="Email" defaultValue={vendor.email} type="email" />
                    <Field name="phone" label="Phone" defaultValue={vendor.phone} />
                    <Field name="gstin" label="GSTIN" defaultValue={vendor.gstin} />
                    <Field name="pan" label="PAN" defaultValue={vendor.pan} />
                    <Field name="address" label="Address" defaultValue={vendor.address} />
                    <div>
                        <Label htmlFor="city">City</Label>
                        <EntityFormField entity="city" name="city" initialId={vendor.city ?? null} initialLabel={vendor.city ?? ''} />
                    </div>
                    <div>
                        <Label htmlFor="state">State</Label>
                        <EntityFormField entity="state" name="state" initialId={vendor.state ?? null} initialLabel={vendor.state ?? ''} />
                    </div>
                    <div>
                        <Label htmlFor="country">Country</Label>
                        <EntityFormField entity="country" name="country" initialId={vendor.country ?? null} initialLabel={vendor.country ?? ''} />
                    </div>
                    <Field name="website" label="Website" defaultValue={vendor.website} />
                    <div>
                        <Label htmlFor="industry">Industry</Label>
                        <EntityFormField entity="industry" name="industry" initialId={vendor.industry ?? null} initialLabel={vendor.industry ?? ''} />
                    </div>
                    <Field name="paymentTerms" label="Payment terms" defaultValue={vendor.paymentTerms} />
                    <div className="md:col-span-2">
                        <Label htmlFor="notes">Notes</Label>
                        <Textarea id="notes" name="notes" defaultValue={vendor.notes ?? ''} rows={3} />
                    </div>
                    {/*
                     * MSME / IT §43B(h) compliance section (§6.10).
                     * All fields additive — legacy vendor rows have
                     * undefined values which coerce to non-MSME.
                     */}
                    <div className="md:col-span-2 rounded-lg border border-[var(--st-border)] bg-[var(--st-bg-muted)]/20 p-4">
                        <div className="mb-3 flex items-center justify-between">
                            <div>
                                <div className="text-[13.5px] font-semibold">MSME / Compliance</div>
                                <p className="text-[11.5px] text-[var(--st-text-secondary)]">
                                    Bills to MSME-registered vendors must clear in 45 days (MSMED Act + IT §43B(h)).
                                </p>
                            </div>
                        </div>
                        <div className="grid gap-3 md:grid-cols-2">
                            <label className="flex items-center gap-2 text-[13px]">
                                <input
                                    type="checkbox"
                                    name="isMsme"
                                    value="true"
                                    defaultChecked={Boolean(vendor.isMsme)}
                                />
                                MSME-registered (Udyam)
                            </label>
                            <Field
                                name="udyamRegistrationNumber"
                                label="Udyam Registration Number"
                                defaultValue={vendor.udyamRegistrationNumber}
                            />
                            <div>
                                <Label htmlFor="msmeCategory">MSME Category</Label>
                                <select
                                    id="msmeCategory"
                                    name="msmeCategory"
                                    defaultValue={vendor.msmeCategory ?? ''}
                                    className="h-10 w-full rounded-lg border border-[var(--st-border)] bg-[var(--st-bg-secondary)] px-3 text-[13px]"
                                >
                                    <option value="">—</option>
                                    <option value="Micro">Micro</option>
                                    <option value="Small">Small</option>
                                    <option value="Medium">Medium</option>
                                </select>
                            </div>
                            <Field
                                name="msmePaymentTermsDays"
                                label="Payment terms (days, default 45)"
                                defaultValue={
                                    vendor.msmePaymentTermsDays != null
                                        ? String(vendor.msmePaymentTermsDays)
                                        : ''
                                }
                                type="number"
                            />
                        </div>
                    </div>
                    <div className="md:col-span-2 flex items-center justify-between gap-3">
                        <div className="text-sm">
                            {state?.error ? (
                                <span className="text-[var(--st-danger)]">{state.error}</span>
                            ) : state?.message ? (
                                <span className="text-[var(--st-status-ok)]">{state.message}</span>
                            ) : null}
                        </div>
                        <SubmitButton />
                    </div>
                </form>
            </ZoruCardContent>
        </Card>
    );
}

function Field({
    name,
    label,
    defaultValue,
    required,
    type = 'text',
}: {
    name: string;
    label: string;
    defaultValue?: string;
    required?: boolean;
    type?: string;
}) {
    return (
        <div>
            <Label htmlFor={name}>
                {label} {required ? <span className="text-[var(--st-danger)]">*</span> : null}
            </Label>
            <Input
                id={name}
                name={name}
                type={type}
                defaultValue={defaultValue ?? ''}
                required={required}
            />
        </div>
    );
}
