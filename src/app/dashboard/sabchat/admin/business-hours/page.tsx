import { Card, CardBody, CardHeader, CardTitle } from '@/components/sabcrm/20ui/compat';
import { listAdminBusinessHours } from '@/app/actions/sabchat-admin.actions';
import { AdminBusinessHoursClient } from '../_components/admin-business-hours-client';

export const dynamic = 'force-dynamic';

export default async function AdminBusinessHoursPage() {
    const resp = await listAdminBusinessHours();
    const items = resp.items ?? [];

    return (
        <Card className="flex-1 flex flex-col min-h-0 border-0 rounded-none shadow-none">
            <CardHeader>
                <CardTitle>Business Hours</CardTitle>
            </CardHeader>
            <CardBody className="flex-1 overflow-y-auto">
                <AdminBusinessHoursClient initialData={items} />
            </CardBody>
        </Card>
    );
}
