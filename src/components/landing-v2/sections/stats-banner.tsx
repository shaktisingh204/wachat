'use client';

import { m } from 'motion/react';

const points = [
    { big: '70%', small: 'lower software bill on average' },
    { big: '12×', small: 'faster first-response on chat' },
    { big: '4.8', small: 'CSAT across 4,800+ workspaces' },
    { big: '5 min', small: 'from signup to first reply' },
];

export function StatsBanner() {
    return (
        <section className="relative overflow-hidden py-28">
            <div
                aria-hidden
                className="pointer-events-none absolute inset-0"
                style={{
                    background:
                        'radial-gradient(ellipse 70% 50% at 50% 50%, rgba(251,191,36,0.10), transparent 60%)',
                }}
            />
            <div className="relative mx-auto max-w-7xl px-6">
                <m.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="grid gap-8 md:grid-cols-4"
                >
                    {points.map((p, i) => (
                        <m.div
                            key={p.big}
                            initial={{ opacity: 0, y: 14 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: i * 0.08 }}
                            className="text-center"
                        >
                            <div className="bg-gradient-to-br from-zoru-ink via-zoru-ink to-zoru-ink bg-clip-text text-6xl font-semibold tracking-tight text-transparent sm:text-7xl"
                                style={{ WebkitTextFillColor: 'transparent' }}
                            >
                                {p.big}
                            </div>
                            <div className="mt-2 text-sm text-zoru-ink">{p.small}</div>
                        </m.div>
                    ))}
                </m.div>
            </div>
        </section>
    );
}
