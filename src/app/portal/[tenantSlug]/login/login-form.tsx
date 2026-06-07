'use client';

/**
 * Client wrapper for the magic-link request form. Keeps the host page
 * a pure Server Component so it can stay fully cacheable for crawlers.
 * Only the small interactive island ships JS.
 */

import { useState, useTransition } from 'react';
import { requestPortalMagicLink } from '@/app/actions/crm-portal-auth.actions';
import { useRouter } from 'next/navigation';
import { Button, Field, Input } from '@/components/sabcrm/20ui';

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
            // We always navigate to success. The action never reveals
            // whether the account exists.
            router.push(`/portal/${encodeURIComponent(tenantSlug)}/login/success`);
        });
    }

    return (
        <form onSubmit={onSubmit} className="ui20 flex flex-col gap-3">
            <Field label="Email address" error={localError ?? undefined}>
                <Input
                    id="portal-email"
                    type="email"
                    name="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    disabled={isPending}
                />
            </Field>
            <Button type="submit" variant="primary" block loading={isPending}>
                {isPending ? 'Sending' : 'Send sign-in link'}
            </Button>
        </form>
    );
}
