'use client';

import { useState, useTransition, useEffect } from 'react';
import Link from 'next/link';
import { handleAdminLogin, isAdminConfigured, setupInitialAdmin } from '@/app/actions/admin.actions';
import { useRouter } from 'next/navigation';
import { Shield, Eye, EyeOff, LoaderCircle, AlertCircle, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

const initialState = { success: false, error: undefined as string | undefined };

type Mode = 'loading' | 'login' | 'setup';

export default function AdminLoginPage() {
    const [mode, setMode] = useState<Mode>('loading');
    const [state, setState] = useState(initialState);
    const [isPending, startTransition] = useTransition();
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const router = useRouter();

    // Decide login vs setup on mount.
    useEffect(() => {
        let cancelled = false;
        isAdminConfigured()
            .then(configured => {
                if (!cancelled) setMode(configured ? 'login' : 'setup');
            })
            .catch(() => {
                if (!cancelled) setMode('login');
            });
        return () => { cancelled = true; };
    }, []);

    const loginAction = (formData: FormData) => {
        startTransition(async () => {
            const result = await handleAdminLogin(initialState, formData);
            // Server signals "no admin configured" — swap to setup form.
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

    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 relative overflow-hidden">
            {/* Ambient glow blobs */}
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
                <div className="absolute -top-40 -left-40 h-96 w-96 rounded-full bg-amber-200/50 blur-[120px]" />
                <div className="absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-amber-300/30 blur-[120px]" />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-64 w-64 rounded-full bg-slate-200/50 blur-[80px]" />
            </div>

            {/* Subtle grid */}
            <div
                className="pointer-events-none absolute inset-0 opacity-[0.5]"
                style={{
                    backgroundImage: `linear-gradient(rgba(15,23,42,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(15,23,42,0.04) 1px, transparent 1px)`,
                    backgroundSize: '40px 40px',
                }}
            />

            {/* Back to site */}
            <div className="absolute top-6 left-6">
                <Link href="/" className="flex items-center gap-2 text-slate-500 hover:text-slate-900 text-sm transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg>
                    Back to site
                </Link>
            </div>

            {/* Card */}
            <div className="relative w-full max-w-md">
                <div className="rounded-2xl border border-slate-200 bg-white/80 backdrop-blur-xl shadow-2xl p-8 space-y-8">
                    {/* Header */}
                    <div className="text-center space-y-3">
                        <div className={cn(
                            "mx-auto w-14 h-14 rounded-2xl border flex items-center justify-center",
                            mode === 'setup'
                                ? "bg-indigo-100 border-indigo-200"
                                : "bg-amber-100 border-amber-200"
                        )}>
                            {mode === 'setup'
                                ? <Sparkles className="h-7 w-7 text-indigo-600" />
                                : <Shield className="h-7 w-7 text-amber-600" />
                            }
                        </div>
                        <div>
                            {mode === 'setup' ? (
                                <>
                                    <h1 className="text-2xl font-bold text-slate-900 tracking-tight">First-time setup</h1>
                                    <p className="text-sm text-slate-500 mt-1">Create the admin account for this workspace</p>
                                </>
                            ) : (
                                <>
                                    <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Admin Portal</h1>
                                    <p className="text-sm text-slate-500 mt-1">Restricted access — authorized personnel only</p>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Error */}
                    {state.error && state.error !== 'NEEDS_SETUP' && (
                        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
                            <AlertCircle className="h-4 w-4 text-red-600 mt-0.5 shrink-0" />
                            <p className="text-sm text-red-600">{state.error}</p>
                        </div>
                    )}

                    {mode === 'loading' ? (
                        <div className="py-10 flex items-center justify-center text-slate-500">
                            <LoaderCircle className="h-5 w-5 animate-spin" />
                        </div>
                    ) : mode === 'setup' ? (
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

                    {/* Footer note */}
                    <p className="text-center text-xs text-slate-500">
                        {mode === 'setup'
                            ? 'This form is only available when no admin exists. It becomes inactive afterwards.'
                            : 'All actions in this panel are logged and audited.'}
                    </p>
                </div>
            </div>

            {/* Bottom copyright */}
            <div className="absolute bottom-6 text-center w-full">
                <p className="text-xs text-slate-400">
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
                <input
                    id="email"
                    name="email"
                    type="email"
                    required
                    autoComplete="email"
                    placeholder="admin@example.com"
                    className={inputClass}
                />
            </Field>

            <Field label="Password">
                <div className="relative">
                    <input
                        id="password"
                        name="password"
                        type={showPassword ? 'text' : 'password'}
                        required
                        autoComplete="current-password"
                        placeholder="••••••••••••"
                        className={cn(inputClass, 'pr-12')}
                    />
                    <PasswordToggle show={showPassword} onToggle={() => setShowPassword(v => !v)} />
                </div>
            </Field>

            <SubmitButton
                pending={isPending}
                pendingLabel="Authenticating…"
                label="Sign In to Admin Panel"
                variant="amber"
            />
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
                <input
                    id="email"
                    name="email"
                    type="email"
                    required
                    autoComplete="email"
                    placeholder="you@company.com"
                    className={inputClass}
                />
            </Field>

            <Field label="Password" hint="Minimum 10 characters">
                <div className="relative">
                    <input
                        id="password"
                        name="password"
                        type={showPassword ? 'text' : 'password'}
                        required
                        minLength={10}
                        autoComplete="new-password"
                        placeholder="At least 10 characters"
                        className={cn(inputClass, 'pr-12')}
                    />
                    <PasswordToggle show={showPassword} onToggle={() => setShowPassword(v => !v)} />
                </div>
            </Field>

            <Field label="Confirm Password">
                <div className="relative">
                    <input
                        id="confirmPassword"
                        name="confirmPassword"
                        type={showConfirm ? 'text' : 'password'}
                        required
                        minLength={10}
                        autoComplete="new-password"
                        placeholder="Repeat password"
                        className={cn(inputClass, 'pr-12')}
                    />
                    <PasswordToggle show={showConfirm} onToggle={() => setShowConfirm(v => !v)} />
                </div>
            </Field>

            <SubmitButton
                pending={isPending}
                pendingLabel="Creating admin…"
                label="Create admin account"
                variant="indigo"
            />
        </form>
    );
}

/* ---------- small UI primitives ---------- */

const inputClass = cn(
    'w-full rounded-xl border border-slate-300 bg-slate-100 px-4 py-3',
    'text-slate-900 placeholder:text-slate-500 text-sm',
    'focus:outline-none focus:border-amber-500/50 focus:ring-2 focus:ring-amber-500/20',
    'transition-all duration-200'
);

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
    return (
        <div className="space-y-1.5">
            <div className="flex items-baseline justify-between">
                <label className="text-xs font-medium text-slate-700 uppercase tracking-wider">{label}</label>
                {hint && <span className="text-[10.5px] text-slate-500">{hint}</span>}
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
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-900 transition-colors"
            tabIndex={-1}
        >
            {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
    );
}

function SubmitButton({ pending, pendingLabel, label, variant }: {
    pending: boolean; pendingLabel: string; label: string; variant: 'amber' | 'indigo';
}) {
    const color = variant === 'amber'
        ? 'bg-amber-500 hover:bg-amber-400 text-zinc-950 shadow-amber-500/25'
        : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/25';
    return (
        <button
            type="submit"
            disabled={pending}
            className={cn(
                'w-full rounded-xl font-semibold text-sm py-3 px-4',
                'transition-all duration-200 flex items-center justify-center gap-2',
                'disabled:opacity-60 disabled:cursor-not-allowed shadow-lg',
                color,
            )}
        >
            {pending
                ? <><LoaderCircle className="h-4 w-4 animate-spin" /> {pendingLabel}</>
                : label
            }
        </button>
    );
}
