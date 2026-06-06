'use client';

import React, { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Play } from 'lucide-react';

import {
    Button,
    Input,
    Field,
    Card,
    CardHeader,
    CardTitle,
    CardDescription,
    CardBody,
    Alert,
    useToast,
} from '@/components/sabcrm/20ui';
import { runSabworkerlyPayroll } from '@/app/actions/sabworkerly.actions';

export function RunPayrollForm() {
    const router = useRouter();
    const { toast } = useToast();
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
                const note = `Run created. ${res.lineCount} worker(s), total ${(res.totalMinor / 100).toFixed(2)}`;
                setMessage(note);
                toast.success(note);
                router.refresh();
            } else {
                setError(res.error);
                toast.error(res.error);
            }
        });
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Run payroll</CardTitle>
                <CardDescription>Pick a pay period, then generate the run for every worker.</CardDescription>
            </CardHeader>
            <CardBody>
                <form onSubmit={onSubmit} className="grid grid-cols-1 gap-3 md:grid-cols-3">
                    {error ? (
                        <Alert tone="danger" className="md:col-span-3">
                            {error}
                        </Alert>
                    ) : null}
                    {message ? (
                        <Alert tone="success" className="md:col-span-3">
                            {message}
                        </Alert>
                    ) : null}
                    <Field label="Period start">
                        <Input
                            type="date"
                            value={start}
                            onChange={(e) => setStart(e.target.value)}
                        />
                    </Field>
                    <Field label="Period end">
                        <Input
                            type="date"
                            value={end}
                            onChange={(e) => setEnd(e.target.value)}
                        />
                    </Field>
                    <div className="flex items-end">
                        <Button
                            type="submit"
                            variant="primary"
                            iconLeft={Play}
                            loading={pending}
                            block
                        >
                            {pending ? 'Running' : 'Run payroll'}
                        </Button>
                    </div>
                </form>
            </CardBody>
        </Card>
    );
}
