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
        <section className="relative overflow-hidden bg-gradient-to-b from-rose-50/30 via-white to-white py-32">
            <div className="mx-auto max-w-7xl px-6">
                <div className="grid items-center gap-14 lg:grid-cols-2">
                    <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-rose-700">
                            SEO · growth surface
                        </p>
                        <h2 className="mt-4 text-balance text-4xl font-semibold tracking-tight text-zinc-950 sm:text-5xl">
                            Pages, schema, links — all measured live.
                        </h2>
                        <p className="mt-5 text-pretty text-lg leading-relaxed text-zinc-600">
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
                                    <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">{s.k}</div>
                                    <div className="mt-1 text-2xl font-semibold text-zinc-900">{s.v}</div>
                                    <div className="text-[11px] font-medium text-emerald-600">{s.up}</div>
                                </m.div>
                            ))}
                        </div>
                    </div>

                    <m.div
                        initial={{ opacity: 0, scale: 0.97 }}
                        whileInView={{ opacity: 1, scale: 1 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.6 }}
                        className="overflow-hidden rounded-2xl border border-zinc-900/10 bg-white shadow-2xl shadow-zinc-900/10 ring-1 ring-zinc-900/5"
                    >
                        <div className="flex items-center justify-between border-b border-zinc-200/70 bg-zinc-50/80 px-4 py-2.5">
                            <div className="flex items-center gap-3">
                                <div className="flex gap-1.5">
                                    <span className="h-3 w-3 rounded-full bg-rose-400 ring-1 ring-rose-600/20" />
                                    <span className="h-3 w-3 rounded-full bg-amber-400 ring-1 ring-amber-600/20" />
                                    <span className="h-3 w-3 rounded-full bg-emerald-400 ring-1 ring-emerald-600/20" />
                                </div>
                                <span className="text-[11px] font-medium text-zinc-700">Organic Traffic · 30d</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <button className="rounded-md bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-700">30d</button>
                                <button className="rounded-md px-2 py-0.5 text-[10px] font-medium text-zinc-500">90d</button>
                                <button className="rounded-md px-2 py-0.5 text-[10px] font-medium text-zinc-500">1y</button>
                                <MoreHorizontal className="h-3.5 w-3.5 text-zinc-400" />
                            </div>
                        </div>

                        <div className="p-5">
                            <div className="flex items-end justify-between">
                                <div>
                                    <div className="text-xs font-medium text-zinc-500">Organic visitors</div>
                                    <div className="mt-1 flex items-baseline gap-2">
                                        <span className="text-3xl font-semibold text-zinc-900">12,840</span>
                                        <span className="rounded-md bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">▲ 38.2%</span>
                                    </div>
                                </div>
                                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-100 text-rose-700">
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

                            <div className="mt-2 flex items-center justify-between text-[10px] text-zinc-500">
                                <span className="flex items-center gap-3">
                                    <span className="flex items-center gap-1"><span className="h-0.5 w-3 bg-rose-500" /> This period</span>
                                    <span className="flex items-center gap-1"><span className="h-0.5 w-3 bg-zinc-400" style={{ backgroundImage: 'repeating-linear-gradient(90deg, #a1a1aa 0 2px, transparent 2px 4px)' }} /> Previous</span>
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
                                        className="flex items-center justify-between rounded-lg bg-zinc-50/60 px-3 py-2"
                                    >
                                        <div className="flex items-center gap-2 text-[11px]">
                                            <MousePointer2 className="h-3 w-3 text-zinc-400" />
                                            <span className="font-medium text-zinc-800">{k.kw}</span>
                                        </div>
                                        <div className="flex items-center gap-3 text-[11px] tabular-nums">
                                            <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-700">#{k.pos}</span>
                                            <span className="text-zinc-500">{k.vol}/mo</span>
                                            <span className="text-emerald-600 font-medium">{k.delta}</span>
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
