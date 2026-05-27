'use client';

import Link from 'next/link';
import { m } from 'motion/react';
import { ArrowRight, Sparkles, Star, Search, Inbox, Users2, Workflow, BarChart3, Settings2, CheckCheck, Paperclip, Smile, Send } from 'lucide-react';

export function Hero({ session }: { session?: { user?: unknown } | null }) {
    return (
        <section className="relative isolate overflow-hidden pb-28 pt-36 sm:pt-44">
            {/* aurora wash */}
            <m.div
                aria-hidden
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 0.55 }}
                transition={{ duration: 1.4, ease: 'easeOut' }}
                className="pointer-events-none absolute -top-32 left-1/2 h-[820px] w-[820px] -translate-x-1/2 rounded-full blur-3xl"
                style={{
                    background:
                        'radial-gradient(circle at 30% 30%, rgba(251,191,36,0.42), transparent 60%), radial-gradient(circle at 70% 60%, rgba(244,63,94,0.32), transparent 60%), radial-gradient(circle at 50% 80%, rgba(139,92,246,0.34), transparent 60%)',
                }}
            />
            <m.div
                aria-hidden
                animate={{ x: [0, 18, 0], y: [0, -22, 0] }}
                transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
                className="pointer-events-none absolute right-[-12%] top-32 h-[440px] w-[440px] rounded-full bg-zoru-surface-2/30 blur-3xl"
            />
            <m.div
                aria-hidden
                animate={{ x: [0, -22, 0], y: [0, 18, 0] }}
                transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
                className="pointer-events-none absolute left-[-10%] top-44 h-[420px] w-[420px] rounded-full bg-zoru-surface-2/30 blur-3xl"
            />

            <div
                aria-hidden
                className="pointer-events-none absolute inset-0 opacity-[0.25]"
                style={{
                    backgroundImage: 'radial-gradient(rgba(24,24,27,0.18) 1px, transparent 1px)',
                    backgroundSize: '24px 24px',
                    maskImage: 'radial-gradient(ellipse 60% 80% at 50% 30%, black, transparent)',
                }}
            />

            <div className="relative mx-auto max-w-7xl px-6 text-center">
                <m.div
                    initial={{ y: 12, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ duration: 0.5 }}
                    className="mx-auto inline-flex items-center gap-2 rounded-full border border-zoru-line/10 bg-white/70 px-3 py-1 text-xs font-medium text-zoru-ink shadow-sm backdrop-blur"
                >
                    <Sparkles className="h-3.5 w-3.5 text-zoru-ink" />
                    <span>Live across 4,812 workspaces</span>
                    <span className="h-3 w-px bg-zoru-ink/10" />
                    <span className="flex items-center gap-1">
                        <Star className="h-3 w-3 fill-zoru-ink-muted text-zoru-ink-muted" /> 4.8 on Google
                    </span>
                </m.div>

                <m.h1
                    initial={{ y: 18, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ duration: 0.6, delay: 0.1 }}
                    className="mx-auto mt-6 max-w-5xl text-balance text-5xl font-semibold leading-[1.02] tracking-tight text-zoru-ink sm:text-6xl md:text-7xl lg:text-8xl"
                >
                    Run every customer{' '}
                    <span className="relative inline-block">
                        <span
                            className="bg-gradient-to-r from-zoru-ink via-zoru-ink to-zoru-ink bg-clip-text text-transparent"
                            style={{ WebkitTextFillColor: 'transparent' }}
                        >
                            conversation
                        </span>
                        <m.span
                            aria-hidden
                            initial={{ scaleX: 0, originX: 0 }}
                            animate={{ scaleX: 1 }}
                            transition={{ duration: 0.9, delay: 0.7, ease: 'easeOut' }}
                            className="absolute -bottom-1 left-0 right-0 h-[3px] origin-left rounded-full bg-gradient-to-r from-zoru-surface-2 via-zoru-ink to-zoru-ink"
                        />
                    </span>
                    <br className="hidden sm:block" /> from one quiet console.
                </m.h1>

                <m.p
                    initial={{ y: 14, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ duration: 0.6, delay: 0.25 }}
                    className="mx-auto mt-7 max-w-2xl text-pretty text-lg leading-relaxed text-zoru-ink sm:text-xl"
                >
                    WhatsApp, live chat, email, social, CRM, billing, HR — one tenant, one bill, one
                    team. Replace ten dashboards with the operating system your customers feel.
                </m.p>

                <m.div
                    initial={{ y: 14, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ duration: 0.6, delay: 0.4 }}
                    className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row"
                >
                    <Link
                        href={session?.user ? '/dashboard' : '/login?signup=1'}
                        className="group relative inline-flex items-center gap-2 overflow-hidden rounded-full bg-gradient-to-r from-zoru-surface-2 via-zoru-ink to-zoru-ink px-7 py-3.5 text-sm font-semibold text-white shadow-xl shadow-zoru-line/30 transition hover:scale-[1.03]"
                    >
                        <span className="absolute inset-0 -translate-x-full bg-white/30 transition-transform duration-700 group-hover:translate-x-full" />
                        <span className="relative z-10">
                            {session?.user ? 'Open dashboard' : 'Start free — no card needed'}
                        </span>
                        <ArrowRight className="relative z-10 h-4 w-4 transition group-hover:translate-x-0.5" />
                    </Link>
                    <Link
                        href="#modules"
                        className="inline-flex items-center gap-1.5 rounded-full px-6 py-3.5 text-sm font-semibold text-zoru-ink transition hover:bg-zoru-ink/5"
                    >
                        Take the tour →
                    </Link>
                </m.div>

                {/* polished product cinematic */}
                <m.div
                    initial={{ y: 32, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ duration: 0.9, delay: 0.55, ease: 'easeOut' }}
                    className="relative mx-auto mt-20 max-w-6xl"
                >
                    {/* shadow halo */}
                    <div
                        aria-hidden
                        className="absolute -inset-x-10 -inset-y-6 rounded-[32px] opacity-50 blur-2xl"
                        style={{
                            background:
                                'linear-gradient(135deg, rgba(251,191,36,0.45), rgba(244,63,94,0.45), rgba(139,92,246,0.45))',
                        }}
                    />

                    {/* macOS-style window */}
                    <div className="relative overflow-hidden rounded-2xl border border-zoru-line/10 bg-white shadow-2xl shadow-zoru-line/15 ring-1 ring-zoru-line/5">
                        {/* titlebar */}
                        <div className="flex items-center gap-3 border-b border-zoru-line/70 bg-zoru-surface-2/80 px-4 py-2.5">
                            <div className="flex gap-1.5">
                                <span className="h-3 w-3 rounded-full bg-zoru-surface-2 ring-1 ring-zoru-line/20" />
                                <span className="h-3 w-3 rounded-full bg-zoru-surface-2 ring-1 ring-zoru-line/20" />
                                <span className="h-3 w-3 rounded-full bg-zoru-surface-2 ring-1 ring-zoru-line/20" />
                            </div>
                            <div className="mx-auto flex items-center gap-2 rounded-md bg-white px-3 py-1 text-[11px] text-zoru-ink ring-1 ring-zoru-line">
                                <span className="h-1.5 w-1.5 rounded-full bg-zoru-ink" />
                                app.sabnode.com/inbox
                            </div>
                            <div className="w-12" />
                        </div>

                        {/* app body */}
                        <div className="grid grid-cols-12 bg-white">
                            {/* sidebar */}
                            <aside className="col-span-12 hidden border-r border-zoru-line/70 bg-zoru-surface-2/40 p-3 md:col-span-1 md:flex md:flex-col md:items-center md:gap-2">
                                {[
                                    { Icon: Inbox, active: true },
                                    { Icon: Users2, active: false },
                                    { Icon: Workflow, active: false },
                                    { Icon: BarChart3, active: false },
                                    { Icon: Settings2, active: false },
                                ].map((it, i) => (
                                    <m.div
                                        key={i}
                                        initial={{ opacity: 0, x: -8 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: 0.9 + i * 0.06 }}
                                        className={`grid h-9 w-9 place-items-center rounded-lg transition ${
                                            it.active
                                                ? 'bg-zoru-ink text-white shadow-sm'
                                                : 'text-zoru-ink hover:bg-zoru-ink/5'
                                        }`}
                                    >
                                        <it.Icon className="h-4 w-4" />
                                    </m.div>
                                ))}
                            </aside>

                            {/* inbox list */}
                            <section className="col-span-12 border-r border-zoru-line/70 md:col-span-4">
                                <div className="border-b border-zoru-line/70 px-4 py-3">
                                    <div className="flex items-center justify-between">
                                        <div className="text-sm font-semibold text-zoru-ink">Inbox</div>
                                        <div className="rounded-full bg-zoru-surface-2 px-1.5 py-0.5 text-[10px] font-medium text-zoru-ink">
                                            12 open
                                        </div>
                                    </div>
                                    <div className="mt-2.5 flex items-center gap-2 rounded-md bg-zoru-surface-2 px-2.5 py-1.5 text-xs text-zoru-ink">
                                        <Search className="h-3.5 w-3.5" />
                                        Search conversations
                                    </div>
                                </div>
                                <div className="divide-y divide-zoru-line/60">
                                    {[
                                        { name: 'Aisha Khan', preview: 'Got the invoice — sending today', tag: 'WhatsApp', color: 'bg-zoru-ink', mins: '2m' },
                                        { name: 'Daniel Cruz', preview: 'Is the Pro plan annual?', tag: 'Email', color: 'bg-zoru-ink', mins: '14m' },
                                        { name: 'Mei Tanaka', preview: 'Order #1487 stuck on pending', tag: 'Live chat', color: 'bg-zoru-ink', mins: '23m' },
                                        { name: 'Omar Saif', preview: 'Can I get a refund?', tag: 'Instagram', color: 'bg-zoru-ink', mins: '1h' },
                                    ].map((c, i) => (
                                        <m.button
                                            key={c.name}
                                            initial={{ opacity: 0, y: 6 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: 1 + i * 0.07 }}
                                            className={`flex w-full items-start gap-3 px-4 py-3 text-left transition ${
                                                i === 0 ? 'bg-zoru-surface-2/60' : 'hover:bg-zoru-surface-2'
                                            }`}
                                        >
                                            <span className="relative mt-0.5 inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-zoru-surface-2 text-[11px] font-semibold text-zoru-ink">
                                                {c.name.split(' ').map((s) => s[0]).join('').slice(0, 2)}
                                                <span className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-white ${c.color}`} />
                                            </span>
                                            <div className="flex-1 overflow-hidden">
                                                <div className="flex items-center justify-between">
                                                    <span className="truncate text-[12px] font-semibold text-zoru-ink">{c.name}</span>
                                                    <span className="text-[10px] text-zoru-ink">{c.mins}</span>
                                                </div>
                                                <div className="mt-0.5 truncate text-[11px] text-zoru-ink">{c.preview}</div>
                                                <div className="mt-1">
                                                    <span className="rounded-full bg-zoru-surface-2 px-1.5 py-0.5 text-[9px] font-medium text-zoru-ink">
                                                        {c.tag}
                                                    </span>
                                                </div>
                                            </div>
                                        </m.button>
                                    ))}
                                </div>
                            </section>

                            {/* thread */}
                            <section className="col-span-12 flex flex-col md:col-span-5">
                                <div className="flex items-center justify-between border-b border-zoru-line/70 px-5 py-3">
                                    <div className="flex items-center gap-2.5">
                                        <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-zoru-surface-2 text-[11px] font-semibold text-zoru-ink">AK</span>
                                        <div>
                                            <div className="text-[13px] font-semibold text-zoru-ink">Aisha Khan</div>
                                            <div className="flex items-center gap-1 text-[10px] text-zoru-ink">
                                                <span className="h-1.5 w-1.5 rounded-full bg-zoru-ink" />
                                                online · WhatsApp
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 text-[10px] text-zoru-ink">
                                        <span className="rounded-md bg-zoru-surface-2 px-1.5 py-0.5 font-medium text-zoru-ink">VIP</span>
                                        <span className="rounded-md bg-zoru-surface-2 px-1.5 py-0.5 font-medium text-zoru-ink">Order</span>
                                    </div>
                                </div>
                                <div className="flex flex-1 flex-col justify-end gap-3 px-5 py-4">
                                    <m.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.4 }} className="flex items-end gap-2">
                                        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-zoru-surface-2 text-[10px] font-semibold text-zoru-ink">AK</span>
                                        <div className="max-w-[80%] rounded-2xl rounded-bl-md bg-zoru-surface-2 px-3 py-2 text-[12px] text-zoru-ink">
                                            Hey — when does the order ship?
                                        </div>
                                    </m.div>
                                    <m.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.7 }} className="ml-auto flex items-end gap-1.5">
                                        <div className="max-w-[80%] rounded-2xl rounded-br-md bg-gradient-to-br from-zoru-surface-2 to-zoru-ink px-3 py-2 text-[12px] text-white">
                                            Already on its way — DHL tracking 7842-0019
                                            <span className="ml-1.5 inline-flex items-center text-white/70">
                                                <CheckCheck className="h-3 w-3" />
                                            </span>
                                        </div>
                                    </m.div>
                                    <m.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 2.0 }} className="flex items-end gap-2">
                                        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-zoru-surface-2 text-[10px] font-semibold text-zoru-ink">AK</span>
                                        <div className="max-w-[80%] rounded-2xl rounded-bl-md bg-zoru-surface-2 px-3 py-2 text-[12px] text-zoru-ink">
                                            Got the invoice — sending today 🎉
                                        </div>
                                    </m.div>
                                </div>
                                <div className="border-t border-zoru-line/70 p-3">
                                    <div className="flex items-center gap-2 rounded-xl border border-zoru-line bg-white px-3 py-2 shadow-sm">
                                        <Paperclip className="h-4 w-4 text-zoru-ink-muted" />
                                        <Smile className="h-4 w-4 text-zoru-ink-muted" />
                                        <span className="flex-1 text-[12px] text-zoru-ink-muted">Type a reply…</span>
                                        <button className="grid h-7 w-7 place-items-center rounded-lg bg-zoru-ink text-white">
                                            <Send className="h-3 w-3" />
                                        </button>
                                    </div>
                                    <div className="mt-1.5 flex items-center gap-2 text-[10px] text-zoru-ink">
                                        <Sparkles className="h-3 w-3 text-zoru-ink" />
                                        AI draft ready — press Tab to insert
                                    </div>
                                </div>
                            </section>

                            {/* context panel */}
                            <aside className="col-span-12 hidden bg-zoru-surface-2/40 p-4 md:col-span-2 md:block">
                                <div className="text-[10px] font-semibold uppercase tracking-wider text-zoru-ink">Customer</div>
                                <div className="mt-2 flex items-center gap-2">
                                    <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-zoru-surface-2 text-xs font-semibold text-zoru-ink">AK</span>
                                    <div>
                                        <div className="text-[12px] font-semibold text-zoru-ink">Aisha Khan</div>
                                        <div className="text-[10px] text-zoru-ink">Premium · ₹84k LTV</div>
                                    </div>
                                </div>
                                <div className="mt-4 space-y-1.5 text-[10px] text-zoru-ink">
                                    <div className="flex justify-between"><span>Plan</span><span className="font-medium text-zoru-ink">Pro</span></div>
                                    <div className="flex justify-between"><span>Orders</span><span className="font-medium text-zoru-ink">12</span></div>
                                    <div className="flex justify-between"><span>NPS</span><span className="font-medium text-zoru-ink">+9</span></div>
                                </div>
                            </aside>
                        </div>
                    </div>
                </m.div>
            </div>
        </section>
    );
}
