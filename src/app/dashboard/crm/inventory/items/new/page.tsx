import { Package } from "lucide-react";
import { ProductForm } from "./product-form";

import { CrmPageHeader } from '../../../_components/crm-page-header';

export default function NewProductPage() {
    return (
        <div className="flex w-full flex-col gap-6">
            <CrmPageHeader
                title="Create New Product"
                subtitle="Add a new item to your inventory."
                icon={Package}
            />
            <ProductForm />
        </div>
    );
}
