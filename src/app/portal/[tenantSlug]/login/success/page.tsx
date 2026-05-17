/**
 * Magic-link request acknowledgement. Intentionally generic — we never
 * confirm whether an account exists for the supplied email (anti
 * account-enumeration). The user is told to check their inbox either way.
 */

import type { Metadata } from 'next';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
    title: 'Check your email',
    robots: { index: false, follow: false },
};

interface PageProps {
    params: Promise<{ tenantSlug: string }>;
}

export default async function PortalLoginSuccessPage({ params }: PageProps) {
    const { tenantSlug } = await params;
    return (
        <main
            style={{
                minHeight: '100vh',
                background: '#f9fafb',
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
                    background: 'white',
                    borderRadius: 16,
                    boxShadow: '0 1px 3px rgba(0,0,0,0.08), 0 8px 24px rgba(0,0,0,0.04)',
                    padding: 32,
                    textAlign: 'center',
                }}
            >
                <h1 style={{ fontSize: 22, fontWeight: 700, color: '#0f172a', margin: 0 }}>
                    Check your email
                </h1>
                <p style={{ fontSize: 14, color: '#475569', marginTop: 12 }}>
                    If your address is on file, we&apos;ve sent you a sign-in link. It will
                    expire in 15 minutes and can only be used once.
                </p>
                <p style={{ fontSize: 13, color: '#94a3b8', marginTop: 24 }}>
                    Didn&apos;t get it?{' '}
                    <Link
                        href={`/portal/${encodeURIComponent(tenantSlug)}/login`}
                        style={{ color: '#0f172a', fontWeight: 600 }}
                    >
                        Request a new link
                    </Link>
                </p>
            </section>
        </main>
    );
}
