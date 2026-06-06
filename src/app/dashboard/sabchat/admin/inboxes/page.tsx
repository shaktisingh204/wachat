import { PageHeader, PageHeaderHeading, PageTitle, PageDescription } from '@/components/sabcrm/20ui';
import { listAdminInboxes } from '@/app/actions/sabchat-admin.actions';
import { AdminInboxesClient } from '../_components/admin-inboxes-client';

export const dynamic = 'force-dynamic';

export default async function AdminInboxesPage() {
    const inboxesResp = await listAdminInboxes();
    const inboxes = inboxesResp.items ?? [];

    return (
        <div className="flex-1 flex flex-col min-h-0">
            <PageHeader className="px-4">
                <PageHeaderHeading>
                    <PageTitle>Inboxes</PageTitle>
                    <PageDescription>Manage every shared inbox across your workspace.</PageDescription>
                </PageHeaderHeading>
            </PageHeader>
            <div className="flex-1 overflow-y-auto p-4">
                <AdminInboxesClient initialData={inboxes} />
            </div>
        </div>
    );
}
