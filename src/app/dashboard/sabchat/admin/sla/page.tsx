import { PageHeader, PageHeaderHeading, PageTitle, PageDescription } from '@/components/sabcrm/20ui';
import { listAdminSla } from '@/app/actions/sabchat-admin.actions';
import { AdminSlaClient } from '../_components/admin-sla-client';

export const dynamic = 'force-dynamic';

export default async function AdminSlaPage() {
    const resp = await listAdminSla();
    const items = resp.items ?? [];

    return (
        <div className="20ui flex-1 flex flex-col min-h-0 gap-6 p-6">
            <PageHeader>
                <PageHeaderHeading>
                    <PageTitle>Service Level Agreements</PageTitle>
                    <PageDescription>
                        Set first-response and resolution targets so conversations are answered and closed on time.
                    </PageDescription>
                </PageHeaderHeading>
            </PageHeader>
            <div className="flex-1 min-h-0 overflow-y-auto">
                <AdminSlaClient initialData={items} />
            </div>
        </div>
    );
}
