'use client';

import {
    Alert,
    AlertDescription,
    AlertTitle,
    Button,
    Field,
    Input,
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/sabcrm/20ui';

import * as React from 'react';

import { saveOnboardingProfile } from '@/app/actions/onboarding-flow.actions';

type ProfileData = {
    companyName?: string;
    role?: string;
    phone?: string;
    country?: string;
    website?: string;
};

interface ProfileStepProps {
    defaultName?: string;
    initial: ProfileData | null;
    onComplete: (patch: ProfileData) => void;
}

const ROLES = [
    'Founder / CEO',
    'Marketing',
    'Sales',
    'Customer Support',
    'Operations',
    'Engineering',
    'Agency / Consultant',
    'Other',
];

const COUNTRIES = [
    'India',
    'United States',
    'United Kingdom',
    'Canada',
    'Australia',
    'United Arab Emirates',
    'Singapore',
    'Germany',
    'France',
    'Brazil',
    'Other',
];

export function ProfileStep({
    defaultName,
    initial,
    onComplete,
}: ProfileStepProps) {
    const [isPending, startTransition] = React.useTransition();
    const [error, setError] = React.useState<string | null>(null);
    const [fullName, setFullName] = React.useState(defaultName ?? '');
    const [companyName, setCompanyName] = React.useState(
        initial?.companyName ?? ''
    );
    const [role, setRole] = React.useState(initial?.role ?? '');
    const [country, setCountry] = React.useState(initial?.country ?? '');
    const [phone, setPhone] = React.useState(initial?.phone ?? '');
    const [website, setWebsite] = React.useState(initial?.website ?? '');

    const submit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setError(null);
        if (!fullName.trim() || !companyName.trim()) {
            setError('Full name and company name are required.');
            return;
        }
        if (!role || !country) {
            setError('Please pick your role and country.');
            return;
        }
        startTransition(async () => {
            const res = await saveOnboardingProfile({
                fullName: fullName.trim(),
                companyName: companyName.trim(),
                role,
                country,
                phone: phone.trim(),
                website: website.trim(),
            });
            if (!res.success) {
                setError(res.error || 'Could not save your profile.');
                return;
            }
            onComplete({
                companyName: companyName.trim(),
                role,
                country,
                phone: phone.trim() || undefined,
                website: website.trim() || undefined,
            });
        });
    };

    return (
        <form onSubmit={submit} className="space-y-5" noValidate>
            {error && (
                <Alert tone="danger">
                    <AlertTitle>Fix the highlighted fields</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}

            <div className="grid gap-5 sm:grid-cols-2">
                <Field id="fullName" label="Full name" required>
                    <Input
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        disabled={isPending}
                        placeholder="Jane Cooper"
                        autoComplete="name"
                    />
                </Field>

                <Field id="companyName" label="Company / brand" required>
                    <Input
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                        disabled={isPending}
                        placeholder="Acme Inc."
                        autoComplete="organization"
                    />
                </Field>

                <Field id="role" label="Your role" required>
                    <Select
                        value={role}
                        onValueChange={setRole}
                        disabled={isPending}
                    >
                        <SelectTrigger id="role" aria-label="Your role">
                            <SelectValue placeholder="Select your role" />
                        </SelectTrigger>
                        <SelectContent>
                            {ROLES.map((r) => (
                                <SelectItem key={r} value={r}>
                                    {r}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </Field>

                <Field id="country" label="Country" required>
                    <Select
                        value={country}
                        onValueChange={setCountry}
                        disabled={isPending}
                    >
                        <SelectTrigger id="country" aria-label="Country">
                            <SelectValue placeholder="Where are you based?" />
                        </SelectTrigger>
                        <SelectContent>
                            {COUNTRIES.map((c) => (
                                <SelectItem key={c} value={c}>
                                    {c}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </Field>

                <Field id="phone" label="Phone (optional)">
                    <Input
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        disabled={isPending}
                        placeholder="+91 98765 43210"
                        autoComplete="tel"
                    />
                </Field>

                <Field id="website" label="Website (optional)">
                    <Input
                        value={website}
                        onChange={(e) => setWebsite(e.target.value)}
                        disabled={isPending}
                        placeholder="https://acme.com"
                        autoComplete="url"
                    />
                </Field>
            </div>

            <div className="flex justify-end pt-2">
                <Button
                    type="submit"
                    variant="primary"
                    size="lg"
                    loading={isPending}
                    disabled={isPending}
                >
                    Continue
                </Button>
            </div>
        </form>
    );
}
