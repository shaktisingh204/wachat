'use client';

import React, { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

import {
    Alert,
    Button,
    Card,
    CardBody,
    Field,
    Input,
    Textarea,
    Select,
    SelectTrigger,
    SelectValue,
    SelectContent,
    SelectItem,
    useToast,
} from '@/components/sabcrm/20ui';
import { addSabworkerlyJob } from '@/app/actions/sabworkerly.actions';

interface ClientOpt { id: string; name: string }

export function JobForm({ clients, presetClientId }: { clients: ClientOpt[]; presetClientId: string | null }) {
    const router = useRouter();
    const { toast } = useToast();
    const [pending, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);

    const [clientId, setClientId] = useState<string>(presetClientId ?? clients[0]?.id ?? '');
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [shiftPattern, setShiftPattern] = useState('');
    const [chargeRate, setChargeRate] = useState('40.00');
    const [payRate, setPayRate] = useState('25.00');
    const [currency, setCurrency] = useState('USD');
    const [startDate, setStartDate] = useState<string>(() =>
        new Date().toISOString().slice(0, 10),
    );
    const [endDate, setEndDate] = useState<string>('');

    const onSubmit = (e: React.FormEvent<HTMLFormElement>): void => {
        e.preventDefault();
        setError(null);
        if (!clientId) {
            setError('Pick a client');
            toast.error('Pick a client');
            return;
        }
        startTransition(async () => {
            const res = await addSabworkerlyJob({
                clientId,
                title,
                description: description || undefined,
                shiftPattern: shiftPattern || undefined,
                hourlyChargeRateMinor: Math.round(Number(chargeRate) * 100),
                hourlyPayRateMinor: Math.round(Number(payRate) * 100),
                currency,
                startDate: new Date(startDate).toISOString(),
                endDate: endDate ? new Date(endDate).toISOString() : undefined,
            });
            if (res.success) {
                toast.success('Job posted');
                router.push(`/dashboard/sabworkerly/jobs/${res.id}`);
                router.refresh();
            } else {
                setError(res.error);
                toast.error(res.error);
            }
        });
    };

    return (
        <Card>
            <CardBody className="p-6">
                <form onSubmit={onSubmit} className="flex flex-col gap-5">
                    {error ? (
                        <Alert tone="danger" title="Could not post job">
                            {error}
                        </Alert>
                    ) : null}
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <Field label="Client" className="md:col-span-2">
                            <Select value={clientId} onValueChange={setClientId}>
                                <SelectTrigger aria-label="Client">
                                    <SelectValue placeholder="Pick a client" />
                                </SelectTrigger>
                                <SelectContent>
                                    {clients.map((c) => (
                                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </Field>
                        <Field label="Title" required className="md:col-span-2">
                            <Input required value={title} onChange={(e) => setTitle(e.target.value)} />
                        </Field>
                        <Field label="Description" className="md:col-span-2">
                            <Textarea
                                rows={3}
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                            />
                        </Field>
                        <Field label="Shift pattern">
                            <Input
                                placeholder="Mon-Fri 9-5"
                                value={shiftPattern}
                                onChange={(e) => setShiftPattern(e.target.value)}
                            />
                        </Field>
                        <Field label="Currency">
                            <Input
                                value={currency}
                                onChange={(e) => setCurrency(e.target.value.toUpperCase())}
                                maxLength={3}
                            />
                        </Field>
                        <Field label="Client charge rate (per hour)">
                            <Input
                                type="number"
                                step="0.01"
                                min="0"
                                value={chargeRate}
                                onChange={(e) => setChargeRate(e.target.value)}
                            />
                        </Field>
                        <Field label="Worker pay rate (per hour)">
                            <Input
                                type="number"
                                step="0.01"
                                min="0"
                                value={payRate}
                                onChange={(e) => setPayRate(e.target.value)}
                            />
                        </Field>
                        <Field label="Start date" required>
                            <Input
                                type="date"
                                required
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                            />
                        </Field>
                        <Field label="End date (optional)">
                            <Input
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                            />
                        </Field>
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                        <Button type="button" variant="ghost" onClick={() => router.back()} disabled={pending}>
                            Cancel
                        </Button>
                        <Button type="submit" variant="primary" loading={pending} disabled={pending}>
                            {pending ? 'Saving...' : 'Post job'}
                        </Button>
                    </div>
                </form>
            </CardBody>
        </Card>
    );
}
