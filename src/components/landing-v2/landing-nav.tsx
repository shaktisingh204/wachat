'use client';

import Link from 'next/link';
import { m, useScroll, useTransform } from 'motion/react';
import { useEffect, useState } from 'react';
import { ArrowRight, ChevronDown, Menu, X } from 'lucide-react';
import { MegaMenu } from './mega-menu';

const links = [
    { label: 'How it works', href: '#how' },
    { label: 'Pricing', href: '#pricing' },
    { label: 'Customers', href: '#proof' },
];

export function LandingNav({ session }: { session?: { user?: unknown } | null }) {
    const { scrollY } = useScroll();
    const bg = useTransform(scrollY, [0, 80], ['rgba(255,255,255,0)', 'rgba(255,255,255,0.78)']);
    const blur = useTransform(scrollY, [0, 80], ['blur(0px)', 'blur(18px)']);
    const border = useTransform(scrollY, [0, 80], ['rgba(24,24,27,0)', 'rgba(24,24,27,0.08)']);
    const [mobileOpen, setMobileOpen] = useState(false);
    const [megaOpen, setMegaOpen] = useState(false);

    useEffect(() => {
        document.body.style.overflow = mobileOpen ? 'hidden' : '';
        return () => {
            document.body.style.overflow = '';
        };
    }, [mobileOpen]);

    return (
        <>
            <m.header
                style={{ background: bg, backdropFilter: blur, WebkitBackdropFilter: blur, borderBottom: '1px solid', borderBottomColor: border }}
                className="fixed inset-x-0 top-0 z-50"
            >
                <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
                    <Link href="/" className="group flex items-center gap-2">
                        <m.div
                            initial={{ rotate: 0 }}
                            whileHover={{ rotate: 90, scale: 1.1 }}
                            transition={{ type: 'spring', stiffness: 200, damping: 12 }}
                            className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-zoru-surface-2 via-zoru-ink to-zoru-ink shadow-lg shadow-zoru-line/30"
                        >
                            <span className="text-sm font-black text-white">S</span>
                        </m.div>
                        <span className="text-lg font-semibold tracking-tight text-zoru-ink">SabNode</span>
                    </Link>

                    <div className="hidden items-center gap-1 md:flex">
                        <button
                            type="button"
                            onMouseEnter={() => setMegaOpen(true)}
                            onClick={() => setMegaOpen((v) => !v)}
                            aria-expanded={megaOpen}
                            aria-haspopup="true"
                            className="relative inline-flex items-center gap-1 rounded-full px-4 py-1.5 text-sm font-medium text-zoru-ink transition hover:text-zoru-ink"
                        >
                            <span>Products</span>
                            <ChevronDown
                                className={`h-3.5 w-3.5 transition ${megaOpen ? 'rotate-180' : 'rotate-0'}`}
                            />
                        </button>
                        {links.map((l) => (
                            <Link
                                key={l.href}
                                href={l.href}
                                className="relative rounded-full px-4 py-1.5 text-sm font-medium text-zoru-ink transition hover:text-zoru-ink"
                            >
                                <span className="relative z-10">{l.label}</span>
                            </Link>
                        ))}
                    </div>

                    <div className="hidden items-center gap-2 md:flex">
                        {session?.user ? (
                            <Link
                                href="/dashboard"
                                className="group inline-flex items-center gap-1.5 rounded-full bg-zoru-ink px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-zoru-line/10 transition hover:scale-[1.03]"
                            >
                                Open dashboard
                                <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
                            </Link>
                        ) : (
                            <>
                                <Link href="/login" className="rounded-full px-4 py-2 text-sm font-medium text-zoru-ink transition hover:text-zoru-ink">
                                    Log in
                                </Link>
                                <Link
                                    href="/login?signup=1"
                                    className="group relative inline-flex items-center gap-1.5 overflow-hidden rounded-full bg-gradient-to-r from-zoru-surface-2 via-zoru-ink to-zoru-ink px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-zoru-line/30 transition hover:scale-[1.03]"
                                >
                                    <span className="relative z-10">Start free</span>
                                    <ArrowRight className="relative z-10 h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
                                </Link>
                            </>
                        )}
                    </div>

                    <button
                        type="button"
                        aria-label="Open menu"
                        onClick={() => setMobileOpen((v) => !v)}
                        className="grid h-9 w-9 place-items-center rounded-full text-zoru-ink transition hover:bg-zoru-ink/5 md:hidden"
                    >
                        {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                    </button>
                </nav>
            </m.header>

            {/* desktop mega menu */}
            <MegaMenu open={megaOpen} onClose={() => setMegaOpen(false)} />

            {/* mobile menu */}
            <m.div
                initial={false}
                animate={mobileOpen ? { opacity: 1, pointerEvents: 'auto' } : { opacity: 0, pointerEvents: 'none' }}
                transition={{ duration: 0.2 }}
                className="fixed inset-0 z-40 bg-white/95 backdrop-blur-xl md:hidden"
            >
                <div className="mx-auto flex h-full max-w-md flex-col items-center justify-center gap-6 px-6">
                    <Link
                        onClick={() => setMobileOpen(false)}
                        href="#modules"
                        className="text-2xl font-semibold text-zoru-ink"
                    >
                        Products
                    </Link>
                    {links.map((l) => (
                        <Link
                            key={l.href}
                            onClick={() => setMobileOpen(false)}
                            href={l.href}
                            className="text-2xl font-semibold text-zoru-ink"
                        >
                            {l.label}
                        </Link>
                    ))}
                    <Link
                        onClick={() => setMobileOpen(false)}
                        href={session?.user ? '/dashboard' : '/login?signup=1'}
                        className="mt-6 rounded-full bg-gradient-to-r from-zoru-surface-2 via-zoru-ink to-zoru-ink px-6 py-3 text-base font-semibold text-white shadow-lg shadow-zoru-line/30"
                    >
                        {session?.user ? 'Open dashboard' : 'Start free'}
                    </Link>
                </div>
            </m.div>
        </>
    );
}
