'use client';

import { Badge, Button, Card } from '@/components/zoruui';
import {
  useRouter } from 'next/navigation';
import {
    Send,
  Bot,
  MessageCircle,
  Users,
  Radio,
  Package,
  CreditCard,
  Webhook,
  ArrowUpRight,
  Loader2,
  Plug,
  } from 'lucide-react';

import * as React from 'react';
import Link from 'next/link';

import { useProject } from '@/context/project-context';
import { getTelegramOverview } from '@/app/actions/telegram.actions';
import { listTelegramBotsAction } from '@/app/actions/telegram-extra.actions';
import { TelegramProjectGate } from './_components/telegram-project-gate';

interface QuickTileProps {
    href: string;
    label: string;
    description: string;
    icon: React.ElementType;
}

function QuickTile({ href, label, description, icon: Icon }: QuickTileProps) {
    return (
        <Link href={href} className="group block">
            <Card className="h-full p-6 transition-shadow hover:shadow-md">
                <div className="flex items-start gap-3">
                    <div
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                        style={{ background: 'linear-gradient(135deg, #E0F4FF 0%, #B9E4FA 100%)' }}
                    >
                        <Icon className="h-4 w-4" strokeWidth={1.75} style={{ color: '#007DBB' }} />
                    </div>
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                            <p className="text-[13.5px] text-zoru-ink">{label}</p>
                            <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-zoru-ink-muted opacity-0 transition-opacity group-hover:opacity-100" />
                        </div>
                        <p className="mt-1 text-[12.5px] leading-relaxed text-zoru-ink-muted">
                            {description}
                        </p>
                    </div>
                </div>
            </Card>
        </Link>
    );
}

function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
    return (
        <Card className="p-6">
            <p className="text-[11px] uppercase tracking-[0.12em] text-zoru-ink-muted">
                {label}
            </p>
            <p className="mt-2 text-[26px] leading-none text-zoru-ink">{value}</p>
            {hint ? <p className="mt-2 text-[12px] text-zoru-ink-muted">{hint}</p> : null}
        </Card>
    );
}

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

    // Render a brief shimmer while the redirect kicks in, instead of the
    // empty overview flashing.
    if (!activeProject) {
        return (
            <div className="flex h-[60vh] flex-col items-center justify-center gap-3 text-zoru-ink-muted">
                <Loader2 className="h-5 w-5 animate-spin" />
                <p className="text-[12.5px]">Loading your Telegram workspaces…</p>
            </div>
        );
    }

    const [stats, setStats] = React.useState<OverviewState>(EMPTY_OVERVIEW);
    const [loading, setLoading] = React.useState(true);

    React.useEffect(() => {
        let cancelled = false;
        async function load() {
            if (!projectId) {
                setStats(EMPTY_OVERVIEW);
                setLoading(false);
                return;
            }
            setLoading(true);
            const [overview, bots] = await Promise.all([
                getTelegramOverview(projectId).catch(() => ({
                    bots: 0,
                    activeChats: 0,
                    broadcasts: 0,
                })),
                listTelegramBotsAction({ projectId, pageSize: 200 }).catch(
                    () => ({ bots: [], total: 0, page: 1, pageSize: 200 }),
                ),
            ]);
            if (cancelled) return;
            const rows = bots.bots ?? [];
            setStats({
                bots: overview.bots ?? rows.length,
                activeChats: overview.activeChats ?? 0,
                broadcasts: overview.broadcasts ?? 0,
                botsActive: rows.filter((b) => b.status === 'active').length,
                botsError: rows.filter((b) => b.status === 'error').length,
            });
            setLoading(false);
        }
        void load();
        return () => {
            cancelled = true;
        };
    }, [projectId]);

    const fmt = React.useCallback(
        (n: number) => (loading ? '…' : n.toLocaleString()),
        [loading],
    );

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
                <div className="flex shrink-0 items-center gap-2">
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

            {/* Stats */}
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <StatCard
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
                    label="Active chats"
                    value={fmt(stats.activeChats)}
                    hint="Last 24h"
                />
                <StatCard
                    label="Broadcasts"
                    value={fmt(stats.broadcasts)}
                    hint="Last 30 days"
                />
                <StatCard
                    label="Webhook health"
                    value={
                        loading
                            ? '…'
                            : stats.bots === 0
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
                <div className="mb-3 flex items-center justify-between">
                    <h2 className="text-[15px] text-zoru-ink">
                        Quick actions
                    </h2>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    <QuickTile
                        href="/dashboard/telegram/bots"
                        label="Manage bots"
                        description="Register a bot token, set commands, menu buttons, and description."
                        icon={Bot}
                    />
                    <QuickTile
                        href="/dashboard/telegram/chat"
                        label="Live chat"
                        description="Respond to incoming messages in a shared inbox."
                        icon={MessageCircle}
                    />
                    <QuickTile
                        href="/dashboard/telegram/broadcasts"
                        label="Send a broadcast"
                        description="Message opted-in subscribers or a channel with media support."
                        icon={Send}
                    />
                    <QuickTile
                        href="/dashboard/telegram/contacts"
                        label="Contacts"
                        description="Browse everyone who has chatted with your bot."
                        icon={Users}
                    />
                    <QuickTile
                        href="/dashboard/telegram/channels"
                        label="Channels"
                        description="Link public or private channels to post and read stats."
                        icon={Radio}
                    />
                    <QuickTile
                        href="/dashboard/telegram/mini-apps"
                        label="Mini Apps"
                        description="Launch WebApps inside Telegram with initData validation."
                        icon={Package}
                    />
                    <QuickTile
                        href="/dashboard/telegram/payments"
                        label="Payments & Stars"
                        description="Accept Telegram Stars or provider payments via invoices."
                        icon={CreditCard}
                    />
                    <QuickTile
                        href="/dashboard/telegram/webhooks"
                        label="Webhooks"
                        description="Configure update delivery and validate the secret header."
                        icon={Webhook}
                    />
                </div>
            </div>

            {/* Getting started */}
            <Card className="p-6">
                <div className="flex items-start gap-4">
                    <div
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                        style={{ background: 'linear-gradient(135deg, #37BBFE 0%, #007DBB 100%)' }}
                    >
                        <Bot className="h-5 w-5 text-white" strokeWidth={1.75} />
                    </div>
                    <div className="min-w-0 flex-1">
                        <h3 className="text-[14px] text-zoru-ink">Getting started</h3>
                        <ol className="mt-2 flex flex-col gap-1.5 text-[13px] text-zoru-ink">
                            <li>
                                1. Chat with <span className="font-mono text-[12px]">@BotFather</span> on Telegram
                                and create a new bot.
                            </li>
                            <li>
                                2. Copy the bot token and paste it into{' '}
                                <Link
                                    href="/dashboard/telegram/connections"
                                    className="text-sky-500 hover:underline"
                                >
                                    Connections
                                </Link>
                                .
                            </li>
                            <li>3. SabNode will register a webhook with a secret token automatically.</li>
                            <li>4. Start receiving messages in the Live Chat inbox.</li>
                        </ol>
                    </div>
                </div>
            </Card>
        </div>
    );
}
