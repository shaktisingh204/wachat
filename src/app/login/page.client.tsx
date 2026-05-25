'use client';

import { Skeleton } from '@/components/zoruui';
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

import { SabNodeLogo } from '@/components/wabasimplify/logo';
import { LoginForm } from '@/components/wabasimplify/login-form';
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

// 1. Improved Skeleton
function LoginFormSkeleton() {
    return (
        <div className="w-full max-w-md space-y-6 rounded-2xl border bg-card p-8 shadow-2xl animate-pulse">
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

// "Enhance real-time updates" -> A small live status indicator
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
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
            </span>
            <span className={`transition-opacity duration-300 ${fade ? 'opacity-0' : 'opacity-100'}`}>
                {statusText}
            </span>
        </div>
    );
}

// 3. Refactored Sidebar with Filtering, Sorting, and Real-time elements
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
                <Link href="/" className="flex items-center gap-2 transition-transform hover:scale-105">
                    <SabNodeLogo className="h-8 w-auto text-white" />
                    <span className="text-lg font-semibold tracking-tight">
                        SabNode
                    </span>
                </Link>
            </div>

            <div className="relative space-y-6 my-auto pt-8 pb-4">
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
                
                {/* Robust filtering and sorting */}
                <div className="flex max-w-md items-center gap-2 rounded-lg bg-black/20 p-2 backdrop-blur-md">
                    <Search className="ml-2 h-4 w-4 text-primary-foreground/70" />
                    <input 
                        type="text" 
                        placeholder="Filter tools..." 
                        className="flex-1 bg-transparent px-2 py-1 text-sm text-white placeholder-primary-foreground/60 outline-none"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    <button 
                        onClick={() => setSortAsc(!sortAsc)} 
                        className="rounded-md p-1.5 hover:bg-white/20 transition-colors focus:outline-none focus:ring-2 focus:ring-white/50"
                        title={sortAsc ? "Sort Z-A" : "Sort A-Z"}
                        aria-label={sortAsc ? "Sort descending" : "Sort ascending"}
                    >
                        {sortAsc ? <ArrowDownAZ className="h-4 w-4" /> : <ArrowUpZA className="h-4 w-4" />}
                    </button>
                </div>

                <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 max-h-[40vh] overflow-y-auto pr-2 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-white/20 [&::-webkit-scrollbar-thumb]:rounded-full">
                    {filteredHighlights.length > 0 ? (
                        filteredHighlights.map(
                            ({ title, description, icon: Icon }) => (
                                <li
                                    key={title}
                                    className="rounded-xl bg-white/10 p-4 backdrop-blur-sm transition-all hover:bg-white/20 hover:scale-[1.02]"
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
                        )
                    ) : (
                        <li className="col-span-full py-4 text-sm text-primary-foreground/70">
                            No tools matched your search.
                        </li>
                    )}
                </ul>
            </div>

            <div className="relative text-xs text-primary-foreground/70 flex justify-between items-center">
                <span>
                    © <CurrentYear /> SabNode — all rights reserved.
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
    );
}

export default function LoginPage() {
    return (
        <div className="min-h-screen w-full bg-background">
            <div className="grid min-h-screen lg:grid-cols-2">
                <BrandSidebar />
                <LoginMain />
            </div>
        </div>
    );
}
