import { PageHeader, PageHeaderHeading, PageTitle, PageDescription } from '@/components/sabcrm/20ui';
import { listAdminTeams } from '@/app/actions/sabchat-admin.actions';
import { AdminTeamsClient } from '../_components/admin-teams-client';

export const dynamic = 'force-dynamic';

export default async function AdminTeamsPage() {
    const resp = await listAdminTeams();
    const items = resp.items ?? [];

    return (
        <div className="flex flex-1 min-h-0 flex-col">
            <PageHeader>
                <PageHeaderHeading>
                    <PageTitle>Teams</PageTitle>
                    <PageDescription>Group your agents into teams to route and manage conversations.</PageDescription>
                </PageHeaderHeading>
            </PageHeader>
            <div className="flex-1 overflow-y-auto p-6">
                <AdminTeamsClient initialData={items} />
            </div>
        </div>
    );
}
