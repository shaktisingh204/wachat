import { Card, CardBody, CardHeader, CardTitle } from '@/components/sabcrm/20ui/compat';
import { listAdminMacros } from '@/app/actions/sabchat-admin.actions';
import { AdminMacrosClient } from '../_components/admin-macros-client';

export const dynamic = 'force-dynamic';

export default async function AdminMacrosPage() {
    const resp = await listAdminMacros();
    const items = resp.items ?? [];

    return (
        <Card className="flex-1 flex flex-col min-h-0 border-0 rounded-none shadow-none">
            <CardHeader>
                <CardTitle>Macros</CardTitle>
            </CardHeader>
            <CardBody className="flex-1 overflow-y-auto">
                <AdminMacrosClient initialData={items} />
            </CardBody>
        </Card>
    );
}
