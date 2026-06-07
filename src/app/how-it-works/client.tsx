'use client';

import { useRouter } from 'next/navigation';
import {
    ArrowRight,
    Database,
    Plug,
    Workflow,
    Eye,
    Repeat,
    Sparkles,
} from 'lucide-react';
import { MarketingShell, PageHero, SectionWrap } from '@/components/landing-v2/marketing-shell';
import { Button, Card, Badge, Dot } from '@/components/sabcrm/20ui';

const STEPS = [
    { icon: Plug, t: 'Connect your tools', d: 'OAuth your existing stack: WhatsApp, email, payments, CRM, ad accounts. We auto-detect schemas.' },
    { icon: Database, t: 'Shared data model', d: 'Every record (customer, deal, ticket, payslip) lands in one schema every module reads from.' },
    { icon: Workflow, t: 'Pick and configure modules', d: 'Turn on what you need. Every module ships with sensible defaults you can tweak in one screen.' },
    { icon: Sparkles, t: 'Automate with SabFlow', d: 'Build cross-module workflows. A lead replies, a CRM deal opens, an invoice goes out, and the warehouse ships.' },
    { icon: Eye, t: 'See everything live', d: 'Composable dashboards from any module. Real-time, role-aware, embedded anywhere.' },
    { icon: Repeat, t: 'Iterate, version, ship', d: 'Every change is signed, replayable, reversible. Roll out behind a flag. Roll back in a click.' },
];

const ARCH = [
    { title: 'Modules', d: '47 product surfaces: chat, automation, CRM, HR, files, analytics. Toggle on, configure, ship.' },
    { title: 'Data spine', d: 'One Postgres + R2 spine. Customers, files, events. Cross-module joins are free.' },
    { title: 'Workflow engine', d: 'SabFlow runs every automation: branching, retries, AI nodes, replay.' },
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
    const router = useRouter();

    return (
        <MarketingShell session={session}>
            <PageHero
                kicker="The architecture"
                title={<>One stack. <span className="bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 bg-clip-text text-transparent">Six layers.</span> Built to last.</>}
                subtitle="SabNode isn't a Frankenstein of 6 acquired tools. It's a single platform, with one data model, one workflow engine, one audit log."
                extra={
                    <Button
                        variant="gradient"
                        size="lg"
                        iconRight={ArrowRight}
                        onClick={() => router.push(session?.user ? '/dashboard' : '/login?signup=1')}
                    >
                        Try it free
                    </Button>
                }
            />

            {/* 6 STEPS */}
            <SectionWrap>
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--st-text-tertiary)]">The journey</p>
                <h2 className="mt-3 max-w-3xl text-balance text-4xl font-semibold tracking-tight text-[var(--st-text)] md:text-5xl">
                    From sign-up to first shipped automation, in one afternoon.
                </h2>
                <div className="mt-14 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
                    {STEPS.map((s, i) => {
                        const Icon = s.icon;
                        return (
                            <Card key={s.t} variant="outlined" padding="lg">
                                <div className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-amber-400 via-orange-500 to-rose-500 shadow-md">
                                    <Icon className="h-5 w-5 text-white" aria-hidden="true" />
                                </div>
                                <Badge tone="accent" kind="soft" className="mt-4">
                                    Step 0{i + 1}
                                </Badge>
                                <h3 className="mt-2 text-xl font-semibold tracking-tight text-[var(--st-text)]">{s.t}</h3>
                                <p className="mt-2 text-[14px] leading-relaxed text-[var(--st-text-secondary)]">{s.d}</p>
                            </Card>
                        );
                    })}
                </div>
            </SectionWrap>

            {/* ARCH DIAGRAM */}
            <SectionWrap bg="white">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--st-text-tertiary)]">Architecture</p>
                <h2 className="mt-3 max-w-3xl text-balance text-4xl font-semibold tracking-tight text-[var(--st-text)] md:text-5xl">
                    Six layers that turn into one platform.
                </h2>
                <div className="mt-12 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                    {ARCH.map((a, i) => (
                        <Card key={a.title} variant="outlined" padding="md">
                            <Badge tone="neutral" kind="soft">
                                Layer 0{i + 1}
                            </Badge>
                            <h3 className="mt-2 text-lg font-semibold text-[var(--st-text)]">{a.title}</h3>
                            <p className="mt-1 text-[13px] leading-relaxed text-[var(--st-text-secondary)]">{a.d}</p>
                        </Card>
                    ))}
                </div>
            </SectionWrap>

            {/* PRINCIPLES */}
            <SectionWrap>
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--st-text-tertiary)]">Principles</p>
                <h2 className="mt-3 max-w-3xl text-balance text-4xl font-semibold tracking-tight text-[var(--st-text)] md:text-5xl">
                    Boring rules we don&apos;t break.
                </h2>
                <ul className="mt-10 grid grid-cols-1 gap-3 md:grid-cols-2">
                    {PRINCIPLES.map((p) => (
                        <li key={p}>
                            <Card variant="outlined" padding="md" className="flex items-start gap-3">
                                <Dot tone="accent" className="mt-1.5 shrink-0" aria-hidden="true" />
                                <span className="text-[15px] text-[var(--st-text)]">{p}</span>
                            </Card>
                        </li>
                    ))}
                </ul>
            </SectionWrap>

            {/* CTA */}
            <SectionWrap>
                <div className="relative overflow-hidden rounded-3xl bg-zinc-950 px-8 py-16 text-white md:px-16">
                    <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-orange-400/45 blur-3xl" />
                    <h2 className="relative text-balance text-4xl font-semibold tracking-tight md:text-5xl">
                        See the whole thing run on your data.
                    </h2>
                    <p className="relative mt-4 max-w-2xl text-base text-white/70">
                        We&apos;ll spin up a demo workspace with your contacts, products, and customers imported.
                    </p>
                    <div className="relative mt-8 flex flex-wrap gap-3">
                        <Button
                            variant="gradient"
                            size="lg"
                            iconRight={ArrowRight}
                            onClick={() => router.push('/contact')}
                        >
                            Book a live demo
                        </Button>
                        <Button
                            variant="outline"
                            size="lg"
                            onClick={() => router.push('/pricing')}
                        >
                            See pricing
                        </Button>
                    </div>
                </div>
            </SectionWrap>
        </MarketingShell>
    );
}
