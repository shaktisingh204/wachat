import React from "react";
/**
 * Magic-link request acknowledgement. Intentionally generic — we never
 * confirm whether an account exists for the supplied email (anti
 * account-enumeration). The user is told to check their inbox either way.
 */

import type { Metadata } from 'next';
import { SuccessClient } from './success-client';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
    title: 'Check your email',
    robots: { index: false, follow: false },
};

interface PageProps {
    params: Promise<{ tenantSlug: string }>;
}

async function PortalLoginSuccessPageContent({ params }: PageProps) {
    const { tenantSlug } = await params;
    
    return (
        <main className="flex min-h-screen items-center justify-center bg-[var(--st-bg-muted)] p-6 font-sans">
            <section className="w-full max-w-[420px] rounded-2xl bg-white p-8 text-center shadow-[0_1px_3px_rgba(0,0,0,0.08),0_8px_24px_rgba(0,0,0,0.04)]">
                <h1 className="m-0 text-[22px] font-bold text-[var(--st-text)]">
                    Check your email
                </h1>
                <p className="mt-3 text-sm text-[var(--st-text)]">
                    If your address is on file, we&apos;ve sent you a sign-in link. It will
                    expire in 15 minutes and can only be used once.
                </p>
                <SuccessClient tenantSlug={tenantSlug} />
            </section>
        </main>
    );
}


export default function PortalLoginSuccessPage({ params }: PageProps) {
  return (
    <React.Suspense fallback={<div>Loading...</div>}>
      <PortalLoginSuccessPageContent params={params} />
    </React.Suspense>
  );
}
