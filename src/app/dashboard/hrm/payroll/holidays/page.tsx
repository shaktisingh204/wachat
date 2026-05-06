'use client';

import { useState, useEffect, useCallback, useTransition, useActionState, useRef } from 'react';
import { useFormStatus } from 'react-dom';
import { LoaderCircle, Trash2, CalendarHeart, Pencil, Plus, X, PartyPopper } from 'lucide-react';
import { format } from 'date-fns';
import { getCrmHolidays, saveCrmHoliday, deleteCrmHoliday } from '@/app/actions/crm-hr.actions';
import type { WithId, CrmHoliday } from '@/lib/definitions';
import {
    ZoruInput,
    ZoruLabel,
    ZoruDatePicker,
    ZoruSelect,
    ZoruSelectContent,
    ZoruSelectItem,
    ZoruSelectTrigger,
    ZoruSelectValue,
    ZoruDialog,
    ZoruDialogContent,
    ZoruDialogDescription,
    ZoruDialogFooter,
    ZoruDialogHeader,
    ZoruDialogTitle,
    ZoruCard,
    ZoruButton,
    ZoruBadge,
    useZoruToast,
} from '@/components/zoruui';
import { CrmPageHeader } from '@/app/dashboard/crm/_components/crm-page-header';

const saveInitialState: any = { message: null, error: null };

type HolidayType = 'national' | 'regional' | 'optional';

const TYPE_LABELS: Record<HolidayType, string> = {
    national: 'National',
    regional: 'Regional',
    optional: 'Optional',
};

const TYPE_VARIANTS: Record<HolidayType, 'info' | 'warning' | 'secondary'> = {
    national: 'info',
    regional: 'warning',
    optional: 'secondary',
};

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
        <ZoruButton type="submit" disabled={pending}>
            {pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
            {label}
        </ZoruButton>
    );
}

export default function HolidaysPage() {
    const [holidays, setHolidays] = useState<WithId<CrmHoliday>[]>([]);
    const [isLoading, startLoading] = useTransition();
    const [saveState, formAction] = useActionState(saveCrmHoliday, saveInitialState);
    const { toast } = useZoruToast();
    const formRef = useRef<HTMLFormElement>(null);

    const [dialogOpen, setDialogOpen] = useState(false);
    const [editing, setEditing] = useState<WithId<CrmHoliday> | null>(null);

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
                        <ZoruButton
                            variant="outline"
                            onClick={handleAddPublicHolidays}
                            disabled={bulkTransition}
                        >
                            <PartyPopper className="h-4 w-4" />
                            {bulkTransition ? 'Adding…' : 'Add Public Holidays'}
                        </ZoruButton>
                        <ZoruButton onClick={openAdd}>
                            <Plus className="h-4 w-4" />
                            Add Holiday
                        </ZoruButton>
                    </>
                }
            />

            <ZoruCard className="p-6">
                <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-[16px] text-zoru-ink">Holiday Calendar</h2>
                    <ZoruBadge variant="secondary">{holidays.length} holidays</ZoruBadge>
                </div>
                <div className="overflow-x-auto rounded-lg border border-zoru-line">
                    <table className="w-full text-left text-[13px]">
                        <thead>
                            <tr className="border-b border-zoru-line bg-zoru-surface-2">
                                <th className="px-4 py-3 text-[12px] uppercase text-zoru-ink-muted">Holiday</th>
                                <th className="px-4 py-3 text-[12px] uppercase text-zoru-ink-muted">Date</th>
                                <th className="px-4 py-3 text-[12px] uppercase text-zoru-ink-muted">Day</th>
                                <th className="px-4 py-3 text-[12px] uppercase text-zoru-ink-muted">Type</th>
                                <th className="px-4 py-3 text-[12px] uppercase text-zoru-ink-muted">Location</th>
                                <th className="px-4 py-3 text-center text-[12px] uppercase text-zoru-ink-muted">Recurring</th>
                                <th className="px-4 py-3 text-right text-[12px] uppercase text-zoru-ink-muted">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading ? (
                                <tr>
                                    <td colSpan={7} className="h-24 text-center">
                                        <LoaderCircle className="mx-auto h-6 w-6 animate-spin text-zoru-ink-muted" />
                                    </td>
                                </tr>
                            ) : holidays.length > 0 ? (
                                holidays.map((holiday) => {
                                    const d = new Date(holiday.date);
                                    const holidayType: HolidayType = ((holiday as any).type as HolidayType) ?? 'national';
                                    return (
                                        <tr key={holiday._id.toString()} className="border-b border-zoru-line last:border-0 hover:bg-zoru-surface-2/50 transition-colors">
                                            <td className="px-4 py-3 text-zoru-ink">{holiday.name}</td>
                                            <td className="px-4 py-3 text-zoru-ink">{format(d, 'dd MMM yyyy')}</td>
                                            <td className="px-4 py-3 text-zoru-ink-muted">{DAY_NAMES[d.getDay()]}</td>
                                            <td className="px-4 py-3">
                                                <ZoruBadge variant={TYPE_VARIANTS[holidayType]}>
                                                    {TYPE_LABELS[holidayType]}
                                                </ZoruBadge>
                                            </td>
                                            <td className="px-4 py-3 text-zoru-ink-muted">
                                                {(holiday as any).location || '—'}
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                {(holiday as any).recurring ? (
                                                    <ZoruBadge variant="success">Yes</ZoruBadge>
                                                ) : (
                                                    <ZoruBadge variant="secondary">No</ZoruBadge>
                                                )}
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center justify-end gap-1">
                                                    <ZoruButton
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => openEdit(holiday)}
                                                        aria-label="Edit"
                                                    >
                                                        <Pencil className="h-3.5 w-3.5" />
                                                    </ZoruButton>
                                                    <ZoruButton
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => handleDelete(holiday)}
                                                        disabled={deleteTransition}
                                                        aria-label="Delete"
                                                    >
                                                        <Trash2 className="h-3.5 w-3.5 text-red-500" />
                                                    </ZoruButton>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            ) : (
                                <tr>
                                    <td colSpan={7} className="h-24 text-center text-[13px] text-zoru-ink-muted">
                                        No holidays added yet. Click &quot;Add Holiday&quot; or &quot;Add Public Holidays&quot;.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </ZoruCard>

            <ZoruDialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) setEditing(null); }}>
                <ZoruDialogContent>
                    <ZoruDialogHeader>
                        <ZoruDialogTitle className="text-zoru-ink">
                            {editing ? 'Edit Holiday' : 'Add Holiday'}
                        </ZoruDialogTitle>
                        <ZoruDialogDescription className="text-zoru-ink-muted">
                            Fill in the holiday details. Name and date are required.
                        </ZoruDialogDescription>
                    </ZoruDialogHeader>
                    <form action={formAction} ref={formRef} className="space-y-4">
                        {editing?._id ? (
                            <input type="hidden" name="_id" value={editing._id.toString()} />
                        ) : null}
                        <input type="hidden" name="date" value={date?.toISOString() ?? ''} />
                        <input type="hidden" name="type" value={type} />
                        <input type="hidden" name="recurring" value={recurring} />

                        <div>
                            <ZoruLabel htmlFor="holiday-name" className="text-[13px] text-zoru-ink">
                                Holiday Name <span className="text-red-500">*</span>
                            </ZoruLabel>
                            <ZoruInput
                                id="holiday-name"
                                name="name"
                                required
                                defaultValue={editing?.name ?? ''}
                                placeholder="e.g. Diwali"
                                className="mt-1.5 h-10 rounded-lg border-zoru-line bg-zoru-bg text-[13px]"
                            />
                        </div>

                        <div>
                            <ZoruLabel className="text-[13px] text-zoru-ink">
                                Date <span className="text-red-500">*</span>
                            </ZoruLabel>
                            <div className="mt-1.5">
                                <ZoruDatePicker value={date} onChange={setDate} />
                            </div>
                        </div>

                        <div>
                            <ZoruLabel htmlFor="holiday-type" className="text-[13px] text-zoru-ink">
                                Type
                            </ZoruLabel>
                            <ZoruSelect value={type} onValueChange={setType}>
                                <ZoruSelectTrigger
                                    id="holiday-type"
                                    className="mt-1.5 h-10 rounded-lg border-zoru-line bg-zoru-bg text-[13px]"
                                >
                                    <ZoruSelectValue />
                                </ZoruSelectTrigger>
                                <ZoruSelectContent>
                                    <ZoruSelectItem value="national">National</ZoruSelectItem>
                                    <ZoruSelectItem value="regional">Regional</ZoruSelectItem>
                                    <ZoruSelectItem value="optional">Optional</ZoruSelectItem>
                                </ZoruSelectContent>
                            </ZoruSelect>
                        </div>

                        <div>
                            <ZoruLabel htmlFor="holiday-location" className="text-[13px] text-zoru-ink">
                                Location / State
                            </ZoruLabel>
                            <ZoruInput
                                id="holiday-location"
                                name="location"
                                defaultValue={(editing as any)?.location ?? ''}
                                placeholder="e.g. Maharashtra (leave blank for all)"
                                className="mt-1.5 h-10 rounded-lg border-zoru-line bg-zoru-bg text-[13px]"
                            />
                        </div>

                        <div>
                            <ZoruLabel htmlFor="holiday-recurring" className="text-[13px] text-zoru-ink">
                                Recurring Yearly
                            </ZoruLabel>
                            <ZoruSelect value={recurring} onValueChange={setRecurring}>
                                <ZoruSelectTrigger
                                    id="holiday-recurring"
                                    className="mt-1.5 h-10 rounded-lg border-zoru-line bg-zoru-bg text-[13px]"
                                >
                                    <ZoruSelectValue />
                                </ZoruSelectTrigger>
                                <ZoruSelectContent>
                                    <ZoruSelectItem value="true">Yes — repeats every year</ZoruSelectItem>
                                    <ZoruSelectItem value="false">No — one-time</ZoruSelectItem>
                                </ZoruSelectContent>
                            </ZoruSelect>
                        </div>

                        <ZoruDialogFooter>
                            <ZoruButton
                                type="button"
                                variant="outline"
                                onClick={() => setDialogOpen(false)}
                            >
                                <X className="h-3.5 w-3.5" />
                                Cancel
                            </ZoruButton>
                            <SaveButton label={editing ? 'Save Changes' : 'Add Holiday'} />
                        </ZoruDialogFooter>
                    </form>
                </ZoruDialogContent>
            </ZoruDialog>
        </div>
    );
}
