'use client';

import { m } from 'motion/react';
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

interface DocSection {
    title: string;
    icon: LucideIcon;
    accent: string;
    blurb: string;
    pages: { title: string; href: string }[];
}

const SECTIONS: DocSection[] = [
    {
        title: 'Get started',
        icon: BookOpen,
        accent: 'from-[var(--st-bg-muted)] to-[var(--st-text)]',
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
        accent: 'from-[var(--st-bg-muted)] to-[var(--st-text)]',
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
        accent: 'from-[var(--st-bg-muted)] to-[var(--st-text)]',
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
        accent: 'from-[var(--st-bg-muted)] to-[var(--st-text)]',
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
        accent: 'from-[var(--st-bg-muted)] to-[var(--st-text)]',
        blurb: 'Roster, attendance, leaves, payroll, performance.',
        pages: [
            { title: 'Onboard your team', href: '#' },
            { title: 'Geo + face attendance', href: '#' },
            { title: 'Payroll · CTC → in-hand', href: '#' },
            { title: 'Visual roadmaps', href: '#' },
            { title: '360° reviews', href: '#' },
        ],
    },
    {
        title: 'API & SDKs',
        icon: Code,
        accent: 'from-[var(--st-text)] to-[var(--st-text)]',
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
        accent: 'from-[var(--st-bg-muted)] to-[var(--st-text)]',
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
        accent: 'from-[var(--st-text)] to-[var(--st-text)]',
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
        accent: 'from-[var(--st-bg-muted)] to-[var(--st-text)]',
        blurb: 'Copy-paste flows for common jobs.',
        pages: [
            { title: 'Abandoned cart → WhatsApp + 10% off', href: '#' },
            { title: 'Lead → enrich → assign → notify', href: '#' },
            { title: 'Payment captured → invoice → ship', href: '#' },
            { title: 'Ticket SLA breach → escalate', href: '#' },
            { title: 'Daily sales report to Slack', href: '#' },
        ],
    },
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
            <PageHero
                kicker="Docs · guides + references"
                title={<>Everything you need to <span className="bg-gradient-to-r from-[var(--st-text)] via-[var(--st-text)] to-[var(--st-text)] bg-clip-text text-transparent">ship faster.</span></>}
                subtitle="Set up SabNode, build automations, integrate via API, or just learn how the platform works."
                extra={
                    <div className="mx-auto flex max-w-md items-center gap-2 rounded-full border border-[var(--st-border)] bg-white px-4 py-2 shadow-sm">
                        <Search className="h-4 w-4 text-[var(--st-text-secondary)]" />
                        <input
                            value={q}
                            onChange={(e) => setQ(e.target.value)}
                            placeholder="Search docs…"
                            className="w-full bg-transparent text-sm focus:outline-none"
                        />
                    </div>
                }
            />

            <SectionWrap>
                <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
                    {visible.map((s, i) => {
                        const Icon = s.icon;
                        return (
                            <m.div
                                key={s.title}
                                initial={{ opacity: 0, y: 8 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: i * 0.04 }}
                                className="rounded-2xl border border-[var(--st-border)] bg-white p-6"
                            >
                                <div className={`grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br ${s.accent} shadow-md`}>
                                    <Icon className="h-5 w-5 text-white" />
                                </div>
                                <h3 className="mt-4 text-lg font-semibold text-[var(--st-text)]">{s.title}</h3>
                                <p className="mt-1 text-[13px] leading-relaxed text-[var(--st-text)]">{s.blurb}</p>
                                <ul className="mt-4 space-y-1.5">
                                    {s.pages.map((p) => (
                                        <li key={p.title}>
                                            <Link
                                                href={p.href}
                                                className="group flex items-center justify-between rounded-md px-2 py-1.5 text-[13px] text-[var(--st-text)] transition hover:bg-[var(--st-bg-muted)] hover:text-[var(--st-text)]"
                                            >
                                                <span>{p.title}</span>
                                                <ArrowUpRight className="h-3 w-3 opacity-0 transition group-hover:opacity-100" />
                                            </Link>
                                        </li>
                                    ))}
                                </ul>
                            </m.div>
                        );
                    })}
                </div>
            </SectionWrap>

            <SectionWrap bg="white">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    {[
                        { icon: Zap, t: 'Quickstart', d: 'Ship something in 10 minutes.', href: '#' },
                        { icon: Code, t: 'API reference', d: 'Every endpoint, signed + idempotent.', href: '/api-docs' },
                        { icon: Layers, t: 'Templates', d: 'Pre-built flows to clone + tweak.', href: '/templates' },
                    ].map((c, i) => {
                        const Icon = c.icon;
                        return (
                            <m.div
                                key={c.t}
                                initial={{ opacity: 0, y: 8 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: i * 0.05 }}
                            >
                                <Link href={c.href} className="block rounded-2xl border border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-6 transition hover:-translate-y-1 hover:border-[var(--st-border)]">
                                    <Icon className="h-5 w-5 text-[var(--st-text)]" />
                                    <p className="mt-3 text-lg font-semibold text-[var(--st-text)]">{c.t}</p>
                                    <p className="mt-1 text-[13px] text-[var(--st-text)]">{c.d}</p>
                                </Link>
                            </m.div>
                        );
                    })}
                </div>
            </SectionWrap>
        </MarketingShell>
    );
}
