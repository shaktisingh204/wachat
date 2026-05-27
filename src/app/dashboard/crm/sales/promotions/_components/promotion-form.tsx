'use client';

import {
  Button,
  Card,
  Input,
  Label,
  Textarea,
  useZoruToast,
} from '@/components/zoruui';
import {
  useActionState,
  useEffect,
  useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useFormStatus } from 'react-dom';
import { ArrowLeft,
  LoaderCircle,
  Save } from 'lucide-react';

/**
 * <PromotionForm /> — create + edit form for CRM Promotions.
 *
 * Posts to `savePromotion` via `useActionState`. Same shape used by both
 * the `/new` and `/[promotionId]/edit` pages.
 */

import {
    savePromotion,
    type CrmPromotionDoc,
    type CrmPromotionStatus,
    type CrmPromotionType,
} from '@/app/actions/crm-promotions.actions';
import { EnumFormField } from '@/components/crm/enum-form-field';

const BASE = '/dashboard/crm/sales/promotions';

const TYPE_OPTIONS: Array<{ value: CrmPromotionType; label: string }> = [
    { value: 'flat', label: 'Flat amount off' },
    { value: 'percent', label: 'Percentage discount' },
    { value: 'buy_x_get_y', label: 'Buy X · Get Y' },
    { value: 'free_shipping', label: 'Free shipping' },
];

const STATUS_OPTIONS: Array<{ value: CrmPromotionStatus; label: string }> = [
    { value: 'draft', label: 'Draft' },
    { value: 'scheduled', label: 'Scheduled' },
    { value: 'active', label: 'Active' },
    { value: 'paused', label: 'Paused' },
    { value: 'expired', label: 'Expired' },
    { value: 'archived', label: 'Archived' },
];

function toDateInput(value: unknown): string {
    if (!value) return '';
    const d = new Date(value as string);
    if (Number.isNaN(d.getTime())) return '';
    return d.toISOString().slice(0, 10);
}

const initialState: { message?: string; error?: string; id?: string } = {};

function SubmitButton({ isEditing }: { isEditing: boolean }) {
    const { pending } = useFormStatus();
    return (
        <Button type="submit" disabled={pending}>
            {pending ? (
                <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
            ) : (
                <Save className="mr-2 h-4 w-4" />
            )}
            {isEditing ? 'Save changes' : 'Create promotion'}
        </Button>
    );
}

export interface PromotionFormProps {
    initialData?: CrmPromotionDoc | null;
}

export function PromotionForm({ initialData }: PromotionFormProps) {
    const router = useRouter();
    const { toast } = useZoruToast();
    const isEditing = !!initialData?._id;

    const [state, formAction] = useActionState(savePromotion, initialState);

    const [type, setType] = useState<CrmPromotionType>(
        (initialData?.type as CrmPromotionType) ?? 'flat',
    );
    const [status, setStatus] = useState<CrmPromotionStatus>(
        (initialData?.status as CrmPromotionStatus) ?? 'draft',
    );

    useEffect(() => {
        if (state?.message) {
            toast({ title: 'Saved', description: state.message });
            const id = state.id ?? initialData?._id;
            if (id) {
                router.push(`${BASE}/${id}`);
            } else {
                router.push(BASE);
            }
        }
        if (state?.error) {
            toast({
                title: 'Error',
                description: state.error,
                variant: 'destructive',
            });
        }
    }, [state, toast, router, initialData?._id]);

    const showValueField = type === 'percent' || type === 'flat';
    const valueLabel =
        type === 'percent' ? 'Discount %' : 'Flat Amount (₹)';

    const productsInitial = (initialData?.applicableProducts ?? []).join(', ');
    const categoriesInitial = (initialData?.applicableCategories ?? []).join(
        ', ',
    );
    const segmentsInitial = (initialData?.customerSegments ?? []).join(', ');

    return (
        <Card className="p-6">
            <form action={formAction} className="flex flex-col gap-6">
                {isEditing ? (
                    <input
                        type="hidden"
                        name="promotionId"
                        value={initialData!._id}
                    />
                ) : null}
                <input type="hidden" name="type" value={type} />
                <input type="hidden" name="status" value={status} />

                {/* Name + Code */}
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <Label htmlFor="name">
                            Name <span className="text-zoru-ink">*</span>
                        </Label>
                        <Input
                            id="name"
                            name="name"
                            required
                            placeholder="e.g. Summer Sale 2026"
                            defaultValue={initialData?.name ?? ''}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="code">Code</Label>
                        <Input
                            id="code"
                            name="code"
                            placeholder="SUMMER26"
                            defaultValue={initialData?.code ?? ''}
                            className="uppercase"
                        />
                    </div>
                </div>

                {/* Description */}
                <div className="space-y-1.5">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                        id="description"
                        name="description"
                        rows={2}
                        placeholder="Short customer-facing description."
                        defaultValue={initialData?.description ?? ''}
                    />
                </div>

                {/* Type + Status */}
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <Label>Type</Label>
                        <EnumFormField
                            enumName="promotionType"
                            name="__type_picker"
                            initialId={type}
                            placeholder="Pick a type…"
                            onChange={(v) => setType((v ?? 'flat') as CrmPromotionType)}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label>Status</Label>
                        <EnumFormField
                            enumName="promotionStatus"
                            name="__status_picker"
                            initialId={status}
                            onChange={(v) => setStatus((v ?? 'draft') as CrmPromotionStatus)}
                        />
                    </div>
                </div>

                {/* Value + Min cart */}
                <div className="grid gap-4 sm:grid-cols-2">
                    {showValueField ? (
                        <div className="space-y-1.5">
                            <Label htmlFor="value">{valueLabel}</Label>
                            <Input
                                id="value"
                                name="value"
                                type="number"
                                min="0"
                                step="0.01"
                                defaultValue={initialData?.value ?? ''}
                                placeholder={type === 'percent' ? 'e.g. 15' : 'e.g. 200'}
                            />
                        </div>
                    ) : (
                        <div />
                    )}
                    <div className="space-y-1.5">
                        <Label htmlFor="minCart">Min cart value</Label>
                        <Input
                            id="minCart"
                            name="minCart"
                            type="number"
                            min="0"
                            step="0.01"
                            defaultValue={initialData?.minCart ?? ''}
                            placeholder="Optional"
                        />
                    </div>
                </div>

                {/* Max uses + dates */}
                <div className="grid gap-4 sm:grid-cols-3">
                    <div className="space-y-1.5">
                        <Label htmlFor="maxUses">Max uses</Label>
                        <Input
                            id="maxUses"
                            name="maxUses"
                            type="number"
                            min="0"
                            step="1"
                            defaultValue={initialData?.maxUses ?? ''}
                            placeholder="Optional"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="validFrom">Valid from</Label>
                        <Input
                            id="validFrom"
                            name="validFrom"
                            type="date"
                            defaultValue={toDateInput(initialData?.validFrom)}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="validTo">Valid to</Label>
                        <Input
                            id="validTo"
                            name="validTo"
                            type="date"
                            defaultValue={toDateInput(initialData?.validTo)}
                        />
                    </div>
                </div>

                {/* Applicability — comma-separated lists */}
                <div className="space-y-1.5">
                    <Label htmlFor="applicableProducts">
                        Applicable products (comma-separated product ids)
                    </Label>
                    <Input
                        id="applicableProducts"
                        name="applicableProducts"
                        defaultValue={productsInitial}
                        placeholder="Leave blank for all products"
                    />
                </div>
                <div className="space-y-1.5">
                    <Label htmlFor="applicableCategories">
                        Applicable categories
                    </Label>
                    <Input
                        id="applicableCategories"
                        name="applicableCategories"
                        defaultValue={categoriesInitial}
                        placeholder="Comma-separated category slugs"
                    />
                </div>
                <div className="space-y-1.5">
                    <Label htmlFor="customerSegments">
                        Customer segments
                    </Label>
                    <Input
                        id="customerSegments"
                        name="customerSegments"
                        defaultValue={segmentsInitial}
                        placeholder="e.g. vip, b2b, returning"
                    />
                </div>

                {/* Footer */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                    <Button variant="ghost" asChild>
                        <Link href={BASE}>
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back to promotions
                        </Link>
                    </Button>
                    <SubmitButton isEditing={isEditing} />
                </div>
            </form>
        </Card>
    );
}
