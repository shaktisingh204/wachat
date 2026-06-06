'use client';

import React, { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

import { Button, Card, CardContent, Input, Label, Textarea } from '@/components/sabcrm/20ui/compat';
import { addSabworkerlyClient } from '@/app/actions/sabworkerly.actions';

export function ClientForm() {
    const router = useRouter();
    const [pending, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);

    const [name, setName] = useState('');
    const [contactName, setContactName] = useState('');
    const [contactEmail, setContactEmail] = useState('');
    const [contactPhone, setContactPhone] = useState('');
    const [terms, setTerms] = useState<string>('30');
    const [address, setAddress] = useState('');

    const onSubmit = (e: React.FormEvent<HTMLFormElement>): void => {
        e.preventDefault();
        setError(null);
        startTransition(async () => {
            const res = await addSabworkerlyClient({
                name,
                contactName: contactName || undefined,
                contactEmail: contactEmail || undefined,
                contactPhone: contactPhone || undefined,
                paymentTermsDays: Number(terms) || 30,
                billingAddressJson: address ? { freeform: address } : undefined,
            });
            if (res.success) {
                router.push(`/dashboard/sabworkerly/clients/${res.id}`);
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
                        <div className="rounded-md border border-[var(--st-border)]/40 bg-[var(--st-text)]/10 p-3 text-sm text-[var(--st-text-secondary)]">
                            {error}
                        </div>
                    )}
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <div className="flex flex-col gap-2">
                            <Label htmlFor="name">Business name</Label>
                            <Input id="name" required value={name} onChange={(e) => setName(e.target.value)} />
                        </div>
                        <div className="flex flex-col gap-2">
                            <Label htmlFor="terms">Payment terms (days)</Label>
                            <Input
                                id="terms"
                                type="number"
                                min="0"
                                value={terms}
                                onChange={(e) => setTerms(e.target.value)}
                            />
                        </div>
                        <div className="flex flex-col gap-2">
                            <Label htmlFor="contactName">Primary contact</Label>
                            <Input id="contactName" value={contactName} onChange={(e) => setContactName(e.target.value)} />
                        </div>
                        <div className="flex flex-col gap-2">
                            <Label htmlFor="contactEmail">Contact email</Label>
                            <Input
                                id="contactEmail"
                                type="email"
                                value={contactEmail}
                                onChange={(e) => setContactEmail(e.target.value)}
                            />
                        </div>
                        <div className="flex flex-col gap-2">
                            <Label htmlFor="contactPhone">Contact phone</Label>
                            <Input id="contactPhone" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} />
                        </div>
                    </div>
                    <div className="flex flex-col gap-2">
                        <Label htmlFor="address">Billing address</Label>
                        <Textarea
                            id="address"
                            rows={3}
                            value={address}
                            onChange={(e) => setAddress(e.target.value)}
                        />
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                        <Button type="button" variant="ghost" onClick={() => router.back()} disabled={pending}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={pending}>
                            {pending ? 'Saving…' : 'Create client'}
                        </Button>
                    </div>
                </form>
            </CardContent>
        </Card>
    );
}
