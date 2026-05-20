/**
 * HRM Employee Self-Service Portal — server page.
 *
 * All data is fetched in parallel server-side and passed as props to the
 * client PortalShell. The layout already guarantees a valid profile exists
 * before rendering this page.
 */

import { getSession } from '@/app/actions/user.actions';
import {
    getMyEmployeeProfile,
    getMyDirectReports,
    getMyAssignedTasks,
    getMyCreatedTasks,
    getPortalKpis,
} from '@/app/actions/hrm-portal.actions';
import { PortalShell } from './_components/portal-shell';

export const dynamic = 'force-dynamic';

export default async function HrmPortalPage() {
    const session = await getSession();
    // Layout guarantees session + profile exist, but we guard defensively.
    if (!session?.user) return null;

    const uid = String(session.user._id);

    const [profile, team, myTasks, createdTasks, kpis] = await Promise.all([
        getMyEmployeeProfile(uid),
        getMyDirectReports(),
        getMyAssignedTasks(),
        getMyCreatedTasks(),
        getPortalKpis(),
    ]);

    // Layout already checked profile exists — this guard is belt-and-suspenders.
    if (!profile) return null;

    return (
        <PortalShell
            profile={profile}
            kpis={kpis}
            team={team}
            myTasks={myTasks}
            createdTasks={createdTasks}
        />
    );
}
