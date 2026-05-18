'use client';

import {
  ZoruButton,
  ZoruLabel,
  ZoruAlert,
  ZoruAlertDescription,
  ZoruAlertTitle,
  ZoruSelect,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
} from '@/components/zoruui';
import {
  AlertCircle,
  LoaderCircle } from 'lucide-react';

import { Check } from 'lucide-react';

import * as React from 'react';

import { cn } from '@/lib/utils';

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
    '2 – 10',
    '11 – 50',
    '51 – 200',
    '201 – 1,000',
    '1,000+',
];

const VOLUMES = [
    { value: '<1k', label: 'Under 1,000 / month' },
    { value: '1k-10k', label: '1,000 – 10,000' },
    { value: '10k-50k', label: '10,000 – 50,000' },
    { value: '50k-250k', label: '50,000 – 250,000' },
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
            {error && (
                <ZoruAlert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <ZoruAlertTitle>Tell us a bit more</ZoruAlertTitle>
                    <ZoruAlertDescription>{error}</ZoruAlertDescription>
                </ZoruAlert>
            )}

            <div className="grid gap-5 sm:grid-cols-3">
                <div className="space-y-2">
                    <ZoruLabel htmlFor="industry">Industry *</ZoruLabel>
                    <ZoruSelect
                        value={industry}
                        onValueChange={setIndustry}
                        disabled={isPending}
                    >
                        <ZoruSelectTrigger id="industry">
                            <ZoruSelectValue placeholder="Pick one" />
                        </ZoruSelectTrigger>
                        <ZoruSelectContent>
                            {INDUSTRIES.map((i) => (
                                <ZoruSelectItem key={i} value={i}>
                                    {i}
                                </ZoruSelectItem>
                            ))}
                        </ZoruSelectContent>
                    </ZoruSelect>
                </div>

                <div className="space-y-2">
                    <ZoruLabel htmlFor="teamSize">Team size *</ZoruLabel>
                    <ZoruSelect
                        value={teamSize}
                        onValueChange={setTeamSize}
                        disabled={isPending}
                    >
                        <ZoruSelectTrigger id="teamSize">
                            <ZoruSelectValue placeholder="People on your team" />
                        </ZoruSelectTrigger>
                        <ZoruSelectContent>
                            {TEAM_SIZES.map((t) => (
                                <ZoruSelectItem key={t} value={t}>
                                    {t}
                                </ZoruSelectItem>
                            ))}
                        </ZoruSelectContent>
                    </ZoruSelect>
                </div>

                <div className="space-y-2">
                    <ZoruLabel htmlFor="volume">Monthly volume *</ZoruLabel>
                    <ZoruSelect
                        value={volume}
                        onValueChange={setVolume}
                        disabled={isPending}
                    >
                        <ZoruSelectTrigger id="volume">
                            <ZoruSelectValue placeholder="Messages / month" />
                        </ZoruSelectTrigger>
                        <ZoruSelectContent>
                            {VOLUMES.map((v) => (
                                <ZoruSelectItem key={v.value} value={v.value}>
                                    {v.label}
                                </ZoruSelectItem>
                            ))}
                        </ZoruSelectContent>
                    </ZoruSelect>
                </div>
            </div>

            <div className="space-y-3">
                <ZoruLabel>How will you use SabNode? (pick all that apply)</ZoruLabel>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {USE_CASES.map((uc) => {
                        const active = useCases.includes(uc.id);
                        return (
                            <button
                                type="button"
                                key={uc.id}
                                onClick={() => toggleUseCase(uc.id)}
                                disabled={isPending}
                                aria-pressed={active}
                                className={cn(
                                    'flex items-start gap-3 rounded-xl border p-4 text-left transition',
                                    active
                                        ? 'border-primary bg-primary/5 shadow-sm'
                                        : 'hover:border-primary/60 hover:bg-muted/50'
                                )}
                            >
                                <span
                                    aria-hidden
                                    className={cn(
                                        'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border transition',
                                        active
                                            ? 'border-primary bg-primary text-primary-foreground'
                                            : 'border-muted-foreground/40 bg-background'
                                    )}
                                >
                                    {active ? (
                                        <Check className="h-3 w-3" />
                                    ) : null}
                                </span>
                                <div>
                                    <p className="text-sm font-semibold">
                                        {uc.label}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                        {uc.description}
                                    </p>
                                </div>
                            </button>
                        );
                    })}
                </div>
            </div>

            <div className="flex justify-between pt-2">
                <ZoruButton
                    type="button"
                    variant="ghost"
                    onClick={onBack}
                    disabled={isPending}
                >
                    Back
                </ZoruButton>
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
