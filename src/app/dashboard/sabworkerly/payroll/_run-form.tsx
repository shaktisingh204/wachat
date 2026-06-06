'use client';

import React, { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

import { Button, Input, Label } from '@/components/sabcrm/20ui/compat';
import { runSabworkerlyPayroll } from '@/app/actions/sabworkerly.actions';

export function RunPayrollForm() {
    const router = useRouter();
    const [pending, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);
    const [message, setMessage] = useState<string | null>(null);

    const today = new Date();
    const monthAgo = new Date(today.getTime() - 30 * 86400 * 1000);
    const [start, setStart] = useState<string>(monthAgo.toISOString().slice(0, 10));
    const [end, setEnd] = useState<string>(today.toISOString().slice(0, 10));

    const onSubmit = (e: React.FormEvent<HTMLFormElement>): void => {
        e.preventDefault();
        setError(null);
        setMessage(null);
        startTransition(async () => {
            const res = await runSabworkerlyPayroll(
                new Date(start).toISOString(),
                new Date(end).toISOString(),
            );
            if (res.success) {
                setMessage(`Run created — ${res.lineCount} worker(s), total ${(res.totalMinor / 100).toFixed(2)}`);
                router.refresh();
            } else {
                setError(res.error);
            }
        });
    };

    return (
        <form onSubmit={onSubmit} className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {error && (
                <div className="md:col-span-3 rounded-md border border-zoru-line/40 bg-zoru-ink/10 p-2 text-sm text-zoru-ink-muted">
                    {error}
                </div>
            )}
            {message && (
                <div className="md:col-span-3 rounded-md border border-zoru-line/40 bg-zoru-ink/10 p-2 text-sm text-white">
                    {message}
                </div>
            )}
            <div className="flex flex-col gap-1">
                <Label htmlFor="pr-start">Period start</Label>
                <Input id="pr-start" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1">
                <Label htmlFor="pr-end">Period end</Label>
                <Input id="pr-end" type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
            </div>
            <div className="flex items-end">
                <Button type="submit" disabled={pending} className="w-full">
                    {pending ? 'Running…' : 'Run payroll'}
                </Button>
            </div>
        </form>
    );
}
