import { Card, ZoruCardContent, ZoruCardHeader, ZoruCardTitle } from '@/components/sabcrm/20ui/compat';
import { listAdminDispositions } from '@/app/actions/sabchat-admin.actions';
import { AdminDispositionsClient } from '../_components/admin-dispositions-client';

export const dynamic = 'force-dynamic';

export default async function AdminDispositionsPage() {
    const resp = await listAdminDispositions();
    const items = resp.items ?? [];

    return (
        <Card className="flex-1 flex flex-col min-h-0 border-0 rounded-none shadow-none">
            <ZoruCardHeader>
                <ZoruCardTitle>Dispositions</ZoruCardTitle>
            </ZoruCardHeader>
            <ZoruCardContent className="flex-1 overflow-y-auto">
                <AdminDispositionsClient initialData={items} />
            </ZoruCardContent>
        </Card>
    );
}
