'use client';

import { m } from 'motion/react';
import {
    Activity,
    Bell,
    Bot,
    CheckCircle2,
    ChevronRight,
    Circle,
    Eye,
    File,
    FileSignature,
    Gauge,
    GitBranch,
    Globe,
    Hash,
    Headphones,
    Key,
    LayoutGrid,
    Link as LinkIcon,
    MapPin,
    Megaphone,
    Mic,
    Pause,
    PauseCircle,
    Play,
    PlayCircle,
    PlusCircle,
    Presentation,
    QrCode,
    Send,
    ShoppingBag,
    ShoppingCart,
    Sparkles,
    Star,
    Target,
    Tag,
    TrendingUp,
    Users,
    Video,
    Wallet,
    Zap,
    type LucideIcon,
} from 'lucide-react';
import type { ModuleDef } from './modules-data';

interface SectionProps {
    mod: ModuleDef;
}

// ──────── Wachat — Broadcast composer + quality dial ────────
export function BroadcastComposer({ mod }: SectionProps) {
    return (
        <Wrap mod={mod} kicker="Broadcasts that don't get flagged" title={`Compose, throttle, retry — keep ${mod.name} green.`}>
            <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1.2fr_1fr]">
                <m.div initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
                    className="rounded-2xl border border-zinc-200 bg-white p-5">
                    <div className="flex items-center gap-2 border-b border-zinc-100 pb-3">
                        <Megaphone className="h-4 w-4" style={{ color: mod.accentDeep }} />
                        <span className="text-sm font-semibold text-zinc-900">Campaign · spring-launch · v3</span>
                        <span className="ml-auto rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">Draft</span>
                    </div>
                    <div className="mt-4 rounded-xl border border-zinc-100 bg-zinc-50/60 p-3">
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Template · approved</p>
                        <p className="mt-2 text-[13px] text-zinc-800">
                            Hi <span className="rounded bg-white px-1 font-semibold">{'{{name}}'}</span> 👋
                            Your <span className="rounded bg-white px-1 font-semibold">{'{{cart_item}}'}</span> is still waiting —
                            tap the link to pay with UPI.
                        </p>
                        <div className="mt-3 flex gap-2">
                            <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold text-zinc-700 border border-zinc-200">Pay now</span>
                            <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold text-zinc-700 border border-zinc-200">Talk to us</span>
                        </div>
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2">
                        {[{ k: 'Send rate', v: '40 / sec' }, { k: 'Retry', v: '3× backoff' }, { k: 'Quiet hrs', v: '10p–8a' }].map(s => (
                            <div key={s.k} className="rounded-lg border border-zinc-100 bg-white px-2 py-1.5">
                                <p className="text-[10px] uppercase tracking-wider text-zinc-500">{s.k}</p>
                                <p className="text-[12px] font-semibold text-zinc-900">{s.v}</p>
                            </div>
                        ))}
                    </div>
                </m.div>

                <div className="space-y-3">
                    <m.div initial={{ opacity: 0, x: 8 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}
                        className="relative overflow-hidden rounded-2xl border border-zinc-200 bg-white p-5">
                        <Gauge className="h-5 w-5" style={{ color: mod.accentDeep }} />
                        <p className="mt-3 text-base font-semibold text-zinc-950">Quality rating</p>
                        <div className="mt-4 flex items-end gap-1">
                            {[40, 70, 80, 90, 95, 92, 96, 98].map((v, i) => (
                                <m.span key={i} initial={{ height: 0 }} whileInView={{ height: `${v}%` }} viewport={{ once: true }}
                                    transition={{ delay: i * 0.05 }}
                                    className={`block w-3 rounded-t-sm bg-gradient-to-t ${mod.accentFrom} ${mod.accentTo}`} />
                            ))}
                        </div>
                        <p className="mt-3 text-[12px] text-zinc-600">High · last 7 days. Auto-pauses if it dips.</p>
                    </m.div>
                </div>
            </div>
        </Wrap>
    );
}

// ──────── Bot builder — visual flow ────────
export function BotBuilder({ mod }: SectionProps) {
    const nodes = [
        { x: 6, y: 30, label: 'User says "price"', icon: Send },
        { x: 30, y: 18, label: 'AI detects intent', icon: Bot },
        { x: 30, y: 60, label: 'Has account?', icon: GitBranch },
        { x: 56, y: 18, label: 'Send price card', icon: ShoppingBag },
        { x: 56, y: 60, label: 'Ask phone + sign-up', icon: Users },
        { x: 82, y: 38, label: 'Hand off to sales', icon: Headphones },
    ];
    return (
        <Wrap mod={mod} kicker="Bots that pass the Turing-ish test" title="Visual flows. Real branching. AI fallback.">
            <m.div initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
                className="relative aspect-[16/9] overflow-hidden rounded-3xl border border-zinc-200 bg-white">
                <div aria-hidden className="absolute inset-0 opacity-40"
                    style={{ backgroundImage: 'radial-gradient(#e4e4e7 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
                <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 80" preserveAspectRatio="none">
                    {[['Asks', 'Detect'], ['Detect', 'Has acc'], ['Has acc', 'Price'], ['Has acc', 'Ask'], ['Price', 'Hand'], ['Ask', 'Hand']]
                        .map(([_, __], i) => null)}
                    {[
                        ['M 12 30 C 22 30 22 18 30 18', 0],
                        ['M 12 30 C 22 30 22 60 30 60', 1],
                        ['M 36 18 C 46 18 46 18 56 18', 2],
                        ['M 36 60 C 46 60 46 60 56 60', 3],
                        ['M 62 18 C 72 18 72 38 82 38', 4],
                        ['M 62 60 C 72 60 72 38 82 38', 5],
                    ].map(([d, i]) => (
                        <path key={i as number} d={d as string} stroke={mod.accentDeep} strokeOpacity="0.4" strokeWidth="0.4" fill="none" />
                    ))}
                </svg>
                {nodes.map((n, i) => {
                    const NIcon = n.icon;
                    return (
                        <m.div key={n.label} initial={{ opacity: 0, scale: 0.85 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }}
                            transition={{ delay: 0.1 + i * 0.06 }}
                            className="absolute -translate-x-1/2 -translate-y-1/2"
                            style={{ left: `${n.x}%`, top: `${n.y}%` }}>
                            <div className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2 shadow-sm">
                                <div className={`grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-br ${mod.accentFrom} ${mod.accentTo}`}>
                                    <NIcon className="h-3.5 w-3.5 text-white" />
                                </div>
                                <span className="text-[11px] font-semibold text-zinc-900">{n.label}</span>
                            </div>
                        </m.div>
                    );
                })}
            </m.div>
        </Wrap>
    );
}

// ──────── Call queue / IVR ────────
export function CallQueue({ mod }: SectionProps) {
    const calls = [
        { who: '+91 98765 12345', status: 'live', agent: 'Asha', tag: 'Sales', tone: 'emerald', t: '02:14' },
        { who: '+91 99000 23456', status: 'ringing', agent: '—', tag: 'Support', tone: 'amber', t: '00:08' },
        { who: '+91 91234 90876', status: 'hold', agent: 'Rohan', tag: 'Billing', tone: 'sky', t: '01:42' },
        { who: '+91 97654 33211', status: 'wrap', agent: 'Priya', tag: 'Onboard', tone: 'violet', t: '03:01' },
    ];
    const dotMap: Record<string, string> = {
        emerald: 'bg-emerald-500', amber: 'bg-amber-500', sky: 'bg-sky-500', violet: 'bg-violet-500',
    };
    return (
        <Wrap mod={mod} kicker="Calls routed in 200ms" title="Live agent queue with whisper, barge, and recording.">
            <div className="rounded-2xl border border-zinc-200 bg-white p-5">
                <div className="flex items-center gap-2 border-b border-zinc-100 pb-3">
                    <Headphones className="h-4 w-4" style={{ color: mod.accentDeep }} />
                    <span className="text-sm font-semibold text-zinc-900">Voice queue · live</span>
                    <span className="ml-auto text-[11px] text-zinc-500">avg wait 4s</span>
                </div>
                <div className="mt-3 divide-y divide-zinc-100">
                    {calls.map((c, i) => (
                        <m.div key={c.who} initial={{ opacity: 0, x: -6 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}
                            transition={{ delay: i * 0.05 }}
                            className="grid grid-cols-12 items-center gap-3 py-3">
                            <span className={`col-span-1 h-2 w-2 rounded-full ${dotMap[c.tone]}`} />
                            <span className="col-span-3 font-mono text-[12px] text-zinc-800">{c.who}</span>
                            <span className="col-span-2 text-[11px] uppercase tracking-wider text-zinc-500">{c.status}</span>
                            <span className="col-span-2 text-[12px] text-zinc-700">{c.agent}</span>
                            <span className="col-span-2 rounded-full bg-zinc-100 px-2 py-0.5 text-center text-[10px] font-semibold text-zinc-700">{c.tag}</span>
                            <span className="col-span-2 text-right text-[12px] font-semibold text-zinc-900">{c.t}</span>
                        </m.div>
                    ))}
                </div>
            </div>
        </Wrap>
    );
}

// ──────── Storefront preview ────────
export function StorefrontPreview({ mod }: SectionProps) {
    const items = [
        { n: 'Linen Kurta', p: '₹1,299', t: 'Bestseller' },
        { n: 'Suede Loafer', p: '₹3,499', t: '−12%' },
        { n: 'Linen Trouser', p: '₹1,499', t: 'New' },
    ];
    return (
        <Wrap mod={mod} kicker="Storefronts that ship" title="Brandable themes. Real checkout. Real revenue.">
            <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1.1fr_1fr]">
                <m.div initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
                    className="rounded-3xl border border-zinc-200 bg-white p-5">
                    <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
                        <span className="text-sm font-semibold text-zinc-900">solecompany.in</span>
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">Live</span>
                    </div>
                    <div className="mt-4 rounded-2xl bg-gradient-to-br from-zinc-100 to-zinc-50 p-5 text-center">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">Spring drop</p>
                        <p className="mt-2 text-3xl font-semibold text-zinc-950">Made by hand. Shipped fast.</p>
                        <span className="mt-3 inline-block rounded-full bg-zinc-900 px-3 py-1 text-[11px] font-semibold text-white">Shop</span>
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2">
                        {items.map((it, i) => (
                            <m.div key={it.n} initial={{ opacity: 0, y: 8 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
                                transition={{ delay: i * 0.06 }}
                                className="rounded-xl border border-zinc-200 bg-white p-2">
                                <div className={`aspect-square rounded-lg bg-gradient-to-br ${mod.accentFrom} ${mod.accentTo} opacity-70`} />
                                <p className="mt-1.5 text-[11px] font-semibold text-zinc-900">{it.n}</p>
                                <div className="flex items-center justify-between">
                                    <span className="text-[11px] text-zinc-600">{it.p}</span>
                                    <span className="text-[9px] font-semibold uppercase" style={{ color: mod.accentDeep }}>{it.t}</span>
                                </div>
                            </m.div>
                        ))}
                    </div>
                </m.div>

                <m.div initial={{ opacity: 0, x: 8 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}
                    className="rounded-3xl border border-zinc-200 bg-white p-5">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Checkout</p>
                    <p className="mt-2 text-3xl font-semibold text-zinc-950">₹6,297</p>
                    <p className="text-[12px] text-zinc-500">3 items · COD ready · UPI · cards</p>
                    <div className="mt-4 space-y-2">
                        {['UPI · Google Pay', 'Card · ending 4242', 'Cash on Delivery'].map((p, i) => (
                            <m.div key={p} initial={{ opacity: 0, x: -6 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}
                                transition={{ delay: i * 0.05 }}
                                className="flex items-center gap-2 rounded-xl border border-zinc-100 px-3 py-2">
                                <Circle className="h-3.5 w-3.5 text-zinc-400" />
                                <span className="text-[12px] text-zinc-800">{p}</span>
                            </m.div>
                        ))}
                    </div>
                    <button
                        className="mt-4 w-full rounded-full px-4 py-2.5 text-[13px] font-semibold text-white"
                        style={{ background: mod.accentDeep, boxShadow: `0 14px 30px -10px ${mod.glow}` }}>
                        Pay ₹6,297
                    </button>
                </m.div>
            </div>
        </Wrap>
    );
}

// ──────── API playground ────────
export function ApiPlayground({ mod }: SectionProps) {
    return (
        <Wrap mod={mod} kicker="Open by default" title="Every action exposed as a signed, idempotent API.">
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <m.div initial={{ opacity: 0, y: 8 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
                    className="overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-950 font-mono">
                    <div className="flex items-center gap-2 border-b border-white/10 px-4 py-2 text-[11px] text-white/60">
                        <span className="rounded bg-emerald-500/20 px-1.5 text-[10px] font-bold text-emerald-300">POST</span>
                        <span>/v1/{mod.slug}/run</span>
                    </div>
                    <pre className="p-4 text-[11.5px] leading-relaxed text-zinc-200"><span className="text-fuchsia-300">{`{`}</span>{`
  "trigger": "order.completed",
  "payload": {
    "id": "ORD-4821",
    "amount": 4299,
    "currency": "INR"
  },
  "idempotencyKey": "evt_8e1c..."
`}<span className="text-fuchsia-300">{`}`}</span></pre>
                </m.div>
                <m.div initial={{ opacity: 0, y: 8 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
                    transition={{ delay: 0.1 }}
                    className="overflow-hidden rounded-2xl border border-zinc-200 bg-white">
                    <div className="flex items-center gap-2 border-b border-zinc-100 px-4 py-2 text-[11px] text-zinc-500">
                        <span className="rounded bg-emerald-100 px-1.5 text-[10px] font-bold text-emerald-700">200</span>
                        <span>Response · 42ms</span>
                    </div>
                    <pre className="p-4 text-[11.5px] leading-relaxed text-zinc-800">{`{
  "ok": true,
  "runId": "run_4f7e...",
  "tracedSpans": 7,
  "next": "/v1/${mod.slug}/run_4f7e/replay"
}`}</pre>
                </m.div>
            </div>
        </Wrap>
    );
}

// ──────── Knowledge base preview ────────
export function KnowledgeBase({ mod }: SectionProps) {
    const arts = [
        { t: 'How to set up WhatsApp Pay', cat: 'Getting started', read: '4 min', hot: true },
        { t: 'Bulk-import contacts via CSV', cat: 'Contacts', read: '3 min', hot: false },
        { t: 'What is a quality rating?', cat: 'Deliverability', read: '6 min', hot: true },
        { t: 'Build your first auto-reply', cat: 'Automation', read: '5 min', hot: false },
        { t: 'Approval rules for templates', cat: 'Templates', read: '4 min', hot: false },
    ];
    return (
        <Wrap mod={mod} kicker="Help that helps" title="A knowledge base your customers actually find.">
            <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1fr_1.1fr]">
                <m.div initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
                    className="rounded-2xl border border-zinc-200 bg-white p-5">
                    <div className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2">
                        <Eye className="h-3.5 w-3.5 text-zinc-500" />
                        <span className="text-[12px] text-zinc-700">How do I…</span>
                        <span className="ml-auto rounded bg-zinc-200 px-1.5 text-[10px] font-semibold text-zinc-600">⌘K</span>
                    </div>
                    <div className="mt-4 space-y-1">
                        {arts.map((a, i) => (
                            <m.div key={a.t} initial={{ opacity: 0, x: -4 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}
                                transition={{ delay: i * 0.05 }}
                                className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-zinc-50">
                                <File className="h-3.5 w-3.5 text-zinc-400" />
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-[13px] font-semibold text-zinc-900">{a.t}</p>
                                    <p className="text-[11px] text-zinc-500">{a.cat} · {a.read}</p>
                                </div>
                                {a.hot && (
                                    <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-semibold text-amber-700">Hot</span>
                                )}
                            </m.div>
                        ))}
                    </div>
                </m.div>

                <ul className="space-y-3">
                    {[
                        { t: 'AI-suggested articles', d: 'When agents type, the right article appears next to the reply.' },
                        { t: 'Self-serve deflection', d: '46% of tickets close before reaching a human. We track it.' },
                        { t: 'Multi-locale', d: 'Translate articles in one click, preserve formatting, sync edits.' },
                        { t: 'Public portal', d: 'Branded, fast, SEO-friendly. With a built-in feedback loop.' },
                    ].map((p, i) => (
                        <m.li key={p.t} initial={{ opacity: 0, x: 8 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}
                            transition={{ delay: i * 0.05 }}
                            className="rounded-2xl border border-zinc-200 bg-white p-4">
                            <p className="text-base font-semibold text-zinc-950">{p.t}</p>
                            <p className="mt-1 text-[13px] text-zinc-600">{p.d}</p>
                        </m.li>
                    ))}
                </ul>
            </div>
        </Wrap>
    );
}

// ──────── QR Studio showcase ────────
export function QrStudio({ mod }: SectionProps) {
    const codes = [
        { t: 'Menu · /menu-spring', n: '8,214', delta: '+18%' },
        { t: 'Pay · UPI', n: '5,021', delta: '+42%' },
        { t: 'Insta · /follow', n: '1,943', delta: '+8%' },
    ];
    return (
        <Wrap mod={mod} kicker="One square, infinite analytics" title="Dynamic QR — change the destination, keep the print.">
            <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1fr_1.2fr]">
                <m.div initial={{ opacity: 0, scale: 0.94 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }}
                    className="relative mx-auto aspect-square w-56 overflow-hidden rounded-3xl border border-zinc-200 bg-white p-6">
                    <div aria-hidden className="grid h-full w-full grid-cols-12 grid-rows-12 gap-px"
                        style={{ background: '#fff' }}>
                        {Array.from({ length: 144 }).map((_, i) => (
                            <div key={i} className={Math.random() > 0.5 ? 'bg-zinc-900' : 'bg-white'} />
                        ))}
                    </div>
                    <div className={`absolute inset-1/3 grid place-items-center rounded-xl bg-gradient-to-br ${mod.accentFrom} ${mod.accentTo}`}>
                        <QrCode className="h-6 w-6 text-white" />
                    </div>
                </m.div>

                <div className="space-y-2">
                    {codes.map((c, i) => (
                        <m.div key={c.t} initial={{ opacity: 0, x: 8 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}
                            transition={{ delay: i * 0.05 }}
                            className="flex items-center gap-4 rounded-2xl border border-zinc-200 bg-white p-4">
                            <div className={`grid h-12 w-12 place-items-center rounded-xl bg-gradient-to-br ${mod.accentFrom} ${mod.accentTo}`}>
                                <QrCode className="h-5 w-5 text-white" />
                            </div>
                            <div className="flex-1">
                                <p className="text-base font-semibold text-zinc-950">{c.t}</p>
                                <p className="text-[12px] text-zinc-500">{c.n} scans · last 7d</p>
                            </div>
                            <span className="rounded-full bg-emerald-100 px-2 py-1 text-[11px] font-semibold text-emerald-700">{c.delta}</span>
                        </m.div>
                    ))}
                </div>
            </div>
        </Wrap>
    );
}

// ──────── Recording library ────────
export function RecordingLibrary({ mod }: SectionProps) {
    const recs = [
        { t: 'Stand-up · May 22', dur: '12:48', who: 'Asha + 5', tag: 'Sync' },
        { t: 'Customer call · Acme', dur: '36:24', who: 'Rohan + 1', tag: 'External' },
        { t: 'Webinar · launch', dur: '54:02', who: 'Priya + 218', tag: 'Public' },
    ];
    return (
        <Wrap mod={mod} kicker="Searchable since the first second" title="Every recording is transcribed, summarised, and searchable.">
            <div className="space-y-3">
                {recs.map((r, i) => (
                    <m.div key={r.t} initial={{ opacity: 0, y: 8 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
                        transition={{ delay: i * 0.05 }}
                        className="grid grid-cols-12 items-center gap-4 rounded-2xl border border-zinc-200 bg-white p-4">
                        <div className={`col-span-2 grid h-12 w-12 place-items-center rounded-xl bg-gradient-to-br ${mod.accentFrom} ${mod.accentTo}`}>
                            <PlayCircle className="h-6 w-6 text-white" />
                        </div>
                        <div className="col-span-5">
                            <p className="text-base font-semibold text-zinc-950">{r.t}</p>
                            <p className="text-[12px] text-zinc-500">{r.who} · {r.dur}</p>
                        </div>
                        <div className="col-span-2">
                            <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-semibold text-zinc-700">{r.tag}</span>
                        </div>
                        <div className="col-span-3 flex justify-end gap-2">
                            <button className="rounded-full border border-zinc-200 px-3 py-1.5 text-[11px] font-semibold text-zinc-700">Transcript</button>
                            <button className="rounded-full px-3 py-1.5 text-[11px] font-semibold text-white"
                                style={{ background: mod.accentDeep }}>Summary</button>
                        </div>
                    </m.div>
                ))}
            </div>
        </Wrap>
    );
}

// ──────── Funnel chart ────────
export function FunnelChart({ mod }: SectionProps) {
    const steps = [
        { l: 'Visited', n: 100000, pct: 100 },
        { l: 'Added to cart', n: 24800, pct: 24.8 },
        { l: 'Started checkout', n: 12420, pct: 12.4 },
        { l: 'Paid', n: 8964, pct: 8.96 },
    ];
    return (
        <Wrap mod={mod} kicker="Funnels you can read in five seconds" title="Where customers drop. Why they drop. What to fix.">
            <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1.2fr_1fr]">
                <div className="space-y-2">
                    {steps.map((s, i) => (
                        <m.div key={s.l} initial={{ opacity: 0, x: -8 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}
                            transition={{ delay: i * 0.06 }}
                            className="rounded-2xl border border-zinc-200 bg-white p-4">
                            <div className="flex items-baseline justify-between">
                                <span className="text-[14px] font-semibold text-zinc-900">{s.l}</span>
                                <span className="text-[14px] font-semibold" style={{ color: mod.accentDeep }}>
                                    {s.n.toLocaleString('en-IN')} <span className="text-[11px] text-zinc-500">({s.pct.toFixed(1)}%)</span>
                                </span>
                            </div>
                            <div className="mt-2 h-2 overflow-hidden rounded-full bg-zinc-100">
                                <m.div initial={{ width: 0 }} whileInView={{ width: `${s.pct}%` }} viewport={{ once: true }}
                                    transition={{ delay: i * 0.06 + 0.1, duration: 0.6 }}
                                    className={`h-full bg-gradient-to-r ${mod.accentFrom} ${mod.accentTo}`} />
                            </div>
                        </m.div>
                    ))}
                </div>
                <m.div initial={{ opacity: 0, x: 8 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}
                    className="rounded-2xl border border-zinc-200 bg-white p-5">
                    <Sparkles className="h-5 w-5" style={{ color: mod.accentDeep }} />
                    <p className="mt-3 text-base font-semibold text-zinc-950">AI insight</p>
                    <p className="mt-2 text-[13px] leading-relaxed text-zinc-700">
                        The biggest drop is between cart and checkout (−50%). Mobile users on slow networks
                        are abandoning at the address step. Try the simpler 2-field address you have in /experiments.
                    </p>
                    <button className="mt-3 rounded-full px-3 py-1.5 text-[11px] font-semibold text-white"
                        style={{ background: mod.accentDeep }}>Promote variant</button>
                </m.div>
            </div>
        </Wrap>
    );
}

// ──────── Vault entries ────────
export function VaultEntries({ mod }: SectionProps) {
    const entries = [
        { name: 'razorpay-live', env: 'prod', who: '7 readers', last: '2h ago', rotation: '90d' },
        { name: 'aws-rds-master', env: 'prod', who: '2 readers', last: '8h ago', rotation: '30d' },
        { name: 'openai-key', env: 'staging', who: '4 readers', last: '12h ago', rotation: '60d' },
        { name: 'twilio-sid', env: 'prod', who: '3 readers', last: '1d ago', rotation: '90d' },
    ];
    return (
        <Wrap mod={mod} kicker="Secrets with consequences" title="Every secret is gated, rotated, and audited.">
            <div className="rounded-2xl border border-zinc-200 bg-white p-5">
                <div className="grid grid-cols-12 border-b border-zinc-100 pb-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                    <div className="col-span-4">Secret</div>
                    <div className="col-span-2">Env</div>
                    <div className="col-span-3">Readers</div>
                    <div className="col-span-2">Last read</div>
                    <div className="col-span-1 text-right">Rotation</div>
                </div>
                <div className="divide-y divide-zinc-100">
                    {entries.map((e, i) => (
                        <m.div key={e.name} initial={{ opacity: 0, x: -6 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}
                            transition={{ delay: i * 0.05 }}
                            className="grid grid-cols-12 items-center gap-2 py-3">
                            <div className="col-span-4 flex items-center gap-2">
                                <Key className="h-3.5 w-3.5" style={{ color: mod.accentDeep }} />
                                <span className="font-mono text-[12px] text-zinc-900">{e.name}</span>
                            </div>
                            <div className="col-span-2">
                                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${e.env === 'prod' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'}`}>{e.env}</span>
                            </div>
                            <div className="col-span-3 text-[12px] text-zinc-700">{e.who}</div>
                            <div className="col-span-2 text-[12px] text-zinc-500">{e.last}</div>
                            <div className="col-span-1 text-right text-[11px] font-semibold" style={{ color: mod.accentDeep }}>{e.rotation}</div>
                        </m.div>
                    ))}
                </div>
            </div>
        </Wrap>
    );
}

// ──────── E-sign flow ────────
export function ESignFlow({ mod }: SectionProps) {
    return (
        <Wrap mod={mod} kicker="From PDF to legally binding" title="Send. Track. Counter-sign. All without leaving SabNode.">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                {[
                    { n: 1, t: 'Drop the PDF', d: 'Auto-detect fields. Drag-place signers.', icon: File },
                    { n: 2, t: 'Send to signers', d: 'Sequential or parallel. SMS + email reminders.', icon: Send },
                    { n: 3, t: 'Counter-sign + stamp', d: 'e-Stamp paper attached. Signed hash stored.', icon: FileSignature },
                ].map((s, i) => {
                    const SIcon = s.icon;
                    return (
                        <m.div key={s.n} initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
                            transition={{ delay: i * 0.06 }}
                            className="rounded-2xl border border-zinc-200 bg-white p-5">
                            <div className={`grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br ${mod.accentFrom} ${mod.accentTo}`}>
                                <SIcon className="h-5 w-5 text-white" />
                            </div>
                            <p className="mt-4 text-[11px] font-semibold uppercase tracking-wider" style={{ color: mod.accentDeep }}>Step 0{s.n}</p>
                            <p className="mt-1 text-lg font-semibold text-zinc-950">{s.t}</p>
                            <p className="mt-1.5 text-[13px] text-zinc-600">{s.d}</p>
                        </m.div>
                    );
                })}
            </div>
        </Wrap>
    );
}

// ──────── Roadmap kanban (HRM, Sprints) ────────
export function RoadmapKanban({ mod }: SectionProps) {
    const cols = [
        { name: 'This quarter', items: ['Payroll v3', 'Geo attendance', 'OKR rollup'] },
        { name: 'Next quarter', items: ['Skills graph', 'Career ladder', '360° calibration'] },
        { name: 'Backlog', items: ['Mobile app', 'AI insights', 'Pulse surveys'] },
    ];
    return (
        <Wrap mod={mod} kicker="Roadmaps that actually move" title="Drag items across quarters. Tie them to OKRs. See progress.">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                {cols.map((c, ci) => (
                    <m.div key={c.name} initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
                        transition={{ delay: ci * 0.06 }}
                        className="rounded-2xl border border-zinc-200 bg-white p-4">
                        <div className="flex items-center justify-between border-b border-zinc-100 pb-2">
                            <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: mod.accentDeep }}>{c.name}</span>
                            <span className="text-[10px] text-zinc-400">{c.items.length}</span>
                        </div>
                        <div className="mt-3 space-y-2">
                            {c.items.map((t, i) => (
                                <m.div key={t} initial={{ opacity: 0, x: -4 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}
                                    transition={{ delay: ci * 0.06 + i * 0.04 }}
                                    className="rounded-lg border border-zinc-100 bg-zinc-50/60 p-2.5">
                                    <p className="text-[12px] font-semibold text-zinc-900">{t}</p>
                                    <div className="mt-1.5 flex items-center justify-between">
                                        <span className="rounded-full bg-white px-1.5 py-0.5 text-[9px] font-semibold text-zinc-600 border border-zinc-200">OKR-{ci + 1}.{i + 1}</span>
                                        <span className={`h-1.5 w-1.5 rounded-full ${ci === 0 ? 'bg-emerald-500' : ci === 1 ? 'bg-amber-500' : 'bg-zinc-300'}`} />
                                    </div>
                                </m.div>
                            ))}
                        </div>
                    </m.div>
                ))}
            </div>
        </Wrap>
    );
}

// ──────── Slide editor (SabShow) ────────
export function SlideEditor({ mod }: SectionProps) {
    return (
        <Wrap mod={mod} kicker="Pitch like a product team" title="Component-based decks. Versioned. Co-edited.">
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_2fr]">
                <m.div initial={{ opacity: 0, x: -8 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}
                    className="space-y-2">
                    {['Hero', 'Problem', 'Solution', 'Metrics', 'Ask'].map((s, i) => (
                        <m.div key={s} initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }}
                            transition={{ delay: i * 0.05 }}
                            className={`flex items-center gap-2 rounded-xl border px-3 py-2 ${i === 1 ? 'border-zinc-900 bg-zinc-50' : 'border-zinc-200 bg-white'}`}>
                            <span className="text-[10px] font-bold text-zinc-400">{String(i + 1).padStart(2, '0')}</span>
                            <span className="text-[12px] font-semibold text-zinc-900">{s}</span>
                            {i === 1 && <span className="ml-auto rounded-full bg-emerald-100 px-1.5 text-[9px] font-semibold text-emerald-700">edit</span>}
                        </m.div>
                    ))}
                </m.div>

                <m.div initial={{ opacity: 0, x: 8 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}
                    className="aspect-video rounded-3xl border border-zinc-200 bg-gradient-to-br from-zinc-100 to-white p-10">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.22em]" style={{ color: mod.accentDeep }}>Slide 02 · Problem</p>
                    <p className="mt-4 text-balance text-3xl font-semibold leading-tight text-zinc-950 md:text-4xl">
                        Most teams stitch 6 tools together — and pay twice for the duct tape.
                    </p>
                    <div className="mt-5 grid grid-cols-3 gap-3">
                        {['HubSpot', 'Calendly', 'Loyalzoo'].map(b => (
                            <div key={b} className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-[12px] font-semibold text-zinc-700">{b}</div>
                        ))}
                    </div>
                </m.div>
            </div>
        </Wrap>
    );
}

// ──────── Spreadsheet preview ────────
export function SheetPreview({ mod }: SectionProps) {
    const cols = ['Customer', 'Plan', 'MRR', 'Renewed'];
    const rows = [
        ['Acme', 'Growth', '₹4,999', '2027-01-12'],
        ['Stark', 'Scale', '₹19,000', '2027-02-04'],
        ['Globex', 'Growth', '₹4,999', '2026-12-20'],
        ['Wayne', 'Starter', '₹0', '2026-11-30'],
    ];
    return (
        <Wrap mod={mod} kicker="Sheets that talk to your data" title="Real-time. Formula-rich. Connected to your DB.">
            <m.div initial={{ opacity: 0, y: 8 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
                className="overflow-hidden rounded-2xl border border-zinc-200 bg-white">
                <div className="flex items-center gap-2 border-b border-zinc-100 px-4 py-2 text-[11px] text-zinc-500">
                    <Hash className="h-3.5 w-3.5" />
                    <span>customers.sheet · live · pulled from postgres</span>
                    <span className="ml-auto flex items-center gap-1"><span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />Refreshes every 30s</span>
                </div>
                <table className="w-full text-left text-[12px]">
                    <thead className="border-b border-zinc-100 bg-zinc-50">
                        <tr>
                            <th className="px-4 py-2 w-10 text-zinc-400">#</th>
                            {cols.map(c => <th key={c} className="px-4 py-2 font-semibold text-zinc-700">{c}</th>)}
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((r, i) => (
                            <m.tr key={i} initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }}
                                transition={{ delay: i * 0.04 }}
                                className="border-b border-zinc-50">
                                <td className="px-4 py-2 text-zinc-400">{i + 1}</td>
                                {r.map((cell, ci) => (
                                    <td key={ci} className={`px-4 py-2 ${ci === 0 ? 'font-semibold text-zinc-900' : 'text-zinc-700'}`}>{cell}</td>
                                ))}
                            </m.tr>
                        ))}
                    </tbody>
                </table>
                <div className="border-t border-zinc-100 bg-zinc-50 px-4 py-2 text-[11px] text-zinc-500">
                    SUM(MRR) = <span className="font-mono font-semibold text-zinc-900">₹28,998</span>
                </div>
            </m.div>
        </Wrap>
    );
}

// ──────── Tables / typed records (SabTables) ────────
export function TablesPreview({ mod }: SectionProps) {
    return (
        <Wrap mod={mod} kicker="Airtable, minus the upcharge" title="Typed columns. Real relations. Forms + API for free.">
            <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1.2fr_1fr]">
                <m.div initial={{ opacity: 0, y: 8 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
                    className="overflow-hidden rounded-2xl border border-zinc-200 bg-white">
                    <div className="grid grid-cols-12 border-b border-zinc-100 bg-zinc-50 px-2 py-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                        <div className="col-span-1">Tag</div>
                        <div className="col-span-3">Project</div>
                        <div className="col-span-3">Owner</div>
                        <div className="col-span-3">Status</div>
                        <div className="col-span-2 text-right">Due</div>
                    </div>
                    {[
                        { tag: 'P1', proj: 'Spring drop', owner: 'Asha', status: 'On track', due: '12 Jun' },
                        { tag: 'P2', proj: 'Refer-a-friend', owner: 'Rohan', status: 'Blocked', due: '02 Jul' },
                        { tag: 'P1', proj: 'Payroll v3', owner: 'Priya', status: 'At risk', due: '20 Jun' },
                    ].map((r, i) => (
                        <m.div key={i} initial={{ opacity: 0, x: -4 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}
                            transition={{ delay: i * 0.05 }}
                            className="grid grid-cols-12 items-center gap-2 border-b border-zinc-50 px-2 py-2 text-[12px]">
                            <div className="col-span-1">
                                <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold text-white ${r.tag === 'P1' ? 'bg-rose-500' : 'bg-amber-500'}`}>{r.tag}</span>
                            </div>
                            <div className="col-span-3 font-semibold text-zinc-900">{r.proj}</div>
                            <div className="col-span-3 text-zinc-700">{r.owner}</div>
                            <div className="col-span-3">
                                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${r.status === 'On track' ? 'bg-emerald-100 text-emerald-700' : r.status === 'Blocked' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'}`}>{r.status}</span>
                            </div>
                            <div className="col-span-2 text-right text-zinc-500">{r.due}</div>
                        </m.div>
                    ))}
                </m.div>
                <ul className="space-y-3">
                    {['Typed columns (number, date, select, relation)', 'Auto REST + GraphQL API', 'Forms that populate rows', 'Trigger SabFlow on every change'].map(b => (
                        <li key={b} className="flex items-start gap-2 rounded-2xl border border-zinc-200 bg-white p-3">
                            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" style={{ color: mod.accentDeep }} />
                            <span className="text-[14px] text-zinc-800">{b}</span>
                        </li>
                    ))}
                </ul>
            </div>
        </Wrap>
    );
}

// ──────── Loyalty rings ────────
export function LoyaltyRings({ mod }: SectionProps) {
    const tiers = [
        { name: 'Bronze', members: 12000, color: 'from-amber-400 to-orange-400' },
        { name: 'Silver', members: 4200, color: 'from-zinc-400 to-zinc-300' },
        { name: 'Gold', members: 920, color: 'from-yellow-400 to-amber-500' },
        { name: 'Platinum', members: 140, color: 'from-violet-400 to-fuchsia-500' },
    ];
    return (
        <Wrap mod={mod} kicker="A loop that actually loops" title="Tiers, points, referrals — all earning, all the time.">
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                {tiers.map((t, i) => (
                    <m.div key={t.name} initial={{ opacity: 0, scale: 0.94 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }}
                        transition={{ delay: i * 0.06 }}
                        className="relative overflow-hidden rounded-3xl border border-zinc-200 bg-white p-5">
                        <div className={`h-24 w-24 rounded-full bg-gradient-to-br ${t.color} shadow-xl mx-auto`} />
                        <p className="mt-4 text-center text-base font-semibold text-zinc-950">{t.name}</p>
                        <p className="text-center text-[12px] text-zinc-500">{t.members.toLocaleString('en-IN')} members</p>
                        <div className="mt-3 flex justify-center gap-1">
                            {Array.from({ length: i + 1 }).map((_, k) => (
                                <Star key={k} className="h-3 w-3 fill-current" style={{ color: mod.accentDeep }} />
                            ))}
                        </div>
                    </m.div>
                ))}
            </div>
        </Wrap>
    );
}

// ──────── Community feed (SabConnect) ────────
export function CommunityFeed({ mod }: SectionProps) {
    const posts = [
        { who: 'Asha · Design', what: 'Shipped: new brand colors', tag: '🎉 Win', t: '2m' },
        { who: 'Rohan · Engineering', what: 'Postmortem: API outage', tag: '📓 Doc', t: '1h' },
        { who: 'Priya · Ops', what: 'Friday potluck — bring a dish?', tag: '🌶 Social', t: '3h' },
        { who: 'CEO', what: 'Q2 update — read by 184/200', tag: '📣 All-hands', t: '1d' },
    ];
    return (
        <Wrap mod={mod} kicker="Community that doesn't sleep" title="Feed, groups, recognition — your team will open it daily.">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {posts.map((p, i) => (
                    <m.div key={p.what} initial={{ opacity: 0, y: 8 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
                        transition={{ delay: i * 0.05 }}
                        className="rounded-2xl border border-zinc-200 bg-white p-4">
                        <div className="flex items-center gap-2">
                            <div className={`grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br ${mod.accentFrom} ${mod.accentTo} text-[12px] font-semibold text-white`}>
                                {p.who[0]}
                            </div>
                            <span className="text-[12px] font-semibold text-zinc-900">{p.who}</span>
                            <span className="ml-auto text-[11px] text-zinc-400">{p.t}</span>
                        </div>
                        <p className="mt-3 text-[14px] font-semibold text-zinc-950">{p.what}</p>
                        <span className="mt-2 inline-block rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] text-zinc-700">{p.tag}</span>
                    </m.div>
                ))}
            </div>
        </Wrap>
    );
}

// ──────── Calendar / bookings ────────
export function BookingCalendar({ mod }: SectionProps) {
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
    const slots = [
        { d: 0, h: '10:00', label: 'Demo · Acme' },
        { d: 0, h: '14:30', label: 'Workshop' },
        { d: 1, h: '11:00', label: '1:1 · Asha' },
        { d: 2, h: '09:30', label: 'Standup' },
        { d: 2, h: '15:00', label: 'Demo · Stark' },
        { d: 3, h: '11:30', label: 'Onboarding' },
        { d: 4, h: '10:00', label: 'Webinar · launch' },
    ];
    return (
        <Wrap mod={mod} kicker="Bookings without back-and-forth" title="Share a link. Customers pick a slot. Pays a deposit.">
            <div className="rounded-2xl border border-zinc-200 bg-white p-5">
                <div className="grid grid-cols-5 gap-3 border-b border-zinc-100 pb-3">
                    {days.map(d => (
                        <p key={d} className="text-center text-[11px] font-semibold uppercase tracking-wider text-zinc-500">{d}</p>
                    ))}
                </div>
                <div className="mt-3 grid grid-cols-5 gap-3">
                    {days.map((_, di) => (
                        <div key={di} className="space-y-2">
                            {slots.filter(s => s.d === di).map((s, i) => (
                                <m.div key={s.h} initial={{ opacity: 0, scale: 0.94 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }}
                                    transition={{ delay: i * 0.05 }}
                                    className="rounded-lg border border-zinc-200 bg-zinc-50 p-2">
                                    <p className="text-[11px] font-semibold text-zinc-900">{s.h}</p>
                                    <p className="truncate text-[10px] text-zinc-500">{s.label}</p>
                                </m.div>
                            ))}
                        </div>
                    ))}
                </div>
            </div>
        </Wrap>
    );
}

// ──────── Affiliate leaderboard ────────
export function AffiliateBoard({ mod }: SectionProps) {
    const rows = [
        { rank: 1, who: 'Asha M.', refs: 482, earn: '₹2.4L' },
        { rank: 2, who: 'Rohan G.', refs: 318, earn: '₹1.6L' },
        { rank: 3, who: 'Priya K.', refs: 211, earn: '₹98k' },
        { rank: 4, who: 'Karan S.', refs: 184, earn: '₹84k' },
    ];
    return (
        <Wrap mod={mod} kicker="Your top earners, in real time" title="A leaderboard your community will refresh hourly.">
            <div className="space-y-2">
                {rows.map((r, i) => (
                    <m.div key={r.who} initial={{ opacity: 0, x: -8 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}
                        transition={{ delay: i * 0.05 }}
                        className="grid grid-cols-12 items-center gap-3 rounded-2xl border border-zinc-200 bg-white p-3">
                        <div className={`col-span-1 grid h-10 w-10 place-items-center rounded-xl text-base font-bold text-white bg-gradient-to-br ${i === 0 ? 'from-amber-400 to-orange-500' : i === 1 ? 'from-zinc-400 to-zinc-500' : i === 2 ? 'from-amber-600 to-amber-700' : `${mod.accentFrom} ${mod.accentTo}`}`}>
                            {r.rank}
                        </div>
                        <div className="col-span-7">
                            <p className="text-[14px] font-semibold text-zinc-950">{r.who}</p>
                            <p className="text-[11px] text-zinc-500">{r.refs} referrals this month</p>
                        </div>
                        <div className="col-span-4 text-right">
                            <p className="text-base font-semibold text-zinc-950">{r.earn}</p>
                            <p className="text-[10px] uppercase tracking-wider" style={{ color: mod.accentDeep }}>this month</p>
                        </div>
                    </m.div>
                ))}
            </div>
        </Wrap>
    );
}

// ──────── A/B test runner ────────
export function AbTestRunner({ mod }: SectionProps) {
    return (
        <Wrap mod={mod} kicker="A/B without spreadsheets" title="Two variants. One stat-sig answer. No drama.">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {[
                    { v: 'A', copy: 'Save 30% before midnight', conv: 4.2, win: false },
                    { v: 'B', copy: '40% off — only 6 left', conv: 5.8, win: true },
                ].map((t, i) => (
                    <m.div key={t.v} initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
                        transition={{ delay: i * 0.06 }}
                        className={`rounded-3xl border p-6 ${t.win ? 'border-zinc-900 bg-white' : 'border-zinc-200 bg-white'}`}>
                        <div className="flex items-center justify-between">
                            <div className={`grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br ${mod.accentFrom} ${mod.accentTo} text-base font-bold text-white`}>{t.v}</div>
                            {t.win && (
                                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                                    Winner · p &lt; 0.01
                                </span>
                            )}
                        </div>
                        <p className="mt-4 text-2xl font-semibold leading-tight text-zinc-950">“{t.copy}”</p>
                        <div className="mt-5 flex items-baseline gap-2">
                            <span className="text-3xl font-semibold text-zinc-950">{t.conv}%</span>
                            <span className="text-[12px] text-zinc-500">conversion</span>
                        </div>
                        <div className="mt-3 h-2 overflow-hidden rounded-full bg-zinc-100">
                            <m.div initial={{ width: 0 }} whileInView={{ width: `${t.conv * 14}%` }} viewport={{ once: true }}
                                transition={{ duration: 0.7 }}
                                className={`h-full bg-gradient-to-r ${mod.accentFrom} ${mod.accentTo}`} />
                        </div>
                    </m.div>
                ))}
            </div>
        </Wrap>
    );
}

// ──────── Field jobs map (SabWorkerly) ────────
export function FieldJobsMap({ mod }: SectionProps) {
    const jobs = [
        { who: 'Vikram · Plumber', area: 'Andheri W', eta: '12m', tone: 'emerald' },
        { who: 'Ravi · Electrician', area: 'Bandra', eta: '24m', tone: 'amber' },
        { who: 'Suresh · Painter', area: 'Powai', eta: 'On site', tone: 'sky' },
    ];
    return (
        <Wrap mod={mod} kicker="Field ops that don't get lost" title="Jobs dispatched by skill, distance, and rating.">
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <m.div initial={{ opacity: 0, scale: 0.96 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }}
                    className="relative aspect-square overflow-hidden rounded-3xl border border-zinc-200 bg-zinc-50">
                    <div aria-hidden className="absolute inset-0 opacity-30"
                        style={{ backgroundImage: 'linear-gradient(#cbd5e1 1px, transparent 1px), linear-gradient(90deg, #cbd5e1 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
                    {[[30, 40], [60, 35], [50, 65], [70, 55], [25, 70]].map(([x, y], i) => (
                        <m.div key={i} initial={{ scale: 0 }} whileInView={{ scale: 1 }} viewport={{ once: true }}
                            transition={{ delay: i * 0.1, type: 'spring' }}
                            className="absolute -translate-x-1/2 -translate-y-1/2"
                            style={{ left: `${x}%`, top: `${y}%` }}>
                            <div className={`grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br ${mod.accentFrom} ${mod.accentTo} shadow-lg`}>
                                <MapPin className="h-4 w-4 text-white" />
                            </div>
                        </m.div>
                    ))}
                </m.div>
                <div className="space-y-2">
                    {jobs.map((j, i) => (
                        <m.div key={j.who} initial={{ opacity: 0, x: 8 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}
                            transition={{ delay: i * 0.06 }}
                            className="flex items-center gap-3 rounded-2xl border border-zinc-200 bg-white p-3">
                            <div className={`grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br ${mod.accentFrom} ${mod.accentTo} text-[13px] font-semibold text-white`}>
                                {j.who[0]}
                            </div>
                            <div className="flex-1">
                                <p className="text-[13px] font-semibold text-zinc-900">{j.who}</p>
                                <p className="text-[11px] text-zinc-500">{j.area}</p>
                            </div>
                            <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${j.tone === 'emerald' ? 'bg-emerald-100 text-emerald-700' : j.tone === 'amber' ? 'bg-amber-100 text-amber-700' : 'bg-sky-100 text-sky-700'}`}>{j.eta}</span>
                        </m.div>
                    ))}
                </div>
            </div>
        </Wrap>
    );
}

// ──────── Practice clients (SabPractice) ────────
export function ClientPortal({ mod }: SectionProps) {
    return (
        <Wrap mod={mod} kicker="Run your firm, not your inbox" title="Engagements, deadlines, invoices — one client portal.">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                {[
                    { c: 'Acme Pvt Ltd', stage: 'Audit · Q3', deadline: '12 Jun', tone: 'amber' },
                    { c: 'Stark Industries', stage: 'GST returns', deadline: '20 Jun', tone: 'emerald' },
                    { c: 'Globex Corp.', stage: 'ROC filing', deadline: '02 Jul', tone: 'sky' },
                ].map((c, i) => (
                    <m.div key={c.c} initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
                        transition={{ delay: i * 0.06 }}
                        className="rounded-2xl border border-zinc-200 bg-white p-4">
                        <p className="text-base font-semibold text-zinc-950">{c.c}</p>
                        <p className="mt-1 text-[12px] text-zinc-500">{c.stage}</p>
                        <div className="mt-3 flex items-center justify-between">
                            <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${c.tone === 'emerald' ? 'bg-emerald-100 text-emerald-700' : c.tone === 'amber' ? 'bg-amber-100 text-amber-700' : 'bg-sky-100 text-sky-700'}`}>{c.deadline}</span>
                            <button className="rounded-full px-2 py-0.5 text-[11px] font-semibold text-white" style={{ background: mod.accentDeep }}>Open</button>
                        </div>
                    </m.div>
                ))}
            </div>
        </Wrap>
    );
}

// ──────── ops command center (SabOps) ────────
export function OpsCommand({ mod }: SectionProps) {
    return (
        <Wrap mod={mod} kicker="The control tower" title="Operations live — sales, support, ops on one wall.">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                {[
                    { l: 'Sales today', v: '₹1.84L', tone: 'emerald' },
                    { l: 'Open tickets', v: '14', tone: 'amber' },
                    { l: 'On-call', v: 'Asha', tone: 'sky' },
                    { l: 'Active incidents', v: '0', tone: 'emerald' },
                    { l: 'P95 latency', v: '184ms', tone: 'emerald' },
                    { l: 'Queue depth', v: '32', tone: 'amber' },
                    { l: 'Backups', v: 'Fresh · 02:14', tone: 'emerald' },
                    { l: 'Burndown', v: '76%', tone: 'sky' },
                ].map((t, i) => (
                    <m.div key={t.l} initial={{ opacity: 0, scale: 0.94 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }}
                        transition={{ delay: i * 0.04 }}
                        className="rounded-2xl border border-zinc-200 bg-white p-4">
                        <div className="flex items-center gap-1.5">
                            <span className={`h-1.5 w-1.5 rounded-full ${t.tone === 'emerald' ? 'bg-emerald-500' : t.tone === 'amber' ? 'bg-amber-500' : 'bg-sky-500'}`} />
                            <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">{t.l}</span>
                        </div>
                        <p className="mt-2 text-2xl font-semibold text-zinc-950">{t.v}</p>
                    </m.div>
                ))}
            </div>
        </Wrap>
    );
}

// ──────── helper wrapper ────────
function Wrap({ mod, kicker, title, children }: { mod: ModuleDef; kicker: string; title: string; children: React.ReactNode }) {
    return (
        <section className="relative px-6 py-24">
            <div className="mx-auto max-w-7xl">
                <m.p initial={{ opacity: 0, y: 6 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
                    className="text-[11px] font-semibold uppercase tracking-[0.22em]"
                    style={{ color: mod.accentDeep }}>{kicker}</m.p>
                <m.h2 initial={{ opacity: 0, y: 8 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
                    transition={{ delay: 0.05 }}
                    className="mt-3 max-w-3xl text-balance text-4xl font-semibold tracking-tight text-zinc-950 md:text-5xl">{title}</m.h2>
                <div className="mt-12">{children}</div>
            </div>
        </section>
    );
}
