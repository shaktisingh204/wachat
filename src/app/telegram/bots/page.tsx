import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

/**
 * Legacy `/telegram/bots` lives without the ProjectProvider chain that
 * `/dashboard/telegram/bots/page.tsx` depends on, so it failed at static
 * prerender ("useProject must be used within a ProjectProvider"). The
 * canonical page is under `/dashboard/telegram/bots`; this route is
 * kept as a permanent redirect so any external link still resolves.
 */
export default function LegacyTelegramBotsRedirect(): never {
  redirect('/dashboard/telegram/bots');
}
