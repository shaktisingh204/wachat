'use client';

import * as React from 'react';

import {
    Button,
    Label,
    Alert,
    Field,
    Checkbox,
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
    cn,
} from '@/components/sabcrm/20ui';

import { saveOnboardingBusiness } from '@/app/actions/onboarding-flow.actions';

type BusinessData = {
    industry?: string;
    teamSize?: string;
    monthlyVolume?: string;
    useCases?: string[];
};

interface BusinessStepProps {
    initial: BusinessData | null;
    onBack: () => void;
    onComplete: (patch: BusinessData) => void;
}

const INDUSTRIES = [
    'E-commerce / Retail',
    'SaaS / Technology',
    'Education & Training',
    'Real Estate',
    'Healthcare',
    'Travel & Hospitality',
    'Financial Services',
    'Agency / Marketing',
    'Manufacturing / B2B',
    'Non-profit',
    'Other',
];

const TEAM_SIZES = [
    'Just me',
    '2 - 10',
    '11 - 50',
    '51 - 200',
    '201 - 1,000',
    '1,000+',
];

const VOLUMES = [
    { value: '<1k', label: 'Under 1,000 / month' },
    { value: '1k-10k', label: '1,000 - 10,000' },
    { value: '10k-50k', label: '10,000 - 50,000' },
    { value: '50k-250k', label: '50,000 - 250,000' },
    { value: '250k+', label: '250,000+' },
];

const USE_CASES: { id: string; label: string; description: string }[] = [
    {
        id: 'marketing',
        label: 'Marketing broadcasts',
        description: 'Promotions, product drops, newsletters',
    },
    {
        id: 'support',
        label: 'Customer support',
        description: 'Live chat & ticket handoff',
    },
    {
        id: 'sales',
        label: 'Sales & lead qualification',
        description: 'Follow-ups, demos, CRM sync',
    },
    {
        id: 'transactional',
        label: 'Transactional alerts',
        description: 'OTPs, order updates, reminders',
    },
    {
        id: 'chatbot',
        label: 'AI chatbot',
        description: 'Automated Q&A on site & WhatsApp',
    },
    {
        id: 'commerce',
        label: 'WhatsApp commerce',
        description: 'Catalogs, carts, checkout',
    },
];

export function BusinessStep({
    initial,
    onBack,
    onComplete,
}: BusinessStepProps) {
    const [isPending, startTransition] = React.useTransition();
    const [error, setError] = React.useState<string | null>(null);
    const [industry, setIndustry] = React.useState(initial?.industry ?? '');
    const [teamSize, setTeamSize] = React.useState(initial?.teamSize ?? '');
    const [volume, setVolume] = React.useState(initial?.monthlyVolume ?? '');
    const [useCases, setUseCases] = React.useState<string[]>(
        initial?.useCases ?? []
    );

    const toggleUseCase = (id: string) => {
        setUseCases((prev) =>
            prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
        );
    };

    const submit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setError(null);
        if (!industry || !teamSize || !volume) {
            setError(
                'Please pick your industry, team size, and expected volume.'
            );
            return;
        }
        startTransition(async () => {
            const res = await saveOnboardingBusiness({
                industry,
                teamSize,
                monthlyVolume: volume,
                useCases,
            });
            if (!res.success) {
                setError(res.error || 'Could not save your business details.');
                return;
            }
            onComplete({
                industry,
                teamSize,
                monthlyVolume: volume,
                useCases,
            });
        });
    };

    return (
        <form onSubmit={submit} className="space-y-6" noValidate>
            {error ? (
                <Alert tone="danger" title="Tell us a bit more">
                    {error}
                </Alert>
            ) : null}

            <div className="grid gap-5 sm:grid-cols-3">
                <Field label="Industry" required id="industry">
                    <Select
                        value={industry}
                        onValueChange={setIndustry}
                        disabled={isPending}
                    >
                        <SelectTrigger id="industry" aria-label="Industry">
                            <SelectValue placeholder="Pick one" />
                        </SelectTrigger>
                        <SelectContent>
                            {INDUSTRIES.map((i) => (
                                <SelectItem key={i} value={i}>
                                    {i}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </Field>

                <Field label="Team size" required id="teamSize">
                    <Select
                        value={teamSize}
                        onValueChange={setTeamSize}
                        disabled={isPending}
                    >
                        <SelectTrigger id="teamSize" aria-label="Team size">
                            <SelectValue placeholder="People on your team" />
                        </SelectTrigger>
                        <SelectContent>
                            {TEAM_SIZES.map((t) => (
                                <SelectItem key={t} value={t}>
                                    {t}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </Field>

                <Field label="Monthly volume" required id="volume">
                    <Select
                        value={volume}
                        onValueChange={setVolume}
                        disabled={isPending}
                    >
                        <SelectTrigger id="volume" aria-label="Monthly volume">
                            <SelectValue placeholder="Messages / month" />
                        </SelectTrigger>
                        <SelectContent>
                            {VOLUMES.map((v) => (
                                <SelectItem key={v.value} value={v.value}>
                                    {v.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </Field>
            </div>

            <div className="space-y-3">
                <Label>How will you use SabNode? (pick all that apply)</Label>
                <div
                    role="group"
                    aria-label="Use cases"
                    className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
                >
                    {USE_CASES.map((uc) => {
                        const active = useCases.includes(uc.id);
                        return (
                            <label
                                key={uc.id}
                                className={cn(
                                    'flex cursor-pointer items-start gap-3 rounded-[var(--st-radius)] border p-4 text-left transition',
                                    isPending && 'pointer-events-none opacity-60',
                                    active
                                        ? 'border-[var(--st-accent)] bg-[var(--st-accent)]/5 shadow-sm'
                                        : 'border-[var(--st-border)] hover:border-[var(--st-accent)]/60 hover:bg-[var(--st-bg-secondary)]/50'
                                )}
                            >
                                <Checkbox
                                    className="mt-0.5"
                                    checked={active}
                                    onChange={() => toggleUseCase(uc.id)}
                                    disabled={isPending}
                                    aria-label={uc.label}
                                />
                                <div>
                                    <p className="text-sm font-semibold text-[var(--st-text)]">
                                        {uc.label}
                                    </p>
                                    <p className="text-xs text-[var(--st-text-secondary)]">
                                        {uc.description}
                                    </p>
                                </div>
                            </label>
                        );
                    })}
                </div>
            </div>

            <div className="flex justify-between pt-2">
                <Button
                    type="button"
                    variant="ghost"
                    onClick={onBack}
                    disabled={isPending}
                >
                    Back
                </Button>
                <Button
                    type="submit"
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
