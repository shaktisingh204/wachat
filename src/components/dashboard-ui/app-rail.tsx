'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { m, AnimatePresence } from 'motion/react';
import { Home, Settings, type LucideIcon } from 'lucide-react';
import { useMemo, useState } from 'react';
import { MODULES_BY_SLUG, type ModuleSlug } from '@/components/landing-v2/modules-data';
import { ModuleTheme, EASE_OUT } from './module-theme';
import { getActiveSlug, isHomePath } from './active-module';

/**
 * App rail — left-aligned vertical icon strip.
 *
 * Each entry is wired to a module slug so the icon, label, and accent
 * pull from `modules-data.ts`. The active item is rendered in its
 * module's full accent gradient with a lift shadow tinted to its glow.
 * Inactive items are quiet zinc; on hover they preview the accent.
 */

interface RailEntry {
    slug: ModuleSlug;
    href: string;
}

/**
 * Items shown by default. Order is intentional — most-used surfaces
 * at the top. Trim or extend in the layout if a workspace needs less.
 */
const DEFAULT_RAIL: RailEntry[] = [
    { slug: 'wachat',         href: '/wachat' },
    { slug: 'sabwa',          href: '/sabwa' },
    { slug: 'sabchat',        href: '/dashboard/sabchat' },
    { slug: 'meta-suite',     href: '/dashboard/facebook' },
    { slug: 'instagram',      href: '/dashboard/instagram' },
    { slug: 'telegram',       href: '/dashboard/telegram' },
    { slug: 'sabflow',        href: '/dashboard/sabflow/flow-builder' },
    { slug: 'crm',            href: '/dashboard/crm' },
    { slug: 'hrm',            href: '/dashboard/hrm' },
    { slug: 'sabmail',        href: '/dashboard/sabmail' },
    { slug: 'sabsms',         href: '/sabsms' },
    { slug: 'sabvoice',       href: '/dashboard/sabvoice' },
    { slug: 'seo',            href: '/dashboard/seo' },
    { slug: 'website-builder',href: '/dashboard/website-builder' },
    { slug: 'url-shortener',  href: '/dashboard/url-shortener' },
    { slug: 'sabfiles',       href: '/dashboard/sabfiles' },
];

export interface AppRailProps {
    items?: RailEntry[];
}

export function AppRail({ items = DEFAULT_RAIL }: AppRailProps) {
    const pathname = usePathname();
    const activeSlug = getActiveSlug(pathname);
    const onHome = isHomePath(pathname);

    return (
        <aside
            aria-label="Modules"
            className="relative z-30 flex h-full w-[68px] shrink-0 flex-col items-center border-r border-zinc-200 bg-white/80 py-3 backdrop-blur-md"
        >
            {/* Brand mark — landing's amber/orange/rose gradient */}
            <Link
                href="/dashboard"
                aria-label="SabNode home"
                className="group relative grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-amber-400 via-orange-500 to-rose-500 text-white shadow-[0_10px_24px_-10px_rgba(244,63,94,0.45)] transition-transform duration-150 ease-out hover:-translate-y-[1px] active:scale-[0.97]"
            >
                <span className="text-[15px] font-black leading-none">S</span>
                {/* subtle highlight */}
                <span
                    aria-hidden
                    className="pointer-events-none absolute inset-0 rounded-xl"
                    style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.35)' }}
                />
            </Link>

            {/* Home dot — neutral, sits below the brand */}
            <div className="mt-3">
                <RailButton
                    label="Home"
                    href="/dashboard"
                    Icon={Home}
                    active={onHome}
                    neutral
                />
            </div>

            {/* separator */}
            <span aria-hidden className="my-3 h-px w-8 bg-zinc-200" />

            {/* Module rail */}
            <nav className="flex min-h-0 flex-1 flex-col items-center gap-1.5 overflow-y-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {items.map((entry, i) => {
                    const mod = MODULES_BY_SLUG[entry.slug];
                    return (
                        <m.div
                            key={entry.slug}
                            initial={{ opacity: 0, x: -4 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.35, delay: 0.02 + i * 0.02, ease: EASE_OUT }}
                        >
                            <ModuleTheme slug={entry.slug}>
                                <RailButton
                                    label={mod.name}
                                    href={entry.href}
                                    Icon={mod.icon}
                                    active={activeSlug === entry.slug && !onHome}
                                />
                            </ModuleTheme>
                        </m.div>
                    );
                })}
            </nav>

            {/* Footer — settings */}
            <div className="mt-2 flex flex-col items-center gap-1.5 border-t border-zinc-200 pt-3">
                <RailButton label="Settings" href="/dashboard/settings" Icon={Settings} active={pathname?.startsWith('/dashboard/settings') ?? false} neutral />
            </div>
        </aside>
    );
}

interface RailButtonProps {
    label: string;
    href: string;
    Icon: LucideIcon;
    active: boolean;
    /** Use a neutral (zinc) theme instead of the surrounding module theme. */
    neutral?: boolean;
}

function RailButton({ label, href, Icon, active, neutral = false }: RailButtonProps) {
    const [hover, setHover] = useState(false);

    return (
        <div className="relative" onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
            {/* Active gradient indicator on the LEFT edge of the rail */}
            <AnimatePresence>
                {active && !neutral && (
                    <m.span
                        aria-hidden
                        layoutId="rail-active-bar"
                        initial={{ opacity: 0, scaleY: 0.6 }}
                        animate={{ opacity: 1, scaleY: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2, ease: EASE_OUT }}
                        className="absolute left-[-9px] top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-r-full"
                        style={{ background: 'var(--mt-accent)', boxShadow: '0 0 12px var(--mt-accent-glow)' }}
                    />
                )}
            </AnimatePresence>

            <Link
                href={href}
                aria-label={label}
                aria-current={active ? 'page' : undefined}
                className="group relative grid h-10 w-10 place-items-center rounded-xl transition-[transform,box-shadow,background-color,color] duration-200 ease-out active:scale-[0.94] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                style={{
                    ['--tw-ring-color' as string]: neutral ? '#18181b' : 'var(--mt-ring)',
                    ['--tw-ring-offset-color' as string]: '#fafaf7',
                    backgroundColor: active && !neutral ? 'var(--mt-accent)' : active && neutral ? '#18181b' : hover ? (neutral ? 'rgba(24,24,27,0.06)' : 'var(--mt-accent-soft)') : 'transparent',
                    color: active ? '#ffffff' : neutral ? '#52525b' : hover ? 'var(--mt-accent)' : '#52525b',
                    boxShadow: active && !neutral ? '0 12px 28px -10px var(--mt-accent-glow)' : 'none',
                }}
            >
                {active && !neutral && (
                    <span
                        aria-hidden
                        className="pointer-events-none absolute inset-0 rounded-xl bg-gradient-to-br opacity-100"
                        style={{
                            backgroundImage: 'linear-gradient(135deg, var(--mt-accent), color-mix(in oklch, var(--mt-accent) 65%, white))',
                        }}
                    />
                )}
                <Icon className="relative h-[18px] w-[18px]" strokeWidth={2} aria-hidden />
            </Link>

            {/* Tooltip — appears on hover. Right of the icon, outside the rail. */}
            <AnimatePresence>
                {hover && (
                    <m.span
                        role="tooltip"
                        initial={{ opacity: 0, x: -4 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -4 }}
                        transition={{ duration: 0.15, ease: EASE_OUT }}
                        className="pointer-events-none absolute left-12 top-1/2 z-50 -translate-y-1/2 whitespace-nowrap rounded-md bg-zinc-900 px-2 py-1 text-[11px] font-medium text-white shadow-lg"
                    >
                        {label}
                    </m.span>
                )}
            </AnimatePresence>
        </div>
    );
}
