'use client';

import { m } from 'motion/react';

const stages = [
    {
        name: 'Lead',
        color: 'from-sky-400 to-sky-600',
        deals: [
            { name: 'Acme Corp', value: '₹1.2L', heat: 'cold' },
            { name: 'Stark Industries', value: '₹4.0L', heat: 'warm' },
        ],
    },
    {
        name: 'Qualified',
        color: 'from-cyan-400 to-cyan-600',
        deals: [
            { name: 'Wayne Co.', value: '₹2.8L', heat: 'warm' },
            { name: 'Daily Planet', value: '₹85k', heat: 'cold' },
        ],
    },
    {
        name: 'Quote',
        color: 'from-blue-400 to-blue-600',
        deals: [
            { name: 'Globex', value: '₹6.5L', heat: 'hot' },
        ],
    },
    {
        name: 'Won',
        color: 'from-indigo-400 to-indigo-600',
        deals: [
            { name: 'Soylent Inc.', value: '₹3.4L', heat: 'hot' },
            { name: 'Initech', value: '₹1.1L', heat: 'hot' },
        ],
    },
];

const heatColors: Record<string, string> = {
    cold: 'bg-sky-400/20 text-sky-200',
    warm: 'bg-amber-400/20 text-amber-200',
    hot: 'bg-rose-400/20 text-rose-200',
};

export function CrmHero() {
    return (
        <div className="relative h-full w-full">
            <div aria-hidden className="absolute inset-0 rounded-3xl bg-sky-500/15 blur-3xl" />

            <m.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="relative h-full w-full overflow-hidden rounded-3xl border border-white/10 bg-[#031023]/80 p-4 shadow-[0_30px_80px_-20px_rgba(56,189,248,0.5)] backdrop-blur"
            >
                <div className="mb-3 flex items-center justify-between">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-sky-200/70">Pipeline · Q3</p>
                    <p className="text-[11px] text-white/60">
                        <span className="font-semibold text-sky-200">₹19.95L</span> · 8 deals
                    </p>
                </div>

                <div className="grid h-[calc(100%-2rem)] grid-cols-4 gap-2">
                    {stages.map((s, si) => (
                        <m.div
                            key={s.name}
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.15 + si * 0.08 }}
                            className="flex flex-col rounded-2xl border border-white/5 bg-black/30 p-2"
                        >
                            <div className="mb-2 flex items-center justify-between px-1">
                                <span className={`bg-gradient-to-r ${s.color} bg-clip-text text-[10px] font-semibold uppercase tracking-wider text-transparent`}>
                                    {s.name}
                                </span>
                                <span className="text-[10px] text-white/40">{s.deals.length}</span>
                            </div>
                            <div className="flex flex-col gap-2">
                                {s.deals.map((d, di) => (
                                    <m.div
                                        key={d.name}
                                        initial={{ opacity: 0, scale: 0.94, y: 6 }}
                                        animate={{ opacity: 1, scale: 1, y: 0 }}
                                        transition={{ delay: 0.3 + si * 0.08 + di * 0.05 }}
                                        whileHover={{ y: -3 }}
                                        className="rounded-xl border border-white/5 bg-gradient-to-br from-white/[0.06] to-transparent p-2.5"
                                    >
                                        <p className="truncate text-[11px] font-semibold text-white">{d.name}</p>
                                        <div className="mt-1.5 flex items-center justify-between">
                                            <span className="text-[10px] text-sky-100/70">{d.value}</span>
                                            <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase ${heatColors[d.heat]}`}>
                                                {d.heat}
                                            </span>
                                        </div>
                                        {/* progress bar */}
                                        <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/5">
                                            <m.div
                                                initial={{ width: 0 }}
                                                animate={{ width: `${30 + si * 20 + di * 5}%` }}
                                                transition={{ delay: 0.6 + si * 0.08 + di * 0.05, duration: 0.6 }}
                                                className={`h-full rounded-full bg-gradient-to-r ${s.color}`}
                                            />
                                        </div>
                                    </m.div>
                                ))}
                            </div>
                        </m.div>
                    ))}
                </div>

                {/* floating deal */}
                <m.div
                    initial={{ opacity: 0, x: -40, y: -20 }}
                    animate={{ opacity: [0, 1, 1, 0], x: [-40, 0, 120, 200], y: [-20, 60, 60, 60] }}
                    transition={{ duration: 3.4, repeat: Infinity, repeatDelay: 1, ease: 'easeInOut' }}
                    className="pointer-events-none absolute left-4 top-12 rounded-xl border border-sky-300/40 bg-sky-500/20 px-2.5 py-1.5 text-[10px] font-semibold text-sky-100 backdrop-blur"
                >
                    Lead → Qualified
                </m.div>
            </m.div>
        </div>
    );
}
