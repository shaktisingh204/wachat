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
import { generateSabworkerlyInvoice } from '@/app/actions/sabworkerly.actions';

interface ClientOpt { id: string; name: string }

export function GenerateInvoiceForm({ clients }: { clients: ClientOpt[] }) {
    const router = useRouter();
    const [pending, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);
    const [message, setMessage] = useState<string | null>(null);

    const today = new Date();
    const monthAgo = new Date(today.getTime() - 30 * 86400 * 1000);
    const [clientId, setClientId] = useState<string>(clients[0]?.id ?? '');
    const [start, setStart] = useState<string>(monthAgo.toISOString().slice(0, 10));
    const [end, setEnd] = useState<string>(today.toISOString().slice(0, 10));

    if (clients.length === 0) {
        return (
            <p className="text-sm text-[color:var(--zoru-muted-fg)]">
                Add a client first to generate an invoice.
            </p>
        );
    }

    const onSubmit = (e: React.FormEvent<HTMLFormElement>): void => {
        e.preventDefault();
        setError(null);
        setMessage(null);
        startTransition(async () => {
            const res = await generateSabworkerlyInvoice(
                clientId,
                new Date(start).toISOString(),
                new Date(end).toISOString(),
            );
            if (res.success) {
                setMessage(`Generated invoice with ${res.lineCount} line(s) totalling ${(res.totalMinor / 100).toFixed(2)}`);
                router.refresh();
            } else {
                setError(res.error);
            }
        });
    };

    return (
        <form onSubmit={onSubmit} className="grid grid-cols-1 gap-3 md:grid-cols-4">
            {error && (
                <div className="md:col-span-4 rounded-md border border-red-500/40 bg-red-500/10 p-2 text-sm text-red-300">
                    {error}
                </div>
            )}
            {message && (
                <div className="md:col-span-4 rounded-md border border-emerald-500/40 bg-emerald-500/10 p-2 text-sm text-emerald-200">
                    {message}
                </div>
            )}
            <div className="flex flex-col gap-1">
                <Label>Client</Label>
                <Select value={clientId} onValueChange={setClientId}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                        {clients.map((c) => (
                            <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
            <div className="flex flex-col gap-1">
                <Label htmlFor="g-start">Period start</Label>
                <Input id="g-start" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1">
                <Label htmlFor="g-end">Period end</Label>
                <Input id="g-end" type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
            </div>
            <div className="flex items-end">
                <Button type="submit" disabled={pending} className="w-full">
                    {pending ? 'Generating…' : 'Generate'}
                </Button>
            </div>
        </form>
    );
}
