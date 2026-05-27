'use client';

import Link from 'next/link';
import { m } from 'motion/react';
import {
    ArrowRight,
    ArrowUpRight,
    Coins,
    LayoutGrid,
    Plus,
    Search,
    Sparkles,
    type LucideIcon,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { ModuleTheme, EASE_OUT } from '@/components/dashboard-ui/module-theme';
import { ActivityRow, Button, Card, IconBadge, Pill, Stat, Tile } from '@/components/dashboard-ui/primitives';
import {
    MODULES,
    MODULES_BY_SLUG,
    MODULE_CATEGORIES,
    modulesByCategory,
    type ModuleSlug,
} from '@/components/landing-v2/modules-data';

interface BroadcastRow {
    id: string;
    name: string;
    status: string;
    sent: number;
    delivered: number;
    createdAt: string;
}
interface ActivityEntry {
    id: string;
    type: string;
    title: string;
    createdAt: string;
}

interface DashboardHomeProps {
    userName: string;
    stats: {
        planName: string | null;
        credits: number;
        totalContacts: number;
        totalDeals: number;
        dealsWon: number;
        totalSent: number;
        totalDelivered: number;
        totalFlows: number;
        activeFlows: number;
        totalLeads: number;
        pipelineValue: number;
        totalSabChatSessions: number;
        totalCampaigns: number;
    };
    velocity: {
        messagesLast24h: number;
        messagesPrev24h: number;
        broadcastsLast7d: number;
        contactsLast7d: number;
        leadsLast7d: number;
    };
    recentBroadcasts: BroadcastRow[];
    recentActivity: ActivityEntry[];
}

// 6 flagship modules surfaced as pinned tiles. Mix of large+small for bento rhythm.
const PINNED: { slug: ModuleSlug; size: 'sm' | 'md' | 'lg'; tagline?: string }[] = [
    { slug: 'wachat', size: 'lg' },
    { slug: 'sabflow', size: 'md' },
    { slug: 'sabchat', size: 'md' },
    { slug: 'crm', size: 'lg' },
    { slug: 'seo', size: 'md' },
    { slug: 'hrm', size: 'md' },
];

// Sparkline data — deterministic per-module so layout doesn't shift on rerender.
// Real implementations would pipe from `velocity`/per-module metrics.
function sparkFor(seed: string): number[] {
    let h = 0;
    for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
    const out: number[] = [];
    for (let i = 0; i < 12; i++) {
        h = (h * 9301 + 49297) % 233280;
        out.push(40 + (h % 60));
    }
    return out;
}

// ───── activity icon mapping (uses the icon of the source module) ─────
function activityModuleSlug(type: string): ModuleSlug {
    const t = type.toLowerCase();
    if (t.includes('broadcast') || t.includes('whatsapp') || t.includes('template')) return 'wachat';
    if (t.includes('chat') || t.includes('inbox')) return 'sabchat';
    if (t.includes('flow') || t.includes('automation')) return 'sabflow';
    if (t.includes('deal') || t.includes('contact') || t.includes('lead') || t.includes('crm')) return 'crm';
    if (t.includes('seo') || t.includes('keyword')) return 'seo';
    if (t.includes('payroll') || t.includes('attendance') || t.includes('hrm')) return 'hrm';
    if (t.includes('sms')) return 'sabsms';
    if (t.includes('email') || t.includes('mail')) return 'sabmail';
    if (t.includes('file') || t.includes('upload')) return 'sabfiles';
    return 'wachat';
}

function broadcastActivityIcon(status: string): LucideIcon {
    const Icon = MODULES_BY_SLUG.wachat.icon;
    return Icon;
}

export function DashboardHome({ userName, stats, velocity, recentBroadcasts, recentActivity }: DashboardHomeProps) {
    const grouped = useMemo(() => modulesByCategory(), []);
    const [query, setQuery] = useState('');

    const filteredCatalog = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return null;
        return MODULES.filter(
            (m) =>
                m.name.toLowerCase().includes(q) ||
                m.tag.toLowerCase().includes(q) ||
                m.category.toLowerCase().includes(q),
        );
    }, [query]);

    const messagesDelta = velocity.messagesPrev24h
        ? Math.round(((velocity.messagesLast24h - velocity.messagesPrev24h) / velocity.messagesPrev24h) * 100)
        : null;

    return (
        <div className="mx-auto w-full max-w-[1320px] px-6 pb-20 pt-8">
            {/* GREETING — compact strip, no hero shouting */}
            <m.header
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45, ease: EASE_OUT }}
                className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"
            >
                <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
                        {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
                    </p>
                    <h1 className="mt-1 text-3xl font-semibold tracking-tight text-zinc-950 md:text-4xl">
                        Good to see you, {userName}.
                    </h1>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <ModuleTheme slug="crm">
                        <Pill tone="neutral">
                            <span
                                className="h-1.5 w-1.5 rounded-full"
                                style={{ background: 'var(--mt-accent)' }}
                                aria-hidden
                            />
                            {stats.planName ?? 'Free'} plan
                        </Pill>
                    </ModuleTheme>
                    <Pill tone="neutral">
                        <Coins className="h-3 w-3" strokeWidth={2} aria-hidden />
                        <span className="tabular-nums">{stats.credits.toLocaleString('en-IN')}</span> credits
                    </Pill>
                    <ModuleTheme slug="sabflow">
                        <Link
                            href="/dashboard/sabflow"
                            className="inline-flex h-9 items-center gap-1.5 rounded-full px-4 text-[13px] font-semibold text-white shadow-[0_10px_24px_-12px_var(--mt-accent-glow)] transition-transform duration-150 active:scale-[0.97]"
                            style={{ background: 'var(--mt-accent)' }}
                        >
                            <Sparkles className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden />
                            Open SabFlow
                        </Link>
                    </ModuleTheme>
                </div>
            </m.header>

            {/* VELOCITY — 4 metrics, organic numbers, mini sparklines */}
            <section aria-labelledby="velocity-heading" className="mt-10">
                <div className="mb-3 flex items-center justify-between">
                    <h2 id="velocity-heading" className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
                        Last 7 days
                    </h2>
                </div>
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                    <ModuleTheme slug="wachat">
                        <Stat
                            label="Messages · 24h"
                            value={velocity.messagesLast24h.toLocaleString('en-IN')}
                            delta={messagesDelta !== null ? { value: `${Math.abs(messagesDelta)}%`, positive: messagesDelta >= 0 } : undefined}
                            spark={sparkFor('msgs')}
                            delay={0.04}
                        />
                    </ModuleTheme>
                    <ModuleTheme slug="crm">
                        <Stat
                            label="New leads · 7d"
                            value={velocity.leadsLast7d.toLocaleString('en-IN')}
                            spark={sparkFor('leads')}
                            delay={0.08}
                        />
                    </ModuleTheme>
                    <ModuleTheme slug="sabflow">
                        <Stat
                            label="Broadcasts · 7d"
                            value={velocity.broadcastsLast7d.toLocaleString('en-IN')}
                            spark={sparkFor('bcast')}
                            delay={0.12}
                        />
                    </ModuleTheme>
                    <ModuleTheme slug="sabchat">
                        <Stat
                            label="Contacts added · 7d"
                            value={velocity.contactsLast7d.toLocaleString('en-IN')}
                            spark={sparkFor('contacts')}
                            delay={0.16}
                        />
                    </ModuleTheme>
                </div>
            </section>

            {/* PINNED MODULES — bento, each tile in its own accent */}
            <section aria-labelledby="pinned-heading" className="mt-12">
                <div className="mb-4 flex items-end justify-between">
                    <div>
                        <h2 id="pinned-heading" className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
                            Pinned modules
                        </h2>
                        <p className="mt-1 text-[15px] text-zinc-900">Your most-used surfaces, one click away.</p>
                    </div>
                    <Link
                        href="#catalog"
                        className="hidden text-[12px] font-semibold text-zinc-500 transition-colors hover:text-zinc-900 sm:inline-flex sm:items-center sm:gap-1"
                    >
                        Browse all <ArrowRight className="h-3 w-3" strokeWidth={2.25} aria-hidden />
                    </Link>
                </div>
                {/* Bento: 12-col grid, large = col-span-6, medium = col-span-3 */}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-6 lg:grid-cols-12">
                    {PINNED.map((p, i) => {
                        const mod = MODULES_BY_SLUG[p.slug];
                        const col =
                            p.size === 'lg' ? 'col-span-2 sm:col-span-3 lg:col-span-6'
                            : 'col-span-1 sm:col-span-3 lg:col-span-3';
                        const footer = pinnedFooterFor(p.slug, stats);
                        return (
                            <ModuleTheme key={p.slug} slug={p.slug} className={col}>
                                <Tile
                                    href={`/dashboard/${p.slug}`}
                                    icon={mod.icon}
                                    name={mod.name}
                                    tag={mod.tag}
                                    size={p.size}
                                    delay={0.04 + i * 0.04}
                                    indicator={<Pill tone="accent">Pinned</Pill>}
                                    footer={footer}
                                />
                            </ModuleTheme>
                        );
                    })}
                </div>
            </section>

            {/* ACTIVITY + BROADCASTS */}
            <section className="mt-12 grid grid-cols-1 gap-4 lg:grid-cols-[1.4fr_1fr]">
                <Card
                    title="Recent activity"
                    action={
                        <Link
                            href="/dashboard/notifications"
                            className="text-[11.5px] font-semibold text-zinc-500 hover:text-zinc-900"
                        >
                            View all
                        </Link>
                    }
                    padded={false}
                >
                    {recentActivity.length === 0 ? (
                        <EmptyActivity />
                    ) : (
                        <ul className="divide-y divide-zinc-100 px-3 py-2">
                            {recentActivity.slice(0, 6).map((a, i) => {
                                const slug = activityModuleSlug(a.type);
                                const Icon = MODULES_BY_SLUG[slug].icon;
                                return (
                                    <li key={a.id} className="py-1">
                                        <ModuleTheme slug={slug}>
                                            <ActivityRow
                                                icon={Icon}
                                                title={a.title}
                                                meta={prettifyType(a.type)}
                                                timestamp={timeAgo(a.createdAt)}
                                                delay={0.04 + i * 0.04}
                                            />
                                        </ModuleTheme>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </Card>

                <Card
                    title="Recent broadcasts"
                    action={
                        <Link href="/wachat/broadcasts" className="text-[11.5px] font-semibold text-zinc-500 hover:text-zinc-900">
                            All campaigns
                        </Link>
                    }
                    padded={false}
                >
                    {recentBroadcasts.length === 0 ? (
                        <EmptyBroadcasts />
                    ) : (
                        <ul className="divide-y divide-zinc-100">
                            {recentBroadcasts.slice(0, 4).map((b, i) => {
                                const Icon = MODULES_BY_SLUG.wachat.icon;
                                const rate = b.sent ? Math.round((b.delivered / b.sent) * 100) : 0;
                                return (
                                    <li key={b.id}>
                                        <ModuleTheme slug="wachat">
                                            <m.div
                                                initial={{ opacity: 0, y: 6 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                transition={{ duration: 0.35, delay: 0.04 + i * 0.05, ease: EASE_OUT }}
                                                className="flex items-center gap-3 px-5 py-3"
                                            >
                                                <span
                                                    className="grid h-9 w-9 shrink-0 place-items-center rounded-lg"
                                                    style={{ background: 'var(--mt-accent-soft)' }}
                                                >
                                                    <Icon className="h-4 w-4" strokeWidth={2} style={{ color: 'var(--mt-accent)' }} aria-hidden />
                                                </span>
                                                <div className="min-w-0 flex-1">
                                                    <p className="truncate text-[13px] font-medium text-zinc-900">{b.name}</p>
                                                    <p className="text-[11.5px] text-zinc-500 tabular-nums">
                                                        {b.delivered.toLocaleString('en-IN')} of {b.sent.toLocaleString('en-IN')} delivered
                                                    </p>
                                                </div>
                                                <Pill tone={b.status === 'sent' ? 'positive' : b.status === 'failed' ? 'critical' : 'attention'}>
                                                    {b.status}
                                                </Pill>
                                                <span className="hidden w-12 text-right text-[11.5px] font-semibold text-zinc-900 tabular-nums sm:inline">
                                                    {rate}%
                                                </span>
                                            </m.div>
                                        </ModuleTheme>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </Card>
            </section>

            {/* CATALOG — searchable, grouped by category */}
            <section id="catalog" aria-labelledby="catalog-heading" className="mt-16">
                <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                        <h2 id="catalog-heading" className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
                            All modules
                        </h2>
                        <p className="mt-1 text-[15px] text-zinc-900">{MODULES.length} surfaces, grouped by what they do.</p>
                    </div>
                    <label className="flex w-full items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-1.5 transition-colors focus-within:border-zinc-400 sm:w-72">
                        <Search className="h-3.5 w-3.5 text-zinc-400" strokeWidth={2} aria-hidden />
                        <input
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Filter modules"
                            className="w-full bg-transparent text-[13px] text-zinc-900 placeholder:text-zinc-400 focus:outline-none"
                            aria-label="Filter modules"
                        />
                    </label>
                </div>

                {filteredCatalog ? (
                    <CatalogGrid mods={filteredCatalog} />
                ) : (
                    <div className="space-y-10">
                        {MODULE_CATEGORIES.map((cat) => {
                            const items = grouped[cat];
                            if (!items.length) return null;
                            return (
                                <div key={cat}>
                                    <div className="mb-3 flex items-baseline justify-between border-b border-zinc-200 pb-2">
                                        <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                                            {cat}
                                        </h3>
                                        <span className="text-[10.5px] tabular-nums text-zinc-400">{items.length}</span>
                                    </div>
                                    <CatalogGrid mods={items} />
                                </div>
                            );
                        })}
                    </div>
                )}
            </section>
        </div>
    );
}

// ───────── catalog row tile ─────────
function CatalogGrid({ mods }: { mods: typeof MODULES }) {
    return (
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {mods.map((mod, i) => {
                const Icon = mod.icon;
                return (
                    <li key={mod.slug}>
                        <ModuleTheme slug={mod.slug}>
                            <m.div
                                initial={{ opacity: 0, y: 6 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true, margin: '-10%' }}
                                transition={{ duration: 0.35, delay: Math.min(i * 0.02, 0.25), ease: EASE_OUT }}
                            >
                                <Link
                                    href={`/dashboard/${mod.slug}`}
                                    className="group flex h-full items-start gap-3 rounded-xl border border-zinc-200 bg-white px-3 py-3 transition-colors duration-150 hover:border-zinc-900 focus-visible:outline-none focus-visible:ring-2"
                                    style={{ ['--tw-ring-color' as string]: 'var(--mt-ring)' }}
                                >
                                    <IconBadge icon={Icon} size="sm" />
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-1.5">
                                            <span className="truncate text-[13px] font-semibold text-zinc-950">{mod.name}</span>
                                            {mod.flagship && (
                                                <span className="rounded-full px-1.5 py-px text-[9px] font-semibold uppercase tracking-wider" style={{ background: 'var(--mt-accent-soft)', color: 'var(--mt-accent)' }}>
                                                    Flagship
                                                </span>
                                            )}
                                            <ArrowUpRight className="ml-auto h-3 w-3 text-zinc-300 transition-transform duration-150 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" strokeWidth={2.25} aria-hidden />
                                        </div>
                                        <p className="mt-0.5 truncate text-[11.5px] text-zinc-500">{mod.tag}</p>
                                    </div>
                                </Link>
                            </m.div>
                        </ModuleTheme>
                    </li>
                );
            })}
        </ul>
    );
}

// Module-specific footer content for the pinned tiles.
function pinnedFooterFor(slug: ModuleSlug, stats: DashboardHomeProps['stats']): React.ReactNode {
    switch (slug) {
        case 'wachat':
            return (
                <div className="flex items-center gap-4 text-[11.5px] text-zinc-500">
                    <span className="tabular-nums"><b className="text-zinc-900">{stats.totalSent.toLocaleString('en-IN')}</b> sent</span>
                    <span className="tabular-nums">{stats.totalDelivered ? Math.round((stats.totalDelivered / Math.max(stats.totalSent, 1)) * 100) : 0}% delivered</span>
                </div>
            );
        case 'crm':
            return (
                <div className="flex items-center gap-4 text-[11.5px] text-zinc-500">
                    <span className="tabular-nums"><b className="text-zinc-900">{stats.totalDeals.toLocaleString('en-IN')}</b> deals</span>
                    <span className="tabular-nums">{stats.totalDeals ? Math.round((stats.dealsWon / Math.max(stats.totalDeals, 1)) * 100) : 0}% won</span>
                </div>
            );
        case 'sabflow':
            return (
                <div className="flex items-center gap-4 text-[11.5px] text-zinc-500">
                    <span className="tabular-nums"><b className="text-zinc-900">{stats.activeFlows.toLocaleString('en-IN')}</b> active</span>
                    <span className="tabular-nums">{stats.totalFlows.toLocaleString('en-IN')} total</span>
                </div>
            );
        case 'sabchat':
            return (
                <div className="flex items-center gap-4 text-[11.5px] text-zinc-500">
                    <span className="tabular-nums"><b className="text-zinc-900">{stats.totalSabChatSessions.toLocaleString('en-IN')}</b> sessions</span>
                </div>
            );
        case 'seo':
            return <div className="text-[11.5px] text-zinc-500">Pages, sitemap, link tracking</div>;
        case 'hrm':
            return <div className="text-[11.5px] text-zinc-500">Roster, payroll, reviews</div>;
        default:
            return null;
    }
}

// ───── empty states ─────
function EmptyActivity() {
    return (
        <div className="px-5 py-12 text-center">
            <ModuleTheme slug="sabflow">
                <span
                    className="mx-auto grid h-12 w-12 place-items-center rounded-xl"
                    style={{ background: 'var(--mt-accent-soft)' }}
                >
                    <LayoutGrid className="h-5 w-5" strokeWidth={2} style={{ color: 'var(--mt-accent)' }} aria-hidden />
                </span>
            </ModuleTheme>
            <p className="mt-4 text-sm font-semibold text-zinc-900">Nothing has happened yet</p>
            <p className="mt-1 text-[12.5px] text-zinc-500">Send a broadcast or import contacts and you&apos;ll see the trail here.</p>
            <Link
                href="/wachat/broadcasts"
                className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-zinc-900 px-4 py-1.5 text-[12px] font-semibold text-white transition-transform duration-150 active:scale-[0.97]"
            >
                <Plus className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden />
                Create your first
            </Link>
        </div>
    );
}

function EmptyBroadcasts() {
    return (
        <div className="px-5 py-12 text-center">
            <ModuleTheme slug="wachat">
                <span
                    className="mx-auto grid h-12 w-12 place-items-center rounded-xl"
                    style={{ background: 'var(--mt-accent-soft)' }}
                >
                    <Sparkles className="h-5 w-5" strokeWidth={2} style={{ color: 'var(--mt-accent)' }} aria-hidden />
                </span>
            </ModuleTheme>
            <p className="mt-4 text-sm font-semibold text-zinc-900">No broadcasts sent yet</p>
            <p className="mt-1 text-[12.5px] text-zinc-500">Pick a template, segment your audience, hit send.</p>
        </div>
    );
}

// ───── helpers ─────
function prettifyType(t: string): string {
    return t.replace(/[_.-]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function timeAgo(iso: string): string {
    try {
        const then = new Date(iso).getTime();
        const diff = Math.max(0, Date.now() - then);
        const s = Math.floor(diff / 1000);
        if (s < 60) return `${s}s`;
        const m = Math.floor(s / 60);
        if (m < 60) return `${m}m`;
        const h = Math.floor(m / 60);
        if (h < 24) return `${h}h`;
        const d = Math.floor(h / 24);
        if (d < 7) return `${d}d`;
        return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    } catch {
        return '';
    }
}
