'use client';

import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  Checkbox,
  Field,
  Input,
  Label,
  Radio,
  RadioGroup,
  Textarea,
  cn,
} from '@/components/sabcrm/20ui';
import {
  AlertCircle,
  BarChart3,
  Bot,
  Brush,
  GitFork,
  Link2,
  Mail,
  MessageSquare,
  QrCode,
  Send,
  ShoppingBag,
  TrendingUp,
  Users,
} from 'lucide-react';

import * as React from 'react';

import { saveOnboardingRequirements } from '@/app/actions/onboarding-flow.actions';

type RequirementsData = {
    modules: string[];
    primaryGoal?: string;
    currentTools?: string;
    timeline?: string;
};

interface RequirementsStepProps {
    initial: RequirementsData | null;
    onBack: () => void;
    onComplete: (patch: RequirementsData) => void;
}

export const AVAILABLE_MODULES: {
    id: string;
    name: string;
    description: string;
    icon: React.ElementType;
}[] = [
    {
        id: 'wachat',
        name: 'Wachat (WhatsApp)',
        description: 'Broadcasts, templates, live chat, catalogs, Meta Flows',
        icon: MessageSquare,
    },
    {
        id: 'crm',
        name: 'Full-stack CRM',
        description:
            'Sales, purchases, inventory, accounting, HR/payroll, leads',
        icon: Users,
    },
    {
        id: 'sabflow',
        name: 'SabFlow automation',
        description: 'Visual flow builder across 20+ apps',
        icon: GitFork,
    },
    {
        id: 'seo',
        name: 'SEO suite',
        description: 'Audits, rank tracking, GSC, IndexNow, PDF reports',
        icon: TrendingUp,
    },
    {
        id: 'sabchat',
        name: 'SabChat AI chatbot',
        description: 'Embeddable AI widget with FAQs and live handoff',
        icon: Bot,
    },
    {
        id: 'email',
        name: 'Email marketing',
        description: 'Campaigns, templates, automations',
        icon: Mail,
    },
    {
        id: 'sms',
        name: 'SMS campaigns',
        description: 'Transactional and marketing SMS',
        icon: Send,
    },
    {
        id: 'website-builder',
        name: 'Website builder',
        description: 'Sites, landing pages, custom domains',
        icon: Brush,
    },
    {
        id: 'shop',
        name: 'Online shop',
        description: 'Storefronts, checkout, orders',
        icon: ShoppingBag,
    },
    {
        id: 'ad-manager',
        name: 'Meta Ad Manager',
        description: 'Facebook and Instagram ad campaigns',
        icon: BarChart3,
    },
    {
        id: 'url-shortener',
        name: 'URL shortener',
        description: 'Branded links with click analytics',
        icon: Link2,
    },
    {
        id: 'qr',
        name: 'QR code maker',
        description: 'Dynamic QR codes with tracking',
        icon: QrCode,
    },
];

const TIMELINES = [
    'Ready to launch now',
    'Within 2 weeks',
    'Within a month',
    'Still exploring',
];

export function RequirementsStep({
    initial,
    onBack,
    onComplete,
}: RequirementsStepProps) {
    const [isPending, startTransition] = React.useTransition();
    const [error, setError] = React.useState<string | null>(null);
    const [selected, setSelected] = React.useState<string[]>(
        initial?.modules ?? []
    );
    const [primaryGoal, setPrimaryGoal] = React.useState(
        initial?.primaryGoal ?? ''
    );
    const [currentTools, setCurrentTools] = React.useState(
        initial?.currentTools ?? ''
    );
    const [timeline, setTimeline] = React.useState(initial?.timeline ?? '');

    const toggle = (id: string) => {
        setSelected((prev) =>
            prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
        );
    };

    const submit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setError(null);
        if (selected.length === 0) {
            setError('Pick at least one module to enable.');
            return;
        }
        if (!primaryGoal.trim()) {
            setError('Tell us your primary goal so we can tailor the setup.');
            return;
        }
        startTransition(async () => {
            const res = await saveOnboardingRequirements({
                modules: selected,
                primaryGoal: primaryGoal.trim(),
                currentTools: currentTools.trim(),
                timeline,
            });
            if (!res.success) {
                setError(
                    res.error || 'Could not save your requirements. Try again.'
                );
                return;
            }
            onComplete({
                modules: selected,
                primaryGoal: primaryGoal.trim(),
                currentTools: currentTools.trim() || undefined,
                timeline: timeline || undefined,
            });
        });
    };

    return (
        <form onSubmit={submit} className="space-y-6" noValidate>
            {error && (
                <Alert tone="danger" icon={AlertCircle}>
                    <AlertTitle>Almost there</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}

            <div className="space-y-3">
                <div className="flex items-end justify-between">
                    <Label required>Modules to turn on</Label>
                    <span className="text-xs text-[var(--st-text-secondary)]">
                        {selected.length} selected
                    </span>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {AVAILABLE_MODULES.map((m) => {
                        const Icon = m.icon;
                        const active = selected.includes(m.id);
                        return (
                            <label
                                key={m.id}
                                className={cn(
                                    'flex items-start gap-3 rounded-[var(--st-radius)] border border-[var(--st-border)] p-4 text-left transition',
                                    isPending
                                        ? 'cursor-not-allowed opacity-60'
                                        : 'cursor-pointer',
                                    active
                                        ? 'border-[var(--st-accent)] bg-[var(--st-accent)]/5 shadow-sm'
                                        : 'hover:border-[var(--st-accent)]/60 hover:bg-[var(--st-bg-secondary)]/50'
                                )}
                            >
                                <Checkbox
                                    className="mt-0.5 shrink-0"
                                    checked={active}
                                    disabled={isPending}
                                    onChange={() => toggle(m.id)}
                                    aria-label={`Enable ${m.name}`}
                                />
                                <span
                                    className={cn(
                                        'rounded-lg p-2',
                                        active
                                            ? 'bg-[var(--st-accent)] text-[var(--st-text-inverted)]'
                                            : 'bg-[var(--st-bg-secondary)] text-[var(--st-text-secondary)]'
                                    )}
                                >
                                    <Icon className="h-4 w-4" aria-hidden="true" />
                                </span>
                                <span className="flex-1">
                                    <span className="block text-sm font-semibold text-[var(--st-text)]">
                                        {m.name}
                                    </span>
                                    <span className="block text-xs text-[var(--st-text-secondary)]">
                                        {m.description}
                                    </span>
                                </span>
                            </label>
                        );
                    })}
                </div>
            </div>

            <div className="grid gap-5 lg:grid-cols-2">
                <Field
                    label="What's the #1 outcome you want in 90 days?"
                    required
                >
                    <Textarea
                        value={primaryGoal}
                        onChange={(e) => setPrimaryGoal(e.target.value)}
                        disabled={isPending}
                        placeholder="e.g. Move WhatsApp broadcasts off a legacy BSP and cut cost-per-lead by 30%"
                        rows={3}
                    />
                </Field>

                <div className="space-y-5">
                    <Field label="Tools you use today (optional)">
                        <Input
                            value={currentTools}
                            onChange={(e) => setCurrentTools(e.target.value)}
                            disabled={isPending}
                            placeholder="Interakt, Zoho, Mailchimp"
                        />
                    </Field>
                    <div className="space-y-2">
                        <Label>When are you looking to go live?</Label>
                        <RadioGroup
                            orientation="horizontal"
                            value={timeline}
                            onValueChange={setTimeline}
                            disabled={isPending}
                            aria-label="Go-live timeline"
                            className="flex-wrap gap-2"
                        >
                            {TIMELINES.map((t) => (
                                <Radio
                                    key={t}
                                    value={t}
                                    label={t}
                                    size="sm"
                                />
                            ))}
                        </RadioGroup>
                    </div>
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
