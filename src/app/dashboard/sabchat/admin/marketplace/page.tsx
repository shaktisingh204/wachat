import { Card, ZoruCardContent, ZoruCardHeader, ZoruCardTitle } from '@/components/zoruui';
import { listMarketplaceApps } from '@/app/actions/sabchat-admin.actions';
import { AdminMarketplaceClient } from './_components/admin-marketplace-client';

export const dynamic = 'force-dynamic';

export default async function AdminMarketplacePage() {
    const appsResp = await listMarketplaceApps();
    const apps = appsResp.items ?? [];

    return (
        <Card className="flex-1 flex flex-col min-h-0 border-0 rounded-none shadow-none">
            <ZoruCardHeader>
                <ZoruCardTitle>Marketplace</ZoruCardTitle>
            </ZoruCardHeader>
            <ZoruCardContent className="flex-1 overflow-y-auto">
                <AdminMarketplaceClient initialData={apps} />
            </ZoruCardContent>
        </Card>
    );
}
