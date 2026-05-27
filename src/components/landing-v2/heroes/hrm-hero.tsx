'use client';

import { m } from 'motion/react';
import { Calendar, CheckCircle2, Clock, Users, Wallet } from 'lucide-react';

const team = [
    { name: 'Asha', role: 'Designer', status: 'in', color: 'from-zoru-surface-2 to-zoru-ink' },
    { name: 'Rohan', role: 'Engineer', status: 'in', color: 'from-zoru-surface-2 to-zoru-ink' },
    { name: 'Priya', role: 'Ops', status: 'leave', color: 'from-zoru-surface-2 to-zoru-ink' },
    { name: 'Karan', role: 'Sales', status: 'in', color: 'from-zoru-surface-2 to-zoru-ink' },
    { name: 'Maya', role: 'Support', status: 'late', color: 'from-zoru-surface-2 to-zoru-ink' },
    { name: 'Vir', role: 'Finance', status: 'in', color: 'from-zoru-surface-2 to-zoru-ink' },
];

const statusMap = {
    in: { label: 'Punched in', color: 'text-zoru-ink-muted', dot: 'bg-zoru-surface-2' },
    late: { label: '12m late', color: 'text-zoru-ink-muted', dot: 'bg-zoru-surface-2' },
    leave: { label: 'On leave', color: 'text-zoru-ink-muted', dot: 'bg-zoru-surface-2' },
};

export function HrmHero() {
    return (
        <div className="relative h-full w-full">
            <div aria-hidden className="absolute inset-0 rounded-3xl bg-zoru-ink/15 blur-3xl" />

            <m.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="relative h-full w-full overflow-hidden rounded-3xl border border-white/10 bg-zoru-ink/80 p-5 shadow-[0_30px_80px_-20px_rgba(34,211,238,0.5)] backdrop-blur"
            >
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-zoru-ink-muted" />
                        <p className="text-[12px] font-semibold text-white">Today · Mon 27 May</p>
                    </div>
                    <p className="text-[10px] uppercase tracking-wider text-white/60">Geo + Face attendance</p>
                </div>

                {/* roster grid */}
                <div className="mt-5 grid grid-cols-3 gap-2.5">
                    {team.map((p, i) => {
                        const s = statusMap[p.status as keyof typeof statusMap];
                        return (
                            <m.div
                                key={p.name}
                                initial={{ opacity: 0, scale: 0.92 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ delay: 0.15 + i * 0.06 }}
                                whileHover={{ y: -3 }}
                                className="relative rounded-2xl border border-white/5 bg-gradient-to-br from-white/[0.05] to-transparent p-3"
                            >
                                <div className={`grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br ${p.color} text-[12px] font-semibold text-white shadow-md`}>
                                    {p.name[0]}
                                </div>
                                <p className="mt-2 text-[11px] font-semibold text-white">{p.name}</p>
                                <p className="text-[10px] text-white/60">{p.role}</p>
                                <div className="mt-2 flex items-center gap-1.5">
                                    <m.span
                                        animate={{ scale: [1, 1.4, 1] }}
                                        transition={{ duration: 1.6, delay: i * 0.1, repeat: Infinity }}
                                        className={`h-1.5 w-1.5 rounded-full ${s.dot}`}
                                    />
                                    <span className={`text-[9px] font-semibold uppercase tracking-wider ${s.color}`}>{s.label}</span>
                                </div>
                            </m.div>
                        );
                    })}
                </div>

                {/* payroll card */}
                <m.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.7 }}
                    className="mt-5 flex items-center justify-between rounded-2xl border border-zoru-line/30 bg-gradient-to-r from-zoru-ink/15 to-zoru-ink/15 p-4"
                >
                    <div className="flex items-center gap-3">
                        <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-zoru-surface-2 to-zoru-ink shadow-md">
                            <Wallet className="h-5 w-5 text-white" />
                        </div>
                        <div>
                            <p className="text-[10px] uppercase tracking-wider text-white/60">May payroll</p>
                            <p className="text-base font-semibold text-white">
                                <CountUp to={482350} />
                            </p>
                        </div>
                    </div>
                    <button className="rounded-full bg-white px-3 py-1.5 text-[11px] font-semibold text-zoru-ink shadow-md transition hover:scale-[1.04]">
                        Run payroll
                    </button>
                </m.div>

                {/* mini stat row */}
                <div className="mt-4 grid grid-cols-3 gap-2">
                    {[
                        { label: 'Present', value: '4/6', icon: CheckCircle2 },
                        { label: 'Late', value: '1', icon: Clock },
                        { label: 'On leave', value: '1', icon: Calendar },
                    ].map((s, i) => {
                        const SIcon = s.icon;
                        return (
                            <m.div
                                key={s.label}
                                initial={{ opacity: 0, y: 6 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.9 + i * 0.06 }}
                                className="rounded-xl border border-white/5 bg-black/30 p-2.5"
                            >
                                <SIcon className="h-3 w-3 text-zoru-ink-muted" />
                                <p className="mt-1 text-[11px] font-semibold text-white">{s.value}</p>
                                <p className="text-[9px] uppercase tracking-wider text-white/40">{s.label}</p>
                            </m.div>
                        );
                    })}
                </div>
            </m.div>
        </div>
    );
}

function CountUp({ to }: { to: number }) {
    return (
        <m.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
        >
            ₹{to.toLocaleString('en-IN')}
        </m.span>
    );
}
