'use client';

import { m } from 'motion/react';
import { Rocket, Plug, BarChart3 } from 'lucide-react';

const steps = [
    {
        n: '01',
        title: 'Sign up in 60 seconds',
        body: 'Email + workspace name. No credit card, no demo gate. Your tenant boots with sample data so you can click around immediately.',
        icon: Rocket,
        color: 'from-amber-400 to-orange-500',
    },
    {
        n: '02',
        title: 'Plug your channels',
        body: 'Connect WhatsApp, Gmail, Instagram, Stripe, Shopify, Calendar — one tap each. Your existing data syncs in the background.',
        icon: Plug,
        color: 'from-violet-400 to-fuchsia-500',
    },
    {
        n: '03',
        title: 'Watch the team save hours',
        body: 'Reply faster, close more deals, ship payroll on time, see every metric on one dashboard. Cancel the other ten subscriptions.',
        icon: BarChart3,
        color: 'from-emerald-400 to-teal-500',
    },
];

export function HowItWorks() {
    return (
        <section id="how" className="relative overflow-hidden py-28">
            <div className="mx-auto max-w-7xl px-6">
                <m.div
                    initial={{ opacity: 0, y: 12 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="mx-auto max-w-2xl text-center"
                >
                    <span className="inline-flex items-center rounded-full border border-zinc-900/10 bg-white px-3 py-1 text-xs font-medium text-zinc-700 shadow-sm">
                        How it works
                    </span>
                    <h2 className="mt-5 text-balance text-4xl font-semibold tracking-tight text-zinc-950 sm:text-5xl">
                        From signup to first reply in under five minutes.
                    </h2>
                </m.div>

                <div className="relative mt-16">
                    {/* connecting line */}
                    <div className="absolute left-0 right-0 top-12 hidden h-px bg-gradient-to-r from-transparent via-zinc-300 to-transparent md:block" />

                    <div className="grid gap-8 md:grid-cols-3">
                        {steps.map((s, i) => {
                            const Icon = s.icon;
                            return (
                                <m.div
                                    key={s.n}
                                    initial={{ opacity: 0, y: 20 }}
                                    whileInView={{ opacity: 1, y: 0 }}
                                    viewport={{ once: true }}
                                    transition={{ delay: i * 0.12 }}
                                    className="relative"
                                >
                                    <div className={`mb-5 grid h-24 w-24 place-items-center rounded-2xl bg-gradient-to-br ${s.color} mx-auto shadow-xl`}>
                                        <Icon className="h-10 w-10 text-white" />
                                    </div>
                                    <div className="text-center">
                                        <div className="text-xs font-semibold uppercase tracking-widest text-zinc-400">step {s.n}</div>
                                        <h3 className="mt-1 text-xl font-semibold tracking-tight text-zinc-950">{s.title}</h3>
                                        <p className="mt-2 text-sm leading-relaxed text-zinc-600">{s.body}</p>
                                    </div>
                                </m.div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </section>
    );
}
