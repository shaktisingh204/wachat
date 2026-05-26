import { ObjectId } from 'mongodb';

import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';
import { DashboardsList, type SerializedDashboard } from './_components/dashboards-list';

export const dynamic = 'force-dynamic';

async function loadDashboards(): Promise<{
    dashboards: SerializedDashboard[];
    loadError: boolean;
}> {
    try {
        const session = await getSession();
        if (!session?.user?._id) return { dashboards: [], loadError: false };
        const { db } = await connectToDatabase();
        const userObjectId = new ObjectId(session.user._id as string);
        const docs = await db
            .collection('crm_dashboards')
            .find({ userId: userObjectId })
            .sort({ createdAt: -1 })
            .limit(200)
            .toArray();
        return {
            dashboards: JSON.parse(JSON.stringify(docs)) as SerializedDashboard[],
            loadError: false,
        };
    } catch (e) {
        console.error('Failed to load CRM dashboards:', e);
        return { dashboards: [], loadError: true };
    }
}

export default async function CustomDashboardsPage() {
    const { dashboards, loadError } = await loadDashboards();
    return <DashboardsList dashboards={dashboards} loadError={loadError} />;
}
