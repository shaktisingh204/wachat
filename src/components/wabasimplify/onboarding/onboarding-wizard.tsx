'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Check, LoaderCircle, SkipForward } from 'lucide-react';

import type { Plan } from '@/lib/definitions';
import type {
    OnboardingState,
} from '@/app/actions/onboarding-flow.actions';
import { skipOnboarding } from '@/app/actions/onboarding-flow.actions';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

import { AccountStep } from './steps/account-step';
import { ProfileStep } from './steps/profile-step';
import { BusinessStep } from './steps/business-step';
import { RequirementsStep } from './steps/requirements-step';
import { PlanStep } from './steps/plan-step';
import { CompleteStep } from './steps/complete-step';

type WizardStep =
    | 'account'
    | 'profile'
    | 'business'
    | 'requirements'
    | 'plan'
    | 'complete';

const STEP_ORDER: WizardStep[] = [
    'account',
    'profile',
    'business',
    'requirements',
    'plan',
    'complete',
];

const STEP_META: Record<WizardStep, { title: string; subtitle: string }> = {
    account: {
        title: 'Create your account',
        subtitle: 'Start with email & password — or use Google / Facebook.',
    },
    profile: {
        title: 'Tell us about you',
        subtitle: 'Who are you, and what company are you setting this up for?',
    },
    business: {
        title: 'Your business',
        subtitle:
            'Industry, team size, and expected message volume so we can size things right.',
    },
    requirements: {
        title: 'What do you need?',
        subtitle:
            'Pick the modules you want turned on — we tailor the workspace around them.',
    },
    plan: {
        title: 'Choose your plan',
        subtitle: 'Start free, or subscribe to unlock the full stack.',
    },
    complete: {
        title: 'You’re all set',
        subtitle: 'Your workspace is ready. Let’s jump in.',
    },
};

function initialStep(onboarding: OnboardingState | null | undefined): WizardStep {
    if (!onboarding) return 'profile';
    switch (onboarding.status) {
        case 'profile':
            return 'profile';
        case 'business':
            return 'business';
        case 'requirements':
            return 'requirements';
        case 'plan':
            return 'plan';
        case 'complete':
            return 'complete';
        default:
            return 'account';
    }
}

export interface OnboardingWizardProps {
    initialUser: { _id: string; name: string; email: string } | null;
    initialOnboarding: OnboardingState | null;
    initialPlans: Array<Plan & { _id: string }>;
    paymentStatus?: 'success' | 'failed' | null;
    paymentReason?: string | null;
}

export function OnboardingWizard({
    initialUser,
    initialOnboarding,
    initialPlans,
    paymentStatus = null,
    paymentReason = null,
}: OnboardingWizardProps) {
    const router = useRouter();
    const [step, setStep] = React.useState<WizardStep>(() =>
        initialUser ? initialStep(initialOnboarding) : 'account'
    );
    const [onboarding, setOnboarding] = React.useState<OnboardingState | null>(
        initialOnboarding
    );
    const [signedInUser, setSignedInUser] = React.useState(initialUser);
    const [isSkipping, startSkipTransition] = React.useTransition();

    const currentIndex = STEP_ORDER.indexOf(step);

    const advance = React.useCallback(
        (to: WizardStep, patch?: Partial<OnboardingState>) => {
            setOnboarding((prev) => {
                const base = (prev ?? { status: 'profile' }) as OnboardingState;
                const nextStatus: OnboardingState['status'] =
                    to === 'account' ? 'profile' : to;
                return {
                    ...base,
                    ...(patch ?? {}),
                    status: nextStatus,
                };
            });
            setStep(to);
        },
        []
    );

    const handleSkip = React.useCallback(() => {
        startSkipTransition(async () => {
            const res = await skipOnboarding();
            if (res.success) {
                router.push('/dashboard');
            }
        });
    }, [router]);

    const handleAccountCreated = React.useCallback(
        (user: { _id: string; name: string; email: string }) => {
            setSignedInUser(user);
            advance('profile');
            router.refresh();
        },
        [advance, router]
    );

    return (
        <div className="grid gap-8 lg:grid-cols-[260px_1fr]">
            <aside className="lg:sticky lg:top-24 lg:self-start">
                <StepNav currentStep={step} />
            </aside>

            <section className="space-y-6">
                <header className="space-y-2">
                    <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold uppercase tracking-wider text-primary">
                            Step {currentIndex + 1} of {STEP_ORDER.length}
                        </p>
                        {signedInUser && step !== 'account' && step !== 'complete' && (
                            <Button
                                variant="ghost"
                                size="sm"
                                className="text-muted-foreground"
                                onClick={handleSkip}
                                disabled={isSkipping}
                            >
                                {isSkipping ? (
                                    <LoaderCircle className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                                ) : (
                                    <SkipForward className="mr-1.5 h-3.5 w-3.5" />
                                )}
                                Skip for now
                            </Button>
                        )}
                    </div>
                    <h1 className="text-3xl font-bold tracking-tight">
                        {STEP_META[step].title}
                    </h1>
                    <p className="text-muted-foreground">
                        {STEP_META[step].subtitle}
                    </p>
                </header>

                <div className="rounded-2xl border bg-card p-6 shadow-sm sm:p-8">
                    {step === 'account' && (
                        <AccountStep
                            onAccountCreated={handleAccountCreated}
                        />
                    )}
                    {step === 'profile' && signedInUser && (
                        <ProfileStep
                            defaultName={signedInUser.name}
                            initial={onboarding?.profile ?? null}
                            onComplete={(patch) =>
                                advance('business', {
                                    profile: patch,
                                    status: 'business',
                                })
                            }
                        />
                    )}
                    {step === 'business' && (
                        <BusinessStep
                            initial={onboarding?.business ?? null}
                            onBack={() => setStep('profile')}
                            onComplete={(patch) =>
                                advance('requirements', {
                                    business: patch,
                                    status: 'requirements',
                                })
                            }
                        />
                    )}
                    {step === 'requirements' && (
                        <RequirementsStep
                            initial={onboarding?.requirements ?? null}
                            onBack={() => setStep('business')}
                            onComplete={(patch: any) =>
                                advance('plan', {
                                    requirements: patch,
                                    status: 'plan',
                                })
                            }
                        />
                    )}
                    {step === 'plan' && (
                        <PlanStep
                            plans={initialPlans}
                            selectedModules={
                                onboarding?.requirements?.modules ?? []
                            }
                            paymentStatus={paymentStatus}
                            paymentReason={paymentReason}
                            onBack={() => setStep('requirements')}
                            onComplete={(planId: any) =>
                                advance('complete', {
                                    selectedPlanId: planId,
                                    status: 'complete',
                                })
                            }
                        />
                    )}
                    {step === 'complete' && (
                        <CompleteStep
                            userName={signedInUser?.name}
                            selectedModules={
                                onboarding?.requirements?.modules ?? []
                            }
                        />
                    )}
                </div>
            </section>
        </div>
    );
}

function StepNav({ currentStep }: { currentStep: WizardStep }) {
    const currentIndex = STEP_ORDER.indexOf(currentStep);
    return (
        <ol className="space-y-1">
            {STEP_ORDER.map((stepKey, idx) => {
                const done = idx < currentIndex;
                const active = idx === currentIndex;
                return (
                    <li
                        key={stepKey}
                        className={cn(
                            'flex items-start gap-3 rounded-xl px-3 py-3 transition',
                            active && 'bg-primary/10',
                            !active && 'hover:bg-muted/50'
                        )}
                    >
                        <div
                            className={cn(
                                'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold',
                                done &&
                                    'border-primary bg-primary text-primary-foreground',
                                active &&
                                    'border-primary bg-primary/20 text-primary',
                                !done &&
                                    !active &&
                                    'border-border bg-card text-muted-foreground'
                            )}
                        >
                            {done ? (
                                <Check className="h-3.5 w-3.5" />
                            ) : (
                                idx + 1
                            )}
                        </div>
                        <div>
                            <p
                                className={cn(
                                    'text-sm font-semibold',
                                    active ? 'text-foreground' : 'text-muted-foreground'
                                )}
                            >
                                {STEP_META[stepKey].title}
                            </p>
                            <p className="text-xs text-muted-foreground">
                                {STEP_META[stepKey].subtitle}
                            </p>
                        </div>
                    </li>
                );
            })}
        </ol>
    );
}
