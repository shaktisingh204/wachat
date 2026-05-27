import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import type { Plan } from '@/lib/definitions';
import {
    getOnboardingPlans,
    getOnboardingState,
} from '@/app/actions/onboarding-flow.actions';
import { OnboardingWizard } from '@/components/zoruui-domain/onboarding/onboarding-wizard';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
    title: 'Onboarding | SabNode Platform Core',
    description: 'Set up your workspace and customize your experience.',
};

type OnboardingSearchParams = {
    payment?: string;
    reason?: string;
    txn?: string;
};

type PageProps = {
    searchParams?: Promise<OnboardingSearchParams>;
};

// Add strict TypeScript typing for API responses
type SerializedPlan = Plan & { _id: string; price?: number };
type OnboardingStateResponse = Awaited<ReturnType<typeof getOnboardingState>>;

// Refactored data fetching into a smaller chunk
async function fetchOnboardingData(searchParamsPromise?: Promise<OnboardingSearchParams>) {
    const [stateResult, rawPlans, resolvedSearchParams] = await Promise.all([
        getOnboardingState(),
        getOnboardingPlans(),
        (searchParamsPromise ?? Promise.resolve({})) as Promise<OnboardingSearchParams>,
    ]);

    const fetchedPlans = rawPlans as unknown as Array<SerializedPlan>;

    // Robust sorting and filtering
    const sortedPlans = fetchedPlans
        .filter((plan) => plan.isActive !== false) // Basic filter for active plans
        .sort((a, b) => {
            const priceA = a.price ?? 0;
            const priceB = b.price ?? 0;
            return priceA - priceB;
        });

    return {
        stateResult,
        sortedPlans,
        resolvedSearchParams,
    };
}

export default async function OnboardingPage({ searchParams }: PageProps) {
    const { stateResult, sortedPlans, resolvedSearchParams } = await fetchOnboardingData(searchParams);
    const { user, onboarding } = stateResult;

    const paymentStatus = resolvedSearchParams?.payment ?? null;

    // Onboarding already complete → go straight to dashboard.
    // (If PayU just redirected here with payment=success the callback
    // has already marked onboarding complete — so this path fires on
    // the return trip and forwards them on.)
    if (user && onboarding?.status === 'complete') {
        redirect('/wachat');
    }

    return (
        <OnboardingWizard
            initialUser={user}
            initialOnboarding={onboarding}
            initialPlans={sortedPlans}
            paymentStatus={
                paymentStatus === 'success' || paymentStatus === 'failed'
                    ? paymentStatus
                    : null
            }
            paymentReason={resolvedSearchParams?.reason ?? null}
        />
    );
}
