'use client';

import {
  Button,
  Card,
  Checkbox,
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
  Plus,
  Save,
  Trash2 } from 'lucide-react';

// §1E.sweep: status migrated to <EnumFormField enumName="welcomeKitStatus">.

/**
 * <WelcomeKitForm /> — create + edit form for HR welcome kits.
 *
 * Binds to `saveWelcomeKit` via `useActionState`. The kit's items are
 * managed inline with add/remove rows; the array is serialised to JSON
 * and posted as `itemsJson` so the server action can parse it.
 */

import { EnumFormField } from '@/components/crm/enum-form-field';

import { saveWelcomeKit } from '@/app/actions/crm-welcome-kits.actions';
import type { CrmWelcomeKitDoc, CrmWelcomeKitItem } from '@/app/actions/crm-welcome-kits.actions.types';
import type { CrmWelcomeKitStatus } from '@/app/actions/crm-welcome-kits.actions.types';
const BASE = '/dashboard/hrm/hr/welcome-kit';

interface WelcomeKitFormProps {
    initialData?: CrmWelcomeKitDoc | null;
}

type SaveState = { message?: string; error?: string; id?: string };
const initialState: SaveState = {};

function SubmitButton({ isEditing }: { isEditing: boolean }) {
    const { pending } = useFormStatus();
    return (
        <Button type="submit" disabled={pending}>
            {pending ? (
                <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
            ) : (
                <Save className="mr-2 h-4 w-4" />
            )}
            {isEditing ? 'Save changes' : 'Create welcome kit'}
        </Button>
    );
}

function toDateInput(value: unknown): string {
    if (!value) return '';
    const d = new Date(value as string);
    if (Number.isNaN(d.getTime())) return '';
    return d.toISOString().slice(0, 10);
}

export function WelcomeKitForm({ initialData }: WelcomeKitFormProps) {
    const router = useRouter();
    const { toast } = useZoruToast();
    const isEditing = !!initialData?._id;

    const [state, formAction] = useActionState(saveWelcomeKit, initialState);

    const [status, setStatus] = useState<CrmWelcomeKitStatus>(
        (initialData?.status as CrmWelcomeKitStatus) ?? 'pending',
    );

    const [items, setItems] = useState<CrmWelcomeKitItem[]>(
        Array.isArray(initialData?.items)
            ? (initialData!.items as CrmWelcomeKitItem[])
            : [],
    );

    useEffect(() => {
        if (state?.message) {
            toast({ title: 'Saved', description: state.message });
            const id = state.id ?? initialData?._id;
            router.push(id ? `${BASE}/${id}` : BASE);
        }
        if (state?.error) {
            toast({ title: 'Error', description: state.error, variant: 'destructive' });
        }
    }, [state, toast, router, initialData?._id]);

    const addItem = () => {
        setItems((curr) => [
            ...curr,
            { name: '', sku: '', delivered: false, delivered_at: null },
        ]);
    };

    const updateItem = (idx: number, patch: Partial<CrmWelcomeKitItem>) => {
        setItems((curr) =>
            curr.map((it, i) => (i === idx ? { ...it, ...patch } : it)),
        );
    };

    const removeItem = (idx: number) => {
        setItems((curr) => curr.filter((_, i) => i !== idx));
    };

    return (
        <Card className="p-6">
            <form action={formAction} className="flex flex-col gap-6">
                {isEditing ? (
                    <input type="hidden" name="kitId" value={initialData!._id} />
                ) : null}
                <input type="hidden" name="status" value={status} />
                <input
                    type="hidden"
                    name="itemsJson"
                    value={JSON.stringify(items)}
                />

                {/* Row 1: Employee */}
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <Label htmlFor="employee_id">Employee id *</Label>
                        <Input
                            id="employee_id"
                            name="employee_id"
                            required
                            placeholder="Employee record id"
                            defaultValue={initialData?.employee_id ?? ''}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="employee_name">Employee name</Label>
                        <Input
                            id="employee_name"
                            name="employee_name"
                            placeholder="Friendly display name"
                            defaultValue={initialData?.employee_name ?? ''}
                        />
                    </div>
                </div>

                {/* Row 2: Shipping address + tracking */}
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <Label htmlFor="shipping_address">Shipping address</Label>
                        <Textarea
                            id="shipping_address"
                            name="shipping_address"
                            rows={3}
                            placeholder="Full delivery address"
                            defaultValue={initialData?.shipping_address ?? ''}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="tracking_number">Tracking number</Label>
                        <Input
                            id="tracking_number"
                            name="tracking_number"
                            placeholder="Courier tracking reference"
                            defaultValue={initialData?.tracking_number ?? ''}
                        />
                    </div>
                </div>

                {/* Row 3: Status */}
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <Label>Status</Label>
                        <EnumFormField
                            name="status-picker"
                            enumName="welcomeKitStatus"
                            initialId={status}
                            onChange={(id) => setStatus((id as CrmWelcomeKitStatus) ?? 'pending')}
                            allowInlineCreate={false}
                            placeholder="Status"
                        />
                    </div>
                </div>

                {/* Items */}
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <Label>Items</Label>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={addItem}
                        >
                            <Plus className="mr-1.5 h-3.5 w-3.5" /> Add item
                        </Button>
                    </div>
                    {items.length === 0 ? (
                        <div className="rounded-[var(--zoru-radius)] border border-dashed border-zoru-line bg-zoru-surface-2 px-3 py-6 text-center text-[12.5px] text-zoru-ink-muted">
                            No items yet. Add one with the button above.
                        </div>
                    ) : (
                        <div className="flex flex-col gap-2">
                            {items.map((it, idx) => (
                                <div
                                    key={idx}
                                    className="grid grid-cols-1 items-end gap-2 rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-bg p-3 sm:grid-cols-[1fr_140px_140px_120px_auto]"
                                >
                                    <div className="space-y-1">
                                        <Label className="text-[11px] text-zoru-ink-muted">
                                            Item name
                                        </Label>
                                        <Input
                                            value={it.name}
                                            onChange={(e) =>
                                                updateItem(idx, { name: e.target.value })
                                            }
                                            placeholder="e.g. T-shirt"
                                            required
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-[11px] text-zoru-ink-muted">
                                            SKU
                                        </Label>
                                        <Input
                                            value={it.sku ?? ''}
                                            onChange={(e) =>
                                                updateItem(idx, { sku: e.target.value })
                                            }
                                            placeholder="Optional"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-[11px] text-zoru-ink-muted">
                                            Delivered at
                                        </Label>
                                        <Input
                                            type="date"
                                            value={toDateInput(it.delivered_at)}
                                            onChange={(e) =>
                                                updateItem(idx, {
                                                    delivered_at: e.target.value || null,
                                                })
                                            }
                                        />
                                    </div>
                                    <div className="flex items-center gap-2 pb-2">
                                        <Checkbox
                                            id={`item-delivered-${idx}`}
                                            checked={!!it.delivered}
                                            onCheckedChange={(c) =>
                                                updateItem(idx, { delivered: !!c })
                                            }
                                        />
                                        <Label
                                            htmlFor={`item-delivered-${idx}`}
                                            className="cursor-pointer text-[12px]"
                                        >
                                            Delivered
                                        </Label>
                                    </div>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => removeItem(idx)}
                                        aria-label="Remove item"
                                    >
                                        <Trash2 className="h-4 w-4 text-zoru-ink" />
                                    </Button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                    <Button variant="ghost" asChild>
                        <Link href={BASE}>
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back to welcome kits
                        </Link>
                    </Button>
                    <SubmitButton isEditing={isEditing} />
                </div>
            </form>
        </Card>
    );
}
