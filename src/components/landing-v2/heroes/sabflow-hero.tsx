'use client';

import { m } from 'motion/react';
import { Bot, Database, Filter, GitBranch, Mail, Webhook } from 'lucide-react';

interface Node {
    id: string;
    x: number;
    y: number;
    label: string;
    icon: typeof Webhook;
    color: string;
}

const nodes: Node[] = [
    { id: 'trigger', x: 8, y: 50, label: 'Webhook', icon: Webhook, color: '#a78bfa' },
    { id: 'filter', x: 32, y: 30, label: 'Filter', icon: Filter, color: '#c084fc' },
    { id: 'branch', x: 32, y: 70, label: 'IF', icon: GitBranch, color: '#c084fc' },
    { id: 'ai', x: 60, y: 30, label: 'AI Agent', icon: Bot, color: '#e879f9' },
    { id: 'db', x: 60, y: 70, label: 'Postgres', icon: Database, color: '#e879f9' },
    { id: 'email', x: 88, y: 50, label: 'Email', icon: Mail, color: '#f0abfc' },
];

const edges: [string, string][] = [
    ['trigger', 'filter'],
    ['trigger', 'branch'],
    ['filter', 'ai'],
    ['branch', 'db'],
    ['ai', 'email'],
    ['db', 'email'],
];

const nodeMap = Object.fromEntries(nodes.map((n) => [n.id, n]));

export function SabflowHero() {
    return (
        <div className="relative h-full w-full">
            <div aria-hidden className="absolute inset-0 rounded-3xl bg-violet-500/15 blur-3xl" />

            <m.div
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.6 }}
                className="relative h-full w-full overflow-hidden rounded-3xl border border-white/10 bg-[#0d0521]/80 shadow-[0_30px_80px_-20px_rgba(168,85,247,0.5)] backdrop-blur"
            >
                {/* dot grid */}
                <div
                    aria-hidden
                    className="absolute inset-0 opacity-30"
                    style={{
                        backgroundImage: 'radial-gradient(circle, rgba(168,85,247,0.5) 1px, transparent 1px)',
                        backgroundSize: '20px 20px',
                    }}
                />

                <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                    <defs>
                        <linearGradient id="wire" x1="0" x2="1" y1="0" y2="0">
                            <stop offset="0%" stopColor="#a78bfa" stopOpacity="0.2" />
                            <stop offset="100%" stopColor="#e879f9" stopOpacity="0.6" />
                        </linearGradient>
                    </defs>
                    {edges.map(([a, b], i) => {
                        const start = nodeMap[a];
                        const end = nodeMap[b];
                        const cx = (start.x + end.x) / 2;
                        const d = `M ${start.x} ${start.y} C ${cx} ${start.y}, ${cx} ${end.y}, ${end.x} ${end.y}`;
                        return (
                            <g key={`${a}-${b}`}>
                                <path d={d} stroke="url(#wire)" strokeWidth="0.4" fill="none" />
                                <m.circle
                                    r="0.9"
                                    fill="#f0abfc"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: [0, 1, 0] }}
                                    transition={{ duration: 2.4, delay: i * 0.4, repeat: Infinity, ease: 'easeInOut' }}
                                >
                                    <animateMotion dur="2.4s" repeatCount="indefinite" path={d} begin={`${i * 0.4}s`} />
                                </m.circle>
                            </g>
                        );
                    })}
                </svg>

                {nodes.map((n, i) => {
                    const Icon = n.icon;
                    return (
                        <m.div
                            key={n.id}
                            initial={{ opacity: 0, scale: 0.7 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: 0.2 + i * 0.08, type: 'spring' }}
                            className="absolute -translate-x-1/2 -translate-y-1/2"
                            style={{ left: `${n.x}%`, top: `${n.y}%` }}
                        >
                            <m.div
                                animate={{ y: [0, -3, 0] }}
                                transition={{ duration: 3 + i * 0.3, repeat: Infinity, ease: 'easeInOut' }}
                                className="flex items-center gap-2 rounded-xl border border-violet-300/30 bg-black/40 px-3 py-2 shadow-[0_10px_28px_-8px_rgba(168,85,247,0.6)] backdrop-blur-md"
                            >
                                <div
                                    className="grid h-7 w-7 place-items-center rounded-lg"
                                    style={{
                                        background: `linear-gradient(135deg, ${n.color}, ${n.color}aa)`,
                                    }}
                                >
                                    <Icon className="h-3.5 w-3.5 text-white" />
                                </div>
                                <span className="text-[11px] font-semibold text-white">{n.label}</span>
                            </m.div>
                        </m.div>
                    );
                })}

                {/* status pill */}
                <m.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 1.2 }}
                    className="absolute bottom-4 left-4 right-4 flex items-center justify-between rounded-xl border border-white/10 bg-black/40 px-4 py-2.5 text-[11px] backdrop-blur"
                >
                    <div className="flex items-center gap-2">
                        <m.span
                            animate={{ scale: [1, 1.4, 1] }}
                            transition={{ duration: 1.6, repeat: Infinity }}
                            className="h-2 w-2 rounded-full bg-violet-400 shadow-[0_0_10px_#a78bfa]"
                        />
                        <span className="font-semibold text-white">Flow running</span>
                    </div>
                    <span className="text-violet-200/70">
                        18,422 executions / day · 99.97% ok
                    </span>
                </m.div>
            </m.div>
        </div>
    );
}
