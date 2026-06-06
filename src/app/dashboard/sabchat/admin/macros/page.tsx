import {
    PageHeader,
    PageHeaderHeading,
    PageTitle,
    PageDescription,
} from '@/components/sabcrm/20ui';
import { listAdminMacros } from '@/app/actions/sabchat-admin.actions';
import { AdminMacrosClient } from '../_components/admin-macros-client';

export const dynamic = 'force-dynamic';

export default async function AdminMacrosPage() {
    const resp = await listAdminMacros();
    const items = resp.items ?? [];

    return (
        <div className="ui20 flex flex-1 flex-col min-h-0">
            <PageHeader compact className="px-4 pt-4">
                <PageHeaderHeading>
                    <PageTitle>Macros</PageTitle>
                    <PageDescription>
                        Reusable canned replies your team can insert into conversations.
                    </PageDescription>
                </PageHeaderHeading>
            </PageHeader>
            <div className="flex-1 overflow-y-auto p-4">
                <AdminMacrosClient initialData={items} />
            </div>
        </div>
    );
}
