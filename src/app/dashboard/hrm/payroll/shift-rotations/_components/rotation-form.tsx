'use client';

import {
  Button,
  Card,
  Checkbox,
  Input,
  Label,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  Textarea,
  useZoruToast,
} from '@/components/zoruui';
import {
  useActionState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useFormStatus } from 'react-dom';
import { ArrowLeft,
  LoaderCircle,
  Plus,
  Save,
  Trash2,
  Download } from 'lucide-react';

// TODO 1E.sweep: frequency/weekday dropdowns -> <EnumFormField enumName="weekday|recurringFrequency">; shift -> <EntityFormField entity="...">; employees -> <EntityMultiFormField entity="employee">. See plan §1E.

/**
 * <RotationForm /> — create + edit form for shift rotations.
 *
 * Binds to `saveShiftRotation` via `useActionState`. The repeater builds
 * a `CrmShiftRotationDay[]` pattern and ships it as JSON under
 * `patternJson` so the server action can validate the shape without
 * juggling dynamic field names.
 */

import * as React from 'react';

import { saveShiftRotation } from '@/app/actions/crm-shift-rotations.actions';
import type {
    CrmShiftRotationDay,
    CrmShiftRotationDoc,
    CrmShiftRotationStatus,
} from '@/lib/rust-client/crm-shift-rotations';
import type { CrmShiftDoc } from '@/lib/rust-client/crm-shifts';

const BASE = '/dashboard/hrm/payroll/shift-rotations';

const STATUS_OPTIONS: Array<{ value: CrmShiftRotationStatus; label: string }> = [
    { value: 'active', label: 'Active' },
    { value: 'paused', label: 'Paused' },
    { value: 'completed', label: 'Completed' },
    { value: 'archived', label: 'Archived' },
];

interface RotationFormProps {
    initialData?: CrmShiftRotationDoc | null;
    shifts: CrmShiftDoc[];
}

type SaveState = { message?: string; error?: string; id?: string };
const initialState: SaveState = {};

function toDateInput(value: unknown): string {
    if (!value) return '';
    const d = new Date(value as string);
    if (Number.isNaN(d.getTime())) return '';
    return d.toISOString().slice(0, 10);
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
            {isEditing ? 'Save changes' : 'Create rotation'}
        </Button>
    );
}

interface PatternRow extends CrmShiftRotationDay {
    /** Stable per-row id for React keys. */
    rowId: string;
}

function newRowId(): string {
    return `row_${Math.random().toString(36).slice(2, 9)}`;
}


const PatternRowItem = React.memo(function PatternRowItem({
    row,
    cycleDays,
    shifts,
    updateRow,
    removeRow,
}: {
    row: PatternRow;
    cycleDays: number;
    shifts: CrmShiftDoc[];
    updateRow: (rowId: string, patch: Partial<PatternRow>) => void;
    removeRow: (rowId: string) => void;
}) {
    const shift = shifts.find((s) => s._id === row.shiftId);
    return (
        <div className="grid items-end gap-3 rounded-md border border-zoru-line bg-zoru-bg p-3 md:grid-cols-[100px_1fr_auto_auto]">
            <div className="space-y-1.5">
                <Label className="text-[12px]">Day offset</Label>
                <Input
                    type="number"
                    min={0}
                    max={Math.max(0, cycleDays - 1)}
                    value={row.dayOffset}
                    onChange={(e) =>
                        updateRow(row.rowId, {
                            dayOffset: Number(e.target.value) || 0,
                        })
                    }
                />
            </div>
            <div className="space-y-1.5">
                <Label className="text-[12px]">Shift</Label>
                <Select
                    value={row.shiftId || ''}
                    onValueChange={(v) => updateRow(row.rowId, { shiftId: v })}
                    disabled={row.isOff}
                >
                    <ZoruSelectTrigger>
                        <ZoruSelectValue
                            placeholder={
                                row.isOff ? 'Day off' : shift?.name || 'Pick a shift'
                            }
                        />
                    </ZoruSelectTrigger>
                    <ZoruSelectContent>
                        {shifts.map((s) => (
                            <ZoruSelectItem key={s._id} value={s._id}>
                                {s.name}
                            </ZoruSelectItem>
                        ))}
                    </ZoruSelectContent>
                </Select>
            </div>
            <label className="flex items-center gap-2 pb-2 text-[12.5px] text-zoru-ink">
                <Checkbox
                    checked={!!row.isOff}
                    onCheckedChange={(v) =>
                        updateRow(row.rowId, {
                            isOff: Boolean(v),
                            shiftId: v ? '' : row.shiftId,
                        })
                    }
                />
                Off
            </label>
            <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => removeRow(row.rowId)}
                aria-label="Remove pattern row"
            >
                <Trash2 className="h-4 w-4 text-zoru-ink" />
            </Button>
        </div>
    );
});

export function RotationForm({ initialData, shifts }: RotationFormProps) {
    const router = useRouter();
    const { toast } = useZoruToast();
    const isEditing = !!initialData?._id;

    const [state, formAction] = useActionState(saveShiftRotation, initialState);

    const [status, setStatus] = React.useState<CrmShiftRotationStatus>(
        (initialData?.status as CrmShiftRotationStatus) ?? 'active',
    );
    const [cycleDays, setCycleDays] = React.useState<number>(
        initialData?.cycleDays ?? 7,
    );
    
    // Manage default dates on the client to prevent hydration mismatch
    const [defaultStartDate, setDefaultStartDate] = React.useState<string>(() => {
        return toDateInput(initialData?.startDate) || '';
    });
    
    const [defaultEndDate, setDefaultEndDate] = React.useState<string>(() => {
        return toDateInput(initialData?.endDate) || '';
    });
    
    React.useEffect(() => {
        if (!initialData?.startDate) {
            setDefaultStartDate(new Date().toISOString().slice(0, 10));
        }
    }, [initialData?.startDate]);
    
    const [pattern, setPattern] = React.useState<PatternRow[]>(() => {
        const src = initialData?.pattern ?? [];
        if (src.length > 0) {
            return src.map((p) => ({ ...p, rowId: newRowId() }));
        }
        // Seed with one row at offset 0 for new rotations
        return [{ rowId: newRowId(), dayOffset: 0, shiftId: '', isOff: false }];
    });

    React.useEffect(() => {
        if (state?.message) {
            toast({ title: 'Saved', description: state.message });
            const id = state.id ?? initialData?._id;
            router.push(id ? `${BASE}/${id}` : BASE);
        }
        if (state?.error) {
            toast({
                title: 'Failed to save rotation',
                description: state.error || 'An unexpected error occurred while saving.',
                variant: 'destructive',
            });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [state]);

    React.useEffect(() => {
        let ws: WebSocket;
        try {
            ws = new WebSocket(process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001');
            ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    if (data.type === 'ROTATION_UPDATED' && initialData?._id === data.id) {
                        toast({
                            title: 'Rotation Updated',
                            description: 'Another user has modified this rotation in real-time.',
                        });
                    }
                } catch (err) {}
            };
        } catch (err) {}
        
        return () => {
            if (ws) ws.close();
        };
    }, [initialData?._id, toast]);

    const updateRow = React.useCallback((rowId: string, patch: Partial<PatternRow>) => {
        setPattern((prev) =>
            prev.map((r) => (r.rowId === rowId ? { ...r, ...patch } : r)),
        );
    }, []);

    const removeRow = React.useCallback((rowId: string) => {
        setPattern((prev) => prev.filter((r) => r.rowId !== rowId));
    }, []);

    const addRow = React.useCallback(() => {
        setPattern((prev) => {
            const nextOffset = Math.min(
                cycleDays - 1,
                prev.length === 0
                    ? 0
                    : Math.max(...prev.map((p) => p.dayOffset)) + 1,
            );
            return [
                ...prev,
                {
                    rowId: newRowId(),
                    dayOffset: Math.max(0, nextOffset),
                    shiftId: '',
                    isOff: false,
                },
            ];
        });
    }, [cycleDays]);

    const patternJson = React.useMemo(
        () =>
            JSON.stringify(
                pattern.map(({ rowId: _r, ...rest }) => {
                    // shift name is convenient for the detail card; the Rust DTO accepts it
                    const sh = shifts.find((s) => s._id === rest.shiftId);
                    return {
                        dayOffset: Number(rest.dayOffset) || 0,
                        shiftId: rest.shiftId,
                        isOff: !!rest.isOff,
                        shiftName: sh?.name,
                    };
                }),
            ),
        [pattern, shifts],
    );

    const exportToCsv = React.useCallback(() => {
        const csvRows = [];
        csvRows.push(['Day Offset', 'Shift Name', 'Is Off']);
        for (const row of pattern) {
            const shift = shifts.find(s => s._id === row.shiftId);
            csvRows.push([
                row.dayOffset,
                shift ? shift.name : '',
                row.isOff ? 'Yes' : 'No'
            ]);
        }
        const csvContent = csvRows.map(e => e.join(',')).join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', 'pattern.csv');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }, [pattern, shifts]);

    return (
        <Card className="p-6">
            <form action={formAction} className="flex flex-col gap-6">
                {isEditing ? (
                    <input type="hidden" name="rotationId" value={initialData!._id} />
                ) : null}
                <input type="hidden" name="status" value={status} />
                <input type="hidden" name="patternJson" value={patternJson} />

                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5 sm:col-span-2">
                        <Label htmlFor="name">Name *</Label>
                        <Input
                            id="name"
                            name="name"
                            required
                            placeholder="2-2-3 rotation"
                            defaultValue={initialData?.name ?? ''}
                        />
                    </div>
                    <div className="space-y-1.5 sm:col-span-2">
                        <Label htmlFor="description">Description</Label>
                        <Textarea
                            id="description"
                            name="description"
                            rows={2}
                            placeholder="Optional notes about who this rotation applies to."
                            defaultValue={initialData?.description ?? ''}
                        />
                    </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                    <div className="space-y-1.5">
                        <Label htmlFor="employeeId">Employee ID</Label>
                        <Input
                            id="employeeId"
                            name="employeeId"
                            placeholder="Optional"
                            defaultValue={initialData?.employeeId ?? ''}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="departmentId">Department ID</Label>
                        <Input
                            id="departmentId"
                            name="departmentId"
                            placeholder="Optional"
                            defaultValue={initialData?.departmentId ?? ''}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="teamId">Team ID</Label>
                        <Input
                            id="teamId"
                            name="teamId"
                            placeholder="Optional"
                            defaultValue={initialData?.teamId ?? ''}
                        />
                    </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                    <div className="space-y-1.5">
                        <Label htmlFor="cycleDays">Cycle length (days) *</Label>
                        <Input
                            id="cycleDays"
                            name="cycleDays"
                            type="number"
                            min={1}
                            max={365}
                            required
                            value={cycleDays}
                            onChange={(e) => setCycleDays(Number(e.target.value) || 1)}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="startDate">Start date *</Label>
                        <Input
                            id="startDate"
                            name="startDate"
                            type="date"
                            required
                            key={defaultStartDate || 'empty'}
                            defaultValue={defaultStartDate}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="endDate">End date</Label>
                        <Input
                            id="endDate"
                            name="endDate"
                            type="date"
                            defaultValue={defaultEndDate}
                        />
                    </div>
                </div>

                {isEditing ? (
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-1.5">
                            <Label htmlFor="status-trigger">Status</Label>
                            <Select
                                value={status}
                                onValueChange={(v) =>
                                    setStatus(v as CrmShiftRotationStatus)
                                }
                            >
                                <ZoruSelectTrigger id="status-trigger">
                                    <ZoruSelectValue placeholder="Status" />
                                </ZoruSelectTrigger>
                                <ZoruSelectContent>
                                    {STATUS_OPTIONS.map((o) => (
                                        <ZoruSelectItem key={o.value} value={o.value}>
                                            {o.label}
                                        </ZoruSelectItem>
                                    ))}
                                </ZoruSelectContent>
                            </Select>
                        </div>
                        <div className="flex items-end gap-2 pb-1.5">
                            <Checkbox
                                id="inactive"
                                name="inactive"
                                defaultChecked={!initialData?.isActive}
                            />
                            <Label htmlFor="inactive" className="cursor-pointer">
                                Pause assignments
                            </Label>
                        </div>
                    </div>
                ) : null}

                {/* Pattern repeater */}
                <div className="rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-surface p-4">
                    <div className="mb-3 flex items-center justify-between">
                        <div>
                            <div className="text-[14px] font-medium text-zoru-ink">
                                Pattern
                            </div>
                            <div className="text-[12px] text-zoru-ink-muted">
                                Map each day-offset (0 .. {cycleDays - 1}) to a shift or
                                mark it as off.
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={exportToCsv}
                            >
                                <Download className="mr-1 h-3.5 w-3.5" /> Export CSV
                            </Button>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={addRow}
                            >
                                <Plus className="mr-1 h-3.5 w-3.5" /> Add day
                            </Button>
                        </div>
                    </div>

                    <div className="flex flex-col gap-2">
                        {pattern.length === 0 ? (
                            <div className="rounded-md border border-dashed border-zoru-line bg-zoru-bg p-4 text-center text-[13px] text-zoru-ink-muted">
                                No pattern entries yet. Add a day to start.
                            </div>
                        ) : (
                            pattern.map((row) => (
                                <PatternRowItem
                                    key={row.rowId}
                                    row={row}
                                    cycleDays={cycleDays}
                                    shifts={shifts}
                                    updateRow={updateRow}
                                    removeRow={removeRow}
                                />
                            ))
                        )}
                    </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                    <Button variant="ghost" asChild>
                        <Link href={BASE}>
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back to rotations
                        </Link>
                    </Button>
                    <SubmitButton isEditing={isEditing} />
                </div>
            </form>
        </Card>
    );
}
