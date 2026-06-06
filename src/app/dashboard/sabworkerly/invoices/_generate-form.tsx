'use client';

import React, { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { FileText } from 'lucide-react';

import {
    Button,
    Field,
    Input,
    EmptyState,
    Select,
    SelectTrigger,
    SelectValue,
    SelectContent,
    SelectItem,
    useToast,
} from '@/components/sabcrm/20ui';
import { generateSabworkerlyInvoice } from '@/app/actions/sabworkerly.actions';

interface ClientOpt { id: string; name: string }

export function GenerateInvoiceForm({ clients }: { clients: ClientOpt[] }) {
    const router = useRouter();
    const { toast } = useToast();
    const [pending, startTransition] = useTransition();

    const today = new Date();
    const monthAgo = new Date(today.getTime() - 30 * 86400 * 1000);
    const [clientId, setClientId] = useState<string>(clients[0]?.id ?? '');
    const [start, setStart] = useState<string>(monthAgo.toISOString().slice(0, 10));
    const [end, setEnd] = useState<string>(today.toISOString().slice(0, 10));

    if (clients.length === 0) {
        return (
            <EmptyState
                icon={FileText}
                title="No clients yet"
                description="Add a client first to generate an invoice."
            />
        );
    }

    const onSubmit = (e: React.FormEvent<HTMLFormElement>): void => {
        e.preventDefault();
        startTransition(async () => {
            const res = await generateSabworkerlyInvoice(
                clientId,
                new Date(start).toISOString(),
                new Date(end).toISOString(),
            );
            if (res.success) {
                toast.success(
                    `Generated invoice with ${res.lineCount} line(s) totalling ${(res.totalMinor / 100).toFixed(2)}`,
                );
                router.refresh();
            } else {
                toast.error(res.error);
            }
        });
    };

    return (
        <form onSubmit={onSubmit} className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <Field label="Client">
                <Select value={clientId} onValueChange={setClientId}>
                    <SelectTrigger aria-label="Client">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {clients.map((c) => (
                            <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </Field>
            <Field label="Period start">
                <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
            </Field>
            <Field label="Period end">
                <Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
            </Field>
            <div className="flex items-end">
                <Button type="submit" variant="primary" loading={pending} block>
                    {pending ? 'Generating' : 'Generate'}
                </Button>
            </div>
        </form>
    );
}
