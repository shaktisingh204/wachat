'use client';

import { m } from 'motion/react';
import { Check, X, Minus } from 'lucide-react';

const rows = [
    { feature: 'Omnichannel inbox (WhatsApp + IG + email + chat)', sn: 'yes', zoho: 'partial', hubspot: 'partial' },
    { feature: 'WhatsApp Business (official, templates, broadcast)', sn: 'yes', zoho: 'partial', hubspot: 'no' },
    { feature: 'Visual automation (drag-drop, 900+ integrations)', sn: 'yes', zoho: 'partial', hubspot: 'no' },
    { feature: 'Built-in CRM with quotes / invoices / inventory', sn: 'yes', zoho: 'yes', hubspot: 'partial' },
    { feature: 'HR + payroll + attendance', sn: 'yes', zoho: 'partial', hubspot: 'no' },
    { feature: 'SEO + landing pages + A/B', sn: 'yes', zoho: 'no', hubspot: 'partial' },
    { feature: 'AI copilot — drafts, sentiment, translate', sn: 'yes', zoho: 'no', hubspot: 'partial' },
    { feature: 'Single tenant, single bill, one team', sn: 'yes', zoho: 'no', hubspot: 'no' },
];

function Cell({ v }: { v: 'yes' | 'partial' | 'no' }) {
    if (v === 'yes')
        return (
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                <Check className="h-4 w-4" />
            </span>
        );
    if (v === 'partial')
        return (
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-amber-100 text-amber-700">
                <Minus className="h-4 w-4" />
            </span>
        );
    return (
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-zinc-100 text-zinc-400">
            <X className="h-4 w-4" />
        </span>
    );
}

export function Comparison() {
    return (
        <section className="relative py-28">
            <div className="mx-auto max-w-5xl px-6">
                <m.div
                    initial={{ opacity: 0, y: 12 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="mx-auto max-w-2xl text-center"
                >
                    <span className="inline-flex items-center rounded-full border border-zinc-900/10 bg-white px-3 py-1 text-xs font-medium text-zinc-700 shadow-sm">
                        How we stack up
                    </span>
                    <h2 className="mt-5 text-balance text-4xl font-semibold tracking-tight text-zinc-950 sm:text-5xl">
                        Six products. Zero stitching.
                    </h2>
                    <p className="mt-4 text-pretty text-zinc-600">
                        A side-by-side at the categories most teams piece together from 3-5 separate
                        subscriptions.
                    </p>
                </m.div>

                <m.div
                    initial={{ opacity: 0, y: 16 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.1 }}
                    className="mt-12 overflow-hidden rounded-2xl border border-zinc-200/70 bg-white shadow-xl"
                >
                    <div className="grid grid-cols-[1.6fr_repeat(3,1fr)] border-b border-zinc-200/60 bg-zinc-50 px-5 py-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                        <span>Capability</span>
                        <span className="text-center">SabNode</span>
                        <span className="text-center">Zoho One</span>
                        <span className="text-center">Hubspot</span>
                    </div>
                    {rows.map((r, i) => (
                        <m.div
                            key={r.feature}
                            initial={{ opacity: 0, x: -10 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: 0.05 * i }}
                            className={`grid grid-cols-[1.6fr_repeat(3,1fr)] items-center px-5 py-3 text-sm ${
                                i % 2 ? 'bg-white' : 'bg-zinc-50/50'
                            }`}
                        >
                            <span className="pr-4 text-zinc-800">{r.feature}</span>
                            <span className="grid place-items-center">
                                <Cell v={r.sn as 'yes' | 'partial' | 'no'} />
                            </span>
                            <span className="grid place-items-center">
                                <Cell v={r.zoho as 'yes' | 'partial' | 'no'} />
                            </span>
                            <span className="grid place-items-center">
                                <Cell v={r.hubspot as 'yes' | 'partial' | 'no'} />
                            </span>
                        </m.div>
                    ))}
                </m.div>
            </div>
        </section>
    );
}
