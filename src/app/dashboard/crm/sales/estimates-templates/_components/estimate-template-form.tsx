'use client';

import {
  ZoruButton,
  ZoruCard,
  ZoruCheckbox,
  ZoruInput,
  ZoruLabel,
  ZoruTextarea,
  useZoruToast,
} from '@/components/zoruui';
import {
  useActionState,
  useEffect,
  useId,
  useMemo,
  useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useFormStatus } from 'react-dom';
import {
    ArrowLeft,
  LoaderCircle,
  Plus,
  Save,
  Trash2,
  } from 'lucide-react';

/**
 * <EstimateTemplateForm /> — create + edit form for CRM Sales
 * Estimate Templates.
 *
 * Binds to the `saveEstimateTemplate` server action via `useActionState`.
 * Includes a line-item repeater (description + quantity + rate, NO
 * JSON paste) for `defaultItems`.
 */

import {
    saveEstimateTemplate,
    type CrmEstimateTemplateItem,
    type CrmEstimateTemplateStatus,
} from '@/app/actions/crm-estimate-templates.actions';
import { EnumFormField } from '@/components/crm/enum-form-field';

const BASE = '/dashboard/crm/sales/estimates-templates';

const STATUS_OPTIONS: Array<{
    value: CrmEstimateTemplateStatus;
    label: string;
}> = [
    { value: 'draft', label: 'Draft' },
    { value: 'published', label: 'Published' },
    { value: 'archived', label: 'Archived' },
];

const CATEGORY_OPTIONS: Array<{ value: string; label: string }> = [
    { value: 'general', label: 'General' },
    { value: 'services', label: 'Services' },
    { value: 'products', label: 'Products' },
    { value: 'consulting', label: 'Consulting' },
    { value: 'maintenance', label: 'Maintenance' },
    { value: 'other', label: 'Other' },
];

type SaveState = { message?: string; error?: string; id?: string };
const initialState: SaveState = {};

function SubmitButton({ isEditing }: { isEditing: boolean }) {
    const { pending } = useFormStatus();
    return (
        <ZoruButton type="submit" disabled={pending}>
            {pending ? (
                <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
            ) : (
                <Save className="mr-2 h-4 w-4" />
            )}
            {isEditing ? 'Save changes' : 'Create template'}
        </ZoruButton>
    );
}

function fmtCurrency(n: number): string {
    if (!Number.isFinite(n)) return '0.00';
    return n.toFixed(2);
}

export interface EstimateTemplateFormProps {
    initialData?: Record<string, unknown> | null;
}

export function EstimateTemplateForm({
    initialData,
}: EstimateTemplateFormProps) {
    const router = useRouter();
    const { toast } = useZoruToast();
    const reactId = useId();
    const isEditing = !!initialData?._id;

    const [state, formAction] = useActionState(
        saveEstimateTemplate,
        initialState,
    );

    const [category, setCategory] = useState<string>(
        (initialData?.category as string) ?? 'general',
    );
    const [status, setStatus] = useState<CrmEstimateTemplateStatus>(
        (initialData?.status as CrmEstimateTemplateStatus) ?? 'draft',
    );

    const [items, setItems] = useState<CrmEstimateTemplateItem[]>(() => {
        const raw = initialData?.defaultItems;
        if (Array.isArray(raw) && raw.length > 0) {
            return raw.map((row) => {
                const r = row as Record<string, unknown>;
                return {
                    description:
                        typeof r?.description === 'string' ? r.description : '',
                    quantity:
                        typeof r?.quantity === 'number'
                            ? r.quantity
                            : parseFloat(String(r?.quantity ?? '1')) || 1,
                    rate:
                        typeof r?.rate === 'number'
                            ? r.rate
                            : parseFloat(String(r?.rate ?? '0')) || 0,
                };
            });
        }
        return [{ description: '', quantity: 1, rate: 0 }];
    });

    const subtotal = useMemo(
        () => items.reduce((sum, it) => sum + it.quantity * it.rate, 0),
        [items],
    );

    useEffect(() => {
        if (state?.message) {
            toast({ title: 'Saved', description: state.message });
            const id = state.id ?? (initialData?._id as string | undefined);
            router.push(id ? `${BASE}/${id}` : BASE);
        }
        if (state?.error) {
            toast({
                title: 'Error',
                description: state.error,
                variant: 'destructive',
            });
        }
    }, [state, toast, router, initialData?._id]);

    const updateItem = (
        idx: number,
        patch: Partial<CrmEstimateTemplateItem>,
    ) => {
        setItems((prev) =>
            prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)),
        );
    };

    const addItem = () => {
        setItems((prev) => [
            ...prev,
            { description: '', quantity: 1, rate: 0 },
        ]);
    };

    const removeItem = (idx: number) => {
        setItems((prev) =>
            prev.length === 1 ? prev : prev.filter((_, i) => i !== idx),
        );
    };

    return (
        <ZoruCard className="p-6">
            <form action={formAction} className="flex flex-col gap-6">
                {isEditing ? (
                    <input
                        type="hidden"
                        name="templateId"
                        value={initialData!._id as string}
                    />
                ) : null}
                <input type="hidden" name="category" value={category} />
                <input type="hidden" name="status" value={status} />
                <input
                    type="hidden"
                    name="defaultItems"
                    value={JSON.stringify(items)}
                />

                {/* Name + Category */}
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="name">Template name *</ZoruLabel>
                        <ZoruInput
                            id="name"
                            name="name"
                            required
                            placeholder="e.g. Web design starter estimate"
                            defaultValue={(initialData?.name as string) ?? ''}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <ZoruLabel>Category</ZoruLabel>
                        <EnumFormField
                            enumName="estimateTemplateCategory"
                            name="__category_picker"
                            initialId={category}
                            placeholder="Category"
                            onChange={(v) => setCategory(v ?? 'general')}
                        />
                    </div>
                </div>

                {/* Template body */}
                <div className="space-y-1.5">
                    <ZoruLabel htmlFor="templateBody">
                        Template body (markdown)
                    </ZoruLabel>
                    <ZoruTextarea
                        id="templateBody"
                        name="templateBody"
                        rows={8}
                        placeholder="# Estimate body…&#10;&#10;Markdown is supported."
                        defaultValue={
                            (initialData?.templateBody as string) ?? ''
                        }
                    />
                </div>

                {/* Line items repeater */}
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <ZoruLabel>Default line items</ZoruLabel>
                        <ZoruButton
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={addItem}
                        >
                            <Plus className="mr-1.5 h-3.5 w-3.5" />
                            Add line item
                        </ZoruButton>
                    </div>
                    <div className="overflow-hidden rounded-[var(--zoru-radius)] border border-zoru-line">
                        <table className="w-full text-[13px]">
                            <thead className="bg-zoru-surface-2 text-zoru-ink-muted">
                                <tr>
                                    <th className="px-3 py-2 text-left font-medium">
                                        Description
                                    </th>
                                    <th className="w-24 px-3 py-2 text-right font-medium">
                                        Qty
                                    </th>
                                    <th className="w-32 px-3 py-2 text-right font-medium">
                                        Rate
                                    </th>
                                    <th className="w-32 px-3 py-2 text-right font-medium">
                                        Line total
                                    </th>
                                    <th className="w-12 px-3 py-2" />
                                </tr>
                            </thead>
                            <tbody>
                                {items.map((it, idx) => (
                                    <tr
                                        key={idx}
                                        className="border-t border-zoru-line"
                                    >
                                        <td className="px-3 py-2">
                                            <ZoruInput
                                                placeholder={`Item ${idx + 1}`}
                                                value={it.description}
                                                onChange={(e) =>
                                                    updateItem(idx, {
                                                        description:
                                                            e.target.value,
                                                    })
                                                }
                                            />
                                        </td>
                                        <td className="px-3 py-2 text-right">
                                            <ZoruInput
                                                type="number"
                                                min={0}
                                                step="1"
                                                value={String(it.quantity)}
                                                onChange={(e) =>
                                                    updateItem(idx, {
                                                        quantity:
                                                            parseFloat(
                                                                e.target.value,
                                                            ) || 0,
                                                    })
                                                }
                                                className="text-right"
                                            />
                                        </td>
                                        <td className="px-3 py-2 text-right">
                                            <ZoruInput
                                                type="number"
                                                min={0}
                                                step="0.01"
                                                value={String(it.rate)}
                                                onChange={(e) =>
                                                    updateItem(idx, {
                                                        rate:
                                                            parseFloat(
                                                                e.target.value,
                                                            ) || 0,
                                                    })
                                                }
                                                className="text-right"
                                            />
                                        </td>
                                        <td className="px-3 py-2 text-right font-mono text-zoru-ink">
                                            {fmtCurrency(
                                                it.quantity * it.rate,
                                            )}
                                        </td>
                                        <td className="px-3 py-2 text-right">
                                            <ZoruButton
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => removeItem(idx)}
                                                disabled={items.length === 1}
                                                title="Remove item"
                                            >
                                                <Trash2 className="h-4 w-4 text-destructive" />
                                            </ZoruButton>
                                        </td>
                                    </tr>
                                ))}
                                <tr className="border-t border-zoru-line bg-zoru-surface-2">
                                    <td
                                        colSpan={3}
                                        className="px-3 py-2 text-right text-zoru-ink-muted"
                                    >
                                        Subtotal
                                    </td>
                                    <td className="px-3 py-2 text-right font-mono font-medium text-zoru-ink">
                                        {fmtCurrency(subtotal)}
                                    </td>
                                    <td />
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Default terms */}
                <div className="space-y-1.5">
                    <ZoruLabel htmlFor="defaultTerms">Default terms</ZoruLabel>
                    <ZoruTextarea
                        id="defaultTerms"
                        name="defaultTerms"
                        rows={4}
                        placeholder="Payment terms, scope, validity, etc."
                        defaultValue={
                            (initialData?.defaultTerms as string) ?? ''
                        }
                    />
                </div>

                {/* Status + active */}
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <ZoruLabel>Status</ZoruLabel>
                        <EnumFormField
                            enumName="estimateTemplateStatus"
                            name="__status_picker"
                            initialId={status}
                            onChange={(v) => setStatus((v ?? 'draft') as CrmEstimateTemplateStatus)}
                        />
                    </div>
                    <div className="flex items-center gap-2 self-end pb-1.5">
                        <ZoruCheckbox
                            id="isActive"
                            name="isActive"
                            defaultChecked={initialData?.isActive !== false}
                        />
                        <ZoruLabel
                            htmlFor="isActive"
                            className="cursor-pointer"
                        >
                            Active — show in template picker
                        </ZoruLabel>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                    <ZoruButton variant="ghost" asChild>
                        <Link href={BASE}>
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back to templates
                        </Link>
                    </ZoruButton>
                    <SubmitButton isEditing={isEditing} />
                </div>
            </form>
        </ZoruCard>
    );
}
