import { notFound } from 'next/navigation';

import { getCrmVendorById } from '@/app/actions/crm-vendors.actions';
import { CrmPageHeader } from '../../../../_components/crm-page-header';
import { VendorEditForm } from './edit-form';

interface PageProps {
    params: Promise<{ id: string }>;
}

export default async function VendorEditPage({ params }: PageProps) {
    const { id } = await params;
    const vendor = await getCrmVendorById(id);
    if (!vendor) notFound();

    return (
        <div className="space-y-6">
            <CrmPageHeader title={`Edit ${(vendor as any).name || 'vendor'}`} />
            <VendorEditForm vendor={vendor as any} />
        </div>
    );
}
