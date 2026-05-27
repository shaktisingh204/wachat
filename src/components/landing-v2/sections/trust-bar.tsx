'use client';

import { m, useInView, useMotionValue, useTransform, animate } from 'motion/react';
import { useEffect, useRef } from 'react';

const logos = ['LUMEN', 'NORTH/CO', 'CIRRUS', 'PRISMA', 'OBELISK', 'FIELDWORK'];

const stats = [
    { value: 4812, suffix: '+', label: 'Active workspaces' },
    { value: 2.4, suffix: 'B', label: 'Messages routed', decimals: 1 },
    { value: 99.99, suffix: '%', label: 'Uptime SLA', decimals: 2 },
    { value: 60, suffix: '+', label: 'Countries' },
];

function Counter({ to, suffix, decimals = 0 }: { to: number; suffix: string; decimals?: number }) {
    const ref = useRef<HTMLSpanElement>(null);
    const inView = useInView(ref, { once: true, margin: '-20%' });
    const mv = useMotionValue(0);
    const rounded = useTransform(mv, (v) => v.toFixed(decimals));

    useEffect(() => {
        if (!inView) return;
        const ctrl = animate(mv, to, { duration: 1.6, ease: 'easeOut' });
        return ctrl.stop;
    }, [inView, mv, to]);

    return (
        <span ref={ref} className="tabular-nums">
            <m.span>{rounded}</m.span>
            <span>{suffix}</span>
        </span>
    );
}

export function TrustBar() {
    return (
        <section className="relative border-y border-zoru-line/70 bg-white/60 py-14 backdrop-blur">
            <div className="mx-auto max-w-7xl px-6">
                <m.p
                    initial={{ opacity: 0, y: 8 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5 }}
                    className="mb-8 text-center text-[11px] font-medium uppercase tracking-[0.2em] text-zoru-ink"
                >
                    Trusted by ambitious teams in 60+ countries
                </m.p>

                <div className="grid grid-cols-3 items-center gap-6 sm:grid-cols-6">
                    {logos.map((l, i) => (
                        <m.div
                            key={l}
                            initial={{ opacity: 0, y: 8 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: i * 0.05 }}
                            className="text-center text-sm font-bold tracking-widest text-zoru-ink-muted"
                        >
                            {l}
                        </m.div>
                    ))}
                </div>

                <div className="mt-14 grid grid-cols-2 gap-6 sm:grid-cols-4">
                    {stats.map((s, i) => (
                        <m.div
                            key={s.label}
                            initial={{ opacity: 0, y: 12 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: i * 0.08 }}
                            className="rounded-2xl border border-zoru-line/70 bg-white p-5 shadow-sm"
                        >
                            <div className="text-3xl font-semibold tracking-tight text-zoru-ink sm:text-4xl">
                                <Counter to={s.value} suffix={s.suffix} decimals={s.decimals ?? 0} />
                            </div>
                            <div className="mt-1.5 text-xs text-zoru-ink">{s.label}</div>
                        </m.div>
                    ))}
                </div>
            </div>
        </section>
    );
}
