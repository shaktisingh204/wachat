'use client';

import { m, AnimatePresence } from 'motion/react';
import { useEffect, useState } from 'react';
import {
    Phone,
    PhoneOff,
    Mic,
    Pause,
    PhoneForwarded,
    Disc3,
    Sparkles,
    Grid3x3,
} from 'lucide-react';

/** Lines the live-transcript ticker cycles through. */
const TRANSCRIPT = [
    { who: 'Caller', text: 'Hi — I wanted to upgrade our plan before renewal.' },
    { who: 'You', text: 'Happy to help. You’re on Growth — I’ll show you Scale.' },
    { who: 'Caller', text: 'Great. Does it include the extra seats?' },
    { who: 'AI', text: 'Detected intent: upgrade · sentiment positive · next: send quote.' },
];

/** Sixteen waveform bars; the array is the looped scaleY keyframes per bar. */
const BARS = [0.4, 0.8, 0.5, 1, 0.6, 0.3, 0.9, 0.55, 0.7, 0.35, 1, 0.5, 0.8, 0.45, 0.65, 0.3];

const CONTROLS = [
    { icon: Mic, label: 'Mute' },
    { icon: Pause, label: 'Hold' },
    { icon: PhoneForwarded, label: 'Transfer' },
    { icon: Disc3, label: 'Record', live: true },
    { icon: Grid3x3, label: 'Keypad' },
];

export function SabCallHero() {
    const [line, setLine] = useState(0);
    useEffect(() => {
        const id = setInterval(() => setLine((l) => (l + 1) % TRANSCRIPT.length), 2400);
        return () => clearInterval(id);
    }, []);

    const current = TRANSCRIPT[line];

    return (
        <div className="relative h-full w-full">
            <div aria-hidden className="absolute inset-0 rounded-3xl bg-indigo-500/20 blur-3xl" />

            <m.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="relative flex h-full w-full flex-col gap-4 overflow-hidden rounded-3xl border border-white/10 bg-[#0a081f]/85 p-5 shadow-[0_30px_80px_-20px_rgba(99,102,241,0.55)] backdrop-blur"
            >
                {/* ── live-call header ── */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-indigo-400 to-violet-500 text-sm font-semibold text-white shadow-lg">
                            AK
                        </div>
                        <div>
                            <p className="text-sm font-semibold text-white">Anita Kapoor</p>
                            <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-emerald-300">
                                <m.span
                                    animate={{ opacity: [1, 0.4, 1], scale: [1, 0.85, 1] }}
                                    transition={{ duration: 1.4, repeat: Infinity }}
                                    className="h-2 w-2 rounded-full bg-emerald-400"
                                />
                                Connected · 02:14
                            </p>
                        </div>
                    </div>
                    <span className="rounded-full border border-indigo-400/30 bg-indigo-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-indigo-200">
                        Sales · VIP
                    </span>
                </div>

                {/* ── live waveform ── */}
                <div className="flex h-16 items-center justify-center gap-1 rounded-2xl border border-white/5 bg-black/30 px-4">
                    {BARS.map((peak, i) => (
                        <m.span
                            key={i}
                            className="w-1.5 origin-bottom rounded-full bg-gradient-to-t from-indigo-500 to-violet-300"
                            style={{ height: '70%' }}
                            animate={{ scaleY: [0.25, peak, 0.35, peak * 0.7, 0.25] }}
                            transition={{
                                duration: 1.1 + (i % 4) * 0.18,
                                repeat: Infinity,
                                ease: 'easeInOut',
                                delay: i * 0.05,
                            }}
                        />
                    ))}
                </div>

                {/* ── AI live transcript ── */}
                <div className="rounded-2xl border border-white/5 bg-white/[0.04] p-3">
                    <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-indigo-200/80">
                        <Sparkles className="h-3 w-3" /> Live transcript
                    </p>
                    <div className="relative mt-2 h-10 overflow-hidden">
                        <AnimatePresence mode="wait">
                            <m.div
                                key={line}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                transition={{ duration: 0.3 }}
                                className="absolute inset-0 flex items-start gap-2"
                            >
                                <span
                                    className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${
                                        current.who === 'AI'
                                            ? 'bg-violet-500/20 text-violet-200'
                                            : current.who === 'You'
                                              ? 'bg-emerald-500/15 text-emerald-200'
                                              : 'bg-white/10 text-white/70'
                                    }`}
                                >
                                    {current.who}
                                </span>
                                <p className="text-[12px] leading-snug text-white/85">{current.text}</p>
                            </m.div>
                        </AnimatePresence>
                    </div>
                </div>

                {/* ── in-call controls ── */}
                <div className="mt-auto flex items-center justify-between gap-2">
                    <div className="flex gap-2">
                        {CONTROLS.map((c) => {
                            const CIcon = c.icon;
                            return (
                                <div key={c.label} className="relative flex flex-col items-center gap-1">
                                    <div className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/[0.04] text-white/80">
                                        <CIcon className="h-4 w-4" />
                                        {c.live && (
                                            <m.span
                                                animate={{ opacity: [1, 0.3, 1] }}
                                                transition={{ duration: 1.2, repeat: Infinity }}
                                                className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-rose-500"
                                            />
                                        )}
                                    </div>
                                    <span className="text-[9px] text-white/40">{c.label}</span>
                                </div>
                            );
                        })}
                    </div>
                    <m.div
                        animate={{ boxShadow: ['0 0 0 0 rgba(244,63,94,0.5)', '0 0 0 10px rgba(244,63,94,0)', '0 0 0 0 rgba(244,63,94,0)'] }}
                        transition={{ duration: 1.8, repeat: Infinity }}
                        className="grid h-12 w-12 place-items-center rounded-full bg-gradient-to-br from-rose-500 to-red-600 text-white shadow-lg"
                    >
                        <PhoneOff className="h-5 w-5" />
                    </m.div>
                </div>
            </m.div>

            {/* ── floating AI-summary chip ── */}
            <m.div
                initial={{ opacity: 0, y: 12, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ delay: 0.6, type: 'spring', damping: 18 }}
                className="absolute -bottom-5 -left-4 flex items-center gap-2 rounded-2xl border border-white/10 bg-[#0a081f]/90 px-3 py-2 shadow-xl backdrop-blur"
            >
                <span className="grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-br from-violet-400 to-fuchsia-500">
                    <Sparkles className="h-3.5 w-3.5 text-white" />
                </span>
                <div>
                    <p className="text-[11px] font-semibold text-white">AI summary ready</p>
                    <p className="text-[10px] text-white/55">3 action items · synced to CRM</p>
                </div>
            </m.div>

            {/* ── floating click-to-call chip ── */}
            <m.div
                initial={{ opacity: 0, y: -12, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ delay: 0.8, type: 'spring', damping: 18 }}
                className="absolute -top-4 -right-3 flex items-center gap-2 rounded-2xl border border-white/10 bg-[#0a081f]/90 px-3 py-2 shadow-xl backdrop-blur"
            >
                <span className="grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-br from-indigo-400 to-violet-500">
                    <Phone className="h-3.5 w-3.5 text-white" />
                </span>
                <p className="text-[11px] font-semibold text-white">⌘K · Call anyone</p>
            </m.div>
        </div>
    );
}

export default SabCallHero;
