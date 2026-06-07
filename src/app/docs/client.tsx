'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import {
    ArrowUpRight,
    Search,
    BookOpen,
    Zap,
    Code,
    Layers,
    Bot,
    Shield,
    Workflow,
    MessageSquare,
    Users,
    Briefcase,
    type LucideIcon,
} from 'lucide-react';
import { MarketingShell, PageHero, SectionWrap } from '@/components/landing-v2/marketing-shell';
import {
    Card,
    CardTitle,
    CardDescription,
    Field,
    Input,
    EmptyState,
} from '@/components/sabcrm/20ui';

interface DocSection {
    title: string;
    icon: LucideIcon;
    blurb: string;
    pages: { title: string; href: string }[];
}

const SECTIONS: DocSection[] = [
    {
        title: 'Get started',
        icon: BookOpen,
        blurb: 'Sign up, invite your team, ship your first automation.',
        pages: [
            { title: 'Sign up + workspace setup', href: '#' },
            { title: 'Inviting your team', href: '#' },
            { title: 'Your first 5 minutes', href: '#' },
            { title: 'Migrating from your old tool', href: '#' },
            { title: 'Concepts: workspaces, projects, environments', href: '#' },
        ],
    },
    {
        title: 'SabFlow · automation',
        icon: Workflow,
        blurb: 'Build cross-module workflows. Branch, loop, retry, replay.',
        pages: [
            { title: 'Your first flow', href: '#' },
            { title: 'Expression engine cheatsheet', href: '#' },
            { title: 'IF + Switch · branching', href: '#' },
            { title: 'Per-item iteration + paired items', href: '#' },
            { title: 'AI agent nodes', href: '#' },
            { title: 'Replay + debug', href: '#' },
        ],
    },
    {
        title: 'Wachat · WhatsApp',
        icon: MessageSquare,
        blurb: 'WABA, templates, broadcasts, chatbot, catalog, payments.',
        pages: [
            { title: 'Connect a WABA number', href: '#' },
            { title: 'Building approved templates', href: '#' },
            { title: 'Broadcasts + throttling', href: '#' },
            { title: 'Visual chatbot flows', href: '#' },
            { title: 'WhatsApp Pay setup', href: '#' },
        ],
    },
    {
        title: 'CRM · sales',
        icon: Users,
        blurb: 'Pipelines, deals, quotes, invoices, accounting.',
        pages: [
            { title: 'Setting up pipelines', href: '#' },
            { title: 'GST invoices + e-stamping', href: '#' },
            { title: 'Inventory + warehouses', href: '#' },
            { title: 'Bookings + calendars', href: '#' },
            { title: 'Accounting + tax filings', href: '#' },
        ],
    },
    {
        title: 'HRM · people',
        icon: Briefcase,
        blurb: 'Roster, attendance, leaves, payroll, performance.',
        pages: [
            { title: 'Onboard your team', href: '#' },
            { title: 'Geo + face attendance', href: '#' },
            { title: 'Payroll, CTC to in-hand', href: '#' },
            { title: 'Visual roadmaps', href: '#' },
            { title: '360 reviews', href: '#' },
        ],
    },
    {
        title: 'API & SDKs',
        icon: Code,
        blurb: 'REST + webhooks + Node/Python/Go/Bun SDKs.',
        pages: [
            { title: 'Auth & API keys', href: '/api-docs' },
            { title: 'Idempotency + retries', href: '/api-docs' },
            { title: 'Webhooks · signing + replay', href: '/api-docs' },
            { title: 'Node SDK', href: '/api-docs' },
            { title: 'Python SDK', href: '/api-docs' },
        ],
    },
    {
        title: 'AI & RAG',
        icon: Bot,
        blurb: 'Bring your own key, build RAG pipelines, tool use.',
        pages: [
            { title: 'Configure AI providers', href: '#' },
            { title: 'RAG pipelines + vector store', href: '#' },
            { title: 'Tool-using agents', href: '#' },
            { title: 'Structured output', href: '#' },
        ],
    },
    {
        title: 'Security & admin',
        icon: Shield,
        blurb: 'SSO, SCIM, audit log, region pinning, BYO-KMS.',
        pages: [
            { title: 'SSO · Google + SAML', href: '#' },
            { title: 'SCIM provisioning', href: '#' },
            { title: 'Role-based access control', href: '#' },
            { title: 'Region pinning', href: '#' },
            { title: 'BYO-KMS / HSM', href: '#' },
        ],
    },
    {
        title: 'Recipes',
        icon: Layers,
        blurb: 'Copy-paste flows for common jobs.',
        pages: [
            { title: 'Abandoned cart to WhatsApp + 10% off', href: '#' },
            { title: 'Lead, enrich, assign, notify', href: '#' },
            { title: 'Payment captured, invoice, ship', href: '#' },
            { title: 'Ticket SLA breach, escalate', href: '#' },
            { title: 'Daily sales report to Slack', href: '#' },
        ],
    },
];

const QUICK_LINKS: { icon: LucideIcon; title: string; desc: string; href: string }[] = [
    { icon: Zap, title: 'Quickstart', desc: 'Ship something in 10 minutes.', href: '#' },
    { icon: Code, title: 'API reference', desc: 'Every endpoint, signed + idempotent.', href: '/api-docs' },
    { icon: Layers, title: 'Templates', desc: 'Pre-built flows to clone + tweak.', href: '/templates' },
];

export function DocsClient({ session }: { session?: { user?: unknown } | null }) {
    const [q, setQ] = useState('');
    const visible = useMemo(() => {
        const term = q.trim().toLowerCase();
        if (!term) return SECTIONS;
        return SECTIONS.map((s) => ({
            ...s,
            pages: s.pages.filter((p) => p.title.toLowerCase().includes(term)),
        })).filter((s) => s.pages.length > 0);
    }, [q]);

    return (
        <MarketingShell session={session}>
            <div className="ui20">
                <PageHero
                    kicker="Docs · guides + references"
                    title={
                        <>
                            Everything you need to{' '}
                            <span className="bg-gradient-to-r from-[var(--st-text)] via-[var(--st-text)] to-[var(--st-text)] bg-clip-text text-transparent">
                                ship faster.
                            </span>
                        </>
                    }
                    subtitle="Set up SabNode, build automations, integrate via API, or just learn how the platform works."
                    extra={
                        <div className="mx-auto max-w-md text-left">
                            <Field label="Search the docs">
                                <Input
                                    type="search"
                                    value={q}
                                    onChange={(e) => setQ(e.target.value)}
                                    placeholder="Search docs"
                                    iconLeft={Search}
                                />
                            </Field>
                        </div>
                    }
                />

                <SectionWrap>
                    {visible.length === 0 ? (
                        <EmptyState
                            icon={Search}
                            title="No matching docs"
                            description={`Nothing matched "${q.trim()}". Try a broader term or browse the sections.`}
                        />
                    ) : (
                        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
                            {visible.map((s) => {
                                const Icon = s.icon;
                                return (
                                    <Card key={s.title} variant="outlined" padding="lg">
                                        <div
                                            className="grid h-11 w-11 place-items-center rounded-[var(--st-radius)] bg-[var(--st-accent)] shadow-sm"
                                            aria-hidden="true"
                                        >
                                            <Icon className="h-5 w-5 text-white" />
                                        </div>
                                        <CardTitle className="mt-4">{s.title}</CardTitle>
                                        <CardDescription className="mt-1">{s.blurb}</CardDescription>
                                        <ul className="mt-4 space-y-1.5">
                                            {s.pages.map((p) => (
                                                <li key={p.title}>
                                                    <Link
                                                        href={p.href}
                                                        className="group flex items-center justify-between rounded-[var(--st-radius)] px-2 py-1.5 text-[13px] text-[var(--st-text)] transition hover:bg-[var(--st-bg-secondary)]"
                                                    >
                                                        <span>{p.title}</span>
                                                        <ArrowUpRight
                                                            className="h-3 w-3 text-[var(--st-text-secondary)] opacity-0 transition group-hover:opacity-100"
                                                            aria-hidden="true"
                                                        />
                                                    </Link>
                                                </li>
                                            ))}
                                        </ul>
                                    </Card>
                                );
                            })}
                        </div>
                    )}
                </SectionWrap>

                <SectionWrap bg="white">
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                        {QUICK_LINKS.map((c) => {
                            const Icon = c.icon;
                            return (
                                <Link key={c.title} href={c.href} className="block">
                                    <Card variant="interactive" padding="lg">
                                        <Icon
                                            className="h-5 w-5 text-[var(--st-text)]"
                                            aria-hidden="true"
                                        />
                                        <CardTitle className="mt-3">{c.title}</CardTitle>
                                        <CardDescription className="mt-1">{c.desc}</CardDescription>
                                    </Card>
                                </Link>
                            );
                        })}
                    </div>
                </SectionWrap>
            </div>
        </MarketingShell>
    );
}
