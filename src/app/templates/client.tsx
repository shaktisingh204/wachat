'use client';

import { useMemo, useState } from 'react';
import { ArrowUpRight, Search, Sparkles } from 'lucide-react';
import { MarketingShell, PageHero, SectionWrap } from '@/components/landing-v2/marketing-shell';
import {
    Badge,
    Button,
    Card,
    Input,
    SegmentedControl,
    type SegmentedItem,
} from '@/components/sabcrm/20ui';

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
    { title: 'Abandoned cart to WA + 10% off', cat: 'Campaigns', blurb: 'Trigger 1h after cart abandon, send template, expire code in 24h.', minutes: 6, accent: 'from-amber-400 to-orange-500', badge: 'Popular' },
    { title: 'Welcome sequence (3-step drip)', cat: 'Campaigns', blurb: 'New signup, welcome WA, email guide, product tour invite.', minutes: 5, accent: 'from-rose-400 to-pink-500' },
    { title: 'Daily revenue to Slack', cat: 'Dashboards', blurb: "Post yesterday's revenue, top product, refund count at 9 AM IST.", minutes: 3, accent: 'from-sky-400 to-indigo-500' },
    { title: 'Lead enrichment + assign', cat: 'Sales', blurb: 'New form, enrich via Clearbit, round-robin to sales agent.', minutes: 8, accent: 'from-violet-400 to-fuchsia-500' },
    { title: 'Quote to e-sign to invoice', cat: 'Sales', blurb: 'Approve deal, generate quote, SabSign, auto-invoice on accept.', minutes: 12, accent: 'from-indigo-400 to-violet-500' },
    { title: 'Ticket SLA breach paging', cat: 'Support', blurb: 'Watch first-reply timer. On breach: page on-call via Slack + WA.', minutes: 4, accent: 'from-rose-400 to-red-500', badge: 'New' },
    { title: 'CSAT survey + tagging', cat: 'Support', blurb: 'Closed ticket, WA survey, tag negative replies, escalate.', minutes: 5, accent: 'from-amber-400 to-rose-500' },
    { title: 'Inventory low-stock alert', cat: 'Automation', blurb: 'Stock drops below threshold, notify warehouse manager + raise PO.', minutes: 4, accent: 'from-cyan-400 to-blue-500' },
    { title: 'Payment captured to ship', cat: 'Automation', blurb: 'Razorpay webhook, mark deal won, request courier label.', minutes: 6, accent: 'from-emerald-400 to-teal-500', badge: 'Popular' },
    { title: 'Sales weekly snapshot', cat: 'Dashboards', blurb: 'Pipeline + deals closed + reps leaderboard, mailed every Mon.', minutes: 4, accent: 'from-sky-400 to-cyan-500' },
    { title: 'Support volume by channel', cat: 'Dashboards', blurb: 'Live ticket count split by WA / email / web / IG.', minutes: 3, accent: 'from-violet-400 to-purple-500' },
    { title: 'Employee onboarding kit', cat: 'Onboarding', blurb: 'New hire, docs sent, trainings scheduled, buddy paired.', minutes: 9, accent: 'from-cyan-400 to-blue-500' },
    { title: 'Customer onboarding flow', cat: 'Onboarding', blurb: 'Welcome, setup checklist, kickoff call, 30-day check-in.', minutes: 7, accent: 'from-amber-400 to-yellow-500' },
    { title: 'Refund + RTO triage', cat: 'Support', blurb: 'Refund request, fraud-check, manager approval, action.', minutes: 8, accent: 'from-orange-400 to-rose-500' },
    { title: 'Birthday + anniversary loyalty', cat: 'Campaigns', blurb: 'Auto-send loyalty discount on customer special dates.', minutes: 4, accent: 'from-pink-400 to-rose-500' },
];

export function TemplatesClient({ session }: { session?: { user?: unknown } | null }) {
    const [tab, setTab] = useState('All');
    const [q, setQ] = useState('');

    const tabItems = useMemo<SegmentedItem[]>(
        () =>
            CATEGORIES.map((c) => {
                const count = c === 'All' ? TEMPLATES.length : TEMPLATES.filter((t) => t.cat === c).length;
                return {
                    value: c,
                    label: (
                        <span className="inline-flex items-center gap-1.5">
                            {c}
                            <span className="text-[10px] text-[var(--st-text-tertiary)]">{count}</span>
                        </span>
                    ),
                };
            }),
        [],
    );

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
                kicker="Templates, clone in one click"
                title={<>Start from working examples, <span className="bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 bg-clip-text text-transparent">not a blank page.</span></>}
                subtitle="Battle-tested flows, dashboards, and campaigns made by our team and customers. Clone, tweak, ship."
                extra={
                    <div className="mx-auto w-full max-w-md">
                        <Input
                            value={q}
                            onChange={(e) => setQ(e.target.value)}
                            placeholder="Search templates..."
                            aria-label="Search templates"
                            iconLeft={Search}
                        />
                    </div>
                }
            />

            <SectionWrap>
                <div className="flex justify-center">
                    <SegmentedControl
                        items={tabItems}
                        value={tab}
                        onChange={setTab}
                        aria-label="Filter templates by category"
                    />
                </div>

                <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {visible.map((t) => (
                        <Card key={t.title} variant="interactive" padding="md" className="flex flex-col">
                            <div className="flex items-center justify-between">
                                <div className={`grid h-10 w-10 place-items-center rounded-[var(--st-radius)] bg-gradient-to-br ${t.accent} shadow-md`}>
                                    <Sparkles className="h-4 w-4 text-white" aria-hidden="true" />
                                </div>
                                {t.badge && (
                                    <Badge tone="warning" kind="soft">
                                        {t.badge}
                                    </Badge>
                                )}
                            </div>
                            <h3 className="mt-4 text-lg font-semibold tracking-tight text-[var(--st-text)]">{t.title}</h3>
                            <p className="mt-1 text-[13px] leading-relaxed text-[var(--st-text-secondary)]">{t.blurb}</p>
                            <div className="mt-4 flex items-center justify-between">
                                <Badge tone="neutral" kind="soft">{t.cat}</Badge>
                                <span className="text-[11px] text-[var(--st-text-tertiary)]">~{t.minutes} min to clone</span>
                            </div>
                            <Button className="mt-4" variant="primary" block iconRight={ArrowUpRight}>
                                Clone template
                            </Button>
                        </Card>
                    ))}
                </div>
            </SectionWrap>
        </MarketingShell>
    );
}
