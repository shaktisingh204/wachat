'use client';

import * as React from 'react';
import { AlertCircle, LoaderCircle } from 'lucide-react';

import { Check } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
    Alert,
    AlertDescription,
    AlertTitle,
} from '@/components/ui/alert';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
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
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Tell us a bit more</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}

            <div className="grid gap-5 sm:grid-cols-3">
                <div className="space-y-2">
                    <Label htmlFor="industry">Industry *</Label>
                    <Select
                        value={industry}
                        onValueChange={setIndustry}
                        disabled={isPending}
                    >
                        <SelectTrigger id="industry">
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
                </div>

                <div className="space-y-2">
                    <Label htmlFor="teamSize">Team size *</Label>
                    <Select
                        value={teamSize}
                        onValueChange={setTeamSize}
                        disabled={isPending}
                    >
                        <SelectTrigger id="teamSize">
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
                </div>

                <div className="space-y-2">
                    <Label htmlFor="volume">Monthly volume *</Label>
                    <Select
                        value={volume}
                        onValueChange={setVolume}
                        disabled={isPending}
                    >
                        <SelectTrigger id="volume">
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
                </div>
            </div>

            <div className="space-y-3">
                <Label>How will you use SabNode? (pick all that apply)</Label>
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
                    className="h-11 px-6 text-base"
                    disabled={isPending}
                >
                    {isPending ? (
                        <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                    ) : null}
                    Continue
                </Button>
            </div>
        </form>
    );
}
