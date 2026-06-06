import { Card, CardBody, CardHeader, CardTitle } from '@/components/sabcrm/20ui';
import { listAdminInboxes } from '@/app/actions/sabchat-admin.actions';
import { AdminInboxesClient } from '../_components/admin-inboxes-client';

export const dynamic = 'force-dynamic';

export default async function AdminInboxesPage() {
    const inboxesResp = await listAdminInboxes();
    const inboxes = inboxesResp.items ?? [];

    return (
        <Card className="flex-1 flex flex-col min-h-0 border-0 rounded-none shadow-none">
            <CardHeader>
                <CardTitle>Inboxes</CardTitle>
            </CardHeader>
            <CardBody className="flex-1 overflow-y-auto">
                <AdminInboxesClient initialData={inboxes} />
            </CardBody>
        </Card>
    );
}
