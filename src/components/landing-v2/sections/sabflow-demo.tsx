'use client';

import { m } from 'motion/react';
import { Workflow, Webhook, Filter, Mail, Database, Zap, Play, Plus, Maximize2 } from 'lucide-react';

interface Node {
    id: string;
    label: string;
    sub: string;
    x: number;
    y: number;
    color: string;
    icon: React.ComponentType<{ className?: string }>;
}

interface Edge {
    from: string;
    to: string;
}

const nodes: Node[] = [
    { id: 'trigger', label: 'Webhook', sub: 'On new lead', x: 80, y: 220, color: '#10b981', icon: Webhook },
    { id: 'filter', label: 'Filter', sub: 'plan = VIP', x: 300, y: 120, color: '#f59e0b', icon: Filter },
    { id: 'enrich', label: 'Enrich CRM', sub: 'Lookup contact', x: 300, y: 320, color: '#0ea5e9', icon: Database },
    { id: 'email', label: 'Send Email', sub: 'Welcome v3', x: 540, y: 120, color: '#a855f7', icon: Mail },
    { id: 'whatsapp', label: 'WhatsApp', sub: 'Template: onboard', x: 540, y: 320, color: '#22c55e', icon: Zap },
];

const edges: Edge[] = [
    { from: 'trigger', to: 'filter' },
    { from: 'trigger', to: 'enrich' },
    { from: 'filter', to: 'email' },
    { from: 'enrich', to: 'whatsapp' },
];

function path(a: Node, b: Node) {
    const aOut = { x: a.x + 80, y: a.y };
    const bIn = { x: b.x, y: b.y };
    const dx = (bIn.x - aOut.x) * 0.5;
    return `M ${aOut.x} ${aOut.y} C ${aOut.x + dx} ${aOut.y}, ${bIn.x - dx} ${bIn.y}, ${bIn.x} ${bIn.y}`;
}

export function SabflowDemo() {
    return (
        <section className="relative overflow-hidden py-32">
            <div className="mx-auto max-w-7xl px-6">
                <div className="grid items-center gap-14 lg:grid-cols-5">
                    <div className="order-2 lg:order-1 lg:col-span-2">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-violet-700">
                            SabFlow · visual automation
                        </p>
                        <h2 className="mt-4 text-balance text-4xl font-semibold tracking-tight text-zinc-950 sm:text-5xl">
                            Drag-drop the work your team keeps repeating.
                        </h2>
                        <p className="mt-5 text-pretty text-lg leading-relaxed text-zinc-600">
                            900+ integrations. Real branching. Per-item iteration. Retries, schedules, error
                            paths. The Zapier and n8n features you wish you had — without the per-task billing.
                        </p>

                        <ul className="mt-8 space-y-3 text-[15px] text-zinc-700">
                            {[
                                'Webhook + cron + manual triggers',
                                'IF / SWITCH / LOOP / WAIT nodes',
                                'Variables, paired-item lineage, expressions',
                                'Live debug with replay + step-through',
                                'Versions, snapshots, rollback',
                            ].map((t, i) => (
                                <m.li
                                    key={t}
                                    initial={{ opacity: 0, x: -10 }}
                                    whileInView={{ opacity: 1, x: 0 }}
                                    viewport={{ once: true }}
                                    transition={{ delay: i * 0.06 }}
                                    className="flex items-center gap-2.5"
                                >
                                    <span className="grid h-5 w-5 place-items-center rounded-full bg-violet-100 text-violet-700">
                                        <svg viewBox="0 0 12 12" className="h-3 w-3">
                                            <path d="M3 6l2 2 4-4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                                        </svg>
                                    </span>
                                    {t}
                                </m.li>
                            ))}
                        </ul>
                    </div>

                    {/* polished canvas */}
                    <div className="order-1 lg:order-2 lg:col-span-3">
                        <m.div
                            initial={{ opacity: 0, scale: 0.96 }}
                            whileInView={{ opacity: 1, scale: 1 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.6 }}
                            className="relative overflow-hidden rounded-2xl border border-zinc-900/10 bg-white shadow-2xl shadow-zinc-900/10 ring-1 ring-zinc-900/5"
                        >
                            {/* titlebar */}
                            <div className="flex items-center justify-between border-b border-zinc-200/70 bg-zinc-50/80 px-4 py-2.5">
                                <div className="flex items-center gap-3">
                                    <div className="flex gap-1.5">
                                        <span className="h-3 w-3 rounded-full bg-rose-400 ring-1 ring-rose-600/20" />
                                        <span className="h-3 w-3 rounded-full bg-amber-400 ring-1 ring-amber-600/20" />
                                        <span className="h-3 w-3 rounded-full bg-emerald-400 ring-1 ring-emerald-600/20" />
                                    </div>
                                    <span className="text-[11px] font-medium text-zinc-700">New customer welcome</span>
                                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700">Active</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <button className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2.5 py-1 text-[10px] font-medium text-white shadow-sm">
                                        <Play className="h-3 w-3 fill-white" /> Run
                                    </button>
                                    <button className="grid h-7 w-7 place-items-center rounded-md text-zinc-500 hover:bg-zinc-900/5">
                                        <Plus className="h-3.5 w-3.5" />
                                    </button>
                                    <button className="grid h-7 w-7 place-items-center rounded-md text-zinc-500 hover:bg-zinc-900/5">
                                        <Maximize2 className="h-3.5 w-3.5" />
                                    </button>
                                </div>
                            </div>

                            {/* canvas */}
                            <div className="relative h-[440px] bg-[#fafafa]">
                                <svg viewBox="0 0 700 440" className="absolute inset-0 h-full w-full">
                                    <defs>
                                        <pattern id="flowdot" width="22" height="22" patternUnits="userSpaceOnUse">
                                            <circle cx="1" cy="1" r="0.9" fill="#d4d4d8" />
                                        </pattern>
                                        <linearGradient id="flowline" x1="0" y1="0" x2="1" y2="0">
                                            <stop offset="0%" stopColor="#a855f7" />
                                            <stop offset="100%" stopColor="#f97316" />
                                        </linearGradient>
                                    </defs>
                                    <rect width="700" height="440" fill="url(#flowdot)" />

                                    {edges.map((e, i) => {
                                        const a = nodes.find((n) => n.id === e.from)!;
                                        const b = nodes.find((n) => n.id === e.to)!;
                                        const d = path(a, b);
                                        return (
                                            <g key={`${e.from}-${e.to}`}>
                                                <path d={d} stroke="#cbd5e1" strokeWidth="2" fill="none" strokeDasharray="4 4" />
                                                <path d={d} stroke="url(#flowline)" strokeWidth="2.5" fill="none" opacity="0.85" />
                                                <circle r="4.5" fill="#fbbf24" stroke="#fff" strokeWidth="1.5">
                                                    <animateMotion dur={`${2.4 + i * 0.3}s`} repeatCount="indefinite" path={d} />
                                                    <animate attributeName="opacity" values="0;1;1;0" dur={`${2.4 + i * 0.3}s`} repeatCount="indefinite" />
                                                </circle>
                                            </g>
                                        );
                                    })}
                                </svg>

                                {nodes.map((n, i) => {
                                    const Icon = n.icon;
                                    return (
                                        <m.div
                                            key={n.id}
                                            initial={{ opacity: 0, scale: 0.6 }}
                                            whileInView={{ opacity: 1, scale: 1 }}
                                            viewport={{ once: true }}
                                            transition={{ delay: 0.2 + i * 0.08, type: 'spring', bounce: 0.4 }}
                                            style={{
                                                position: 'absolute',
                                                left: `${(n.x / 700) * 100}%`,
                                                top: `${(n.y / 440) * 100}%`,
                                                transform: 'translate(-50%, -50%)',
                                            }}
                                        >
                                            <div className="relative">
                                                {/* port-in */}
                                                <span className="absolute -left-1 top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full bg-white shadow ring-1 ring-zinc-300" />
                                                {/* port-out */}
                                                <span className="absolute -right-1 top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full bg-white shadow ring-1 ring-zinc-300" />
                                                <div className="flex w-44 items-center gap-2.5 rounded-xl border border-zinc-200/80 bg-white p-2.5 shadow-md">
                                                    <span className="grid h-8 w-8 flex-shrink-0 place-items-center rounded-lg text-white" style={{ background: n.color }}>
                                                        <Icon className="h-4 w-4" />
                                                    </span>
                                                    <div className="overflow-hidden">
                                                        <div className="truncate text-[12px] font-semibold text-zinc-900">{n.label}</div>
                                                        <div className="truncate text-[10px] text-zinc-500">{n.sub}</div>
                                                    </div>
                                                </div>
                                            </div>
                                        </m.div>
                                    );
                                })}

                                {/* minimap */}
                                <div className="absolute bottom-3 right-3 h-16 w-24 overflow-hidden rounded-md border border-zinc-200 bg-white/90 backdrop-blur">
                                    <svg viewBox="0 0 700 440" className="h-full w-full">
                                        <rect width="700" height="440" fill="#fafafa" />
                                        {edges.map((e) => {
                                            const a = nodes.find((n) => n.id === e.from)!;
                                            const b = nodes.find((n) => n.id === e.to)!;
                                            return <path key={`m-${e.from}-${e.to}`} d={path(a, b)} stroke="#a855f7" strokeWidth="3" fill="none" opacity="0.6" />;
                                        })}
                                        {nodes.map((n) => (
                                            <circle key={`m-${n.id}`} cx={n.x + 40} cy={n.y} r="14" fill={n.color} />
                                        ))}
                                    </svg>
                                </div>

                                {/* zoom controls */}
                                <div className="absolute bottom-3 left-3 flex items-center gap-0.5 rounded-md border border-zinc-200 bg-white/90 p-0.5 text-[10px] font-medium text-zinc-600 backdrop-blur">
                                    <button className="px-2 py-1 hover:bg-zinc-100">−</button>
                                    <span className="px-1.5 py-1 text-zinc-700">100%</span>
                                    <button className="px-2 py-1 hover:bg-zinc-100">+</button>
                                </div>
                            </div>

                            {/* status bar */}
                            <div className="flex items-center justify-between border-t border-zinc-200/70 bg-zinc-50/80 px-4 py-2 text-[10px] text-zinc-500">
                                <span className="flex items-center gap-1.5">
                                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" /> Listening for events
                                </span>
                                <span>5 nodes · 4 edges · 0 errors</span>
                            </div>
                        </m.div>
                    </div>
                </div>
            </div>
        </section>
    );
}
