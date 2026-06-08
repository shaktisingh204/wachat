'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Mail, Phone } from 'lucide-react';

import {
    Button,
    Field,
    Input,
    Separator,
    Textarea,
    useToast,
} from '@/components/sabcrm/20ui';
import {
    createSabpracticeFirm,
    updateSabpracticeFirm,
} from '@/app/actions/sabpractice.actions';
import type { SabPracticeFirmDoc } from '@/lib/rust-client/sabpractice-firms';

interface Props {
    initial: SabPracticeFirmDoc | null;
}

function GroupLabel({ children }: { children: React.ReactNode }) {
    return (
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--st-text-secondary)]">
            {children}
        </p>
    );
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
    const [touched, setTouched] = React.useState(false);
    const [pending, start] = React.useTransition();

    const nameError = touched && !name.trim() ? 'A firm name is required.' : undefined;

    function submit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setTouched(true);
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
                setTouched(false);
                router.refresh();
            } catch {
                toast.error('Could not save the firm. Please try again.');
            }
        });
    }

    return (
        <form className="space-y-6" onSubmit={submit}>
            <div className="space-y-3">
                <GroupLabel>Identity</GroupLabel>
                <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Firm name" required error={nameError}>
                        <Input
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Mehta & Associates"
                        />
                    </Field>
                    <Field label="Registration number">
                        <Input
                            value={registrationNo}
                            onChange={(e) => setRegistrationNo(e.target.value)}
                            placeholder="ICAI-123456"
                        />
                    </Field>
                </div>
            </div>

            <Separator />

            <div className="space-y-3">
                <GroupLabel>Contact</GroupLabel>
                <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Email">
                        <Input
                            type="email"
                            iconLeft={Mail}
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="hello@firm.example"
                        />
                    </Field>
                    <Field label="Phone">
                        <Input
                            iconLeft={Phone}
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            placeholder="+91 22 4000 1234"
                        />
                    </Field>
                    <Field label="Website" className="sm:col-span-2">
                        <Input
                            prefix="https://"
                            value={website}
                            onChange={(e) => setWebsite(e.target.value)}
                            placeholder="firm.example"
                        />
                    </Field>
                    <Field label="Address" className="sm:col-span-2">
                        <Textarea
                            value={address}
                            onChange={(e) => setAddress(e.target.value)}
                            rows={2}
                            placeholder="14 Marine Drive, Mumbai 400020"
                        />
                    </Field>
                </div>
            </div>

            <Separator />

            <div className="space-y-3">
                <GroupLabel>Services</GroupLabel>
                <Field
                    label="Services offered"
                    help="Separate each service with a comma."
                >
                    <Input
                        value={services}
                        onChange={(e) => setServices(e.target.value)}
                        placeholder="Bookkeeping, Tax filing, Audit"
                    />
                </Field>
            </div>

            <div className="flex justify-end border-t border-[var(--st-border-light)] pt-4">
                <Button type="submit" variant="primary" loading={pending}>
                    {initial ? 'Save changes' : 'Create firm'}
                </Button>
            </div>
        </form>
    );
}
