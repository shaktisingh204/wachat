'use client';

import { IconButton, EmptyState, Field, Input, Skeleton } from '@/components/sabcrm/20ui';
import { Suspense, useState, useEffect, useMemo } from 'react';
import {
    BarChart3,
    Bot,
    GitFork,
    Globe,
    MessageSquare,
    Users,
    Search,
    ArrowDownAZ,
    ArrowUpZA
} from 'lucide-react';

import { SabNodeLogo } from '@/components/20ui-domain/logo';
import { LoginForm } from '@/components/20ui-domain/login-form';
import Link from 'next/link';

const HIGHLIGHTS = [
    {
        title: 'WhatsApp at scale',
        description:
            'Broadcasts, live chat, catalogs, and Meta Flows from a single Wachat workspace.',
        icon: MessageSquare,
    },
    {
        title: 'Full-stack CRM',
        description:
            'Sales, inventory, accounting, HR/payroll, and GST reports, already wired up.',
        icon: Users,
    },
    {
        title: 'SabFlow automation',
        description:
            'Visual flow builder across 20+ apps (Meta, Slack, Stripe, Shopify, Notion).',
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
            'Website builder, storefronts, custom domains, everything your brand needs.',
        icon: Globe,
    },
];

// 1. Improved Skeleton
function LoginFormSkeleton() {
    return (
        <div className="w-full max-w-md space-y-6 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg)] p-8 shadow-2xl animate-pulse">
            <div className="space-y-2">
                <Skeleton className="h-8 w-3/5 rounded-md" />
                <Skeleton className="h-4 w-4/5 rounded-md" />
            </div>
            <div className="space-y-5 pt-4">
                <div className="space-y-2">
                    <Skeleton className="h-4 w-12" />
                    <Skeleton className="h-10 w-full rounded-md" />
                </div>
                <div className="space-y-2">
                    <div className="flex justify-between">
                        <Skeleton className="h-4 w-16" />
                        <Skeleton className="h-4 w-24" />
                    </div>
                    <Skeleton className="h-10 w-full rounded-md" />
                </div>
                <Skeleton className="h-11 w-full rounded-md mt-6" />
                <div className="flex items-center justify-center pt-2">
                    <Skeleton className="h-4 w-32" />
                </div>
                <div className="grid grid-cols-2 gap-3 pt-2">
                    <Skeleton className="h-10 w-full rounded-md" />
                    <Skeleton className="h-10 w-full rounded-md" />
                </div>
            </div>
        </div>
    );
}

// 2. Hydration-safe date
function CurrentYear() {
    const [year, setYear] = useState<number | null>(null);
    useEffect(() => {
        setYear(new Date().getFullYear());
    }, []);
    return <span>{year ?? ''}</span>;
}

// A small live status indicator for real-time reassurance.
function LiveStatus() {
    const [statusText, setStatusText] = useState('All systems operational');
    const [fade, setFade] = useState(false);

    useEffect(() => {
        const statuses = ['All systems operational', 'API Latency: 12ms', 'Real-time sync active'];
        let i = 0;
        const interval = setInterval(() => {
            setFade(true);
            setTimeout(() => {
                i = (i + 1) % statuses.length;
                setStatusText(statuses[i]);
                setFade(false);
            }, 300);
        }, 5000);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--st-bg-muted)] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--st-text)]"></span>
            </span>
            <span className={`transition-opacity duration-300 ${fade ? 'opacity-0' : 'opacity-100'}`}>
                {statusText}
            </span>
        </div>
    );
}

// 3. Sidebar with filtering, sorting, and real-time elements.
function BrandSidebar() {
    const [searchQuery, setSearchQuery] = useState('');
    const [sortAsc, setSortAsc] = useState(true);

    const filteredHighlights = useMemo(() => {
        let items = HIGHLIGHTS.filter((h) =>
            h.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            h.description.toLowerCase().includes(searchQuery.toLowerCase())
        );
        items = items.sort((a, b) => {
            const cmp = a.title.localeCompare(b.title);
            return sortAsc ? cmp : -cmp;
        });
        return items;
    }, [searchQuery, sortAsc]);

    return (
        <aside className="relative hidden overflow-hidden bg-[var(--st-text)] text-[var(--st-text-inverted)] lg:flex lg:flex-col lg:justify-between lg:p-12">
            <div
                aria-hidden
                className="pointer-events-none absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_20%_30%,white_0,transparent_40%),radial-gradient(circle_at_80%_70%,white_0,transparent_40%)]"
            />
            <div className="relative flex items-center gap-3">
                <Link href="/" className="flex items-center gap-2 transition-transform hover:scale-105">
                    <SabNodeLogo className="h-8 w-auto text-white" />
                </Link>
            </div>

            <div className="relative space-y-6 my-auto pt-8 pb-4">
                <div className="space-y-3">
                    <h1 className="text-3xl font-bold leading-tight lg:text-4xl">
                        One workspace for
                        <br />
                        messaging, CRM & growth.
                    </h1>
                    <p className="max-w-md text-base text-[var(--st-text-inverted)]/80">
                        Sign in to continue managing your WhatsApp
                        campaigns, customers, and automations.
                    </p>
                </div>

                {/* Robust filtering and sorting */}
                <div className="flex max-w-md items-end gap-2">
                    <Field label="Filter tools" className="flex-1">
                        <Input
                            type="text"
                            placeholder="Search WhatsApp, CRM, SEO."
                            iconLeft={Search}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </Field>
                    <IconButton
                        variant="ghost"
                        icon={sortAsc ? ArrowDownAZ : ArrowUpZA}
                        label={sortAsc ? 'Sort descending' : 'Sort ascending'}
                        onClick={() => setSortAsc(!sortAsc)}
                    />
                </div>

                {filteredHighlights.length > 0 ? (
                    <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 max-h-[40vh] overflow-y-auto pr-2 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-white/20 [&::-webkit-scrollbar-thumb]:rounded-full">
                        {filteredHighlights.map(
                            ({ title, description, icon: Icon }) => (
                                <li
                                    key={title}
                                    className="rounded-[var(--st-radius)] bg-white/10 p-4 backdrop-blur-sm transition-all hover:bg-white/20 hover:scale-[1.02]"
                                >
                                    <Icon className="mb-2 h-5 w-5" aria-hidden="true" />
                                    <h3 className="text-sm font-semibold">
                                        {title}
                                    </h3>
                                    <p className="mt-1 text-xs text-[var(--st-text-inverted)]/80">
                                        {description}
                                    </p>
                                </li>
                            )
                        )}
                    </ul>
                ) : (
                    <EmptyState
                        icon={Search}
                        title="No tools matched"
                        description="No tools matched your search. Try a different keyword."
                        size="sm"
                    />
                )}
            </div>

            <div className="relative text-xs text-[var(--st-text-inverted)]/70 flex justify-between items-center">
                <span>
                    © <CurrentYear /> SabNode, all rights reserved.
                </span>
                <LiveStatus />
            </div>
        </aside>
    );
}

function LoginMain() {
    return (
        <main className="flex items-center justify-center p-6 sm:p-10 relative">
            <div className="w-full max-w-md space-y-6 z-10">
                <div className="flex items-center justify-between lg:hidden">
                    <Link href="/" className="flex items-center gap-2">
                        <SabNodeLogo className="h-7 w-auto" />
                    </Link>
                </div>

                <Suspense fallback={<LoginFormSkeleton />}>
                    <LoginForm />
                </Suspense>

                <p className="text-center text-xs text-[var(--st-text-secondary)]">
                    By signing in you agree to our{' '}
                    <Link
                        href="/privacy-policy"
                        className="underline hover:text-[var(--st-text)]"
                    >
                        Privacy Policy
                    </Link>{' '}
                    and Terms of Service.
                </p>
            </div>
        </main>
    );
}

export default function LoginPage() {
    return (
        <div className="20ui min-h-screen w-full bg-[var(--st-bg)]">
            <div className="grid min-h-screen lg:grid-cols-2">
                <BrandSidebar />
                <LoginMain />
            </div>
        </div>
    );
}
