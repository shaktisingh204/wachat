'use client';

import * as React from 'react';
import Link from 'next/link';
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
    Plug,
} from 'lucide-react';
import { ClayCard, ClayButton, ClayBadge } from '@/components/clay';

interface QuickTileProps {
    href: string;
    label: string;
    description: string;
    icon: React.ElementType;
}

function QuickTile({ href, label, description, icon: Icon }: QuickTileProps) {
    return (
        <Link href={href} className="group block">
            <ClayCard
                variant="default"
                padded
                className="h-full transition-shadow hover:shadow-clay-float"
            >
                <div className="flex items-start gap-3">
                    <div
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                        style={{ background: 'linear-gradient(135deg, #E0F4FF 0%, #B9E4FA 100%)' }}
                    >
                        <Icon className="h-4 w-4" strokeWidth={1.75} style={{ color: '#007DBB' }} />
                    </div>
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                            <p className="text-[13.5px] font-semibold text-clay-ink">{label}</p>
                            <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-clay-ink-muted opacity-0 transition-opacity group-hover:opacity-100" />
                        </div>
                        <p className="mt-1 text-[12.5px] leading-relaxed text-clay-ink-muted">
                            {description}
                        </p>
                    </div>
                </div>
            </ClayCard>
        </Link>
    );
}

function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
    return (
        <ClayCard variant="default" padded>
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-clay-ink-muted">
                {label}
            </p>
            <p className="mt-2 text-[26px] font-semibold leading-none text-clay-ink">{value}</p>
            {hint ? <p className="mt-2 text-[12px] text-clay-ink-muted">{hint}</p> : null}
        </ClayCard>
    );
}

export default function TelegramOverviewPage() {
    return (
        <div className="flex flex-col gap-8 clay-enter">
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
                            <h1 className="text-[26px] font-semibold leading-tight tracking-tight text-clay-ink">
                                Telegram
                            </h1>
                            <ClayBadge tone="blue" dot>
                                Beta
                            </ClayBadge>
                        </div>
                        <p className="mt-1.5 max-w-2xl text-[13.5px] leading-relaxed text-clay-ink-muted">
                            Connect Telegram bots and Business accounts to SabNode. Run
                            campaigns, automate replies, handle payments in Stars, and manage
                            channels — all from one place.
                        </p>
                    </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                    <ClayButton
                        variant="pill"
                        size="sm"
                        onClick={() =>
                            window.open('https://core.telegram.org/bots/api', '_blank', 'noopener,noreferrer')
                        }
                    >
                        Bot API docs
                    </ClayButton>
                    <Link href="/dashboard/telegram/connections">
                        <ClayButton variant="obsidian" size="md" leading={<Plug className="h-3.5 w-3.5" />}>
                            Connect a bot
                        </ClayButton>
                    </Link>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <StatCard label="Connected bots" value="0" hint="No bots linked yet" />
                <StatCard label="Active chats" value="0" hint="Last 24h" />
                <StatCard label="Broadcasts sent" value="0" hint="This month" />
                <StatCard label="Stars balance" value="0 ⭐" hint="Available" />
            </div>

            {/* Quick actions */}
            <div>
                <div className="mb-3 flex items-center justify-between">
                    <h2 className="text-[15px] font-semibold tracking-tight text-clay-ink">
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
            <ClayCard variant="soft" padded>
                <div className="flex items-start gap-4">
                    <div
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                        style={{ background: 'linear-gradient(135deg, #37BBFE 0%, #007DBB 100%)' }}
                    >
                        <Bot className="h-5 w-5 text-white" strokeWidth={1.75} />
                    </div>
                    <div className="min-w-0 flex-1">
                        <h3 className="text-[14px] font-semibold text-clay-ink">Getting started</h3>
                        <ol className="mt-2 flex flex-col gap-1.5 text-[13px] text-clay-ink">
                            <li>
                                1. Chat with <span className="font-mono text-[12px]">@BotFather</span> on Telegram
                                and create a new bot.
                            </li>
                            <li>
                                2. Copy the bot token and paste it into{' '}
                                <Link
                                    href="/dashboard/telegram/connections"
                                    className="font-medium text-clay-blue hover:underline"
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
            </ClayCard>
        </div>
    );
}
