'use client';

import { m } from 'motion/react';
import { useState } from 'react';
import {
    Activity,
    ArrowRight,
    Bell,
    Bot,
    Calendar,
    CheckCircle2,
    Clock,
    Database,
    FileSpreadsheet,
    Filter,
    GitCommit,
    Globe,
    Inbox,
    Instagram,
    Layers,
    Mail,
    MapPin,
    MessageCircle,
    MessageSquare,
    Mic,
    Package,
    PenTool,
    Phone,
    Play,
    PlayCircle,
    Receipt,
    Send,
    Sparkles,
    Tag,
    Target,
    TrendingUp,
    User,
    Users,
    Video,
    Wallet,
    Wrench,
    Zap,
    type LucideIcon,
} from 'lucide-react';
import type { ModuleDef } from './modules-data';

interface SectionProps {
    mod: ModuleDef;
}

// ──────────── CONVERSATION — Channel matrix + unified inbox ────────────
export function ConversationBespoke({ mod }: SectionProps) {
    const channels = [
        { name: 'WhatsApp', icon: MessageSquare, color: 'bg-zoru-ink', count: 1284, last: 'Asha · 1m ago' },
        { name: 'Instagram', icon: Instagram, color: 'bg-zoru-ink', count: 412, last: 'Rohan · 4m ago' },
        { name: 'Email', icon: Mail, color: 'bg-zoru-ink', count: 938, last: 'priya@acme · 6m' },
        { name: 'Telegram', icon: Send, color: 'bg-zoru-ink', count: 218, last: 'Karan · 12m' },
        { name: 'SMS', icon: Phone, color: 'bg-zoru-ink', count: 1822, last: 'OTP queue' },
        { name: 'Voice', icon: Mic, color: 'bg-zoru-ink', count: 84, last: 'IVR · live' },
        { name: 'Web chat', icon: MessageCircle, color: 'bg-zoru-ink', count: 309, last: 'Guest · now' },
        { name: 'Facebook', icon: MessageSquare, color: 'bg-zoru-ink', count: 156, last: 'Page · 22m' },
    ];
    return (
        <Section mod={mod} kicker="Every channel, one queue" title={`${mod.name} unifies 8 channels into one workstream.`}>
            <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1.1fr_1fr]">
                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4">
                    {channels.map((c, i) => {
                        const CIcon = c.icon;
                        return (
                            <m.div
                                key={c.name}
                                initial={{ opacity: 0, scale: 0.94 }}
                                whileInView={{ opacity: 1, scale: 1 }}
                                viewport={{ once: true }}
                                transition={{ delay: i * 0.04 }}
                                className="rounded-2xl border border-zoru-line bg-white p-3 transition hover:-translate-y-0.5 hover:border-zoru-line"
                            >
                                <div className={`grid h-9 w-9 place-items-center rounded-lg text-white ${c.color}`}>
                                    <CIcon className="h-4 w-4" />
                                </div>
                                <p className="mt-3 text-sm font-semibold text-zoru-ink">{c.name}</p>
                                <p className="text-[11px] text-zoru-ink">{c.count.toLocaleString()} open</p>
                                <p className="mt-1 truncate text-[10px] text-zoru-ink-muted">{c.last}</p>
                            </m.div>
                        );
                    })}
                </div>
                <m.div
                    initial={{ opacity: 0, x: 8 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    className="relative overflow-hidden rounded-2xl border bg-white p-5 shadow-lg"
                    style={{ borderColor: `${mod.accentDeep}33` }}
                >
                    <div className="flex items-center gap-2 border-b border-zoru-line pb-3">
                        <Inbox className="h-4 w-4" style={{ color: mod.accentDeep }} />
                        <span className="text-sm font-semibold text-zoru-ink">Unified inbox</span>
                        <span className="ml-auto text-[11px] text-zoru-ink">5,233 active</span>
                    </div>
                    <div className="mt-3 space-y-2">
                        {[
                            { who: 'Priya · WhatsApp', msg: 'Can you ship today?', time: 'just now', ch: 'bg-zoru-ink' },
                            { who: 'Karan · Instagram', msg: 'Bulk price for 50?', time: '4m', ch: 'bg-zoru-ink' },
                            { who: 'guest@acme.com', msg: 'Need invoice resent', time: '6m', ch: 'bg-zoru-ink' },
                            { who: 'Rohan · Web chat', msg: 'Where is my order?', time: '12m', ch: 'bg-zoru-ink' },
                        ].map((row, i) => (
                            <m.div
                                key={i}
                                initial={{ opacity: 0, x: -6 }}
                                whileInView={{ opacity: 1, x: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: 0.1 + i * 0.06 }}
                                className="flex items-center gap-2 rounded-lg border border-zoru-line px-3 py-2"
                            >
                                <span className={`h-2 w-2 rounded-full ${row.ch}`} />
                                <div className="min-w-0 flex-1">
                                    <p className="text-[12px] font-semibold text-zoru-ink">{row.who}</p>
                                    <p className="truncate text-[11px] text-zoru-ink">{row.msg}</p>
                                </div>
                                <span className="text-[10px] text-zoru-ink-muted">{row.time}</span>
                            </m.div>
                        ))}
                    </div>
                </m.div>
            </div>
        </Section>
    );
}

// ──────────── MARKETING — Segment builder ────────────
export function MarketingBespoke({ mod }: SectionProps) {
    const rules = [
        { field: 'Country', op: 'is', val: 'India' },
        { field: 'Spend (last 90d)', op: '>', val: '₹5,000' },
        { field: 'Channel', op: 'in', val: 'WhatsApp · Email' },
        { field: 'Tag', op: 'has', val: 'high-intent' },
    ];
    return (
        <Section mod={mod} kicker="Segment, ship, measure" title="Build any audience visually. The numbers update as you type.">
            <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1.1fr_1fr]">
                <m.div
                    initial={{ opacity: 0, y: 10 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="rounded-2xl border border-zoru-line bg-white p-5"
                >
                    <div className="flex items-center gap-2 border-b border-zoru-line pb-3">
                        <Filter className="h-4 w-4" style={{ color: mod.accentDeep }} />
                        <span className="text-sm font-semibold text-zoru-ink">Audience · &quot;Diwali repeaters&quot;</span>
                        <span className="ml-auto rounded-full bg-zoru-surface-2 px-2 py-0.5 text-[10px] font-semibold text-zoru-ink">
                            Live · 12,840
                        </span>
                    </div>
                    <div className="mt-4 space-y-2">
                        {rules.map((r, i) => (
                            <m.div
                                key={r.field}
                                initial={{ opacity: 0, x: -6 }}
                                whileInView={{ opacity: 1, x: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: i * 0.05 }}
                                className="flex items-center gap-2 rounded-xl border border-zoru-line bg-zoru-surface-2/60 px-3 py-2"
                            >
                                <span className="rounded-md bg-white px-2 py-1 text-[11px] font-semibold text-zoru-ink">
                                    {r.field}
                                </span>
                                <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: mod.accentDeep }}>
                                    {r.op}
                                </span>
                                <span className="rounded-md bg-white px-2 py-1 text-[11px] font-semibold text-zoru-ink">
                                    {r.val}
                                </span>
                                {i < rules.length - 1 && (
                                    <span className="ml-auto text-[10px] font-semibold uppercase tracking-wider text-zoru-ink-muted">
                                        AND
                                    </span>
                                )}
                            </m.div>
                        ))}
                    </div>
                    <div className="mt-4 flex items-center justify-between rounded-xl bg-zoru-ink px-4 py-3">
                        <span className="text-[11px] uppercase tracking-wider text-white/60">Estimated reach</span>
                        <span className="text-lg font-semibold text-white">12,840 people</span>
                    </div>
                </m.div>

                <ul className="space-y-3">
                    {[
                        { t: 'Live counts as you build', d: 'Edit a rule, watch the number move in real time.' },
                        { t: 'Save, fork, share', d: 'Each segment is versioned. Teammates can fork without breaking yours.' },
                        { t: 'Multi-channel send', d: 'One segment → WhatsApp + email + SMS, with channel-specific copy.' },
                        { t: 'Holdout + lift', d: 'Automatic control group, stat-sig uplift, exportable.' },
                    ].map((p, i) => (
                        <m.li
                            key={p.t}
                            initial={{ opacity: 0, x: 8 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: i * 0.06 }}
                            className="flex items-start gap-3 rounded-xl border border-zoru-line bg-white p-4"
                        >
                            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" style={{ color: mod.accentDeep }} />
                            <div>
                                <p className="text-base font-semibold text-zoru-ink">{p.t}</p>
                                <p className="mt-1 text-[13px] text-zoru-ink">{p.d}</p>
                            </div>
                        </m.li>
                    ))}
                </ul>
            </div>
        </Section>
    );
}

// ──────────── SALES & COMMERCE — Order lifecycle timeline ────────────
export function CommerceBespoke({ mod }: SectionProps) {
    const steps = [
        { time: '10:24 AM', label: 'Order placed', desc: 'Asha · #ORD-4821 · ₹4,299 · UPI', icon: Package, done: true },
        { time: '10:25 AM', label: 'Auto-invoice', desc: 'GST invoice signed and mailed', icon: Receipt, done: true },
        { time: '10:32 AM', label: 'Inventory hold', desc: 'Reserved at WH-Mumbai-2', icon: Database, done: true },
        { time: '11:14 AM', label: 'Courier picked', desc: 'Delhivery · waybill 7782214', icon: Send, done: true },
        { time: 'ETA Wed', label: 'Delivery', desc: 'Customer notified via WA + SMS', icon: MapPin, done: false },
    ];
    return (
        <Section mod={mod} kicker="One customer, one trail" title="Every order leaves a complete, signed lineage.">
            <div className="relative">
                <div
                    aria-hidden
                    className="absolute left-6 top-2 bottom-2 w-px md:left-1/2"
                    style={{ background: `${mod.accentDeep}22` }}
                />
                <ul className="space-y-6">
                    {steps.map((s, i) => {
                        const SIcon = s.icon;
                        const isRight = i % 2 === 0;
                        return (
                            <m.li
                                key={s.label}
                                initial={{ opacity: 0, y: 10 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: i * 0.06 }}
                                className={`relative grid items-start gap-4 md:grid-cols-2 ${isRight ? '' : ''}`}
                            >
                                <div className={`${isRight ? 'md:order-1' : 'md:order-2 md:text-right'}`}>
                                    <div
                                        className={`relative rounded-2xl border bg-white p-4 ${isRight ? 'md:mr-6' : 'md:ml-6'}`}
                                        style={{ borderColor: `${mod.accentDeep}25` }}
                                    >
                                        <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: mod.accentDeep }}>
                                            {s.time}
                                        </span>
                                        <p className="mt-1 text-base font-semibold text-zoru-ink">{s.label}</p>
                                        <p className="mt-1 text-[13px] text-zoru-ink">{s.desc}</p>
                                    </div>
                                </div>
                                <div className={`absolute left-3 top-3 md:left-1/2 md:-translate-x-1/2 ${isRight ? '' : ''}`}>
                                    <div
                                        className={`grid h-10 w-10 place-items-center rounded-full border-4 border-zoru-line shadow-md ${
                                            s.done
                                                ? `bg-gradient-to-br ${mod.accentFrom} ${mod.accentTo} text-white`
                                                : 'bg-white text-zoru-ink-muted'
                                        }`}
                                    >
                                        <SIcon className="h-4 w-4" />
                                    </div>
                                </div>
                                <div className={`${isRight ? 'md:order-2' : 'md:order-1'} hidden md:block`} />
                            </m.li>
                        );
                    })}
                </ul>
            </div>
        </Section>
    );
}

// ──────────── CUSTOMER SUCCESS — Escalation flow ────────────
export function SuccessBespoke({ mod }: SectionProps) {
    const levels = [
        { who: 'L1 · AI bot', wait: '0s', desc: 'Resolves FAQ + auto-close', icon: Bot },
        { who: 'L2 · Agent', wait: '< 30s', desc: 'Real human picks up', icon: User },
        { who: 'L3 · Supervisor', wait: 'On breach', desc: 'Auto-paged on SLA risk', icon: Bell },
        { who: 'L4 · Engineering', wait: 'P1 only', desc: 'PagerDuty + Slack ping', icon: Wrench },
    ];
    return (
        <Section mod={mod} kicker="Escalations that don't get lost" title="Every ticket has a clear next step — automatically.">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                {levels.map((l, i) => {
                    const LIcon = l.icon;
                    return (
                        <m.div
                            key={l.who}
                            initial={{ opacity: 0, y: 10 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: i * 0.06 }}
                            className="relative rounded-2xl border border-zoru-line bg-white p-5"
                        >
                            <div className={`grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br ${mod.accentFrom} ${mod.accentTo} shadow-md`}>
                                <LIcon className="h-5 w-5 text-white" />
                            </div>
                            <p className="mt-4 text-lg font-semibold text-zoru-ink">{l.who}</p>
                            <p className="mt-1 text-[12px] font-semibold uppercase tracking-wider" style={{ color: mod.accentDeep }}>
                                {l.wait}
                            </p>
                            <p className="mt-2 text-[13px] text-zoru-ink">{l.desc}</p>
                            {i < levels.length - 1 && (
                                <ArrowRight className="absolute -right-3 top-1/2 hidden h-5 w-5 -translate-y-1/2 rounded-full bg-zoru-surface p-1 text-zoru-ink-muted md:block" />
                            )}
                        </m.div>
                    );
                })}
            </div>
            <m.div
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="mt-8 rounded-2xl border border-zoru-line bg-white p-6"
            >
                <div className="grid items-center gap-6 md:grid-cols-3">
                    {[
                        { k: 'First reply', v: '< 30s', sub: 'p95 across plans' },
                        { k: 'Auto-resolved', v: '46%', sub: 'by AI tier-1' },
                        { k: 'SLA breach', v: '0.4%', sub: 'last 90 days' },
                    ].map((s) => (
                        <div key={s.k}>
                            <p className="text-3xl font-semibold text-zoru-ink">{s.v}</p>
                            <p className="mt-1 text-[11px] font-semibold uppercase tracking-wider" style={{ color: mod.accentDeep }}>
                                {s.k}
                            </p>
                            <p className="text-[12px] text-zoru-ink">{s.sub}</p>
                        </div>
                    ))}
                </div>
            </m.div>
        </Section>
    );
}

// ──────────── PEOPLE & OPS — Payroll calculator ────────────
export function PeopleBespoke({ mod }: SectionProps) {
    const lines = [
        { label: 'Basic', value: 35000 },
        { label: 'HRA', value: 14000 },
        { label: 'Special allowance', value: 11000 },
        { label: 'PF (12%)', value: -4200, neg: true },
        { label: 'PT', value: -200, neg: true },
        { label: 'TDS', value: -3500, neg: true },
    ];
    const total = lines.reduce((a, b) => a + b.value, 0);
    return (
        <Section mod={mod} kicker="Payroll in one click" title="CTC → in-hand. Compliant. Signed.">
            <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1.1fr_1fr]">
                <m.div
                    initial={{ opacity: 0, y: 10 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="rounded-2xl border border-zoru-line bg-white p-6"
                >
                    <div className="flex items-center gap-2 border-b border-zoru-line pb-3">
                        <Wallet className="h-4 w-4" style={{ color: mod.accentDeep }} />
                        <span className="text-sm font-semibold text-zoru-ink">Payslip · Asha · May 2026</span>
                        <span className="ml-auto rounded-full bg-zoru-surface-2 px-2 py-0.5 text-[10px] font-semibold text-zoru-ink">
                            Signed
                        </span>
                    </div>
                    <ul className="mt-3 divide-y divide-zoru-line">
                        {lines.map((l, i) => (
                            <m.li
                                key={l.label}
                                initial={{ opacity: 0, x: -4 }}
                                whileInView={{ opacity: 1, x: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: i * 0.04 }}
                                className="flex items-center justify-between py-2.5"
                            >
                                <span className="text-[13px] text-zoru-ink">{l.label}</span>
                                <span className={`text-[13px] font-semibold ${l.neg ? 'text-zoru-ink' : 'text-zoru-ink'}`}>
                                    {l.neg ? '−' : ''}₹{Math.abs(l.value).toLocaleString('en-IN')}
                                </span>
                            </m.li>
                        ))}
                    </ul>
                    <div className="mt-4 flex items-center justify-between rounded-xl bg-zoru-ink px-4 py-3">
                        <span className="text-[11px] uppercase tracking-wider text-white/60">Net in-hand</span>
                        <span className="text-xl font-semibold text-white">
                            ₹{total.toLocaleString('en-IN')}
                        </span>
                    </div>
                </m.div>

                <div className="space-y-3">
                    {[
                        { t: 'PT / PF / ESI / TDS', d: 'Auto-calculated per state, signed PDFs ready to file.' },
                        { t: 'Bank file', d: 'Generate the disbursement file your bank actually accepts.' },
                        { t: 'Loans + advances', d: 'EMI deductions, balance projection, recovery on exit.' },
                        { t: 'Audit', d: 'Every payroll run is hash-signed and replayable.' },
                    ].map((p, i) => (
                        <m.div
                            key={p.t}
                            initial={{ opacity: 0, x: 8 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: i * 0.05 }}
                            className="rounded-2xl border border-zoru-line bg-white p-4"
                        >
                            <p className="text-base font-semibold text-zoru-ink">{p.t}</p>
                            <p className="mt-1 text-[13px] text-zoru-ink">{p.d}</p>
                        </m.div>
                    ))}
                </div>
            </div>
        </Section>
    );
}

// ──────────── PRODUCTIVITY — Agenda planner ────────────
export function ProductivityBespoke({ mod }: SectionProps) {
    const blocks = [
        { time: '10:00', dur: '15m', title: 'Stand-up', tag: 'Sync', tone: 'sky' },
        { time: '10:15', dur: '30m', title: 'Design review', tag: 'Review', tone: 'violet' },
        { time: '10:45', dur: '45m', title: 'Customer call · Acme', tag: 'External', tone: 'emerald' },
        { time: '11:30', dur: '20m', title: 'Roadmap quick-fire', tag: 'Decision', tone: 'amber' },
    ];
    const toneBg: Record<string, string> = {
        sky: 'border-zoru-line bg-zoru-surface-2',
        violet: 'border-zoru-line bg-zoru-surface-2',
        emerald: 'border-zoru-line bg-zoru-surface-2',
        amber: 'border-zoru-line bg-zoru-surface-2',
    };
    return (
        <Section mod={mod} kicker="Meetings that ship outcomes" title="Every session has an agenda, a timer, and an artifact.">
            <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1fr_1.1fr]">
                <m.div
                    initial={{ opacity: 0, y: 10 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="space-y-2"
                >
                    {blocks.map((b, i) => (
                        <m.div
                            key={b.title}
                            initial={{ opacity: 0, x: -8 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: i * 0.05 }}
                            className={`flex items-center gap-4 rounded-2xl border p-3 ${toneBg[b.tone]}`}
                        >
                            <div className="w-12 text-right">
                                <p className="text-[13px] font-semibold text-zoru-ink">{b.time}</p>
                                <p className="text-[10px] uppercase tracking-wider text-zoru-ink">{b.dur}</p>
                            </div>
                            <div className="h-8 w-px bg-zoru-surface-2/60" />
                            <div className="flex-1">
                                <p className="text-[14px] font-semibold text-zoru-ink">{b.title}</p>
                                <p className="text-[11px] text-zoru-ink">{b.tag}</p>
                            </div>
                            <Play className="h-4 w-4" style={{ color: mod.accentDeep }} />
                        </m.div>
                    ))}
                </m.div>

                <m.div
                    initial={{ opacity: 0, y: 10 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.1 }}
                    className="rounded-2xl border border-zoru-line bg-white p-5"
                >
                    <div className="flex items-center gap-2 border-b border-zoru-line pb-3">
                        <Video className="h-4 w-4" style={{ color: mod.accentDeep }} />
                        <span className="text-sm font-semibold text-zoru-ink">Live · Stand-up</span>
                        <span className="ml-auto text-[11px] text-zoru-ink">
                            <Clock className="mr-1 inline h-3 w-3" /> 04:22 / 15:00
                        </span>
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-1.5">
                        {['A', 'R', 'P', 'K', 'M', 'V'].map((p, i) => (
                            <m.div
                                key={p}
                                initial={{ opacity: 0, scale: 0.9 }}
                                whileInView={{ opacity: 1, scale: 1 }}
                                viewport={{ once: true }}
                                transition={{ delay: i * 0.04 }}
                                className={`relative aspect-video overflow-hidden rounded-lg bg-gradient-to-br ${mod.accentFrom} ${mod.accentTo}`}
                            >
                                <span className="absolute bottom-1 left-1.5 rounded bg-black/40 px-1 text-[9px] font-semibold text-white">
                                    {p}
                                </span>
                            </m.div>
                        ))}
                    </div>
                    <ul className="mt-3 space-y-1">
                        <li className="flex items-center gap-2 text-[12px] text-zoru-ink">
                            <CheckCircle2 className="h-3.5 w-3.5 text-zoru-ink" /> Shipped: roadmap v2
                        </li>
                        <li className="flex items-center gap-2 text-[12px] text-zoru-ink">
                            <CheckCircle2 className="h-3.5 w-3.5 text-zoru-ink" /> Decided: drop Q3 stretch
                        </li>
                        <li className="flex items-center gap-2 text-[12px] text-zoru-ink">
                            <Clock className="h-3.5 w-3.5" /> Open: review wiremocks
                        </li>
                    </ul>
                </m.div>
            </div>
        </Section>
    );
}

// ──────────── ENGINEERING — Live log stream ────────────
export function EngineeringBespoke({ mod }: SectionProps) {
    const lines = [
        { t: '12:18:42.014', lvl: 'INFO', msg: 'flow:order-completed · trigger received', tone: 'text-zoru-ink' },
        { t: '12:18:42.018', lvl: 'INFO', msg: '→ webhook validated · signature ok', tone: 'text-zoru-ink' },
        { t: '12:18:42.024', lvl: 'INFO', msg: '→ filter passed · total ≥ ₹1,000', tone: 'text-zoru-ink' },
        { t: '12:18:42.041', lvl: 'AI', msg: '→ agent.next-best-action · "send loyalty offer"', tone: 'text-zoru-ink' },
        { t: '12:18:42.073', lvl: 'INFO', msg: '→ postgres.insert ok · row 819214', tone: 'text-zoru-ink' },
        { t: '12:18:42.092', lvl: 'WARN', msg: '→ rate-limit · throttled to 4 rps', tone: 'text-zoru-ink' },
        { t: '12:18:42.118', lvl: 'INFO', msg: '→ email.send ok · msgId 7e1c', tone: 'text-zoru-ink' },
        { t: '12:18:42.121', lvl: 'OK', msg: 'flow completed in 107ms', tone: 'text-zoru-ink' },
    ];
    return (
        <Section mod={mod} kicker="Observability built in" title="Every run is replayable. Every span has a story.">
            <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1.2fr_1fr]">
                <m.div
                    initial={{ opacity: 0, y: 10 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="overflow-hidden rounded-2xl border border-zoru-line bg-zoru-ink font-mono"
                >
                    <div className="flex items-center gap-2 border-b border-white/10 px-4 py-2 text-[11px] text-white/60">
                        <span className="h-2.5 w-2.5 rounded-full bg-zoru-ink" />
                        <span className="h-2.5 w-2.5 rounded-full bg-zoru-ink" />
                        <span className="h-2.5 w-2.5 rounded-full bg-zoru-ink" />
                        <span className="ml-3">logs · flow:order-completed · live</span>
                    </div>
                    <div className="p-4 text-[11.5px] leading-relaxed">
                        {lines.map((l, i) => (
                            <m.div
                                key={i}
                                initial={{ opacity: 0, x: -6 }}
                                whileInView={{ opacity: 1, x: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: i * 0.05 }}
                                className="flex gap-3"
                            >
                                <span className="text-white/40">{l.t}</span>
                                <span
                                    className={`rounded px-1.5 text-[10px] font-bold ${
                                        l.lvl === 'WARN'
                                            ? 'bg-zoru-ink/20 text-zoru-ink-muted'
                                            : l.lvl === 'OK'
                                              ? 'bg-zoru-ink/20 text-zoru-ink-muted'
                                              : l.lvl === 'AI'
                                                ? 'bg-zoru-ink/20 text-zoru-ink-muted'
                                                : 'bg-white/10 text-white/70'
                                    }`}
                                >
                                    {l.lvl}
                                </span>
                                <span className={`flex-1 text-white/90 ${l.tone.replace('text-', '!text-')}`}>{l.msg}</span>
                            </m.div>
                        ))}
                    </div>
                </m.div>

                <div className="space-y-3">
                    {[
                        { icon: GitCommit, t: 'Versioned runs', d: 'Every execution is a commit. Diff and revert.' },
                        { icon: Zap, t: 'Time-travel debug', d: 'Pin any run. Replay it on new data instantly.' },
                        { icon: Activity, t: 'p95 latencies', d: 'See where the slow span lives, not just averages.' },
                        { icon: Bell, t: 'Alerts that route', d: 'Page the on-call. Silence the noisy. Mute the known.' },
                    ].map((p, i) => {
                        const PIcon = p.icon;
                        return (
                            <m.div
                                key={p.t}
                                initial={{ opacity: 0, x: 8 }}
                                whileInView={{ opacity: 1, x: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: i * 0.05 }}
                                className="flex items-start gap-3 rounded-2xl border border-zoru-line bg-white p-4"
                            >
                                <PIcon className="mt-0.5 h-5 w-5 shrink-0" style={{ color: mod.accentDeep }} />
                                <div>
                                    <p className="text-base font-semibold text-zoru-ink">{p.t}</p>
                                    <p className="mt-1 text-[13px] text-zoru-ink">{p.d}</p>
                                </div>
                            </m.div>
                        );
                    })}
                </div>
            </div>
        </Section>
    );
}

// ──────────── ANALYTICS & AI — Dashboard builder ────────────
export function AnalyticsBespoke({ mod }: SectionProps) {
    const tiles = [
        { title: 'Revenue · today', value: '₹1.84L', delta: '+18%', wide: false },
        { title: 'Conversion', value: '4.8%', delta: '+0.4pt', wide: false },
        { title: 'Active users', value: '12,948', delta: '+322', wide: true },
        { title: 'Tickets · breach', value: '0.4%', delta: '−0.1pt', wide: false },
        { title: 'Payroll · run', value: 'May closed', delta: 'on time', wide: false },
        { title: 'Top channel', value: 'WhatsApp', delta: '64% share', wide: true },
    ];
    return (
        <Section mod={mod} kicker="Dashboards in 30 seconds" title="Drag a tile. Wire a query. Share with the team.">
            <m.div
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="rounded-3xl border border-zoru-line bg-white p-6"
            >
                <div className="flex flex-wrap items-center gap-3 border-b border-zoru-line pb-4">
                    <FileSpreadsheet className="h-4 w-4" style={{ color: mod.accentDeep }} />
                    <span className="text-sm font-semibold text-zoru-ink">Dashboard · Ops · Today</span>
                    <span className="ml-auto flex items-center gap-1 text-[11px] text-zoru-ink">
                        <span className="h-2 w-2 animate-pulse rounded-full bg-zoru-ink" /> Live
                    </span>
                </div>
                <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
                    {tiles.map((t, i) => (
                        <m.div
                            key={t.title}
                            initial={{ opacity: 0, scale: 0.94 }}
                            whileInView={{ opacity: 1, scale: 1 }}
                            viewport={{ once: true }}
                            transition={{ delay: i * 0.04 }}
                            className={`rounded-2xl border border-zoru-line bg-zoru-surface-2/50 p-4 ${t.wide ? 'md:col-span-2' : ''}`}
                        >
                            <p className="text-[11px] uppercase tracking-wider text-zoru-ink">{t.title}</p>
                            <p className="mt-2 text-2xl font-semibold text-zoru-ink">{t.value}</p>
                            <p className="mt-1 text-[12px] font-semibold" style={{ color: mod.accentDeep }}>
                                {t.delta}
                            </p>
                        </m.div>
                    ))}
                </div>
            </m.div>
            <p className="mt-6 max-w-3xl text-[15px] text-zoru-ink">
                Every dashboard tile is composable from any module — revenue from Commerce, replies from
                SabChat, payroll from HRM. No more screenshot decks.
            </p>
        </Section>
    );
}

// ──────────── FILES & DOCUMENTS — Version timeline ────────────
export function FilesBespoke({ mod }: SectionProps) {
    const versions = [
        { v: 'v8', who: 'Asha', when: 'just now', note: 'Updated logo lockup' },
        { v: 'v7', who: 'Rohan', when: '14m ago', note: 'Renamed sections' },
        { v: 'v6', who: 'Priya', when: '1h ago', note: 'Brand colors refreshed' },
        { v: 'v5', who: 'Karan', when: 'Yesterday', note: 'Initial draft signed' },
    ];
    return (
        <Section mod={mod} kicker="Nothing is ever lost" title="Every file is versioned. Every change is reversible.">
            <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1fr_1.1fr]">
                <m.div
                    initial={{ opacity: 0, y: 10 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="rounded-2xl border border-zoru-line bg-white p-5"
                >
                    <div className="flex items-center gap-2 border-b border-zoru-line pb-3">
                        <PenTool className="h-4 w-4" style={{ color: mod.accentDeep }} />
                        <span className="text-sm font-semibold text-zoru-ink">brand-kit / Logo.sketch</span>
                        <span className="ml-auto text-[11px] text-zoru-ink">8 versions</span>
                    </div>
                    <ul className="mt-3 space-y-2">
                        {versions.map((v, i) => (
                            <m.li
                                key={v.v}
                                initial={{ opacity: 0, x: -6 }}
                                whileInView={{ opacity: 1, x: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: i * 0.05 }}
                                className={`flex items-center gap-3 rounded-xl border px-3 py-2 ${
                                    i === 0 ? 'border-zoru-line bg-zoru-surface-2' : 'border-zoru-line'
                                }`}
                            >
                                <span
                                    className="rounded-md px-2 py-0.5 text-[10px] font-bold text-white"
                                    style={{ background: mod.accentDeep }}
                                >
                                    {v.v}
                                </span>
                                <div className="min-w-0 flex-1">
                                    <p className="text-[12px] font-semibold text-zoru-ink">{v.who}</p>
                                    <p className="truncate text-[11px] text-zoru-ink">{v.note}</p>
                                </div>
                                <span className="text-[10px] text-zoru-ink-muted">{v.when}</span>
                            </m.li>
                        ))}
                    </ul>
                </m.div>

                <ul className="space-y-3">
                    {[
                        { t: 'Per-folder permissions', d: 'Viewer, editor, owner — applied to every child file.' },
                        { t: 'Signed share links', d: 'Passcode + expiry + watermark. See who opened what.' },
                        { t: '30-day recovery bin', d: 'Soft-delete with one-click restore.' },
                        { t: 'Audit trail', d: 'Every read, write and download is signed and timestamped.' },
                    ].map((p, i) => (
                        <m.li
                            key={p.t}
                            initial={{ opacity: 0, x: 8 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: i * 0.05 }}
                            className="rounded-2xl border border-zoru-line bg-white p-4"
                        >
                            <p className="text-base font-semibold text-zoru-ink">{p.t}</p>
                            <p className="mt-1 text-[13px] text-zoru-ink">{p.d}</p>
                        </m.li>
                    ))}
                </ul>
            </div>
        </Section>
    );
}

// ──────────── ACQUISITION — Page builder + sitemap ────────────
export function AcquisitionBespoke({ mod }: SectionProps) {
    const blocks = ['Hero', 'Features', 'Pricing', 'FAQ', 'Footer'];
    const pages = [
        { name: '/', score: 98 },
        { name: '/pricing', score: 96 },
        { name: '/blog', score: 92 },
        { name: '/contact', score: 100 },
    ];
    return (
        <Section mod={mod} kicker="Pages that rank, fast" title="A real builder. Real Lighthouse scores. Real organic.">
            <div className="grid grid-cols-1 gap-10 lg:grid-cols-2">
                <m.div
                    initial={{ opacity: 0, x: -8 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    className="rounded-2xl border border-zoru-line bg-white p-5"
                >
                    <div className="flex items-center gap-2 border-b border-zoru-line pb-3">
                        <Layers className="h-4 w-4" style={{ color: mod.accentDeep }} />
                        <span className="text-sm font-semibold text-zoru-ink">Page · /launch</span>
                        <span className="ml-auto text-[11px] text-zoru-ink">5 blocks · published</span>
                    </div>
                    <div className="mt-4 space-y-2">
                        {blocks.map((b, i) => (
                            <m.div
                                key={b}
                                initial={{ opacity: 0, y: 6 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: i * 0.04 }}
                                className="flex items-center gap-3 rounded-xl border border-zoru-line bg-zoru-surface-2/60 px-3 py-2.5"
                            >
                                <span
                                    className="grid h-7 w-7 place-items-center rounded-md text-[10px] font-bold text-white"
                                    style={{ background: mod.accentDeep }}
                                >
                                    {i + 1}
                                </span>
                                <span className="text-[13px] font-semibold text-zoru-ink">{b}</span>
                                <span className="ml-auto rounded-full bg-zoru-surface-2 px-2 py-0.5 text-[10px] font-semibold text-zoru-ink">
                                    A/B
                                </span>
                            </m.div>
                        ))}
                    </div>
                </m.div>

                <m.div
                    initial={{ opacity: 0, x: 8 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    className="rounded-2xl border border-zoru-line bg-white p-5"
                >
                    <div className="flex items-center gap-2 border-b border-zoru-line pb-3">
                        <Globe className="h-4 w-4" style={{ color: mod.accentDeep }} />
                        <span className="text-sm font-semibold text-zoru-ink">Sitemap · auto-generated</span>
                        <span className="ml-auto text-[11px] text-zoru-ink">verified</span>
                    </div>
                    <ul className="mt-3 divide-y divide-zoru-line">
                        {pages.map((p, i) => (
                            <m.li
                                key={p.name}
                                initial={{ opacity: 0 }}
                                whileInView={{ opacity: 1 }}
                                viewport={{ once: true }}
                                transition={{ delay: i * 0.04 }}
                                className="flex items-center justify-between py-2.5"
                            >
                                <span className="font-mono text-[13px] text-zoru-ink">{p.name}</span>
                                <div className="flex items-center gap-2">
                                    <span className="text-[11px] text-zoru-ink">Lighthouse</span>
                                    <span
                                        className="rounded-md px-2 py-0.5 text-[11px] font-bold text-white"
                                        style={{ background: mod.accentDeep }}
                                    >
                                        {p.score}
                                    </span>
                                </div>
                            </m.li>
                        ))}
                    </ul>
                    <div className="mt-3 flex items-center gap-2 text-[12px] text-zoru-ink">
                        <Tag className="h-3.5 w-3.5" /> Schema injected automatically · validated by GSC
                    </div>
                </m.div>
            </div>
        </Section>
    );
}

// ──────────── shared Section wrapper ────────────
function Section({
    mod,
    kicker,
    title,
    children,
}: {
    mod: ModuleDef;
    kicker: string;
    title: string;
    children: React.ReactNode;
}) {
    return (
        <section className="relative px-6 py-24">
            <div className="mx-auto max-w-7xl">
                <m.p
                    initial={{ opacity: 0, y: 6 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="text-[11px] font-semibold uppercase tracking-[0.22em]"
                    style={{ color: mod.accentDeep }}
                >
                    {kicker}
                </m.p>
                <m.h2
                    initial={{ opacity: 0, y: 8 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.05 }}
                    className="mt-3 max-w-3xl text-balance text-4xl font-semibold tracking-tight text-zoru-ink md:text-5xl"
                >
                    {title}
                </m.h2>
                <div className="mt-12">{children}</div>
            </div>
        </section>
    );
}

// ──────── DISPATCHER ────────
const map: Record<string, (p: SectionProps) => JSX.Element> = {
    Conversation: ConversationBespoke,
    Marketing: MarketingBespoke,
    'Sales & Commerce': CommerceBespoke,
    'Customer Success': SuccessBespoke,
    'People & Operations': PeopleBespoke,
    Productivity: ProductivityBespoke,
    Engineering: EngineeringBespoke,
    'Analytics & AI': AnalyticsBespoke,
    'Files & Documents': FilesBespoke,
    Acquisition: AcquisitionBespoke,
};

export function CategoryBespoke({ mod }: SectionProps) {
    const C = map[mod.category];
    return C ? <C mod={mod} /> : null;
}

// ──────── per-category background decoration ────────
export function CategoryBackdrop({ mod }: SectionProps) {
    const patterns: Record<string, string> = {
        Conversation:
            'radial-gradient(circle at 15% 15%, rgba(16,185,129,0.10), transparent 35%), radial-gradient(circle at 85% 85%, rgba(34,211,238,0.10), transparent 35%)',
        Marketing:
            'radial-gradient(circle at 90% 10%, rgba(244,63,94,0.10), transparent 35%), radial-gradient(circle at 10% 90%, rgba(251,146,60,0.10), transparent 35%)',
        'Sales & Commerce':
            'radial-gradient(circle at 50% 0%, rgba(56,189,248,0.10), transparent 40%), radial-gradient(circle at 50% 100%, rgba(99,102,241,0.10), transparent 40%)',
        'Customer Success':
            'radial-gradient(circle at 0% 50%, rgba(34,211,238,0.10), transparent 40%), radial-gradient(circle at 100% 50%, rgba(59,130,246,0.10), transparent 40%)',
        'People & Operations':
            'radial-gradient(ellipse at 30% 20%, rgba(34,211,238,0.10), transparent 45%)',
        Productivity:
            'radial-gradient(circle at 70% 30%, rgba(168,85,247,0.10), transparent 40%), radial-gradient(circle at 30% 70%, rgba(59,130,246,0.10), transparent 40%)',
        Engineering:
            'linear-gradient(180deg, rgba(168,85,247,0.05), transparent 50%)',
        'Analytics & AI':
            'radial-gradient(ellipse 70% 50% at 50% 30%, rgba(20,184,166,0.10), transparent 60%)',
        'Files & Documents':
            'radial-gradient(circle at 80% 20%, rgba(132,204,22,0.10), transparent 40%)',
        Acquisition:
            'radial-gradient(circle at 50% 0%, rgba(244,63,94,0.12), transparent 50%)',
    };
    return (
        <div
            aria-hidden
            className="pointer-events-none fixed inset-0 z-0"
            style={{ background: patterns[mod.category] ?? patterns.Conversation, opacity: 0.6 }}
        />
    );
}
