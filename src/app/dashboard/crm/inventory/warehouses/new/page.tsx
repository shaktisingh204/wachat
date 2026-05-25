/**
 * New Warehouse route — wraps the §1D `<WarehouseForm>` in a server
 * component so the page itself can stay tiny and idempotent.
 */

import { Suspense } from 'react';
import { WarehouseForm } from './warehouse-form';
import NewWarehouseLoading from './loading';

export default function NewWarehousePage() {
    return (
        <Suspense fallback={<NewWarehouseLoading />}>
            <WarehouseForm />
        </Suspense>
    );
}
