import { Card, CardBody, CardHeader, CardTitle } from '@/components/sabcrm/20ui';
import { listMarketplaceApps } from '@/app/actions/sabchat-admin.actions';
import { AdminMarketplaceClient } from './_components/admin-marketplace-client';

export const dynamic = 'force-dynamic';

export default async function AdminMarketplacePage() {
    const appsResp = await listMarketplaceApps();
    const apps = appsResp.items ?? [];

    return (
        <Card className="flex-1 flex flex-col min-h-0 border-0 rounded-none shadow-none">
            <CardHeader>
                <CardTitle>Marketplace</CardTitle>
            </CardHeader>
            <CardBody className="flex-1 overflow-y-auto">
                <AdminMarketplaceClient initialData={apps} />
            </CardBody>
        </Card>
    );
}
