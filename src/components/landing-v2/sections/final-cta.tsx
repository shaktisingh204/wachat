'use client';

import Link from 'next/link';
import { m } from 'motion/react';
import { ArrowRight, Sparkles } from 'lucide-react';

export function FinalCta({ session }: { session?: { user?: unknown } | null }) {
    return (
        <section className="relative overflow-hidden py-32">
            <m.div
                aria-hidden
                animate={{ rotate: 360 }}
                transition={{ duration: 90, repeat: Infinity, ease: 'linear' }}
                className="pointer-events-none absolute left-1/2 top-1/2 h-[900px] w-[900px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-50 blur-3xl"
                style={{
                    background:
                        'conic-gradient(from 0deg, rgba(251,191,36,0.5), rgba(244,63,94,0.5), rgba(139,92,246,0.5), rgba(251,191,36,0.5))',
                }}
            />

            <div className="relative mx-auto max-w-3xl px-6 text-center">
                <m.span
                    initial={{ opacity: 0, y: 8 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="inline-flex items-center gap-2 rounded-full border border-zoru-line/10 bg-white/80 px-3 py-1 text-xs font-medium text-zoru-ink backdrop-blur"
                >
                    <Sparkles className="h-3.5 w-3.5 text-zoru-ink" />
                    14-day trial · no card needed
                </m.span>
                <m.h2
                    initial={{ opacity: 0, y: 12 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.08 }}
                    className="mt-6 text-balance text-5xl font-semibold tracking-tight text-zoru-ink sm:text-6xl"
                >
                    The last tool you&apos;ll ever onboard your team to.
                </m.h2>
                <m.p
                    initial={{ opacity: 0, y: 12 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.15 }}
                    className="mx-auto mt-5 max-w-xl text-pretty text-zoru-ink"
                >
                    Cancel ten subscriptions. Replace ten dashboards. Run the entire business from SabNode.
                </m.p>

                <m.div
                    initial={{ opacity: 0, y: 12 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.22 }}
                    className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row"
                >
                    <Link
                        href={session?.user ? '/dashboard' : '/login?signup=1'}
                        className="group relative inline-flex items-center gap-2 overflow-hidden rounded-full bg-zoru-ink px-7 py-3 text-sm font-semibold text-white shadow-2xl shadow-zoru-line/20 transition hover:scale-[1.04]"
                    >
                        <span className="relative z-10">
                            {session?.user ? 'Open your dashboard' : 'Start free →'}
                        </span>
                    </Link>
                    <Link
                        href="/contact"
                        className="inline-flex items-center gap-1.5 rounded-full border border-zoru-line/15 bg-white px-7 py-3 text-sm font-semibold text-zoru-ink transition hover:bg-zoru-surface-2"
                    >
                        Book a 20-min demo
                        <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
                    </Link>
                </m.div>
            </div>
        </section>
    );
}
