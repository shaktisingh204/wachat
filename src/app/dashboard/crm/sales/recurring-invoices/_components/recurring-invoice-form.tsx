'use client';

import { Button, Card, Input, Label, Textarea, useZoruToast } from '@/components/zoruui';
import {
  useActionState,
  useEffect,
  useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useFormStatus } from 'react-dom';
import { ArrowLeft,
  LoaderCircle,
  Save,
  CalendarDays,
  Pause,
  Play } from 'lucide-react';

/**
 * <RecurringInvoiceForm /> — canonical create/edit form for CRM
 * recurring invoice schedules.
 *
 * Binds to `saveRecurringInvoice` (handles both create + update) via
 * `useActionState`. Customer + invoice-template inputs use
 * `<EntityFormField>` so the picker hydrates from the lookup registry.
 */

import { EntityFormField } from '@/components/crm/entity-form-field';
import { EnumFormField } from '@/components/crm/enum-form-field';

import {
    saveRecurringInvoice,
    type CrmRecurringInvoiceDoc,
    type CrmRecurringInvoiceFrequency,
    type CrmRecurringInvoiceStatus,
} from '@/app/actions/crm-recurring-invoices.actions';

const BASE = '/dashboard/crm/sales/recurring-invoices';

// Frequency + status options now sourced from CRM_ENUMS
// (`recurringFrequency`, `recurringScheduleStatus`).

interface RecurringInvoiceFormProps {
    initialData?: CrmRecurringInvoiceDoc | null;
}

type SaveState = { message?: string; error?: string; id?: string };
const initialState: SaveState = {};

function toDateInput(value: unknown): string {
    if (!value) return '';
    const d = new Date(value as string);
    if (Number.isNaN(d.getTime())) return '';
    return d.toISOString().slice(0, 10);
}

function getNextRunDates(startDateStr: string, frequency: CrmRecurringInvoiceFrequency, count: number): Date[] {
    const dates: Date[] = [];
    if (!startDateStr) return dates;
    
    const current = new Date(startDateStr);
    if (Number.isNaN(current.getTime())) return dates;

    for (let i = 0; i < count; i++) {
        dates.push(new Date(current));
        
        switch (frequency) {
            case 'daily':
                current.setUTCDate(current.getUTCDate() + 1);
                break;
            case 'weekly':
                current.setUTCDate(current.getUTCDate() + 7);
                break;
            case 'monthly':
                current.setUTCMonth(current.getUTCMonth() + 1);
                break;
            case 'quarterly':
                current.setUTCMonth(current.getUTCMonth() + 3);
                break;
            case 'yearly':
                current.setUTCFullYear(current.getUTCFullYear() + 1);
                break;
        }
    }
    return dates;
}

function SubmitButton({ isEditing }: { isEditing: boolean }) {
    const { pending } = useFormStatus();
    return (
        <Button type="submit" disabled={pending}>
            {pending ? (
                <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
            ) : (
                <Save className="mr-2 h-4 w-4" />
            )}
            {isEditing ? 'Save changes' : 'Create schedule'}
        </Button>
    );
}

export function RecurringInvoiceForm({ initialData }: RecurringInvoiceFormProps) {
    const router = useRouter();
    const { toast } = useZoruToast();
    const isEditing = !!initialData?._id;

    const [state, formAction] = useActionState(saveRecurringInvoice, initialState);

    const [customerId, setCustomerId] = useState<string>(initialData?.customerId ?? '');
    const [invoiceTemplateId, setInvoiceTemplateId] = useState<string>(
        initialData?.invoiceTemplateId ?? '',
    );
    const [frequency, setFrequency] = useState<CrmRecurringInvoiceFrequency>(
        (initialData?.frequency as CrmRecurringInvoiceFrequency) ?? 'monthly',
    );
    const [status, setStatus] = useState<CrmRecurringInvoiceStatus>(
        (initialData?.status as CrmRecurringInvoiceStatus) ?? 'active',
    );
    const [startDate, setStartDate] = useState<string>(
        toDateInput(initialData?.startDate) || toDateInput(new Date().toISOString())
    );

    const projectedDates = getNextRunDates(startDate, frequency, 5);

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

    return (
        <Card className="p-6">
            <form action={formAction} className="flex flex-col gap-6">
                {isEditing ? (
                    <input type="hidden" name="recurringId" value={initialData!._id} />
                ) : null}
                <input type="hidden" name="customerId" value={customerId} />
                <input
                    type="hidden"
                    name="invoiceTemplateId"
                    value={invoiceTemplateId}
                />
                <input type="hidden" name="frequency" value={frequency} />
                <input type="hidden" name="status" value={status} />

                {/* Title */}
                <div className="space-y-1.5">
                    <Label htmlFor="title">Title</Label>
                    <Input
                        id="title"
                        name="title"
                        placeholder="e.g. Monthly retainer — Acme"
                        defaultValue={initialData?.title ?? ''}
                    />
                </div>

                {/* Customer + Invoice template */}
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <Label>Customer *</Label>
                        <EntityFormField
                            entity="client"
                            name="customerIdPicker"
                            initialId={customerId || null}
                            onChange={(id) => setCustomerId(id ?? '')}
                            placeholder="Pick a customer…"
                            required
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label>Invoice template</Label>
                        <EntityFormField
                            entity="invoice"
                            name="invoiceTemplatePicker"
                            initialId={invoiceTemplateId || null}
                            onChange={(id) => setInvoiceTemplateId(id ?? '')}
                            placeholder="Pick a template invoice…"
                        />
                    </div>
                </div>

                {/* Frequency + Status */}
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <Label>Frequency *</Label>
                        <EnumFormField
                            enumName="recurringFrequency"
                            name="__frequency_picker"
                            initialId={frequency || null}
                            onChange={(id) =>
                                setFrequency((id ?? 'monthly') as CrmRecurringInvoiceFrequency)
                            }
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label>Status</Label>
                        <EnumFormField
                            enumName="recurringScheduleStatus"
                            name="__status_picker"
                            initialId={status || null}
                            onChange={(id) =>
                                setStatus((id ?? 'active') as CrmRecurringInvoiceStatus)
                            }
                        />
                    </div>
                </div>

                {/* Start + End dates */}
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <Label htmlFor="startDate">Start date *</Label>
                        <Input
                            id="startDate"
                            name="startDate"
                            type="date"
                            required
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="endDate">End date</Label>
                        <Input
                            id="endDate"
                            name="endDate"
                            type="date"
                            defaultValue={toDateInput(initialData?.endDate)}
                        />
                    </div>
                </div>

                {/* Frequency Visualizer */}
                {projectedDates.length > 0 && (
                    <div className="space-y-3 rounded-md border p-4 bg-muted/20">
                        <div className="flex items-center gap-2">
                            <CalendarDays className="h-4 w-4 text-muted-foreground" />
                            <h4 className="text-sm font-medium">Projected Schedule</h4>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {projectedDates.map((d, i) => (
                                <div key={i} className="flex items-center gap-1.5 rounded-full bg-background px-3 py-1 text-xs border shadow-sm">
                                    <span className="text-muted-foreground font-mono opacity-60">#{i + 1}</span>
                                    <span className="font-medium text-foreground">
                                        {d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' })}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Notes */}
                <div className="space-y-1.5">
                    <Label htmlFor="notes">Notes</Label>
                    <Textarea
                        id="notes"
                        name="notes"
                        rows={3}
                        placeholder="Internal notes for this schedule"
                        defaultValue={initialData?.notes ?? ''}
                    />
                </div>

                {/* Footer */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                    <Button variant="ghost" asChild>
                        <Link href={BASE}>
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back to schedules
                        </Link>
                    </Button>
                    <div className="flex items-center gap-2">
                        {isEditing && (
                            <Button
                                type="button"
                                variant={status === 'paused' ? 'outline' : 'secondary'}
                                onClick={() => setStatus(status === 'paused' ? 'active' : 'paused')}
                            >
                                {status === 'paused' ? (
                                    <><Play className="mr-2 h-4 w-4" /> Resume</>
                                ) : (
                                    <><Pause className="mr-2 h-4 w-4" /> Pause</>
                                )}
                            </Button>
                        )}
                        <SubmitButton isEditing={isEditing} />
                    </div>
                </div>
            </form>
        </Card>
    );
}
