import { AdjustmentForm } from "./adjustment-form";

export default function NewStockAdjustmentPage() {
    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">New Stock Adjustment</h1>
                <p className="text-muted-foreground">Manually adjust inventory levels.</p>
            </div>
            <AdjustmentForm />
        </div>
    );
}
