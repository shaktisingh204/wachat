'use client';

import * as React from 'react';
import {
    AlertCircle,
    BarChart3,
    Bot,
    Briefcase,
    Brush,
    GitFork,
    Link2,
    LoaderCircle,
    Mail,
    MessageSquare,
    QrCode,
    Send,
    ShoppingBag,
    TrendingUp,
    Users,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
    Alert,
    AlertDescription,
    AlertTitle,
} from '@/components/ui/alert';
import { cn } from '@/lib/utils';

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
        description: 'Embeddable AI widget with FAQs & live handoff',
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
        description: 'Transactional + marketing SMS',
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
        description: 'Facebook & Instagram ad campaigns',
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
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Almost there</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}

            <div className="space-y-3">
                <div className="flex items-end justify-between">
                    <Label>Modules to turn on *</Label>
                    <span className="text-xs text-muted-foreground">
                        {selected.length} selected
                    </span>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {AVAILABLE_MODULES.map((m) => {
                        const Icon = m.icon;
                        const active = selected.includes(m.id);
                        return (
                            <button
                                type="button"
                                key={m.id}
                                onClick={() => toggle(m.id)}
                                disabled={isPending}
                                className={cn(
                                    'flex items-start gap-3 rounded-xl border p-4 text-left transition',
                                    active
                                        ? 'border-primary bg-primary/5 shadow-sm'
                                        : 'hover:border-primary/60 hover:bg-muted/50'
                                )}
                            >
                                <div
                                    className={cn(
                                        'rounded-lg p-2',
                                        active
                                            ? 'bg-primary text-primary-foreground'
                                            : 'bg-muted text-muted-foreground'
                                    )}
                                >
                                    <Icon className="h-4 w-4" />
                                </div>
                                <div className="flex-1">
                                    <p className="text-sm font-semibold">
                                        {m.name}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                        {m.description}
                                    </p>
                                </div>
                            </button>
                        );
                    })}
                </div>
            </div>

            <div className="grid gap-5 lg:grid-cols-2">
                <div className="space-y-2">
                    <Label htmlFor="primaryGoal">
                        What's the #1 outcome you want in 90 days? *
                    </Label>
                    <Textarea
                        id="primaryGoal"
                        value={primaryGoal}
                        onChange={(e) => setPrimaryGoal(e.target.value)}
                        disabled={isPending}
                        placeholder="e.g. Move WhatsApp broadcasts off a legacy BSP and cut cost-per-lead by 30%"
                        rows={3}
                    />
                </div>

                <div className="space-y-5">
                    <div className="space-y-2">
                        <Label htmlFor="currentTools">
                            Tools you use today (optional)
                        </Label>
                        <Input
                            id="currentTools"
                            value={currentTools}
                            onChange={(e) => setCurrentTools(e.target.value)}
                            disabled={isPending}
                            placeholder="Interakt, Zoho, Mailchimp…"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>When are you looking to go live?</Label>
                        <div className="flex flex-wrap gap-2">
                            {TIMELINES.map((t) => {
                                const active = timeline === t;
                                return (
                                    <button
                                        type="button"
                                        key={t}
                                        onClick={() => setTimeline(t)}
                                        disabled={isPending}
                                        className={cn(
                                            'rounded-full border px-4 py-1.5 text-xs font-medium transition',
                                            active
                                                ? 'border-primary bg-primary text-primary-foreground'
                                                : 'hover:border-primary/60'
                                        )}
                                    >
                                        {t}
                                    </button>
                                );
                            })}
                        </div>
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
