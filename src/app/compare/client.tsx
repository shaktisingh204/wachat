'use client';

import { m } from 'motion/react';
import Link from 'next/link';
import { useState } from 'react';
import { ArrowRight, Check, Minus, Sparkles } from 'lucide-react';
import { MarketingShell, PageHero, SectionWrap } from '@/components/landing-v2/marketing-shell';

const COMPETITORS = ['HubSpot', 'Zoho One', 'Zapier', 'Freshworks', 'Salesforce'];

const ROWS = [
    { feature: 'WhatsApp Business native', sab: true, others: [true, true, false, false, false] },
    { feature: 'Visual automation (Zapier-level)', sab: true, others: [false, 'Limited', true, 'Limited', false] },
    { feature: 'Per-seat pricing', sab: false, others: [true, true, true, true, true] },
    { feature: 'Built-in CRM + invoicing + GST', sab: true, others: [false, true, false, false, true] },
    { feature: 'Payroll + HRM', sab: true, others: [false, true, false, false, false] },
    { feature: 'Omnichannel inbox (8 channels)', sab: true, others: [true, true, false, true, true] },
    { feature: 'Session replay + heatmaps', sab: true, others: [false, false, false, false, false] },
    { feature: 'AI on every module', sab: true, others: ['Limited', 'Limited', 'Limited', 'Limited', 'Limited'] },
    { feature: 'India compliance (GST/DLT/DPDP)', sab: true, others: [false, 'Partial', false, false, 'Partial'] },
    { feature: 'Free migration help', sab: true, others: [false, false, false, false, false] },
    { feature: 'BYO-KMS / region pinning', sab: true, others: [false, false, false, false, true] },
    { feature: 'SOC 2 + ISO 27001 reports', sab: true, others: [true, true, true, true, true] },
    { feature: 'Yearly billing (−20%)', sab: true, others: [true, true, true, true, true] },
    { feature: 'No vendor lock-in (CSV/Parquet export)', sab: true, others: ['Partial', 'Partial', 'Partial', 'Partial', 'Limited'] },
    { feature: 'Free tier', sab: true, others: [true, true, true, true, false] },
];

export function CompareClient({ session }: { session?: { user?: unknown } | null }) {
    const [vs, setVs] = useState(0); // index into COMPETITORS

    const cell = (v: unknown) => {
        if (v === true) return <Check className="mx-auto h-4 w-4 text-emerald-600" />;
        if (v === false) return <Minus className="mx-auto h-4 w-4 text-rose-300" />;
        return <span className="text-zinc-600">{String(v)}</span>;
    };

    return (
        <MarketingShell session={session}>
            <PageHero
                kicker="Honest comparisons"
                title={<>SabNode vs <span className="bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 bg-clip-text text-transparent">the legacy giants.</span></>}
                subtitle="No hand-waving. Here's exactly what we do better, what we do worse, and where we tie."
            />

            {/* Competitor switcher */}
            <SectionWrap>
                <div className="flex flex-wrap justify-center gap-1.5">
                    {COMPETITORS.map((c, i) => (
                        <button key={c} onClick={() => setVs(i)} className="relative rounded-full px-3.5 py-1.5 text-[12px] font-medium transition">
                            {vs === i && <m.span layoutId="vs-tab" className="absolute inset-0 rounded-full bg-zinc-900" transition={{ type: 'spring', stiffness: 380, damping: 30 }} />}
                            <span className={`relative z-10 ${vs === i ? 'text-white' : 'text-zinc-600 hover:text-zinc-900'}`}>SabNode vs {c}</span>
                        </button>
                    ))}
                </div>

                <m.div initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
                    className="mt-10 overflow-hidden rounded-3xl border border-zinc-200 bg-white">
                    <div className="grid grid-cols-3 border-b border-zinc-200 bg-zinc-50 px-5 py-4">
                        <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Feature</div>
                        <div className="text-center">
                            <span className="rounded-full bg-zinc-900 px-3 py-1 text-[12px] font-semibold text-white">SabNode</span>
                        </div>
                        <div className="text-center text-[12px] font-semibold text-zinc-700">{COMPETITORS[vs]}</div>
                    </div>
                    {ROWS.map((r, i) => (
                        <m.div key={r.feature} initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }}
                            transition={{ delay: i * 0.02 }}
                            className="grid grid-cols-3 items-center border-b border-zinc-100 px-5 py-3 text-[13px] last:border-0">
                            <div className="text-zinc-800">{r.feature}</div>
                            <div className="text-center">{cell(r.sab)}</div>
                            <div className="text-center">{cell(r.others[vs])}</div>
                        </m.div>
                    ))}
                </m.div>
            </SectionWrap>

            {/* Why people switch */}
            <SectionWrap bg="white">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-500">Why people switch</p>
                <h2 className="mt-3 max-w-3xl text-balance text-4xl font-semibold tracking-tight text-zinc-950 md:text-5xl">
                    Three reasons we keep hearing.
                </h2>
                <div className="mt-12 grid grid-cols-1 gap-5 md:grid-cols-3">
                    {[
                        { t: 'One bill replaced 6 invoices', d: 'Customers save ₹2–4L/mo by consolidating HubSpot + Zoho + Calendly + Loyalzoo + Mailchimp + Zapier.' },
                        { t: 'Per-seat pricing was killing us', d: 'Usage-based pricing means adding agents is finally cheap. Teams onboard everyone, not just power users.' },
                        { t: 'Customer data never linked', d: 'Now WhatsApp, email, deals, invoices, payroll all share one customer record — finally.' },
                    ].map((p, i) => (
                        <m.div key={p.t} initial={{ opacity: 0, y: 8 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
                            transition={{ delay: i * 0.05 }}
                            className="rounded-2xl border border-zinc-200 bg-[#fafaf7] p-6">
                            <Sparkles className="h-5 w-5 text-amber-600" />
                            <p className="mt-3 text-lg font-semibold text-zinc-950">{p.t}</p>
                            <p className="mt-2 text-[13px] leading-relaxed text-zinc-600">{p.d}</p>
                        </m.div>
                    ))}
                </div>
            </SectionWrap>

            {/* CTA */}
            <SectionWrap>
                <m.div initial={{ opacity: 0, scale: 0.96 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }}
                    className="relative overflow-hidden rounded-3xl bg-zinc-950 px-8 py-16 text-white md:px-16">
                    <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full blur-3xl" style={{ background: 'rgba(251,146,60,0.45)' }} />
                    <h2 className="relative text-balance text-4xl font-semibold tracking-tight md:text-5xl">
                        Want a side-by-side of your current stack?
                    </h2>
                    <p className="relative mt-4 max-w-2xl text-base text-white/70">
                        Tell us what you use today. We&apos;ll send a 1-pager showing exact features + cost diff.
                    </p>
                    <Link href="/contact" className="relative mt-8 inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-amber-400 via-orange-500 to-rose-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg">
                        Get the comparison <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                </m.div>
            </SectionWrap>
        </MarketingShell>
    );
}
