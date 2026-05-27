'use client';

import { m } from 'motion/react';
import { Gauge, Globe2, Link as LinkIcon, TrendingUp } from 'lucide-react';

const metrics = [
    { label: 'Performance', value: 98, color: '#fb7185' },
    { label: 'Accessibility', value: 100, color: '#f472b6' },
    { label: 'Best Practices', value: 96, color: '#fda4af' },
    { label: 'SEO', value: 100, color: '#e879f9' },
];

const chartPoints = [10, 28, 22, 48, 40, 70, 62, 92, 86, 110];

export function SeoHero() {
    return (
        <div className="relative h-full w-full">
            <div aria-hidden className="absolute inset-0 rounded-3xl bg-zoru-ink/15 blur-3xl" />

            <m.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="relative h-full w-full overflow-hidden rounded-3xl border border-white/10 bg-zoru-ink/80 p-5 shadow-[0_30px_80px_-20px_rgba(244,63,94,0.5)] backdrop-blur"
            >
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-zoru-surface-2 to-zoru-ink">
                            <Globe2 className="h-4 w-4 text-white" />
                        </div>
                        <div>
                            <p className="text-[12px] font-semibold text-white">sabnode.in/launch</p>
                            <p className="text-[10px] text-white/70">Lighthouse · mobile</p>
                        </div>
                    </div>
                    <span className="rounded-full bg-zoru-ink/20 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-white">
                        Live
                    </span>
                </div>

                {/* lighthouse gauges */}
                <div className="mt-5 grid grid-cols-4 gap-3">
                    {metrics.map((m2, i) => (
                        <Gauges key={m2.label} {...m2} delay={0.2 + i * 0.08} />
                    ))}
                </div>

                {/* organic traffic chart */}
                <div className="mt-5 rounded-2xl border border-white/5 bg-black/30 p-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-[11px] uppercase tracking-wider text-white/50">Organic traffic</p>
                            <p className="mt-0.5 text-lg font-semibold text-white">
                                32,418 <span className="text-[11px] font-medium text-zoru-ink-muted">+184%</span>
                            </p>
                        </div>
                        <TrendingUp className="h-4 w-4 text-zoru-ink-muted" />
                    </div>
                    <svg viewBox="0 0 220 60" className="mt-3 h-16 w-full">
                        <defs>
                            <linearGradient id="fill" x1="0" x2="0" y1="0" y2="1">
                                <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.55" />
                                <stop offset="100%" stopColor="#f43f5e" stopOpacity="0" />
                            </linearGradient>
                        </defs>
                        <m.path
                            initial={{ pathLength: 0 }}
                            animate={{ pathLength: 1 }}
                            transition={{ duration: 1.2, delay: 0.6 }}
                            d={pathFrom(chartPoints)}
                            stroke="#fb7185"
                            strokeWidth="1.6"
                            fill="none"
                        />
                        <m.path
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ duration: 0.6, delay: 1.4 }}
                            d={areaFrom(chartPoints)}
                            fill="url(#fill)"
                        />
                    </svg>
                </div>

                {/* link chips */}
                <div className="mt-4 flex flex-wrap items-center gap-2">
                    {[
                        { label: 'sab.link/spring', icon: LinkIcon, n: '8.2k' },
                        { label: 'sab.link/wabademo', icon: LinkIcon, n: '5.7k' },
                        { label: 'A/B · v2 winner', icon: Gauge, n: '+22%' },
                    ].map((c, i) => {
                        const CIcon = c.icon;
                        return (
                            <m.div
                                key={c.label}
                                initial={{ opacity: 0, y: 6 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 1.0 + i * 0.1 }}
                                className="flex items-center gap-1.5 rounded-full border border-zoru-line/30 bg-zoru-ink/10 px-2.5 py-1 text-[10px] font-semibold text-white"
                            >
                                <CIcon className="h-3 w-3" />
                                {c.label}
                                <span className="ml-1 text-white/70">{c.n}</span>
                            </m.div>
                        );
                    })}
                </div>
            </m.div>
        </div>
    );
}

function Gauges({ value, label, color, delay }: { value: number; label: string; color: string; delay: number }) {
    const r = 22;
    const c = 2 * Math.PI * r;
    return (
        <div className="flex flex-col items-center">
            <svg viewBox="0 0 60 60" className="h-16 w-16 -rotate-90">
                <circle cx="30" cy="30" r={r} stroke="rgba(255,255,255,0.08)" strokeWidth="4" fill="none" />
                <m.circle
                    cx="30"
                    cy="30"
                    r={r}
                    stroke={color}
                    strokeWidth="4"
                    fill="none"
                    strokeLinecap="round"
                    strokeDasharray={c}
                    initial={{ strokeDashoffset: c }}
                    animate={{ strokeDashoffset: c * (1 - value / 100) }}
                    transition={{ delay, duration: 1, ease: 'easeOut' }}
                />
            </svg>
            <m.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: delay + 0.3 }}
                className="-mt-11 text-base font-semibold text-white"
            >
                {value}
            </m.p>
            <p className="mt-5 text-[10px] uppercase tracking-wider text-white/50">{label}</p>
        </div>
    );
}

function pathFrom(pts: number[]) {
    const max = Math.max(...pts);
    const step = 220 / (pts.length - 1);
    return pts
        .map((v, i) => `${i === 0 ? 'M' : 'L'} ${i * step} ${60 - (v / max) * 50}`)
        .join(' ');
}

function areaFrom(pts: number[]) {
    return `${pathFrom(pts)} L 220 60 L 0 60 Z`;
}
