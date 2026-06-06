import { Card, ZoruCardContent, ZoruCardHeader, ZoruCardTitle } from '@/components/sabcrm/20ui/compat';
import { listAdminTeams } from '@/app/actions/sabchat-admin.actions';
import { AdminTeamsClient } from '../_components/admin-teams-client';

export const dynamic = 'force-dynamic';

export default async function AdminTeamsPage() {
    const resp = await listAdminTeams();
    const items = resp.items ?? [];

    return (
        <Card className="flex-1 flex flex-col min-h-0 border-0 rounded-none shadow-none">
            <ZoruCardHeader>
                <ZoruCardTitle>Teams</ZoruCardTitle>
            </ZoruCardHeader>
            <ZoruCardContent className="flex-1 overflow-y-auto">
                <AdminTeamsClient initialData={items} />
            </ZoruCardContent>
        </Card>
    );
}
