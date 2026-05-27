'use client';

import { m, AnimatePresence } from 'motion/react';
import { useEffect, useState } from 'react';
import { Mail, MessageSquare, Instagram, Send, Inbox, MessageCircle } from 'lucide-react';

const channels = [
    { name: 'WhatsApp', icon: MessageSquare, color: 'from-emerald-400 to-teal-500', from: 'Asha · WhatsApp', msg: 'Can you ship by Friday?', tag: 'whatsapp' },
    { name: 'Instagram', icon: Instagram, color: 'from-pink-400 to-fuchsia-500', from: 'Rohan · Instagram DM', msg: 'Need bulk pricing for 200 units', tag: 'instagram' },
    { name: 'Email', icon: Mail, color: 'from-sky-400 to-blue-500', from: 'priya@acme.com', msg: 'Re: Invoice #4821 follow-up', tag: 'email' },
    { name: 'Telegram', icon: Send, color: 'from-cyan-400 to-sky-500', from: 'Karan · Telegram', msg: 'Hello? Order status?', tag: 'telegram' },
    { name: 'Web chat', icon: MessageCircle, color: 'from-amber-400 to-orange-500', from: 'Guest · Web', msg: 'Hi! Looking for the demo link', tag: 'web' },
];

export function SabchatHero() {
    const [tick, setTick] = useState(0);
    useEffect(() => {
        const id = setInterval(() => setTick((t) => t + 1), 2200);
        return () => clearInterval(id);
    }, []);

    return (
        <div className="relative h-full w-full">
            <div aria-hidden className="absolute inset-0 rounded-3xl bg-orange-500/15 blur-3xl" />

            <m.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="relative grid h-full w-full grid-cols-[80px_1fr] overflow-hidden rounded-3xl border border-white/10 bg-[#1a0d02]/80 shadow-[0_30px_80px_-20px_rgba(251,146,60,0.5)] backdrop-blur"
            >
                {/* channel rail */}
                <div className="flex flex-col items-center gap-3 border-r border-white/5 bg-black/30 py-5">
                    <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 shadow-lg">
                        <Inbox className="h-4 w-4 text-white" />
                    </div>
                    <div className="my-2 h-px w-8 bg-white/10" />
                    {channels.map((c, i) => {
                        const CIcon = c.icon;
                        return (
                            <m.div
                                key={c.tag}
                                initial={{ opacity: 0, scale: 0.7 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ delay: 0.15 + i * 0.08 }}
                                className="relative"
                            >
                                <div className={`grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br ${c.color} shadow-md`}>
                                    <CIcon className="h-4 w-4 text-white" />
                                </div>
                                {i === tick % channels.length && (
                                    <m.span
                                        layoutId="chan-dot"
                                        className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#1a0d02] bg-rose-500"
                                    />
                                )}
                            </m.div>
                        );
                    })}
                </div>

                {/* inbox */}
                <div className="flex flex-col">
                    <div className="flex items-center justify-between border-b border-white/5 px-5 py-3">
                        <div>
                            <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-200/70">Unified inbox</p>
                            <p className="mt-0.5 text-sm font-semibold text-white">All channels · 14 open</p>
                        </div>
                        <div className="flex items-center gap-2">
                            <m.span
                                animate={{ scale: [1, 1.3, 1] }}
                                transition={{ duration: 1.4, repeat: Infinity }}
                                className="h-2 w-2 rounded-full bg-emerald-400"
                            />
                            <span className="text-[11px] text-white/60">3 agents online</span>
                        </div>
                    </div>
                    <div className="relative flex-1 overflow-hidden px-3 py-3">
                        <AnimatePresence initial={false}>
                            {channels
                                .map((_, i) => channels[(tick + i) % channels.length])
                                .slice(0, 4)
                                .map((c, idx) => {
                                    const CIcon = c.icon;
                                    return (
                                        <m.div
                                            key={`${tick}-${c.tag}-${idx}`}
                                            initial={{ opacity: 0, y: -16, scale: 0.96 }}
                                            animate={{ opacity: 1 - idx * 0.18, y: idx * 60, scale: 1 - idx * 0.02 }}
                                            exit={{ opacity: 0, x: 60 }}
                                            transition={{ type: 'spring', damping: 24 }}
                                            className="absolute inset-x-3 flex items-start gap-3 rounded-2xl border border-white/5 bg-white/[0.04] px-3 py-2.5"
                                        >
                                            <div className={`grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br ${c.color}`}>
                                                <CIcon className="h-3.5 w-3.5 text-white" />
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-baseline justify-between">
                                                    <p className="truncate text-[12px] font-semibold text-white">{c.from}</p>
                                                    <span className="text-[10px] text-white/40">just now</span>
                                                </div>
                                                <p className="mt-0.5 truncate text-[12px] text-white/70">{c.msg}</p>
                                            </div>
                                        </m.div>
                                    );
                                })}
                        </AnimatePresence>
                    </div>
                    <div className="border-t border-white/5 px-5 py-3 text-[11px] text-white/50">
                        Avg first-reply <span className="font-semibold text-amber-200">28s</span> · CSAT <span className="font-semibold text-amber-200">4.8/5</span>
                    </div>
                </div>
            </m.div>
        </div>
    );
}
