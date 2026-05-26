import { Card, ZoruCardContent, ZoruCardHeader, ZoruCardTitle } from '@/components/zoruui';
import { listAdminMacros } from '@/app/actions/sabchat-admin.actions';
import { AdminMacrosClient } from '../_components/admin-macros-client';

export const dynamic = 'force-dynamic';

export default async function AdminMacrosPage() {
    const resp = await listAdminMacros();
    const items = resp.items ?? [];

    return (
        <Card className="flex-1 flex flex-col min-h-0 border-0 rounded-none shadow-none">
            <ZoruCardHeader>
                <ZoruCardTitle>Macros</ZoruCardTitle>
            </ZoruCardHeader>
            <ZoruCardContent className="flex-1 overflow-y-auto">
                <AdminMacrosClient initialData={items} />
            </ZoruCardContent>
        </Card>
    );
}
