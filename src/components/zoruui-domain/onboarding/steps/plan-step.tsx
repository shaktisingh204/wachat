'use client';

import {
    Button,
    Alert,
    AlertDescription,
    AlertTitle,
    Badge,
    RadioGroup,
    Radio,
    cn,
} from '@/components/sabcrm/20ui';
import {
    AlertCircle,
    Check,
    LoaderCircle,
    Sparkles,
    ShieldCheck,
} from 'lucide-react';

import type { Plan } from '@/lib/definitions';

import * as React from 'react';

import { createPayuPlanCheckout } from '@/app/actions/payu.actions';
import {
    completeOnboarding,
    selectOnboardingPlan,
} from '@/app/actions/onboarding-flow.actions';

type HydratedPlan = Plan & { _id: string };

interface PlanStepProps {
    plans: HydratedPlan[];
    selectedModules: string[];
    paymentStatus?: 'success' | 'failed' | null;
    paymentReason?: string | null;
    onBack: () => void;
    onComplete: (planId: string) => void;
}

const PAYMENT_REASON_LABELS: Record<string, string> = {
    cancelled: 'Payment was cancelled before it completed.',
    'hash-mismatch':
        'We could not verify the response from PayU. Please try again.',
    'unknown-txn': 'We could not match this payment to a pending order.',
    'missing-txnid': 'PayU did not return a transaction id.',
    'payu-not-configured':
        'PayU payments are not configured. Please contact support.',
    'bad-request': 'Malformed response from PayU.',
    'server-error':
        'We hit an error while finalizing your payment. If money was deducted please contact support with your txn id.',
};

/**
 * Submits a PayU checkout payload as a hidden HTML form. PayU's
 * standard integration has no JS SDK, so the browser must POST to their
 * hosted payment page. We append a form to the document body and
 * .submit() it.
 */
function submitPayuForm(action: string, params: Record<string, string | undefined>) {
    const form = document.createElement('form');
    form.method = 'POST';
    form.action = action;
    form.style.display = 'none';
    for (const [key, value] of Object.entries(params)) {
        if (value === undefined || value === null) continue;
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = key;
        input.value = String(value);
        form.appendChild(input);
    }
    document.body.appendChild(form);
    form.submit();
}

/**
 * Scores a plan against the user's selected modules. We show relevance
 * hints in the UI (eg. "covers 5 of 6 of your modules"), and recommend
 * the cheapest plan that covers everything the user asked for.
 */
function scorePlan(plan: HydratedPlan, modules: string[]): number {
    if (modules.length === 0) return 0;
    const features = plan.features || ({} as any);
    const map: Record<string, string[]> = {
        wachat: [
            'campaigns',
            'liveChat',
            'contacts',
            'templates',
            'catalog',
            'flowBuilder',
            'metaFlows',
        ],
        crm: [
            'crmDashboard',
            'crmSales',
            'crmPurchases',
            'crmInventory',
            'crmAccounting',
        ],
        sabflow: ['flowBuilder'],
        seo: ['seo'],
        sabchat: ['chatbot'],
        email: ['email'],
        sms: ['sms'],
        'website-builder': ['websiteBuilder'],
        shop: ['ecommerce'],
        'ad-manager': ['whatsappAds', 'instagramFeed'],
        'url-shortener': ['urlShortener'],
        qr: ['qrCodeMaker'],
    };

    let hit = 0;
    for (const m of modules) {
        const keys = map[m] ?? [];
        if (keys.some((k) => (features as any)[k])) hit += 1;
    }
    return hit;
}

function formatPrice(plan: HydratedPlan): { main: string; suffix: string } {
    if (!plan.price || plan.price <= 0) {
        return { main: 'Free', suffix: 'forever' };
    }
    const symbol = plan.currency === 'INR' ? '₹' : plan.currency === 'USD' ? '$' : '';
    return {
        main: `${symbol}${plan.price.toLocaleString()}`,
        suffix: `/ ${plan.currency || 'USD'}`,
    };
}

export function PlanStep({
    plans,
    selectedModules,
    paymentStatus = null,
    paymentReason = null,
    onBack,
    onComplete,
}: PlanStepProps) {
    const [isPending, startTransition] = React.useTransition();
    const [error, setError] = React.useState<string | null>(() => {
        if (paymentStatus === 'failed' && paymentReason) {
            return (
                PAYMENT_REASON_LABELS[paymentReason] ??
                `PayU reported: ${paymentReason}`
            );
        }
        return null;
    });

    const ranked = React.useMemo(() => {
        return plans
            .map((p) => ({
                plan: p,
                score: scorePlan(p, selectedModules),
            }))
            .sort((a, b) => {
                if (b.score !== a.score) return b.score - a.score;
                return (a.plan.price || 0) - (b.plan.price || 0);
            });
    }, [plans, selectedModules]);

    const recommendedId = React.useMemo(() => {
        const withScore = ranked.find((r) => r.score > 0);
        return withScore?.plan._id ?? ranked[0]?.plan._id ?? null;
    }, [ranked]);

    const [chosen, setChosen] = React.useState<string | null>(recommendedId);

    const handleFreePlan = (planId: string) => {
        setError(null);
        startTransition(async () => {
            const res = await selectOnboardingPlan(planId);
            if (!res.success) {
                setError(res.error || 'Could not activate this plan.');
                return;
            }
            if (!res.data?.requiresPayment) {
                const done = await completeOnboarding({ planId });
                if (!done.success) {
                    setError(done.error || 'Could not finalize onboarding.');
                    return;
                }
                onComplete(planId);
            }
        });
    };

    const handlePaidPlan = (plan: HydratedPlan) => {
        setError(null);
        startTransition(async () => {
            // 1) Mark the selected plan so refreshes know where we are.
            const sel = await selectOnboardingPlan(plan._id);
            if (!sel.success) {
                setError(sel.error || 'Could not select this plan.');
                return;
            }

            // 2) Ask the server for a hashed PayU payload. The server
            // creates a pending Transaction keyed by txnid and computes
            // the SHA-512 request hash using the merchant salt.
            const checkout = await createPayuPlanCheckout(plan._id);
            if (!checkout.success || !checkout.payload) {
                setError(
                    checkout.error ||
                        'Could not start PayU checkout. Please try again.'
                );
                return;
            }

            // 3) Auto-submit a hidden form to PayU's hosted payment
            // page. PayU will redirect the browser back to
            // /api/payments/payu/callback when the user finishes.
            const { action, params } = checkout.payload;
            submitPayuForm(
                action,
                params as unknown as Record<string, string | undefined>
            );
        });
    };

    const submit = () => {
        if (!chosen) {
            setError('Select a plan to continue.');
            return;
        }
        const plan = plans.find((p) => p._id === chosen);
        if (!plan) return;
        if (!plan.price || plan.price <= 0) {
            handleFreePlan(plan._id);
        } else {
            handlePaidPlan(plan);
        }
    };

    const skip = () => {
        setError(null);
        startTransition(async () => {
            const defaultPlan =
                plans.find((p) => p.isDefault) ??
                ranked[0]?.plan ??
                plans[0];
            if (!defaultPlan) {
                const done = await completeOnboarding({});
                if (!done.success) {
                    setError(done.error || 'Could not finalize onboarding.');
                    return;
                }
                onComplete('');
                return;
            }
            const done = await completeOnboarding({ planId: defaultPlan._id });
            if (!done.success) {
                setError(done.error || 'Could not finalize onboarding.');
                return;
            }
            onComplete(defaultPlan._id);
        });
    };

    if (plans.length === 0) {
        return (
            <div className="space-y-6">
                <Alert tone="info" icon={Sparkles} title="No plans configured yet">
                    <AlertDescription>
                        Your workspace will start on the default account tier.
                        You can upgrade anytime from Settings, Billing.
                    </AlertDescription>
                </Alert>
                <div className="flex justify-between">
                    <Button variant="ghost" onClick={onBack}>
                        Back
                    </Button>
                    <Button
                        variant="primary"
                        onClick={skip}
                        loading={isPending}
                        iconLeft={isPending ? LoaderCircle : undefined}
                    >
                        Continue to dashboard
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {paymentStatus === 'success' && !error && (
                <Alert tone="success" icon={ShieldCheck} title="Payment received">
                    <AlertDescription>
                        Thanks, we verified your PayU payment. Finalizing your
                        workspace now.
                    </AlertDescription>
                </Alert>
            )}
            {error && (
                <Alert tone="danger" icon={AlertCircle} title="Payment issue">
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}

            <RadioGroup
                aria-label="Choose a plan"
                value={chosen ?? undefined}
                onValueChange={(value) => setChosen(value)}
                disabled={isPending}
                className="grid gap-4 md:grid-cols-2 xl:grid-cols-3"
            >
                {ranked.map(({ plan, score }) => {
                    const active = chosen === plan._id;
                    const recommended = plan._id === recommendedId;
                    const { main, suffix } = formatPrice(plan);
                    return (
                        <label
                            key={plan._id}
                            className={cn(
                                'relative flex cursor-pointer flex-col rounded-[var(--st-radius)] border bg-[var(--st-bg)] p-6 text-left transition',
                                active
                                    ? 'border-[var(--st-accent)] shadow-md ring-1 ring-[var(--st-accent)]'
                                    : 'border-[var(--st-border)] hover:border-[var(--st-accent)]/60 hover:shadow-sm',
                                isPending && 'cursor-not-allowed opacity-70'
                            )}
                        >
                            {recommended && (
                                <span className="absolute -top-3 left-4">
                                    <Badge tone="accent" kind="solid">
                                        <Sparkles
                                            className="mr-1 h-3 w-3"
                                            aria-hidden="true"
                                        />
                                        Recommended
                                    </Badge>
                                </span>
                            )}
                            <div className="flex items-start justify-between">
                                <div>
                                    <h3 className="text-lg font-bold text-[var(--st-text)]">
                                        {plan.name}
                                    </h3>
                                    {plan.appCategory && (
                                        <p className="text-xs uppercase tracking-wider text-[var(--st-text-secondary)]">
                                            {plan.appCategory}
                                        </p>
                                    )}
                                </div>
                                <Radio
                                    value={plan._id}
                                    aria-label={`Select the ${plan.name} plan`}
                                />
                            </div>

                            <div className="mt-4 flex items-baseline gap-1">
                                <span className="text-3xl font-bold text-[var(--st-text)]">
                                    {main}
                                </span>
                                <span className="text-xs text-[var(--st-text-secondary)]">
                                    {suffix}
                                </span>
                            </div>

                            {selectedModules.length > 0 && (
                                <p className="mt-2 text-xs text-[var(--st-text-secondary)]">
                                    Covers{' '}
                                    <span className="font-semibold text-[var(--st-text)]">
                                        {score}
                                    </span>{' '}
                                    of {selectedModules.length} modules you
                                    picked.
                                </p>
                            )}

                            <ul className="mt-4 space-y-1.5 text-sm">
                                <PlanFeatureLine
                                    enabled
                                    label={`Up to ${plan.projectLimit ?? 1} project(s)`}
                                />
                                <PlanFeatureLine
                                    enabled
                                    label={`${plan.agentLimit ?? 1} agent seat(s)`}
                                />
                                <PlanFeatureLine
                                    enabled={!!plan.features?.crmDashboard}
                                    label="Full CRM"
                                />
                                <PlanFeatureLine
                                    enabled={!!plan.features?.seo}
                                    label="SEO suite"
                                />
                                <PlanFeatureLine
                                    enabled={!!plan.features?.chatbot}
                                    label="AI chatbot (SabChat)"
                                />
                                <PlanFeatureLine
                                    enabled={!!plan.features?.websiteBuilder}
                                    label="Website builder"
                                />
                            </ul>
                        </label>
                    );
                })}
            </RadioGroup>

            <div className="rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)]/40 p-4 text-sm">
                <div className="flex items-start gap-3">
                    <ShieldCheck
                        className="mt-0.5 h-4 w-4 text-[var(--st-text-secondary)]"
                        aria-hidden="true"
                    />
                    <p className="text-[var(--st-text-secondary)]">
                        Payments are processed securely via PayU. The next
                        screen is PayU's hosted checkout. You can upgrade,
                        downgrade, or cancel anytime from{' '}
                        <span className="font-medium text-[var(--st-text)]">
                            Settings, Billing
                        </span>
                        .
                    </p>
                </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <Button
                    variant="ghost"
                    onClick={onBack}
                    disabled={isPending}
                >
                    Back
                </Button>
                <div className="flex gap-2">
                    <Button
                        variant="outline"
                        onClick={skip}
                        disabled={isPending}
                    >
                        Skip for now
                    </Button>
                    <Button
                        variant="primary"
                        size="lg"
                        onClick={submit}
                        loading={isPending}
                        iconLeft={isPending ? LoaderCircle : undefined}
                        disabled={!chosen}
                    >
                        Activate plan
                    </Button>
                </div>
            </div>
        </div>
    );
}

function PlanFeatureLine({
    enabled,
    label,
}: {
    enabled: boolean;
    label: string;
}) {
    return (
        <li
            className={cn(
                'flex items-center gap-2',
                enabled
                    ? 'text-[var(--st-text)]'
                    : 'text-[var(--st-text-secondary)]/60 line-through'
            )}
        >
            <Check
                className={cn(
                    'h-3.5 w-3.5',
                    enabled
                        ? 'text-[var(--st-accent)]'
                        : 'text-[var(--st-text-secondary)]/40'
                )}
                aria-hidden="true"
            />
            {label}
        </li>
    );
}
