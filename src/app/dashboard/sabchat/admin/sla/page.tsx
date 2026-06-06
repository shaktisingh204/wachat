import { Card, ZoruCardContent, ZoruCardHeader, ZoruCardTitle } from '@/components/sabcrm/20ui/compat';
import { listAdminSla } from '@/app/actions/sabchat-admin.actions';
import { AdminSlaClient } from '../_components/admin-sla-client';

export const dynamic = 'force-dynamic';

export default async function AdminSlaPage() {
    const resp = await listAdminSla();
    const items = resp.items ?? [];

    return (
        <Card className="flex-1 flex flex-col min-h-0 border-0 rounded-none shadow-none">
            <ZoruCardHeader>
                <ZoruCardTitle>Service Level Agreements (SLA)</ZoruCardTitle>
            </ZoruCardHeader>
            <ZoruCardContent className="flex-1 overflow-y-auto">
                <AdminSlaClient initialData={items} />
            </ZoruCardContent>
        </Card>
    );
}
