'use client';

import { m } from 'motion/react';
import { Check, CheckCheck, MessageSquare, Phone } from 'lucide-react';

const messages = [
    { from: 'them', text: 'Hey! Is the running shoe still in stock?', delay: 0.1 },
    { from: 'us', text: 'Yes — size 9 ready. Pay here to lock it 👇', delay: 0.6 },
    { from: 'us', kind: 'pay', text: '₹4,299 · Pay with UPI', delay: 1.0 },
    { from: 'them', text: 'Done! Sending screenshot', delay: 1.6 },
    { from: 'us', text: '🎉 Order confirmed. ETA Wed.', delay: 2.2 },
];

export function WachatHero() {
    return (
        <div className="relative h-full w-full">
            {/* glow */}
            <div
                aria-hidden
                className="absolute inset-0 rounded-[3rem] bg-emerald-500/20 blur-3xl"
            />
            {/* phone frame */}
            <m.div
                initial={{ rotate: -2 }}
                animate={{ rotate: [-2, 1, -2] }}
                transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
                className="relative mx-auto h-full max-h-[560px] w-[280px] overflow-hidden rounded-[2.4rem] border border-white/10 bg-[#04130d] shadow-[0_30px_80px_-20px_rgba(16,185,129,0.6)]"
            >
                <div className="flex items-center justify-between border-b border-white/5 bg-emerald-900/40 px-4 py-3">
                    <div className="flex items-center gap-2">
                        <div className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-emerald-400 to-teal-500">
                            <MessageSquare className="h-4 w-4 text-white" />
                        </div>
                        <div>
                            <p className="text-[12px] font-semibold text-white">Sole Co.</p>
                            <p className="text-[10px] text-emerald-200">online · WABA verified</p>
                        </div>
                    </div>
                    <Phone className="h-4 w-4 text-emerald-200/70" />
                </div>
                <div className="flex flex-col gap-2 p-3">
                    {messages.map((m, i) => (
                        <MessageBubble key={i} {...m} />
                    ))}
                    <m.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 2.6 }}
                        className="mt-1 flex gap-1 rounded-2xl rounded-bl-sm bg-white/5 px-3 py-2 text-[11px] text-emerald-100/70"
                    >
                        <Dots />
                    </m.div>
                </div>
            </m.div>

            {/* floating chips */}
            <FloatingChip delay={0.4} className="left-0 top-12" label="+92% replies" />
            <FloatingChip delay={1.0} className="-right-2 top-32" label="Template approved" />
            <FloatingChip delay={1.6} className="-left-2 bottom-20" label="Order #4821" />
        </div>
    );
}

function MessageBubble({ from, text, kind, delay = 0 }: { from: 'us' | 'them'; text: string; kind?: string; delay?: number }) {
    const isUs = from === 'us';
    return (
        <m.div
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ delay, type: 'spring', damping: 22 }}
            className={`flex ${isUs ? 'justify-end' : 'justify-start'}`}
        >
            <div
                className={`max-w-[80%] rounded-2xl px-3 py-2 text-[12px] leading-snug ${
                    isUs
                        ? kind === 'pay'
                            ? 'rounded-br-sm bg-gradient-to-r from-emerald-400 to-teal-500 font-semibold text-white shadow-lg'
                            : 'rounded-br-sm bg-emerald-500/90 text-white'
                        : 'rounded-bl-sm bg-white/10 text-emerald-50'
                }`}
            >
                {text}
                {isUs && (
                    <div className="mt-0.5 flex items-center justify-end gap-0.5 text-[9px] opacity-80">
                        12:0{Math.floor(delay * 10)} <CheckCheck className="h-3 w-3" />
                    </div>
                )}
                {!isUs && (
                    <div className="mt-0.5 flex items-center justify-end gap-0.5 text-[9px] opacity-60">
                        12:0{Math.floor(delay * 10)} <Check className="h-3 w-3" />
                    </div>
                )}
            </div>
        </m.div>
    );
}

function Dots() {
    return (
        <>
            {[0, 1, 2].map((i) => (
                <m.span
                    key={i}
                    animate={{ opacity: [0.3, 1, 0.3] }}
                    transition={{ duration: 1.2, delay: i * 0.15, repeat: Infinity }}
                    className="h-1.5 w-1.5 rounded-full bg-emerald-300"
                />
            ))}
        </>
    );
}

function FloatingChip({ delay, className, label }: { delay: number; className: string; label: string }) {
    return (
        <m.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: [0, -6, 0] }}
            transition={{ opacity: { delay }, y: { duration: 4, delay, repeat: Infinity, ease: 'easeInOut' } }}
            className={`absolute z-10 rounded-full border border-emerald-300/30 bg-emerald-950/70 px-3 py-1 text-[11px] font-semibold text-emerald-100 backdrop-blur-md ${className}`}
            style={{ boxShadow: '0 8px 30px -8px rgba(16,185,129,0.5)' }}
        >
            {label}
        </m.div>
    );
}
