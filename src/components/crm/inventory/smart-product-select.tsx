'use client';

import * as React from "react";
import { SmartCombobox } from "@/components/wabasimplify/smart-combobox";
import { getCrmProducts } from "@/app/actions/crm-products.actions";

interface SmartProductSelectProps {
    value?: string;
    onSelect: (value: string) => void;
    placeholder?: string;
    disabled?: boolean;
    className?: string;
    onProductChange?: (product: any) => void;
}

import { QuickAddProductDialog } from "@/components/crm/inventory/quick-add-product-dialog";

export function SmartProductSelect({
    value,
    onSelect,
    placeholder = "Select Product...",
    disabled = false,
    className,
    onProductChange,
}: SmartProductSelectProps) {
    const [options, setOptions] = React.useState<{ value: string; label: string }[]>([]);
    const [products, setProducts] = React.useState<any[]>([]);
    const [isDialogOpen, setIsDialogOpen] = React.useState(false);
    const [searchQuery, setSearchQuery] = React.useState('');

    const fetchProducts = React.useCallback(async () => {
        // ... existing fetch logic or refetch ...
        // For now just basic fetch, optimization later
        const { products: fetchedProducts } = await getCrmProducts(1, 100);
        setProducts(fetchedProducts);
        setOptions(fetchedProducts.map(d => ({ value: d._id.toString(), label: `${d.name} (${d.sku})` })));
    }, []);

    React.useEffect(() => {
        fetchProducts();
    }, [fetchProducts]);

    const handleProductAdded = (newProduct: any) => {
        if (newProduct) {
            const newOption = { value: newProduct._id?.toString() || newProduct.insertedId?.toString(), label: `${newProduct.name} (${newProduct.sku})` };
            setOptions(prev => [...prev, newOption]);
            setProducts(prev => [...prev, newProduct]); // Add to local list
            onSelect(newOption.value);
            if (onProductChange) onProductChange(newProduct);
        }
    };

    const handleSelect = (val: string) => {
        onSelect(val);
        if (onProductChange) {
            const product = products.find(p => p._id.toString() === val);
            if (product) onProductChange(product);
        }
    }

    return (
        <>
            <SmartCombobox
                options={options}
                value={value}
                onSelect={handleSelect}
                placeholder={placeholder}
                searchPlaceholder="Search products..."
                disabled={disabled}
                className={className}
                onCreate={(query) => {
                    setSearchQuery(query);
                    setIsDialogOpen(true);
                }}
            />
            <QuickAddProductDialog
                open={isDialogOpen}
                onOpenChange={setIsDialogOpen}
                onProductAdded={handleProductAdded}
                defaultName={searchQuery}
            />
        </>
    );
}
