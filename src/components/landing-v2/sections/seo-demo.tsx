'use client';

import { m, useInView } from 'motion/react';
import { useRef } from 'react';
import { Globe2, TrendingUp, MousePointer2, MoreHorizontal } from 'lucide-react';

const visitors = [120, 145, 138, 180, 220, 200, 260, 240, 310, 290, 340, 380, 360, 420, 450, 510, 480, 540, 600, 580, 650, 720, 690, 780, 820, 880, 950, 1010, 1090, 1180];
const visitorsPrev = visitors.map((v) => v * 0.62 + Math.sin(v) * 20);
const maxV = Math.max(...visitors);

export function SeoDemo() {
    const ref = useRef<SVGSVGElement>(null);
    const inView = useInView(ref, { once: true, margin: '-15%' });

    const series = (arr: number[]) =>
        arr
            .map((v, i) => {
                const x = (i / (arr.length - 1)) * 100;
                const y = 100 - (v / maxV) * 90;
                return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
            })
            .join(' ');

    const pathD = series(visitors);
    const prevD = series(visitorsPrev);
    const areaD = `${pathD} L 100 100 L 0 100 Z`;

    return (
        <section className="relative overflow-hidden bg-gradient-to-b from-zoru-surface-2/30 via-white to-white py-32">
            <div className="mx-auto max-w-7xl px-6">
                <div className="grid items-center gap-14 lg:grid-cols-2">
                    <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zoru-ink">
                            SEO · growth surface
                        </p>
                        <h2 className="mt-4 text-balance text-4xl font-semibold tracking-tight text-zoru-ink sm:text-5xl">
                            Pages, schema, links — all measured live.
                        </h2>
                        <p className="mt-5 text-pretty text-lg leading-relaxed text-zoru-ink">
                            Landing-page builder, sitemap + schema generator, short-link tracker, A/B tests,
                            keyword board, and traffic dashboards. Build the funnel and watch it convert.
                        </p>

                        <div className="mt-10 grid grid-cols-3 gap-x-8 gap-y-2">
                            {[
                                { k: 'Visitors / mo', v: '128k', up: '+38%' },
                                { k: 'Conversion', v: '4.2%', up: '+0.9pp' },
                                { k: 'Avg position', v: '6.3', up: '↑ 4.1' },
                            ].map((s, i) => (
                                <m.div
                                    key={s.k}
                                    initial={{ opacity: 0, y: 8 }}
                                    whileInView={{ opacity: 1, y: 0 }}
                                    viewport={{ once: true }}
                                    transition={{ delay: i * 0.06 }}
                                >
                                    <div className="text-[10px] font-semibold uppercase tracking-wider text-zoru-ink">{s.k}</div>
                                    <div className="mt-1 text-2xl font-semibold text-zoru-ink">{s.v}</div>
                                    <div className="text-[11px] font-medium text-zoru-ink">{s.up}</div>
                                </m.div>
                            ))}
                        </div>
                    </div>

                    <m.div
                        initial={{ opacity: 0, scale: 0.97 }}
                        whileInView={{ opacity: 1, scale: 1 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.6 }}
                        className="overflow-hidden rounded-2xl border border-zoru-line/10 bg-white shadow-2xl shadow-zoru-line/10 ring-1 ring-zoru-line/5"
                    >
                        <div className="flex items-center justify-between border-b border-zoru-line/70 bg-zoru-surface-2/80 px-4 py-2.5">
                            <div className="flex items-center gap-3">
                                <div className="flex gap-1.5">
                                    <span className="h-3 w-3 rounded-full bg-zoru-surface-2 ring-1 ring-zoru-line/20" />
                                    <span className="h-3 w-3 rounded-full bg-zoru-surface-2 ring-1 ring-zoru-line/20" />
                                    <span className="h-3 w-3 rounded-full bg-zoru-surface-2 ring-1 ring-zoru-line/20" />
                                </div>
                                <span className="text-[11px] font-medium text-zoru-ink">Organic Traffic · 30d</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <button className="rounded-md bg-zoru-surface-2 px-2 py-0.5 text-[10px] font-medium text-zoru-ink">30d</button>
                                <button className="rounded-md px-2 py-0.5 text-[10px] font-medium text-zoru-ink">90d</button>
                                <button className="rounded-md px-2 py-0.5 text-[10px] font-medium text-zoru-ink">1y</button>
                                <MoreHorizontal className="h-3.5 w-3.5 text-zoru-ink-muted" />
                            </div>
                        </div>

                        <div className="p-5">
                            <div className="flex items-end justify-between">
                                <div>
                                    <div className="text-xs font-medium text-zoru-ink">Organic visitors</div>
                                    <div className="mt-1 flex items-baseline gap-2">
                                        <span className="text-3xl font-semibold text-zoru-ink">12,840</span>
                                        <span className="rounded-md bg-zoru-surface-2 px-1.5 py-0.5 text-[10px] font-semibold text-zoru-ink">▲ 38.2%</span>
                                    </div>
                                </div>
                                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-zoru-surface-2 text-zoru-ink">
                                    <TrendingUp className="h-4 w-4" />
                                </div>
                            </div>

                            <div className="relative mt-6 h-52">
                                <svg ref={ref} viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
                                    <defs>
                                        <linearGradient id="seoFill" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.32" />
                                            <stop offset="100%" stopColor="#f43f5e" stopOpacity="0" />
                                        </linearGradient>
                                    </defs>
                                    {/* grid lines */}
                                    {[20, 40, 60, 80].map((y) => (
                                        <line key={y} x1="0" x2="100" y1={y} y2={y} stroke="#e4e4e7" strokeWidth="0.2" strokeDasharray="0.6 0.6" />
                                    ))}
                                    {/* previous period (faded) */}
                                    <path d={prevD} fill="none" stroke="#a1a1aa" strokeWidth="0.8" strokeDasharray="1.4 1.2" vectorEffect="non-scaling-stroke" opacity="0.7" />
                                    {/* area */}
                                    <m.path
                                        d={areaD}
                                        fill="url(#seoFill)"
                                        initial={{ opacity: 0 }}
                                        animate={inView ? { opacity: 1 } : {}}
                                        transition={{ duration: 1.2, delay: 0.4 }}
                                    />
                                    {/* current line */}
                                    <m.path
                                        d={pathD}
                                        fill="none"
                                        stroke="#f43f5e"
                                        strokeWidth="1.4"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        vectorEffect="non-scaling-stroke"
                                        initial={{ pathLength: 0 }}
                                        animate={inView ? { pathLength: 1 } : {}}
                                        transition={{ duration: 1.6, ease: 'easeOut' }}
                                    />
                                </svg>
                            </div>

                            <div className="mt-2 flex items-center justify-between text-[10px] text-zoru-ink">
                                <span className="flex items-center gap-3">
                                    <span className="flex items-center gap-1"><span className="h-0.5 w-3 bg-zoru-ink" /> This period</span>
                                    <span className="flex items-center gap-1"><span className="h-0.5 w-3 bg-zoru-surface-2" style={{ backgroundImage: 'repeating-linear-gradient(90deg, #a1a1aa 0 2px, transparent 2px 4px)' }} /> Previous</span>
                                </span>
                                <span>Day 30 →</span>
                            </div>

                            <div className="mt-6 space-y-1.5">
                                {[
                                    { kw: 'whatsapp crm', pos: 3, vol: '12k', delta: '↑ 4' },
                                    { kw: 'live chat for ecommerce', pos: 5, vol: '8.4k', delta: '↑ 2' },
                                    { kw: 'omnichannel inbox', pos: 8, vol: '3.2k', delta: '↑ 7' },
                                ].map((k, i) => (
                                    <m.div
                                        key={k.kw}
                                        initial={{ opacity: 0, x: -10 }}
                                        whileInView={{ opacity: 1, x: 0 }}
                                        viewport={{ once: true }}
                                        transition={{ delay: 0.8 + i * 0.1 }}
                                        className="flex items-center justify-between rounded-lg bg-zoru-surface-2/60 px-3 py-2"
                                    >
                                        <div className="flex items-center gap-2 text-[11px]">
                                            <MousePointer2 className="h-3 w-3 text-zoru-ink-muted" />
                                            <span className="font-medium text-zoru-ink">{k.kw}</span>
                                        </div>
                                        <div className="flex items-center gap-3 text-[11px] tabular-nums">
                                            <span className="rounded-full bg-zoru-surface-2 px-1.5 py-0.5 text-[9px] font-semibold text-zoru-ink">#{k.pos}</span>
                                            <span className="text-zoru-ink">{k.vol}/mo</span>
                                            <span className="text-zoru-ink font-medium">{k.delta}</span>
                                        </div>
                                    </m.div>
                                ))}
                            </div>
                        </div>
                    </m.div>
                </div>
            </div>
        </section>
    );
}
