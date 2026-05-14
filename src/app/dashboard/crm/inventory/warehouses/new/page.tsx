/**
 * New Warehouse route — wraps the §1D `<WarehouseForm>` in a server
 * component so the page itself can stay tiny and idempotent.
 */

import { WarehouseForm } from './warehouse-form';

export default function NewWarehousePage() {
    return <WarehouseForm />;
}
