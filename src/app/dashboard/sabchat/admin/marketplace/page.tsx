import { PageHeader, PageHeaderHeading, PageTitle, PageDescription } from '@/components/sabcrm/20ui';
import { listMarketplaceApps } from '@/app/actions/sabchat-admin.actions';
import { AdminMarketplaceClient } from './_components/admin-marketplace-client';

export const dynamic = 'force-dynamic';

export default async function AdminMarketplacePage() {
    const appsResp = await listMarketplaceApps();
    const apps = appsResp.items ?? [];

    return (
        <div className="flex-1 flex flex-col min-h-0">
            <PageHeader>
                <PageHeaderHeading>
                    <PageTitle>Marketplace</PageTitle>
                    <PageDescription>Browse and install apps for your SabChat workspace.</PageDescription>
                </PageHeaderHeading>
            </PageHeader>
            <div className="flex-1 overflow-y-auto">
                <AdminMarketplaceClient initialData={apps} />
            </div>
        </div>
    );
}
