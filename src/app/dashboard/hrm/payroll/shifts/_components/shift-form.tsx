'use client';

import * as React from 'react';
import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { LoaderCircle } from 'lucide-react';
import { Button, Checkbox, Input, Label, Textarea, useToast } from '@/components/sabcrm/20ui';
import { EnumFormField } from '@/components/crm/enum-form-field';
import { saveShift } from '@/app/actions/crm-shifts.actions';
import type { CrmShiftDoc, CrmShiftStatus } from '@/lib/rust-client/crm-shifts';

const WEEKDAYS = [
    { value: 'monday', label: 'Mon' },
    { value: 'tuesday', label: 'Tue' },
    { value: 'wednesday', label: 'Wed' },
    { value: 'thursday', label: 'Thu' },
    { value: 'friday', label: 'Fri' },
    { value: 'saturday', label: 'Sat' },
    { value: 'sunday', label: 'Sun' },
];

const saveInitial: { message?: string; error?: string; id?: string } = {};

function SubmitButton({ isEditing }: { isEditing: boolean }) {
    const { pending } = useFormStatus();
    return (
        <Button type="submit" disabled={pending}>
            {pending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : null}
            {isEditing ? 'Save changes' : 'Create shift'}
        </Button>
    );
}

export function ShiftForm({
    initial,
    onSaved,
    onCancel,
}: {
    initial: CrmShiftDoc | null;
    onSaved: () => void;
    onCancel?: () => void;
    onOptimisticSubmit?: (formData: FormData) => void;
}) {
    const isEditing = !!initial;
    const [state, formAction] = useActionState(saveShift, saveInitial);
    const { toast } = useToast();

    const [color, setColor] = React.useState<string>(initial?.color ?? '#EAB308');
    const [isNight, setIsNight] = React.useState<boolean>(!!initial?.isNightShift);
    const [isDefault, setIsDefault] = React.useState<boolean>(!!initial?.isDefault);
    const [days, setDays] = React.useState<string[]>(
        initial?.workingDays ?? ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
    );
    const [status, setStatus] = React.useState<CrmShiftStatus>(
        (initial?.status as CrmShiftStatus) ?? 'active',
    );

    React.useEffect(() => {
        if (state?.message) {
            toast({ title: 'Saved', description: state.message });
            onSaved();
        }
        if (state?.error) {
            toast({
                title: 'Error',
                description: state.error,
                variant: 'destructive',
            });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [state]);

    const toggleDay = (value: string, on: boolean) => {
        setDays((prev) =>
            on
                ? Array.from(new Set([...prev, value]))
                : prev.filter((d) => d !== value),
        );
    };

    const handleAction = (formData: FormData) => {
        if (onOptimisticSubmit) {
            onOptimisticSubmit(formData);
        }
        React.startTransition(() => {
            formAction(formData);
        });
    };

    return (
        <form action={handleAction} className="flex flex-col gap-4">
            {isEditing ? (
                <input type="hidden" name="shiftId" value={initial!._id} />
            ) : null}
            <input type="hidden" name="color" value={color} />
            <input type="hidden" name="isNightShift" value={isNight ? 'true' : 'false'} />
            <input type="hidden" name="isDefault" value={isDefault ? 'true' : 'false'} />
            {days.map((d) => (
                <input key={d} type="hidden" name="workingDays" value={d} />
            ))}
            {isEditing ? (
                <input type="hidden" name="status" value={status} />
            ) : null}

            <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="name">Name *</Label>
                    <Input
                        id="name"
                        name="name"
                        required
                        placeholder="Morning Shift"
                        defaultValue={initial?.name ?? ''}
                    />
                </div>
                <div className="space-y-1.5">
                    <Label htmlFor="code">Code</Label>
                    <Input
                        id="code"
                        name="code"
                        placeholder="MORN"
                        defaultValue={initial?.code ?? ''}
                    />
                </div>
                <div className="space-y-1.5">
                    <Label htmlFor="color-trigger">Color</Label>
                    <div className="flex items-center gap-2">
                        <input
                            id="color-trigger"
                            type="color"
                            value={color}
                            onChange={(e) => setColor(e.target.value)}
                            className="h-9 w-12 cursor-pointer rounded-md border border-[var(--st-border)] bg-transparent p-1"
                            aria-label="Pick shift color"
                        />
                        <Input
                            value={color}
                            onChange={(e) => setColor(e.target.value)}
                            placeholder="#EAB308"
                        />
                    </div>
                </div>
                <div className="space-y-1.5">
                    <Label htmlFor="startTime">Start time *</Label>
                    <Input
                        id="startTime"
                        name="startTime"
                        type="time"
                        required
                        defaultValue={initial?.startTime ?? '09:00'}
                    />
                </div>
                <div className="space-y-1.5">
                    <Label htmlFor="endTime">End time *</Label>
                    <Input
                        id="endTime"
                        name="endTime"
                        type="time"
                        required
                        defaultValue={initial?.endTime ?? '18:00'}
                    />
                </div>
                <div className="space-y-1.5">
                    <Label htmlFor="breakMinutes">Break (minutes)</Label>
                    <Input
                        id="breakMinutes"
                        name="breakMinutes"
                        type="number"
                        min="0"
                        step="1"
                        defaultValue={initial?.breakMinutes ?? 60}
                    />
                </div>
                <div className="space-y-1.5">
                    <Label htmlFor="graceMinutes">Grace (minutes)</Label>
                    <Input
                        id="graceMinutes"
                        name="graceMinutes"
                        type="number"
                        min="0"
                        step="1"
                        defaultValue={initial?.graceMinutes ?? 15}
                    />
                </div>
            </div>

            <div className="space-y-1.5">
                <Label>Working days</Label>
                <div className="flex flex-wrap gap-2">
                    {WEEKDAYS.map((d) => {
                        const checked = days.includes(d.value);
                        return (
                            <label
                                key={d.value}
                                className="flex items-center gap-2 rounded-md border border-[var(--st-border)] bg-[var(--st-bg)] px-2.5 py-1.5 text-[12.5px] text-[var(--st-text)]"
                            >
                                <Checkbox
                                    checked={checked}
                                    onCheckedChange={(v) => toggleDay(d.value, Boolean(v))}
                                />
                                <span>{d.label}</span>
                            </label>
                        );
                    })}
                </div>
            </div>

            <div className="space-y-1.5">
                <Label htmlFor="departmentIds">Department IDs (comma-separated)</Label>
                <Input
                    id="departmentIds"
                    name="departmentIds"
                    placeholder="Optional — leave blank for all departments"
                    defaultValue={(initial?.departmentIds ?? []).join(', ')}
                />
            </div>

            <div className="space-y-1.5">
                <Label htmlFor="description">Description</Label>
                <Textarea
                    id="description"
                    name="description"
                    rows={2}
                    defaultValue={initial?.description ?? ''}
                    placeholder="Optional notes about this shift."
                />
            </div>

            <div className="flex flex-wrap items-center gap-4">
                <label className="flex items-center gap-2 text-[13px] text-[var(--st-text)]">
                    <Checkbox
                        checked={isNight}
                        onCheckedChange={(v) => setIsNight(Boolean(v))}
                    />
                    Night shift (crosses midnight)
                </label>
                <label className="flex items-center gap-2 text-[13px] text-[var(--st-text)]">
                    <Checkbox
                        checked={isDefault}
                        onCheckedChange={(v) => setIsDefault(Boolean(v))}
                    />
                    Default shift
                </label>
                {isEditing ? (
                    <div className="ml-auto flex items-center gap-2">
                        <Label className="text-[12.5px]">Status</Label>
                        <EnumFormField
                            enumName="activeArchived"
                            name="__status_picker"
                            initialId={status}
                            onChange={(v) => setStatus((v ?? 'active') as CrmShiftStatus)}
                        />
                    </div>
                ) : null}
            </div>

            <div className="flex items-center justify-end gap-2 pt-4">
                {onCancel && (
                    <Button type="button" variant="ghost" onClick={onCancel}>
                        Cancel
                    </Button>
                )}
                <SubmitButton isEditing={isEditing} />
            </div>
        </form>
    );
}
