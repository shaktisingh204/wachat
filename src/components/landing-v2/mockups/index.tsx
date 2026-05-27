'use client';

import { m } from 'motion/react';
import {
    BarChart3,
    Bot,
    Calendar,
    Check,
    CheckCheck,
    Clock,
    File,
    Folder,
    GitBranch,
    Image as ImageIcon,
    Inbox,
    Lock,
    Mic,
    Phone,
    Send,
    Sparkles,
    Star,
    User,
    Video,
    Workflow,
} from 'lucide-react';
import type { ModuleDef } from '../modules-data';

interface MockupProps {
    mod: ModuleDef;
    variant?: 'sm' | 'md' | 'lg';
}

// ──────── CONVERSATION — chat bubbles ────────
export function ConversationMockup({ mod }: MockupProps) {
    return (
        <Card mod={mod} title={`${mod.name} · Live chat`} badge="3 unread">
            <div className="space-y-2">
                <Bubble who="them" text="Hey! Do you ship to Mumbai today?" t="10:24" />
                <Bubble who="us" text="Yes — pay by 6 PM, we courier the same day 🚚" t="10:25" mod={mod} />
                <Bubble who="us" text="Want me to send the payment link?" t="10:25" mod={mod} />
                <Bubble who="them" text="Yes please" t="10:26" />
                <m.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.3 }}
                    className={`ml-auto flex items-center gap-2 rounded-2xl rounded-br-sm bg-gradient-to-r ${mod.accentFrom} ${mod.accentTo} px-3 py-2 text-[12px] font-semibold text-white shadow-md`}
                    style={{ maxWidth: '80%' }}
                >
                    ₹4,299 · Pay with UPI <CheckCheck className="h-3 w-3" />
                </m.div>
            </div>
        </Card>
    );
}

function Bubble({ who, text, t, mod }: { who: 'us' | 'them'; text: string; t: string; mod?: ModuleDef }) {
    const isUs = who === 'us';
    return (
        <m.div
            initial={{ opacity: 0, y: 6 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.3 }}
            className={`flex ${isUs ? 'justify-end' : 'justify-start'}`}
        >
            <div
                className={`max-w-[80%] rounded-2xl px-3 py-2 text-[12px] leading-snug ${
                    isUs
                        ? `rounded-br-sm text-white shadow-sm bg-gradient-to-br ${mod?.accentFrom ?? 'from-zinc-700'} ${mod?.accentTo ?? 'to-zinc-900'}`
                        : 'rounded-bl-sm bg-zinc-100 text-zinc-800'
                }`}
            >
                {text}
                <div className={`mt-0.5 text-right text-[9px] ${isUs ? 'text-white/80' : 'text-zinc-500'}`}>
                    {t} {isUs && <CheckCheck className="inline h-3 w-3 ml-0.5" />}
                </div>
            </div>
        </m.div>
    );
}

// ──────── MARKETING — campaign card ────────
export function MarketingMockup({ mod }: MockupProps) {
    const metrics = [
        { label: 'Sent', value: '42,180' },
        { label: 'Opened', value: '68%' },
        { label: 'Replied', value: '12%' },
        { label: 'Revenue', value: '₹4.2L' },
    ];
    return (
        <Card mod={mod} title={`Campaign · Diwali launch`} badge="Live">
            <div className="rounded-xl border border-zinc-100 bg-zinc-50/60 p-3">
                <div className="flex items-center gap-2">
                    <Sparkles className="h-3.5 w-3.5" style={{ color: mod.accentDeep }} />
                    <span className="text-[12px] font-semibold text-zinc-900">Variant A · winning</span>
                    <span className="ml-auto rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                        +22% lift
                    </span>
                </div>
                <p className="mt-2 text-[12px] text-zinc-600">
                    “Light up your home with 40% off — only for the next 12 hours.”
                </p>
            </div>
            <div className="mt-3 grid grid-cols-4 gap-2">
                {metrics.map((m2, i) => (
                    <m.div
                        key={m2.label}
                        initial={{ opacity: 0, y: 6 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: i * 0.05 }}
                        className="rounded-lg border border-zinc-100 bg-white p-2"
                    >
                        <div className="text-sm font-semibold text-zinc-950">{m2.value}</div>
                        <div className="mt-0.5 text-[9px] uppercase tracking-wider text-zinc-500">
                            {m2.label}
                        </div>
                    </m.div>
                ))}
            </div>
            <div className="mt-3 h-8 overflow-hidden rounded-lg bg-zinc-100">
                <m.div
                    initial={{ width: 0 }}
                    whileInView={{ width: '68%' }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.8 }}
                    className={`h-full bg-gradient-to-r ${mod.accentFrom} ${mod.accentTo}`}
                />
            </div>
        </Card>
    );
}

// ──────── SALES & COMMERCE — pipeline ────────
export function CommerceMockup({ mod }: MockupProps) {
    const cols = [
        { stage: 'Lead', deals: [{ name: 'Acme', value: '₹1.2L', heat: 'cold' }, { name: 'Stark', value: '₹4L', heat: 'warm' }] },
        { stage: 'Quote', deals: [{ name: 'Globex', value: '₹6.5L', heat: 'hot' }] },
        { stage: 'Won', deals: [{ name: 'Wayne', value: '₹2.8L', heat: 'hot' }] },
    ];
    const heat: Record<string, string> = {
        cold: 'bg-sky-50 text-sky-700',
        warm: 'bg-amber-50 text-amber-700',
        hot: 'bg-rose-50 text-rose-700',
    };
    return (
        <Card mod={mod} title="Pipeline · Q3" badge="₹14.5L">
            <div className="grid grid-cols-3 gap-2">
                {cols.map((c, ci) => (
                    <div key={c.stage} className="space-y-1.5">
                        <div className="flex items-baseline justify-between">
                            <span
                                className="text-[10px] font-semibold uppercase tracking-wider"
                                style={{ color: mod.accentDeep }}
                            >
                                {c.stage}
                            </span>
                            <span className="text-[10px] text-zinc-400">{c.deals.length}</span>
                        </div>
                        {c.deals.map((d, di) => (
                            <m.div
                                key={d.name}
                                initial={{ opacity: 0, y: 6 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: ci * 0.05 + di * 0.04 }}
                                className="rounded-lg border border-zinc-200 bg-white p-2"
                            >
                                <div className="text-[11px] font-semibold text-zinc-900">{d.name}</div>
                                <div className="mt-1 flex items-center justify-between">
                                    <span className="text-[10px] text-zinc-600">{d.value}</span>
                                    <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${heat[d.heat]}`}>
                                        {d.heat}
                                    </span>
                                </div>
                            </m.div>
                        ))}
                    </div>
                ))}
            </div>
        </Card>
    );
}

// ──────── CUSTOMER SUCCESS — ticket list ────────
export function SuccessMockup({ mod }: MockupProps) {
    const tickets = [
        { id: '#4821', subject: 'Refund for order #1108', sla: 'breach soon', tone: 'rose' },
        { id: '#4820', subject: 'Cannot login to dashboard', sla: '< 30m', tone: 'amber' },
        { id: '#4819', subject: 'Feature request: dark mode', sla: 'on track', tone: 'emerald' },
        { id: '#4818', subject: 'Invoice missing GSTIN', sla: '< 1h', tone: 'amber' },
    ];
    const toneMap: Record<string, string> = {
        rose: 'bg-rose-100 text-rose-700',
        amber: 'bg-amber-100 text-amber-700',
        emerald: 'bg-emerald-100 text-emerald-700',
    };
    return (
        <Card mod={mod} title="Open tickets" badge={`${tickets.length} active`}>
            <div className="divide-y divide-zinc-100">
                {tickets.map((t, i) => (
                    <m.div
                        key={t.id}
                        initial={{ opacity: 0, x: -4 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: i * 0.05 }}
                        className="flex items-center gap-3 py-2.5"
                    >
                        <div className={`grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-br ${mod.accentFrom} ${mod.accentTo} text-[10px] font-bold text-white`}>
                            {t.id.slice(-2)}
                        </div>
                        <div className="min-w-0 flex-1">
                            <div className="flex items-baseline gap-2">
                                <span className="text-[10px] font-semibold text-zinc-500">{t.id}</span>
                                <span className="truncate text-[12px] font-medium text-zinc-900">
                                    {t.subject}
                                </span>
                            </div>
                        </div>
                        <span className={`rounded-full px-2 py-0.5 text-[9px] font-semibold ${toneMap[t.tone]}`}>
                            {t.sla}
                        </span>
                    </m.div>
                ))}
            </div>
        </Card>
    );
}

// ──────── PEOPLE & OPERATIONS — roster grid ────────
export function PeopleMockup({ mod }: MockupProps) {
    const team = [
        { name: 'A', who: 'Asha', role: 'Designer', status: 'in', tone: 'emerald' },
        { name: 'R', who: 'Rohan', role: 'Engineer', status: 'in', tone: 'emerald' },
        { name: 'P', who: 'Priya', role: 'Ops', status: 'leave', tone: 'rose' },
        { name: 'K', who: 'Karan', role: 'Sales', status: 'in', tone: 'emerald' },
        { name: 'M', who: 'Maya', role: 'Support', status: 'late', tone: 'amber' },
        { name: 'V', who: 'Vir', role: 'Finance', status: 'in', tone: 'emerald' },
    ];
    const labels: Record<string, string> = { in: 'Punched in', late: '12m late', leave: 'On leave' };
    const dots: Record<string, string> = { emerald: 'bg-emerald-500', amber: 'bg-amber-500', rose: 'bg-rose-500' };
    return (
        <Card mod={mod} title="Today · Roster" badge="6 people">
            <div className="grid grid-cols-3 gap-2">
                {team.map((p, i) => (
                    <m.div
                        key={p.who}
                        initial={{ opacity: 0, scale: 0.94 }}
                        whileInView={{ opacity: 1, scale: 1 }}
                        viewport={{ once: true }}
                        transition={{ delay: i * 0.04 }}
                        className="rounded-lg border border-zinc-200 bg-white p-2"
                    >
                        <div className={`grid h-7 w-7 place-items-center rounded-full bg-gradient-to-br ${mod.accentFrom} ${mod.accentTo} text-[11px] font-semibold text-white`}>
                            {p.name}
                        </div>
                        <p className="mt-1.5 text-[11px] font-semibold text-zinc-900">{p.who}</p>
                        <p className="text-[10px] text-zinc-500">{p.role}</p>
                        <div className="mt-1.5 flex items-center gap-1">
                            <span className={`h-1.5 w-1.5 rounded-full ${dots[p.tone]}`} />
                            <span className="text-[9px] font-semibold uppercase tracking-wider text-zinc-600">
                                {labels[p.status]}
                            </span>
                        </div>
                    </m.div>
                ))}
            </div>
        </Card>
    );
}

// ──────── PRODUCTIVITY — meeting / room ────────
export function ProductivityMockup({ mod }: MockupProps) {
    const people = ['A', 'R', 'P', 'K'];
    return (
        <Card mod={mod} title={`${mod.name} · Studio`} badge="Recording">
            <div className="grid grid-cols-2 gap-2">
                {people.map((p, i) => (
                    <m.div
                        key={p}
                        initial={{ opacity: 0, scale: 0.95 }}
                        whileInView={{ opacity: 1, scale: 1 }}
                        viewport={{ once: true }}
                        transition={{ delay: i * 0.05 }}
                        className={`relative aspect-video overflow-hidden rounded-lg bg-gradient-to-br ${mod.accentFrom} ${mod.accentTo}`}
                    >
                        <span className="absolute left-1.5 bottom-1.5 rounded-md bg-black/40 px-1.5 py-0.5 text-[9px] font-semibold text-white backdrop-blur">
                            {p}
                        </span>
                        <Mic className="absolute right-1.5 top-1.5 h-3 w-3 text-white/70" />
                    </m.div>
                ))}
            </div>
            <div className="mt-3 flex items-center gap-2 rounded-lg bg-zinc-50 px-2 py-1.5">
                <Video className="h-3.5 w-3.5 text-zinc-500" />
                <span className="text-[11px] font-semibold text-zinc-700">Live · 32 viewers</span>
                <span className="ml-auto flex items-center gap-1 text-[11px] text-zinc-500">
                    <Clock className="h-3 w-3" /> 12:34
                </span>
            </div>
        </Card>
    );
}

// ──────── ENGINEERING — node graph mini ────────
export function EngineeringMockup({ mod }: MockupProps) {
    const nodes = ['Webhook', 'Filter', 'AI agent', 'Database', 'Email'];
    return (
        <Card mod={mod} title="Flow · order-completed" badge="Healthy">
            <div className="space-y-1.5">
                {nodes.map((n, i) => (
                    <m.div
                        key={n}
                        initial={{ opacity: 0, x: -6 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: i * 0.06 }}
                        className="relative flex items-center gap-2"
                    >
                        <div
                            className={`grid h-7 w-7 place-items-center rounded-md bg-gradient-to-br ${mod.accentFrom} ${mod.accentTo} text-[10px] font-bold text-white`}
                        >
                            {i + 1}
                        </div>
                        <div className="flex-1 rounded-lg border border-zinc-200 bg-white px-2 py-1.5">
                            <div className="flex items-center justify-between">
                                <span className="text-[12px] font-semibold text-zinc-900">{n}</span>
                                <span className="text-[10px] text-emerald-600">✓ 42ms</span>
                            </div>
                        </div>
                    </m.div>
                ))}
            </div>
            <div className="mt-2 flex items-center justify-between rounded-lg bg-zinc-50 px-2 py-1.5">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                    Last run
                </span>
                <span className="text-[11px] font-semibold text-zinc-900">186ms · ok</span>
            </div>
        </Card>
    );
}

// ──────── ANALYTICS & AI — chart ────────
export function AnalyticsMockup({ mod }: MockupProps) {
    const bars = [40, 62, 35, 78, 90, 70, 95, 110, 88, 130, 120, 145];
    const max = Math.max(...bars);
    return (
        <Card mod={mod} title="Last 12 weeks" badge="+184% YoY">
            <div className="flex h-32 items-end gap-1.5">
                {bars.map((v, i) => (
                    <m.div
                        key={i}
                        initial={{ height: 0 }}
                        whileInView={{ height: `${(v / max) * 100}%` }}
                        viewport={{ once: true }}
                        transition={{ delay: i * 0.04, duration: 0.5 }}
                        className={`flex-1 rounded-t-md bg-gradient-to-t ${mod.accentFrom} ${mod.accentTo}`}
                    />
                ))}
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2">
                {[
                    { l: 'Sessions', v: '32,418' },
                    { l: 'Bounce', v: '24%' },
                    { l: 'Conv.', v: '4.8%' },
                ].map((s, i) => (
                    <m.div
                        key={s.l}
                        initial={{ opacity: 0, y: 6 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: 0.3 + i * 0.05 }}
                        className="rounded-lg border border-zinc-100 bg-zinc-50 px-2 py-1.5"
                    >
                        <div className="text-[11px] font-semibold text-zinc-900">{s.v}</div>
                        <div className="text-[9px] uppercase tracking-wider text-zinc-500">{s.l}</div>
                    </m.div>
                ))}
            </div>
        </Card>
    );
}

// ──────── FILES & DOCUMENTS — file grid ────────
export function FilesMockup({ mod }: MockupProps) {
    const files = [
        { name: 'Brand kit', type: 'folder', meta: '24 files' },
        { name: 'Q3 deck.pdf', type: 'pdf', meta: '2.4 MB' },
        { name: 'Logo.svg', type: 'image', meta: '12 KB' },
        { name: 'Contract.signed', type: 'doc', meta: 'signed · 3 ago' },
        { name: 'Roadmap.sheet', type: 'doc', meta: 'co-edited' },
        { name: 'Hero.mp4', type: 'image', meta: '18 MB' },
    ];
    const iconFor = (t: string) =>
        t === 'folder' ? Folder : t === 'image' ? ImageIcon : File;
    return (
        <Card mod={mod} title={`${mod.name} · Library`} badge="6 items">
            <div className="grid grid-cols-3 gap-2">
                {files.map((f, i) => {
                    const FIcon = iconFor(f.type);
                    return (
                        <m.div
                            key={f.name}
                            initial={{ opacity: 0, y: 6 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: i * 0.04 }}
                            className="rounded-lg border border-zinc-200 bg-white p-2.5"
                        >
                            <div className={`grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br ${mod.accentFrom} ${mod.accentTo}`}>
                                <FIcon className="h-4 w-4 text-white" />
                            </div>
                            <p className="mt-2 truncate text-[11px] font-semibold text-zinc-900">{f.name}</p>
                            <p className="truncate text-[10px] text-zinc-500">{f.meta}</p>
                        </m.div>
                    );
                })}
            </div>
        </Card>
    );
}

// ──────── ACQUISITION — landing / lighthouse mini ────────
export function AcquisitionMockup({ mod }: MockupProps) {
    const gauges = [
        { l: 'Perf', v: 98 },
        { l: 'A11y', v: 100 },
        { l: 'BP', v: 96 },
        { l: 'SEO', v: 100 },
    ];
    return (
        <Card mod={mod} title={`sabnode.in/launch`} badge="Mobile · live">
            <div className="grid grid-cols-4 gap-2">
                {gauges.map((g, i) => {
                    const r = 16;
                    const c = 2 * Math.PI * r;
                    return (
                        <div key={g.l} className="flex flex-col items-center">
                            <svg viewBox="0 0 44 44" className="h-12 w-12 -rotate-90">
                                <circle cx="22" cy="22" r={r} stroke="#e4e4e7" strokeWidth="3" fill="none" />
                                <m.circle
                                    cx="22"
                                    cy="22"
                                    r={r}
                                    stroke={mod.accentDeep}
                                    strokeWidth="3"
                                    fill="none"
                                    strokeLinecap="round"
                                    strokeDasharray={c}
                                    initial={{ strokeDashoffset: c }}
                                    whileInView={{ strokeDashoffset: c * (1 - g.v / 100) }}
                                    viewport={{ once: true }}
                                    transition={{ delay: i * 0.08, duration: 0.8 }}
                                />
                            </svg>
                            <p className="-mt-9 text-[12px] font-semibold text-zinc-900">{g.v}</p>
                            <p className="mt-5 text-[9px] uppercase tracking-wider text-zinc-500">{g.l}</p>
                        </div>
                    );
                })}
            </div>
            <div className="mt-3 rounded-lg border border-zinc-100 bg-zinc-50 p-2">
                <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase tracking-wider text-zinc-500">Organic / week</span>
                    <span className="text-[11px] font-semibold" style={{ color: mod.accentDeep }}>
                        +184%
                    </span>
                </div>
                <svg viewBox="0 0 120 32" className="mt-1 h-8 w-full">
                    <m.path
                        initial={{ pathLength: 0 }}
                        whileInView={{ pathLength: 1 }}
                        viewport={{ once: true }}
                        transition={{ duration: 1 }}
                        d="M 0 26 L 12 22 L 24 24 L 36 16 L 48 18 L 60 10 L 72 12 L 84 6 L 96 8 L 108 3 L 120 4"
                        stroke={mod.accentDeep}
                        strokeWidth="1.6"
                        fill="none"
                    />
                </svg>
            </div>
        </Card>
    );
}

// ──────── Card wrapper used by every mockup ────────
function Card({
    mod,
    title,
    badge,
    children,
}: {
    mod: ModuleDef;
    title: string;
    badge?: string;
    children: React.ReactNode;
}) {
    return (
        <div className="relative">
            <div
                aria-hidden
                className="absolute -inset-4 -z-0 rounded-3xl blur-3xl"
                style={{ background: mod.glow, opacity: 0.3 }}
            />
            <div
                className="relative overflow-hidden rounded-2xl border bg-white p-4 shadow-[0_18px_60px_-24px_rgba(0,0,0,0.18)]"
                style={{ borderColor: `${mod.accentDeep}33` }}
            >
                <div className="mb-3 flex items-center justify-between border-b border-zinc-100 pb-2">
                    <div className="flex items-center gap-2">
                        <span
                            className="h-2 w-2 rounded-full"
                            style={{ background: mod.accentDeep, boxShadow: `0 0 8px ${mod.glow}` }}
                        />
                        <span className="text-[11px] font-semibold text-zinc-900">{title}</span>
                    </div>
                    {badge && (
                        <span
                            className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                            style={{ background: `${mod.accentDeep}15`, color: mod.accentDeep }}
                        >
                            {badge}
                        </span>
                    )}
                </div>
                {children}
            </div>
        </div>
    );
}

// ──────── DISPATCHER — pick a mockup based on category ────────
export function CategoryMockup({ mod, variant = 'md' }: MockupProps) {
    switch (mod.category) {
        case 'Conversation':
            return <ConversationMockup mod={mod} variant={variant} />;
        case 'Marketing':
            return <MarketingMockup mod={mod} variant={variant} />;
        case 'Sales & Commerce':
            return <CommerceMockup mod={mod} variant={variant} />;
        case 'Customer Success':
            return <SuccessMockup mod={mod} variant={variant} />;
        case 'People & Operations':
            return <PeopleMockup mod={mod} variant={variant} />;
        case 'Productivity':
            return <ProductivityMockup mod={mod} variant={variant} />;
        case 'Engineering':
            return <EngineeringMockup mod={mod} variant={variant} />;
        case 'Analytics & AI':
            return <AnalyticsMockup mod={mod} variant={variant} />;
        case 'Files & Documents':
            return <FilesMockup mod={mod} variant={variant} />;
        case 'Acquisition':
            return <AcquisitionMockup mod={mod} variant={variant} />;
    }
}

// ──────── SECONDARY mockup library — used for spotlights ────────
// Each variant gives an alternate angle (settings panel, automation, audit log, etc.)
// so each spotlight on the same page looks different.

export function SettingsMockup({ mod }: MockupProps) {
    const rows = [
        { label: 'Auto-reply', value: 'On', on: true },
        { label: 'Smart routing', value: 'AI-decide', on: true },
        { label: 'Working hours', value: '9 AM – 7 PM IST', on: true },
        { label: 'Holiday fallback', value: 'Off', on: false },
    ];
    return (
        <Card mod={mod} title={`${mod.name} · Settings`} badge="Saved">
            <div className="divide-y divide-zinc-100">
                {rows.map((r, i) => (
                    <m.div
                        key={r.label}
                        initial={{ opacity: 0, x: -4 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: i * 0.04 }}
                        className="flex items-center justify-between py-2.5"
                    >
                        <span className="text-[12px] font-medium text-zinc-800">{r.label}</span>
                        <div className="flex items-center gap-2">
                            <span className="text-[11px] text-zinc-500">{r.value}</span>
                            <span
                                className={`relative h-4 w-7 rounded-full transition ${
                                    r.on ? '' : 'bg-zinc-300'
                                }`}
                                style={r.on ? { background: mod.accentDeep } : undefined}
                            >
                                <span
                                    className={`absolute top-0.5 h-3 w-3 rounded-full bg-white shadow transition ${
                                        r.on ? 'right-0.5' : 'left-0.5'
                                    }`}
                                />
                            </span>
                        </div>
                    </m.div>
                ))}
            </div>
        </Card>
    );
}

export function AutomationMockup({ mod }: MockupProps) {
    return (
        <Card mod={mod} title="Automation · trigger when…" badge="3 rules">
            <div className="space-y-2">
                {[
                    { when: 'Cart abandoned for 1h', then: 'Send WhatsApp + 10% code', icon: Workflow },
                    { when: 'Lead replies “price”', then: 'Hand off to sales agent', icon: User },
                    { when: 'Webhook hits /payment-ok', then: 'Mark deal Won + ship', icon: Bot },
                ].map((r, i) => {
                    const RIcon = r.icon;
                    return (
                        <m.div
                            key={r.when}
                            initial={{ opacity: 0, y: 6 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: i * 0.05 }}
                            className="rounded-xl border border-zinc-100 bg-zinc-50/50 p-2.5"
                        >
                            <div className="flex items-center gap-2">
                                <RIcon className="h-3.5 w-3.5" style={{ color: mod.accentDeep }} />
                                <span className="text-[11px] font-semibold text-zinc-900">When</span>
                                <span className="truncate text-[11px] text-zinc-700">{r.when}</span>
                            </div>
                            <div className="mt-1 flex items-center gap-2">
                                <GitBranch className="h-3.5 w-3.5 text-zinc-400" />
                                <span className="text-[11px] font-semibold text-zinc-900">Then</span>
                                <span className="truncate text-[11px] text-zinc-700">{r.then}</span>
                            </div>
                        </m.div>
                    );
                })}
            </div>
        </Card>
    );
}

export function AuditMockup({ mod }: MockupProps) {
    const entries = [
        { who: 'Asha', act: 'updated template', what: 'diwali-launch · v3', t: '2m ago' },
        { who: 'Rohan', act: 'paused campaign', what: 'cart-recovery', t: '14m ago' },
        { who: 'System', act: 'auto-retried', what: 'webhook · /order', t: '1h ago' },
        { who: 'Priya', act: 'rotated key', what: 'razorpay-live', t: '3h ago' },
    ];
    return (
        <Card mod={mod} title="Audit log" badge="Signed">
            <div className="space-y-1">
                {entries.map((e, i) => (
                    <m.div
                        key={e.t}
                        initial={{ opacity: 0, x: -4 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: i * 0.04 }}
                        className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-zinc-50"
                    >
                        <div className={`grid h-6 w-6 place-items-center rounded-full bg-gradient-to-br ${mod.accentFrom} ${mod.accentTo} text-[9px] font-bold text-white`}>
                            {e.who[0]}
                        </div>
                        <div className="min-w-0 flex-1 text-[11px]">
                            <span className="font-semibold text-zinc-900">{e.who}</span>{' '}
                            <span className="text-zinc-500">{e.act}</span>{' '}
                            <span className="font-mono text-zinc-700">{e.what}</span>
                        </div>
                        <span className="text-[10px] text-zinc-400">{e.t}</span>
                    </m.div>
                ))}
            </div>
        </Card>
    );
}

// Pick three spotlight mockups for a given module so each looks different
export function pickSpotlightMockups(mod: ModuleDef) {
    const Primary = () => <CategoryMockup mod={mod} />;
    return [Primary, () => <AutomationMockup mod={mod} />, () => <AuditMockup mod={mod} />];
}
