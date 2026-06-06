'use client';

import React, { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

import {
    Button,
    Input,
    Field,
    Alert,
    EmptyState,
    Select,
    SelectTrigger,
    SelectValue,
    SelectContent,
    SelectItem,
    useToast,
} from '@/components/sabcrm/20ui';
import { UserPlus } from 'lucide-react';
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
    const { toast } = useToast();
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
                toast.success('Worker placed');
                router.refresh();
            } else {
                setError(res.error);
                toast.error(res.error);
            }
        });
    };

    if (workers.length === 0) {
        return (
            <EmptyState
                icon={UserPlus}
                title="No active workers yet"
                description="Add a worker first, then place them on this job."
                size="sm"
            />
        );
    }

    return (
        <form onSubmit={onSubmit} className="grid grid-cols-1 gap-3 md:grid-cols-5">
            {error && (
                <div className="md:col-span-5">
                    <Alert tone="danger">{error}</Alert>
                </div>
            )}
            <div className="md:col-span-2">
                <Field label="Worker">
                    <Select value={workerId} onValueChange={setWorkerId}>
                        <SelectTrigger aria-label="Worker">
                            <SelectValue placeholder="Pick a worker" />
                        </SelectTrigger>
                        <SelectContent>
                            {workers.map((w) => (
                                <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </Field>
            </div>
            <Field label="Charge">
                <Input type="number" step="0.01" value={charge} onChange={(e) => setCharge(e.target.value)} />
            </Field>
            <Field label="Pay">
                <Input type="number" step="0.01" value={pay} onChange={(e) => setPay(e.target.value)} />
            </Field>
            <Field label="Start">
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </Field>
            <div className="md:col-span-5 flex justify-end">
                <Button type="submit" variant="primary" loading={pending}>
                    {pending ? 'Placing' : 'Place worker'}
                </Button>
            </div>
        </form>
    );
}
