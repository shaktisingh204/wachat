import { notFound } from 'next/navigation';

import { getCrmVendorById } from '@/app/actions/crm-vendors.actions';
import { EntityListShell } from '@/components/crm/entity-list-shell';
import { VendorEditForm } from './edit-form';

interface PageProps {
    params: Promise<{ vendorId: string }>;
}

export default async function VendorEditPage({ params }: PageProps) {
    const { vendorId: id } = await params;
    const vendor = await getCrmVendorById(id);
    if (!vendor) notFound();

    return (
        <EntityListShell title={`Edit ${(vendor as any).name || 'vendor'}`}>
            <VendorEditForm vendor={vendor as any} />
        </EntityListShell>
    );
}
