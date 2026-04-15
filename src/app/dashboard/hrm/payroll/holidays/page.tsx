'use client';

import { useState, useEffect, useCallback, useTransition, useActionState, useRef } from 'react';
import { useFormStatus } from 'react-dom';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { LoaderCircle, Trash2, CalendarHeart } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getCrmHolidays, saveCrmHoliday, deleteCrmHoliday } from '@/app/actions/crm-hr.actions';
import type { WithId, CrmHoliday } from '@/lib/definitions';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DatePicker } from '@/components/ui/date-picker';
import { format } from 'date-fns';

import { ClayCard, ClayButton } from '@/components/clay';
import { CrmPageHeader } from '@/app/dashboard/crm/_components/crm-page-header';

const saveInitialState: any = { message: null, error: null };

function SaveButton() {
    const { pending } = useFormStatus();
    return (
        <ClayButton
            type="submit"
            variant="obsidian"
            disabled={pending}
            leading={pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : undefined}
        >
            Add Holiday
        </ClayButton>
    );
}

function DeleteButton({ holiday, onDeleted }: { holiday: WithId<CrmHoliday>, onDeleted: () => void }) {
    const [isPending, startTransition] = useTransition();
    const { toast } = useToast();
    const handleDelete = () => {
        startTransition(async () => {
            const result = await deleteCrmHoliday(holiday._id.toString());
            if (result.success) {
                toast({ title: 'Success', description: 'Holiday deleted.' });
                onDeleted();
            } else {
                toast({ title: 'Error', description: result.error, variant: 'destructive' });
            }
        });
    }
    return <Button variant="ghost" size="icon" onClick={handleDelete} disabled={isPending}>{isPending ? <LoaderCircle className="h-4 w-4 animate-spin"/> : <Trash2 className="h-4 w-4 text-destructive"/>}</Button>;
}

export default function HolidaysPage() {
    const [holidays, setHolidays] = useState<WithId<CrmHoliday>[]>([]);
    const [isLoading, startLoading] = useTransition();
    const [saveState, formAction] = useActionState(saveCrmHoliday, saveInitialState);
    const { toast } = useToast();
    const formRef = useRef<HTMLFormElement>(null);
    const [date, setDate] = useState<Date>();

    const fetchData = useCallback(() => {
        startLoading(async () => {
            const data = await getCrmHolidays();
            setHolidays(data);
        });
    }, []);

    useEffect(() => { fetchData() }, [fetchData]);

    useEffect(() => {
        if (saveState.message) {
            toast({ title: 'Success', description: saveState.message });
            fetchData();
            formRef.current?.reset();
            setDate(undefined);
        }
        if (saveState.error) {
            toast({ title: 'Error', description: saveState.error, variant: 'destructive' });
        }
    }, [saveState, toast, fetchData]);

    return (
        <div className="flex w-full flex-col gap-6">
            <CrmPageHeader
                title="Holidays"
                subtitle="Maintain your organization's official holiday calendar."
                icon={CalendarHeart}
            />

            <div className="grid items-start gap-6 md:grid-cols-2">
                <ClayCard>
                    <form action={formAction} ref={formRef}>
                        <input type="hidden" name="date" value={date?.toISOString()} />
                        <div className="mb-4">
                            <h2 className="text-[16px] font-semibold text-clay-ink">Add New Holiday</h2>
                        </div>
                        <div className="space-y-4">
                            <div className="space-y-2"><Label htmlFor="name" className="text-[13px] text-clay-ink">Holiday Name *</Label><Input id="name" name="name" required className="h-10 rounded-clay-md border-clay-border bg-clay-surface text-[13px]" /></div>
                            <div className="space-y-2"><Label htmlFor="date" className="text-[13px] text-clay-ink">Date *</Label><DatePicker date={date} setDate={setDate} /></div>
                        </div>
                        <div className="mt-6"><SaveButton /></div>
                    </form>
                </ClayCard>
                <ClayCard>
                    <div className="mb-4">
                        <h2 className="text-[16px] font-semibold text-clay-ink">Holiday List</h2>
                        <p className="mt-0.5 text-[12.5px] text-clay-ink-muted">All official holidays for your organization.</p>
                    </div>
                    <div className="overflow-x-auto rounded-clay-md border border-clay-border">
                        <Table>
                            <TableHeader><TableRow className="border-clay-border hover:bg-transparent"><TableHead className="text-clay-ink-muted">Holiday</TableHead><TableHead className="text-clay-ink-muted">Date</TableHead><TableHead className="text-right text-clay-ink-muted">Actions</TableHead></TableRow></TableHeader>
                            <TableBody>
                                {isLoading ? <TableRow className="border-clay-border"><TableCell colSpan={3} className="h-24 text-center"><LoaderCircle className="mx-auto h-6 w-6 animate-spin text-clay-ink-muted"/></TableCell></TableRow>
                                : holidays.length > 0 ? holidays.map(holiday => (
                                    <TableRow key={holiday._id.toString()} className="border-clay-border">
                                        <TableCell className="text-[13px] font-medium text-clay-ink">{holiday.name}</TableCell>
                                        <TableCell className="text-[13px] text-clay-ink">{format(new Date(holiday.date), 'PPP')}</TableCell>
                                        <TableCell className="text-right"><DeleteButton holiday={holiday} onDeleted={fetchData} /></TableCell>
                                    </TableRow>
                                ))
                                : <TableRow className="border-clay-border"><TableCell colSpan={3} className="h-24 text-center text-[13px] text-clay-ink-muted">No holidays added yet.</TableCell></TableRow>}
                            </TableBody>
                        </Table>
                    </div>
                </ClayCard>
            </div>
        </div>
    );
}
