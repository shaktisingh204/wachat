'use client';

import * as React from 'react';
import {
    createUserWithEmailAndPassword,
    signInWithPopup,
    GoogleAuthProvider,
    FacebookAuthProvider,
    updateProfile,
} from 'firebase/auth';
import { AlertCircle, Eye, EyeOff, LoaderCircle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Alert,
    AlertDescription,
    AlertTitle,
} from '@/components/ui/alert';
import { auth } from '@/lib/firebase/config';
import { consumePendingInviteToken } from '@/app/actions/team.actions';

interface AccountStepProps {
    onAccountCreated: (user: {
        _id: string;
        name: string;
        email: string;
    }) => void;
}

export function AccountStep({ onAccountCreated }: AccountStepProps) {
    const [isPending, startTransition] = React.useTransition();
    const [error, setError] = React.useState<string | null>(null);
    const [showPassword, setShowPassword] = React.useState(false);

    const handleEmailSignup = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setError(null);
        const fd = new FormData(e.currentTarget);
        const name = (fd.get('name') as string)?.trim();
        const email = (fd.get('email') as string)?.trim();
        const password = fd.get('password') as string;

        if (!name || !email || !password) {
            setError('Please fill in every field.');
            return;
        }
        if (password.length < 8) {
            setError('Password must be at least 8 characters.');
            return;
        }

        startTransition(async () => {
            try {
                const cred = await createUserWithEmailAndPassword(
                    auth,
                    email,
                    password
                );
                if (name) {
                    await updateProfile(cred.user, { displayName: name });
                }
                const idToken = await cred.user.getIdToken(true);
                const user = await postSession(idToken, name);
                // If we arrived here via an /invite/[token] link, auto-join the team.
                try { await consumePendingInviteToken(); } catch { /* non-fatal */ }
                onAccountCreated({
                    _id: user._id,
                    name: user.name || name,
                    email: user.email || email,
                });
            } catch (err: any) {
                setError(friendlyFirebaseError(err));
            }
        });
    };

    const handleSocial = (provider: 'google' | 'facebook') => {
        setError(null);
        const authProvider =
            provider === 'google'
                ? new GoogleAuthProvider()
                : new FacebookAuthProvider();
        startTransition(async () => {
            try {
                const result = await signInWithPopup(auth, authProvider);
                const idToken = await result.user.getIdToken(true);
                const user = await postSession(
                    idToken,
                    result.user.displayName ?? undefined
                );
                try { await consumePendingInviteToken(); } catch { /* non-fatal */ }
                onAccountCreated({
                    _id: user._id,
                    name: user.name || result.user.displayName || '',
                    email: user.email || result.user.email || '',
                });
            } catch (err: any) {
                setError(friendlyFirebaseError(err));
            }
        });
    };

    return (
        <div className="space-y-6">
            {error && (
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Could not create account</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
                <Button
                    variant="outline"
                    type="button"
                    disabled={isPending}
                    onClick={() => handleSocial('google')}
                >
                    <GoogleIcon />
                    Continue with Google
                </Button>
                <Button
                    variant="outline"
                    type="button"
                    disabled={isPending}
                    onClick={() => handleSocial('facebook')}
                >
                    <FacebookIcon />
                    Continue with Facebook
                </Button>
            </div>

            <div className="relative">
                <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-card px-2 text-muted-foreground">
                        Or use your email
                    </span>
                </div>
            </div>

            <form onSubmit={handleEmailSignup} className="space-y-4" noValidate>
                <div className="space-y-2">
                    <Label htmlFor="name">Full name</Label>
                    <Input
                        id="name"
                        name="name"
                        placeholder="Jane Cooper"
                        autoComplete="name"
                        required
                        disabled={isPending}
                    />
                </div>

                <div className="space-y-2">
                    <Label htmlFor="email">Work email</Label>
                    <Input
                        id="email"
                        name="email"
                        type="email"
                        placeholder="jane@company.com"
                        autoComplete="email"
                        required
                        disabled={isPending}
                    />
                </div>

                <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <div className="relative">
                        <Input
                            id="password"
                            name="password"
                            type={showPassword ? 'text' : 'password'}
                            placeholder="At least 8 characters"
                            autoComplete="new-password"
                            required
                            disabled={isPending}
                            className="pr-10"
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword((v) => !v)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                            aria-label={
                                showPassword
                                    ? 'Hide password'
                                    : 'Show password'
                            }
                        >
                            {showPassword ? (
                                <EyeOff className="h-4 w-4" />
                            ) : (
                                <Eye className="h-4 w-4" />
                            )}
                        </button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                        Must be at least 8 characters. Use a mix of letters
                        and numbers.
                    </p>
                </div>

                <Button
                    type="submit"
                    className="w-full h-11 text-base"
                    disabled={isPending}
                >
                    {isPending ? (
                        <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                    ) : null}
                    Create account & continue
                </Button>
            </form>
        </div>
    );
}

async function postSession(idToken: string, name?: string) {
    const res = await fetch('/api/auth/session', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${idToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(name ? { name } : {}),
    });
    if (!res.ok) {
        const msg = await res.text();
        throw new Error(msg || 'Could not create server session.');
    }
    const data = await res.json();
    return data.user;
}

function friendlyFirebaseError(err: unknown): string {
    const code = (err as any)?.code as string | undefined;
    if (!code) return (err as any)?.message || 'Something went wrong.';
    switch (code) {
        case 'auth/email-already-in-use':
            return 'An account with this email already exists. Try signing in instead.';
        case 'auth/invalid-email':
            return 'That email address looks invalid.';
        case 'auth/weak-password':
            return 'Password is too weak — please use at least 8 characters.';
        case 'auth/popup-closed-by-user':
            return 'Signup was cancelled.';
        case 'auth/network-request-failed':
            return 'Network error. Check your connection and try again.';
        default:
            return (err as any)?.message || 'Something went wrong.';
    }
}

function GoogleIcon() {
    return (
        <svg role="img" viewBox="0 0 24 24" className="mr-2 h-4 w-4">
            <path
                fill="currentColor"
                d="M12.48 10.92v3.28h7.84c-.24 1.84-.85 3.18-1.73 4.1-1.02 1.08-2.58 1.98-4.48 1.98-3.79 0-7.17-3.22-7.17-7.22s3.38-7.22 7.17-7.22c2.23 0 3.63.92 4.48 1.75l2.72-2.72C19.62 3.39 16.67 2 12.48 2 7.01 2 2.56 6.18 2.56 12s4.45 10 9.92 10c2.79 0 5.1-1 6.88-2.84 1.92-1.92 2.58-4.75 2.58-7.17 0-.66-.07-1.32-.19-1.98z"
            />
        </svg>
    );
}

function FacebookIcon() {
    return (
        <svg role="img" viewBox="0 0 24 24" className="mr-2 h-4 w-4">
            <path
                fill="currentColor"
                d="M22.675 0H1.325C.593 0 0 .593 0 1.325v21.35C0 23.407.593 24 1.325 24H12.82v-9.294H9.692v-3.622h3.128V8.413c0-3.1 1.893-4.788 4.659-4.788 1.325 0 2.463.099 2.795.143v3.24l-1.918.001c-1.504 0-1.795.715-1.795 1.763v2.313h3.587l-.467 3.622h-3.12V24h6.116c.732 0 1.325-.593 1.325-1.325V1.325C24 .593 23.407 0 22.675 0z"
            />
        </svg>
    );
}
