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
    useToast,
} from '@/components/sabcrm/20ui';
import { addSabworkerlyClient } from '@/app/actions/sabworkerly.actions';

export function ClientForm() {
    const router = useRouter();
    const { toast } = useToast();
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
                toast.success('Client created');
                router.push(`/dashboard/sabworkerly/clients/${res.id}`);
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
                        <Alert tone="danger" title="Could not create client" onClose={() => setError(null)}>
                            {error}
                        </Alert>
                    ) : null}
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <Field label="Business name" required>
                            <Input value={name} onChange={(e) => setName(e.target.value)} />
                        </Field>
                        <Field label="Payment terms (days)">
                            <Input
                                type="number"
                                min="0"
                                value={terms}
                                onChange={(e) => setTerms(e.target.value)}
                            />
                        </Field>
                        <Field label="Primary contact">
                            <Input value={contactName} onChange={(e) => setContactName(e.target.value)} />
                        </Field>
                        <Field label="Contact email">
                            <Input
                                type="email"
                                value={contactEmail}
                                onChange={(e) => setContactEmail(e.target.value)}
                            />
                        </Field>
                        <Field label="Contact phone">
                            <Input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} />
                        </Field>
                    </div>
                    <Field label="Billing address">
                        <Textarea
                            rows={3}
                            value={address}
                            onChange={(e) => setAddress(e.target.value)}
                        />
                    </Field>
                    <div className="flex justify-end gap-2 pt-2">
                        <Button type="button" variant="ghost" onClick={() => router.back()} disabled={pending}>
                            Cancel
                        </Button>
                        <Button type="submit" variant="primary" loading={pending}>
                            Create client
                        </Button>
                    </div>
                </form>
            </CardBody>
        </Card>
    );
}
