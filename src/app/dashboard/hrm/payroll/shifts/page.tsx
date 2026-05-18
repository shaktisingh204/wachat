'use client';

import {
  ZoruAlertDialog,
  ZoruAlertDialogAction,
  ZoruAlertDialogCancel,
  ZoruAlertDialogContent,
  ZoruAlertDialogDescription,
  ZoruAlertDialogFooter,
  ZoruAlertDialogHeader,
  ZoruAlertDialogTitle,
  ZoruBadge,
  ZoruButton,
  ZoruCheckbox,
  ZoruDialog,
  ZoruDialogContent,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  ZoruInput,
  ZoruLabel,
  ZoruTable,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
  ZoruTextarea,
  useZoruToast,
} from '@/components/zoruui';
import {
  useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { Clock,
  Edit,
  LoaderCircle,
  Plus,
  Trash2 } from 'lucide-react';

/**
 * Shifts — settings-style master-data page.
 *
 * Inline dialog (create + edit) over a single ZoruTable. Each row defines
 * a shift's HH:MM window, break/grace, working-day mask, and an optional
 * color swatch. Drives `crmShiftsApi` through `crm-shifts.actions`.
 */

import * as React from 'react';

import { CrmPageHeader } from '@/app/dashboard/crm/_components/crm-page-header';
import { EntityListShell } from '@/components/crm/entity-list-shell';
import { StatusPill, type StatusTone } from '@/components/crm/status-pill';
import { EnumFormField } from '@/components/crm/enum-form-field';
import { EnumFilterField } from '@/components/crm/enum-filter-field';

import {
    deleteShift,
    getShifts,
    saveShift,
} from '@/app/actions/crm-shifts.actions';
import type {
    CrmShiftDoc,
    CrmShiftStatus,
} from '@/lib/rust-client/crm-shifts';

const BASE = '/dashboard/hrm/payroll/shifts';

const WEEKDAYS: Array<{ value: string; label: string }> = [
    { value: 'monday', label: 'Mon' },
    { value: 'tuesday', label: 'Tue' },
    { value: 'wednesday', label: 'Wed' },
    { value: 'thursday', label: 'Thu' },
    { value: 'friday', label: 'Fri' },
    { value: 'saturday', label: 'Sat' },
    { value: 'sunday', label: 'Sun' },
];

const STATUS_TONE: Record<CrmShiftStatus, StatusTone> = {
    active: 'green',
    archived: 'neutral',
};

const saveInitial: { message?: string; error?: string; id?: string } = {};

function SubmitButton({ isEditing }: { isEditing: boolean }) {
    const { pending } = useFormStatus();
    return (
        <ZoruButton type="submit" disabled={pending}>
            {pending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : null}
            {isEditing ? 'Save changes' : 'Create shift'}
        </ZoruButton>
    );
}

function ShiftDialog({
    open,
    onOpenChange,
    onSaved,
    initial,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSaved: () => void;
    initial: CrmShiftDoc | null;
}) {
    const isEditing = !!initial;
    const [state, formAction] = useActionState(saveShift, saveInitial);
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
        if (state?.message) {
            toast({ title: 'Saved', description: state.message });
            onSaved();
            onOpenChange(false);
        }
        if (state?.error) {
            toast({
                title: 'Error',
                description: state.error,
                variant: 'destructive',
            });
        }
        // We intentionally re-run only when state changes
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
        <ZoruDialog open={open} onOpenChange={onOpenChange}>
            <ZoruDialogContent className="sm:max-w-[560px]">
                <form action={formAction} className="flex flex-col gap-4">
                    {isEditing ? (
                        <input type="hidden" name="shiftId" value={initial!._id} />
                    ) : null}
                    <input type="hidden" name="color" value={color} />
                    <input
                        type="hidden"
                        name="isNightShift"
                        value={isNight ? 'true' : 'false'}
                    />
                    <input
                        type="hidden"
                        name="isDefault"
                        value={isDefault ? 'true' : 'false'}
                    />
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
                            <ZoruLabel htmlFor="name">Name *</ZoruLabel>
                            <ZoruInput
                                id="name"
                                name="name"
                                required
                                placeholder="Morning Shift"
                                defaultValue={initial?.name ?? ''}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <ZoruLabel htmlFor="code">Code</ZoruLabel>
                            <ZoruInput
                                id="code"
                                name="code"
                                placeholder="MORN"
                                defaultValue={initial?.code ?? ''}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <ZoruLabel htmlFor="color-trigger">Color</ZoruLabel>
                            <div className="flex items-center gap-2">
                                <input
                                    id="color-trigger"
                                    type="color"
                                    value={color}
                                    onChange={(e) => setColor(e.target.value)}
                                    className="h-9 w-12 cursor-pointer rounded-md border border-zoru-line bg-transparent p-1"
                                    aria-label="Pick shift color"
                                />
                                <ZoruInput
                                    value={color}
                                    onChange={(e) => setColor(e.target.value)}
                                    placeholder="#EAB308"
                                />
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <ZoruLabel htmlFor="startTime">Start time *</ZoruLabel>
                            <ZoruInput
                                id="startTime"
                                name="startTime"
                                type="time"
                                required
                                defaultValue={initial?.startTime ?? '09:00'}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <ZoruLabel htmlFor="endTime">End time *</ZoruLabel>
                            <ZoruInput
                                id="endTime"
                                name="endTime"
                                type="time"
                                required
                                defaultValue={initial?.endTime ?? '18:00'}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <ZoruLabel htmlFor="breakMinutes">Break (minutes)</ZoruLabel>
                            <ZoruInput
                                id="breakMinutes"
                                name="breakMinutes"
                                type="number"
                                min="0"
                                step="1"
                                defaultValue={initial?.breakMinutes ?? 60}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <ZoruLabel htmlFor="graceMinutes">Grace (minutes)</ZoruLabel>
                            <ZoruInput
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
                        <ZoruLabel>Working days</ZoruLabel>
                        <div className="flex flex-wrap gap-2">
                            {WEEKDAYS.map((d) => {
                                const checked = days.includes(d.value);
                                return (
                                    <label
                                        key={d.value}
                                        className="flex items-center gap-2 rounded-md border border-zoru-line bg-zoru-bg px-2.5 py-1.5 text-[12.5px] text-zoru-ink"
                                    >
                                        <ZoruCheckbox
                                            checked={checked}
                                            onCheckedChange={(v) =>
                                                toggleDay(d.value, Boolean(v))
                                            }
                                        />
                                        <span>{d.label}</span>
                                    </label>
                                );
                            })}
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="departmentIds">
                            Department IDs (comma-separated)
                        </ZoruLabel>
                        <ZoruInput
                            id="departmentIds"
                            name="departmentIds"
                            placeholder="Optional — leave blank for all departments"
                            defaultValue={(initial?.departmentIds ?? []).join(', ')}
                        />
                    </div>

                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="description">Description</ZoruLabel>
                        <ZoruTextarea
                            id="description"
                            name="description"
                            rows={2}
                            defaultValue={initial?.description ?? ''}
                            placeholder="Optional notes about this shift."
                        />
                    </div>

                    <div className="flex flex-wrap items-center gap-4">
                        <label className="flex items-center gap-2 text-[13px] text-zoru-ink">
                            <ZoruCheckbox
                                checked={isNight}
                                onCheckedChange={(v) => setIsNight(Boolean(v))}
                            />
                            Night shift (crosses midnight)
                        </label>
                        <label className="flex items-center gap-2 text-[13px] text-zoru-ink">
                            <ZoruCheckbox
                                checked={isDefault}
                                onCheckedChange={(v) => setIsDefault(Boolean(v))}
                            />
                            Default shift
                        </label>
                        {isEditing ? (
                            <div className="ml-auto flex items-center gap-2">
                                <ZoruLabel className="text-[12.5px]">
                                    Status
                                </ZoruLabel>
                                <EnumFormField
                                    enumName="activeArchived"
                                    name="__status_picker"
                                    initialId={status}
                                    onChange={(v) => setStatus((v ?? 'active') as CrmShiftStatus)}
                                />
                            </div>
                        ) : null}
                    </div>

                    <ZoruDialogFooter>
                        <ZoruButton
                            type="button"
                            variant="ghost"
                            onClick={() => onOpenChange(false)}
                        >
                            Cancel
                        </ZoruButton>
                        <SubmitButton isEditing={isEditing} />
                    </ZoruDialogFooter>
                </form>
            </ZoruDialogContent>
        </ZoruDialog>
    );
}

function dayBadges(days: string[] | undefined): React.ReactNode {
    const list = days ?? [];
    if (list.length === 0) {
        return <span className="text-[12.5px] text-zoru-ink-muted">—</span>;
    }
    if (list.length === 7) {
        return <ZoruBadge variant="info">All days</ZoruBadge>;
    }
    return (
        <div className="flex flex-wrap gap-1">
            {list.map((d) => (
                <ZoruBadge key={d} variant="info">
                    {d.slice(0, 3)}
                </ZoruBadge>
            ))}
        </div>
    );
}

export default function ShiftsListPage() {
    const [shifts, setShifts] = React.useState<CrmShiftDoc[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [search, setSearch] = React.useState('');
    const [statusFilter, setStatusFilter] = React.useState<CrmShiftStatus | 'all'>(
        'all',
    );
    const [editing, setEditing] = React.useState<CrmShiftDoc | null>(null);
    const [dialogOpen, setDialogOpen] = React.useState(false);
    const [pendingDelete, setPendingDelete] = React.useState<CrmShiftDoc | null>(null);
    const [deletePending, startDeleteTransition] = React.useTransition();
    const { toast } = useZoruToast();

    const refresh = React.useCallback(async () => {
        setIsLoading(true);
        try {
            const res = await getShifts({
                q: search.trim() || undefined,
                status: statusFilter === 'all' ? undefined : statusFilter,
                limit: 200,
            });
            setShifts(res.items ?? []);
        } catch {
            setShifts([]);
        } finally {
            setIsLoading(false);
        }
    }, [search, statusFilter]);

    React.useEffect(() => {
        const t = window.setTimeout(() => {
            void refresh();
        }, 250);
        return () => window.clearTimeout(t);
    }, [refresh]);

    const handleOpenDialog = (s: CrmShiftDoc | null) => {
        setEditing(s);
        setDialogOpen(true);
    };

    const handleDelete = () => {
        if (!pendingDelete) return;
        const id = pendingDelete._id;
        startDeleteTransition(async () => {
            const result = await deleteShift(id);
            if (result.success) {
                toast({ title: 'Shift deleted' });
                setPendingDelete(null);
                await refresh();
            } else {
                toast({
                    title: 'Error',
                    description: result.error ?? 'Could not delete shift.',
                    variant: 'destructive',
                });
            }
        });
    };

    return (
        <>
            <ShiftDialog
                open={dialogOpen}
                onOpenChange={setDialogOpen}
                onSaved={refresh}
                initial={editing}
            />

            <div className="flex w-full flex-col gap-6">
                <CrmPageHeader
                    breadcrumbs={[
                        { label: 'Payroll', href: '/dashboard/hrm/payroll' },
                        { label: 'Shifts' },
                    ]}
                    title="Shifts"
                    subtitle="Master shift definitions used across attendance, payroll and rotations."
                    icon={Clock}
                    actions={
                        <ZoruButton onClick={() => handleOpenDialog(null)}>
                            <Plus className="mr-1.5 h-3.5 w-3.5" /> New shift
                        </ZoruButton>
                    }
                />

                <EntityListShell
                    title=""
                    search={{
                        value: search,
                        onChange: setSearch,
                        placeholder: 'Search shifts…',
                    }}
                    filters={
                        <EnumFilterField
                            enumName="activeArchived"
                            value={statusFilter}
                            onChange={(v) =>
                                setStatusFilter(v as CrmShiftStatus | 'all')
                            }
                            placeholder="All statuses"
                        />
                    }
                    loading={isLoading && shifts.length === 0}
                >
                    <div className="overflow-x-auto rounded-lg border border-zoru-line">
                        <ZoruTable>
                            <ZoruTableHeader>
                                <ZoruTableRow className="border-zoru-line hover:bg-transparent">
                                    <ZoruTableHead className="text-zoru-ink-muted">
                                        Name
                                    </ZoruTableHead>
                                    <ZoruTableHead className="text-zoru-ink-muted">
                                        Code
                                    </ZoruTableHead>
                                    <ZoruTableHead className="text-zoru-ink-muted">
                                        Window
                                    </ZoruTableHead>
                                    <ZoruTableHead className="text-zoru-ink-muted">
                                        Break / Grace
                                    </ZoruTableHead>
                                    <ZoruTableHead className="text-zoru-ink-muted">
                                        Days
                                    </ZoruTableHead>
                                    <ZoruTableHead className="text-zoru-ink-muted">
                                        Status
                                    </ZoruTableHead>
                                    <ZoruTableHead className="text-right text-zoru-ink-muted">
                                        Actions
                                    </ZoruTableHead>
                                </ZoruTableRow>
                            </ZoruTableHeader>
                            <ZoruTableBody>
                                {isLoading ? (
                                    <ZoruTableRow className="border-zoru-line">
                                        <ZoruTableCell colSpan={7} className="h-24 text-center">
                                            <LoaderCircle className="mx-auto h-6 w-6 animate-spin text-zoru-ink-muted" />
                                        </ZoruTableCell>
                                    </ZoruTableRow>
                                ) : shifts.length === 0 ? (
                                    <ZoruTableRow className="border-zoru-line">
                                        <ZoruTableCell
                                            colSpan={7}
                                            className="h-24 text-center text-zoru-ink-muted"
                                        >
                                            No shifts match this filter.
                                        </ZoruTableCell>
                                    </ZoruTableRow>
                                ) : (
                                    shifts.map((s) => {
                                        const status = (s.status ?? 'active') as CrmShiftStatus;
                                        const tone = STATUS_TONE[status] ?? 'neutral';
                                        return (
                                            <ZoruTableRow key={s._id} className="border-zoru-line">
                                                <ZoruTableCell className="font-medium text-zoru-ink">
                                                    <div className="flex items-center gap-2">
                                                        <span
                                                            aria-hidden
                                                            className="inline-block h-4 w-4 rounded-[4px] border border-zoru-line"
                                                            style={{ backgroundColor: s.color || '#EAB308' }}
                                                        />
                                                        <span>{s.name}</span>
                                                        {s.isDefault ? (
                                                            <ZoruBadge variant="info">default</ZoruBadge>
                                                        ) : null}
                                                        {s.isNightShift ? (
                                                            <ZoruBadge variant="secondary">night</ZoruBadge>
                                                        ) : null}
                                                    </div>
                                                </ZoruTableCell>
                                                <ZoruTableCell className="font-mono text-[12px] text-zoru-ink">
                                                    {s.code || '—'}
                                                </ZoruTableCell>
                                                <ZoruTableCell className="text-zoru-ink">
                                                    {s.startTime} – {s.endTime}
                                                </ZoruTableCell>
                                                <ZoruTableCell className="text-zoru-ink">
                                                    {(s.breakMinutes ?? 0)}m break · {(s.graceMinutes ?? 0)}m grace
                                                </ZoruTableCell>
                                                <ZoruTableCell>{dayBadges(s.workingDays)}</ZoruTableCell>
                                                <ZoruTableCell>
                                                    <StatusPill label={status} tone={tone} />
                                                </ZoruTableCell>
                                                <ZoruTableCell className="text-right">
                                                    <ZoruButton
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => handleOpenDialog(s)}
                                                        aria-label="Edit shift"
                                                    >
                                                        <Edit className="h-4 w-4" />
                                                    </ZoruButton>
                                                    <ZoruButton
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => setPendingDelete(s)}
                                                        aria-label="Delete shift"
                                                    >
                                                        <Trash2 className="h-4 w-4 text-destructive" />
                                                    </ZoruButton>
                                                </ZoruTableCell>
                                            </ZoruTableRow>
                                        );
                                    })
                                )}
                            </ZoruTableBody>
                        </ZoruTable>
                    </div>
                </EntityListShell>
            </div>

            <ZoruAlertDialog
                open={!!pendingDelete}
                onOpenChange={(o) => !o && setPendingDelete(null)}
            >
                <ZoruAlertDialogContent>
                    <ZoruAlertDialogHeader>
                        <ZoruAlertDialogTitle>Delete shift?</ZoruAlertDialogTitle>
                        <ZoruAlertDialogDescription>
                            Deleting &ldquo;{pendingDelete?.name}&rdquo; will remove it from the
                            shift master list. Employees currently assigned to this shift will
                            need to be re-mapped.
                        </ZoruAlertDialogDescription>
                    </ZoruAlertDialogHeader>
                    <ZoruAlertDialogFooter>
                        <ZoruAlertDialogCancel>Cancel</ZoruAlertDialogCancel>
                        <ZoruAlertDialogAction onClick={handleDelete} disabled={deletePending}>
                            {deletePending ? 'Deleting…' : 'Delete'}
                        </ZoruAlertDialogAction>
                    </ZoruAlertDialogFooter>
                </ZoruAlertDialogContent>
            </ZoruAlertDialog>
        </>
    );
}
