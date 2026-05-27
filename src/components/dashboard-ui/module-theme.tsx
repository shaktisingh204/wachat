'use client';

import { type CSSProperties, type ReactNode } from 'react';
import { MODULES_BY_SLUG, type ModuleSlug } from '@/components/landing-v2/modules-data';

/**
 * <ModuleTheme>
 *
 * Sets per-module CSS custom properties on a wrapper div. Every dashboard
 * primitive reads from these vars — never hardcoded colors. Switching the
 * `slug` re-themes the whole subtree.
 *
 * Vars exposed:
 *   --mt-accent          — main accent color, dark enough for text on white
 *   --mt-accent-soft     — same hue, ~10% alpha, for tints + surfaces
 *   --mt-accent-glow     — same hue, ~35% alpha, for shadow tinting
 *   --mt-from / --mt-to  — Tailwind gradient class fragments (e.g. "from-emerald-400")
 *   --mt-surface         — module surface tint on light backgrounds
 *   --mt-ring            — focus ring color
 */

interface ModuleThemeProps {
    slug: ModuleSlug;
    children: ReactNode;
    className?: string;
    as?: 'div' | 'section' | 'article' | 'a';
    href?: string;
    style?: CSSProperties;
}

export function ModuleTheme({ slug, children, className, as = 'div', href, style }: ModuleThemeProps) {
    const mod = MODULES_BY_SLUG[slug];
    const vars: CSSProperties = {
        ['--mt-accent' as string]: mod.accentDeep,
        ['--mt-accent-soft' as string]: hexToRgba(mod.accentDeep, 0.08),
        ['--mt-accent-glow' as string]: mod.glow,
        ['--mt-surface' as string]: mod.surface,
        ['--mt-ring' as string]: hexToRgba(mod.accentDeep, 0.35),
        ['--mt-from' as string]: mod.accentFrom,
        ['--mt-to' as string]: mod.accentTo,
        ...style,
    };

    const Tag = as as any;
    const props: any = { className, style: vars };
    if (href && as === 'a') props.href = href;
    return <Tag {...props}>{children}</Tag>;
}

// Quick hex (#rrggbb) → rgba(). Defensive: returns the original if it can't parse.
function hexToRgba(hex: string, alpha: number) {
    const m = /^#?([a-f\d]{6})$/i.exec(hex.trim());
    if (!m) return hex;
    const n = parseInt(m[1], 16);
    const r = (n >> 16) & 255;
    const g = (n >> 8) & 255;
    const b = n & 255;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// Custom easing curves (Emil — strong ease-out + apple drawer curve)
export const EASE_OUT = [0.23, 1, 0.32, 1] as const;
export const EASE_IN_OUT = [0.77, 0, 0.175, 1] as const;
export const EASE_DRAWER = [0.32, 0.72, 0, 1] as const;
