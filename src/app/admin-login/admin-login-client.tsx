'use client';

import React, { useState, useTransition, useEffect, Component, ReactNode } from 'react';
import Link from 'next/link';
import { handleAdminLogin, setupInitialAdmin } from '@/app/actions/admin.actions';
import { useRouter } from 'next/navigation';
import { Shield, Eye, EyeOff, AlertCircle, Sparkles, ArrowLeft, ShieldCheck } from 'lucide-react';

import {
    Button,
    IconButton,
    Input,
    Field,
    Card,
    CardHeader,
    CardTitle,
    CardDescription,
    CardBody,
    Alert,
    AlertDescription,
} from '@/components/sabcrm/20ui';

// --- Error Boundary ---
class ErrorBoundary extends Component<{ children: ReactNode, fallback: ReactNode }, { hasError: boolean }> {
    constructor(props: { children: ReactNode, fallback: ReactNode }) {
        super(props);
        this.state = { hasError: false };
    }
    static getDerivedStateFromError() {
        return { hasError: true };
    }
    render() {
        if (this.state.hasError) {
            return this.props.fallback;
        }
        return this.props.children;
    }
}

const initialState = { success: false, error: undefined as string | undefined };

type Mode = 'login' | 'setup';

export default function AdminLoginClient({ initialMode }: { initialMode: Mode }) {
    return (
        <ErrorBoundary fallback={
            <div className="20ui dark min-h-screen flex items-center justify-center p-4 bg-[var(--st-bg)]">
                <Card className="flex flex-col items-center gap-4 text-center max-w-md">
                    <AlertCircle className="h-10 w-10 text-[var(--st-danger)]" aria-hidden="true" />
                    <div>
                        <h2 className="text-lg font-semibold text-[var(--st-text)]">Something went wrong</h2>
                        <p className="text-sm text-[var(--st-text-secondary)]">There was a problem loading the admin portal.</p>
                    </div>
                    <Button variant="outline" onClick={() => window.location.reload()}>Reload Page</Button>
                </Card>
            </div>
        }>
            <AdminLoginClientContent initialMode={initialMode} />
        </ErrorBoundary>
    );
}

function AdminLoginClientContent({ initialMode }: { initialMode: Mode }) {
    const [mode, setMode] = useState<Mode>(initialMode);
    const [state, setState] = useState(initialState);
    const [isPending, startTransition] = useTransition();
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const router = useRouter();

    const loginAction = (formData: FormData) => {
        startTransition(async () => {
            const result = await handleAdminLogin(initialState, formData);
            if (!result.success && result.error === 'NEEDS_SETUP') {
                setMode('setup');
                setState(initialState);
                return;
            }
            setState(result as typeof initialState);
        });
    };

    const setupAction = (formData: FormData) => {
        startTransition(async () => {
            const result = await setupInitialAdmin(initialState, formData);
            setState(result as typeof initialState);
        });
    };

    useEffect(() => {
        if (state.success) router.push('/admin/dashboard');
    }, [state.success, router]);

    const handleSsoLogin = () => {
        // Redirect to SAML/SSO for admin
        window.location.href = '/api/auth/saml?admin=true';
    };

    const handleGoogleLogin = () => {
        // Redirect to Google OAuth for admin
        window.location.href = '/api/crm/auth/google?admin=true';
    };

    return (
        <div className="20ui dark min-h-screen bg-[var(--st-bg)] flex items-center justify-center p-4 relative overflow-hidden">
            {/* Ambient glow blobs */}
            <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
                <div className="absolute -top-40 -left-40 h-96 w-96 rounded-full bg-[var(--st-accent)]/10 blur-[120px]" />
                <div className="absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-[var(--st-bg-muted)]/40 blur-[120px]" />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-64 w-64 rounded-full bg-[var(--st-accent)]/10 blur-[80px]" />
            </div>

            {/* Subtle grid */}
            <div
                className="pointer-events-none absolute inset-0 opacity-[0.5] bg-[length:40px_40px] bg-[linear-gradient(var(--st-border-light)_1px,transparent_1px),linear-gradient(90deg,var(--st-border-light)_1px,transparent_1px)]"
                aria-hidden="true"
            />

            {/* Back to site */}
            <div className="absolute top-6 left-6 z-10">
                <Link href="/" className="flex items-center gap-2 text-[var(--st-text-secondary)] hover:text-[var(--st-text)] text-sm transition-colors">
                    <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                    Back to site
                </Link>
            </div>

            {/* Card */}
            <div className="relative w-full max-w-md">
                <Card className="shadow-2xl">
                    <CardHeader className="text-center space-y-3">
                        <div className="mx-auto w-14 h-14 rounded-[var(--st-radius-lg)] border border-[var(--st-border)] bg-[var(--st-accent)]/10 flex items-center justify-center">
                            {mode === 'setup'
                                ? <Sparkles className="h-7 w-7 text-[var(--st-accent)]" aria-hidden="true" />
                                : <Shield className="h-7 w-7 text-[var(--st-accent)]" aria-hidden="true" />
                            }
                        </div>
                        {mode === 'setup' ? (
                            <>
                                <CardTitle className="text-2xl font-bold tracking-tight">First-time setup</CardTitle>
                                <CardDescription className="text-sm">Create the admin account for this workspace</CardDescription>
                            </>
                        ) : (
                            <>
                                <CardTitle className="text-2xl font-bold tracking-tight">Admin Portal</CardTitle>
                                <CardDescription className="text-sm">Restricted access, authorized personnel only</CardDescription>
                            </>
                        )}
                    </CardHeader>

                    <CardBody className="space-y-6">
                        {/* Error */}
                        {state.error && state.error !== 'NEEDS_SETUP' && (
                            <Alert variant="destructive">
                                <AlertDescription>{state.error}</AlertDescription>
                            </Alert>
                        )}

                        {mode === 'setup' ? (
                            <SetupForm
                                action={setupAction}
                                isPending={isPending}
                                showPassword={showPassword}
                                setShowPassword={setShowPassword}
                                showConfirm={showConfirm}
                                setShowConfirm={setShowConfirm}
                            />
                        ) : (
                            <LoginForm
                                action={loginAction}
                                isPending={isPending}
                                showPassword={showPassword}
                                setShowPassword={setShowPassword}
                            />
                        )}

                        {/* SSO section only for login */}
                        {mode === 'login' && (
                            <div className="space-y-4">
                                <div className="relative">
                                    <div className="absolute inset-0 flex items-center" aria-hidden="true">
                                        <span className="w-full border-t border-[var(--st-border)]" />
                                    </div>
                                    <div className="relative flex justify-center text-xs uppercase">
                                        <span className="bg-[var(--st-bg-secondary)] px-2 text-[var(--st-text-tertiary)] font-medium">Or continue with</span>
                                    </div>
                                </div>

                                <div className="flex flex-col gap-3">
                                    <Button
                                        variant="outline"
                                        type="button"
                                        block
                                        onClick={handleSsoLogin}
                                        iconLeft={ShieldCheck}
                                    >
                                        Corporate SSO (SAML)
                                    </Button>
                                    <Button
                                        variant="outline"
                                        type="button"
                                        block
                                        onClick={handleGoogleLogin}
                                    >
                                        Google Workspace
                                    </Button>
                                </div>
                            </div>
                        )}

                        {/* Footer note */}
                        <p className="text-center text-xs text-[var(--st-text-tertiary)]">
                            {mode === 'setup'
                                ? 'This form is only available when no admin exists. It becomes inactive afterwards.'
                                : 'All actions in this panel are logged and audited.'}
                        </p>
                    </CardBody>
                </Card>
            </div>

            {/* Bottom copyright */}
            <div className="absolute bottom-6 text-center w-full">
                <p className="text-xs text-[var(--st-text-tertiary)]">
                    © {new Date().getFullYear()} SabNode. All Rights Reserved.
                </p>
            </div>
        </div>
    );
}

/* ------------------------------------------------------------------ */

function LoginForm({
    action,
    isPending,
    showPassword,
    setShowPassword,
}: {
    action: (formData: FormData) => void;
    isPending: boolean;
    showPassword: boolean;
    setShowPassword: (fn: (v: boolean) => boolean) => void;
}) {
    return (
        <form action={action} className="space-y-4">
            <Field label="Admin Email">
                <Input
                    id="email"
                    name="email"
                    type="email"
                    required
                    autoComplete="email"
                    placeholder="admin@example.com"
                />
            </Field>

            <Field label="Password">
                <div className="relative">
                    <Input
                        id="password"
                        name="password"
                        type={showPassword ? 'text' : 'password'}
                        required
                        autoComplete="current-password"
                        placeholder="Enter your password"
                        className="pr-12"
                    />
                    <PasswordToggle show={showPassword} onToggle={() => setShowPassword(v => !v)} />
                </div>
            </Field>

            <Button
                variant="primary"
                type="submit"
                disabled={isPending}
                loading={isPending}
                block
                className="mt-2"
            >
                {isPending ? 'Authenticating' : 'Sign In to Admin Panel'}
            </Button>
        </form>
    );
}

function SetupForm({
    action,
    isPending,
    showPassword,
    setShowPassword,
    showConfirm,
    setShowConfirm,
}: {
    action: (formData: FormData) => void;
    isPending: boolean;
    showPassword: boolean;
    setShowPassword: (fn: (v: boolean) => boolean) => void;
    showConfirm: boolean;
    setShowConfirm: (fn: (v: boolean) => boolean) => void;
}) {
    return (
        <form action={action} className="space-y-4">
            <Field label="Admin Email">
                <Input
                    id="email"
                    name="email"
                    type="email"
                    required
                    autoComplete="email"
                    placeholder="you@company.com"
                />
            </Field>

            <Field label="Password" help="Minimum 10 characters">
                <div className="relative">
                    <Input
                        id="password"
                        name="password"
                        type={showPassword ? 'text' : 'password'}
                        required
                        minLength={10}
                        autoComplete="new-password"
                        placeholder="At least 10 characters"
                        className="pr-12"
                    />
                    <PasswordToggle show={showPassword} onToggle={() => setShowPassword(v => !v)} />
                </div>
            </Field>

            <Field label="Confirm Password">
                <div className="relative">
                    <Input
                        id="confirmPassword"
                        name="confirmPassword"
                        type={showConfirm ? 'text' : 'password'}
                        required
                        minLength={10}
                        autoComplete="new-password"
                        placeholder="Repeat password"
                        className="pr-12"
                    />
                    <PasswordToggle show={showConfirm} onToggle={() => setShowConfirm(v => !v)} />
                </div>
            </Field>

            <Button
                variant="primary"
                type="submit"
                disabled={isPending}
                loading={isPending}
                block
                className="mt-2"
            >
                {isPending ? 'Creating admin' : 'Create admin account'}
            </Button>
        </form>
    );
}

/* ---------- small UI primitives ---------- */

function PasswordToggle({ show, onToggle }: { show: boolean; onToggle: () => void }) {
    return (
        <div className="absolute right-2 top-1/2 -translate-y-1/2 z-10">
            <IconButton
                label={show ? 'Hide password' : 'Show password'}
                icon={show ? EyeOff : Eye}
                variant="ghost"
                size="sm"
                onClick={onToggle}
                tabIndex={-1}
            />
        </div>
    );
}
