'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
    signInWithEmailAndPassword,
    signInWithPopup,
    GoogleAuthProvider,
    FacebookAuthProvider,
} from 'firebase/auth';
import { AlertCircle, Eye, EyeOff, LoaderCircle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Alert,
    AlertDescription,
    AlertTitle,
} from '@/components/ui/alert';
import { auth } from '@/lib/firebase/config';

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

async function postSession(params: {
    idToken: string;
    name?: string | null;
    location: { latitude: number; longitude: number } | null;
}) {
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
    return res.json();
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

export function LoginForm() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const errorParam = searchParams.get('error');
    const nextParam = searchParams.get('next') || '/dashboard';

    const [error, setError] = React.useState<string | null>(errorParam);
    const [showPassword, setShowPassword] = React.useState(false);
    const [isPending, startTransition] = React.useTransition();
    const location = useBestEffortLocation();

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
                await postSession({ idToken, location });
                router.push(nextParam);
            } catch (err: any) {
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
                await postSession({
                    idToken,
                    name: result.user.displayName,
                    location,
                });
                router.push(nextParam);
            } catch (err: any) {
                setError(friendlyFirebaseError(err));
            }
        });
    };

    return (
        <Card className="w-full max-w-md shadow-2xl rounded-2xl border-border/40 backdrop-blur-sm">
            <form onSubmit={handleLogin} noValidate>
                <CardHeader className="space-y-2">
                    <CardTitle className="text-2xl font-bold font-headline">
                        Welcome back
                    </CardTitle>
                    <CardDescription>
                        Sign in to manage your WhatsApp, CRM, SEO, and
                        automation workspaces.
                    </CardDescription>
                </CardHeader>

                <CardContent className="space-y-5">
                    {error && (
                        <Alert variant="destructive">
                            <AlertCircle className="h-4 w-4" />
                            <AlertTitle>Sign-in failed</AlertTitle>
                            <AlertDescription>{error}</AlertDescription>
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
                                className="text-xs text-muted-foreground hover:text-primary"
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
                    </div>

                    <SubmitButton isPending={isPending} />

                    <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                            <span className="w-full border-t" />
                        </div>
                        <div className="relative flex justify-center text-xs uppercase">
                            <span className="bg-card px-2 text-muted-foreground">
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
                </CardContent>

                <CardFooter className="justify-center">
                    <p className="text-sm text-muted-foreground">
                        New to SabNode?{' '}
                        <Link
                            href="/onboarding"
                            className="font-semibold text-foreground hover:text-primary"
                        >
                            Start your setup
                        </Link>
                    </p>
                </CardFooter>
            </form>
        </Card>
    );
}

function friendlyFirebaseError(err: unknown): string {
    const code = (err as any)?.code as string | undefined;
    if (!code) return (err as any)?.message || 'Something went wrong.';
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
