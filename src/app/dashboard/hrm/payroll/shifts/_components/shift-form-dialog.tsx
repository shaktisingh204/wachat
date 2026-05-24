'use client';

import * as React from 'react';
import { useActionState, useEffect } from 'react';
import { useFormStatus } from 'react-dom';
import { LoaderCircle } from 'lucide-react';
import {
    Button,
    Checkbox,
    Dialog,
    ZoruDialogContent,
    ZoruDialogFooter,
    ZoruDialogHeader,
    ZoruDialogTitle,
    Input,
    Label,
    Textarea,
    useZoruToast,
} from '@/components/zoruui';
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

const saveInitial = {};

function SubmitButton({ isEditing }: { isEditing: boolean }) {
    const { pending } = useFormStatus();
    return (
        <Button type="submit" disabled={pending}>
            {pending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : null}
            {isEditing ? 'Save changes' : 'Create shift'}
        </Button>
    );
}

export function ShiftDialog({
    open,
    onOpenChange,
    onSaved,
    initial,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSaved: (shift: CrmShiftDoc) => void;
    initial: CrmShiftDoc | null;
}) {
    const isEditing = !!initial;
    const [state, formAction] = useActionState(saveShift, saveInitial as any);
    const { toast } = useZoruToast();

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
        if (!open) return;
        setColor(initial?.color ?? '#EAB308');
        setIsNight(!!initial?.isNightShift);
        setIsDefault(!!initial?.isDefault);
        setDays(
            initial?.workingDays ?? [
                'monday',
                'tuesday',
                'wednesday',
                'thursday',
                'friday',
            ],
        );
        setStatus((initial?.status as CrmShiftStatus) ?? 'active');
    }, [open, initial]);

    React.useEffect(() => {
        if (state?.message && state?.shift) {
            toast({ title: 'Saved', description: state.message });
            onSaved(state.shift as CrmShiftDoc);
            onOpenChange(false);
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

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <ZoruDialogContent className="sm:max-w-[560px]">
                <form action={formAction} className="flex flex-col gap-4">
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

                    <ZoruDialogHeader>
                        <ZoruDialogTitle>
                            {isEditing ? 'Edit shift' : 'New shift'}
                        </ZoruDialogTitle>
                    </ZoruDialogHeader>

                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-1.5 sm:col-span-2">
                            <Label htmlFor="name">Name *</Label>
                            <Input id="name" name="name" required placeholder="Morning Shift" defaultValue={initial?.name ?? ''} />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="code">Code</Label>
                            <Input id="code" name="code" placeholder="MORN" defaultValue={initial?.code ?? ''} />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="color-trigger">Color</Label>
                            <div className="flex items-center gap-2">
                                <input
                                    id="color-trigger"
                                    type="color"
                                    value={color}
                                    onChange={(e) => setColor(e.target.value)}
                                    className="h-9 w-12 cursor-pointer rounded-md border border-zoru-line bg-transparent p-1"
                                    aria-label="Pick shift color"
                                />
                                <Input value={color} onChange={(e) => setColor(e.target.value)} placeholder="#EAB308" />
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="startTime">Start time *</Label>
                            <Input id="startTime" name="startTime" type="time" required defaultValue={initial?.startTime ?? '09:00'} />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="endTime">End time *</Label>
                            <Input id="endTime" name="endTime" type="time" required defaultValue={initial?.endTime ?? '18:00'} />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="breakMinutes">Break (minutes)</Label>
                            <Input id="breakMinutes" name="breakMinutes" type="number" min="0" step="1" defaultValue={initial?.breakMinutes ?? 60} />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="graceMinutes">Grace (minutes)</Label>
                            <Input id="graceMinutes" name="graceMinutes" type="number" min="0" step="1" defaultValue={initial?.graceMinutes ?? 15} />
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <Label>Working days</Label>
                        <div className="flex flex-wrap gap-2">
                            {WEEKDAYS.map((d) => {
                                const checked = days.includes(d.value);
                                return (
                                    <label key={d.value} className="flex items-center gap-2 rounded-md border border-zoru-line bg-zoru-bg px-2.5 py-1.5 text-[12.5px] text-zoru-ink">
                                        <Checkbox checked={checked} onCheckedChange={(v) => toggleDay(d.value, Boolean(v))} />
                                        <span>{d.label}</span>
                                    </label>
                                );
                            })}
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="departmentIds">Department IDs (comma-separated)</Label>
                        <Input id="departmentIds" name="departmentIds" placeholder="Optional — leave blank for all departments" defaultValue={(initial?.departmentIds ?? []).join(', ')} />
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="description">Description</Label>
                        <Textarea id="description" name="description" rows={2} defaultValue={initial?.description ?? ''} placeholder="Optional notes about this shift." />
                    </div>

                    <div className="flex flex-wrap items-center gap-4">
                        <label className="flex items-center gap-2 text-[13px] text-zoru-ink">
                            <Checkbox checked={isNight} onCheckedChange={(v) => setIsNight(Boolean(v))} />
                            Night shift (crosses midnight)
                        </label>
                        <label className="flex items-center gap-2 text-[13px] text-zoru-ink">
                            <Checkbox checked={isDefault} onCheckedChange={(v) => setIsDefault(Boolean(v))} />
                            Default shift
                        </label>
                        {isEditing ? (
                            <div className="ml-auto flex items-center gap-2">
                                <Label className="text-[12.5px]">Status</Label>
                                <EnumFormField enumName="activeArchived" name="__status_picker" initialId={status} onChange={(v) => setStatus((v ?? 'active') as CrmShiftStatus)} />
                            </div>
                        ) : null}
                    </div>

                    <ZoruDialogFooter>
                        <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
                        <SubmitButton isEditing={isEditing} />
                    </ZoruDialogFooter>
                </form>
            </ZoruDialogContent>
        </Dialog>
    );
}
