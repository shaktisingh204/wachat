'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import { Button, Input, Label, Textarea } from '@/components/zoruui';
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
    const [name, setName] = React.useState(initial?.name ?? '');
    const [registrationNo, setRegistrationNo] = React.useState(initial?.registrationNo ?? '');
    const [email, setEmail] = React.useState(initial?.email ?? '');
    const [phone, setPhone] = React.useState(initial?.phone ?? '');
    const [website, setWebsite] = React.useState(initial?.website ?? '');
    const [address, setAddress] = React.useState(initial?.address ?? '');
    const [services, setServices] = React.useState((initial?.services ?? []).join(', '));
    const [pending, start] = React.useTransition();

    function submit() {
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
            if (initial?._id) {
                await updateSabpracticeFirm(initial._id, payload);
            } else {
                await createSabpracticeFirm(payload);
            }
            router.refresh();
        });
    }

    return (
        <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                    <Label>Firm name</Label>
                    <Input value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div className="space-y-1">
                    <Label>Registration no</Label>
                    <Input
                        value={registrationNo}
                        onChange={(e) => setRegistrationNo(e.target.value)}
                    />
                </div>
                <div className="space-y-1">
                    <Label>Email</Label>
                    <Input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                    />
                </div>
                <div className="space-y-1">
                    <Label>Phone</Label>
                    <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
                </div>
                <div className="space-y-1 sm:col-span-2">
                    <Label>Website</Label>
                    <Input value={website} onChange={(e) => setWebsite(e.target.value)} />
                </div>
                <div className="space-y-1 sm:col-span-2">
                    <Label>Address</Label>
                    <Textarea
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        rows={2}
                    />
                </div>
                <div className="space-y-1 sm:col-span-2">
                    <Label>Services (comma-separated)</Label>
                    <Input
                        value={services}
                        onChange={(e) => setServices(e.target.value)}
                        placeholder="Bookkeeping, Tax filing, Audit"
                    />
                </div>
            </div>
            <Button onClick={submit} disabled={pending || !name.trim()}>
                {pending ? 'Saving…' : initial ? 'Save changes' : 'Create firm'}
            </Button>
        </div>
    );
}
