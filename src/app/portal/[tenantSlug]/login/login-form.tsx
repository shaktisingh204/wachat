'use client';

/**
 * Client wrapper for the magic-link request form. Keeps the host page
 * a pure Server Component so it can stay fully cacheable for crawlers
 * — only the small interactive island ships JS.
 */

import { useState, useTransition } from 'react';
import { requestPortalMagicLink } from '@/app/actions/crm-portal-auth.actions';
import { useRouter } from 'next/navigation';

export function PortalLoginForm({ tenantSlug }: { tenantSlug: string }) {
    const router = useRouter();
    const [email, setEmail] = useState('');
    const [isPending, startTransition] = useTransition();
    const [localError, setLocalError] = useState<string | null>(null);

    function onSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        const trimmed = email.trim();
        if (!trimmed || !trimmed.includes('@')) {
            setLocalError('Please enter a valid email address.');
            return;
        }
        setLocalError(null);
        startTransition(async () => {
            await requestPortalMagicLink(tenantSlug, trimmed);
            // We always navigate to success — the action never reveals
            // whether the account exists.
            router.push(`/portal/${encodeURIComponent(tenantSlug)}/login/success`);
        });
    }

    return (
        <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <label
                htmlFor="portal-email"
                style={{ fontSize: 13, fontWeight: 500, color: '#1f2937' }}
            >
                Email address
            </label>
            <input
                id="portal-email"
                type="email"
                name="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                disabled={isPending}
                style={{
                    border: '1px solid #d1d5db',
                    borderRadius: 8,
                    padding: '10px 12px',
                    fontSize: 14,
                    outline: 'none',
                }}
            />
            {localError ? (
                <div role="alert" style={{ color: 'var(--st-danger)', fontSize: 13 }}>
                    {localError}
                </div>
            ) : null}
            <button
                type="submit"
                disabled={isPending}
                style={{
                    background: '#0f172a',
                    color: 'white',
                    borderRadius: 8,
                    padding: '10px 12px',
                    fontSize: 14,
                    fontWeight: 600,
                    border: 'none',
                    cursor: isPending ? 'wait' : 'pointer',
                }}
            >
                {isPending ? 'Sending…' : 'Send sign-in link'}
            </button>
        </form>
    );
}
