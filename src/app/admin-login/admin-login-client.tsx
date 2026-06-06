'use client';

import React, { useState, useTransition, useEffect, Component, ReactNode } from 'react';
import Link from 'next/link';
import { handleAdminLogin, setupInitialAdmin } from '@/app/actions/admin.actions';
import { useRouter } from 'next/navigation';
import { Shield, Eye, EyeOff, LoaderCircle, AlertCircle, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

// ZoruUI Components
import {
    Button,
    Input,
    Label,
    Card,
    ZoruCardHeader,
    ZoruCardTitle,
    ZoruCardDescription,
    ZoruCardContent,
    Alert,
    ZoruAlertDescription,
} from '@/components/sabcrm/20ui/compat';

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
            <div className="min-h-screen flex items-center justify-center p-4 bg-zoru-ink">
                <Card className="bg-zoru-ink border-zoru-line text-white p-6 flex flex-col items-center gap-4 text-center max-w-md">
                    <AlertCircle className="h-10 w-10 text-zoru-ink" />
                    <div>
                        <h2 className="text-lg font-semibold text-white">Something went wrong</h2>
                        <p className="text-sm text-zoru-ink-muted">There was a problem loading the admin portal.</p>
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
        <div className="min-h-screen bg-zoru-ink flex items-center justify-center p-4 relative overflow-hidden">
            {/* Ambient glow blobs */}
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
                <div className="absolute -top-40 -left-40 h-96 w-96 rounded-full bg-zoru-ink/10 blur-[120px]" />
                <div className="absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-zoru-surface-2/10 blur-[120px]" />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-64 w-64 rounded-full bg-zoru-ink/40 blur-[80px]" />
            </div>

            {/* Subtle grid */}
            <div
                className="pointer-events-none absolute inset-0 opacity-[0.5]"
                style={{
                    backgroundImage: `linear-gradient(rgba(244,244,245,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(244,244,245,0.04) 1px, transparent 1px)`,
                    backgroundSize: '40px 40px',
                }}
            />

            {/* Back to site */}
            <div className="absolute top-6 left-6 z-10">
                <Link href="/" className="flex items-center gap-2 text-zoru-ink-muted hover:text-zoru-ink-muted text-sm transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg>
                    Back to site
                </Link>
            </div>

            {/* Card */}
            <div className="relative w-full max-w-md">
                <Card className="bg-zoru-ink border-zoru-line text-white shadow-2xl">
                    <ZoruCardHeader className="text-center space-y-3">
                        <div className={cn(
                            "mx-auto w-14 h-14 rounded-2xl border flex items-center justify-center",
                            mode === 'setup'
                                ? "bg-zoru-ink/10 border-zoru-line/30"
                                : "bg-zoru-ink/10 border-zoru-line/30"
                        )}>
                            {mode === 'setup'
                                ? <Sparkles className="h-7 w-7 text-zoru-ink-muted" />
                                : <Shield className="h-7 w-7 text-zoru-ink-muted" />
                            }
                        </div>
                        {mode === 'setup' ? (
                            <>
                                <ZoruCardTitle className="text-2xl font-bold text-white tracking-tight">First-time setup</ZoruCardTitle>
                                <ZoruCardDescription className="text-sm text-zoru-ink-muted">Create the admin account for this workspace</ZoruCardDescription>
                            </>
                        ) : (
                            <>
                                <ZoruCardTitle className="text-2xl font-bold text-white tracking-tight">Admin Portal</ZoruCardTitle>
                                <ZoruCardDescription className="text-sm text-zoru-ink-muted">Restricted access — authorized personnel only</ZoruCardDescription>
                            </>
                        )}
                    </ZoruCardHeader>

                    <ZoruCardContent className="space-y-6">
                        {/* Error */}
                        {state.error && state.error !== 'NEEDS_SETUP' && (
                            <Alert variant="destructive" className="border-zoru-line/40 bg-zoru-ink/10 text-zoru-ink-muted">
                                <AlertCircle className="h-4 w-4 text-zoru-ink-muted" />
                                <ZoruAlertDescription className="text-sm text-zoru-ink-muted">{state.error}</ZoruAlertDescription>
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
                                    <div className="absolute inset-0 flex items-center">
                                        <span className="w-full border-t border-zoru-line" />
                                    </div>
                                    <div className="relative flex justify-center text-xs uppercase">
                                        <span className="bg-zoru-ink px-2 text-zoru-ink font-medium">Or continue with</span>
                                    </div>
                                </div>

                                <div className="flex flex-col gap-3">
                                    <Button
                                        variant="outline"
                                        type="button"
                                        block
                                        onClick={handleSsoLogin}
                                        className="bg-zoru-ink border-zoru-line text-white hover:bg-zoru-ink hover:text-white"
                                        leading={
                                            <svg className="h-4 w-4 text-zoru-ink-muted mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                                        }
                                    >
                                        Corporate SSO (SAML)
                                    </Button>
                                    <Button
                                        variant="outline"
                                        type="button"
                                        block
                                        onClick={handleGoogleLogin}
                                        className="bg-zoru-ink border-zoru-line text-white hover:bg-zoru-ink hover:text-white"
                                        leading={
                                            <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                                        }
                                    >
                                        Google Workspace
                                    </Button>
                                </div>
                            </div>
                        )}

                        {/* Footer note */}
                        <p className="text-center text-xs text-zoru-ink">
                            {mode === 'setup'
                                ? 'This form is only available when no admin exists. It becomes inactive afterwards.'
                                : 'All actions in this panel are logged and audited.'}
                        </p>
                    </ZoruCardContent>
                </Card>
            </div>

            {/* Bottom copyright */}
            <div className="absolute bottom-6 text-center w-full">
                <p className="text-xs text-zoru-ink">
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
                    className="bg-zoru-ink border-zoru-line text-white placeholder:text-zoru-ink"
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
                        placeholder="••••••••••••"
                        className="bg-zoru-ink border-zoru-line text-white placeholder:text-zoru-ink pr-12"
                    />
                    <PasswordToggle show={showPassword} onToggle={() => setShowPassword(v => !v)} />
                </div>
            </Field>

            <Button
                variant="primary"
                type="submit"
                disabled={isPending}
                block
                className="bg-zoru-ink hover:bg-zoru-surface-2 text-zoru-ink font-semibold border-zoru-line hover:border-zoru-line shadow-zoru-line/25 mt-2"
            >
                {isPending
                    ? <><LoaderCircle className="h-4 w-4 animate-spin mr-2 inline-block" /> Authenticating…</>
                    : 'Sign In to Admin Panel'
                }
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
                    className="bg-zoru-ink border-zoru-line text-white placeholder:text-zoru-ink"
                />
            </Field>

            <Field label="Password" hint="Minimum 10 characters">
                <div className="relative">
                    <Input
                        id="password"
                        name="password"
                        type={showPassword ? 'text' : 'password'}
                        required
                        minLength={10}
                        autoComplete="new-password"
                        placeholder="At least 10 characters"
                        className="bg-zoru-ink border-zoru-line text-white placeholder:text-zoru-ink pr-12"
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
                        className="bg-zoru-ink border-zoru-line text-white placeholder:text-zoru-ink pr-12"
                    />
                    <PasswordToggle show={showConfirm} onToggle={() => setShowConfirm(v => !v)} />
                </div>
            </Field>

            <Button
                variant="primary"
                type="submit"
                disabled={isPending}
                block
                className="bg-zoru-ink hover:bg-zoru-surface-2 text-zoru-ink font-semibold border-zoru-line hover:border-zoru-line shadow-zoru-line/25 mt-2"
            >
                {isPending
                    ? <><LoaderCircle className="h-4 w-4 animate-spin mr-2 inline-block" /> Creating admin…</>
                    : 'Create admin account'
                }
            </Button>
        </form>
    );
}

/* ---------- small UI primitives ---------- */

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
    return (
        <div className="space-y-1.5">
            <div className="flex items-baseline justify-between">
                <Label className="text-xs uppercase tracking-wider text-zoru-ink-muted">{label}</Label>
                {hint && <span className="text-[10.5px] text-zoru-ink">{hint}</span>}
            </div>
            {children}
        </div>
    );
}

function PasswordToggle({ show, onToggle }: { show: boolean; onToggle: () => void }) {
    return (
        <button
            type="button"
            onClick={onToggle}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-zoru-ink hover:text-zoru-ink-muted transition-colors z-10"
            tabIndex={-1}
        >
            {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
    );
}
