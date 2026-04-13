import { Warehouse as WarehouseIcon } from 'lucide-react';
import { WarehouseForm } from "./warehouse-form";

import { CrmPageHeader } from '../../../_components/crm-page-header';

export default function NewWarehousePage() {
    return (
        <div className="flex w-full flex-col gap-6">
            <CrmPageHeader
                title="Add Warehouse"
                subtitle="Create a new storage location."
                icon={WarehouseIcon}
            />
            <WarehouseForm />
        </div>
    );
}
