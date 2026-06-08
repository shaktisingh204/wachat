import { PageHeader, PageHeaderHeading, PageTitle, PageDescription } from '@/components/sabcrm/20ui';
import { listAdminDispositions } from '@/app/actions/sabchat-admin.actions';
import { AdminDispositionsClient } from '../_components/admin-dispositions-client';

export const dynamic = 'force-dynamic';

export default async function AdminDispositionsPage() {
    const resp = await listAdminDispositions();
    const items = resp.items ?? [];

    return (
        <div className="20ui flex flex-1 flex-col gap-6 min-h-0 p-6">
            <PageHeader>
                <PageHeaderHeading>
                    <PageTitle>Dispositions</PageTitle>
                    <PageDescription>
                        Define the outcomes agents can tag on conversations.
                    </PageDescription>
                </PageHeaderHeading>
            </PageHeader>
            <div className="flex-1 overflow-y-auto">
                <AdminDispositionsClient initialData={items} />
            </div>
        </div>
    );
}
