import { WarehouseForm } from "./warehouse-form";

export default function NewWarehousePage() {
    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Add Warehouse</h1>
                <p className="text-muted-foreground">Create a new storage location.</p>
            </div>
            <WarehouseForm />
        </div>
    );
}
