'use client';

import { m } from 'motion/react';
import type { ReactNode } from 'react';
import { LandingNav } from './landing-nav';
import { LandingFooter } from './landing-footer';

interface MarketingShellProps {
    session?: { user?: unknown } | null;
    children: ReactNode;
}

export function MarketingShell({ session, children }: MarketingShellProps) {
    return (
        <div className="relative min-h-screen overflow-x-clip bg-[#fafaf7] text-zinc-900 antialiased">
            <div
                aria-hidden
                className="pointer-events-none fixed inset-0 z-0"
                style={{
                    background:
                        'radial-gradient(ellipse 80% 50% at 50% -10%, rgba(139,92,246,0.08), transparent 60%), radial-gradient(ellipse 80% 50% at 50% 110%, rgba(244,63,94,0.06), transparent 60%)',
                }}
            />
            <LandingNav session={session} />
            <main className="relative z-10">{children}</main>
            <LandingFooter />
        </div>
    );
}

export function PageHero({
    kicker,
    title,
    subtitle,
    extra,
}: {
    kicker: string;
    title: ReactNode;
    subtitle: string;
    extra?: ReactNode;
}) {
    return (
        <section className="relative px-6 pt-32 pb-16 md:pt-40">
            <div className="mx-auto max-w-5xl text-center">
                <m.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                    className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-600 backdrop-blur"
                >
                    {kicker}
                </m.div>
                <m.h1
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.05 }}
                    className="mt-6 text-balance text-5xl font-semibold tracking-tight text-zinc-950 md:text-7xl"
                >
                    {title}
                </m.h1>
                <m.p
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.1 }}
                    className="mx-auto mt-6 max-w-2xl text-pretty text-lg leading-relaxed text-zinc-600"
                >
                    {subtitle}
                </m.p>
                {extra && (
                    <m.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4, delay: 0.2 }}
                        className="mt-10"
                    >
                        {extra}
                    </m.div>
                )}
            </div>
        </section>
    );
}

export function SectionWrap({
    children,
    bg,
    id,
}: {
    children: ReactNode;
    bg?: 'white' | 'transparent';
    id?: string;
}) {
    return (
        <section id={id} className={`relative px-6 py-24 ${bg === 'white' ? 'bg-white' : ''}`}>
            <div className="mx-auto max-w-7xl">{children}</div>
        </section>
    );
}
