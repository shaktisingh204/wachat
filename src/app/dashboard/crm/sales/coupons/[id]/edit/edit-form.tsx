'use client';

import { Button, Card, Input, Label, Textarea, useToast } from '@/components/sabcrm/20ui';
import {
  useActionState,
  useEffect,
  useState } from 'react';
import { useFormStatus } from 'react-dom';
import { ArrowLeft,
  LoaderCircle,
  Save } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

/**
 * Client form island for the Edit Coupon page. Mirrors the `/new` form
 * fields and posts to `updateCoupon`.
 */

import { updateCoupon } from '@/app/actions/crm-coupons.actions';
import { EnumFormField } from '@/components/crm/enum-form-field';

type CouponType = 'percent' | 'flat' | 'bogo' | 'free_shipping';

const COUPON_TYPES: { value: CouponType; label: string }[] = [
    { value: 'percent', label: 'Percentage Discount' },
    { value: 'flat', label: 'Flat Amount Off' },
    { value: 'bogo', label: 'Buy One Get One (BOGO)' },
    { value: 'free_shipping', label: 'Free Shipping' },
];

const initialState: { message?: string; error?: string; id?: string } = {};

function SubmitButton() {
    const { pending } = useFormStatus();
    return (
        <Button type="submit" size="sm" disabled={pending}>
            {pending ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
                <Save className="h-4 w-4" />
            )}
            {pending ? 'Saving…' : 'Save changes'}
        </Button>
    );
}

function toDateInputValue(v: unknown): string {
    if (!v) return '';
    const d = new Date(v as string | number | Date);
    if (isNaN(d.getTime())) return '';
    return d.toISOString().slice(0, 10);
}

export function EditCouponForm({
    couponId,
    initial,
}: {
    couponId: string;
    initial: Record<string, any>;
}) {
    const router = useRouter();
    const { toast } = useToast();
    const [state, formAction] = useActionState(updateCoupon, initialState);

    const initType = ((initial.type as string) || 'percent') as CouponType;
    const [couponType, setCouponType] = useState<CouponType>(initType);
    const [code, setCode] = useState<string>(((initial.code as string) || '').toUpperCase());

    useEffect(() => {
        if (state.message) {
            toast({ title: 'Coupon updated', description: state.message });
            router.push(`/dashboard/crm/sales/coupons/${couponId}`);
        }
        if (state.error) {
            toast({ title: 'Error', description: state.error, variant: 'destructive' });
        }
    }, [state, toast, router, couponId]);

    const showValueField = couponType === 'percent' || couponType === 'flat';
    const valueLabel = couponType === 'percent' ? 'Discount %' : 'Flat Amount (₹)';

    return (
        <Card className="p-6">
            <form action={formAction} className="flex flex-col gap-6">
                <input type="hidden" name="couponId" value={couponId} />
                <input type="hidden" name="type" value={couponType} />

                <div className="flex flex-col gap-1.5">
                    <Label htmlFor="code">
                        Coupon Code <span className="text-[var(--st-text)]">*</span>
                    </Label>
                    <Input
                        id="code"
                        name="code"
                        type="text"
                        required
                        className="max-w-xs uppercase"
                        value={code}
                        onChange={(e) => setCode(e.target.value.toUpperCase())}
                        maxLength={50}
                    />
                </div>

                <div className="flex flex-col gap-1.5">
                    <Label>Type</Label>
                    <div className="w-full max-w-xs">
                        <EnumFormField
                            enumName="couponType"
                            name="__type_picker"
                            initialId={couponType}
                            placeholder="Select type"
                            onChange={(v) => setCouponType((v ?? 'percent') as CouponType)}
                        />
                    </div>
                </div>

                {showValueField ? (
                    <div className="flex flex-col gap-1.5">
                        <Label htmlFor="value">{valueLabel}</Label>
                        <Input
                            id="value"
                            name="value"
                            type="number"
                            min="0"
                            step="0.01"
                            defaultValue={initial.value ?? ''}
                            className="max-w-xs"
                        />
                    </div>
                ) : null}

                <div className="flex flex-col gap-1.5">
                    <Label htmlFor="minCart">Min Cart Value (₹)</Label>
                    <Input
                        id="minCart"
                        name="minCart"
                        type="number"
                        min="0"
                        step="0.01"
                        defaultValue={initial.minCart ?? ''}
                        className="max-w-xs"
                    />
                </div>

                <div className="flex flex-col gap-1.5">
                    <Label htmlFor="maxUses">Max Total Uses</Label>
                    <Input
                        id="maxUses"
                        name="maxUses"
                        type="number"
                        min="1"
                        step="1"
                        defaultValue={initial.maxUses ?? ''}
                        className="max-w-xs"
                    />
                </div>

                <div className="flex flex-col gap-1.5">
                    <Label htmlFor="perCustomerLimit">Per Customer Limit</Label>
                    <Input
                        id="perCustomerLimit"
                        name="perCustomerLimit"
                        type="number"
                        min="1"
                        step="1"
                        defaultValue={initial.perCustomerLimit ?? ''}
                        className="max-w-xs"
                    />
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="flex flex-col gap-1.5">
                        <Label htmlFor="validFrom">Valid From</Label>
                        <Input
                            id="validFrom"
                            name="validFrom"
                            type="date"
                            defaultValue={toDateInputValue(initial.validFrom)}
                            className="max-w-xs"
                        />
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <Label htmlFor="validTo">Valid To</Label>
                        <Input
                            id="validTo"
                            name="validTo"
                            type="date"
                            defaultValue={toDateInputValue(initial.validTo)}
                            className="max-w-xs"
                        />
                    </div>
                </div>

                <div className="flex flex-col gap-1.5">
                    <Label htmlFor="applicableCategories">Applicable Categories</Label>
                    <Input
                        id="applicableCategories"
                        name="applicableCategories"
                        type="text"
                        defaultValue={(initial.applicableCategories as string[])?.join(', ') || ''}
                        placeholder="e.g. electronics, clothing (comma separated)"
                        className="max-w-xs"
                    />
                </div>

                <div className="flex flex-col gap-1.5">
                    <Label htmlFor="notes">Notes</Label>
                    <Textarea
                        id="notes"
                        name="notes"
                        rows={3}
                        defaultValue={(initial.notes as string) || ''}
                        className="max-w-lg"
                    />
                </div>

                {state.error ? (
                    <p className="text-[13px] text-[var(--st-text)]">{state.error}</p>
                ) : null}

                <div className="flex items-center gap-3">
                    <SubmitButton />
                    <Button variant="ghost" size="sm" asChild>
                        <Link href={`/dashboard/crm/sales/coupons/${couponId}`}>
                            <ArrowLeft className="h-4 w-4" />
                            Cancel
                        </Link>
                    </Button>
                </div>
            </form>
        </Card>
    );
}
