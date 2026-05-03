'use client';

import * as React from 'react';
import { m, useMotionValue, useTransform, animate } from 'motion/react';
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';

import { cn } from '@/lib/utils';
import { fadeInUp, hoverLift } from '@/lib/motion';

interface StatCardProps {
    /** Short label above the value (e.g. "Active campaigns"). */
    label: React.ReactNode;
    /** The displayed value — pass a number to opt into count-up animation. */
    value: number | string;
    /** Optional delta for the period — positive number shows "up", negative shows "down". */
    delta?: number;
    /** Suffix appended to the delta (e.g. "%", "vs last week"). */
    deltaLabel?: string;
    /** Optional icon (Lucide) rendered in a colored tile. */
    icon?: React.ComponentType<{ className?: string }>;
    /** Slot for a sparkline / chart underneath. */
    sparkline?: React.ReactNode;
    /** Tone for the icon tile. */
    tone?: 'indigo' | 'cyan' | 'violet' | 'pink' | 'emerald' | 'coral';
    className?: string;
}

const TONE_BACKGROUNDS: Record<NonNullable<StatCardProps['tone']>, string> = {
    indigo: 'linear-gradient(135deg, hsl(var(--prism-indigo)), hsl(var(--prism-violet)))',
    cyan: 'linear-gradient(135deg, hsl(var(--prism-cyan)), hsl(var(--prism-sky)))',
    violet: 'linear-gradient(135deg, hsl(var(--prism-violet)), hsl(var(--prism-pink)))',
    pink: 'linear-gradient(135deg, hsl(var(--prism-pink)), hsl(var(--prism-coral)))',
    emerald: 'linear-gradient(135deg, hsl(var(--prism-emerald)), hsl(var(--prism-cyan)))',
    coral: 'linear-gradient(135deg, hsl(var(--prism-coral)), hsl(var(--prism-pink)))',
};

function CountUp({ value }: { value: number }) {
    const motionValue = useMotionValue(0);
    const display = useTransform(motionValue, (latest) =>
        Math.round(latest).toLocaleString()
    );

    React.useEffect(() => {
        const controls = animate(motionValue, value, {
            duration: 1.0,
            ease: [0.22, 1, 0.36, 1],
        });
        return () => controls.stop();
    }, [value, motionValue]);

    return <m.span>{display}</m.span>;
}

/**
 * StatCard — Prism stat tile.
 *
 *  - When `value` is a number, the value count-ups on mount.
 *  - When `delta` is set, a small chip indicates direction with a coral/emerald accent.
 *  - Optional `sparkline` slot for a tiny chart.
 */
export function StatCard({
    label,
    value,
    delta,
    deltaLabel,
    icon: Icon,
    sparkline,
    tone = 'indigo',
    className,
}: StatCardProps) {
    const direction = delta == null ? 'flat' : delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat';
    const deltaColor =
        direction === 'up'
            ? 'text-[hsl(var(--prism-emerald))] bg-[hsl(var(--prism-emerald)/0.1)]'
            : direction === 'down'
                ? 'text-[hsl(var(--prism-rose))] bg-[hsl(var(--prism-rose)/0.1)]'
                : 'text-muted-foreground bg-muted';
    const DeltaIcon = direction === 'up' ? ArrowUpRight : direction === 'down' ? ArrowDownRight : Minus;

    return (
        <m.div
            variants={fadeInUp}
            initial="hidden"
            animate="visible"
            whileHover={hoverLift}
            className={cn(
                'group relative overflow-hidden rounded-xl border bg-card p-5 shadow-sm transition-all',
                'hover:shadow-[0_0_24px_-4px_hsl(var(--prism-indigo)/0.18),0_8px_20px_-6px_hsl(var(--prism-indigo)/0.12)]',
                'hover:border-[hsl(var(--prism-indigo)/0.3)]',
                className
            )}
        >
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        {label}
                    </p>
                    <div className="mt-2 text-3xl font-bold tracking-tight tabular-nums text-foreground">
                        {typeof value === 'number' ? <CountUp value={value} /> : value}
                    </div>
                </div>

                {Icon && (
                    <div
                        className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-white shadow-sm"
                        style={{ background: TONE_BACKGROUNDS[tone] }}
                    >
                        <Icon className="h-5 w-5" />
                    </div>
                )}
            </div>

            {(delta != null || deltaLabel) && (
                <div className="mt-3 flex items-center gap-2">
                    {delta != null && (
                        <span
                            className={cn(
                                'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold',
                                deltaColor
                            )}
                        >
                            <DeltaIcon className="h-3 w-3" />
                            {Math.abs(delta).toLocaleString()}%
                        </span>
                    )}
                    {deltaLabel && (
                        <span className="text-xs text-muted-foreground">{deltaLabel}</span>
                    )}
                </div>
            )}

            {sparkline && <div className="mt-4">{sparkline}</div>}
        </m.div>
    );
}
