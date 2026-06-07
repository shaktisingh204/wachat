'use client';

import { m } from 'motion/react';
import Link from 'next/link';
import { ArrowUpRight, Quote, TrendingUp } from 'lucide-react';
import { MarketingShell, PageHero, SectionWrap } from '@/components/landing-v2/marketing-shell';
import { Card, CallToAction } from '@/components/sabcrm/20ui';

interface CustomerProps {
    session?: { user?: unknown } | null;
}

const STORIES = [
    {
        name: 'Sole Co.',
        industry: 'D2C footwear · ₹140Cr ARR',
        accent: 'from-emerald-400 to-teal-500',
        kpi: [
            { v: '+184%', l: 'WhatsApp conv' },
            { v: '−68%', l: 'Support time' },
            { v: '3', l: 'Tools replaced' },
        ],
        quote: 'We swapped HubSpot, Zoho and Loyalzoo for SabNode. Migration took 3 days. Customers never noticed.',
        who: 'Aanya Mehra · Head of Growth',
    },
    {
        name: 'Stark Industries',
        industry: 'SaaS · Series B',
        accent: 'from-violet-400 to-fuchsia-500',
        kpi: [
            { v: '−72%', l: 'CAC' },
            { v: '4.8/5', l: 'CSAT' },
            { v: '∞', l: 'Seats added' },
        ],
        quote: 'Per-seat pricing was killing us. SabNode lets us add agents without flinching at the bill.',
        who: 'Rohan Gupta · Founder',
    },
    {
        name: 'Globex Corp.',
        industry: 'B2B · Manufacturing',
        accent: 'from-sky-400 to-indigo-500',
        kpi: [
            { v: '12d', l: 'Time to launch' },
            { v: '₹3.2L', l: 'Saved / mo' },
            { v: '24/7', l: 'AI cover' },
        ],
        quote: 'Our sales team is in 8 cities. SabNode is the only thing they all check before the morning meeting.',
        who: 'Priya Krishnan · VP Sales',
    },
];

const ALL = [
    { name: 'Wayne Co.', tag: 'Manufacturing', metric: '+92% replies' },
    { name: 'Initech', tag: 'B2B SaaS', metric: '4.9 CSAT' },
    { name: 'Daily Planet', tag: 'Media', metric: '12M msgs/mo' },
    { name: 'Soylent Inc.', tag: 'D2C food', metric: '−45% CAC' },
    { name: 'Acme', tag: 'Logistics', metric: '99.9% SLA' },
    { name: 'Tyrell', tag: 'AI startup', metric: '3× faster' },
    { name: 'Cyberdyne', tag: 'Robotics', metric: '8 modules' },
    { name: 'Pied Piper', tag: 'Dev tools', metric: '0 outages' },
];

export function CustomersClient({ session }: CustomerProps) {
    return (
        <MarketingShell session={session}>
            <PageHero
                kicker="Customers · 12,000+ teams"
                title={<>Teams that swapped their stack for <span className="bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 bg-clip-text text-transparent">one bill.</span></>}
                subtitle="From D2C unicorns to series-A SaaS to legacy manufacturers, see how teams across India ship faster with SabNode."
            />

            {/* FEATURED STORIES */}
            <SectionWrap>
                <div className="space-y-16">
                    {STORIES.map((s, i) => (
                        <m.div
                            key={s.name}
                            initial={{ opacity: 0, y: 12 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: i * 0.05 }}
                        >
                            <Card
                                variant="outlined"
                                padding="lg"
                                className="grid items-start gap-10 rounded-[var(--st-radius-lg)] lg:grid-cols-[1fr_1.3fr]"
                            >
                                <div>
                                    <div className={`grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br ${s.accent} text-xl font-black text-[var(--st-text-inverted)] shadow-md`} aria-hidden="true">
                                        {s.name[0]}
                                    </div>
                                    <h3 className="mt-5 text-3xl font-semibold tracking-tight text-[var(--st-text)]">{s.name}</h3>
                                    <p className="mt-1 text-[13px] text-[var(--st-text-secondary)]">{s.industry}</p>
                                    <div className="mt-6 grid grid-cols-3 gap-3">
                                        {s.kpi.map((k) => (
                                            <div key={k.l}>
                                                <p className="text-2xl font-semibold text-[var(--st-text)]">{k.v}</p>
                                                <p className="mt-1 text-[10px] uppercase tracking-wider text-[var(--st-text-secondary)]">{k.l}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <div>
                                    <Quote className="h-7 w-7 text-amber-500" aria-hidden="true" />
                                    <p className="mt-5 text-pretty text-2xl font-medium leading-snug text-[var(--st-text)]">
                                        &ldquo;{s.quote}&rdquo;
                                    </p>
                                    <p className="mt-5 text-sm font-semibold text-[var(--st-text)]">{s.who}</p>
                                    <Link href="/contact" className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-amber-700">
                                        Read the full story <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                                    </Link>
                                </div>
                            </Card>
                        </m.div>
                    ))}
                </div>
            </SectionWrap>

            {/* ALL LOGOS GRID */}
            <SectionWrap bg="white">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--st-text-secondary)]">More teams</p>
                <h2 className="mt-3 max-w-3xl text-balance text-4xl font-semibold tracking-tight text-[var(--st-text)] md:text-5xl">
                    Joining 12,000+ companies in 14 countries.
                </h2>
                <div className="mt-12 grid grid-cols-2 gap-3 md:grid-cols-4">
                    {ALL.map((a, i) => (
                        <m.div
                            key={a.name}
                            initial={{ opacity: 0, y: 6 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: i * 0.03 }}
                        >
                            <Card variant="outlined" padding="md" className="h-full bg-[var(--st-bg-secondary)]">
                                <p className="text-lg font-semibold text-[var(--st-text)]">{a.name}</p>
                                <p className="text-[12px] text-[var(--st-text-secondary)]">{a.tag}</p>
                                <p className="mt-3 inline-flex items-center gap-1 text-[12px] font-semibold text-amber-700">
                                    <TrendingUp className="h-3 w-3" aria-hidden="true" /> {a.metric}
                                </p>
                            </Card>
                        </m.div>
                    ))}
                </div>
            </SectionWrap>

            {/* CTA */}
            <SectionWrap>
                <m.div initial={{ opacity: 0, scale: 0.96 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }}>
                    <CallToAction
                        gradient
                        heading="Your story is next."
                        subtext="Talk to our team and we'll show you exactly how teams in your industry use SabNode."
                        primary={{ label: 'Book a call', href: '/contact', variant: 'gradient' }}
                    />
                </m.div>
            </SectionWrap>
        </MarketingShell>
    );
}
