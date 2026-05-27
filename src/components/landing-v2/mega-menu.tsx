'use client';

import Link from 'next/link';
import { AnimatePresence, m } from 'motion/react';
import { useEffect, useMemo, useState } from 'react';
import { ArrowUpRight, Search, Sparkles, X } from 'lucide-react';
import {
    MODULES,
    MODULE_CATEGORIES,
    PLATFORM_LINKS,
    RESOURCES_LINKS,
    modulesByCategory,
    type ModuleDef,
} from './modules-data';

interface MegaMenuProps {
    open: boolean;
    onClose: () => void;
}

export function MegaMenu({ open, onClose }: MegaMenuProps) {
    const [query, setQuery] = useState('');
    const [activeSlug, setActiveSlug] = useState<string>(MODULES[0].slug);

    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
        document.body.style.overflow = 'hidden';
        window.addEventListener('keydown', onKey);
        return () => {
            document.body.style.overflow = '';
            window.removeEventListener('keydown', onKey);
        };
    }, [open, onClose]);

    const grouped = useMemo(() => modulesByCategory(), []);
    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return null;
        return MODULES.filter(
            (mo) =>
                mo.name.toLowerCase().includes(q) ||
                mo.tag.toLowerCase().includes(q) ||
                mo.short.toLowerCase().includes(q) ||
                mo.category.toLowerCase().includes(q),
        );
    }, [query]);

    const activeMod = MODULES.find((mo) => mo.slug === activeSlug) ?? MODULES[0];

    return (
        <AnimatePresence>
            {open && (
                <m.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="fixed inset-0 z-[100]"
                >
                    {/* light dim — keeps focus on the panel */}
                    <m.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.25 }}
                        className="absolute inset-0 bg-zinc-900/10 backdrop-blur-sm"
                        onClick={onClose}
                    />

                    <m.div
                        initial={{ y: '-100%' }}
                        animate={{ y: 0 }}
                        exit={{ y: '-100%' }}
                        transition={{ type: 'spring', damping: 28, stiffness: 220 }}
                        className="relative h-full w-full overflow-y-auto bg-[#fafaf7] text-zinc-900"
                        style={{
                            backgroundImage:
                                'radial-gradient(ellipse 60% 40% at 12% 8%, rgba(168,85,247,0.08), transparent 60%), radial-gradient(ellipse 60% 40% at 92% 92%, rgba(244,63,94,0.06), transparent 60%)',
                        }}
                    >
                        {/* subtle dot grid */}
                        <div
                            aria-hidden
                            className="pointer-events-none absolute inset-0 opacity-[0.04]"
                            style={{
                                backgroundImage:
                                    'linear-gradient(rgba(24,24,27,1) 1px, transparent 1px), linear-gradient(90deg, rgba(24,24,27,1) 1px, transparent 1px)',
                                backgroundSize: '48px 48px',
                                maskImage: 'radial-gradient(circle at 50% 30%, black, transparent 80%)',
                            }}
                        />

                        {/* top bar */}
                        <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 bg-[#fafaf7]/90 px-6 py-4 backdrop-blur-md">
                            <Link href="/" onClick={onClose} className="flex items-center gap-2">
                                <div className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-amber-400 via-orange-500 to-rose-500 shadow-lg shadow-orange-500/30">
                                    <span className="text-sm font-black text-white">S</span>
                                </div>
                                <span className="text-lg font-semibold tracking-tight text-zinc-950">SabNode</span>
                                <span className="ml-2 hidden rounded-full border border-zinc-200 bg-white px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] text-zinc-600 md:inline">
                                    {MODULES.length} products
                                </span>
                            </Link>

                            <label className="order-3 flex w-full items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-sm md:order-2 md:w-80">
                                <Search className="h-3.5 w-3.5 text-zinc-400" />
                                <input
                                    autoFocus
                                    value={query}
                                    onChange={(e) => setQuery(e.target.value)}
                                    placeholder="Search modules…"
                                    className="w-full bg-transparent text-[13px] text-zinc-900 placeholder:text-zinc-400 focus:outline-none"
                                />
                                {query && (
                                    <button onClick={() => setQuery('')} className="text-zinc-400 hover:text-zinc-900">
                                        <X className="h-3.5 w-3.5" />
                                    </button>
                                )}
                            </label>

                            <button
                                onClick={onClose}
                                aria-label="Close menu"
                                className="order-2 grid h-9 w-9 place-items-center rounded-full text-zinc-600 transition hover:bg-zinc-900/5 hover:text-zinc-900 md:order-3"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <div className="relative mx-auto grid max-w-7xl gap-8 px-6 py-10 lg:grid-cols-[1fr_320px]">
                            <div>
                                {filtered ? (
                                    <SearchResults
                                        modules={filtered}
                                        onPick={() => onClose()}
                                        onHover={(s) => setActiveSlug(s)}
                                    />
                                ) : (
                                    <div className="space-y-10">
                                        {MODULE_CATEGORIES.map((cat, ci) => {
                                            const items = grouped[cat];
                                            if (!items.length) return null;
                                            return (
                                                <m.section
                                                    key={cat}
                                                    initial={{ opacity: 0, y: 8 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    transition={{ delay: 0.05 + ci * 0.03 }}
                                                >
                                                    <div className="mb-3 flex items-baseline justify-between border-b border-zinc-200 pb-2">
                                                        <h3 className="text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
                                                            {cat}
                                                        </h3>
                                                        <span className="text-[10px] text-zinc-400">{items.length}</span>
                                                    </div>
                                                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                                                        {items.map((mo) => (
                                                            <ModuleCard
                                                                key={mo.slug}
                                                                mod={mo}
                                                                onHover={() => setActiveSlug(mo.slug)}
                                                                onPick={onClose}
                                                            />
                                                        ))}
                                                    </div>
                                                </m.section>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>

                            <aside className="space-y-6 lg:sticky lg:top-[88px] lg:self-start">
                                <ModulePreview mod={activeMod} onClose={onClose} />

                                <div>
                                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
                                        Platform
                                    </p>
                                    <ul className="mt-3 grid grid-cols-2 gap-1">
                                        {PLATFORM_LINKS.map((l) => (
                                            <li key={l.href}>
                                                <Link
                                                    href={l.href}
                                                    onClick={onClose}
                                                    className="block rounded-lg px-2 py-1.5 text-[13px] text-zinc-700 transition hover:bg-zinc-900/5 hover:text-zinc-950"
                                                >
                                                    {l.label}
                                                </Link>
                                            </li>
                                        ))}
                                    </ul>
                                    <p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
                                        Resources
                                    </p>
                                    <ul className="mt-3 grid grid-cols-2 gap-1">
                                        {RESOURCES_LINKS.map((l) => (
                                            <li key={l.href}>
                                                <Link
                                                    href={l.href}
                                                    onClick={onClose}
                                                    className="block rounded-lg px-2 py-1.5 text-[13px] text-zinc-700 transition hover:bg-zinc-900/5 hover:text-zinc-950"
                                                >
                                                    {l.label}
                                                </Link>
                                            </li>
                                        ))}
                                    </ul>
                                </div>

                                <m.div
                                    initial={{ opacity: 0, y: 8 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.35 }}
                                    className="rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 via-orange-50 to-rose-50 p-4"
                                >
                                    <Sparkles className="h-4 w-4 text-amber-600" />
                                    <p className="mt-2 text-sm font-semibold text-zinc-950">Switch from your old stack</p>
                                    <p className="mt-1 text-[12px] text-zinc-700">
                                        We migrate your data, contacts and templates for free.
                                    </p>
                                    <Link
                                        href="/contact"
                                        onClick={onClose}
                                        className="mt-3 inline-flex items-center gap-1 text-[12px] font-semibold text-amber-700"
                                    >
                                        Book migration <ArrowUpRight className="h-3 w-3" />
                                    </Link>
                                </m.div>
                            </aside>
                        </div>
                    </m.div>
                </m.div>
            )}
        </AnimatePresence>
    );
}

function ModuleCard({ mod, onHover, onPick }: { mod: ModuleDef; onHover?: () => void; onPick: () => void }) {
    const Icon = mod.icon;
    return (
        <Link
            href={mod.href}
            onClick={onPick}
            onMouseEnter={onHover}
            onFocus={onHover}
            className="group relative flex items-start gap-3 rounded-xl border border-zinc-200 bg-white px-3 py-3 transition hover:-translate-y-0.5 hover:border-zinc-900 hover:shadow-[0_18px_40px_-20px_rgba(24,24,27,0.18)]"
        >
            <div
                className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br ${mod.accentFrom} ${mod.accentTo} shadow-md`}
            >
                <Icon className="h-4 w-4 text-white" />
            </div>
            <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                    <span className="truncate text-[13px] font-semibold text-zinc-950">{mod.name}</span>
                    {mod.flagship && (
                        <span className="rounded-full bg-amber-100 px-1.5 py-px text-[9px] font-semibold uppercase tracking-wider text-amber-700">
                            Flagship
                        </span>
                    )}
                    <ArrowUpRight className="ml-auto h-3 w-3 text-zinc-300 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-zinc-900" />
                </div>
                <p className="mt-0.5 truncate text-[11px] text-zinc-500">{mod.tag}</p>
            </div>
        </Link>
    );
}

function ModulePreview({ mod, onClose }: { mod: ModuleDef; onClose: () => void }) {
    const Icon = mod.icon;
    return (
        <AnimatePresence mode="wait">
            <m.div
                key={mod.slug}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.2 }}
                className="relative overflow-hidden rounded-2xl border border-zinc-200 bg-white p-5"
            >
                <div
                    aria-hidden
                    className="absolute -right-12 -top-12 h-40 w-40 rounded-full blur-2xl"
                    style={{ background: mod.glow, opacity: 0.35 }}
                />
                <div className="relative">
                    <div
                        className={`grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br ${mod.accentFrom} ${mod.accentTo} shadow-lg`}
                    >
                        <Icon className="h-5 w-5 text-white" />
                    </div>
                    <h4 className="mt-3 text-lg font-semibold tracking-tight text-zinc-950">{mod.name}</h4>
                    <p className="mt-1 text-[13px] leading-relaxed text-zinc-600">{mod.short}</p>
                    <ul className="mt-4 space-y-1.5">
                        {mod.features.slice(0, 3).map((f) => (
                            <li key={f.title} className="flex items-start gap-2 text-[12px] text-zinc-600">
                                <span
                                    className="mt-1 h-1 w-1 shrink-0 rounded-full"
                                    style={{ background: mod.accentDeep }}
                                />
                                <span>
                                    <span className="font-semibold text-zinc-900">{f.title}</span> · {f.desc}
                                </span>
                            </li>
                        ))}
                    </ul>
                    <Link
                        href={mod.href}
                        onClick={onClose}
                        className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold"
                        style={{ color: mod.accentDeep }}
                    >
                        Explore {mod.name}
                        <ArrowUpRight className="h-3.5 w-3.5" />
                    </Link>
                </div>
            </m.div>
        </AnimatePresence>
    );
}

function SearchResults({
    modules,
    onPick,
    onHover,
}: {
    modules: ModuleDef[];
    onPick: () => void;
    onHover: (slug: string) => void;
}) {
    if (modules.length === 0) {
        return (
            <div className="rounded-xl border border-zinc-200 bg-white p-8 text-center text-sm text-zinc-600">
                No modules match.
            </div>
        );
    }
    return (
        <>
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
                {modules.length} result{modules.length === 1 ? '' : 's'}
            </p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {modules.map((mo) => (
                    <ModuleCard key={mo.slug} mod={mo} onHover={() => onHover(mo.slug)} onPick={onPick} />
                ))}
            </div>
        </>
    );
}
