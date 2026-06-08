import React from "react";
/**
 * Portal login page - public. Renders a minimal 20ui shell (no CRM
 * app-shell, no auth) plus the `<PortalLoginForm>` interactive island.
 *
 * Pure 20ui: the page is scoped with the `ui20` class so design-system
 * tokens resolve outside the CRM shell, and chrome is built from Card +
 * Alert primitives. No raw control/primitive elements.
 */

import type { Metadata } from 'next';
import { Alert, Card, CardDescription, CardHeader, CardTitle } from '@/components/sabcrm/20ui';
import { PortalLoginForm } from './login-form';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
    title: 'Sign in to the portal',
    robots: { index: false, follow: false },
};

const ERROR_COPY: Record<string, string> = {
    invalid_or_expired: 'That sign-in link is invalid or has expired. Please request a new one.',
    already_consumed: 'That sign-in link has already been used. Please request a new one.',
    no_account: 'We could not find a portal account for that email. Please contact your account manager.',
    unknown_tenant: 'This portal is not available. Please double-check your link.',
    server_error: 'Something went wrong on our side. Please try again in a moment.',
};

interface PageProps {
    params: Promise<{ tenantSlug: string }>;
    searchParams: Promise<{ error?: string }>;
}

async function PortalLoginPageContent({ params, searchParams }: PageProps) {
    const { tenantSlug } = await params;
    const { error } = await searchParams;
    const errorMessage = error ? ERROR_COPY[error] ?? null : null;

    return (
        <main className="20ui flex min-h-screen items-center justify-center bg-[var(--st-bg-secondary)] p-6">
            <Card variant="elevated" padding="lg" className="w-full max-w-[420px]">
                <CardHeader>
                    <CardTitle>Sign in to your portal</CardTitle>
                    <CardDescription>
                        Enter your email and we&apos;ll send you a one-time sign-in link.
                    </CardDescription>
                </CardHeader>

                {errorMessage ? (
                    <Alert tone="danger" className="mb-4">
                        {errorMessage}
                    </Alert>
                ) : null}

                <PortalLoginForm tenantSlug={tenantSlug} />

                <p className="mt-6 mb-0 text-xs text-[var(--st-text-tertiary)]">
                    Links expire in 15 minutes and can only be used once.
                </p>
            </Card>
        </main>
    );
}


export default function PortalLoginPage({ params, searchParams }: PageProps) {
  return (
    <React.Suspense fallback={<div className="20ui flex min-h-screen items-center justify-center bg-[var(--st-bg-secondary)] text-sm text-[var(--st-text-secondary)]">Loading...</div>}>
      <PortalLoginPageContent params={params} searchParams={searchParams} />
    </React.Suspense>
  );
}
