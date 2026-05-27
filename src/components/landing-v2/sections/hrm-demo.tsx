'use client';

import { Fragment } from 'react';
import { m } from 'motion/react';
import { Briefcase, Clock, MoreHorizontal } from 'lucide-react';

const team = [
    { name: 'Aisha Khan', role: 'Support · L2', status: 'online', hours: '6h 24m', color: 'bg-rose-100 text-rose-700' },
    { name: 'Jonas Weber', role: 'Sales', status: 'online', hours: '7h 12m', color: 'bg-sky-100 text-sky-700' },
    { name: 'Mei Tanaka', role: 'Support · L1', status: 'break', hours: '4h 00m', color: 'bg-amber-100 text-amber-700' },
    { name: 'Raj Mehta', role: 'Ops', status: 'online', hours: '5h 48m', color: 'bg-violet-100 text-violet-700' },
    { name: 'Lina Park', role: 'Design', status: 'offline', hours: '—', color: 'bg-zinc-100 text-zinc-700' },
    { name: 'Tom Beck', role: 'Sales', status: 'online', hours: '6h 06m', color: 'bg-emerald-100 text-emerald-700' },
];

const statusDot: Record<string, string> = {
    online: 'bg-emerald-500',
    break: 'bg-amber-400',
    offline: 'bg-zinc-300',
};

const statusLabel: Record<string, string> = {
    online: 'Active',
    break: 'On break',
    offline: 'Off',
};

const shifts = [
    { label: 'Mon', cells: [0.2, 1, 1, 0.6, 1, 1, 0.4] },
    { label: 'Tue', cells: [0.3, 1, 0.6, 1, 1, 1, 0.2] },
    { label: 'Wed', cells: [0.2, 1, 1, 1, 1, 0.6, 1] },
    { label: 'Thu', cells: [0, 1, 1, 1, 1, 1, 1] },
    { label: 'Fri', cells: [0.5, 1, 1, 1, 0.6, 1, 1] },
];

const cellShade = (v: number) => {
    if (v === 0) return 'bg-zinc-100';
    if (v < 0.5) return 'bg-cyan-200';
    if (v < 0.8) return 'bg-cyan-400';
    return 'bg-gradient-to-br from-cyan-500 to-blue-500';
};

export function HrmDemo() {
    return (
        <section className="relative overflow-hidden bg-gradient-to-b from-cyan-50/30 via-white to-white py-32">
            <div className="mx-auto max-w-7xl px-6">
                <div className="grid items-center gap-14 lg:grid-cols-2">
                    <m.div
                        initial={{ opacity: 0, scale: 0.97 }}
                        whileInView={{ opacity: 1, scale: 1 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.6 }}
                        className="space-y-4"
                    >
                        {/* live roster */}
                        <div className="overflow-hidden rounded-2xl border border-zinc-900/10 bg-white shadow-2xl shadow-zinc-900/10 ring-1 ring-zinc-900/5">
                            <div className="flex items-center justify-between border-b border-zinc-200/70 bg-zinc-50/80 px-4 py-2.5">
                                <div className="flex items-center gap-3">
                                    <div className="flex gap-1.5">
                                        <span className="h-3 w-3 rounded-full bg-rose-400 ring-1 ring-rose-600/20" />
                                        <span className="h-3 w-3 rounded-full bg-amber-400 ring-1 ring-amber-600/20" />
                                        <span className="h-3 w-3 rounded-full bg-emerald-400 ring-1 ring-emerald-600/20" />
                                    </div>
                                    <span className="text-[11px] font-medium text-zinc-700">Live roster</span>
                                </div>
                                <div className="flex items-center gap-1 text-[10px] text-emerald-600">
                                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" /> 4 on shift
                                </div>
                            </div>
                            <div className="divide-y divide-zinc-200/60">
                                {team.map((p, i) => (
                                    <m.div
                                        key={p.name}
                                        initial={{ opacity: 0, y: 6 }}
                                        whileInView={{ opacity: 1, y: 0 }}
                                        viewport={{ once: true }}
                                        transition={{ delay: i * 0.05 }}
                                        className="flex items-center gap-3 px-4 py-2.5"
                                    >
                                        <div className="relative">
                                            <span className={`grid h-9 w-9 place-items-center rounded-full text-[10px] font-semibold ${p.color}`}>
                                                {p.name.split(' ').map((s) => s[0]).join('').slice(0, 2)}
                                            </span>
                                            <span className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-white ${statusDot[p.status]}`} />
                                        </div>
                                        <div className="flex-1 overflow-hidden">
                                            <div className="truncate text-[12px] font-semibold text-zinc-900">{p.name}</div>
                                            <div className="truncate text-[10px] text-zinc-500">{p.role}</div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-[10px] font-medium text-zinc-900">{p.hours}</div>
                                            <div className={`text-[9px] ${p.status === 'online' ? 'text-emerald-600' : p.status === 'break' ? 'text-amber-600' : 'text-zinc-400'}`}>
                                                {statusLabel[p.status]}
                                            </div>
                                        </div>
                                    </m.div>
                                ))}
                            </div>
                        </div>

                        {/* shift heatmap */}
                        <div className="overflow-hidden rounded-2xl border border-zinc-900/10 bg-white shadow-2xl shadow-zinc-900/10 ring-1 ring-zinc-900/5">
                            <div className="flex items-center justify-between border-b border-zinc-200/70 bg-zinc-50/80 px-4 py-2.5">
                                <span className="text-[11px] font-medium text-zinc-700">This week&apos;s coverage</span>
                                <div className="flex items-center gap-2 text-[10px] text-zinc-500">
                                    <Clock className="h-3 w-3" /> 9am–4pm IST
                                    <MoreHorizontal className="h-3 w-3" />
                                </div>
                            </div>
                            <div className="p-4">
                                <div className="grid grid-cols-[36px_repeat(7,1fr)] gap-1 text-[10px]">
                                    <span />
                                    {['9', '10', '11', '12', '1', '2', '3'].map((h) => (
                                        <span key={h} className="text-center text-zinc-500">{h}</span>
                                    ))}
                                    {shifts.map((row, ri) => (
                                        <Fragment key={row.label}>
                                            <span className="self-center text-[10px] font-medium text-zinc-500">{row.label}</span>
                                            {row.cells.map((v, ci) => (
                                                <m.span
                                                    key={`${row.label}-${ci}`}
                                                    initial={{ opacity: 0, scale: 0.6 }}
                                                    whileInView={{ opacity: 1, scale: 1 }}
                                                    viewport={{ once: true }}
                                                    transition={{ delay: 0.04 * (ri * 7 + ci) }}
                                                    className={`h-7 rounded-md ${cellShade(v)}`}
                                                />
                                            ))}
                                        </Fragment>
                                    ))}
                                </div>
                                <div className="mt-4 flex items-center justify-between text-[10px] text-zinc-500">
                                    <span>Low</span>
                                    <div className="flex items-center gap-1">
                                        {[0, 0.4, 0.7, 1].map((v) => <span key={v} className={`h-2.5 w-5 rounded ${cellShade(v)}`} />)}
                                    </div>
                                    <span>Full coverage</span>
                                </div>
                            </div>
                        </div>
                    </m.div>

                    <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-700">
                            HRM · people + payroll
                        </p>
                        <h2 className="mt-4 text-balance text-4xl font-semibold tracking-tight text-zinc-950 sm:text-5xl">
                            One source of truth for your team.
                        </h2>
                        <p className="mt-5 text-pretty text-lg leading-relaxed text-zinc-600">
                            Roster, shifts, attendance, leaves, payroll, payslips, appraisals, holidays,
                            onboarding. Agent presence on SabChat reflects the actual schedule —
                            automatically.
                        </p>
                        <ul className="mt-8 space-y-3 text-[15px] text-zinc-700">
                            {[
                                'Punch-in via web, mobile, kiosk',
                                'Geo-tag & selfie attendance',
                                'Payroll runs with auto-deductions',
                                'Leave balances + approvals',
                                'KPI scorecards + 1:1 reviews',
                            ].map((t) => (
                                <li key={t} className="flex items-center gap-2.5">
                                    <span className="grid h-5 w-5 place-items-center rounded-full bg-cyan-100 text-cyan-700">
                                        <svg viewBox="0 0 12 12" className="h-3 w-3">
                                            <path d="M3 6l2 2 4-4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                                        </svg>
                                    </span>
                                    {t}
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            </div>
        </section>
    );
}
