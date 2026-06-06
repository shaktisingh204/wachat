import { PageHeader, PageHeaderHeading, PageTitle, PageDescription } from '@/components/sabcrm/20ui';
import { listAdminBusinessHours } from '@/app/actions/sabchat-admin.actions';
import { AdminBusinessHoursClient } from '../_components/admin-business-hours-client';

export const dynamic = 'force-dynamic';

export default async function AdminBusinessHoursPage() {
    const resp = await listAdminBusinessHours();
    const items = resp.items ?? [];

    return (
        <div className="ui20 flex-1 flex flex-col min-h-0 gap-6 p-6">
            <PageHeader>
                <PageHeaderHeading>
                    <PageTitle>Business Hours</PageTitle>
                    <PageDescription>
                        Define working schedules so routing, SLAs, and away messages follow your team's hours.
                    </PageDescription>
                </PageHeaderHeading>
            </PageHeader>
            <div className="flex-1 min-h-0 overflow-y-auto">
                <AdminBusinessHoursClient initialData={items} />
            </div>
        </div>
    );
}
