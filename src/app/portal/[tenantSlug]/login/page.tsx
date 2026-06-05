import React from "react";
/**
 * Portal login page — public. Renders a minimal HTML shell (no CRM
 * app-shell, no auth) plus the `<PortalLoginForm>` interactive island.
 *
 * Phase 6.6 shell: deliberately bare-bones styling. A future polish pass
 * can swap the inline styles for the tenant's brand palette.
 */

import type { Metadata } from 'next';
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
        <main
            style={{
                minHeight: '100vh',
                background: 'var(--st-bg-secondary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 24,
                fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
            }}
        >
            <section
                style={{
                    width: '100%',
                    maxWidth: 420,
                    background: 'var(--st-bg)',
                    borderRadius: 16,
                    boxShadow: '0 1px 3px rgba(0,0,0,0.08), 0 8px 24px rgba(0,0,0,0.04)',
                    padding: 32,
                }}
            >
                <header style={{ marginBottom: 24 }}>
                    <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--st-text)', margin: 0 }}>
                        Sign in to your portal
                    </h1>
                    <p style={{ fontSize: 14, color: '#475569', marginTop: 8, marginBottom: 0 }}>
                        Enter your email and we&apos;ll send you a one-time sign-in link.
                    </p>
                </header>

                {errorMessage ? (
                    <div
                        role="alert"
                        style={{
                            background: '#fef2f2',
                            color: '#991b1b',
                            border: '1px solid #fecaca',
                            borderRadius: 10,
                            padding: '10px 12px',
                            fontSize: 13,
                            marginBottom: 16,
                        }}
                    >
                        {errorMessage}
                    </div>
                ) : null}

                <PortalLoginForm tenantSlug={tenantSlug} />

                <p style={{ fontSize: 12, color: 'var(--st-text-tertiary)', marginTop: 24, marginBottom: 0 }}>
                    Links expire in 15 minutes and can only be used once.
                </p>
            </section>
        </main>
    );
}


export default function PortalLoginPage({ params, searchParams }: PageProps) {
  return (
    <React.Suspense fallback={<div>Loading...</div>}>
      <PortalLoginPageContent params={params} searchParams={searchParams} />
    </React.Suspense>
  );
}
