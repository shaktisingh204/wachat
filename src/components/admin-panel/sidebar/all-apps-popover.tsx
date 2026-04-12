'use client';

// This file is kept for backward compatibility but the "more apps" popover
// is now handled inline inside app-rail.tsx.
// Export a no-op component so existing imports don't break.
export function AllAppsPopover({ activeApp }: { activeApp?: string }) {
    return null;
}
