'use client';

import { useState, useTransition, useEffect } from 'react';
import Link from 'next/link';
import { handleAdminLogin } from '@/app/actions/admin.actions';
import { useRouter } from 'next/navigation';
import { Shield, Eye, EyeOff, LoaderCircle, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

const initialState = { success: false, error: undefined as string | undefined };

export default function AdminLoginPage() {
    const [state, setState] = useState(initialState);
    const [isPending, startTransition] = useTransition();
    const [showPassword, setShowPassword] = useState(false);
    const router = useRouter();

    const formAction = (formData: FormData) => {
        startTransition(async () => {
            const result = await handleAdminLogin(initialState, formData);
            setState(result as typeof initialState);
        });
    };

    useEffect(() => {
        if (state.success) {
            router.push('/admin/dashboard');
        }
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
                        <div className="mx-auto w-14 h-14 rounded-2xl bg-amber-100 border border-amber-200 flex items-center justify-center">
                            <Shield className="h-7 w-7 text-amber-600" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Admin Portal</h1>
                            <p className="text-sm text-slate-500 mt-1">Restricted access — authorized personnel only</p>
                        </div>
                    </div>

                    {/* Error */}
                    {state.error && (
                        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
                            <AlertCircle className="h-4 w-4 text-red-600 mt-0.5 shrink-0" />
                            <p className="text-sm text-red-600">{state.error}</p>
                        </div>
                    )}

                    {/* Form */}
                    <form action={formAction} className="space-y-4">
                        <div className="space-y-1.5">
                            <label htmlFor="email" className="text-xs font-medium text-slate-700 uppercase tracking-wider">
                                Admin Email
                            </label>
                            <input
                                id="email"
                                name="email"
                                type="email"
                                required
                                autoComplete="email"
                                placeholder="admin@example.com"
                                className={cn(
                                    "w-full rounded-xl border border-slate-300 bg-slate-100 px-4 py-3",
                                    "text-slate-900 placeholder:text-slate-500 text-sm",
                                    "focus:outline-none focus:border-amber-500/50 focus:ring-2 focus:ring-amber-500/20",
                                    "transition-all duration-200"
                                )}
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label htmlFor="password" className="text-xs font-medium text-slate-700 uppercase tracking-wider">
                                Password
                            </label>
                            <div className="relative">
                                <input
                                    id="password"
                                    name="password"
                                    type={showPassword ? 'text' : 'password'}
                                    required
                                    autoComplete="current-password"
                                    placeholder="••••••••••••"
                                    className={cn(
                                        "w-full rounded-xl border border-slate-300 bg-slate-100 px-4 py-3 pr-12",
                                        "text-slate-900 placeholder:text-slate-500 text-sm",
                                        "focus:outline-none focus:border-amber-500/50 focus:ring-2 focus:ring-amber-500/20",
                                        "transition-all duration-200"
                                    )}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(v => !v)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-900 transition-colors"
                                    tabIndex={-1}
                                >
                                    {showPassword
                                        ? <EyeOff className="h-4 w-4" />
                                        : <Eye className="h-4 w-4" />
                                    }
                                </button>
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={isPending}
                            className={cn(
                                "w-full rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-semibold text-sm py-3 px-4",
                                "transition-all duration-200 flex items-center justify-center gap-2",
                                "disabled:opacity-60 disabled:cursor-not-allowed",
                                "shadow-lg shadow-amber-500/25"
                            )}
                        >
                            {isPending
                                ? <><LoaderCircle className="h-4 w-4 animate-spin" /> Authenticating…</>
                                : 'Sign In to Admin Panel'
                            }
                        </button>
                    </form>

                    {/* Footer note */}
                    <p className="text-center text-xs text-slate-500">
                        All actions in this panel are logged and audited.
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
