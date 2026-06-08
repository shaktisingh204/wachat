'use client';

import { m } from 'motion/react';
import Link from 'next/link';
import { useState } from 'react';
import { ArrowRight, Check, Minus, Sparkles } from 'lucide-react';
import { MarketingShell, PageHero, SectionWrap } from '@/components/landing-v2/marketing-shell';
import {
    Badge,
    Button,
    Card,
    SegmentedControl,
    Table,
    THead,
    TBody,
    Tr,
    Th,
    Td,
} from '@/components/sabcrm/20ui';

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
    { feature: 'Yearly billing (-20%)', sab: true, others: [true, true, true, true, true] },
    { feature: 'No vendor lock-in (CSV/Parquet export)', sab: true, others: ['Partial', 'Partial', 'Partial', 'Partial', 'Limited'] },
    { feature: 'Free tier', sab: true, others: [true, true, true, true, false] },
];

const REASONS = [
    { t: 'One bill replaced 6 invoices', d: 'Customers save Rs 2-4L/mo by consolidating HubSpot, Zoho, Calendly, Loyalzoo, Mailchimp and Zapier.' },
    { t: 'Per-seat pricing was killing us', d: 'Usage-based pricing means adding agents is finally cheap. Teams onboard everyone, not just power users.' },
    { t: 'Customer data never linked', d: 'Now WhatsApp, email, deals, invoices and payroll all share one customer record, finally.' },
];

export function CompareClient({ session }: { session?: { user?: unknown } | null }) {
    const [vs, setVs] = useState(0); // index into COMPETITORS

    const cell = (v: unknown) => {
        if (v === true) return <Check className="mx-auto h-4 w-4 text-[var(--st-status-ok)]" aria-label="Yes" />;
        if (v === false) return <Minus className="mx-auto h-4 w-4 text-[var(--st-text-tertiary)]" aria-label="No" />;
        return <span className="text-[var(--st-text-secondary)]">{String(v)}</span>;
    };

    const segItems = COMPETITORS.map((c, i) => ({ value: String(i), label: `SabNode vs ${c}` }));

    return (
        <MarketingShell session={session}>
            <PageHero
                kicker="Honest comparisons"
                title={<>SabNode vs <span className="bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 bg-clip-text text-transparent">the legacy giants.</span></>}
                subtitle="No hand-waving. Here's exactly what we do better, what we do worse, and where we tie."
            />

            <div className="20ui">
                {/* Competitor switcher */}
                <SectionWrap>
                    <div className="flex flex-wrap justify-center">
                        <SegmentedControl
                            items={segItems}
                            value={String(vs)}
                            onChange={(v) => setVs(Number(v))}
                            aria-label="Choose a competitor to compare against"
                        />
                    </div>

                    <m.div
                        initial={{ opacity: 0, y: 10 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        className="mt-10"
                    >
                        <Card variant="outlined" padding="none" className="overflow-hidden">
                            <Table hover={false}>
                                <THead>
                                    <Tr>
                                        <Th>Feature</Th>
                                        <Th align="center">
                                            <Badge tone="neutral" kind="solid">SabNode</Badge>
                                        </Th>
                                        <Th align="center">{COMPETITORS[vs]}</Th>
                                    </Tr>
                                </THead>
                                <TBody>
                                    {ROWS.map((r) => (
                                        <Tr key={r.feature}>
                                            <Td>{r.feature}</Td>
                                            <Td align="center">{cell(r.sab)}</Td>
                                            <Td align="center">{cell(r.others[vs])}</Td>
                                        </Tr>
                                    ))}
                                </TBody>
                            </Table>
                        </Card>
                    </m.div>
                </SectionWrap>

                {/* Why people switch */}
                <SectionWrap bg="white">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--st-text-secondary)]">Why people switch</p>
                    <h2 className="mt-3 max-w-3xl text-balance text-4xl font-semibold tracking-tight text-[var(--st-text)] md:text-5xl">
                        Three reasons we keep hearing.
                    </h2>
                    <div className="mt-12 grid grid-cols-1 gap-5 md:grid-cols-3">
                        {REASONS.map((p, i) => (
                            <m.div
                                key={p.t}
                                initial={{ opacity: 0, y: 8 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: i * 0.05 }}
                            >
                                <Card variant="outlined" padding="lg" className="h-full">
                                    <Sparkles className="h-5 w-5 text-[var(--st-warn)]" aria-hidden="true" />
                                    <p className="mt-3 text-lg font-semibold text-[var(--st-text)]">{p.t}</p>
                                    <p className="mt-2 text-[13px] leading-relaxed text-[var(--st-text-secondary)]">{p.d}</p>
                                </Card>
                            </m.div>
                        ))}
                    </div>
                </SectionWrap>

                {/* CTA */}
                <SectionWrap>
                    <m.div
                        initial={{ opacity: 0, scale: 0.96 }}
                        whileInView={{ opacity: 1, scale: 1 }}
                        viewport={{ once: true }}
                        className="relative overflow-hidden rounded-3xl bg-zinc-950 px-8 py-16 text-white md:px-16"
                    >
                        <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-orange-400/45 blur-3xl" />
                        <h2 className="relative text-balance text-4xl font-semibold tracking-tight md:text-5xl">
                            Want a side-by-side of your current stack?
                        </h2>
                        <p className="relative mt-4 max-w-2xl text-base text-white/70">
                            Tell us what you use today. We&apos;ll send a 1-pager showing exact features + cost diff.
                        </p>
                        <Link href="/contact" className="relative mt-8 inline-block">
                            <Button variant="gradient" size="lg" iconRight={ArrowRight}>
                                Get the comparison
                            </Button>
                        </Link>
                    </m.div>
                </SectionWrap>
            </div>
        </MarketingShell>
    );
}
