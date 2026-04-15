'use client';

import { useState, useEffect, useCallback, useTransition, useActionState, useRef } from 'react';
import { useFormStatus } from 'react-dom';
import { LoaderCircle, Trash2, CalendarHeart, Pencil, Plus, X, PartyPopper } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { getCrmHolidays, saveCrmHoliday, deleteCrmHoliday } from '@/app/actions/crm-hr.actions';
import type { WithId, CrmHoliday } from '@/lib/definitions';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DatePicker } from '@/components/ui/date-picker';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';

import { ClayCard, ClayButton, ClayBadge } from '@/components/clay';
import { CrmPageHeader } from '@/app/dashboard/crm/_components/crm-page-header';

const saveInitialState: any = { message: null, error: null };

type HolidayType = 'national' | 'regional' | 'optional';

const TYPE_LABELS: Record<HolidayType, string> = {
    national: 'National',
    regional: 'Regional',
    optional: 'Optional',
};

const TYPE_TONES: Record<HolidayType, 'blue' | 'amber' | 'neutral'> = {
    national: 'blue',
    regional: 'amber',
    optional: 'neutral',
};

// Common Indian national holidays for the "Add Public Holidays" feature
const NATIONAL_HOLIDAYS_IN = [
    { name: "Republic Day",           date: "2026-01-26", type: "national" as HolidayType, recurring: true },
    { name: "Independence Day",       date: "2026-08-15", type: "national" as HolidayType, recurring: true },
    { name: "Gandhi Jayanti",         date: "2026-10-02", type: "national" as HolidayType, recurring: true },
    { name: "Christmas Day",          date: "2026-12-25", type: "national" as HolidayType, recurring: true },
    { name: "New Year's Day",         date: "2026-01-01", type: "national" as HolidayType, recurring: true },
    { name: "Holi",                   date: "2026-03-04", type: "national" as HolidayType, recurring: false },
    { name: "Eid ul-Fitr",            date: "2026-03-21", type: "national" as HolidayType, recurring: false },
    { name: "Diwali",                 date: "2026-10-19", type: "national" as HolidayType, recurring: false },
    { name: "Dussehra",               date: "2026-10-08", type: "national" as HolidayType, recurring: false },
    { name: "Navratri",               date: "2026-09-28", type: "national" as HolidayType, recurring: false },
    { name: "Good Friday",            date: "2026-04-03", type: "national" as HolidayType, recurring: false },
    { name: "Ambedkar Jayanti",       date: "2026-04-14", type: "national" as HolidayType, recurring: true },
    { name: "Maha Shivratri",         date: "2026-02-19", type: "national" as HolidayType, recurring: false },
    { name: "Guru Nanak Jayanti",     date: "2026-11-14", type: "national" as HolidayType, recurring: false },
];

function SaveButton({ label }: { label: string }) {
    const { pending } = useFormStatus();
    return (
        <ClayButton
            type="submit"
            variant="obsidian"
            disabled={pending}
            leading={pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : undefined}
        >
            {label}
        </ClayButton>
    );
}

export default function HolidaysPage() {
    const [holidays, setHolidays] = useState<WithId<CrmHoliday>[]>([]);
    const [isLoading, startLoading] = useTransition();
    const [saveState, formAction] = useActionState(saveCrmHoliday, saveInitialState);
    const { toast } = useToast();
    const formRef = useRef<HTMLFormElement>(null);

    // Dialog state
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editing, setEditing] = useState<WithId<CrmHoliday> | null>(null);

    // Controlled form fields
    const [date, setDate] = useState<Date | undefined>(undefined);
    const [type, setType] = useState<string>('national');
    const [recurring, setRecurring] = useState<string>('false');

    const fetchData = useCallback(() => {
        startLoading(async () => {
            const data = await getCrmHolidays();
            setHolidays(data);
        });
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    useEffect(() => {
        if (saveState.message) {
            toast({ title: 'Success', description: saveState.message });
            fetchData();
            formRef.current?.reset();
            setDialogOpen(false);
            setEditing(null);
            setDate(undefined);
            setType('national');
            setRecurring('false');
        }
        if (saveState.error) {
            toast({ title: 'Error', description: saveState.error, variant: 'destructive' });
        }
    }, [saveState, toast, fetchData]);

    const [deleteTransition, startDeleteTransition] = useTransition();

    const handleDelete = (holiday: WithId<CrmHoliday>) => {
        startDeleteTransition(async () => {
            const result = await deleteCrmHoliday(holiday._id.toString());
            if (result.success) {
                toast({ title: 'Deleted', description: `"${holiday.name}" removed.` });
                fetchData();
            } else {
                toast({ title: 'Error', description: result.error, variant: 'destructive' });
            }
        });
    };

    const openAdd = () => {
        setEditing(null);
        setDate(undefined);
        setType('national');
        setRecurring('false');
        setDialogOpen(true);
    };

    const openEdit = (holiday: WithId<CrmHoliday>) => {
        setEditing(holiday);
        setDate(new Date(holiday.date));
        setType((holiday as any).type ?? 'national');
        setRecurring((holiday as any).recurring ? 'true' : 'false');
        setDialogOpen(true);
    };

    // "Add Public Holidays" — bulk insert national holidays for the current year
    const [bulkTransition, startBulkTransition] = useTransition();
    const handleAddPublicHolidays = () => {
        startBulkTransition(async () => {
            let added = 0;
            for (const h of NATIONAL_HOLIDAYS_IN) {
                const fd = new FormData();
                fd.set('name', h.name);
                fd.set('date', new Date(h.date).toISOString());
                fd.set('type', h.type);
                fd.set('recurring', String(h.recurring));
                const result = await saveCrmHoliday(null, fd);
                if (result.message) added++;
            }
            toast({ title: 'Public Holidays Added', description: `${added} holidays inserted.` });
            fetchData();
        });
    };

    const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    return (
        <div className="flex w-full flex-col gap-6">
            <CrmPageHeader
                title="Holidays"
                subtitle="Maintain your organization's official holiday calendar with types and recurrence."
                icon={CalendarHeart}
                actions={
                    <>
                        <ClayButton
                            variant="pill"
                            leading={<PartyPopper className="h-4 w-4" />}
                            onClick={handleAddPublicHolidays}
                            disabled={bulkTransition}
                        >
                            {bulkTransition ? 'Adding…' : 'Add Public Holidays'}
                        </ClayButton>
                        <ClayButton
                            variant="obsidian"
                            leading={<Plus className="h-4 w-4" />}
                            onClick={openAdd}
                        >
                            Add Holiday
                        </ClayButton>
                    </>
                }
            />

            <ClayCard>
                <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-[16px] font-semibold text-clay-ink">Holiday Calendar</h2>
                    <ClayBadge tone="neutral">{holidays.length} holidays</ClayBadge>
                </div>
                <div className="overflow-x-auto rounded-clay-md border border-clay-border">
                    <table className="w-full text-left text-[13px]">
                        <thead>
                            <tr className="border-b border-clay-border bg-clay-surface-2">
                                <th className="px-4 py-3 text-[12px] font-semibold uppercase tracking-wide text-clay-ink-muted">Holiday</th>
                                <th className="px-4 py-3 text-[12px] font-semibold uppercase tracking-wide text-clay-ink-muted">Date</th>
                                <th className="px-4 py-3 text-[12px] font-semibold uppercase tracking-wide text-clay-ink-muted">Day</th>
                                <th className="px-4 py-3 text-[12px] font-semibold uppercase tracking-wide text-clay-ink-muted">Type</th>
                                <th className="px-4 py-3 text-[12px] font-semibold uppercase tracking-wide text-clay-ink-muted">Location</th>
                                <th className="px-4 py-3 text-center text-[12px] font-semibold uppercase tracking-wide text-clay-ink-muted">Recurring</th>
                                <th className="px-4 py-3 text-right text-[12px] font-semibold uppercase tracking-wide text-clay-ink-muted">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading ? (
                                <tr>
                                    <td colSpan={7} className="h-24 text-center">
                                        <LoaderCircle className="mx-auto h-6 w-6 animate-spin text-clay-ink-muted" />
                                    </td>
                                </tr>
                            ) : holidays.length > 0 ? (
                                holidays.map((holiday) => {
                                    const d = new Date(holiday.date);
                                    const holidayType: HolidayType = ((holiday as any).type as HolidayType) ?? 'national';
                                    return (
                                        <tr key={holiday._id.toString()} className="border-b border-clay-border last:border-0 hover:bg-clay-surface-2/50 transition-colors">
                                            <td className="px-4 py-3 font-medium text-clay-ink">{holiday.name}</td>
                                            <td className="px-4 py-3 text-clay-ink">{format(d, 'dd MMM yyyy')}</td>
                                            <td className="px-4 py-3 text-clay-ink-muted">{DAY_NAMES[d.getDay()]}</td>
                                            <td className="px-4 py-3">
                                                <ClayBadge tone={TYPE_TONES[holidayType]}>
                                                    {TYPE_LABELS[holidayType]}
                                                </ClayBadge>
                                            </td>
                                            <td className="px-4 py-3 text-clay-ink-muted">
                                                {(holiday as any).location || '—'}
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                {(holiday as any).recurring ? (
                                                    <ClayBadge tone="green">Yes</ClayBadge>
                                                ) : (
                                                    <ClayBadge tone="neutral">No</ClayBadge>
                                                )}
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center justify-end gap-1">
                                                    <ClayButton
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => openEdit(holiday)}
                                                        aria-label="Edit"
                                                    >
                                                        <Pencil className="h-3.5 w-3.5" />
                                                    </ClayButton>
                                                    <ClayButton
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => handleDelete(holiday)}
                                                        disabled={deleteTransition}
                                                        aria-label="Delete"
                                                    >
                                                        <Trash2 className="h-3.5 w-3.5 text-red-500" />
                                                    </ClayButton>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            ) : (
                                <tr>
                                    <td colSpan={7} className="h-24 text-center text-[13px] text-clay-ink-muted">
                                        No holidays added yet. Click "Add Holiday" or "Add Public Holidays".
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </ClayCard>

            {/* Add / Edit dialog */}
            <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) setEditing(null); }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="text-clay-ink">
                            {editing ? 'Edit Holiday' : 'Add Holiday'}
                        </DialogTitle>
                        <DialogDescription className="text-clay-ink-muted">
                            Fill in the holiday details. Name and date are required.
                        </DialogDescription>
                    </DialogHeader>
                    <form action={formAction} ref={formRef} className="space-y-4">
                        {editing?._id ? (
                            <input type="hidden" name="_id" value={editing._id.toString()} />
                        ) : null}
                        <input type="hidden" name="date" value={date?.toISOString() ?? ''} />
                        <input type="hidden" name="type" value={type} />
                        <input type="hidden" name="recurring" value={recurring} />

                        <div>
                            <Label htmlFor="holiday-name" className="text-[13px] text-clay-ink">
                                Holiday Name <span className="text-red-500">*</span>
                            </Label>
                            <Input
                                id="holiday-name"
                                name="name"
                                required
                                defaultValue={editing?.name ?? ''}
                                placeholder="e.g. Diwali"
                                className="mt-1.5 h-10 rounded-clay-md border-clay-border bg-clay-surface text-[13px]"
                            />
                        </div>

                        <div>
                            <Label className="text-[13px] text-clay-ink">
                                Date <span className="text-red-500">*</span>
                            </Label>
                            <div className="mt-1.5">
                                <DatePicker date={date} setDate={setDate} />
                            </div>
                        </div>

                        <div>
                            <Label htmlFor="holiday-type" className="text-[13px] text-clay-ink">
                                Type
                            </Label>
                            <Select value={type} onValueChange={setType}>
                                <SelectTrigger
                                    id="holiday-type"
                                    className="mt-1.5 h-10 rounded-clay-md border-clay-border bg-clay-surface text-[13px]"
                                >
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="national">National</SelectItem>
                                    <SelectItem value="regional">Regional</SelectItem>
                                    <SelectItem value="optional">Optional</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div>
                            <Label htmlFor="holiday-location" className="text-[13px] text-clay-ink">
                                Location / State
                            </Label>
                            <Input
                                id="holiday-location"
                                name="location"
                                defaultValue={(editing as any)?.location ?? ''}
                                placeholder="e.g. Maharashtra (leave blank for all)"
                                className="mt-1.5 h-10 rounded-clay-md border-clay-border bg-clay-surface text-[13px]"
                            />
                        </div>

                        <div>
                            <Label htmlFor="holiday-recurring" className="text-[13px] text-clay-ink">
                                Recurring Yearly
                            </Label>
                            <Select value={recurring} onValueChange={setRecurring}>
                                <SelectTrigger
                                    id="holiday-recurring"
                                    className="mt-1.5 h-10 rounded-clay-md border-clay-border bg-clay-surface text-[13px]"
                                >
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="true">Yes — repeats every year</SelectItem>
                                    <SelectItem value="false">No — one-time</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <DialogFooter>
                            <ClayButton
                                type="button"
                                variant="pill"
                                onClick={() => setDialogOpen(false)}
                                leading={<X className="h-3.5 w-3.5" />}
                            >
                                Cancel
                            </ClayButton>
                            <SaveButton label={editing ? 'Save Changes' : 'Add Holiday'} />
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
