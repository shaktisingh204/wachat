'use client';

import Link from 'next/link';
import { m } from 'motion/react';
import {
    MessageSquare,
    Workflow,
    Inbox,
    Users,
    Globe2,
    Briefcase,
    ArrowUpRight,
} from 'lucide-react';

const modules = [
    {
        name: 'Wachat',
        tag: 'WhatsApp Business at scale',
        desc: 'Templates, broadcasts, chatbot, catalog, payments — your WhatsApp number on autopilot.',
        href: '/dashboard/wachat',
        icon: MessageSquare,
        from: 'from-emerald-400',
        to: 'to-teal-500',
    },
    {
        name: 'SabFlow',
        tag: 'Visual automation',
        desc: '900+ integrations, drag-drop nodes, branching logic, scheduled runs. Zapier energy, without the bill.',
        href: '/dashboard/sabflow',
        icon: Workflow,
        from: 'from-violet-400',
        to: 'to-fuchsia-500',
    },
    {
        name: 'SabChat',
        tag: 'Omnichannel inbox',
        desc: 'Live chat, email, WhatsApp, Instagram, Telegram, SMS — every message in one window.',
        href: '/dashboard/sabchat',
        icon: Inbox,
        from: 'from-amber-400',
        to: 'to-orange-500',
    },
    {
        name: 'CRM',
        tag: 'Sales + ops',
        desc: 'Pipelines, deals, quotes, invoices, accounting, inventory, bookings, loyalty. Replaces six tools.',
        href: '/dashboard/crm',
        icon: Users,
        from: 'from-sky-400',
        to: 'to-indigo-500',
    },
    {
        name: 'SEO',
        tag: 'Growth surface',
        desc: 'Landing pages, sitemap, schema, link tracking, A/B tests — your acquisition rails.',
        href: '/dashboard/seo',
        icon: Globe2,
        from: 'from-rose-400',
        to: 'to-pink-500',
    },
    {
        name: 'HRM',
        tag: 'People + payroll',
        desc: 'Roster, shifts, attendance, leaves, payroll, performance — runs your whole team.',
        href: '/dashboard/hrm',
        icon: Briefcase,
        from: 'from-cyan-400',
        to: 'to-blue-500',
    },
];

export function ModulesGrid() {
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
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
                        Six products. One bill.
                    </p>
                    <h2 className="mt-4 text-balance text-4xl font-semibold tracking-tight text-zinc-950 sm:text-5xl md:text-6xl">
                        Everything your team uses, finally in one place.
                    </h2>
                    <p className="mt-5 text-pretty text-lg text-zinc-600">
                        Stop paying for ten tools that don&apos;t talk to each other. SabNode ships a full
                        operating stack — shared customers, shared inbox, shared reports.
                    </p>
                </m.div>

                <div className="mt-20 grid grid-cols-1 gap-x-12 gap-y-16 md:grid-cols-2 lg:grid-cols-3">
                    {modules.map((mod, i) => {
                        const Icon = mod.icon;
                        return (
                            <m.div
                                key={mod.name}
                                initial={{ opacity: 0, y: 14 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true, margin: '-10%' }}
                                transition={{ delay: i * 0.05 }}
                            >
                                <Link href={mod.href} className="group block">
                                    <div className="relative inline-flex">
                                        <div
                                            aria-hidden
                                            className={`absolute -inset-2 -z-0 rounded-2xl bg-gradient-to-br ${mod.from} ${mod.to} opacity-0 blur-xl transition duration-500 group-hover:opacity-40`}
                                        />
                                        <div className={`relative grid h-12 w-12 place-items-center rounded-xl bg-gradient-to-br ${mod.from} ${mod.to} shadow-md`}>
                                            <Icon className="h-5 w-5 text-white" />
                                        </div>
                                    </div>
                                    <div className="mt-6 flex items-center gap-2">
                                        <h3 className="text-2xl font-semibold tracking-tight text-zinc-950">
                                            {mod.name}
                                        </h3>
                                        <ArrowUpRight className="h-4 w-4 text-zinc-400 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-zinc-900" />
                                    </div>
                                    <div className="mt-1 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                                        {mod.tag}
                                    </div>
                                    <p className="mt-3 max-w-sm text-[15px] leading-relaxed text-zinc-600">
                                        {mod.desc}
                                    </p>
                                </Link>
                            </m.div>
                        );
                    })}
                </div>
            </div>
        </section>
    );
}
