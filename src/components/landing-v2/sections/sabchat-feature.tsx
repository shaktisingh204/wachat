'use client';

import { m } from 'motion/react';
import { MessageCircle, Sparkles, Bot, Headphones, ShieldCheck, Zap, Inbox } from 'lucide-react';

const channels = [
    { label: 'WhatsApp', dot: '#25D366' },
    { label: 'Email', dot: '#60a5fa' },
    { label: 'Live chat', dot: '#fbbf24' },
    { label: 'Instagram', dot: '#e1306c' },
    { label: 'Facebook', dot: '#1877f2' },
    { label: 'Telegram', dot: '#26a5e4' },
    { label: 'SMS', dot: '#f472b6' },
    { label: 'Voice', dot: '#a78bfa' },
];

const bullets = [
    { icon: Sparkles, text: 'AI copilot drafts the next reply, summarises long threads, and learns your tone.' },
    { icon: Bot, text: 'Smart bots resolve tier-1 questions in 12 languages, hand off cleanly to a human.' },
    { icon: Headphones, text: 'One-click voice + video calls from the chat panel. No new SDK to integrate.' },
    { icon: ShieldCheck, text: 'SLA timers, business hours, audit log, GDPR & DPDP toolkit — built in.' },
    { icon: Zap, text: 'Triggers fire from cart-abandon, ad clicks, signup events, SLA breaches.' },
];

export function SabchatFeature() {
    return (
        <section id="sabchat" className="relative overflow-hidden py-28">
            <div
                aria-hidden
                className="pointer-events-none absolute left-1/2 top-0 h-[500px] w-[900px] -translate-x-1/2 rounded-full opacity-60 blur-3xl"
                style={{
                    background:
                        'radial-gradient(circle, rgba(251,191,36,0.18), transparent 60%), radial-gradient(circle at 70% 60%, rgba(244,63,94,0.18), transparent 60%)',
                }}
            />

            <div className="relative mx-auto max-w-7xl px-6">
                <div className="grid items-start gap-12 lg:grid-cols-2 lg:gap-20">
                    <div>
                        <m.span
                            initial={{ opacity: 0, y: 8 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700"
                        >
                            <MessageCircle className="h-3.5 w-3.5" />
                            SabChat — the moat
                        </m.span>
                        <m.h2
                            initial={{ opacity: 0, y: 12 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: 0.1 }}
                            className="mt-5 text-balance text-4xl font-semibold tracking-tight text-zinc-950 sm:text-5xl"
                        >
                            One inbox for every channel your customers use.
                        </m.h2>
                        <m.p
                            initial={{ opacity: 0, y: 12 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: 0.18 }}
                            className="mt-5 text-pretty text-base leading-relaxed text-zinc-600"
                        >
                            Tawk for the widget. Chatwoot for the inbox. Intercom for the AI. SabChat does all
                            three — plus the channels they don&apos;t touch — and ties every conversation to the
                            customer record, the deal, the order, and the invoice.
                        </m.p>

                        <ul className="mt-8 space-y-3">
                            {bullets.map((b, i) => {
                                const Icon = b.icon;
                                return (
                                    <m.li
                                        key={i}
                                        initial={{ opacity: 0, x: -10 }}
                                        whileInView={{ opacity: 1, x: 0 }}
                                        viewport={{ once: true }}
                                        transition={{ delay: 0.25 + i * 0.06 }}
                                        className="flex items-start gap-3"
                                    >
                                        <span className="mt-0.5 grid h-7 w-7 flex-shrink-0 place-items-center rounded-lg bg-amber-50 ring-1 ring-amber-200">
                                            <Icon className="h-3.5 w-3.5 text-amber-700" />
                                        </span>
                                        <span className="text-sm text-zinc-700">{b.text}</span>
                                    </m.li>
                                );
                            })}
                        </ul>
                    </div>

                    <div className="relative">
                        <m.div
                            initial={{ opacity: 0, scale: 0.92 }}
                            whileInView={{ opacity: 1, scale: 1 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.7 }}
                            className="relative aspect-square w-full max-w-md"
                        >
                            <m.div
                                className="absolute inset-0 rounded-full border border-zinc-200"
                                animate={{ rotate: 360 }}
                                transition={{ duration: 60, repeat: Infinity, ease: 'linear' }}
                            >
                                {channels.map((c, i) => {
                                    const angle = (i / channels.length) * 360;
                                    const rad = (angle * Math.PI) / 180;
                                    const r = 47;
                                    const x = 50 + r * Math.cos(rad);
                                    const y = 50 + r * Math.sin(rad);
                                    return (
                                        <m.div
                                            key={c.label}
                                            className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full border border-zinc-200/80 bg-white px-3 py-1.5 text-[11px] font-medium text-zinc-900 shadow-lg"
                                            style={{ left: `${x}%`, top: `${y}%` }}
                                            animate={{ rotate: -360 }}
                                            transition={{ duration: 60, repeat: Infinity, ease: 'linear' }}
                                            whileHover={{ scale: 1.1 }}
                                        >
                                            <span className="flex items-center gap-1.5">
                                                <span className="h-1.5 w-1.5 rounded-full" style={{ background: c.dot }} />
                                                {c.label}
                                            </span>
                                        </m.div>
                                    );
                                })}
                            </m.div>
                            <div className="absolute left-1/2 top-1/2 grid h-32 w-32 -translate-x-1/2 -translate-y-1/2 place-items-center">
                                <div
                                    className="absolute inset-0 animate-pulse rounded-full blur-2xl"
                                    style={{
                                        background:
                                            'radial-gradient(circle, rgba(251,191,36,0.55), transparent 70%)',
                                    }}
                                />
                                <div className="relative grid h-24 w-24 place-items-center rounded-full bg-gradient-to-br from-amber-400 via-orange-500 to-rose-500 shadow-2xl shadow-orange-500/40">
                                    <Inbox className="h-9 w-9 text-white" />
                                </div>
                            </div>
                        </m.div>
                    </div>
                </div>
            </div>
        </section>
    );
}
