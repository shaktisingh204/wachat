import { MODULES_BY_SLUG, type ModuleSlug } from '@/components/landing-v2/modules-data';

// Map known top-level path prefixes to module slugs so we can theme the
// shell + rail when the user is inside any of them. Legacy non-/dashboard
// routes (/wachat, /sabwa) are intentionally included.
const PREFIX_MAP: Record<string, ModuleSlug> = {
    '/wachat': 'wachat',
    '/sabwa': 'sabwa',
    '/sabsms': 'sabsms',
};

const ALL_SLUGS = new Set<ModuleSlug>(Object.keys(MODULES_BY_SLUG) as ModuleSlug[]);

/** Resolve the active module slug from a pathname. Falls back to `wachat` for theming neutrality. */
export function getActiveSlug(pathname: string | null | undefined): ModuleSlug {
    if (!pathname) return 'wachat';

    // /dashboard/<slug>/...
    const dashMatch = /^\/dashboard\/([a-z-]+)/.exec(pathname);
    if (dashMatch) {
        const candidate = dashMatch[1] as ModuleSlug;
        if (ALL_SLUGS.has(candidate)) return candidate;
    }

    // Legacy / top-level
    for (const prefix in PREFIX_MAP) {
        if (pathname === prefix || pathname.startsWith(`${prefix}/`)) return PREFIX_MAP[prefix];
    }

    return 'wachat';
}

/** True when the URL is the dashboard root or one of its first-class home routes. */
export function isHomePath(pathname: string | null | undefined): boolean {
    if (!pathname) return false;
    return pathname === '/dashboard' || pathname === '/dashboard/' || pathname === '/';
}
