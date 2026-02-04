import {
    wachatMenuItems, crmMenuGroups, teamMenuItems, sabChatMenuItems,
    facebookMenuGroups, instagramMenuGroups, adManagerMenuItems,
    emailMenuItems, smsMenuItems, apiMenuItems, sabflowMenuItems,
    urlShortenerMenuItems, qrCodeMakerMenuItems, portfolioMenuItems, seoMenuItems,
    MenuItem
} from '@/config/dashboard-config';

// Flatten all menu items into a single array for searching
const allMenuItems = [
    ...wachatMenuItems,
    ...crmMenuGroups.flatMap(group => group.items),
    ...teamMenuItems,
    ...sabChatMenuItems,
    ...facebookMenuGroups.flatMap(group => group.items),
    ...instagramMenuGroups.flatMap(group => group.items),
    ...adManagerMenuItems,
    ...emailMenuItems,
    ...smsMenuItems,
    ...apiMenuItems,
    ...sabflowMenuItems,
    ...urlShortenerMenuItems,
    ...qrCodeMakerMenuItems,
    ...portfolioMenuItems,
    ...seoMenuItems,
];

// Cache for quick lookups
const permissionCache = new Map<string, string | undefined>();

export function getRequiredPermissionForPath(pathname: string): string | undefined {
    // Check cache first
    if (permissionCache.has(pathname)) {
        return permissionCache.get(pathname);
    }

    // Try exact match first
    const exactMatch = allMenuItems.find(item => item.href === pathname);
    if (exactMatch && exactMatch.permissionKey) {
        permissionCache.set(pathname, exactMatch.permissionKey);
        return exactMatch.permissionKey;
    }

    // Try finding the longest matching prefix (handles sub-routes like /details/123)
    // Sort items by href length descending to ensure we match the specific route, not just the parent
    const sortedItems = [...allMenuItems].sort((a, b) => b.href.length - a.href.length);

    // Clean trailing slash for matching
    const cleanPath = pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;

    for (const item of sortedItems) {
        const itemHref = item.href.endsWith('/') ? item.href.slice(0, -1) : item.href;

        // Exact match or prefix match
        if (cleanPath === itemHref || cleanPath.startsWith(`${itemHref}/`)) {
            if (item.permissionKey) {
                permissionCache.set(pathname, item.permissionKey);
                return item.permissionKey;
            }
        }
    }

    permissionCache.set(pathname, undefined);
    return undefined;
}
