import { redirect } from 'next/navigation';
import { canServer } from '@/lib/rbac-server';

export const dynamic = 'force-dynamic';

export default async function TeamLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    // Any view on /dashboard/team/* requires at least `team_users.view`.
    // Owners and admins pass automatically; agents with no team permission
    // bounce to the main dashboard.
    const allowed = await canServer('team_users', 'view');
    if (!allowed) redirect('/wachat');

    // Clay chrome handles page padding; each page owns its own `clay-enter`
    // wrapper and vertical rhythm, so this layout is a plain pass-through.
    return <>{children}</>;
}
