'use client';

import Link from 'next/link';
import { AnimatePresence, m } from 'motion/react';
import {
    ArrowRight,
    ChevronDown,
    Check,
    Minus,
    Sparkles,
    Quote,
    Shield,
    Zap,
    Globe2,
    Users,
    PhoneCall,
    Building2,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { LandingNav } from './landing-nav';
import { LandingFooter } from './landing-footer';
import { MODULES, MODULE_CATEGORIES, modulesByCategory } from './modules-data';

type Billing = 'monthly' | 'yearly';

interface PricingPageProps {
    session?: { user?: unknown } | null;
}

const PLANS = [
    {
        id: 'starter',
        name: 'Starter',
        price: { monthly: 0, yearly: 0 },
        sub: 'Free forever',
        tagline: 'For solo founders and trial runs.',
        features: [
            'Up to 2 users',
            '1,000 contacts',
            '500 WhatsApp / SMS msgs / mo',
            'Core features of every module',
            'Community Slack support',
            'SabNode-hosted shared infra',
        ],
        cta: 'Start free',
        popular: false,
        gradient: 'from-zoru-ink to-zoru-ink',
    },
    {
        id: 'growth',
        name: 'Growth',
        price: { monthly: 2499, yearly: 24990 },
        sub: 'per workspace',
        tagline: 'For teams shipping every week.',
        features: [
            'Up to 10 users',
            '50,000 contacts',
            '50k messages / mo (any channel)',
            'All modules · all features',
            'Priority email + chat',
            'Audit log + SSO (Google)',
            'Bring-your-own-key AI',
        ],
        cta: 'Start 14-day trial',
        popular: true,
        gradient: 'from-zoru-surface-2 via-zoru-ink to-zoru-ink',
    },
    {
        id: 'scale',
        name: 'Scale',
        price: { monthly: 9990, yearly: 99900 },
        sub: 'per workspace',
        tagline: 'For revenue teams running at scale.',
        features: [
            'Unlimited users',
            '500,000 contacts',
            '500k messages / mo · burst',
            'SSO + SAML + SCIM',
            'Region pinning (IN / EU / US)',
            'Dedicated success manager',
            'Custom data warehouse export',
            'Sandbox + staging workspace',
        ],
        cta: 'Talk to sales',
        popular: false,
        gradient: 'from-zoru-ink via-zoru-ink to-zoru-ink',
    },
    {
        id: 'enterprise',
        name: 'Enterprise',
        price: { monthly: null, yearly: null },
        sub: 'Custom',
        tagline: 'For regulated industries and platforms.',
        features: [
            'Unlimited everything',
            'Single-tenant + VPC',
            'SOC 2 + ISO 27001 reports',
            'BYO-KMS / HSM',
            'Custom SLAs (up to 99.99%)',
            'Architect-on-call',
            'Custom contracts + MSA',
            'On-prem option available',
        ],
        cta: 'Contact sales',
        popular: false,
        gradient: 'from-zoru-ink to-zoru-ink',
    },
];

const COMPARE_GROUPS = [
    {
        title: 'Core',
        rows: [
            { name: 'Users / seats', s: '2', g: '10', sc: 'Unlimited', e: 'Unlimited' },
            { name: 'Contacts', s: '1,000', g: '50,000', sc: '500,000', e: 'Unlimited' },
            { name: 'Workspaces', s: '1', g: '1', sc: '3', e: 'Unlimited' },
            { name: 'Projects per workspace', s: '2', g: '20', sc: 'Unlimited', e: 'Unlimited' },
            { name: 'Custom fields', s: '5', g: '50', sc: 'Unlimited', e: 'Unlimited' },
            { name: 'File storage (R2-backed)', s: '5 GB', g: '100 GB', sc: '1 TB', e: 'Custom' },
        ],
    },
    {
        title: 'Channels',
        rows: [
            { name: 'WhatsApp Business (Wachat)', s: true, g: true, sc: true, e: true },
            { name: 'Personal WhatsApp (SabWa)', s: false, g: true, sc: true, e: true },
            { name: 'Email (SabMail)', s: '500/mo', g: '50k/mo', sc: '500k/mo', e: 'Custom' },
            { name: 'SMS (SabSMS) — DLT', s: false, g: true, sc: true, e: true },
            { name: 'Voice + IVR (SabVoice)', s: false, g: false, sc: true, e: true },
            { name: 'Telegram', s: true, g: true, sc: true, e: true },
            { name: 'Instagram + Meta Suite', s: true, g: true, sc: true, e: true },
            { name: 'Omnichannel inbox (SabChat)', s: true, g: true, sc: true, e: true },
        ],
    },
    {
        title: 'Automation & AI',
        rows: [
            { name: 'SabFlow automations / month', s: '1,000', g: '100k', sc: '5M', e: 'Unlimited' },
            { name: 'Visual chatbot flows', s: '1', g: 'Unlimited', sc: 'Unlimited', e: 'Unlimited' },
            { name: 'AI helpers (drafts, summaries)', s: 'Limited', g: true, sc: true, e: true },
            { name: 'Bring-your-own AI key', s: false, g: true, sc: true, e: true },
            { name: 'Custom AI fine-tunes', s: false, g: false, sc: true, e: true },
            { name: 'Scheduled jobs / crons', s: '10', g: 'Unlimited', sc: 'Unlimited', e: 'Unlimited' },
        ],
    },
    {
        title: 'Sales & Commerce',
        rows: [
            { name: 'CRM (deals + pipelines)', s: true, g: true, sc: true, e: true },
            { name: 'Quotes → invoices → GST', s: 'Manual', g: true, sc: true, e: true },
            { name: 'Inventory + warehouses', s: '1', g: '5', sc: '50', e: 'Unlimited' },
            { name: 'Bookings + calendars', s: '1', g: 'Unlimited', sc: 'Unlimited', e: 'Unlimited' },
            { name: 'Storefronts (SabShop)', s: false, g: '1', sc: '5', e: 'Unlimited' },
            { name: 'Subscriptions + dunning', s: false, g: true, sc: true, e: true },
        ],
    },
    {
        title: 'Analytics & data',
        rows: [
            { name: 'Dashboards (SabBI)', s: '3', g: '50', sc: 'Unlimited', e: 'Unlimited' },
            { name: 'SQL editor', s: false, g: true, sc: true, e: true },
            { name: 'Session replay (SabLens)', s: false, g: '10k/mo', sc: '500k/mo', e: 'Custom' },
            { name: 'Funnels + cohorts (SabSense)', s: false, g: true, sc: true, e: true },
            { name: 'Data warehouse export', s: false, g: false, sc: true, e: true },
            { name: 'Retention (event logs)', s: '7d', g: '90d', sc: '1y', e: 'Custom' },
        ],
    },
    {
        title: 'Security & compliance',
        rows: [
            { name: 'SSO — Google', s: false, g: true, sc: true, e: true },
            { name: 'SAML / SCIM', s: false, g: false, sc: true, e: true },
            { name: 'Audit log', s: '30d', g: '1y', sc: 'Forever', e: 'Forever' },
            { name: 'Region pinning', s: false, g: false, sc: true, e: true },
            { name: 'BYO-KMS', s: false, g: false, sc: false, e: true },
            { name: 'SOC 2 + ISO 27001 reports', s: false, g: 'Summary', sc: true, e: true },
            { name: 'DPDP / GDPR toolkit', s: true, g: true, sc: true, e: true },
        ],
    },
    {
        title: 'Support',
        rows: [
            { name: 'Community Slack', s: true, g: true, sc: true, e: true },
            { name: 'Email + chat support', s: false, g: true, sc: true, e: true },
            { name: 'Priority queue', s: false, g: false, sc: true, e: true },
            { name: 'Dedicated CSM', s: false, g: false, sc: true, e: true },
            { name: 'Architect-on-call', s: false, g: false, sc: false, e: true },
            { name: 'Migration help (free)', s: false, g: '4h', sc: '20h', e: 'Unlimited' },
        ],
    },
];

export function PricingPage({ session }: PricingPageProps) {
    const [billing, setBilling] = useState<Billing>('yearly');

    return (
        <div className="relative min-h-screen overflow-x-clip bg-zoru-surface text-zoru-ink antialiased">
            <div
                aria-hidden
                className="pointer-events-none fixed inset-0 z-0"
                style={{
                    background:
                        'radial-gradient(ellipse 80% 50% at 50% -10%, rgba(139,92,246,0.10), transparent 60%), radial-gradient(ellipse 80% 50% at 50% 110%, rgba(244,63,94,0.08), transparent 60%)',
                }}
            />

            <LandingNav session={session} />

            <main className="relative z-10">
                <Hero billing={billing} setBilling={setBilling} />
                <PlanGrid billing={billing} session={session} />
                <ValuePillars />
                <CompareTable billing={billing} session={session} />
                <ModulePricing />
                <UsageCalculator />
                <CustomerLogos />
                <TestimonialStrip />
                <Faq />
                <FinalCta session={session} />
            </main>

            <LandingFooter />
        </div>
    );
}

// ───────── HERO ─────────
function Hero({ billing, setBilling }: { billing: Billing; setBilling: (b: Billing) => void }) {
    return (
        <section className="relative px-6 pt-32 pb-12 md:pt-40">
            <div className="mx-auto max-w-4xl text-center">
                <m.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                    className="inline-flex items-center gap-2 rounded-full border border-zoru-line bg-white/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.15em] text-zoru-ink backdrop-blur"
                >
                    <Sparkles className="h-3 w-3 text-zoru-ink" />
                    47 products. One bill.
                </m.div>
                <m.h1
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.05 }}
                    className="mt-6 text-balance text-5xl font-semibold tracking-tight text-zoru-ink md:text-7xl"
                >
                    Honest pricing.
                    <br />
                    <span className="bg-gradient-to-r from-zoru-ink via-zoru-ink to-zoru-ink bg-clip-text text-transparent">
                        Built to scale with you.
                    </span>
                </m.h1>
                <m.p
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.1 }}
                    className="mx-auto mt-6 max-w-2xl text-pretty text-lg leading-relaxed text-zoru-ink"
                >
                    Usage-based, not per-seat. Start free, scale to enterprise — keep the same data, the
                    same dashboards, the same team. No upsell surprises.
                </m.p>
                <m.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: 0.2 }}
                    className="mt-10 flex justify-center"
                >
                    <div className="relative inline-flex rounded-full border border-zoru-line bg-white p-1 shadow-sm">
                        {(['monthly', 'yearly'] as Billing[]).map((b) => (
                            <button
                                key={b}
                                onClick={() => setBilling(b)}
                                className="relative rounded-full px-4 py-1.5 text-sm font-semibold transition"
                            >
                                {billing === b && (
                                    <m.span
                                        layoutId="billing-pill"
                                        className="absolute inset-0 rounded-full bg-zoru-ink"
                                        transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                                    />
                                )}
                                <span className={`relative ${billing === b ? 'text-white' : 'text-zoru-ink'}`}>
                                    {b === 'monthly' ? 'Monthly' : 'Yearly'}
                                    {b === 'yearly' && (
                                        <span
                                            className={`ml-2 rounded-full px-1.5 text-[10px] font-bold ${
                                                billing === b ? 'bg-zoru-surface-2/20 text-zoru-ink-muted' : 'bg-zoru-surface-2 text-zoru-ink'
                                            }`}
                                        >
                                            −20%
                                        </span>
                                    )}
                                </span>
                            </button>
                        ))}
                    </div>
                </m.div>
            </div>
        </section>
    );
}

// ───────── PLAN GRID ─────────
function PlanGrid({ billing, session }: { billing: Billing; session?: { user?: unknown } | null }) {
    return (
        <section className="relative px-6 py-16">
            <div className="mx-auto grid max-w-7xl grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-4">
                {PLANS.map((p, i) => {
                    const monthlyPrice = p.price[billing];
                    return (
                        <m.div
                            key={p.id}
                            initial={{ opacity: 0, y: 12 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: i * 0.05 }}
                            className={`relative flex flex-col rounded-3xl border p-6 ${
                                p.popular
                                    ? 'border-zoru-line bg-white shadow-[0_24px_70px_-30px_rgba(0,0,0,0.3)]'
                                    : 'border-zoru-line bg-white'
                            }`}
                        >
                            {p.popular && (
                                <span className="absolute -top-3 left-6 rounded-full bg-gradient-to-r from-zoru-surface-2 via-zoru-ink to-zoru-ink px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-white shadow-md">
                                    Most popular
                                </span>
                            )}
                            <div className={`grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br ${p.gradient} shadow-md`}>
                                <span className="text-sm font-black text-white">{p.name[0]}</span>
                            </div>
                            <h3 className="mt-4 text-xl font-semibold tracking-tight text-zoru-ink">{p.name}</h3>
                            <p className="mt-1 text-[13px] text-zoru-ink">{p.tagline}</p>
                            <div className="mt-5 flex items-baseline gap-1.5">
                                {monthlyPrice === null ? (
                                    <span className="text-3xl font-semibold text-zoru-ink">Custom</span>
                                ) : monthlyPrice === 0 ? (
                                    <span className="text-3xl font-semibold text-zoru-ink">Free</span>
                                ) : (
                                    <>
                                        <span className="text-3xl font-semibold tracking-tight text-zoru-ink">
                                            ₹{Math.round(monthlyPrice / (billing === 'yearly' ? 12 : 1)).toLocaleString('en-IN')}
                                        </span>
                                        <span className="text-[13px] text-zoru-ink">
                                            / mo {billing === 'yearly' && <span className="text-zoru-ink">billed yearly</span>}
                                        </span>
                                    </>
                                )}
                            </div>
                            <p className="mt-1 text-[11px] text-zoru-ink">{p.sub}</p>
                            <ul className="mt-6 flex-1 space-y-2">
                                {p.features.map((f) => (
                                    <li key={f} className="flex items-start gap-2 text-[14px] text-zoru-ink">
                                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-zoru-ink" />
                                        {f}
                                    </li>
                                ))}
                            </ul>
                            <Link
                                href={
                                    p.id === 'enterprise' || p.id === 'scale'
                                        ? '/contact'
                                        : session?.user
                                          ? '/dashboard'
                                          : '/login?signup=1'
                                }
                                className={`mt-8 inline-flex items-center justify-center gap-1.5 rounded-full px-5 py-2.5 text-sm font-semibold transition ${
                                    p.popular
                                        ? 'bg-gradient-to-r from-zoru-surface-2 via-zoru-ink to-zoru-ink text-white shadow-lg hover:scale-[1.03]'
                                        : p.id === 'enterprise'
                                          ? 'bg-zoru-ink text-white hover:bg-zoru-ink'
                                          : 'border border-zoru-line text-zoru-ink hover:border-zoru-line'
                                }`}
                            >
                                {p.cta} <ArrowRight className="h-3.5 w-3.5" />
                            </Link>
                        </m.div>
                    );
                })}
            </div>
            <p className="mt-10 text-center text-sm text-zoru-ink">
                All plans include the full 47-product feature set · No setup fees · 14-day free trial on Growth and Scale
            </p>
        </section>
    );
}

// ───────── VALUE PILLARS ─────────
function ValuePillars() {
    const items = [
        { icon: Zap, t: 'Usage-based, not per-seat', d: "Add as many users as you like. You only pay when work actually grows." },
        { icon: Globe2, t: 'No-lock-in data', d: 'Every record exportable to CSV, Parquet, or signed Postgres dump.' },
        { icon: Shield, t: 'Compliant by default', d: 'GST, DLT, DPDP, GDPR — handled, with signed PDFs on file.' },
        { icon: Users, t: 'Migration help free', d: 'We import your data, contacts, templates, dashboards — at no cost.' },
    ];
    return (
        <section className="relative px-6 py-20">
            <div className="mx-auto max-w-7xl">
                <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                    {items.map((it, i) => {
                        const Icon = it.icon;
                        return (
                            <m.div
                                key={it.t}
                                initial={{ opacity: 0, y: 8 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: i * 0.05 }}
                                className="rounded-2xl border border-zoru-line bg-white p-5"
                            >
                                <Icon className="h-5 w-5 text-zoru-ink" />
                                <p className="mt-3 text-base font-semibold text-zoru-ink">{it.t}</p>
                                <p className="mt-1 text-[13px] leading-relaxed text-zoru-ink">{it.d}</p>
                            </m.div>
                        );
                    })}
                </div>
            </div>
        </section>
    );
}

// ───────── COMPARE TABLE ─────────
function CompareTable({ billing, session }: { billing: Billing; session?: { user?: unknown } | null }) {
    const cell = (v: unknown) => {
        if (v === true) return <Check className="mx-auto h-4 w-4 text-zoru-ink" />;
        if (v === false) return <Minus className="mx-auto h-4 w-4 text-zoru-ink-muted" />;
        return <span className="text-zoru-ink">{String(v)}</span>;
    };
    return (
        <section id="compare" className="relative px-6 py-24">
            <div className="mx-auto max-w-7xl">
                <m.p
                    initial={{ opacity: 0, y: 6 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="text-[11px] font-semibold uppercase tracking-[0.22em] text-zoru-ink"
                >
                    Compare plans
                </m.p>
                <m.h2
                    initial={{ opacity: 0, y: 8 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.05 }}
                    className="mt-3 max-w-3xl text-balance text-4xl font-semibold tracking-tight text-zoru-ink md:text-5xl"
                >
                    Every limit, every feature, every plan.
                </m.h2>
                <p className="mt-4 max-w-2xl text-zoru-ink">
                    We don&apos;t hide the boring details. Here&apos;s exactly what you get at every level.
                </p>

                <div className="mt-10 overflow-hidden rounded-3xl border border-zoru-line bg-white">
                    <div className="sticky top-16 z-10 grid grid-cols-5 border-b border-zoru-line bg-white/95 px-5 py-4 backdrop-blur">
                        <div className="text-sm font-semibold text-zoru-ink">Feature</div>
                        {PLANS.map((p) => (
                            <div key={p.id} className="text-center">
                                <p className="text-sm font-semibold text-zoru-ink">{p.name}</p>
                                <p className="mt-0.5 text-[11px] text-zoru-ink">
                                    {p.price[billing] === null
                                        ? 'Custom'
                                        : p.price[billing] === 0
                                          ? 'Free'
                                          : `₹${Math.round((p.price[billing] as number) / (billing === 'yearly' ? 12 : 1)).toLocaleString('en-IN')}/mo`}
                                </p>
                            </div>
                        ))}
                    </div>

                    {COMPARE_GROUPS.map((g) => (
                        <div key={g.title}>
                            <div className="grid grid-cols-5 border-b border-zoru-line bg-zoru-surface-2 px-5 py-2.5">
                                <div className="col-span-5 text-[11px] font-semibold uppercase tracking-[0.2em] text-zoru-ink">
                                    {g.title}
                                </div>
                            </div>
                            {g.rows.map((r, i) => (
                                <m.div
                                    key={r.name}
                                    initial={{ opacity: 0 }}
                                    whileInView={{ opacity: 1 }}
                                    viewport={{ once: true }}
                                    transition={{ delay: i * 0.02 }}
                                    className="grid grid-cols-5 items-center border-b border-zoru-line px-5 py-3 text-[13px] last:border-0"
                                >
                                    <div className="text-zoru-ink">{r.name}</div>
                                    <div className="text-center">{cell(r.s)}</div>
                                    <div className="text-center">{cell(r.g)}</div>
                                    <div className="text-center">{cell(r.sc)}</div>
                                    <div className="text-center">{cell(r.e)}</div>
                                </m.div>
                            ))}
                        </div>
                    ))}

                    {/* CTA row inside table */}
                    <div className="grid grid-cols-5 border-t border-zoru-line bg-zoru-surface-2 px-5 py-5">
                        <div className="hidden md:block" />
                        {PLANS.map((p) => (
                            <div key={p.id} className="text-center">
                                <Link
                                    href={
                                        p.id === 'enterprise' || p.id === 'scale'
                                            ? '/contact'
                                            : session?.user
                                              ? '/dashboard'
                                              : '/login?signup=1'
                                    }
                                    className={`inline-flex items-center justify-center gap-1 rounded-full px-3 py-1.5 text-[12px] font-semibold transition ${
                                        p.popular
                                            ? 'bg-zoru-ink text-white hover:bg-zoru-ink'
                                            : 'border border-zoru-line text-zoru-ink hover:border-zoru-line'
                                    }`}
                                >
                                    {p.cta}
                                </Link>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </section>
    );
}

// ───────── MODULE PRICING (per-module add-ons / availability) ─────────
function ModulePricing() {
    const grouped = useMemo(() => modulesByCategory(), []);
    return (
        <section id="modules" className="relative bg-white px-6 py-24">
            <div className="mx-auto max-w-7xl">
                <m.p
                    initial={{ opacity: 0, y: 6 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="text-[11px] font-semibold uppercase tracking-[0.22em] text-zoru-ink"
                >
                    All 47 modules · included
                </m.p>
                <m.h2
                    initial={{ opacity: 0, y: 8 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.05 }}
                    className="mt-3 max-w-3xl text-balance text-4xl font-semibold tracking-tight text-zoru-ink md:text-5xl"
                >
                    Every module. On every paid plan.
                </m.h2>
                <p className="mt-4 max-w-2xl text-zoru-ink">
                    You don&apos;t pick a SKU and lose features. You pick a scale tier and get the whole stack.
                </p>

                <div className="mt-12 space-y-12">
                    {MODULE_CATEGORIES.map((cat, ci) => {
                        const items = grouped[cat];
                        if (!items.length) return null;
                        return (
                            <m.div
                                key={cat}
                                initial={{ opacity: 0, y: 8 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: ci * 0.03 }}
                            >
                                <div className="mb-4 flex items-baseline justify-between border-b border-zoru-line pb-3">
                                    <h3 className="text-[11px] font-semibold uppercase tracking-[0.22em] text-zoru-ink">
                                        {cat}
                                    </h3>
                                    <span className="text-[11px] text-zoru-ink-muted">{items.length}</span>
                                </div>
                                <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
                                    {items.map((mod) => {
                                        const Icon = mod.icon;
                                        return (
                                            <Link
                                                key={mod.slug}
                                                href={mod.href}
                                                className="group flex items-center gap-3 rounded-2xl border border-zoru-line bg-zoru-surface p-3 transition hover:-translate-y-0.5 hover:border-zoru-line"
                                            >
                                                <div
                                                    className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br ${mod.accentFrom} ${mod.accentTo} shadow-md`}
                                                >
                                                    <Icon className="h-4 w-4 text-white" />
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <p className="truncate text-[13px] font-semibold text-zoru-ink">
                                                        {mod.name}
                                                    </p>
                                                    <p className="truncate text-[11px] text-zoru-ink">{mod.tag}</p>
                                                </div>
                                                <Check className="h-4 w-4 shrink-0 text-zoru-ink" />
                                            </Link>
                                        );
                                    })}
                                </div>
                            </m.div>
                        );
                    })}
                </div>
            </div>
        </section>
    );
}

// ───────── USAGE CALCULATOR ─────────
function UsageCalculator() {
    const [contacts, setContacts] = useState(20000);
    const [messages, setMessages] = useState(80000);
    const [agents, setAgents] = useState(8);

    // very approximate model — yields a recommendation + an estimated all-in monthly figure
    const total = useMemo(() => {
        const base =
            contacts > 100000 || messages > 200000 || agents > 25
                ? 9990
                : contacts > 10000 || messages > 30000 || agents > 5
                  ? 2499
                  : 0;
        const messageOverage = Math.max(0, messages - (base === 9990 ? 500000 : base === 2499 ? 50000 : 500)) * 0.1;
        const contactOverage = Math.max(0, contacts - (base === 9990 ? 500000 : base === 2499 ? 50000 : 1000)) * 0.05;
        return Math.round(base + messageOverage + contactOverage);
    }, [contacts, messages, agents]);

    const plan = total >= 9990 ? 'Scale' : total > 0 ? 'Growth' : 'Starter (free)';

    return (
        <section className="relative px-6 py-24">
            <div className="mx-auto max-w-6xl">
                <m.p
                    initial={{ opacity: 0, y: 6 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="text-[11px] font-semibold uppercase tracking-[0.22em] text-zoru-ink"
                >
                    Estimate your bill
                </m.p>
                <m.h2
                    initial={{ opacity: 0, y: 8 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.05 }}
                    className="mt-3 max-w-3xl text-balance text-4xl font-semibold tracking-tight text-zoru-ink md:text-5xl"
                >
                    See your number in 10 seconds.
                </m.h2>

                <div className="mt-12 grid grid-cols-1 gap-6 lg:grid-cols-[1.2fr_1fr]">
                    <div className="rounded-3xl border border-zoru-line bg-white p-6">
                        <Slider
                            label="Contacts in your CRM"
                            value={contacts}
                            min={500}
                            max={500000}
                            step={500}
                            onChange={setContacts}
                            fmt={(n) => n.toLocaleString('en-IN')}
                        />
                        <Slider
                            label="Messages per month (any channel)"
                            value={messages}
                            min={500}
                            max={1000000}
                            step={1000}
                            onChange={setMessages}
                            fmt={(n) => n.toLocaleString('en-IN')}
                        />
                        <Slider
                            label="Active agents / users"
                            value={agents}
                            min={1}
                            max={50}
                            step={1}
                            onChange={setAgents}
                            fmt={(n) => String(n)}
                        />
                    </div>

                    <m.div
                        initial={{ opacity: 0, x: 8 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        className="relative overflow-hidden rounded-3xl bg-zoru-ink p-8 text-white"
                    >
                        <div
                            aria-hidden
                            className="pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full blur-3xl"
                            style={{ background: 'rgba(251,146,60,0.4)' }}
                        />
                        <p className="relative text-[11px] font-semibold uppercase tracking-[0.2em] text-zoru-ink-muted">
                            Recommended plan
                        </p>
                        <p className="relative mt-2 text-3xl font-semibold">{plan}</p>
                        <div className="relative mt-8">
                            <p className="text-[11px] uppercase tracking-wider text-white/50">Estimated monthly</p>
                            <p className="mt-1 text-5xl font-semibold tracking-tight">
                                ₹{total.toLocaleString('en-IN')}
                            </p>
                            <p className="mt-2 text-[12px] text-white/60">
                                Includes overage at ₹0.10 / msg and ₹0.05 / extra contact. Yearly billing −20%.
                            </p>
                        </div>
                        <Link
                            href="/contact"
                            className="relative mt-8 inline-flex items-center gap-1.5 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-zoru-ink hover:bg-zoru-surface-2"
                        >
                            Get a written quote <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                    </m.div>
                </div>
                <p className="mt-6 text-sm text-zoru-ink">
                    Estimates only. Custom contracts available for volumes above 1M messages or 500k
                    contacts.
                </p>
            </div>
        </section>
    );
}

function Slider({
    label,
    value,
    min,
    max,
    step,
    onChange,
    fmt,
}: {
    label: string;
    value: number;
    min: number;
    max: number;
    step: number;
    onChange: (n: number) => void;
    fmt: (n: number) => string;
}) {
    return (
        <div className="mb-6 last:mb-0">
            <div className="flex items-baseline justify-between">
                <label className="text-sm font-semibold text-zoru-ink">{label}</label>
                <span className="text-base font-semibold text-zoru-ink">{fmt(value)}</span>
            </div>
            <input
                type="range"
                min={min}
                max={max}
                step={step}
                value={value}
                onChange={(e) => onChange(Number(e.target.value))}
                className="mt-3 w-full accent-zoru-ink"
            />
            <div className="mt-1 flex justify-between text-[10px] uppercase tracking-wider text-zoru-ink-muted">
                <span>{fmt(min)}</span>
                <span>{fmt(max)}</span>
            </div>
        </div>
    );
}

// ───────── CUSTOMER LOGOS ─────────
function CustomerLogos() {
    const logos = ['Sole Co.', 'Acme', 'Globex', 'Initech', 'Soylent', 'Wayne Co.', 'Daily Planet', 'Stark'];
    return (
        <section className="relative bg-white px-6 py-16">
            <div className="mx-auto max-w-7xl">
                <p className="text-center text-[11px] font-semibold uppercase tracking-[0.22em] text-zoru-ink">
                    Trusted by 12,000+ teams across India + 14 countries
                </p>
                <div className="mt-6 grid grid-cols-4 gap-6 md:grid-cols-8">
                    {logos.map((l, i) => (
                        <m.span
                            key={l}
                            initial={{ opacity: 0 }}
                            whileInView={{ opacity: 0.85 }}
                            viewport={{ once: true }}
                            transition={{ delay: i * 0.04 }}
                            className="text-center text-sm font-semibold tracking-tight text-zoru-ink"
                        >
                            {l}
                        </m.span>
                    ))}
                </div>
            </div>
        </section>
    );
}

// ───────── TESTIMONIAL STRIP ─────────
function TestimonialStrip() {
    const items = [
        {
            quote:
                'We swapped 6 vendors for SabNode. The Scale plan paid for itself in week two — we cut ₹3.2L of SaaS off the books.',
            who: 'Aanya Mehra',
            role: 'Head of Growth · D2C unicorn',
        },
        {
            quote:
                "Migration was three days. Customers didn't notice. Our agents now reply on WhatsApp + Instagram + email from the same window.",
            who: 'Rohan Gupta',
            role: 'Founder · SaaS startup',
        },
        {
            quote:
                'The Enterprise team set us up with region pinning + BYO-KMS in two weeks. Compliance reviewed and signed off.',
            who: 'Priya Krishnan',
            role: 'CTO · Fintech platform',
        },
    ];
    return (
        <section className="relative px-6 py-24">
            <div className="mx-auto max-w-7xl">
                <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                    {items.map((t, i) => (
                        <m.div
                            key={t.who}
                            initial={{ opacity: 0, y: 12 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: i * 0.06 }}
                            className="relative overflow-hidden rounded-3xl border border-zoru-line bg-white p-7"
                        >
                            <Quote className="h-6 w-6 text-zoru-ink" />
                            <p className="mt-4 text-[15px] leading-relaxed text-zoru-ink">{t.quote}</p>
                            <div className="mt-6 flex items-center gap-3">
                                <div className="grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-zoru-surface-2 via-zoru-ink to-zoru-ink text-sm font-semibold text-white">
                                    {t.who[0]}
                                </div>
                                <div>
                                    <p className="text-sm font-semibold text-zoru-ink">{t.who}</p>
                                    <p className="text-[12px] text-zoru-ink">{t.role}</p>
                                </div>
                            </div>
                        </m.div>
                    ))}
                </div>
            </div>
        </section>
    );
}

// ───────── FAQ ─────────
function Faq() {
    const items = [
        {
            q: 'Is there really a free plan?',
            a: 'Yes. Starter is free forever — up to 2 users, 1,000 contacts, and 500 messages a month. You get the full feature set of every module, not a stripped-down one.',
        },
        {
            q: 'What happens when I cross my plan limit?',
            a: 'We never block. Messages and contacts beyond your plan get charged at the overage rate (₹0.10 / message, ₹0.05 / extra contact). You also see the bill projecting up before it hits, so there are no surprises.',
        },
        {
            q: 'Are the modules separately priced?',
            a: 'No. Every plan includes all 47 modules. Pricing scales with how much you use the platform, not which products you turn on.',
        },
        {
            q: 'Can I switch between monthly and yearly?',
            a: 'Yes. You can switch any time. Yearly is 20% cheaper. If you switch from monthly to yearly mid-cycle, we prorate the unused portion.',
        },
        {
            q: 'What does migration help include?',
            a: 'For Growth, 4 hours of free engineering time. For Scale, 20 hours. For Enterprise, unlimited. We import contacts, templates, deals, conversations, payroll, and dashboards from any major vendor.',
        },
        {
            q: 'Do you support yearly + invoice billing?',
            a: 'Yes. For yearly billing we accept Razorpay, Stripe, bank transfer (NEFT/RTGS), and signed PO. GST invoices issued the same day.',
        },
        {
            q: 'What about data ownership?',
            a: "Your data is yours. Every record is exportable to CSV, Parquet, or signed Postgres dump at any time. There are no lock-in clauses. You came with your data, you leave with your data.",
        },
        {
            q: 'How do you handle compliance — DPDP / GDPR / SOC 2?',
            a: 'DPDP, GDPR, and India-specific compliance (GST, DLT for SMS, signed e-invoices) are native. SOC 2 Type II and ISO 27001 reports are available under NDA on the Scale and Enterprise plans.',
        },
        {
            q: "What's region pinning?",
            a: 'On Scale and Enterprise, you choose where your data sits — India, EU, or US. Data never leaves the region you pick. Backups and restores stay in-region too.',
        },
        {
            q: 'Can I run SabNode in my own VPC or on-prem?',
            a: 'Yes — Enterprise supports single-tenant deployment in your VPC. Air-gapped on-prem is also available for regulated industries. Talk to sales for the architecture conversation.',
        },
    ];
    const [open, setOpen] = useState<number | null>(0);
    return (
        <section className="relative bg-white px-6 py-24">
            <div className="mx-auto max-w-4xl">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-zoru-ink">FAQ</p>
                <h2 className="mt-3 text-balance text-4xl font-semibold tracking-tight text-zoru-ink md:text-5xl">
                    Pricing answers — for the parts you usually have to email about.
                </h2>
                <div className="mt-10 divide-y divide-zoru-line border-y border-zoru-line">
                    {items.map((it, i) => {
                        const isOpen = open === i;
                        return (
                            <div key={it.q}>
                                <button
                                    onClick={() => setOpen(isOpen ? null : i)}
                                    className="flex w-full items-center justify-between gap-4 py-5 text-left"
                                >
                                    <span className="text-lg font-semibold text-zoru-ink">{it.q}</span>
                                    <ChevronDown
                                        className={`h-5 w-5 shrink-0 text-zoru-ink-muted transition ${isOpen ? 'rotate-180' : ''}`}
                                    />
                                </button>
                                <AnimatePresence initial={false}>
                                    {isOpen && (
                                        <m.div
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: 'auto', opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            transition={{ duration: 0.2 }}
                                            className="overflow-hidden"
                                        >
                                            <p className="pb-5 text-[15px] leading-relaxed text-zoru-ink">{it.a}</p>
                                        </m.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        );
                    })}
                </div>
            </div>
        </section>
    );
}

// ───────── FINAL CTA ─────────
function FinalCta({ session }: { session?: { user?: unknown } | null }) {
    return (
        <section className="relative px-6 py-32">
            <div className="mx-auto max-w-5xl">
                <m.div
                    initial={{ opacity: 0, scale: 0.96 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                    className="relative overflow-hidden rounded-[2.5rem] bg-zoru-ink px-8 py-16 text-white md:px-16 md:py-24"
                >
                    <div
                        aria-hidden
                        className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full blur-3xl"
                        style={{ background: 'rgba(251,146,60,0.45)' }}
                    />
                    <div
                        aria-hidden
                        className="pointer-events-none absolute -left-24 -bottom-24 h-72 w-72 rounded-full blur-3xl"
                        style={{ background: 'rgba(244,63,94,0.35)' }}
                    />
                    <div className="relative grid items-center gap-10 md:grid-cols-2">
                        <div>
                            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-zoru-ink-muted">
                                Ready when you are
                            </p>
                            <h2 className="mt-4 text-balance text-4xl font-semibold tracking-tight md:text-5xl">
                                Start free, scale to enterprise — same stack, same data.
                            </h2>
                            <p className="mt-4 text-base text-white/70">
                                14 days free. No card needed. White-glove migration included.
                            </p>
                            <div className="mt-8 flex flex-wrap gap-3">
                                <Link
                                    href={session?.user ? '/dashboard' : '/login?signup=1'}
                                    className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-zoru-surface-2 via-zoru-ink to-zoru-ink px-5 py-2.5 text-sm font-semibold text-white shadow-lg hover:scale-[1.03]"
                                >
                                    Start free <ArrowRight className="h-3.5 w-3.5" />
                                </Link>
                                <Link
                                    href="/contact"
                                    className="inline-flex items-center gap-1.5 rounded-full border border-white/20 px-5 py-2.5 text-sm font-semibold text-white hover:bg-white/10"
                                >
                                    <PhoneCall className="h-4 w-4" /> Talk to sales
                                </Link>
                            </div>
                        </div>
                        <div className="space-y-3">
                            {[
                                { icon: Sparkles, t: 'Free 14-day trial of Growth or Scale' },
                                { icon: Building2, t: 'White-glove migration from your existing tools' },
                                { icon: Shield, t: 'SOC 2 + ISO 27001 reports available' },
                                { icon: Users, t: 'Dedicated success manager from day one (Scale+)' },
                            ].map((p) => {
                                const Icon = p.icon;
                                return (
                                    <div key={p.t} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-3.5">
                                        <Icon className="h-4 w-4 text-zoru-ink-muted" />
                                        <span className="text-sm text-white/90">{p.t}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </m.div>
            </div>
        </section>
    );
}
