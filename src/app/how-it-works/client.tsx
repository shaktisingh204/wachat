'use client';

import { m } from 'motion/react';
import Link from 'next/link';
import {
    ArrowRight,
    Database,
    Plug,
    Workflow,
    Eye,
    Repeat,
    Shield,
    Sparkles,
    Layers,
    Activity,
    GitBranch,
} from 'lucide-react';
import { MarketingShell, PageHero, SectionWrap } from '@/components/landing-v2/marketing-shell';

const STEPS = [
    { icon: Plug, t: 'Connect your tools', d: 'OAuth your existing stack — WhatsApp, email, payments, CRM, ad accounts. We auto-detect schemas.' },
    { icon: Database, t: 'Shared data model', d: 'Every record (customer, deal, ticket, payslip) lands in one schema every module reads from.' },
    { icon: Workflow, t: 'Pick + configure modules', d: 'Turn on what you need. Every module ships with sensible defaults you can tweak in one screen.' },
    { icon: Sparkles, t: 'Automate with SabFlow', d: 'Build cross-module workflows — "lead replies → CRM deal → send invoice → ship from warehouse".' },
    { icon: Eye, t: 'See everything live', d: 'Composable dashboards from any module. Real-time, role-aware, embedded anywhere.' },
    { icon: Repeat, t: 'Iterate, version, ship', d: 'Every change is signed, replayable, reversible. Roll out behind a flag. Roll back in a click.' },
];

const ARCH = [
    { title: 'Modules', d: '47 product surfaces — chat, automation, CRM, HR, files, analytics. Toggle on, configure, ship.' },
    { title: 'Data spine', d: 'One Postgres + R2 spine. Customers, files, events. Cross-module joins are free.' },
    { title: 'Workflow engine', d: 'SabFlow runs every automation — branching, retries, AI nodes, replay.' },
    { title: 'AI layer', d: 'BYO key or use ours. GPT, Claude, Gemini, local Ollama. Tool-use, memory, structured output.' },
    { title: 'API + webhooks', d: 'Every action exposed as a signed REST / webhook. Idempotent by default.' },
    { title: 'Audit + RBAC', d: 'Every read/write signed. Roles per module, per project, per environment.' },
];

const PRINCIPLES = [
    'No per-seat pricing. Add as many users as you need.',
    'No vendor lock-in. Export as CSV, Parquet, or signed Postgres dump.',
    'No proprietary scripting. Standard SQL, JS expressions, REST.',
    'No black-box AI. Every prompt is visible, every output is logged.',
    'No setup fees. White-glove migration included.',
    'No silent breaking changes. Every release is versioned and announced.',
];

export function HowItWorksClient({ session }: { session?: { user?: unknown } | null }) {
    return (
        <MarketingShell session={session}>
            <PageHero
                kicker="The architecture"
                title={<>One stack. <span className="bg-gradient-to-r from-zoru-ink via-zoru-ink to-zoru-ink bg-clip-text text-transparent">Six layers.</span> Built to last.</>}
                subtitle="SabNode isn't a Frankenstein of 6 acquired tools. It's a single platform — one data model, one workflow engine, one audit log."
                extra={
                    <Link
                        href={session?.user ? '/dashboard' : '/login?signup=1'}
                        className="inline-flex items-center gap-2 rounded-full bg-zoru-ink px-5 py-2.5 text-sm font-semibold text-white hover:bg-zoru-ink"
                    >
                        Try it free <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                }
            />

            {/* 6 STEPS */}
            <SectionWrap>
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-zoru-ink">The journey</p>
                <h2 className="mt-3 max-w-3xl text-balance text-4xl font-semibold tracking-tight text-zoru-ink md:text-5xl">
                    From sign-up to first shipped automation — in one afternoon.
                </h2>
                <div className="mt-14 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
                    {STEPS.map((s, i) => {
                        const Icon = s.icon;
                        return (
                            <m.div
                                key={s.t}
                                initial={{ opacity: 0, y: 10 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: i * 0.05 }}
                                className="rounded-2xl border border-zoru-line bg-white p-6"
                            >
                                <div className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-zoru-surface-2 via-zoru-ink to-zoru-ink shadow-md">
                                    <Icon className="h-5 w-5 text-white" />
                                </div>
                                <p className="mt-4 text-[11px] font-semibold uppercase tracking-wider text-zoru-ink">
                                    Step 0{i + 1}
                                </p>
                                <h3 className="mt-1 text-xl font-semibold tracking-tight text-zoru-ink">{s.t}</h3>
                                <p className="mt-2 text-[14px] leading-relaxed text-zoru-ink">{s.d}</p>
                            </m.div>
                        );
                    })}
                </div>
            </SectionWrap>

            {/* ARCH DIAGRAM */}
            <SectionWrap bg="white">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-zoru-ink">Architecture</p>
                <h2 className="mt-3 max-w-3xl text-balance text-4xl font-semibold tracking-tight text-zoru-ink md:text-5xl">
                    Six layers that turn into one platform.
                </h2>
                <div className="mt-12 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                    {ARCH.map((a, i) => (
                        <m.div
                            key={a.title}
                            initial={{ opacity: 0, y: 8 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: i * 0.05 }}
                            className="rounded-2xl border border-zoru-line bg-zoru-surface p-5"
                        >
                            <span className="text-[11px] font-semibold uppercase tracking-wider text-zoru-ink">
                                Layer 0{i + 1}
                            </span>
                            <h3 className="mt-2 text-lg font-semibold text-zoru-ink">{a.title}</h3>
                            <p className="mt-1 text-[13px] leading-relaxed text-zoru-ink">{a.d}</p>
                        </m.div>
                    ))}
                </div>
            </SectionWrap>

            {/* PRINCIPLES */}
            <SectionWrap>
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-zoru-ink">Principles</p>
                <h2 className="mt-3 max-w-3xl text-balance text-4xl font-semibold tracking-tight text-zoru-ink md:text-5xl">
                    Boring rules we don&apos;t break.
                </h2>
                <ul className="mt-10 grid grid-cols-1 gap-3 md:grid-cols-2">
                    {PRINCIPLES.map((p, i) => (
                        <m.li
                            key={p}
                            initial={{ opacity: 0, x: -6 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: i * 0.04 }}
                            className="flex items-start gap-3 rounded-2xl border border-zoru-line bg-white p-4"
                        >
                            <span className="mt-1 inline-block h-2 w-2 shrink-0 rounded-full bg-gradient-to-r from-zoru-surface-2 to-zoru-ink" />
                            <span className="text-[15px] text-zoru-ink">{p}</span>
                        </m.li>
                    ))}
                </ul>
            </SectionWrap>

            {/* CTA */}
            <SectionWrap>
                <m.div
                    initial={{ opacity: 0, scale: 0.96 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                    className="relative overflow-hidden rounded-3xl bg-zoru-ink px-8 py-16 text-white md:px-16"
                >
                    <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full blur-3xl" style={{ background: 'rgba(251,146,60,0.45)' }} />
                    <h2 className="relative text-balance text-4xl font-semibold tracking-tight md:text-5xl">
                        See the whole thing run on your data.
                    </h2>
                    <p className="relative mt-4 max-w-2xl text-base text-white/70">
                        We&apos;ll spin up a demo workspace with your contacts, products, and customers imported.
                    </p>
                    <div className="relative mt-8 flex flex-wrap gap-3">
                        <Link href="/contact" className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-zoru-surface-2 via-zoru-ink to-zoru-ink px-5 py-2.5 text-sm font-semibold text-white shadow-lg">
                            Book a live demo <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                        <Link href="/pricing" className="inline-flex items-center gap-1.5 rounded-full border border-white/20 px-5 py-2.5 text-sm font-semibold text-white hover:bg-white/10">
                            See pricing
                        </Link>
                    </div>
                </m.div>
            </SectionWrap>
        </MarketingShell>
    );
}
