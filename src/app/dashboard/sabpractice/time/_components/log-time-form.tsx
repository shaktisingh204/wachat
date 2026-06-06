'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import { Button, Input, Label } from '@/components/sabcrm/20ui';
import { logSabpracticeTime } from '@/app/actions/sabpractice.actions';

export function LogTimeForm() {
    const router = useRouter();
    const [taskId, setTaskId] = React.useState('');
    const [hours, setHours] = React.useState('');
    const [date, setDate] = React.useState(new Date().toISOString().slice(0, 10));
    const [notes, setNotes] = React.useState('');
    const [billable, setBillable] = React.useState(true);
    const [pending, start] = React.useTransition();

    return (
        <form
            className="grid gap-3 sm:grid-cols-6"
            onSubmit={(e) => {
                e.preventDefault();
                if (!taskId.trim() || !hours) return;
                start(async () => {
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
                    router.refresh();
                });
            }}
        >
            <div className="sm:col-span-2 space-y-1">
                <Label htmlFor="sp-task">Task ID</Label>
                <Input
                    id="sp-task"
                    value={taskId}
                    onChange={(e) => setTaskId(e.target.value)}
                    placeholder="task _id"
                />
            </div>
            <div className="space-y-1">
                <Label htmlFor="sp-date">Date</Label>
                <Input
                    id="sp-date"
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                />
            </div>
            <div className="space-y-1">
                <Label htmlFor="sp-hours">Hours</Label>
                <Input
                    id="sp-hours"
                    type="number"
                    step="0.25"
                    min="0.25"
                    value={hours}
                    onChange={(e) => setHours(e.target.value)}
                />
            </div>
            <div className="sm:col-span-2 space-y-1">
                <Label htmlFor="sp-notes">Notes</Label>
                <Input
                    id="sp-notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="what you did"
                />
            </div>
            <div className="sm:col-span-6 flex items-center justify-between gap-3">
                <label className="flex items-center gap-2 text-sm">
                    <input
                        type="checkbox"
                        checked={billable}
                        onChange={(e) => setBillable(e.target.checked)}
                    />
                    Billable
                </label>
                <Button type="submit" disabled={pending || !taskId.trim() || !hours}>
                    {pending ? 'Logging…' : 'Log time'}
                </Button>
            </div>
        </form>
    );
}
