import { notFound } from 'next/navigation';

import { CrmPageHeader } from '../../../_components/crm-page-header';
import { getDashboardById } from '@/app/actions/crm-dashboards.actions';
import { DashboardEditForm } from './edit-form';

interface PageProps {
    params: Promise<{ id: string }>;
}

export default async function DashboardEditPage({ params }: PageProps) {
    const { id } = await params;
    const d = await getDashboardById(id);
    if (!d) notFound();

    return (
        <div className="space-y-6">
            <CrmPageHeader title={`Edit ${d.name || 'dashboard'}`} />
            <DashboardEditForm dashboard={{ ...d, _id: String(d._id ?? id) }} />
        </div>
    );
}
