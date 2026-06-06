'use client';

import { Button, Input, Label } from '@/components/sabcrm/20ui/compat';
import {
  useState,
  useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

/**
 * Client form for generating an e-way bill. Drives the
 * `generateEWayBill` server action.
 */

import { generateEWayBill } from '@/app/actions/crm-india-eway.actions';

export function NewEWayBillForm() {
    const router = useRouter();
    const [pending, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);

    function onSubmit(formData: FormData) {
        const payload = {
            invoiceId: (formData.get('invoiceId') as string).trim() || undefined,
            fromGstin: (formData.get('fromGstin') as string).trim(),
            toGstin: (formData.get('toGstin') as string).trim() || undefined,
            fromPincode: (formData.get('fromPincode') as string).trim(),
            fromStateCode: (formData.get('fromStateCode') as string).trim(),
            toPincode: (formData.get('toPincode') as string).trim(),
            toStateCode: (formData.get('toStateCode') as string).trim(),
            totalValue: Number(formData.get('totalValue')),
            distanceKm: Number(formData.get('distanceKm')),
            transporterId: (formData.get('transporterId') as string).trim() || undefined,
            vehicleNumber: (formData.get('vehicleNumber') as string).trim() || undefined,
            transactionType: Number(formData.get('transactionType')) || 1,
        };
        setError(null);
        startTransition(async () => {
            const r = await generateEWayBill(payload);
            if (!r.ok) {
                setError(r.error);
                return;
            }
            router.push(`/dashboard/crm/tax/eway-bills/${r.data._id}`);
            router.refresh();
        });
    }

    return (
        <form action={onSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Linked invoice id (optional)" name="invoiceId" />
            <Field label="Transaction type (1-4)" name="transactionType" type="number" defaultValue="1" />
            <Field label="From GSTIN" name="fromGstin" required />
            <Field label="To GSTIN (blank = URP)" name="toGstin" />
            <Field label="From pincode" name="fromPincode" required />
            <Field label="To pincode" name="toPincode" required />
            <Field label="From state code" name="fromStateCode" required />
            <Field label="To state code" name="toStateCode" required />
            <Field label="Total value (₹)" name="totalValue" type="number" step="0.01" required />
            <Field label="Distance (km)" name="distanceKm" type="number" step="1" required />
            <Field label="Transporter id" name="transporterId" />
            <Field label="Vehicle number" name="vehicleNumber" />

            <div className="sm:col-span-2 flex items-center gap-3">
                <Button type="submit" disabled={pending}>
                    {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    Generate
                </Button>
                {error ? <p className="text-[12px] text-[var(--st-text)]">{error}</p> : null}
            </div>
        </form>
    );
}

function Field({
    label,
    name,
    type,
    required,
    defaultValue,
    step,
}: {
    label: string;
    name: string;
    type?: string;
    required?: boolean;
    defaultValue?: string;
    step?: string;
}) {
    return (
        <div className="flex flex-col gap-1">
            <Label htmlFor={name}>{label}</Label>
            <Input
                id={name}
                name={name}
                type={type ?? 'text'}
                required={required}
                defaultValue={defaultValue}
                step={step}
            />
        </div>
    );
}
