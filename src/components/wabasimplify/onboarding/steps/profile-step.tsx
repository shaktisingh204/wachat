'use client';

import {
  Button,
  Input,
  Label,
  Alert,
  ZoruAlertDescription,
  ZoruAlertTitle,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
} from '@/components/zoruui';
import {
  AlertCircle,
  LoaderCircle } from 'lucide-react';

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
                <ZoruAlert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <ZoruAlertTitle>Fix the highlighted fields</ZoruAlertTitle>
                    <ZoruAlertDescription>{error}</ZoruAlertDescription>
                </ZoruAlert>
            )}

            <div className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-2">
                    <ZoruLabel htmlFor="fullName">Full name *</ZoruLabel>
                    <ZoruInput
                        id="fullName"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        disabled={isPending}
                        placeholder="Jane Cooper"
                        autoComplete="name"
                    />
                </div>

                <div className="space-y-2">
                    <ZoruLabel htmlFor="companyName">Company / brand *</ZoruLabel>
                    <ZoruInput
                        id="companyName"
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                        disabled={isPending}
                        placeholder="Acme Inc."
                        autoComplete="organization"
                    />
                </div>

                <div className="space-y-2">
                    <ZoruLabel htmlFor="role">Your role *</ZoruLabel>
                    <ZoruSelect
                        value={role}
                        onValueChange={setRole}
                        disabled={isPending}
                    >
                        <ZoruSelectTrigger id="role">
                            <ZoruSelectValue placeholder="Select your role" />
                        </ZoruSelectTrigger>
                        <ZoruSelectContent>
                            {ROLES.map((r) => (
                                <ZoruSelectItem key={r} value={r}>
                                    {r}
                                </ZoruSelectItem>
                            ))}
                        </ZoruSelectContent>
                    </ZoruSelect>
                </div>

                <div className="space-y-2">
                    <ZoruLabel htmlFor="country">Country *</ZoruLabel>
                    <ZoruSelect
                        value={country}
                        onValueChange={setCountry}
                        disabled={isPending}
                    >
                        <ZoruSelectTrigger id="country">
                            <ZoruSelectValue placeholder="Where are you based?" />
                        </ZoruSelectTrigger>
                        <ZoruSelectContent>
                            {COUNTRIES.map((c) => (
                                <ZoruSelectItem key={c} value={c}>
                                    {c}
                                </ZoruSelectItem>
                            ))}
                        </ZoruSelectContent>
                    </ZoruSelect>
                </div>

                <div className="space-y-2">
                    <ZoruLabel htmlFor="phone">Phone (optional)</ZoruLabel>
                    <ZoruInput
                        id="phone"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        disabled={isPending}
                        placeholder="+91 98765 43210"
                        autoComplete="tel"
                    />
                </div>

                <div className="space-y-2">
                    <ZoruLabel htmlFor="website">Website (optional)</ZoruLabel>
                    <ZoruInput
                        id="website"
                        value={website}
                        onChange={(e) => setWebsite(e.target.value)}
                        disabled={isPending}
                        placeholder="https://acme.com"
                        autoComplete="url"
                    />
                </div>
            </div>

            <div className="flex justify-end pt-2">
                <ZoruButton
                    type="submit"
                    className="h-11 px-6 text-base"
                    disabled={isPending}
                >
                    {isPending ? (
                        <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                    ) : null}
                    Continue
                </ZoruButton>
            </div>
        </form>
    );
}
