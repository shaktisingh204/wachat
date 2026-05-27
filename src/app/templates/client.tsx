'use client';

import { m } from 'motion/react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { ArrowUpRight, Search, Sparkles } from 'lucide-react';
import { MarketingShell, PageHero, SectionWrap } from '@/components/landing-v2/marketing-shell';

interface Tmpl {
    title: string;
    cat: string;
    blurb: string;
    minutes: number;
    accent: string;
    badge?: string;
}

const CATEGORIES = ['All', 'Campaigns', 'Automation', 'Sales', 'Support', 'Dashboards', 'Onboarding'];

const TEMPLATES: Tmpl[] = [
    { title: 'Abandoned cart → WA + 10% off', cat: 'Campaigns', blurb: 'Trigger 1h after cart abandon, send template, expire code in 24h.', minutes: 6, accent: 'from-zoru-surface-2 to-zoru-ink', badge: 'Popular' },
    { title: 'Welcome sequence (3-step drip)', cat: 'Campaigns', blurb: 'New signup → welcome WA → email guide → product tour invite.', minutes: 5, accent: 'from-zoru-surface-2 to-zoru-ink' },
    { title: 'Daily revenue to Slack', cat: 'Dashboards', blurb: 'Post yesterday\'s revenue, top product, refund count at 9 AM IST.', minutes: 3, accent: 'from-zoru-surface-2 to-zoru-ink' },
    { title: 'Lead enrichment + assign', cat: 'Sales', blurb: 'New form → enrich via Clearbit → round-robin to sales agent.', minutes: 8, accent: 'from-zoru-surface-2 to-zoru-ink' },
    { title: 'Quote → e-sign → invoice', cat: 'Sales', blurb: 'Approve deal → generate quote → SabSign → auto-invoice on accept.', minutes: 12, accent: 'from-zoru-surface-2 to-zoru-ink' },
    { title: 'Ticket SLA breach paging', cat: 'Support', blurb: 'Watch first-reply timer. On breach: page on-call via Slack + WA.', minutes: 4, accent: 'from-zoru-surface-2 to-zoru-ink', badge: 'New' },
    { title: 'CSAT survey + tagging', cat: 'Support', blurb: 'Closed ticket → WA survey → tag negative replies → escalate.', minutes: 5, accent: 'from-zoru-surface-2 to-zoru-ink' },
    { title: 'Inventory low-stock alert', cat: 'Automation', blurb: 'Stock drops below threshold → notify warehouse manager + raise PO.', minutes: 4, accent: 'from-zoru-surface-2 to-zoru-ink' },
    { title: 'Payment captured → ship', cat: 'Automation', blurb: 'Razorpay webhook → mark deal won → request courier label.', minutes: 6, accent: 'from-zoru-surface-2 to-zoru-ink', badge: 'Popular' },
    { title: 'Sales weekly snapshot', cat: 'Dashboards', blurb: 'Pipeline + deals closed + reps leaderboard, mailed every Mon.', minutes: 4, accent: 'from-zoru-surface-2 to-zoru-ink' },
    { title: 'Support volume by channel', cat: 'Dashboards', blurb: 'Live ticket count split by WA / email / web / IG.', minutes: 3, accent: 'from-zoru-surface-2 to-zoru-ink' },
    { title: 'Employee onboarding kit', cat: 'Onboarding', blurb: 'New hire → docs sent → trainings scheduled → buddy paired.', minutes: 9, accent: 'from-zoru-surface-2 to-zoru-ink' },
    { title: 'Customer onboarding flow', cat: 'Onboarding', blurb: 'Welcome → setup checklist → kickoff call → 30-day check-in.', minutes: 7, accent: 'from-zoru-surface-2 to-zoru-ink' },
    { title: 'Refund + RTO triage', cat: 'Support', blurb: 'Refund request → fraud-check → manager approval → action.', minutes: 8, accent: 'from-zoru-surface-2 to-zoru-ink' },
    { title: 'Birthday + anniversary loyalty', cat: 'Campaigns', blurb: 'Auto-send loyalty discount on customer special dates.', minutes: 4, accent: 'from-zoru-surface-2 to-zoru-ink' },
];

export function TemplatesClient({ session }: { session?: { user?: unknown } | null }) {
    const [tab, setTab] = useState('All');
    const [q, setQ] = useState('');
    const visible = useMemo(() => {
        let out = TEMPLATES;
        if (tab !== 'All') out = out.filter((t) => t.cat === tab);
        if (q.trim()) {
            const term = q.toLowerCase();
            out = out.filter((t) => t.title.toLowerCase().includes(term) || t.blurb.toLowerCase().includes(term));
        }
        return out;
    }, [tab, q]);

    return (
        <MarketingShell session={session}>
            <PageHero
                kicker="Templates · clone in one click"
                title={<>Start from working examples — <span className="bg-gradient-to-r from-zoru-ink via-zoru-ink to-zoru-ink bg-clip-text text-transparent">not a blank page.</span></>}
                subtitle="Battle-tested flows, dashboards, and campaigns made by our team and customers. Clone, tweak, ship."
                extra={
                    <div className="mx-auto flex max-w-md items-center gap-2 rounded-full border border-zoru-line bg-white px-4 py-2 shadow-sm">
                        <Search className="h-4 w-4 text-zoru-ink-muted" />
                        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search templates…" className="w-full bg-transparent text-sm focus:outline-none" />
                    </div>
                }
            />

            <SectionWrap>
                <div className="flex flex-wrap justify-center gap-1.5">
                    {CATEGORIES.map((c) => {
                        const count = c === 'All' ? TEMPLATES.length : TEMPLATES.filter((t) => t.cat === c).length;
                        return (
                            <button key={c} onClick={() => setTab(c)} className="relative rounded-full px-3.5 py-1.5 text-[12px] font-medium transition">
                                {tab === c && <m.span layoutId="tmpl-tab" className="absolute inset-0 rounded-full bg-zoru-ink" transition={{ type: 'spring', stiffness: 380, damping: 30 }} />}
                                <span className={`relative z-10 ${tab === c ? 'text-white' : 'text-zoru-ink hover:text-zoru-ink'}`}>
                                    {c} <span className={`ml-1.5 text-[10px] ${tab === c ? 'text-white/60' : 'text-zoru-ink-muted'}`}>{count}</span>
                                </span>
                            </button>
                        );
                    })}
                </div>

                <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {visible.map((t, i) => (
                        <m.div
                            key={t.title}
                            initial={{ opacity: 0, y: 8 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: i * 0.03 }}
                            className="group rounded-2xl border border-zoru-line bg-white p-5 transition hover:-translate-y-1 hover:border-zoru-line hover:shadow-[0_24px_60px_-30px_rgba(0,0,0,0.18)]"
                        >
                            <div className="flex items-center justify-between">
                                <div className={`grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br ${t.accent} shadow-md`}>
                                    <Sparkles className="h-4 w-4 text-white" />
                                </div>
                                {t.badge && (
                                    <span className="rounded-full bg-zoru-surface-2 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-zoru-ink">
                                        {t.badge}
                                    </span>
                                )}
                            </div>
                            <h3 className="mt-4 text-lg font-semibold tracking-tight text-zoru-ink">{t.title}</h3>
                            <p className="mt-1 text-[13px] leading-relaxed text-zoru-ink">{t.blurb}</p>
                            <div className="mt-4 flex items-center justify-between">
                                <span className="rounded-full bg-zoru-surface-2 px-2 py-0.5 text-[11px] font-semibold text-zoru-ink">{t.cat}</span>
                                <span className="text-[11px] text-zoru-ink">~{t.minutes} min to clone</span>
                            </div>
                            <button className="mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-full bg-zoru-ink px-3 py-1.5 text-[12px] font-semibold text-white transition hover:bg-zoru-ink">
                                Clone template <ArrowUpRight className="h-3 w-3" />
                            </button>
                        </m.div>
                    ))}
                </div>
            </SectionWrap>
        </MarketingShell>
    );
}
