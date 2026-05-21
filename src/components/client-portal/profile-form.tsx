'use client';

/**
 * Client portal profile form. Edits name / mobile / password via
 * `updateClientProfile`. Email is shown read-only (we don't allow
 * changing the login email from inside the portal — that's an
 * account-recovery flow handled elsewhere).
 */

import * as React from 'react';
import { useRouter } from 'next/navigation';

import { ZoruButton } from '@/components/zoruui/button';
import { ZoruInput } from '@/components/zoruui/input';
import { ZoruLabel } from '@/components/zoruui/label';
import { updateClientProfile } from '@/app/actions/client-portal.actions';

export interface ProfileFormProps {
    initialName: string;
    email: string;
    initialMobile: string;
}

export function ProfileForm({ initialName, email, initialMobile }: ProfileFormProps) {
    const router = useRouter();
    const [name, setName] = React.useState(initialName);
    const [mobile, setMobile] = React.useState(initialMobile);
    const [password, setPassword] = React.useState('');
    const [submitting, setSubmitting] = React.useState(false);
    const [message, setMessage] = React.useState<string | null>(null);
    const [error, setError] = React.useState<string | null>(null);

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setError(null);
        setMessage(null);
        if (password && password.length < 8) {
            setError('New password must be at least 8 characters.');
            return;
        }
        setSubmitting(true);
        const res = await updateClientProfile({
            name,
            mobile,
            password: password || undefined,
        });
        setSubmitting(false);
        if (res.error) {
            setError(res.error);
            return;
        }
        setMessage('Profile updated.');
        setPassword('');
        router.refresh();
    };

    return (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
                <ZoruLabel htmlFor="pf-name">Name</ZoruLabel>
                <ZoruInput
                    id="pf-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                />
            </div>
            <div className="flex flex-col gap-1.5">
                <ZoruLabel htmlFor="pf-email">Email</ZoruLabel>
                <ZoruInput id="pf-email" value={email} readOnly disabled />
                <p className="text-xs text-zoru-ink-muted">
                    Contact support to change your sign-in email.
                </p>
            </div>
            <div className="flex flex-col gap-1.5">
                <ZoruLabel htmlFor="pf-mobile">Mobile</ZoruLabel>
                <ZoruInput
                    id="pf-mobile"
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value)}
                    type="tel"
                    autoComplete="tel"
                />
            </div>
            <div className="flex flex-col gap-1.5">
                <ZoruLabel htmlFor="pf-password">New password</ZoruLabel>
                <ZoruInput
                    id="pf-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    type="password"
                    placeholder="Leave blank to keep current password"
                    autoComplete="new-password"
                    minLength={8}
                />
            </div>
            {error ? (
                <div className="text-sm text-zoru-danger-ink" role="alert">
                    {error}
                </div>
            ) : null}
            {message ? (
                <div className="text-sm text-zoru-ink-muted" role="status">
                    {message}
                </div>
            ) : null}
            <div className="flex justify-end">
                <ZoruButton type="submit" disabled={submitting}>
                    {submitting ? 'Saving…' : 'Save changes'}
                </ZoruButton>
            </div>
        </form>
    );
}
