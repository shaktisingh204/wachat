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
    if (!allowed) redirect('/dashboard');

    return <div className="flex flex-col gap-6 h-full">{children}</div>;
}
