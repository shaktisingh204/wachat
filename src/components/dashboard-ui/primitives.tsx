'use client';

import Link from 'next/link';
import { m } from 'motion/react';
import { ArrowUpRight, type LucideIcon } from 'lucide-react';
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { EASE_OUT } from './module-theme';

/**
 * Dashboard primitives. Token-driven (via <ModuleTheme>), no ZoruUI imports,
 * no hardcoded color classes that fight the per-module theme.
 *
 * Motion principles (Emil):
 *  - transform + opacity only
 *  - ease-out for entering, ease for hover
 *  - durations 150-220ms
 *  - scale(0.97) on :active
 *  - never animate from scale(0)
 *  - tinted shadows via --mt-accent-glow
 */

// ───────────────── Tile ─────────────────
// The control-room module tile. Reads its theme from the surrounding
// <ModuleTheme>. Spring on hover, scale on press, accent-tinted lift shadow.
interface TileProps {
    href: string;
    icon: LucideIcon;
    name: string;
    tag: string;
    size?: 'sm' | 'md' | 'lg';
    indicator?: ReactNode; // top-right slot (badge, count, dot)
    footer?: ReactNode;    // bottom slot (stats, mini sparkline)
    className?: string;
    delay?: number;
}

export function Tile({ href, icon: Icon, name, tag, size = 'md', indicator, footer, className = '', delay = 0 }: TileProps) {
    const sizeCls =
        size === 'lg' ? 'min-h-[224px] p-6'
        : size === 'sm' ? 'min-h-[132px] p-4'
        : 'min-h-[168px] p-5';

    return (
        <m.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay, ease: EASE_OUT }}
            className={className}
        >
            <Link
                href={href}
                className={`group relative block ${sizeCls} overflow-hidden rounded-2xl border bg-white outline-none transition-[transform,box-shadow] duration-200 ease-out hover:-translate-y-[2px] active:scale-[0.985] focus-visible:ring-2 focus-visible:ring-offset-2`}
                style={{
                    borderColor: 'rgba(24, 24, 27, 0.08)',
                    boxShadow: '0 0 0 1px transparent',
                    transformOrigin: 'center',
                    ['--tw-ring-color' as string]: 'var(--mt-ring)',
                    ['--tw-ring-offset-color' as string]: '#fafaf7',
                }}
                // hover applies accent-tinted shadow inline so we don't fight Tailwind cascade
                onMouseEnter={(e) => {
                    e.currentTarget.style.boxShadow = '0 18px 40px -20px var(--mt-accent-glow), inset 0 0 0 1px var(--mt-accent-soft)';
                }}
                onMouseLeave={(e) => {
                    e.currentTarget.style.boxShadow = '0 0 0 1px transparent';
                }}
            >
                <div className="relative flex items-start justify-between">
                    <IconBadge icon={Icon} />
                    {indicator}
                </div>

                <div className="relative mt-4">
                    <div className="flex items-baseline gap-1.5">
                        <h3 className="text-[15px] font-semibold tracking-tight text-zinc-950">{name}</h3>
                        <ArrowUpRight
                            className="h-3.5 w-3.5 opacity-0 transition-[opacity,transform] duration-150 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:opacity-100"
                            style={{ color: 'var(--mt-accent)' }}
                            aria-hidden
                        />
                    </div>
                    <p className="mt-0.5 truncate text-[12px] text-zinc-500">{tag}</p>
                </div>

                {footer && <div className="relative mt-4">{footer}</div>}
            </Link>
        </m.div>
    );
}

// ───────────────── IconBadge ─────────────────
// Square-rounded icon container with the module's accent gradient.
// Optical centering: lucide icons render visually balanced at 18px in a 40px box.
export function IconBadge({ icon: Icon, size = 'md' }: { icon: LucideIcon; size?: 'sm' | 'md' | 'lg' }) {
    const box = size === 'lg' ? 'h-12 w-12' : size === 'sm' ? 'h-8 w-8' : 'h-10 w-10';
    const ic = size === 'lg' ? 'h-5 w-5' : size === 'sm' ? 'h-3.5 w-3.5' : 'h-[18px] w-[18px]';
    return (
        <span
            className={`grid ${box} place-items-center rounded-xl text-white shadow-[0_6px_18px_-8px_var(--mt-accent-glow)]`}
            style={{ backgroundImage: 'linear-gradient(135deg, var(--mt-accent), color-mix(in oklch, var(--mt-accent) 70%, white))' }}
        >
            <Icon className={ic} strokeWidth={2} />
        </span>
    );
}

// ───────────────── Pill ─────────────────
// Small chip used for status, plan, counts. Tone-aware.
export function Pill({
    children,
    tone = 'neutral',
    className = '',
}: {
    children: ReactNode;
    tone?: 'neutral' | 'accent' | 'positive' | 'attention' | 'critical';
    className?: string;
}) {
    const toneCls: Record<string, string> = {
        neutral: 'bg-zinc-100 text-zinc-700',
        accent: '', // styled via inline below
        positive: 'bg-emerald-50 text-emerald-700',
        attention: 'bg-amber-50 text-amber-700',
        critical: 'bg-rose-50 text-rose-700',
    };
    const style = tone === 'accent' ? { background: 'var(--mt-accent-soft)', color: 'var(--mt-accent)' } : undefined;
    return (
        <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.04em] ${toneCls[tone]} ${className}`}
            style={style}
        >
            {children}
        </span>
    );
}

// ───────────────── Button ─────────────────
type ButtonVariant = 'solid' | 'soft' | 'ghost' | 'outline';
type ButtonSize = 'sm' | 'md';
interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: ButtonVariant;
    size?: ButtonSize;
    leftIcon?: LucideIcon;
    rightIcon?: LucideIcon;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
    { variant = 'solid', size = 'md', leftIcon: LI, rightIcon: RI, className = '', children, ...rest },
    ref,
) {
    const base =
        'inline-flex items-center justify-center gap-1.5 rounded-full font-semibold transition-[transform,box-shadow,background-color,color] duration-150 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 disabled:opacity-50 disabled:pointer-events-none';
    const sizes: Record<ButtonSize, string> = {
        sm: 'h-8 px-3 text-[12px]',
        md: 'h-10 px-4 text-[13px]',
    };
    const variants: Record<ButtonVariant, string> = {
        solid: 'text-white shadow-[0_10px_24px_-12px_var(--mt-accent-glow)]',
        soft: '',
        ghost: 'text-zinc-700 hover:bg-zinc-900/5 hover:text-zinc-950',
        outline: 'border border-zinc-200 text-zinc-900 hover:border-zinc-900 bg-white',
    };
    const style: any = {};
    if (variant === 'solid') style.backgroundColor = 'var(--mt-accent)';
    if (variant === 'soft') {
        style.backgroundColor = 'var(--mt-accent-soft)';
        style.color = 'var(--mt-accent)';
    }
    style['--tw-ring-color'] = 'var(--mt-ring)';

    return (
        <button ref={ref} className={`${base} ${sizes[size]} ${variants[variant]} ${className}`} style={style} {...rest}>
            {LI && <LI className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden />}
            {children}
            {RI && <RI className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden />}
        </button>
    );
});

// ───────────────── Stat ─────────────────
// Compact metric with optional delta + sparkline. Tabular nums for digit-alignment.
interface StatProps {
    label: string;
    value: string;
    delta?: { value: string; positive?: boolean };
    spark?: number[];
    delay?: number;
    icon?: LucideIcon;
}

export function Stat({ label, value, delta, spark, icon: Icon, delay = 0 }: StatProps) {
    return (
        <m.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay, ease: EASE_OUT }}
            className="group relative rounded-2xl border border-zinc-200 bg-white p-4"
        >
            <div className="flex items-center justify-between">
                <span className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-zinc-500">
                    {label}
                </span>
                {Icon && <Icon className="h-3.5 w-3.5 text-zinc-400" strokeWidth={2} aria-hidden />}
            </div>
            <div className="mt-2 flex items-baseline gap-2">
                <span className="text-[26px] font-semibold tracking-tight text-zinc-950 tabular-nums">{value}</span>
                {delta && (
                    <span
                        className={`text-[11px] font-semibold tabular-nums ${
                            delta.positive ? 'text-emerald-600' : 'text-rose-600'
                        }`}
                    >
                        {delta.positive ? '+' : ''}{delta.value}
                    </span>
                )}
            </div>
            {spark && spark.length > 1 && <Sparkline points={spark} />}
        </m.div>
    );
}

function Sparkline({ points }: { points: number[] }) {
    const w = 100;
    const h = 22;
    const max = Math.max(...points, 1);
    const min = Math.min(...points, 0);
    const span = Math.max(max - min, 1);
    const step = w / (points.length - 1);
    const d = points
        .map((p, i) => {
            const x = i * step;
            const y = h - ((p - min) / span) * (h - 2) - 1;
            return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`;
        })
        .join(' ');
    return (
        <svg viewBox={`0 0 ${w} ${h}`} className="mt-2 h-5 w-full">
            <path d={d} fill="none" stroke="var(--mt-accent)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            <path d={`${d} L${w} ${h} L0 ${h} Z`} fill="var(--mt-accent-soft)" />
        </svg>
    );
}

// ───────────────── Card ─────────────────
// Container with optional header. No drop shadow by default — uses spacing/border.
interface CardProps {
    title?: ReactNode;
    action?: ReactNode;
    children: ReactNode;
    className?: string;
    padded?: boolean;
}

export function Card({ title, action, children, className = '', padded = true }: CardProps) {
    return (
        <div className={`rounded-2xl border border-zinc-200 bg-white ${className}`}>
            {(title || action) && (
                <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-3">
                    {title && <h3 className="text-sm font-semibold tracking-tight text-zinc-900">{title}</h3>}
                    {action}
                </div>
            )}
            <div className={padded ? 'p-5' : ''}>{children}</div>
        </div>
    );
}

// ───────────────── ActivityRow ─────────────────
// Row used in feeds. Reads accent from surrounding <ModuleTheme>.
interface ActivityRowProps {
    icon: LucideIcon;
    title: string;
    meta: string;
    timestamp: string;
    href?: string;
    delay?: number;
}

export function ActivityRow({ icon: Icon, title, meta, timestamp, href, delay = 0 }: ActivityRowProps) {
    const inner = (
        <>
            <span
                className="grid h-9 w-9 shrink-0 place-items-center rounded-lg"
                style={{ background: 'var(--mt-accent-soft)' }}
            >
                <Icon className="h-4 w-4" strokeWidth={2} style={{ color: 'var(--mt-accent)' }} aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium text-zinc-900">{title}</p>
                <p className="truncate text-[11.5px] text-zinc-500">{meta}</p>
            </div>
            <span className="shrink-0 text-[11px] tabular-nums text-zinc-400">{timestamp}</span>
        </>
    );
    const cls = 'group flex items-center gap-3 rounded-xl px-2 py-2 transition-colors duration-150 hover:bg-zinc-50';
    return (
        <m.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay, ease: EASE_OUT }}
        >
            {href ? (
                <Link href={href} className={cls}>
                    {inner}
                </Link>
            ) : (
                <div className={cls}>{inner}</div>
            )}
        </m.div>
    );
}
