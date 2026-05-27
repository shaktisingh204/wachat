'use client';

import { m, useAnimationFrame, useMotionValue } from 'motion/react';
import { useRef } from 'react';
import { Quote, Star } from 'lucide-react';

const quotes = [
    {
        body: 'We replaced Intercom, Chatwoot, Zoho, and Mailchimp with one SabNode tenant. Saved 70% and our agents stopped tab-switching.',
        name: 'Priya Menon',
        role: 'Head of CX, Lumen Living',
        avatarColor: 'from-zoru-surface-2 to-zoru-ink',
    },
    {
        body: 'The omnichannel inbox alone paid for the year. WhatsApp + Instagram + email in one window, with AI drafting replies in our tone.',
        name: 'Tunde Bakare',
        role: 'COO, North & Co',
        avatarColor: 'from-zoru-surface-2 to-zoru-ink',
    },
    {
        body: 'SabFlow is what we always wished Zapier was. 900 integrations, real branching, real reporting. We automated the back-office in a weekend.',
        name: 'Sara Lindqvist',
        role: 'Founder, Cirrus Studio',
        avatarColor: 'from-zoru-surface-2 to-zoru-ink',
    },
    {
        body: 'Onboarding to SabChat took an afternoon. Two weeks later first-response time dropped from 14m to 2m and CSAT jumped to 4.8.',
        name: 'Marco Bellini',
        role: 'Support Lead, Prisma Mobility',
        avatarColor: 'from-zoru-surface-2 to-zoru-ink',
    },
];

export function Testimonials() {
    const x = useMotionValue(0);
    const wrapRef = useRef<HTMLDivElement>(null);

    useAnimationFrame((_t, delta) => {
        const speed = 0.04;
        const next = x.get() - delta * speed;
        const inner = wrapRef.current?.firstChild as HTMLElement | undefined;
        const w = inner ? inner.scrollWidth / 2 : 0;
        if (w && Math.abs(next) >= w) {
            x.set(0);
        } else {
            x.set(next);
        }
    });

    const doubled = [...quotes, ...quotes];

    return (
        <section id="proof" className="relative overflow-hidden py-32">
            <div className="mx-auto max-w-7xl px-6">
                <m.div
                    initial={{ opacity: 0, y: 12 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="mx-auto max-w-3xl text-center"
                >
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zoru-ink">
                        Customer love
                    </p>
                    <h2 className="mt-4 text-balance text-4xl font-semibold tracking-tight text-zoru-ink sm:text-5xl md:text-6xl">
                        Teams that switched, don&apos;t look back.
                    </h2>
                </m.div>
            </div>

            <div
                ref={wrapRef}
                className="mt-16 overflow-hidden"
                style={{
                    maskImage: 'linear-gradient(to right, transparent, black 8%, black 92%, transparent)',
                    WebkitMaskImage: 'linear-gradient(to right, transparent, black 8%, black 92%, transparent)',
                }}
            >
                <m.div className="flex gap-16 px-6" style={{ x }}>
                    {doubled.map((q, i) => (
                        <figure key={i} className="flex w-[460px] flex-shrink-0 flex-col">
                            <Quote className="h-7 w-7 text-zoru-ink/70" />
                            <blockquote className="mt-4 text-lg leading-relaxed text-zoru-ink">
                                {q.body}
                            </blockquote>
                            <figcaption className="mt-6 flex items-center gap-3">
                                <div className={`grid h-11 w-11 place-items-center rounded-full bg-gradient-to-br ${q.avatarColor} font-semibold text-white`}>
                                    {q.name.split(' ').map((s) => s[0]).join('').slice(0, 2)}
                                </div>
                                <div>
                                    <div className="text-sm font-medium text-zoru-ink">{q.name}</div>
                                    <div className="text-xs text-zoru-ink">{q.role}</div>
                                </div>
                                <div className="ml-auto flex items-center gap-0.5">
                                    {[0, 1, 2, 3, 4].map((s) => (
                                        <Star key={s} className="h-3 w-3 fill-zoru-ink-muted text-zoru-ink-muted" />
                                    ))}
                                </div>
                            </figcaption>
                        </figure>
                    ))}
                </m.div>
            </div>
        </section>
    );
}
