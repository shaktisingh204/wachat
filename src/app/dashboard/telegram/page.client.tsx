'use client';

import { Badge, Button, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/zoruui';
import { useRouter } from 'next/navigation';
import {
  Send,
  Bot,
  MessageCircle,
  Users,
  Radio,
  Package,
  CreditCard,
  Webhook,
  Loader2,
  Plug,
  RefreshCw,
  Search,
  AlertCircle
} from 'lucide-react';

import * as React from 'react';
import Link from 'next/link';

import { useProject } from '@/context/project-context';
import { getTelegramOverview } from '@/app/actions/telegram.actions';
import { listTelegramBotsAction } from '@/app/actions/telegram-extra.actions';
import { TelegramProjectGate } from './_components/telegram-project-gate';
import { QuickTile } from './_components/quick-tile';
import { StatCard } from './_components/stat-card';
import { GettingStarted } from './_components/getting-started';

type OverviewState = {
    bots: number;
    activeChats: number;
    broadcasts: number;
    botsActive: number;
    botsError: number;
};

const EMPTY_OVERVIEW: OverviewState = {
    bots: 0,
    activeChats: 0,
    broadcasts: 0,
    botsActive: 0,
    botsError: 0,
};

const QUICK_ACTIONS = [
    {
        href: '/dashboard/telegram/bots',
        label: 'Manage bots',
        description: 'Register a bot token, set commands, menu buttons, and description.',
        icon: Bot,
    },
    {
        href: '/dashboard/telegram/chat',
        label: 'Live chat',
        description: 'Respond to incoming messages in a shared inbox.',
        icon: MessageCircle,
    },
    {
        href: '/dashboard/telegram/broadcasts',
        label: 'Send a broadcast',
        description: 'Message opted-in subscribers or a channel with media support.',
        icon: Send,
    },
    {
        href: '/dashboard/telegram/contacts',
        label: 'Contacts',
        description: 'Browse everyone who has chatted with your bot.',
        icon: Users,
    },
    {
        href: '/dashboard/telegram/channels',
        label: 'Channels',
        description: 'Link public or private channels to post and read stats.',
        icon: Radio,
    },
    {
        href: '/dashboard/telegram/mini-apps',
        label: 'Mini Apps',
        description: 'Launch WebApps inside Telegram with initData validation.',
        icon: Package,
    },
    {
        href: '/dashboard/telegram/payments',
        label: 'Payments & Stars',
        description: 'Accept Telegram Stars or provider payments via invoices.',
        icon: CreditCard,
    },
    {
        href: '/dashboard/telegram/webhooks',
        label: 'Webhooks',
        description: 'Configure update delivery and validate the secret header.',
        icon: Webhook,
    },
];

export default function TelegramOverviewPage() {
    const { activeProject, isLoadingProject } = useProject();
    const router = useRouter();
    const projectId = activeProject?._id?.toString() ?? '';

    // Telegram's true landing page is /dashboard/telegram/projects — every
    // visit here without an active project bounces there to pick or create
    // one. Wait for `isLoadingProject` so we don't bounce while the
    // localStorage-backed activeProjectId is still being hydrated.
    React.useEffect(() => {
        if (!isLoadingProject && !activeProject) {
            router.replace('/dashboard/telegram/projects');
        }
    }, [activeProject, isLoadingProject, router]);

    const [stats, setStats] = React.useState<OverviewState>(EMPTY_OVERVIEW);
    const [loading, setLoading] = React.useState(true);
    const [refreshing, setRefreshing] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);
    const [lastUpdated, setLastUpdated] = React.useState<Date | null>(null);
    const [isMounted, setIsMounted] = React.useState(false);
    
    // Filtering and sorting state for actions
    const [searchQuery, setSearchQuery] = React.useState('');
    const [sortBy, setSortBy] = React.useState<'default' | 'alphabetical'>('default');

    React.useEffect(() => {
        setIsMounted(true);
    }, []);

    const loadData = React.useCallback(async (isRefresh = false) => {
        if (!projectId) {
            setStats(EMPTY_OVERVIEW);
            if (!isRefresh) setLoading(false);
            return;
        }
        
        if (isRefresh) {
            setRefreshing(true);
        } else {
            setLoading(true);
        }
        
        setError(null);
        
        try {
            const [overview, bots] = await Promise.all([
                getTelegramOverview(projectId).catch((err) => {
                    console.error('Failed to get overview:', err);
                    throw new Error('Failed to load overview stats.');
                }),
                listTelegramBotsAction({ projectId, pageSize: 200 }).catch((err) => {
                    console.error('Failed to list bots:', err);
                    throw new Error('Failed to load bot data.');
                }),
            ]);
            
            const rows = bots.bots ?? [];
            setStats({
                bots: overview.bots ?? rows.length,
                activeChats: overview.activeChats ?? 0,
                broadcasts: overview.broadcasts ?? 0,
                botsActive: rows.filter((b: any) => b.status === 'active').length,
                botsError: rows.filter((b: any) => b.status === 'error').length,
            });
            setLastUpdated(new Date());
        } catch (err: any) {
            setError(err.message || 'An unexpected error occurred while loading data.');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [projectId]);

    React.useEffect(() => {
        let cancelled = false;
        
        const fetch = async () => {
            await loadData();
        };
        
        void fetch();

        // Real-time updates simulation: poll every 30 seconds
        const interval = setInterval(() => {
            if (!cancelled) void loadData(true);
        }, 30000);

        return () => {
            cancelled = true;
            clearInterval(interval);
        };
    }, [loadData]);

    if (!activeProject) {
        return (
            <div className="flex h-[60vh] flex-col items-center justify-center gap-3 text-zoru-ink-muted">
                <Loader2 className="h-5 w-5 animate-spin" />
                <p className="text-[12.5px]">Loading your Telegram workspaces…</p>
            </div>
        );
    }

    const fmt = (n: number) => n.toLocaleString();

    const filteredAndSortedActions = React.useMemo(() => {
        let result = QUICK_ACTIONS.filter(action => 
            action.label.toLowerCase().includes(searchQuery.toLowerCase()) || 
            action.description.toLowerCase().includes(searchQuery.toLowerCase())
        );

        if (sortBy === 'alphabetical') {
            result.sort((a, b) => a.label.localeCompare(b.label));
        }

        return result;
    }, [searchQuery, sortBy]);

    return (
        <div className="flex flex-col gap-8">
            <TelegramProjectGate />
            {/* Header */}
            <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-4">
                    <div
                        className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl"
                        style={{
                            background: 'linear-gradient(135deg, #37BBFE 0%, #007DBB 100%)',
                            boxShadow: '0 12px 32px rgba(0, 125, 187, 0.28)',
                        }}
                    >
                        <Send className="h-7 w-7 text-white" strokeWidth={1.75} />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-[26px] leading-tight text-zoru-ink">
                                Telegram
                            </h1>
                            <Badge variant="ghost">
                                Beta
                            </Badge>
                        </div>
                        <p className="mt-1.5 max-w-2xl text-[13.5px] leading-relaxed text-zoru-ink-muted">
                            Connect Telegram bots and Business accounts to SabNode. Run
                            campaigns, automate replies, handle payments in Stars, and manage
                            channels — all from one place.
                        </p>
                    </div>
                </div>
                <div className="flex shrink-0 items-center gap-2 flex-wrap justify-end">
                    {isMounted && lastUpdated && (
                        <span className="text-[11px] text-zoru-ink-muted mr-2">
                            Last updated: {lastUpdated.toLocaleTimeString()}
                        </span>
                    )}
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => loadData(true)}
                        disabled={loading || refreshing}
                        className="w-9 px-0"
                    >
                        <RefreshCw className={`h-4 w-4 ${(loading || refreshing) ? 'animate-spin' : ''}`} />
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                            window.open('https://core.telegram.org/bots/api', '_blank', 'noopener,noreferrer')
                        }
                    >
                        Bot API docs
                    </Button>
                    <Link href="/dashboard/telegram/connections">
                        <Button size="md">
                            <Plug className="h-3.5 w-3.5" />
                            Connect a bot
                        </Button>
                    </Link>
                </div>
            </div>

            {/* Error Display */}
            {error && (
                <div className="bg-zoru-surface-2 text-zoru-ink p-4 rounded-xl flex items-center gap-3 border border-zoru-line">
                    <AlertCircle className="h-5 w-5 shrink-0" />
                    <p className="text-sm font-medium">{error}</p>
                    <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => loadData(true)} 
                        className="ml-auto text-zoru-ink hover:text-zoru-ink hover:bg-zoru-surface-2"
                    >
                        Try Again
                    </Button>
                </div>
            )}

            {/* Stats */}
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <StatCard
                    isLoading={loading && !refreshing}
                    label="Connected bots"
                    value={fmt(stats.bots)}
                    hint={
                        !projectId
                            ? 'Pick a project to see counts'
                            : stats.bots === 0
                            ? 'No bots linked yet'
                            : `${stats.botsActive} active`
                    }
                />
                <StatCard
                    isLoading={loading && !refreshing}
                    label="Active chats"
                    value={fmt(stats.activeChats)}
                    hint="Last 24h"
                />
                <StatCard
                    isLoading={loading && !refreshing}
                    label="Broadcasts"
                    value={fmt(stats.broadcasts)}
                    hint="Last 30 days"
                />
                <StatCard
                    isLoading={loading && !refreshing}
                    label="Webhook health"
                    value={
                        stats.bots === 0
                            ? '—'
                            : stats.botsError === 0
                            ? 'Healthy'
                            : `${stats.botsError} failing`
                    }
                    hint={
                        stats.bots === 0
                            ? 'Connect a bot to monitor'
                            : `${stats.botsActive} of ${stats.bots} bots OK`
                    }
                />
            </div>

            {/* Quick actions */}
            <div>
                <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <h2 className="text-[15px] text-zoru-ink shrink-0">
                        Quick actions
                    </h2>
                    <div className="flex items-center gap-2 max-w-full sm:max-w-md w-full">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zoru-ink-muted" />
                            <Input 
                                placeholder="Search actions..." 
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-9 h-9 text-[13px]"
                            />
                        </div>
                        <Select value={sortBy} onValueChange={(val: any) => setSortBy(val)}>
                            <SelectTrigger className="w-[140px] h-9 text-[13px]">
                                <SelectValue placeholder="Sort by" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="default">Default</SelectItem>
                                <SelectItem value="alphabetical">A-Z</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
                
                {filteredAndSortedActions.length > 0 ? (
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {filteredAndSortedActions.map((action, idx) => (
                            <QuickTile
                                key={idx}
                                href={action.href}
                                label={action.label}
                                description={action.description}
                                icon={action.icon}
                            />
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-10 bg-zoru-surface-2/50 rounded-xl border border-zoru-line">
                        <p className="text-zoru-ink-muted text-[13px]">No actions match your search.</p>
                        <Button variant="ghost" size="sm" className="mt-2" onClick={() => setSearchQuery('')}>
                            Clear search
                        </Button>
                    </div>
                )}
            </div>

            {/* Getting started */}
            <GettingStarted />
        </div>
    );
}
