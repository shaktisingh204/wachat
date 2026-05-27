'use client';

import React, { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

import {
    Button,
    Input,
    Label,
    Select,
    SelectTrigger,
    SelectValue,
    SelectContent,
    SelectItem,
} from '@/components/zoruui';
import { addSabworkerlyPlacement } from '@/app/actions/sabworkerly.actions';

interface WorkerOpt { id: string; name: string }

export function PlaceWorkerForm({
    jobId, workers, defaultChargeMinor, defaultPayMinor, defaultStartDate,
}: {
    jobId: string;
    workers: WorkerOpt[];
    defaultChargeMinor: number;
    defaultPayMinor: number;
    defaultStartDate: string;
}) {
    const router = useRouter();
    const [pending, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);
    const [workerId, setWorkerId] = useState<string>(workers[0]?.id ?? '');
    const [charge, setCharge] = useState<string>((defaultChargeMinor / 100).toFixed(2));
    const [pay, setPay] = useState<string>((defaultPayMinor / 100).toFixed(2));
    const [startDate, setStartDate] = useState<string>(defaultStartDate);

    const onSubmit = (e: React.FormEvent<HTMLFormElement>): void => {
        e.preventDefault();
        setError(null);
        if (!workerId) {
            setError('Pick a worker');
            return;
        }
        startTransition(async () => {
            const res = await addSabworkerlyPlacement({
                jobId,
                workerId,
                startDate: new Date(startDate).toISOString(),
                hourlyChargeRateMinor: Math.round(Number(charge) * 100),
                hourlyPayRateMinor: Math.round(Number(pay) * 100),
            });
            if (res.success) {
                router.refresh();
            } else {
                setError(res.error);
            }
        });
    };

    if (workers.length === 0) {
        return (
            <p className="text-sm text-[color:var(--zoru-muted-fg)]">
                No active workers yet — add one first.
            </p>
        );
    }

    return (
        <form onSubmit={onSubmit} className="grid grid-cols-1 gap-3 md:grid-cols-5">
            {error && (
                <div className="md:col-span-5 rounded-md border border-zoru-line/40 bg-zoru-ink/10 p-2 text-sm text-zoru-ink-muted">
                    {error}
                </div>
            )}
            <div className="flex flex-col gap-1 md:col-span-2">
                <Label>Worker</Label>
                <Select value={workerId} onValueChange={setWorkerId}>
                    <SelectTrigger>
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {workers.map((w) => (
                            <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
            <div className="flex flex-col gap-1">
                <Label htmlFor="pl-charge">Charge</Label>
                <Input id="pl-charge" type="number" step="0.01" value={charge} onChange={(e) => setCharge(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1">
                <Label htmlFor="pl-pay">Pay</Label>
                <Input id="pl-pay" type="number" step="0.01" value={pay} onChange={(e) => setPay(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1">
                <Label htmlFor="pl-start">Start</Label>
                <Input id="pl-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="md:col-span-5 flex justify-end">
                <Button type="submit" disabled={pending}>
                    {pending ? 'Placing…' : 'Place worker'}
                </Button>
            </div>
        </form>
    );
}
