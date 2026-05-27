'use client';

import Link from 'next/link';
import { m, AnimatePresence } from 'motion/react';
import {
    ArrowRight,
    ArrowUpRight,
    Check,
    CheckCheck,
    ChevronLeft,
    MessageSquare,
    Phone,
    Send,
    Sparkles,
    type LucideIcon,
} from 'lucide-react';
import { useState, type CSSProperties, type ReactNode } from 'react';
import { ModuleTheme, EASE_OUT } from '@/components/dashboard-ui/module-theme';

/**
 * Wachat UI — bridges the landing-page mockup aesthetic into the real
 * product. Every primitive auto-themes to Wachat's emerald accent via
 * <ModuleTheme slug="wachat">. Drop these inside any /wachat/* page.
 *
 * Design language (from landing-v2 mockups):
 *  - phone-frame chrome for chat surfaces
 *  - composer cards for templates / broadcasts
 *  - emerald gradient brand mark
 *  - rounded-2xl containers, subtle accent shadows
 *  - tabular nums on metrics, sentence-case throughout
 */

// ──────────────────── PAGE CHROME ────────────────────

interface WaPageProps {
    children: ReactNode;
    /** Drop the default max-width when a page needs full-bleed canvas. */
    fullBleed?: boolean;
}

/** Wachat page wrapper. Provides the emerald ModuleTheme so every nested
 *  primitive can read `var(--mt-accent)` etc. */
export function WaPage({ children, fullBleed = false }: WaPageProps) {
    return (
        <ModuleTheme slug="wachat">
            <div
                data-wachat-bold
                className={fullBleed ? 'min-h-full' : 'mx-auto w-full max-w-[1440px] px-5 pb-10 pt-5'}
            >
                {children}
            </div>
        </ModuleTheme>
    );
}

interface PageHeaderProps {
    title: string;
    description?: string;
    kicker?: string;
    backHref?: string;
    actions?: ReactNode;
    eyebrowIcon?: LucideIcon;
}

/** Page header — gradient accent dot, title, subtitle, breadcrumb, action slot. */
export function PageHeader({ title, description, kicker = 'Wachat', backHref, actions, eyebrowIcon: EI = MessageSquare }: PageHeaderProps) {
    return (
        <m.header
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: EASE_OUT }}
            className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"
        >
            <div className="min-w-0">
                <div className="flex items-center gap-2">
                    {backHref && (
                        <Link
                            href={backHref}
                            className="grid h-7 w-7 place-items-center rounded-full border border-zinc-200 bg-white text-zinc-500 transition-colors duration-150 hover:border-zinc-900 hover:text-zinc-900"
                            aria-label="Back"
                        >
                            <ChevronLeft className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden />
                        </Link>
                    )}
                    <span
                        aria-hidden
                        className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.16em]"
                        style={{ color: 'var(--mt-accent)' }}
                    >
                        <EI className="h-3 w-3" strokeWidth={2.25} />
                        {kicker}
                    </span>
                </div>
                <h1 className="mt-0.5 text-balance text-[22px] font-semibold tracking-tight text-zinc-950 md:text-[26px]">
                    {title}
                </h1>
                {description && (
                    <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-zinc-600">{description}</p>
                )}
            </div>
            {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </m.header>
    );
}

// ──────────────────── TABS ────────────────────

export interface TabSpec {
    id: string;
    label: string;
    count?: number;
    href?: string;
}

interface TabsProps {
    items: TabSpec[];
    active: string;
    onChange?: (id: string) => void;
    layoutId?: string;
}

export function Tabs({ items, active, onChange, layoutId = 'wa-tabs' }: TabsProps) {
    return (
        <div className="mb-4 flex flex-wrap gap-1 rounded-full border border-zinc-200 bg-white p-0.5">
            {items.map((t) => {
                const isActive = t.id === active;
                const inner = (
                    <span className={`relative z-10 inline-flex items-center gap-1.5 ${isActive ? 'text-white' : 'text-zinc-600'}`}>
                        {t.label}
                        {typeof t.count === 'number' && (
                            <span className={`rounded-full px-1.5 text-[10px] font-bold tabular-nums ${isActive ? 'bg-white/20' : 'bg-zinc-100 text-zinc-500'}`}>
                                {t.count}
                            </span>
                        )}
                    </span>
                );
                const cls = 'relative rounded-full px-3 py-1 text-[11.5px] font-semibold transition-colors duration-150';
                return (
                    <div key={t.id} className="relative">
                        {isActive && (
                            <m.span
                                layoutId={layoutId}
                                className="absolute inset-0 rounded-full"
                                style={{ background: 'var(--mt-accent)' }}
                                transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                            />
                        )}
                        {t.href ? (
                            <Link href={t.href} className={cls}>{inner}</Link>
                        ) : (
                            <button
                                type="button"
                                onClick={() => onChange?.(t.id)}
                                className={`${cls} active:scale-[0.97]`}
                            >
                                {inner}
                            </button>
                        )}
                    </div>
                );
            })}
        </div>
    );
}

// ──────────────────── METRIC TILE ────────────────────

interface MetricTileProps {
    label: string;
    value: ReactNode;
    delta?: { value: string; positive?: boolean };
    icon?: LucideIcon;
    href?: string;
    delay?: number;
}

export function MetricTile({ label, value, delta, icon: Icon, href, delay = 0 }: MetricTileProps) {
    const inner = (
        <m.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay, ease: EASE_OUT }}
            className="group relative overflow-hidden rounded-xl border border-zinc-200 bg-white p-3.5 transition-[transform,box-shadow] duration-200 ease-out hover:-translate-y-[1px]"
            style={{ boxShadow: '0 0 0 1px transparent' }}
            onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 12px 28px -18px var(--mt-accent-glow)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.boxShadow = '0 0 0 1px transparent'; }}
        >
            <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold uppercase tracking-[0.06em] text-zinc-500">{label}</span>
                {Icon && (
                    <span
                        className="grid h-6 w-6 place-items-center rounded-md text-white"
                        style={{ backgroundColor: '#25D366' }}
                    >
                        <Icon className="h-3 w-3" strokeWidth={2.25} aria-hidden />
                    </span>
                )}
            </div>
            <div className="mt-2 flex items-baseline gap-1.5">
                <span className="text-[22px] font-semibold tracking-tight text-zinc-950 tabular-nums leading-none">{value}</span>
                {delta && (
                    <span className={`text-[11px] font-semibold tabular-nums ${delta.positive ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {delta.positive ? '+' : ''}{delta.value}
                    </span>
                )}
            </div>
        </m.div>
    );
    return href ? <Link href={href} className="block">{inner}</Link> : inner;
}

// ──────────────────── PHONE FRAME (chat preview) ────────────────────

interface PhoneFrameProps {
    title: string;
    subtitle?: string;
    children: ReactNode;
    /** WABA verified badge in the header (default true). */
    verified?: boolean;
}

/**
 * WhatsApp-style phone frame — used in dashboard chat previews, broadcast
 * preview, template preview, etc. Lifts the aesthetic directly from the
 * landing-page Wachat mockup so customers see the same visual language
 * inside the product.
 */
export function PhoneFrame({ title, subtitle, children, verified = true }: PhoneFrameProps) {
    return (
        <div className="relative">
            <div
                aria-hidden
                className="absolute -inset-6 rounded-[2rem] blur-3xl"
                style={{ background: 'var(--mt-accent-glow)', opacity: 0.25 }}
            />
            <div className="relative mx-auto w-full max-w-[320px] overflow-hidden rounded-[2.2rem] border border-zinc-200 bg-[#04130d] shadow-[0_30px_70px_-30px_rgba(16,185,129,0.45)]">
                {/* status bar (subtle) */}
                <div className="flex items-center justify-between border-b border-white/5 px-4 pt-3 pb-1 text-[10px] text-emerald-100/60 tabular-nums">
                    <span>9:41</span>
                    <span className="flex items-center gap-1">
                        <span className="inline-flex h-1.5 w-1.5 rounded-full bg-emerald-300" />
                        WABA
                    </span>
                </div>
                {/* header */}
                <div className="flex items-center justify-between border-b border-white/5 bg-emerald-900/30 px-4 py-2.5">
                    <div className="flex items-center gap-2.5">
                        <div className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-emerald-400 to-teal-500">
                            <MessageSquare className="h-4 w-4 text-white" strokeWidth={2} aria-hidden />
                        </div>
                        <div className="min-w-0">
                            <p className="truncate text-[12.5px] font-semibold text-white">{title}</p>
                            <p className="truncate text-[10px] text-emerald-200/70">
                                {subtitle ?? 'online'}
                                {verified && ' · verified'}
                            </p>
                        </div>
                    </div>
                    <Phone className="h-4 w-4 text-emerald-200/60" strokeWidth={2} aria-hidden />
                </div>
                {/* body */}
                <div className="min-h-[320px] bg-[url('data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22120%22%20height%3D%22120%22%3E%3Crect%20fill%3D%22%23072018%22%20width%3D%22120%22%20height%3D%22120%22%2F%3E%3Cg%20opacity%3D%22.04%22%3E%3Cpath%20d%3D%22M0%200h60v60H0z%22%20fill%3D%22%23fff%22%2F%3E%3C%2Fg%3E%3C%2Fsvg%3E')] p-3">
                    <div className="space-y-2">{children}</div>
                </div>
            </div>
        </div>
    );
}

// Single chat bubble inside <PhoneFrame>.
export function ChatBubble({
    who,
    text,
    time,
    kind,
    delay = 0,
}: {
    who: 'us' | 'them';
    text: ReactNode;
    time?: string;
    kind?: 'template' | 'media' | 'cta';
    delay?: number;
}) {
    const isUs = who === 'us';
    return (
        <m.div
            initial={{ opacity: 0, y: 4, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.3, delay, ease: EASE_OUT }}
            className={`flex ${isUs ? 'justify-end' : 'justify-start'}`}
        >
            <div
                className={`max-w-[80%] rounded-2xl px-3 py-2 text-[12px] leading-snug shadow-sm ${
                    isUs
                        ? kind === 'cta'
                            ? 'rounded-br-sm bg-gradient-to-r from-emerald-400 to-teal-500 font-semibold text-white'
                            : 'rounded-br-sm bg-emerald-500/95 text-white'
                        : 'rounded-bl-sm bg-white/95 text-zinc-800'
                }`}
            >
                {text}
                {time && (
                    <div className={`mt-0.5 text-right text-[9px] ${isUs ? 'text-emerald-50/85' : 'text-zinc-500'}`}>
                        {time}
                        {isUs && <CheckCheck className="ml-1 inline h-2.5 w-2.5" strokeWidth={2.25} aria-hidden />}
                    </div>
                )}
            </div>
        </m.div>
    );
}

// ──────────────────── PROJECT TILE (WABA picker) ────────────────────

interface ProjectTileProps {
    name: string;
    phone?: string;
    waba?: string;
    health?: 'live' | 'warning' | 'paused' | 'unconnected';
    recent?: boolean;
    onSelect: () => void;
    delay?: number;
}

export function ProjectTile({
    name,
    phone,
    waba,
    health = 'unconnected',
    recent,
    onSelect,
    delay = 0,
}: ProjectTileProps) {
    const healthMap: Record<string, { dot: string; label: string; bg: string; text: string }> = {
        live: { dot: 'bg-emerald-500', label: 'Live', bg: 'bg-emerald-50', text: 'text-emerald-700' },
        warning: { dot: 'bg-amber-500', label: 'Quality dipping', bg: 'bg-amber-50', text: 'text-amber-700' },
        paused: { dot: 'bg-zinc-400', label: 'Paused', bg: 'bg-zinc-100', text: 'text-zinc-700' },
        unconnected: { dot: 'bg-rose-400', label: 'Not connected', bg: 'bg-rose-50', text: 'text-rose-700' },
    };
    const h = healthMap[health];

    // 2-letter monogram from the project name (handles single-word names too).
    const initials = (() => {
        const parts = name.trim().split(/\s+/).filter(Boolean);
        if (parts.length === 0) return 'WA';
        if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
        return (parts[0][0] + parts[1][0]).toUpperCase();
    })();

    return (
        <m.button
            type="button"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay, ease: EASE_OUT }}
            onClick={onSelect}
            className="group relative w-full overflow-hidden rounded-xl border border-zinc-200 bg-white p-4 text-left transition-[transform,box-shadow] duration-200 ease-out hover:-translate-y-[1px] active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
            style={{
                boxShadow: '0 0 0 1px transparent',
                ['--tw-ring-color' as any]: 'var(--mt-ring)',
                ['--tw-ring-offset-color' as any]: '#fafaf7',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 18px 40px -22px var(--mt-accent-glow)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.boxShadow = '0 0 0 1px transparent'; }}
        >
            {/* gradient hairline at the very top */}
            <span
                aria-hidden
                className="pointer-events-none absolute inset-x-0 top-0 h-[2px] opacity-0 transition-opacity duration-200 group-hover:opacity-100"
                style={{ backgroundColor: '#25D366' }}
            />

            <div className="flex items-start justify-between gap-3">
                <span
                    className="grid h-9 w-9 place-items-center rounded-lg text-[12px] font-bold text-white shadow-[0_8px_16px_-8px_var(--mt-accent-glow)]"
                    style={{ backgroundColor: '#25D366' }}
                >
                    {initials}
                </span>
                {recent && (
                    <span
                        className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em]"
                        style={{ background: 'var(--mt-accent-soft)', color: 'var(--mt-accent)' }}
                    >
                        Recent
                    </span>
                )}
            </div>

            <h3 className="mt-3 truncate text-[14px] font-semibold tracking-tight text-zinc-950">{name}</h3>

            <dl className="mt-1.5 space-y-0.5">
                {phone && (
                    <div className="flex items-center gap-1.5 text-[11.5px] text-zinc-600">
                        <dt className="sr-only">Phone</dt>
                        <dd className="truncate font-mono tabular-nums">{phone}</dd>
                    </div>
                )}
                {waba && (
                    <div className="flex items-center gap-1.5 text-[11px] text-zinc-500">
                        <dt className="sr-only">WABA</dt>
                        <dd className="truncate font-mono">WABA · {waba.slice(-8)}</dd>
                    </div>
                )}
            </dl>

            <div className="mt-3.5 flex items-center justify-between border-t border-zinc-100 pt-2.5">
                <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${h.bg} ${h.text}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${h.dot}`} aria-hidden />
                    {h.label}
                </span>
                <span className="inline-flex items-center gap-1 text-[11.5px] font-semibold tracking-tight opacity-0 transition-opacity duration-150 group-hover:opacity-100" style={{ color: 'var(--mt-accent)' }}>
                    Open <ArrowRight className="h-3 w-3" strokeWidth={2.5} aria-hidden />
                </span>
            </div>
        </m.button>
    );
}

// ──────────────────── STATUS PILL ────────────────────

export type StatusTone = 'live' | 'queued' | 'sending' | 'sent' | 'failed' | 'paused' | 'draft';
const toneStyles: Record<StatusTone, { bg: string; text: string; dot: string }> = {
    live:    { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
    sent:    { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
    sending: { bg: 'bg-sky-50',     text: 'text-sky-700',     dot: 'bg-sky-500' },
    queued:  { bg: 'bg-amber-50',   text: 'text-amber-700',   dot: 'bg-amber-500' },
    paused:  { bg: 'bg-zinc-100',   text: 'text-zinc-700',    dot: 'bg-zinc-400' },
    draft:   { bg: 'bg-zinc-100',   text: 'text-zinc-600',    dot: 'bg-zinc-400' },
    failed:  { bg: 'bg-rose-50',    text: 'text-rose-700',    dot: 'bg-rose-500' },
};

export function StatusPill({ tone, children }: { tone: StatusTone; children: ReactNode }) {
    const s = toneStyles[tone];
    return (
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.04em] ${s.bg} ${s.text}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} aria-hidden />
            {children}
        </span>
    );
}

// ──────────────────── EMPTY STATE ────────────────────

interface EmptyStateProps {
    icon?: LucideIcon;
    title: string;
    description?: string;
    action?: ReactNode;
}

export function EmptyState({ icon: Icon = Sparkles, title, description, action }: EmptyStateProps) {
    return (
        <m.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: EASE_OUT }}
            className="rounded-2xl border border-zinc-200 bg-white px-5 py-10 text-center"
        >
            <span
                className="mx-auto grid h-10 w-10 place-items-center rounded-lg"
                style={{ background: 'var(--mt-accent-soft)' }}
            >
                <Icon className="h-4 w-4" strokeWidth={2} style={{ color: 'var(--mt-accent)' }} aria-hidden />
            </span>
            <p className="mt-3.5 text-[14px] font-semibold text-zinc-950">{title}</p>
            {description && <p className="mx-auto mt-1 max-w-md text-[12.5px] leading-relaxed text-zinc-600">{description}</p>}
            {action && <div className="mt-4 inline-flex items-center justify-center">{action}</div>}
        </m.div>
    );
}

// ──────────────────── PRIMARY BUTTON (emerald gradient, matches landing CTAs) ────────────────────

interface WaButtonProps {
    href?: string;
    onClick?: () => void;
    leftIcon?: LucideIcon;
    rightIcon?: LucideIcon;
    children: ReactNode;
    variant?: 'solid' | 'outline' | 'ghost';
    size?: 'sm' | 'md';
    disabled?: boolean;
    type?: 'button' | 'submit';
    className?: string;
}

export function WaButton({
    href,
    onClick,
    leftIcon: LI,
    rightIcon: RI,
    children,
    variant = 'solid',
    size = 'md',
    disabled,
    type = 'button',
    className = '',
}: WaButtonProps) {
    const sizes = { sm: 'h-7 px-2.5 text-[11.5px]', md: 'h-9 px-3.5 text-[12.5px]' };
    const base = 'inline-flex items-center justify-center gap-1.5 rounded-full font-semibold transition-[transform,box-shadow,background-color,color] duration-150 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none';
    const style: CSSProperties = {
        ['--tw-ring-color' as any]: 'var(--mt-ring)',
        ['--tw-ring-offset-color' as any]: '#fafaf7',
    };
    if (variant === 'solid') {
        style.color = '#ffffff';
        style.backgroundColor = '#25D366';
        style.boxShadow = '0 12px 28px -12px var(--mt-accent-glow)';
    } else if (variant === 'outline') {
        style.backgroundColor = '#ffffff';
        style.color = '#18181b';
    } else if (variant === 'ghost') {
        style.color = '#3f3f46';
    }
    const variantCls = variant === 'outline' ? 'border border-zinc-200 hover:border-zinc-900' : variant === 'ghost' ? 'hover:bg-zinc-900/[0.05] hover:text-zinc-950' : 'hover:-translate-y-[1px]';

    const inner = (
        <>
            {LI && <LI className={size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5'} strokeWidth={2.25} aria-hidden />}
            {children}
            {RI && <RI className={size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5'} strokeWidth={2.25} aria-hidden />}
        </>
    );
    const cls = `${base} ${sizes[size]} ${variantCls} ${className}`;
    if (href && !disabled) return <Link href={href} className={cls} style={style}>{inner}</Link>;
    return (
        <button type={type} onClick={onClick} disabled={disabled} className={cls} style={style}>
            {inner}
        </button>
    );
}

// ──────────────────── SECTION (card wrapper) ────────────────────

interface SectionProps {
    title?: ReactNode;
    description?: ReactNode;
    action?: ReactNode;
    children: ReactNode;
    padded?: boolean;
    className?: string;
}

export function Section({ title, description, action, children, padded = true, className = '' }: SectionProps) {
    return (
        <m.section
            initial={{ opacity: 0, y: 8 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-10%' }}
            transition={{ duration: 0.4, ease: EASE_OUT }}
            className={`rounded-xl border border-zinc-200 bg-white ${className}`}
        >
            {(title || description || action) && (
                <header className="flex items-center justify-between gap-3 border-b border-zinc-100 px-4 py-2.5">
                    <div className="min-w-0">
                        {title && <h2 className="truncate text-[13px] font-semibold tracking-tight text-zinc-900">{title}</h2>}
                        {description && <p className="mt-0.5 text-[11px] text-zinc-500">{description}</p>}
                    </div>
                    {action}
                </header>
            )}
            <div className={padded ? 'p-4' : ''}>{children}</div>
        </m.section>
    );
}

// ──────────────────── DATA ROW (compact list row) ────────────────────

interface DataRowProps {
    leading?: ReactNode;
    title: ReactNode;
    subtitle?: ReactNode;
    trailing?: ReactNode;
    href?: string;
    delay?: number;
}

export function DataRow({ leading, title, subtitle, trailing, href, delay = 0 }: DataRowProps) {
    const inner = (
        <>
            {leading && <div className="shrink-0">{leading}</div>}
            <div className="min-w-0 flex-1">
                <div className="truncate text-[12.5px] font-medium text-zinc-900">{title}</div>
                {subtitle && <div className="truncate text-[11px] text-zinc-500">{subtitle}</div>}
            </div>
            {trailing && <div className="shrink-0">{trailing}</div>}
        </>
    );
    const cls = 'group flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 transition-colors duration-150 hover:bg-zinc-50';
    return (
        <m.div
            initial={{ opacity: 0, x: -4 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.3, delay, ease: EASE_OUT }}
        >
            {href ? <Link href={href} className={cls}>{inner}</Link> : <div className={cls}>{inner}</div>}
        </m.div>
    );
}

// ──────────────────── TEMPLATE PREVIEW CARD ────────────────────

interface TemplatePreviewProps {
    name: string;
    body: string;
    status?: StatusTone;
    buttons?: string[];
    media?: 'image' | 'video' | 'doc';
    footer?: ReactNode;
}

export function TemplatePreview({ name, body, status, buttons = [], media, footer }: TemplatePreviewProps) {
    return (
        <m.article
            initial={{ opacity: 0, y: 8 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4, ease: EASE_OUT }}
            className="overflow-hidden rounded-2xl border border-zinc-200 bg-white"
        >
            <header className="flex items-center justify-between border-b border-zinc-100 px-4 py-2.5">
                <p className="truncate text-[12.5px] font-semibold text-zinc-900">{name}</p>
                {status && <StatusPill tone={status}>{status}</StatusPill>}
            </header>
            <div className="space-y-2 p-4">
                {media && (
                    <div
                        className="aspect-[16/9] rounded-xl"
                        style={{ background: 'linear-gradient(135deg, var(--mt-accent-soft), white)' }}
                        aria-hidden
                    />
                )}
                <div className="rounded-2xl bg-zinc-50 px-3 py-2.5 text-[12.5px] leading-relaxed text-zinc-800">
                    {body}
                </div>
                {buttons.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                        {buttons.map((b) => (
                            <span
                                key={b}
                                className="rounded-full border bg-white px-2.5 py-1 text-[11.5px] font-semibold"
                                style={{ borderColor: 'var(--mt-accent-soft)', color: 'var(--mt-accent)' }}
                            >
                                {b}
                            </span>
                        ))}
                    </div>
                )}
            </div>
            {footer && <footer className="border-t border-zinc-100 bg-zinc-50/60 px-4 py-2.5">{footer}</footer>}
        </m.article>
    );
}
