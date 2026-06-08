'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';

import { Button, Checkbox, Field, Input, useToast } from '@/components/sabcrm/20ui';
import { logSabpracticeTime } from '@/app/actions/sabpractice.actions';

export function LogTimeForm() {
    const router = useRouter();
    const { toast } = useToast();
    const [taskId, setTaskId] = React.useState('');
    const [hours, setHours] = React.useState('');
    const [date, setDate] = React.useState(new Date().toISOString().slice(0, 10));
    const [notes, setNotes] = React.useState('');
    const [billable, setBillable] = React.useState(true);
    const [touched, setTouched] = React.useState(false);
    const [pending, start] = React.useTransition();

    const taskError = touched && !taskId.trim() ? 'A task ID is required.' : undefined;
    const hoursError = touched && !hours ? 'Enter the hours worked.' : undefined;

    return (
        <form
            className="grid gap-3 sm:grid-cols-6"
            onSubmit={(e) => {
                e.preventDefault();
                setTouched(true);
                if (!taskId.trim() || !hours) return;
                start(async () => {
                    try {
                        await logSabpracticeTime({
                            taskId: taskId.trim(),
                            loggerUserId: '',
                            date: new Date(date).toISOString(),
                            hours: Number(hours),
                            notes: notes || undefined,
                            billable,
                        });
                        setHours('');
                        setNotes('');
                        setTouched(false);
                        toast.success('Time logged');
                        router.refresh();
                    } catch {
                        toast.error('Could not log the time. Please try again.');
                    }
                });
            }}
        >
            <Field label="Task ID" required error={taskError} className="sm:col-span-2">
                <Input
                    value={taskId}
                    onChange={(e) => setTaskId(e.target.value)}
                    placeholder="Paste the task ID"
                />
            </Field>
            <Field label="Date">
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </Field>
            <Field label="Hours" required error={hoursError}>
                <Input
                    type="number"
                    step="0.25"
                    min="0.25"
                    value={hours}
                    onChange={(e) => setHours(e.target.value)}
                    placeholder="1.5"
                />
            </Field>
            <Field label="Notes" className="sm:col-span-2">
                <Input
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Reconciled March ledger"
                />
            </Field>
            <div className="flex items-center justify-between gap-3 sm:col-span-6">
                <Checkbox
                    label="Billable"
                    checked={billable}
                    onChange={(e) => setBillable(e.target.checked)}
                />
                <Button type="submit" variant="primary" iconLeft={Plus} loading={pending}>
                    Log time
                </Button>
            </div>
        </form>
    );
}
