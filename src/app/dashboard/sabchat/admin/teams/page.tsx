import { Card, CardBody, CardHeader, CardTitle } from '@/components/sabcrm/20ui';
import { listAdminTeams } from '@/app/actions/sabchat-admin.actions';
import { AdminTeamsClient } from '../_components/admin-teams-client';

export const dynamic = 'force-dynamic';

export default async function AdminTeamsPage() {
    const resp = await listAdminTeams();
    const items = resp.items ?? [];

    return (
        <Card className="flex-1 flex flex-col min-h-0 border-0 rounded-none shadow-none">
            <CardHeader>
                <CardTitle>Teams</CardTitle>
            </CardHeader>
            <CardBody className="flex-1 overflow-y-auto">
                <AdminTeamsClient initialData={items} />
            </CardBody>
        </Card>
    );
}
