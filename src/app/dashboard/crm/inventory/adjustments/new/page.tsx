import { SlidersHorizontal } from 'lucide-react';
import { AdjustmentForm } from "./adjustment-form";

import { CrmPageHeader } from '../../../_components/crm-page-header';

export default function NewStockAdjustmentPage() {
    return (
        <div className="flex w-full flex-col gap-6">
            <CrmPageHeader
                title="New Stock Adjustment"
                subtitle="Manually adjust inventory levels."
                icon={SlidersHorizontal}
            />
            <AdjustmentForm />
        </div>
    );
}
