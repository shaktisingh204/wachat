'use client';

import Link from 'next/link';
import { m } from 'motion/react';
import { ArrowUpRight } from 'lucide-react';
import { useMemo, useState } from 'react';
import { MODULES, MODULE_CATEGORIES, modulesByCategory, type ModuleCategory } from '../modules-data';

const TABS: ('All' | ModuleCategory)[] = ['All', ...MODULE_CATEGORIES];

export function ModulesGrid() {
    const [activeTab, setActiveTab] = useState<(typeof TABS)[number]>('All');
    const grouped = useMemo(() => modulesByCategory(), []);

    const visibleModules = useMemo(() => {
        if (activeTab === 'All') return MODULES;
        return grouped[activeTab];
    }, [activeTab, grouped]);

    return (
        <section id="modules" className="relative py-32">
            <div className="mx-auto max-w-7xl px-6">
                <m.div
                    initial={{ opacity: 0, y: 12 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5 }}
                    className="mx-auto max-w-3xl text-center"
                >
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zoru-ink">
                        {MODULES.length} products. One bill.
                    </p>
                    <h2 className="mt-4 text-balance text-4xl font-semibold tracking-tight text-zoru-ink sm:text-5xl md:text-6xl">
                        Everything your team uses, finally in one place.
                    </h2>
                    <p className="mt-5 text-pretty text-lg text-zoru-ink">
                        Stop paying for ten tools that don&apos;t talk to each other. SabNode ships a full
                        operating stack — shared customers, shared inbox, shared reports.
                    </p>
                </m.div>

                {/* category pill tabs */}
                <m.div
                    initial={{ opacity: 0, y: 8 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.4, delay: 0.1 }}
                    className="mx-auto mt-12 flex max-w-5xl flex-wrap justify-center gap-1.5"
                >
                    {TABS.map((tab) => {
                        const isActive = tab === activeTab;
                        const count = tab === 'All' ? MODULES.length : grouped[tab].length;
                        if (count === 0) return null;
                        return (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className="relative rounded-full px-3.5 py-1.5 text-[12px] font-medium transition"
                            >
                                {isActive && (
                                    <m.span
                                        layoutId="modules-tab-active"
                                        className="absolute inset-0 rounded-full bg-zoru-ink"
                                        transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                                    />
                                )}
                                <span className={`relative z-10 ${isActive ? 'text-white' : 'text-zoru-ink hover:text-zoru-ink'}`}>
                                    {tab}
                                    <span className={`ml-1.5 text-[10px] ${isActive ? 'text-white/60' : 'text-zoru-ink-muted'}`}>
                                        {count}
                                    </span>
                                </span>
                            </button>
                        );
                    })}
                </m.div>

                {activeTab === 'All' ? (
                    <div className="mt-14 space-y-14">
                        {MODULE_CATEGORIES.map((cat) => {
                            const items = grouped[cat];
                            if (!items.length) return null;
                            return (
                                <div key={cat}>
                                    <div className="flex items-baseline justify-between border-b border-zoru-line pb-3">
                                        <h3 className="text-[11px] font-semibold uppercase tracking-[0.22em] text-zoru-ink">
                                            {cat}
                                        </h3>
                                        <span className="text-[11px] text-zoru-ink-muted">
                                            {items.length} module{items.length === 1 ? '' : 's'}
                                        </span>
                                    </div>
                                    <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                                        {items.map((mod, i) => (
                                            <ModuleCard key={mod.slug} mod={mod} idx={i} />
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <m.div
                        key={activeTab}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3 }}
                        className="mt-14 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
                    >
                        {visibleModules.map((mod, i) => (
                            <ModuleCard key={mod.slug} mod={mod} idx={i} />
                        ))}
                    </m.div>
                )}
            </div>
        </section>
    );
}

function ModuleCard({ mod, idx }: { mod: (typeof MODULES)[number]; idx: number }) {
    const Icon = mod.icon;
    return (
        <m.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-10%' }}
            transition={{ delay: Math.min(idx * 0.03, 0.4) }}
        >
            <Link
                href={mod.href}
                className="group block h-full rounded-2xl border border-zoru-line bg-white p-5 transition hover:-translate-y-1 hover:border-zoru-line hover:shadow-[0_24px_60px_-20px_rgba(24,24,27,0.18)]"
            >
                <div className="flex items-start justify-between">
                    <div className="relative inline-flex">
                        <div
                            aria-hidden
                            className={`absolute -inset-1.5 -z-0 rounded-2xl bg-gradient-to-br ${mod.accentFrom} ${mod.accentTo} opacity-0 blur-xl transition duration-500 group-hover:opacity-40`}
                        />
                        <div className={`relative grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br ${mod.accentFrom} ${mod.accentTo} shadow-md`}>
                            <Icon className="h-4.5 w-4.5 text-white" />
                        </div>
                    </div>
                    {mod.flagship && (
                        <span className="rounded-full bg-zoru-surface-2 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-zoru-ink">
                            Flagship
                        </span>
                    )}
                </div>
                <div className="mt-4 flex items-center gap-1.5">
                    <h4 className="text-base font-semibold tracking-tight text-zoru-ink">{mod.name}</h4>
                    <ArrowUpRight className="h-3.5 w-3.5 text-zoru-ink-muted transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-zoru-ink" />
                </div>
                <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-wider text-zoru-ink">
                    {mod.tag}
                </p>
                <p className="mt-3 text-[13px] leading-relaxed text-zoru-ink">{mod.short}</p>
            </Link>
        </m.div>
    );
}
