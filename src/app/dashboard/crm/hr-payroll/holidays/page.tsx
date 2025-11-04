
'use client';

import { useState, useEffect, useCallback, useTransition, useActionState, useRef } from 'react';
import { useFormStatus } from 'react-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { LoaderCircle, Plus, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getCrmHolidays, saveCrmHoliday, deleteCrmHoliday } from '@/app/actions/crm-hr.actions';
import type { WithId, CrmHoliday } from '@/lib/definitions';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DatePicker } from '@/components/ui/date-picker';
import { format } from 'date-fns';

const saveInitialState = { message: null, error: null };

function SaveButton() {
    const { pending } = useFormStatus();
    return <Button type="submit" disabled={pending}>{pending && <LoaderCircle className="mr-2 h-4 w-4 animate-spin"/>} Add Holiday</Button>;
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
        <div className="grid md:grid-cols-2 gap-8 items-start">
            <Card>
                <form action={formAction} ref={formRef}>
                    <input type="hidden" name="date" value={date?.toISOString()} />
                    <CardHeader><CardTitle>Add New Holiday</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2"><Label htmlFor="name">Holiday Name *</Label><Input id="name" name="name" required /></div>
                        <div className="space-y-2"><Label htmlFor="date">Date *</Label><DatePicker date={date} setDate={setDate} /></div>
                    </CardContent>
                    <CardFooter><SaveButton /></CardFooter>
                </form>
            </Card>
            <Card>
                <CardHeader>
                    <CardTitle>Holiday List</CardTitle>
                    <CardDescription>All official holidays for your organization.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="border rounded-md">
                        <Table>
                            <TableHeader><TableRow><TableHead>Holiday</TableHead><TableHead>Date</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                            <TableBody>
                                {isLoading ? <TableRow><TableCell colSpan={3} className="text-center h-24"><LoaderCircle className="mx-auto h-6 w-6 animate-spin"/></TableCell></TableRow>
                                : holidays.length > 0 ? holidays.map(holiday => (
                                    <TableRow key={holiday._id.toString()}>
                                        <TableCell className="font-medium">{holiday.name}</TableCell>
                                        <TableCell>{format(new Date(holiday.date), 'PPP')}</TableCell>
                                        <TableCell className="text-right"><DeleteButton holiday={holiday} onDeleted={fetchData} /></TableCell>
                                    </TableRow>
                                ))
                                : <TableRow><TableCell colSpan={3} className="text-center h-24">No holidays added yet.</TableCell></TableRow>}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
