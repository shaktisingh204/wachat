'use client';

import { m } from 'motion/react';
import { MessageSquare, Check, CheckCheck, Phone, Video, MoreVertical, ArrowLeft, Plus, Mic, Smile, Camera, Wifi, Signal, BatteryFull } from 'lucide-react';

interface Msg {
    text: string;
    side: 'in' | 'out';
    delay: number;
    status?: 'sent' | 'delivered' | 'read';
    time: string;
}

const messages: Msg[] = [
    { text: 'Hi! Is the leather jacket still in stock?', side: 'in', delay: 0.2, time: '12:14' },
    { text: 'Yes — last 3 in size M. Want me to hold one?', side: 'out', delay: 1.0, status: 'read', time: '12:14' },
    { text: 'Please. Same shipping address?', side: 'in', delay: 1.8, time: '12:15' },
    { text: 'Yep, 21B Banbridge Ln, BR1 5QF. UPI link below ⬇', side: 'out', delay: 2.6, status: 'delivered', time: '12:15' },
    { text: '₹ 4,899 · pay.sabnode.com/aH82', side: 'out', delay: 3.0, status: 'sent', time: '12:15' },
    { text: 'Paid! Thanks 🙌', side: 'in', delay: 4.0, time: '12:17' },
];

export function WachatDemo() {
    return (
        <section className="relative overflow-hidden bg-gradient-to-b from-emerald-50/30 via-white to-white py-32">
            <div className="mx-auto max-w-7xl px-6">
                <div className="grid items-center gap-16 lg:grid-cols-2">
                    <div className="relative">
                        <m.div
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.6 }}
                            className="relative mx-auto w-full max-w-[320px]"
                        >
                            {/* iPhone-style frame */}
                            <div className="relative aspect-[9/19] rounded-[52px] bg-zinc-900 p-[10px] shadow-[0_50px_100px_-20px_rgba(0,0,0,0.4),0_30px_60px_-30px_rgba(0,0,0,0.3)] ring-1 ring-zinc-800">
                                {/* outer bezel highlights */}
                                <div className="absolute inset-0 rounded-[52px] bg-gradient-to-br from-white/5 via-transparent to-white/5" />
                                {/* side buttons */}
                                <span className="absolute -left-[3px] top-24 h-8 w-[3px] rounded-l bg-zinc-800" />
                                <span className="absolute -left-[3px] top-36 h-12 w-[3px] rounded-l bg-zinc-800" />
                                <span className="absolute -left-[3px] top-52 h-12 w-[3px] rounded-l bg-zinc-800" />
                                <span className="absolute -right-[3px] top-32 h-16 w-[3px] rounded-r bg-zinc-800" />

                                {/* screen */}
                                <div className="relative h-full overflow-hidden rounded-[42px] bg-[#e5ddd5]">
                                    {/* dynamic island */}
                                    <div className="absolute left-1/2 top-2 z-30 h-7 w-28 -translate-x-1/2 rounded-full bg-black" />

                                    {/* status bar */}
                                    <div className="relative z-20 flex items-center justify-between px-7 pt-3.5 text-[10px] font-semibold text-white">
                                        <span>9:41</span>
                                        <div className="flex items-center gap-1">
                                            <Signal className="h-3 w-3" />
                                            <Wifi className="h-3 w-3" />
                                            <BatteryFull className="h-3 w-3" />
                                        </div>
                                    </div>

                                    {/* whatsapp header */}
                                    <div className="relative z-10 flex items-center gap-2 bg-emerald-600 px-3 py-2 text-white">
                                        <ArrowLeft className="h-4 w-4" />
                                        <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/25 text-xs font-semibold">A</span>
                                        <div className="flex-1">
                                            <div className="text-[12px] font-medium leading-tight">Aisha · Customer</div>
                                            <div className="text-[9px] text-emerald-100">last seen just now</div>
                                        </div>
                                        <Video className="h-4 w-4 opacity-90" />
                                        <Phone className="h-4 w-4 opacity-90" />
                                        <MoreVertical className="h-4 w-4 opacity-90" />
                                    </div>

                                    {/* chat bg */}
                                    <div
                                        className="h-[calc(100%-145px)] overflow-hidden p-3"
                                        style={{
                                            backgroundImage:
                                                'radial-gradient(rgba(0,0,0,0.04) 1px, transparent 1px)',
                                            backgroundSize: '14px 14px',
                                        }}
                                    >
                                        <div className="flex flex-col gap-1.5">
                                            <div className="mx-auto rounded-md bg-[#ffeaa7]/80 px-2 py-1 text-[9px] font-medium text-zinc-700 shadow-sm">
                                                Today
                                            </div>
                                            {messages.map((msg, i) => (
                                                <m.div
                                                    key={i}
                                                    initial={{ opacity: 0, y: 8, scale: 0.96 }}
                                                    whileInView={{ opacity: 1, y: 0, scale: 1 }}
                                                    viewport={{ once: true }}
                                                    transition={{ delay: msg.delay }}
                                                    className={`max-w-[78%] ${msg.side === 'out' ? 'ml-auto' : 'mr-auto'}`}
                                                >
                                                    <div
                                                        className={`relative rounded-lg px-2.5 py-1 text-[11px] leading-snug shadow-sm ${
                                                            msg.side === 'out'
                                                                ? 'bg-[#dcf8c6] text-zinc-900'
                                                                : 'bg-white text-zinc-900'
                                                        }`}
                                                    >
                                                        {msg.text}
                                                        <div className="ml-2 mt-0.5 flex items-center justify-end gap-0.5 text-[8px] text-zinc-500">
                                                            {msg.time}
                                                            {msg.status && (
                                                                <span className="inline-flex">
                                                                    {msg.status === 'sent' && <Check className="h-2.5 w-2.5" />}
                                                                    {msg.status === 'delivered' && <CheckCheck className="h-2.5 w-2.5" />}
                                                                    {msg.status === 'read' && <CheckCheck className="h-2.5 w-2.5 text-sky-500" />}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </m.div>
                                            ))}

                                            <m.div
                                                initial={{ opacity: 0 }}
                                                whileInView={{ opacity: 1 }}
                                                viewport={{ once: true }}
                                                transition={{ delay: 4.8 }}
                                                className="mr-auto"
                                            >
                                                <div className="flex gap-1 rounded-lg bg-white px-2.5 py-1.5 shadow-sm">
                                                    {[0, 1, 2].map((d) => (
                                                        <m.span
                                                            key={d}
                                                            className="h-1.5 w-1.5 rounded-full bg-zinc-400"
                                                            animate={{ opacity: [0.3, 1, 0.3], y: [0, -2, 0] }}
                                                            transition={{ duration: 1.2, repeat: Infinity, delay: d * 0.18 }}
                                                        />
                                                    ))}
                                                </div>
                                            </m.div>
                                        </div>
                                    </div>

                                    {/* input bar */}
                                    <div className="absolute inset-x-0 bottom-0 flex items-center gap-1.5 bg-[#e5ddd5] px-2 pb-3 pt-2">
                                        <div className="flex flex-1 items-center gap-1.5 rounded-full bg-white px-2.5 py-1.5 shadow-sm">
                                            <Smile className="h-3.5 w-3.5 text-zinc-400" />
                                            <span className="flex-1 text-[10px] text-zinc-400">Message</span>
                                            <Plus className="h-3.5 w-3.5 text-zinc-400" />
                                            <Camera className="h-3.5 w-3.5 text-zinc-400" />
                                        </div>
                                        <button className="grid h-9 w-9 place-items-center rounded-full bg-emerald-600 text-white shadow">
                                            <Mic className="h-4 w-4" />
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* floating receipt card */}
                            <m.div
                                initial={{ opacity: 0, x: 30, rotate: 6 }}
                                whileInView={{ opacity: 1, x: 0, rotate: 4 }}
                                viewport={{ once: true }}
                                transition={{ delay: 3.5, type: 'spring' }}
                                className="absolute -right-8 top-40 hidden w-56 rounded-2xl border border-zinc-200/70 bg-white p-3.5 shadow-2xl ring-1 ring-zinc-900/5 md:block"
                            >
                                <div className="flex items-center gap-2">
                                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
                                        ✓
                                    </span>
                                    <div className="text-[10px] font-medium uppercase tracking-wider text-emerald-700">Auto-invoice sent</div>
                                </div>
                                <div className="mt-1.5 text-sm font-semibold text-zinc-900">Order #2034 · ₹4,899</div>
                                <div className="mt-1 text-[10px] text-zinc-500">Logged to CRM · receipt on WhatsApp · loyalty points credited</div>
                            </m.div>

                            {/* floating template badge */}
                            <m.div
                                initial={{ opacity: 0, x: -30, rotate: -6 }}
                                whileInView={{ opacity: 1, x: 0, rotate: -4 }}
                                viewport={{ once: true }}
                                transition={{ delay: 3.8, type: 'spring' }}
                                className="absolute -left-10 top-28 hidden rounded-xl border border-zinc-200/70 bg-white px-3 py-2 shadow-xl ring-1 ring-zinc-900/5 md:block"
                            >
                                <div className="flex items-center gap-2 text-[10px] font-medium text-zinc-700">
                                    <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                                    Template: order_paid
                                </div>
                                <div className="mt-0.5 text-[9px] text-zinc-500">Approved · sent in 0.4s</div>
                            </m.div>
                        </m.div>
                    </div>

                    <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-700">
                            Wachat · official WhatsApp Business
                        </p>
                        <h2 className="mt-4 text-balance text-4xl font-semibold tracking-tight text-zinc-950 sm:text-5xl">
                            Sell on WhatsApp like a real shop, not a spreadsheet.
                        </h2>
                        <p className="mt-5 text-pretty text-lg leading-relaxed text-zinc-600">
                            Approved templates, broadcasts, click-to-chat ads, catalog, payment requests,
                            auto-receipts, contact tags, chatbot, agent queue, analytics. Every WhatsApp number
                            in your company, one inbox, zero copy-paste.
                        </p>

                        <div className="mt-10 grid grid-cols-2 gap-x-10 gap-y-6">
                            {[
                                { k: 'Templates', v: '847', s: 'approved' },
                                { k: 'Broadcast', v: '94%', s: 'delivered' },
                                { k: 'Bot resolves', v: '62%', s: 'no handoff' },
                                { k: 'Payments', v: 'UPI · cards · COD', s: 'enabled' },
                            ].map((s, i) => (
                                <m.div
                                    key={s.k}
                                    initial={{ opacity: 0, y: 8 }}
                                    whileInView={{ opacity: 1, y: 0 }}
                                    viewport={{ once: true }}
                                    transition={{ delay: 0.1 + i * 0.06 }}
                                >
                                    <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">{s.k}</div>
                                    <div className="mt-1 text-xl font-semibold text-zinc-900">{s.v}</div>
                                    <div className="mt-0.5 text-xs text-zinc-500">{s.s}</div>
                                </m.div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}
