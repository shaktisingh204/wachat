'use client';

import * as React from 'react';
import Link from 'next/link';
import { Suspense } from 'react';
import {
    BarChart3,
    Bot,
    GitFork,
    Globe,
    MessageSquare,
    Users,
} from 'lucide-react';

import { SabNodeLogo } from '@/components/wabasimplify/logo';
import { LoginForm } from '@/components/wabasimplify/login-form';
import { Skeleton } from '@/components/ui/skeleton';

const HIGHLIGHTS: { title: string; description: string; icon: React.ElementType }[] = [
    {
        title: 'WhatsApp at scale',
        description:
            'Broadcasts, live chat, catalogs, and Meta Flows from a single Wachat workspace.',
        icon: MessageSquare,
    },
    {
        title: 'Full-stack CRM',
        description:
            'Sales, inventory, accounting, HR/payroll, and GST reports — already wired up.',
        icon: Users,
    },
    {
        title: 'SabFlow automation',
        description:
            'Visual flow builder across 20+ apps (Meta, Slack, Stripe, Shopify, Notion…).',
        icon: GitFork,
    },
    {
        title: 'SEO & growth suite',
        description:
            'Audits, rank tracking, GSC, IndexNow, and AI-written PDF reports.',
        icon: BarChart3,
    },
    {
        title: 'SabChat AI',
        description:
            'Embeddable AI chatbot with FAQs, sessions, and live WebSocket handoff.',
        icon: Bot,
    },
    {
        title: 'Sites, shops, portfolios',
        description:
            'Website builder, storefronts, custom domains — everything your brand needs.',
        icon: Globe,
    },
];

function LoginFormSkeleton() {
    return (
        <div className="w-full max-w-md space-y-6 rounded-2xl border bg-card p-8 shadow-2xl">
            <Skeleton className="h-7 w-1/2" />
            <Skeleton className="h-4 w-3/4" />
            <div className="space-y-4 pt-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
            </div>
        </div>
    );
}

export default function LoginPage() {
    return (
        <div className="min-h-screen w-full bg-background">
            <div className="grid min-h-screen lg:grid-cols-2">
                {/* Left column — brand + highlights */}
                <aside className="relative hidden overflow-hidden bg-gradient-to-br from-primary/90 via-primary to-primary/70 text-primary-foreground lg:flex lg:flex-col lg:justify-between lg:p-12">
                    <div
                        aria-hidden
                        className="pointer-events-none absolute inset-0 opacity-20"
                        style={{
                            backgroundImage:
                                'radial-gradient(circle at 20% 30%, white 0, transparent 40%), radial-gradient(circle at 80% 70%, white 0, transparent 40%)',
                        }}
                    />
                    <div className="relative flex items-center gap-3">
                        <Link href="/" className="flex items-center gap-2">
                            <SabNodeLogo className="h-8 w-auto text-white" />
                            <span className="text-lg font-semibold tracking-tight">
                                SabNode
                            </span>
                        </Link>
                    </div>

                    <div className="relative space-y-8">
                        <div className="space-y-3">
                            <h1 className="text-3xl font-bold leading-tight lg:text-4xl">
                                One workspace for
                                <br />
                                messaging, CRM & growth.
                            </h1>
                            <p className="max-w-md text-base text-primary-foreground/80">
                                Sign in to continue managing your WhatsApp
                                campaigns, customers, and automations.
                            </p>
                        </div>

                        <ul className="grid grid-cols-1 gap-4 md:grid-cols-2">
                            {HIGHLIGHTS.map(
                                ({ title, description, icon: Icon }) => (
                                    <li
                                        key={title}
                                        className="rounded-xl bg-white/10 p-4 backdrop-blur-sm"
                                    >
                                        <Icon className="mb-2 h-5 w-5" />
                                        <h3 className="text-sm font-semibold">
                                            {title}
                                        </h3>
                                        <p className="mt-1 text-xs text-primary-foreground/80">
                                            {description}
                                        </p>
                                    </li>
                                )
                            )}
                        </ul>
                    </div>

                    <div className="relative text-xs text-primary-foreground/70">
                        © {new Date().getFullYear()} SabNode — all rights
                        reserved.
                    </div>
                </aside>

                {/* Right column — login form */}
                <main className="flex items-center justify-center p-6 sm:p-10">
                    <div className="w-full max-w-md space-y-6">
                        <div className="flex items-center justify-between lg:hidden">
                            <Link href="/" className="flex items-center gap-2">
                                <SabNodeLogo className="h-7 w-auto" />
                                <span className="font-semibold">SabNode</span>
                            </Link>
                        </div>

                        <Suspense fallback={<LoginFormSkeleton />}>
                            <LoginForm />
                        </Suspense>

                        <p className="text-center text-xs text-muted-foreground">
                            By signing in you agree to our{' '}
                            <Link
                                href="/privacy-policy"
                                className="underline hover:text-foreground"
                            >
                                Privacy Policy
                            </Link>{' '}
                            and Terms of Service.
                        </p>
                    </div>
                </main>
            </div>
        </div>
    );
}
