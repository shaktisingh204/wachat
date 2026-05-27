'use client';

import { m, AnimatePresence } from 'motion/react';
import { useEffect, useState } from 'react';
import { Users, Filter, Plus, MoreHorizontal, Calendar, DollarSign } from 'lucide-react';

interface Card {
    id: string;
    name: string;
    amount: string;
    company: string;
    avatar: string;
    avatarBg: string;
    tag?: string;
    col: 0 | 1 | 2 | 3;
}

const stages = [
    { name: 'Lead', color: 'bg-zinc-400' },
    { name: 'Qualified', color: 'bg-sky-400' },
    { name: 'Proposal', color: 'bg-amber-400' },
    { name: 'Won', color: 'bg-emerald-500' },
];

const initial: Card[] = [
    { id: 'a', name: 'Maya Iyer', company: 'Northwind', amount: '$2,400', avatar: 'MI', avatarBg: 'bg-rose-100 text-rose-700', tag: 'Inbound', col: 0 },
    { id: 'b', name: 'Jonas Weber', company: 'Cirrus Studio', amount: '$8,900', avatar: 'JW', avatarBg: 'bg-sky-100 text-sky-700', col: 1 },
    { id: 'c', name: 'Lina Park', company: 'Obelisk Labs', amount: '$15,200', avatar: 'LP', avatarBg: 'bg-violet-100 text-violet-700', tag: 'VIP', col: 2 },
    { id: 'd', name: 'Raj Mehta', company: 'Prisma', amount: '$4,100', avatar: 'RM', avatarBg: 'bg-amber-100 text-amber-700', col: 0 },
    { id: 'e', name: 'Ana Soares', company: 'Lumen Living', amount: '$22,500', avatar: 'AS', avatarBg: 'bg-emerald-100 text-emerald-700', tag: 'Repeat', col: 3 },
    { id: 'f', name: 'Tom Beck', company: 'Fieldwork', amount: '$1,950', avatar: 'TB', avatarBg: 'bg-cyan-100 text-cyan-700', col: 1 },
];

export function CrmDemo() {
    const [cards, setCards] = useState(initial);

    useEffect(() => {
        const t = setInterval(() => {
            setCards((prev) => {
                const candidate = prev.find((c) => c.col < 3);
                if (!candidate) return initial;
                return prev.map((c) =>
                    c.id === candidate.id ? { ...c, col: (c.col + 1) as Card['col'] } : c,
                );
            });
        }, 2200);
        return () => clearInterval(t);
    }, []);

    return (
        <section className="relative overflow-hidden py-32">
            <div className="mx-auto max-w-7xl px-6">
                <div className="grid items-center gap-14 lg:grid-cols-5">
                    <div className="lg:col-span-2">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-sky-700">
                            CRM · sales + ops
                        </p>
                        <h2 className="mt-4 text-balance text-4xl font-semibold tracking-tight text-zinc-950 sm:text-5xl">
                            Watch deals walk themselves to Won.
                        </h2>
                        <p className="mt-5 text-pretty text-lg leading-relaxed text-zinc-600">
                            Pipelines, deals, quotes, invoices, accounting, inventory, bookings, loyalty,
                            tickets. The whole revenue stack in one tenant — already wired into your inbox,
                            your flows, your billing.
                        </p>

                        <div className="mt-8 flex flex-wrap gap-x-5 gap-y-2 text-sm text-zinc-700">
                            {['Pipelines', 'Quotes', 'Invoices', 'Inventory', 'Bookings', 'Loyalty', 'Tickets'].map((t) => (
                                <span key={t} className="relative inline-flex items-center">
                                    <span className="mr-1.5 h-1 w-1 rounded-full bg-sky-500" />
                                    {t}
                                </span>
                            ))}
                        </div>
                    </div>

                    {/* polished kanban */}
                    <div className="lg:col-span-3">
                        <m.div
                            initial={{ opacity: 0, scale: 0.97 }}
                            whileInView={{ opacity: 1, scale: 1 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.5 }}
                            className="overflow-hidden rounded-2xl border border-zinc-900/10 bg-white shadow-2xl shadow-zinc-900/10 ring-1 ring-zinc-900/5"
                        >
                            {/* titlebar */}
                            <div className="flex items-center justify-between border-b border-zinc-200/70 bg-zinc-50/80 px-4 py-2.5">
                                <div className="flex items-center gap-3">
                                    <div className="flex gap-1.5">
                                        <span className="h-3 w-3 rounded-full bg-rose-400 ring-1 ring-rose-600/20" />
                                        <span className="h-3 w-3 rounded-full bg-amber-400 ring-1 ring-amber-600/20" />
                                        <span className="h-3 w-3 rounded-full bg-emerald-400 ring-1 ring-emerald-600/20" />
                                    </div>
                                    <span className="text-[11px] font-medium text-zinc-700">Q3 Pipeline</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <button className="inline-flex items-center gap-1 rounded-md bg-zinc-100 px-2 py-1 text-[10px] font-medium text-zinc-700">
                                        <Filter className="h-3 w-3" /> All owners
                                    </button>
                                    <button className="inline-flex items-center gap-1 rounded-md bg-zinc-900 px-2 py-1 text-[10px] font-medium text-white">
                                        <Plus className="h-3 w-3" /> New deal
                                    </button>
                                </div>
                            </div>

                            {/* board */}
                            <div className="grid grid-cols-4 gap-3 bg-zinc-50/40 p-3">
                                {stages.map((stage, colIdx) => (
                                    <div key={stage.name} className="rounded-xl bg-white p-2 ring-1 ring-zinc-200/60">
                                        <div className="mb-2 flex items-center justify-between px-1.5">
                                            <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-600">
                                                <span className={`h-1.5 w-1.5 rounded-full ${stage.color}`} />
                                                {stage.name}
                                            </span>
                                            <span className="rounded-full bg-zinc-100 px-1.5 py-0.5 text-[9px] font-medium text-zinc-700">
                                                {cards.filter((c) => c.col === colIdx).length}
                                            </span>
                                        </div>
                                        <div className="space-y-2 min-h-[200px]">
                                            <AnimatePresence mode="popLayout">
                                                {cards
                                                    .filter((c) => c.col === colIdx)
                                                    .map((card) => (
                                                        <m.div
                                                            key={card.id}
                                                            layout
                                                            layoutId={card.id}
                                                            initial={{ opacity: 0, scale: 0.9 }}
                                                            animate={{ opacity: 1, scale: 1 }}
                                                            exit={{ opacity: 0, scale: 0.9 }}
                                                            transition={{ type: 'spring', bounce: 0.25, duration: 0.5 }}
                                                            className="group rounded-lg border border-zinc-200/70 bg-white p-2.5 shadow-sm hover:shadow-md"
                                                        >
                                                            {card.tag && (
                                                                <div className="mb-1.5 inline-block rounded-sm bg-amber-100 px-1 py-0.5 text-[8px] font-semibold uppercase tracking-wider text-amber-700">
                                                                    {card.tag}
                                                                </div>
                                                            )}
                                                            <div className="flex items-start justify-between gap-2">
                                                                <div className="flex-1 overflow-hidden">
                                                                    <div className="truncate text-[11px] font-semibold text-zinc-900">{card.name}</div>
                                                                    <div className="truncate text-[9px] text-zinc-500">{card.company}</div>
                                                                </div>
                                                                <MoreHorizontal className="h-3 w-3 flex-shrink-0 text-zinc-400 opacity-0 transition group-hover:opacity-100" />
                                                            </div>
                                                            <div className="mt-2 flex items-center justify-between">
                                                                <span className={`grid h-5 w-5 place-items-center rounded-full text-[8px] font-semibold ${card.avatarBg}`}>
                                                                    {card.avatar}
                                                                </span>
                                                                <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-zinc-900">
                                                                    <DollarSign className="h-2.5 w-2.5 text-emerald-600" />
                                                                    {card.amount.replace('$', '')}
                                                                </span>
                                                            </div>
                                                        </m.div>
                                                    ))}
                                            </AnimatePresence>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* footer */}
                            <div className="flex items-center justify-between border-t border-zinc-200/70 bg-zinc-50/80 px-4 py-2 text-[10px] text-zinc-500">
                                <span className="flex items-center gap-1.5">
                                    <Calendar className="h-3 w-3" />
                                    Closing this month
                                </span>
                                <span className="font-semibold text-zinc-900">
                                    Weighted: <span className="text-emerald-600">$54,050</span>
                                </span>
                            </div>
                        </m.div>
                    </div>
                </div>
            </div>
        </section>
    );
}
