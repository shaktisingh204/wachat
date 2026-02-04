import { ProductForm } from "./product-form";

export default function NewProductPage() {
    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Create New Product</h1>
                <p className="text-muted-foreground">Add a new item to your inventory.</p>
            </div>
            <ProductForm />
        </div>
    );
}
