'use client';

import Link from 'next/link';
import { m } from 'motion/react';
import { useState } from 'react';
import { Check, ArrowRight } from 'lucide-react';

const tiers = [
    {
        name: 'Starter',
        tag: 'For ambitious solo teams',
        priceM: 0,
        priceY: 0,
        cta: 'Start free',
        highlight: false,
        features: [
            'Wachat + SabChat included',
            '1 inbox, 2 agents',
            '500 conversations / mo',
            'Email support',
        ],
    },
    {
        name: 'Growth',
        tag: 'For teams scaling fast',
        priceM: 49,
        priceY: 39,
        cta: 'Start 14-day trial',
        highlight: true,
        features: [
            'All 6 modules — Wachat, SabFlow, SabChat, CRM, SEO, HRM',
            'Unlimited inboxes, 10 agents',
            '50k conversations / mo',
            'AI Smart Assist included',
            'Priority chat support',
        ],
    },
    {
        name: 'Enterprise',
        tag: 'For ops at scale',
        priceM: null,
        priceY: null,
        cta: 'Talk to sales',
        highlight: false,
        features: [
            'Everything in Growth',
            'Unlimited agents + conversations',
            'SSO, SCIM, audit log',
            'Regional data residency',
            'Dedicated CSM',
        ],
    },
];

export function PricingTeaser() {
    const [annual, setAnnual] = useState(true);

    return (
        <section id="pricing" className="relative py-28">
            <div className="mx-auto max-w-7xl px-6">
                <m.div
                    initial={{ opacity: 0, y: 12 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="mx-auto max-w-2xl text-center"
                >
                    <h2 className="text-balance text-4xl font-semibold tracking-tight text-zoru-ink sm:text-5xl">
                        One bill. Six products. No surprises.
                    </h2>
                    <p className="mt-4 text-zoru-ink">
                        Pay for the team, not the tools. Annual billing saves you 20%.
                    </p>

                    <div className="mt-7 inline-flex rounded-full border border-zoru-line bg-white p-1 shadow-sm">
                        {[
                            { id: 'monthly', label: 'Monthly' },
                            { id: 'annual', label: 'Annual · -20%' },
                        ].map((opt) => {
                            const active = (opt.id === 'annual' && annual) || (opt.id === 'monthly' && !annual);
                            return (
                                <button
                                    key={opt.id}
                                    onClick={() => setAnnual(opt.id === 'annual')}
                                    className="relative rounded-full px-5 py-1.5 text-xs font-medium transition"
                                >
                                    {active && (
                                        <m.div
                                            layoutId="pricing-toggle"
                                            className="absolute inset-0 rounded-full bg-zoru-ink"
                                            transition={{ type: 'spring', bounce: 0.2 }}
                                        />
                                    )}
                                    <span className={`relative z-10 ${active ? 'text-white' : 'text-zoru-ink'}`}>
                                        {opt.label}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </m.div>

                <div className="mt-14 grid gap-4 md:grid-cols-3">
                    {tiers.map((t, i) => (
                        <m.div
                            key={t.name}
                            initial={{ opacity: 0, y: 16 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: i * 0.08 }}
                            className={`relative overflow-hidden rounded-2xl border p-6 shadow-sm ${
                                t.highlight
                                    ? 'border-zoru-line bg-gradient-to-b from-zoru-surface-2 to-zoru-surface-2'
                                    : 'border-zoru-line/70 bg-white'
                            }`}
                        >
                            {t.highlight && (
                                <span className="absolute right-6 top-6 rounded-full bg-zoru-ink px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                                    Popular
                                </span>
                            )}
                            <div className="text-sm font-medium text-zoru-ink">{t.name}</div>
                            <div className="mt-1 text-xs text-zoru-ink">{t.tag}</div>

                            <div className="mt-5 flex items-baseline gap-1">
                                {t.priceM === null ? (
                                    <span className="text-3xl font-semibold text-zoru-ink">Custom</span>
                                ) : (
                                    <>
                                        <span className="text-5xl font-semibold tracking-tight text-zoru-ink">
                                            ${annual ? t.priceY : t.priceM}
                                        </span>
                                        <span className="text-sm text-zoru-ink">/ mo</span>
                                    </>
                                )}
                            </div>

                            <ul className="mt-6 space-y-2.5">
                                {t.features.map((f) => (
                                    <li key={f} className="flex items-start gap-2 text-sm text-zoru-ink">
                                        <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-zoru-ink" />
                                        <span>{f}</span>
                                    </li>
                                ))}
                            </ul>

                            <Link
                                href={t.name === 'Enterprise' ? '/contact' : '/login?signup=1'}
                                className={`group mt-7 inline-flex w-full items-center justify-center gap-1.5 rounded-full px-5 py-2.5 text-sm font-semibold transition ${
                                    t.highlight
                                        ? 'bg-gradient-to-r from-zoru-surface-2 via-zoru-ink to-zoru-ink text-white shadow-lg shadow-zoru-line/30 hover:scale-[1.02]'
                                        : 'border border-zoru-line bg-white text-zoru-ink hover:bg-zoru-surface-2'
                                }`}
                            >
                                {t.cta}
                                <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
                            </Link>
                        </m.div>
                    ))}
                </div>

                <p className="mt-8 text-center text-xs text-zoru-ink">
                    Want the breakdown?{' '}
                    <Link href="/pricing" className="text-zoru-ink underline-offset-4 hover:underline">
                        See full pricing →
                    </Link>
                </p>
            </div>
        </section>
    );
}
