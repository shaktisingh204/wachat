'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { LoaderCircle, Save } from 'lucide-react';

import { saveCrmVendor } from '@/app/actions/crm-vendors.actions';
import { EntityFormField } from '@/components/crm/entity-form-field';
import {
    ZoruButton,
    ZoruCard,
    ZoruCardContent,
    ZoruInput,
    ZoruLabel,
    ZoruTextarea,
} from '@/components/zoruui';

interface Props {
    vendor: Record<string, any>;
}

function SubmitButton() {
    const { pending } = useFormStatus();
    return (
        <ZoruButton type="submit" disabled={pending} className="gap-1">
            {pending ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
                <Save className="h-4 w-4" />
            )}
            Save
        </ZoruButton>
    );
}

export function VendorEditForm({ vendor }: Props) {
    const [state, action] = useActionState(saveCrmVendor as any, {
        message: '',
        error: '',
    } as any);

    return (
        <ZoruCard>
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
                        <ZoruLabel htmlFor="city">City</ZoruLabel>
                        <EntityFormField entity="city" name="city" initialId={vendor.city ?? null} initialLabel={vendor.city ?? ''} />
                    </div>
                    <div>
                        <ZoruLabel htmlFor="state">State</ZoruLabel>
                        <EntityFormField entity="state" name="state" initialId={vendor.state ?? null} initialLabel={vendor.state ?? ''} />
                    </div>
                    <div>
                        <ZoruLabel htmlFor="country">Country</ZoruLabel>
                        <EntityFormField entity="country" name="country" initialId={vendor.country ?? null} initialLabel={vendor.country ?? ''} />
                    </div>
                    <Field name="website" label="Website" defaultValue={vendor.website} />
                    <div>
                        <ZoruLabel htmlFor="industry">Industry</ZoruLabel>
                        <EntityFormField entity="industry" name="industry" initialId={vendor.industry ?? null} initialLabel={vendor.industry ?? ''} />
                    </div>
                    <Field name="paymentTerms" label="Payment terms" defaultValue={vendor.paymentTerms} />
                    <div className="md:col-span-2">
                        <ZoruLabel htmlFor="notes">Notes</ZoruLabel>
                        <ZoruTextarea id="notes" name="notes" defaultValue={vendor.notes ?? ''} rows={3} />
                    </div>
                    <div className="md:col-span-2 flex items-center justify-between gap-3">
                        <div className="text-sm">
                            {state?.error ? (
                                <span className="text-zoru-danger-ink">{state.error}</span>
                            ) : state?.message ? (
                                <span className="text-zoru-success-ink">{state.message}</span>
                            ) : null}
                        </div>
                        <SubmitButton />
                    </div>
                </form>
            </ZoruCardContent>
        </ZoruCard>
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
            <ZoruLabel htmlFor={name}>
                {label} {required ? <span className="text-zoru-danger-ink">*</span> : null}
            </ZoruLabel>
            <ZoruInput
                id={name}
                name={name}
                type={type}
                defaultValue={defaultValue ?? ''}
                required={required}
            />
        </div>
    );
}
