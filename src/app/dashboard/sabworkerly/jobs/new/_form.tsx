'use client';

import React, { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

import {
    Button,
    Card,
    CardContent,
    Input,
    Label,
    Textarea,
    Select,
    SelectTrigger,
    SelectValue,
    SelectContent,
    SelectItem,
} from '@/components/zoruui';
import { addSabworkerlyJob } from '@/app/actions/sabworkerly.actions';

interface ClientOpt { id: string; name: string }

export function JobForm({ clients, presetClientId }: { clients: ClientOpt[]; presetClientId: string | null }) {
    const router = useRouter();
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
                router.push(`/dashboard/sabworkerly/jobs/${res.id}`);
                router.refresh();
            } else {
                setError(res.error);
            }
        });
    };

    return (
        <Card>
            <CardContent className="p-6">
                <form onSubmit={onSubmit} className="flex flex-col gap-5">
                    {error && (
                        <div className="rounded-md border border-zoru-line/40 bg-zoru-ink/10 p-3 text-sm text-zoru-ink-muted">
                            {error}
                        </div>
                    )}
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <div className="flex flex-col gap-2 md:col-span-2">
                            <Label>Client</Label>
                            <Select value={clientId} onValueChange={setClientId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Pick a client" />
                                </SelectTrigger>
                                <SelectContent>
                                    {clients.map((c) => (
                                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex flex-col gap-2 md:col-span-2">
                            <Label htmlFor="title">Title</Label>
                            <Input id="title" required value={title} onChange={(e) => setTitle(e.target.value)} />
                        </div>
                        <div className="flex flex-col gap-2 md:col-span-2">
                            <Label htmlFor="description">Description</Label>
                            <Textarea
                                id="description"
                                rows={3}
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                            />
                        </div>
                        <div className="flex flex-col gap-2">
                            <Label htmlFor="shift">Shift pattern</Label>
                            <Input
                                id="shift"
                                placeholder="Mon–Fri 9–5"
                                value={shiftPattern}
                                onChange={(e) => setShiftPattern(e.target.value)}
                            />
                        </div>
                        <div className="flex flex-col gap-2">
                            <Label htmlFor="currency">Currency</Label>
                            <Input
                                id="currency"
                                value={currency}
                                onChange={(e) => setCurrency(e.target.value.toUpperCase())}
                                maxLength={3}
                            />
                        </div>
                        <div className="flex flex-col gap-2">
                            <Label htmlFor="charge">Client charge rate (per hour)</Label>
                            <Input
                                id="charge"
                                type="number"
                                step="0.01"
                                min="0"
                                value={chargeRate}
                                onChange={(e) => setChargeRate(e.target.value)}
                            />
                        </div>
                        <div className="flex flex-col gap-2">
                            <Label htmlFor="pay">Worker pay rate (per hour)</Label>
                            <Input
                                id="pay"
                                type="number"
                                step="0.01"
                                min="0"
                                value={payRate}
                                onChange={(e) => setPayRate(e.target.value)}
                            />
                        </div>
                        <div className="flex flex-col gap-2">
                            <Label htmlFor="start">Start date</Label>
                            <Input
                                id="start"
                                type="date"
                                required
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                            />
                        </div>
                        <div className="flex flex-col gap-2">
                            <Label htmlFor="end">End date (optional)</Label>
                            <Input
                                id="end"
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                            />
                        </div>
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                        <Button type="button" variant="ghost" onClick={() => router.back()} disabled={pending}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={pending}>
                            {pending ? 'Saving…' : 'Post job'}
                        </Button>
                    </div>
                </form>
            </CardContent>
        </Card>
    );
}
