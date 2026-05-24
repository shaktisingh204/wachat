/**
 * HRM Employee Self-Service Portal — server page.
 *
 * Data is fetched server-side and passed as props to the client PortalShell.
 * The layout already guarantees a valid profile exists before rendering this page.
 */

import { Suspense } from 'react';
import { getSession } from '@/app/actions/user.actions';
import {
    getMyEmployeeProfile,
    getMyDirectReports,
    getMyAssignedTasks,
    getMyCreatedTasks,
    getPortalKpis,
} from '@/app/actions/hrm-portal.actions';
import { PortalShell } from './_components/portal-shell';
import PortalLoading from './loading';

export const dynamic = 'force-dynamic';

async function PortalDataFetcher({ uid }: { uid: string }) {
    const [profile, team, myTasks, createdTasks, kpis] = await Promise.all([
        getMyEmployeeProfile(uid),
        getMyDirectReports(),
        getMyAssignedTasks(),
        getMyCreatedTasks(),
        getPortalKpis(),
    ]);

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

export default async function HrmPortalPage() {
    const session = await getSession();
    if (!session?.user) return null;

    const uid = String(session.user._id);

    return (
        <Suspense fallback={<PortalLoading />}>
            <PortalDataFetcher uid={uid} />
        </Suspense>
    );
}
