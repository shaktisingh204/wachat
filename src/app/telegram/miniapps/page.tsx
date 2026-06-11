import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

/**
 * Legacy `/telegram/miniapps` was a stale fork of the canonical page and
 * lived without the ProjectProvider chain it depends on, so it crashed at
 * runtime ("useProject must be used within a ProjectProvider") — same
 * failure mode as the old `/telegram/bots`. The canonical page is under
 * `/dashboard/telegram/mini-apps`; this route is kept as a permanent
 * redirect so any external link still resolves.
 */
export default function LegacyTelegramMiniAppsRedirect(): never {
  redirect('/dashboard/telegram/mini-apps');
}
