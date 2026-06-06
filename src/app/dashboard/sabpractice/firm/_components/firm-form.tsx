'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import { Button, Field, Input, Textarea, useToast } from '@/components/sabcrm/20ui';
import {
    createSabpracticeFirm,
    updateSabpracticeFirm,
} from '@/app/actions/sabpractice.actions';
import type { SabPracticeFirmDoc } from '@/lib/rust-client/sabpractice-firms';

interface Props {
    initial: SabPracticeFirmDoc | null;
}

export function FirmForm({ initial }: Props) {
    const router = useRouter();
    const { toast } = useToast();
    const [name, setName] = React.useState(initial?.name ?? '');
    const [registrationNo, setRegistrationNo] = React.useState(initial?.registrationNo ?? '');
    const [email, setEmail] = React.useState(initial?.email ?? '');
    const [phone, setPhone] = React.useState(initial?.phone ?? '');
    const [website, setWebsite] = React.useState(initial?.website ?? '');
    const [address, setAddress] = React.useState(initial?.address ?? '');
    const [services, setServices] = React.useState((initial?.services ?? []).join(', '));
    const [pending, start] = React.useTransition();

    function submit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        if (!name.trim()) return;
        start(async () => {
            const payload = {
                name: name.trim(),
                registrationNo: registrationNo || undefined,
                email: email || undefined,
                phone: phone || undefined,
                website: website || undefined,
                address: address || undefined,
                services: services
                    .split(',')
                    .map((s) => s.trim())
                    .filter(Boolean),
            };
            try {
                if (initial?._id) {
                    await updateSabpracticeFirm(initial._id, payload);
                    toast.success('Firm updated');
                } else {
                    await createSabpracticeFirm(payload);
                    toast.success('Firm created');
                }
                router.refresh();
            } catch {
                toast.error('Could not save the firm. Please try again.');
            }
        });
    }

    return (
        <form className="space-y-3" onSubmit={submit}>
            <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Firm name" required>
                    <Input value={name} onChange={(e) => setName(e.target.value)} />
                </Field>
                <Field label="Registration no">
                    <Input
                        value={registrationNo}
                        onChange={(e) => setRegistrationNo(e.target.value)}
                    />
                </Field>
                <Field label="Email">
                    <Input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                    />
                </Field>
                <Field label="Phone">
                    <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
                </Field>
                <Field label="Website" className="sm:col-span-2">
                    <Input value={website} onChange={(e) => setWebsite(e.target.value)} />
                </Field>
                <Field label="Address" className="sm:col-span-2">
                    <Textarea
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        rows={2}
                    />
                </Field>
                <Field
                    label="Services (comma-separated)"
                    help="Separate each service with a comma."
                    className="sm:col-span-2"
                >
                    <Input
                        value={services}
                        onChange={(e) => setServices(e.target.value)}
                        placeholder="Bookkeeping, Tax filing, Audit"
                    />
                </Field>
            </div>
            <Button
                type="submit"
                variant="primary"
                loading={pending}
                disabled={!name.trim()}
            >
                {initial ? 'Save changes' : 'Create firm'}
            </Button>
        </form>
    );
}
