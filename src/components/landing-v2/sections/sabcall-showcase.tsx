'use client';

import { m } from 'motion/react';
import type { ReactNode } from 'react';
import {
    Phone,
    Inbox,
    Workflow,
    Headphones,
    Sparkles,
    Megaphone,
    Star,
    ArrowUpRight,
    ArrowDownLeft,
    PhoneMissed,
    Voicemail,
    Delete,
    Check,
    ChevronRight,
    Ear,
    Radio,
    type LucideIcon,
} from 'lucide-react';
import type { ModuleDef } from '../modules-data';

interface SectionProps {
    mod: ModuleDef;
}

/* ────────────────────────────────────────────────────────────────────────
 * SabCall product showcase — alternating feature blocks, each with an
 * animated UI mockup and an explanation of what it does. Light theme to sit
 * inside the ModulePageShell. Animations are scroll-triggered (whileInView)
 * with a few tasteful looping micro-animations; everything respects
 * prefers-reduced-motion via the app-wide MotionConfig.
 * ──────────────────────────────────────────────────────────────────────── */

export function SabCallShowcase({ mod }: SectionProps) {
    return (
        <section className="relative px-6 py-24">
            <div className="mx-auto max-w-7xl">
                <m.p
                    initial={{ opacity: 0, y: 6 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="text-[11px] font-semibold uppercase tracking-[0.22em]"
                    style={{ color: mod.accentDeep }}
                >
                    One app for the whole phone system
                </m.p>
                <m.h2
                    initial={{ opacity: 0, y: 8 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.05 }}
                    className="mt-3 max-w-3xl text-balance text-4xl font-semibold tracking-tight text-zinc-950 md:text-5xl"
                >
                    See SabCall in action.
                </m.h2>
                <m.p
                    initial={{ opacity: 0, y: 8 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.1 }}
                    className="mt-4 max-w-2xl text-lg text-zinc-600"
                >
                    From the first ring to the AI summary — here&apos;s every surface your team
                    actually uses, and what each one does for you.
                </m.p>

                <div className="mt-16 flex flex-col gap-20">
                    <FeatureRow
                        mod={mod}
                        icon={Phone}
                        kicker="Softphone"
                        title="Call from the browser — no desk phone."
                        desc="Click-to-call any contact, anywhere in the app. The full in-call toolkit lives in one bar: hold, mute, transfer, conference and one-tap recording."
                        bullets={['WebRTC audio, zero plugins', 'Warm + blind transfer', '⌘K to dial anyone instantly']}
                        mock={<SoftphoneMock mod={mod} />}
                    />
                    <FeatureRow
                        mod={mod}
                        flip
                        icon={Inbox}
                        kicker="Unified call inbox"
                        title="Every call and voicemail in one timeline."
                        desc="Inbound, outbound, missed and voicemail — merged into a single searchable thread per contact, with the AI summary attached to each one."
                        bullets={['Searchable by number or name', 'Voicemail transcribed automatically', 'Linked to the CRM contact']}
                        mock={<ConversationsMock mod={mod} />}
                    />
                    <FeatureRow
                        mod={mod}
                        icon={Workflow}
                        kicker="Visual IVR builder"
                        title="Route every caller — without code."
                        desc="Build menus by dragging nodes. Branch on keypress, time of day, or skill, and send callers to a queue, a person, or voicemail."
                        bullets={['Time-of-day & holiday routing', 'Conditional branches', 'Reusable across numbers']}
                        mock={<IvrMock mod={mod} />}
                    />
                    <FeatureRow
                        mod={mod}
                        flip
                        icon={Headphones}
                        kicker="Live agent console"
                        title="See every live call — and coach in real time."
                        desc="Supervisors watch the floor live and step in with monitor, whisper, or barge. Agents get hold, mute and one-click transfer on every call."
                        bullets={['Monitor · whisper · barge', 'Live hold / mute / transfer', 'Presence & wrap-up states']}
                        mock={<AgentConsoleMock mod={mod} />}
                    />
                    <FeatureRow
                        mod={mod}
                        icon={Sparkles}
                        kicker="AI call intelligence"
                        title="Transcribed, summarized, scored — automatically."
                        desc="Every call is transcribed live, then summarized with sentiment, key moments and next-best-actions. No more typing notes after the call."
                        bullets={['Live transcription + summary', 'Sentiment & topic detection', 'Action items synced to CRM']}
                        mock={<AiMock mod={mod} />}
                    />
                </div>

                {/* ── outbound: broadcast + relationships ── */}
                <div className="mt-20 grid grid-cols-1 gap-6 lg:grid-cols-2">
                    <SmallFeature
                        mod={mod}
                        icon={Megaphone}
                        title="Voice broadcast & dialer"
                        desc="Reach a whole segment with a TTS message, or work a list with preview, progressive and predictive dialing — DNC scrubbed."
                        mock={<BroadcastMock mod={mod} />}
                    />
                    <SmallFeature
                        mod={mod}
                        icon={Star}
                        title="Never lose touch"
                        desc="Set a cadence and SabCall surfaces the VIPs you haven't reached in time — call them or mark them touched in one tap."
                        mock={<RelationshipsMock mod={mod} />}
                    />
                </div>
            </div>
        </section>
    );
}

/* ───────────────────────── layout helpers ───────────────────────── */

function FeatureRow({
    mod,
    icon: Icon,
    kicker,
    title,
    desc,
    bullets,
    mock,
    flip,
}: SectionProps & {
    icon: LucideIcon;
    kicker: string;
    title: string;
    desc: string;
    bullets: string[];
    mock: ReactNode;
    flip?: boolean;
}) {
    return (
        <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-2">
            <m.div
                initial={{ opacity: 0, x: flip ? 16 : -16 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: '-80px' }}
                transition={{ duration: 0.5 }}
                className={flip ? 'lg:order-2' : ''}
            >
                <span
                    className="inline-flex h-11 w-11 items-center justify-center rounded-2xl text-white shadow-md"
                    style={{ background: `linear-gradient(135deg, ${mod.accentDeep}, ${mod.glow})` }}
                >
                    <Icon className="h-5 w-5" />
                </span>
                <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: mod.accentDeep }}>
                    {kicker}
                </p>
                <h3 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-950 md:text-3xl">{title}</h3>
                <p className="mt-3 max-w-md text-[15px] leading-relaxed text-zinc-600">{desc}</p>
                <ul className="mt-5 space-y-2">
                    {bullets.map((b) => (
                        <li key={b} className="flex items-center gap-2 text-[14px] text-zinc-700">
                            <span
                                className="grid h-5 w-5 shrink-0 place-items-center rounded-full"
                                style={{ background: `${mod.accentDeep}1a`, color: mod.accentDeep }}
                            >
                                <Check className="h-3 w-3" />
                            </span>
                            {b}
                        </li>
                    ))}
                </ul>
            </m.div>

            <m.div
                initial={{ opacity: 0, y: 24, scale: 0.97 }}
                whileInView={{ opacity: 1, y: 0, scale: 1 }}
                viewport={{ once: true, margin: '-80px' }}
                transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
                className={flip ? 'lg:order-1' : ''}
            >
                {mock}
            </m.div>
        </div>
    );
}

function SmallFeature({
    mod,
    icon: Icon,
    title,
    desc,
    mock,
}: SectionProps & { icon: LucideIcon; title: string; desc: string; mock: ReactNode }) {
    return (
        <m.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.5 }}
            className="flex flex-col rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm"
        >
            <div className="flex items-center gap-3">
                <span
                    className="grid h-10 w-10 place-items-center rounded-xl text-white"
                    style={{ background: `linear-gradient(135deg, ${mod.accentDeep}, ${mod.glow})` }}
                >
                    <Icon className="h-5 w-5" />
                </span>
                <h3 className="text-lg font-semibold text-zinc-950">{title}</h3>
            </div>
            <p className="mt-3 text-[14px] leading-relaxed text-zinc-600">{desc}</p>
            <div className="mt-5">{mock}</div>
        </m.div>
    );
}

/** A framed light mockup card. */
function Frame({ children, label }: { children: ReactNode; label: string }) {
    return (
        <div className="overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-[0_24px_60px_-30px_rgba(67,56,202,0.45)]">
            <div className="flex items-center gap-1.5 border-b border-zinc-100 bg-zinc-50/70 px-4 py-2.5">
                <span className="h-2.5 w-2.5 rounded-full bg-rose-300" />
                <span className="h-2.5 w-2.5 rounded-full bg-amber-300" />
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-300" />
                <span className="ml-2 text-[11px] font-medium text-zinc-400">{label}</span>
            </div>
            <div className="p-4">{children}</div>
        </div>
    );
}

/* ───────────────────────── mockups ───────────────────────── */

function SoftphoneMock({ mod }: SectionProps) {
    const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'];
    return (
        <Frame label="sabcall.app/conversations">
            <div className="mx-auto max-w-[260px]">
                <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-center text-lg font-semibold tracking-wide text-zinc-800">
                    +1 555 010 0142
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2">
                    {keys.map((k, i) => (
                        <m.div
                            key={k}
                            initial={{ opacity: 0, scale: 0.6 }}
                            whileInView={{ opacity: 1, scale: 1 }}
                            viewport={{ once: true }}
                            transition={{ delay: 0.03 * i }}
                            className="grid h-11 place-items-center rounded-xl border border-zinc-200 bg-white text-base font-medium text-zinc-700"
                        >
                            {k}
                        </m.div>
                    ))}
                </div>
                <div className="mt-3 flex items-center gap-2">
                    <m.div
                        animate={{ boxShadow: [`0 0 0 0 ${mod.accentDeep}55`, `0 0 0 12px ${mod.accentDeep}00`] }}
                        transition={{ duration: 1.6, repeat: Infinity }}
                        className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl text-sm font-semibold text-white"
                        style={{ background: `linear-gradient(135deg, ${mod.accentDeep}, ${mod.glow})` }}
                    >
                        <Phone className="h-4 w-4" /> Call
                    </m.div>
                    <div className="grid h-11 w-11 place-items-center rounded-xl border border-zinc-200 bg-white text-zinc-400">
                        <Delete className="h-4 w-4" />
                    </div>
                </div>
            </div>
        </Frame>
    );
}

function ConversationsMock({ mod }: SectionProps) {
    const rows = [
        { icon: ArrowDownLeft, who: 'Anita Kapoor', meta: 'Inbound · 4m 12s', tag: 'Done', tone: 'emerald', when: 'now' },
        { icon: Voicemail, who: '+1 555 0188', meta: '“Hi, returning your call about…”', tag: 'Voicemail', tone: 'violet', when: '2m', ai: true },
        { icon: ArrowUpRight, who: 'Rohan Mehta', meta: 'Outbound · 1m 03s', tag: 'Done', tone: 'emerald', when: '11m' },
        { icon: PhoneMissed, who: '+44 20 7946', meta: 'Missed · no voicemail', tag: 'Missed', tone: 'rose', when: '38m' },
    ];
    const toneBg: Record<string, string> = {
        emerald: 'bg-emerald-100 text-emerald-700',
        violet: 'bg-violet-100 text-violet-700',
        rose: 'bg-rose-100 text-rose-700',
    };
    return (
        <Frame label="Conversations">
            <div className="flex flex-col gap-2">
                {rows.map((r, i) => {
                    const RIcon = r.icon;
                    return (
                        <m.div
                            key={i}
                            initial={{ opacity: 0, x: -10 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: i * 0.08 }}
                            className="flex items-center gap-3 rounded-xl border border-zinc-100 bg-white px-3 py-2.5"
                        >
                            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-zinc-100 text-zinc-500">
                                <RIcon className="h-4 w-4" />
                            </span>
                            <div className="min-w-0 flex-1">
                                <p className="truncate text-[13px] font-semibold text-zinc-900">{r.who}</p>
                                <p className="truncate text-[11px] text-zinc-500">
                                    {r.ai && (
                                        <span className="mr-1 font-semibold" style={{ color: mod.accentDeep }}>
                                            AI ·
                                        </span>
                                    )}
                                    {r.meta}
                                </p>
                            </div>
                            <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${toneBg[r.tone]}`}>
                                {r.tag}
                            </span>
                            <span className="shrink-0 text-[10px] text-zinc-400">{r.when}</span>
                        </m.div>
                    );
                })}
            </div>
        </Frame>
    );
}

function IvrMock({ mod }: SectionProps) {
    const branches = [
        { key: '1', label: 'Sales', to: 'Queue · round-robin' },
        { key: '2', label: 'Support', to: 'Ring group · Tier 1' },
        { key: '3', label: 'Billing', to: 'Voicemail + SMS' },
    ];
    return (
        <Frame label="IVR builder">
            <div>
                <m.div
                    initial={{ opacity: 0, y: 8 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="flex items-center gap-2 rounded-xl border-2 px-3 py-2.5"
                    style={{ borderColor: `${mod.accentDeep}40`, background: `${mod.accentDeep}0a` }}
                >
                    <Workflow className="h-4 w-4" style={{ color: mod.accentDeep }} />
                    <span className="text-[13px] font-semibold text-zinc-900">Welcome menu</span>
                    <span className="ml-auto text-[10px] text-zinc-400">9:00–18:00</span>
                </m.div>
                <div className="ml-5 mt-1 border-l-2 border-dashed border-zinc-200 pl-4 pt-1">
                    {branches.map((b, i) => (
                        <m.div
                            key={b.key}
                            initial={{ opacity: 0, x: -8 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: 0.12 + i * 0.1 }}
                            className="mt-2 flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2"
                        >
                            <span
                                className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-[11px] font-bold text-white"
                                style={{ background: mod.accentDeep }}
                            >
                                {b.key}
                            </span>
                            <span className="text-[12px] font-semibold text-zinc-800">{b.label}</span>
                            <ChevronRight className="h-3.5 w-3.5 text-zinc-300" />
                            <span className="text-[11px] text-zinc-500">{b.to}</span>
                        </m.div>
                    ))}
                </div>
            </div>
        </Frame>
    );
}

function AgentConsoleMock({ mod }: SectionProps) {
    const calls = [
        { from: 'Anita Kapoor', to: 'Sales line', state: 'live', live: true },
        { from: '+1 555 0177', to: 'Support', state: 'on hold', live: false },
    ];
    const chips = ['Hold', 'Mute', 'Transfer'];
    const coach = [
        { icon: Ear, label: 'Monitor' },
        { icon: Headphones, label: 'Whisper' },
        { icon: Radio, label: 'Barge' },
    ];
    return (
        <Frame label="Agent console · live">
            <div className="flex flex-col gap-2.5">
                {calls.map((c, i) => (
                    <m.div
                        key={i}
                        initial={{ opacity: 0, y: 8 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: i * 0.1 }}
                        className="rounded-xl border border-zinc-200 bg-white p-3"
                    >
                        <div className="flex items-center gap-2">
                            {c.live ? (
                                <m.span
                                    animate={{ opacity: [1, 0.35, 1] }}
                                    transition={{ duration: 1.3, repeat: Infinity }}
                                    className="h-2 w-2 rounded-full bg-emerald-500"
                                />
                            ) : (
                                <span className="h-2 w-2 rounded-full bg-amber-400" />
                            )}
                            <span className="text-[13px] font-semibold text-zinc-900">{c.from}</span>
                            <ChevronRight className="h-3 w-3 text-zinc-300" />
                            <span className="text-[12px] text-zinc-500">{c.to}</span>
                            <span className="ml-auto text-[10px] uppercase tracking-wider text-zinc-400">{c.state}</span>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                            {chips.map((ch) => (
                                <span key={ch} className="rounded-md border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-[10px] font-medium text-zinc-600">
                                    {ch}
                                </span>
                            ))}
                            {coach.map((co) => {
                                const CoIcon = co.icon;
                                return (
                                    <span
                                        key={co.label}
                                        className="flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-semibold"
                                        style={{ background: `${mod.accentDeep}14`, color: mod.accentDeep }}
                                    >
                                        <CoIcon className="h-3 w-3" />
                                        {co.label}
                                    </span>
                                );
                            })}
                        </div>
                    </m.div>
                ))}
            </div>
        </Frame>
    );
}

function AiMock({ mod }: SectionProps) {
    const actions = ['Send Scale-plan quote', 'Add 3 seats to renewal', 'Follow up in 2 days'];
    return (
        <Frame label="AI call summary">
            <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                    <p className="flex items-center gap-1.5 text-[12px] font-semibold text-zinc-900">
                        <Sparkles className="h-4 w-4" style={{ color: mod.accentDeep }} /> Summary
                    </p>
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                        Positive · 0.82
                    </span>
                </div>
                {/* sentiment meter */}
                <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-100">
                    <m.div
                        initial={{ width: 0 }}
                        whileInView={{ width: '82%' }}
                        viewport={{ once: true }}
                        transition={{ duration: 1, ease: 'easeOut' }}
                        className="h-full rounded-full"
                        style={{ background: `linear-gradient(90deg, ${mod.accentDeep}, ${mod.glow})` }}
                    />
                </div>
                <p className="text-[12px] leading-relaxed text-zinc-600">
                    Caller wants to upgrade Growth → Scale before renewal, including extra seats.
                    Pricing confirmed; quote requested.
                </p>
                <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">Action items</p>
                    <div className="mt-1.5 flex flex-col gap-1.5">
                        {actions.map((a, i) => (
                            <m.div
                                key={a}
                                initial={{ opacity: 0, x: -8 }}
                                whileInView={{ opacity: 1, x: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: 0.3 + i * 0.12 }}
                                className="flex items-center gap-2 text-[12px] text-zinc-700"
                            >
                                <span
                                    className="grid h-4 w-4 place-items-center rounded-full text-white"
                                    style={{ background: mod.accentDeep }}
                                >
                                    <Check className="h-2.5 w-2.5" />
                                </span>
                                {a}
                            </m.div>
                        ))}
                    </div>
                </div>
            </div>
        </Frame>
    );
}

function BroadcastMock({ mod }: SectionProps) {
    const stats = [
        { k: 'Queued', v: '1,240', w: '100%' },
        { k: 'Delivered', v: '1,118', w: '90%' },
        { k: 'Connected', v: '742', w: '60%' },
    ];
    return (
        <div className="rounded-2xl border border-zinc-200 bg-zinc-50/60 p-4">
            <div className="flex items-center gap-2 text-[12px] font-semibold text-zinc-800">
                <Megaphone className="h-4 w-4" style={{ color: mod.accentDeep }} /> VIP renewal reminder
            </div>
            <div className="mt-3 flex flex-col gap-2.5">
                {stats.map((s, i) => (
                    <div key={s.k}>
                        <div className="flex justify-between text-[11px]">
                            <span className="text-zinc-500">{s.k}</span>
                            <span className="font-semibold text-zinc-800">{s.v}</span>
                        </div>
                        <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-zinc-200">
                            <m.div
                                initial={{ width: 0 }}
                                whileInView={{ width: s.w }}
                                viewport={{ once: true }}
                                transition={{ duration: 0.9, delay: i * 0.12, ease: 'easeOut' }}
                                className="h-full rounded-full"
                                style={{ background: `linear-gradient(90deg, ${mod.accentDeep}, ${mod.glow})` }}
                            />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

function RelationshipsMock({ mod }: SectionProps) {
    const due = [
        { who: 'Priya Sharma', co: 'Acme Inc', since: '12d' },
        { who: 'Sam Lee', co: 'Northwind', since: '21d' },
    ];
    return (
        <div className="rounded-2xl border border-zinc-200 bg-zinc-50/60 p-4">
            <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Due to reach</span>
                <span
                    className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                    style={{ background: `${mod.accentDeep}14`, color: mod.accentDeep }}
                >
                    Every 30 days
                </span>
            </div>
            <div className="mt-3 flex flex-col gap-2">
                {due.map((d, i) => (
                    <m.div
                        key={d.who}
                        initial={{ opacity: 0, x: -8 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: i * 0.1 }}
                        className="flex items-center gap-2 rounded-xl border border-zinc-100 bg-white px-3 py-2"
                    >
                        <div className="min-w-0 flex-1">
                            <p className="truncate text-[12px] font-semibold text-zinc-900">
                                {d.who} <span className="font-normal text-zinc-400">· {d.co}</span>
                            </p>
                        </div>
                        <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] text-zinc-500">{d.since} ago</span>
                        <span
                            className="grid h-6 w-6 place-items-center rounded-full text-white"
                            style={{ background: `linear-gradient(135deg, ${mod.accentDeep}, ${mod.glow})` }}
                        >
                            <Phone className="h-3 w-3" />
                        </span>
                    </m.div>
                ))}
            </div>
        </div>
    );
}

export default SabCallShowcase;
