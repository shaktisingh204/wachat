import { redirect } from 'next/navigation';

import type { Plan } from '@/lib/definitions';
import {
    getOnboardingPlans,
    getOnboardingState,
} from '@/app/actions/onboarding-flow.actions';
import { OnboardingWizard } from '@/components/wabasimplify/onboarding/onboarding-wizard';

export const dynamic = 'force-dynamic';

type OnboardingSearchParams = {
    payment?: string;
    reason?: string;
    txn?: string;
};

type PageProps = {
    searchParams?: Promise<OnboardingSearchParams>;
};

export default async function OnboardingPage({ searchParams }: PageProps) {
    const [{ user, onboarding }, rawPlans, resolvedSearchParams] =
        await Promise.all([
            getOnboardingState(),
            getOnboardingPlans(),
            (searchParams ?? Promise.resolve({})) as Promise<OnboardingSearchParams>,
        ]);

    const paymentStatus = resolvedSearchParams?.payment ?? null;

    // Onboarding already complete → go straight to dashboard.
    // (If PayU just redirected here with payment=success the callback
    // has already marked onboarding complete — so this path fires on
    // the return trip and forwards them on.)
    if (user && onboarding?.status === 'complete') {
        redirect('/wachat');
    }

    // getOnboardingPlans() already serializes ObjectIds to strings via
    // JSON.parse(JSON.stringify(...)), so the runtime shape matches what
    // the client-side wizard expects — cast at this boundary only.
    const plans = rawPlans as unknown as Array<Plan & { _id: string }>;

    return (
        <OnboardingWizard
            initialUser={user}
            initialOnboarding={onboarding}
            initialPlans={plans}
            paymentStatus={
                paymentStatus === 'success' || paymentStatus === 'failed'
                    ? paymentStatus
                    : null
            }
            paymentReason={resolvedSearchParams?.reason ?? null}
        />
    );
}
