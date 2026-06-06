'use client';

import {
  Button,
  Card,
  ZoruCardContent,
  ZoruCardDescription,
  ZoruCardFooter,
  ZoruCardHeader,
  ZoruCardTitle,
  Input,
  Label,
  Alert,
  ZoruAlertDescription,
  ZoruAlertTitle,
  useZoruToast,
} from '@/components/sabcrm/20ui/compat';
import {
  useRouter,
  useSearchParams } from 'next/navigation';
import {
    signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  FacebookAuthProvider,
  } from 'firebase/auth';
import { AlertCircle,
  Eye,
  EyeOff,
  LoaderCircle } from 'lucide-react';

import React from 'react';
import Link from 'next/link';

import { auth } from '@/lib/firebase/config';
import { consumePendingInviteToken } from '@/app/actions/team.actions';

/**
 * Best-effort coarse location. We no longer BLOCK sign-in when the user
 * denies the prompt — location is useful for the admin analytics dashboard
 * but not required to authenticate.
 */
function useBestEffortLocation() {
    const [location, setLocation] = React.useState<{
        latitude: number;
        longitude: number;
    } | null>(null);

    React.useEffect(() => {
        if (!navigator.geolocation) return;
        const timer = setTimeout(() => {
            // Don't hang the UI waiting for geolocation
        }, 4000);
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                clearTimeout(timer);
                setLocation({
                    latitude: pos.coords.latitude,
                    longitude: pos.coords.longitude,
                });
            },
            () => clearTimeout(timer),
            { timeout: 4000, maximumAge: 60_000 }
        );
        return () => clearTimeout(timer);
    }, []);

    return location;
}

type SessionPostResult =
    | { kind: 'session'; user: unknown }
    | { kind: '2fa'; method: TwoFaMethod; userId: string };

type TwoFaMethod = 'email' | 'totp';

async function postSession(params: {
    idToken: string;
    name?: string | null;
    location: { latitude: number; longitude: number } | null;
}): Promise<SessionPostResult> {
    const { idToken, name, location } = params;
    const body: Record<string, unknown> = {};
    if (name) body.name = name;
    if (location) {
        body.location = {
            type: 'Point',
            coordinates: [location.longitude, location.latitude],
        };
    }
    const res = await fetch('/api/auth/session', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${idToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
    });
    if (!res.ok) {
        const msg = await res.text();
        throw new Error(msg || 'Session creation failed.');
    }
    const data = (await res.json()) as
        | { requires2fa?: boolean; method?: TwoFaMethod; userId?: string; user?: unknown };
    if (data?.requires2fa && data.method && data.userId) {
        return { kind: '2fa', method: data.method, userId: data.userId };
    }
    return { kind: 'session', user: data?.user };
}

async function postTwoFa(code: string): Promise<void> {
    const res = await fetch('/api/auth/two-fa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
    });
    if (!res.ok) {
        const msg = await res.text();
        const err = new Error(msg || 'Invalid code.') as Error & { status?: number };
        err.status = res.status;
        throw err;
    }
}

function SubmitButton({ isPending }: { isPending: boolean }) {
    return (
        <Button type="submit" className="w-full h-11 text-base" disabled={isPending}>
            {isPending ? (
                <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            Sign in
        </Button>
    );
}

type PendingChallenge = {
    method: TwoFaMethod;
    /** Last-used idToken so the "resend email code" button can re-trigger the session POST. */
    idToken: string;
    /** Carry forward the display name from social login so the re-POST matches. */
    name?: string | null;
};

export function LoginForm() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const errorParam = searchParams.get('error');
    const nextParam = searchParams.get('next') || '/wachat';
    const { toast } = useZoruToast();

    const [error, setError] = React.useState<string | null>(errorParam);
    const [showPassword, setShowPassword] = React.useState(false);
    const [isPending, startTransition] = React.useTransition();
    const location = useBestEffortLocation();

    // 2FA challenge state. When non-null, the form swaps to the 2FA panel.
    const [challenge, setChallenge] = React.useState<PendingChallenge | null>(null);

    const finishLogin = React.useCallback(async () => {
        // Carries the /invite/[token] cookie into a team attachment if present.
        let inviteProjectId: string | undefined;
        try {
            const res = await consumePendingInviteToken();
            if (res.consumed && res.projectId) inviteProjectId = res.projectId;
        } catch {
            /* non-fatal */
        }
        router.refresh();
        router.push(inviteProjectId ? '/wachat' : nextParam);
    }, [router, nextParam]);

    const handleLogin = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setError(null);

        const formData = new FormData(event.currentTarget);
        const email = (formData.get('email') as string)?.trim();
        const password = formData.get('password') as string;

        if (!email || !password) {
            setError('Please enter your email and password.');
            return;
        }

        startTransition(async () => {
            try {
                const credential = await signInWithEmailAndPassword(
                    auth,
                    email,
                    password
                );
                const idToken = await credential.user.getIdToken();
                const result = await postSession({ idToken, location });
                if (result.kind === '2fa') {
                    setChallenge({ method: result.method, idToken });
                    return;
                }
                await finishLogin();
            } catch (err) {
                setError(friendlyFirebaseError(err));
            }
        });
    };

    const handleSocialLogin = (provider: 'google' | 'facebook') => {
        setError(null);
        const authProvider =
            provider === 'google'
                ? new GoogleAuthProvider()
                : new FacebookAuthProvider();

        startTransition(async () => {
            try {
                const result = await signInWithPopup(auth, authProvider);
                const idToken = await result.user.getIdToken();
                const sessionRes = await postSession({
                    idToken,
                    name: result.user.displayName,
                    location,
                });
                if (sessionRes.kind === '2fa') {
                    setChallenge({
                        method: sessionRes.method,
                        idToken,
                        name: result.user.displayName,
                    });
                    return;
                }
                await finishLogin();
            } catch (err) {
                setError(friendlyFirebaseError(err));
            }
        });
    };

    if (challenge) {
        return (
            <TwoFaPanel
                challenge={challenge}
                isPending={isPending}
                startTransition={startTransition}
                onVerified={finishLogin}
                onCancel={() => {
                    setChallenge(null);
                    setError(null);
                }}
                onExpired={() => {
                    setChallenge(null);
                    setError('Session expired, please log in again.');
                }}
                onResend={() => {
                    startTransition(async () => {
                        try {
                            const res = await postSession({
                                idToken: challenge.idToken,
                                name: challenge.name ?? null,
                                location,
                            });
                            if (res.kind === '2fa') {
                                toast({
                                    title: 'Code resent',
                                    description: 'Check your inbox for a new 6-digit code.',
                                });
                            }
                        } catch (err) {
                            toast({
                                title: "Couldn't resend code",
                                description:
                                    err instanceof Error
                                        ? err.message
                                        : 'Please try again.',
                                variant: 'destructive',
                            });
                        }
                    });
                }}
            />
        );
    }

    return (
        <Card className="w-full max-w-md shadow-2xl rounded-2xl border-[var(--st-border)]/40 backdrop-blur-sm">
            <form onSubmit={handleLogin} noValidate>
                <ZoruCardHeader className="space-y-2">
                    <ZoruCardTitle className="text-2xl font-bold font-headline">
                        Welcome back
                    </ZoruCardTitle>
                    <ZoruCardDescription>
                        Sign in to manage your WhatsApp, CRM, SEO, and
                        automation workspaces.
                    </ZoruCardDescription>
                </ZoruCardHeader>

                <ZoruCardContent className="space-y-5">
                    {error && (
                        <Alert variant="destructive">
                            <AlertCircle className="h-4 w-4" />
                            <ZoruAlertTitle>Sign-in failed</ZoruAlertTitle>
                            <ZoruAlertDescription>{error}</ZoruAlertDescription>
                        </Alert>
                    )}

                    <div className="space-y-2">
                        <Label htmlFor="email">Email</Label>
                        <Input
                            id="email"
                            name="email"
                            type="email"
                            placeholder="you@company.com"
                            autoComplete="email"
                            required
                            disabled={isPending}
                        />
                    </div>

                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <Label htmlFor="password">Password</Label>
                            <Link
                                href="/forgot-password"
                                className="text-xs text-[var(--st-text-secondary)] hover:text-[var(--st-text)]"
                            >
                                Forgot password?
                            </Link>
                        </div>
                        <div className="relative">
                            <Input
                                id="password"
                                name="password"
                                type={showPassword ? 'text' : 'password'}
                                placeholder="••••••••"
                                autoComplete="current-password"
                                required
                                disabled={isPending}
                                className="pr-10"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword((v) => !v)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--st-text-secondary)] hover:text-[var(--st-text)]"
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
                    </div>

                    <SubmitButton isPending={isPending} />

                    <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                            <span className="w-full border-t" />
                        </div>
                        <div className="relative flex justify-center text-xs uppercase">
                            <span className="bg-[var(--st-bg-secondary)] px-2 text-[var(--st-text-secondary)]">
                                Or continue with
                            </span>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <Button
                            variant="outline"
                            type="button"
                            disabled={isPending}
                            onClick={() => handleSocialLogin('google')}
                        >
                            <GoogleIcon />
                            Google
                        </Button>
                        <Button
                            variant="outline"
                            type="button"
                            disabled={isPending}
                            onClick={() => handleSocialLogin('facebook')}
                        >
                            <FacebookIcon />
                            Facebook
                        </Button>
                    </div>
                </ZoruCardContent>

                <ZoruCardFooter className="justify-center">
                    <p className="text-sm text-[var(--st-text-secondary)]">
                        New to SabNode?{' '}
                        <Link
                            href="/onboarding"
                            className="font-semibold text-[var(--st-text)] hover:text-[var(--st-text)]"
                        >
                            Start your setup
                        </Link>
                    </p>
                </ZoruCardFooter>
            </form>
        </Card>
    );
}

function friendlyFirebaseError(err: unknown): string {
    const code = (err as { code?: string })?.code;
    const message = (err as { message?: string })?.message;
    if (!code) return message || 'Something went wrong.';
    switch (code) {
        case 'auth/invalid-credential':
        case 'auth/wrong-password':
        case 'auth/user-not-found':
            return 'Incorrect email or password.';
        case 'auth/too-many-requests':
            return 'Too many attempts. Please try again in a few minutes.';
        case 'auth/network-request-failed':
            return 'Network error. Check your connection and try again.';
        case 'auth/popup-closed-by-user':
            return 'Sign-in was cancelled.';
        default:
            return message || 'Something went wrong.';
    }
}

/**
 * The 2FA challenge panel. Swapped in by <LoginForm> once /api/auth/session
 * answers with `{ requires2fa: true }`. Posts the code (numeric or backup)
 * to /api/auth/two-fa, which mints the real session cookie.
 */
function TwoFaPanel(props: {
    challenge: PendingChallenge;
    isPending: boolean;
    startTransition: React.TransitionStartFunction;
    onVerified: () => Promise<void> | void;
    onCancel: () => void;
    onExpired: () => void;
    onResend: () => void;
}) {
    const { challenge, isPending, startTransition, onVerified, onCancel, onExpired, onResend } = props;
    const [mode, setMode] = React.useState<'code' | 'backup'>('code');
    const [code, setCode] = React.useState('');
    const [error, setError] = React.useState<string | null>(null);
    const inputRef = React.useRef<HTMLInputElement>(null);
    // Track the latest mode inside the auto-submit effect without re-triggering it.
    const modeRef = React.useRef(mode);
    React.useEffect(() => {
        modeRef.current = mode;
    }, [mode]);

    // Auto-focus the input whenever this panel renders / mode changes.
    React.useEffect(() => {
        inputRef.current?.focus();
    }, [mode]);

    const submit = React.useCallback(
        (value: string) => {
            setError(null);
            startTransition(async () => {
                try {
                    await postTwoFa(value);
                    await onVerified();
                } catch (err) {
                    const status = (err as { status?: number })?.status;
                    if (status === 401) {
                        const text = (err as { message?: string })?.message ?? '';
                        if (/no pending|invalid pending/i.test(text)) {
                            onExpired();
                            return;
                        }
                    }
                    setError('Invalid code. Try again.');
                    setCode('');
                    inputRef.current?.focus();
                }
            });
        },
        [onVerified, onExpired, startTransition]
    );

    // Auto-submit when the user has typed all 6 digits of a TOTP / email code.
    // Backup codes are 10 chars and not numeric — require explicit submit.
    React.useEffect(() => {
        if (modeRef.current !== 'code') return;
        if (code.length === 6 && /^[0-9]{6}$/.test(code) && !isPending) {
            submit(code);
        }
    }, [code, isPending, submit]);

    const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const value = code.trim();
        if (!value) return;
        submit(value);
    };

    const title =
        challenge.method === 'email'
            ? 'Check your email'
            : 'Two-Factor Authentication';
    const description =
        mode === 'backup'
            ? 'Enter one of your 10-character backup codes.'
            : challenge.method === 'email'
              ? 'We sent a 6-digit code to your email. Enter it below.'
              : 'Open your authenticator app and enter the 6-digit code.';

    return (
        <Card className="w-full max-w-md shadow-2xl rounded-2xl border-[var(--st-border)]/40 backdrop-blur-sm">
            <form onSubmit={handleSubmit} noValidate>
                <ZoruCardHeader className="space-y-2">
                    <ZoruCardTitle className="text-2xl font-bold font-headline">
                        {title}
                    </ZoruCardTitle>
                    <ZoruCardDescription>{description}</ZoruCardDescription>
                </ZoruCardHeader>

                <ZoruCardContent className="space-y-5">
                    {error && (
                        <Alert variant="destructive">
                            <AlertCircle className="h-4 w-4" />
                            <ZoruAlertTitle>Verification failed</ZoruAlertTitle>
                            <ZoruAlertDescription>{error}</ZoruAlertDescription>
                        </Alert>
                    )}

                    <div className="space-y-2">
                        <Label htmlFor="two-fa-code">
                            {mode === 'backup' ? 'Backup code' : 'Verification code'}
                        </Label>
                        <Input
                            ref={inputRef}
                            id="two-fa-code"
                            name="code"
                            value={code}
                            onChange={(e) => {
                                if (mode === 'code') {
                                    // Strip non-digits, cap at 6.
                                    setCode(e.target.value.replace(/\D/g, '').slice(0, 6));
                                } else {
                                    setCode(e.target.value.slice(0, 16));
                                }
                            }}
                            inputMode={mode === 'code' ? 'numeric' : 'text'}
                            pattern={mode === 'code' ? '[0-9]*' : undefined}
                            maxLength={mode === 'code' ? 6 : 16}
                            autoComplete={mode === 'code' ? 'one-time-code' : 'off'}
                            placeholder={mode === 'code' ? '123456' : 'ABCD-EFGH-IJ'}
                            disabled={isPending}
                            required
                            className="text-center tracking-[0.4em] text-lg"
                        />
                    </div>

                    <Button
                        type="submit"
                        className="w-full h-11 text-base"
                        disabled={isPending || code.trim().length === 0}
                    >
                        {isPending ? (
                            <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                        ) : null}
                        Verify
                    </Button>

                    <div className="flex flex-col items-center gap-2 text-sm">
                        <button
                            type="button"
                            className="text-[var(--st-text-secondary)] hover:text-[var(--st-text)] underline-offset-4 hover:underline"
                            onClick={() => {
                                setMode((m) => (m === 'code' ? 'backup' : 'code'));
                                setCode('');
                                setError(null);
                            }}
                            disabled={isPending}
                        >
                            {mode === 'code'
                                ? 'Use backup code instead'
                                : 'Use 6-digit code instead'}
                        </button>

                        {challenge.method === 'email' && mode === 'code' && (
                            <button
                                type="button"
                                className="text-[var(--st-text-secondary)] hover:text-[var(--st-text)] underline-offset-4 hover:underline"
                                onClick={onResend}
                                disabled={isPending}
                            >
                                Resend email code
                            </button>
                        )}
                    </div>
                </ZoruCardContent>

                <ZoruCardFooter className="justify-center">
                    <button
                        type="button"
                        onClick={onCancel}
                        disabled={isPending}
                        className="text-sm text-[var(--st-text-secondary)] hover:text-[var(--st-text)]"
                    >
                        Cancel and return to sign in
                    </button>
                </ZoruCardFooter>
            </form>
        </Card>
    );
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
