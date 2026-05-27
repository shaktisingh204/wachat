'use client';

import { m } from 'motion/react';
import Link from 'next/link';
import { Sparkles, Zap, Bug, Shield, ArrowUpRight, Rss } from 'lucide-react';
import { MarketingShell, PageHero, SectionWrap } from '@/components/landing-v2/marketing-shell';

const RELEASES = [
    {
        date: '2026-05-22',
        v: 'v2.18.0',
        tag: 'Feature',
        tone: 'amber',
        title: 'SabFlow expression engine v2',
        items: [
            'New `$json`, `$node`, `$now` expressions with full type inference',
            'Per-item iteration with paired-item lineage tracking',
            'Multi-output IF + Switch nodes with regex match',
            'Pin + replay any execution against new data',
        ],
    },
    {
        date: '2026-05-19',
        v: 'v2.17.4',
        tag: 'Improvement',
        tone: 'sky',
        title: 'SabChat — unified inbox p95 down to 28s',
        items: [
            'Route resolution now runs in <50ms across 8 channels',
            'AI copilot suggestions cached per macro for instant replies',
            'New SLA breach paging via PagerDuty + Slack + WA',
        ],
    },
    {
        date: '2026-05-15',
        v: 'v2.17.0',
        tag: 'Feature',
        tone: 'amber',
        title: 'SabWa shell + 30+ pages on ZoruUI',
        items: [
            'Brand-fresh design system — same brand across all surfaces',
            'New /sabwa/connect 5-step pairing stepper',
            'Anti-ban throttling with adaptive backoff per device',
        ],
    },
    {
        date: '2026-05-12',
        v: 'v2.16.2',
        tag: 'Security',
        tone: 'emerald',
        title: 'SOC 2 Type II — renewed',
        items: [
            'Annual audit completed without any major findings',
            'Renewed report available to existing customers under NDA',
            'BYO-KMS now available on Enterprise plan',
        ],
    },
    {
        date: '2026-05-09',
        v: 'v2.16.1',
        tag: 'Fix',
        tone: 'rose',
        title: 'CRM invoice GST rounding edge case',
        items: [
            'Fixed rounding when subtotal × 18% produced ≥3 decimals',
            'Backfilled past 90 days of invoices, signed corrected PDFs sent',
            'Added regression test covering 12 rounding modes',
        ],
    },
    {
        date: '2026-05-05',
        v: 'v2.16.0',
        tag: 'Feature',
        tone: 'amber',
        title: 'HRM employee portal · roadmaps · permission groups',
        items: [
            'Self-service portal: payslips, tasks, leaves, docs',
            'Visual quarterly roadmap editor with OKR rollup',
            'Auto task reports — weekly summary mailed to managers',
        ],
    },
    {
        date: '2026-04-30',
        v: 'v2.15.0',
        tag: 'Feature',
        tone: 'amber',
        title: 'SabVoice GA — IVR + dialer + AI assist',
        items: [
            'Visual IVR builder with conditional routing',
            'Agent dashboard with whisper / barge / supervisor mode',
            'Live AI transcript + next-best-action suggestions',
        ],
    },
    {
        date: '2026-04-25',
        v: 'v2.14.3',
        tag: 'Improvement',
        tone: 'sky',
        title: 'SabFiles share links — passcode + watermark',
        items: [
            'Optional passcode per share link with rate-limited attempts',
            'Per-folder watermark applied to downloaded PDFs',
            'New audit log entry for every download with IP + UA',
        ],
    },
];

const toneMap: Record<string, { bg: string; text: string; icon: typeof Sparkles }> = {
    amber: { bg: 'bg-amber-100', text: 'text-amber-700', icon: Sparkles },
    sky: { bg: 'bg-sky-100', text: 'text-sky-700', icon: Zap },
    emerald: { bg: 'bg-emerald-100', text: 'text-emerald-700', icon: Shield },
    rose: { bg: 'bg-rose-100', text: 'text-rose-700', icon: Bug },
};

export function ChangelogClient({ session }: { session?: { user?: unknown } | null }) {
    return (
        <MarketingShell session={session}>
            <PageHero
                kicker="Changelog · shipped every week"
                title={<>What we shipped, <span className="bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 bg-clip-text text-transparent">in plain English.</span></>}
                subtitle="Versioned releases, the boring fixes too. Subscribe to get a one-line summary every Friday."
                extra={
                    <div className="flex flex-wrap items-center justify-center gap-3">
                        <Link href="/contact" className="inline-flex items-center gap-2 rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-zinc-800">
                            <Rss className="h-3.5 w-3.5" /> Subscribe to RSS
                        </Link>
                    </div>
                }
            />

            <SectionWrap>
                <div className="relative">
                    <div aria-hidden className="absolute left-3 top-3 bottom-3 w-px bg-zinc-200 md:left-[140px]" />
                    <ul className="space-y-10">
                        {RELEASES.map((r, i) => {
                            const tone = toneMap[r.tone];
                            const ToneIcon = tone.icon;
                            return (
                                <m.li
                                    key={r.date}
                                    initial={{ opacity: 0, y: 10 }}
                                    whileInView={{ opacity: 1, y: 0 }}
                                    viewport={{ once: true }}
                                    transition={{ delay: i * 0.05 }}
                                    className="relative grid gap-4 md:grid-cols-[140px_1fr]"
                                >
                                    <div className="pl-8 md:pl-0 md:pr-8 md:text-right">
                                        <p className="text-sm font-semibold text-zinc-900">{r.date}</p>
                                        <p className="mt-0.5 font-mono text-[12px] text-zinc-500">{r.v}</p>
                                    </div>
                                    <div className="absolute left-0 top-1 md:left-[133px]">
                                        <div className={`grid h-7 w-7 place-items-center rounded-full border-4 border-[#fafaf7] ${tone.bg}`}>
                                            <ToneIcon className={`h-3.5 w-3.5 ${tone.text}`} />
                                        </div>
                                    </div>
                                    <div className="ml-8 rounded-2xl border border-zinc-200 bg-white p-6 md:ml-0">
                                        <div className="flex items-center gap-2">
                                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${tone.bg} ${tone.text}`}>
                                                {r.tag}
                                            </span>
                                        </div>
                                        <h3 className="mt-3 text-2xl font-semibold tracking-tight text-zinc-950">{r.title}</h3>
                                        <ul className="mt-4 space-y-2">
                                            {r.items.map((it) => (
                                                <li key={it} className="flex items-start gap-2 text-[14px] text-zinc-700">
                                                    <span className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-zinc-400" />
                                                    {it}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                </m.li>
                            );
                        })}
                    </ul>
                </div>
            </SectionWrap>
        </MarketingShell>
    );
}
